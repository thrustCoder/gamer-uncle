using System.Text;
using System.Text.Json;
using Azure;
using Azure.AI.Agents.Persistent;
using Azure.AI.Projects;
using Azure.Identity;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Services.Cosmos; // Add the correct namespace for CosmosDbService

namespace GamerUncle.Api.Services.AgentService
{
    public class AgentServiceClient : IAgentServiceClient
    {
        private readonly AIProjectClient _projectClient;
        private readonly PersistentAgentsClient _agentsClient;
        private readonly string _agentId;
        private readonly ICosmosDbService _cosmosDbService;

        public AgentServiceClient(IConfiguration config, ICosmosDbService cosmosDbService)
        {
            var endpoint = new Uri(config["AgentService:Endpoint"] ?? throw new InvalidOperationException("Agent endpoint missing"));
            _agentId = config["AgentService:AgentId"] ?? throw new InvalidOperationException("Agent ID missing");

            // Uses DefaultAzureCredential - works in Codespaces with Azure login or local dev with `az login`
            _projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
            _agentsClient = _projectClient.GetPersistentAgentsClient();
            _cosmosDbService = cosmosDbService ?? throw new ArgumentNullException(nameof(cosmosDbService));
        }

        public async Task<AgentResponse> GetRecommendationsAsync(string userInput, string? threadId = null)
        {
            try
            {
                Console.WriteLine($"Starting agent request with input: {userInput}");

                // Step 1: Extract query criteria using AI Agent
                var criteria = await ExtractGameCriteriaViaAgent(userInput, threadId);
                
                // Step 2: Query Cosmos DB for matching games
                List<GameDocument> matchingGames;
                var messages = new List<object>();
                if (criteria == null ||
                    (string.IsNullOrEmpty(criteria.name) &&
                    !criteria.MinPlayers.HasValue &&
                    !criteria.MaxPlayers.HasValue &&
                    !criteria.MinPlaytime.HasValue &&
                    !criteria.MaxPlaytime.HasValue &&
                    criteria.Mechanics == null &&
                    criteria.Categories == null &&
                    !criteria.MaxWeight.HasValue &&
                    !criteria.averageRating.HasValue &&
                    !criteria.ageRequirement.HasValue))
                {
                    matchingGames = new List<GameDocument>();
                    messages = new[]
                    {
                        new { role = "user", content = userInput }
                    }.ToList<object>();
                }
                else
                {
                    var queryResults = await _cosmosDbService.QueryGamesAsync(criteria);
                    // Sort games by user rating in descending order (highest rated first)
                    matchingGames = queryResults
                        .OrderByDescending(game => game.averageRating)
                        .ToList();
                    var ragContext = FormatGamesForRag(matchingGames);
                    messages = new[]
                    {
                        new { role = "system", content = "Use the following board games data to help answer the query." },
                        new { role = "user", content = ragContext },
                        new { role = "user", content = userInput }
                    }.ToList<object>();
                }

                var requestPayload = new { messages };

                // Step 5: Create and run agent thread
                var (response, currentThreadId) = await RunAgentWithMessagesAsync(requestPayload, threadId);
                  return new AgentResponse
                {
                    ResponseText = response ?? "Oops! It seems I didn't get a response from my brain 🤖 Let's try that again - I'm usually much better at this!",
                    ThreadId = currentThreadId,
                    MatchingGamesCount = matchingGames.Count
                };
            }            catch (Exception ex)
            {
                return new AgentResponse
                {
                    ResponseText = $"Whoops! Something unexpected happened while I was searching for games: {ex.Message}. Don't worry though - let's give it another shot! 🎲",
                    ThreadId = null,
                    MatchingGamesCount = 0
                };
            }
        }        private async Task<GameQueryCriteria> ExtractGameCriteriaViaAgent(string userInput, string? sessionId)
        {
            var messages = new[]
            {
                new {
                    role = "system",
                    content = @"You are a criteria extraction service. Extract relevant game filter parameters from the following user request and return ONLY a valid JSON object using these fields: 
                                name, MinPlayers, MaxPlayers, MinPlaytime, MaxPlaytime, Mechanics (array), Categories (array), MaxWeight, averageRating, 
                                ageRequirement. 
                                
                                CRITICAL: Your response must be ONLY valid JSON with no additional text, explanations, or formatting.
                                
                                Rules:
                                1. If a field is not mentioned, it should be null or omitted.
                                2. If a field is mentioned but not specified, it should be null.
                                3. If a field is mentioned with a count of players range (e.g., '2-4 players'), use the min and max values.
                                4. If a field is mentioned with a single value for count of players (e.g., '2 players'), set both Min and Max to that value.
                                5. If a field is mentioned with a list of mechanics or categories (e.g., 'strategy, card game'), split into an array.
                                6. If a field is mentioned with a rating (e.g., 'average rating 4.5'), adjust the value to a scale of 1 to 10 and set averageRating to that value.
                                7. If a field is mentioned with a play time (e.g., '60 minutes'), adjust the value to the number of minutes and set MinPlaytime or MaxPlaytime according to context.
                                8. If a field is mentioned with an age requirement (e.g., 'age 12+'), set ageRequirement to that value assuming years as the unit.
                                9. If a field is mentioned with a weight (e.g., 'lightweight'), set MaxWeight to a reasonable value on a scale of 1 to 5.
                                10. If the user asks for a specific game, set name to that value in title case. However, if the user asks for games similar to a specific game, do not set name. Try to be really conservative with setting name.
                                11. If the user asks for games with specific mechanics or categories, set Mechanics and Categories arrays accordingly."
                },
                new { role = "user", content = userInput }
            };

            var requestPayload = new { messages };
            
            // Use a direct agent call for criteria extraction, bypassing the JSON format modification
            var (json, _) = await RunAgentForCriteriaExtractionAsync(requestPayload, sessionId);

            try
            {
                return JsonSerializer.Deserialize<GameQueryCriteria>(json ?? "{}") ?? new GameQueryCriteria();
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"Failed to parse criteria JSON: {json}. Error: {ex.Message}");
                return new GameQueryCriteria();
            }
        }private async Task<(string? response, string threadId)> RunAgentWithMessagesAsync(object requestPayload, string? threadId)
        {
            PersistentAgent agent = _agentsClient.Administration.GetAgent(_agentId);

            PersistentAgentThread thread;
            try
            {
                if (!string.IsNullOrEmpty(threadId))
                {
                    Console.WriteLine($"Using existing thread: {threadId}");
                    thread = _agentsClient.Threads.GetThread(threadId);
                }
                else
                {
                    Console.WriteLine("Creating new thread");
                    thread = _agentsClient.Threads.CreateThread();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving thread {threadId}: {ex.Message}. Creating new thread.");
                thread = _agentsClient.Threads.CreateThread();
            }

            // Modify the request payload to include instructions for JSON response format
            var modifiedPayload = ModifyPayloadForJsonResponse(requestPayload);
            
            _agentsClient.Messages.CreateMessage(thread.Id, MessageRole.User, JsonSerializer.Serialize(modifiedPayload));

            ThreadRun run = _agentsClient.Runs.CreateRun(thread.Id, agent.Id);

            int pollCount = 0;
            do
            {
                await Task.Delay(500);
                run = _agentsClient.Runs.GetRun(thread.Id, run.Id);
                pollCount++;
            } while ((run.Status == RunStatus.Queued || run.Status == RunStatus.InProgress) && pollCount < 60);

            var messagesResult = _agentsClient.Messages.GetMessages(thread.Id, order: ListSortOrder.Ascending);
            var lastMessage = messagesResult.LastOrDefault();
            var rawResponse = lastMessage?.ContentItems.OfType<MessageTextContent>().FirstOrDefault()?.Text;

            // Extract the actual response content and ensure it's valid
            var response = ExtractAndValidateResponse(rawResponse);

            return (response, thread.Id);
        }

        private async Task<(string? response, string threadId)> RunAgentForCriteriaExtractionAsync(object requestPayload, string? threadId)
        {
            PersistentAgent agent = _agentsClient.Administration.GetAgent(_agentId);

            PersistentAgentThread thread;
            try
            {
                if (!string.IsNullOrEmpty(threadId))
                {
                    Console.WriteLine($"Using existing thread for criteria extraction: {threadId}");
                    thread = _agentsClient.Threads.GetThread(threadId);
                }
                else
                {
                    Console.WriteLine("Creating new thread for criteria extraction");
                    thread = _agentsClient.Threads.CreateThread();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving thread {threadId}: {ex.Message}. Creating new thread.");
                thread = _agentsClient.Threads.CreateThread();
            }

            // For criteria extraction, use the payload as-is without modification
            _agentsClient.Messages.CreateMessage(thread.Id, MessageRole.User, JsonSerializer.Serialize(requestPayload));

            ThreadRun run = _agentsClient.Runs.CreateRun(thread.Id, agent.Id);

            int pollCount = 0;
            do
            {
                await Task.Delay(500);
                run = _agentsClient.Runs.GetRun(thread.Id, run.Id);
                pollCount++;
            } while ((run.Status == RunStatus.Queued || run.Status == RunStatus.InProgress) && pollCount < 60);

            var messagesResult = _agentsClient.Messages.GetMessages(thread.Id, order: ListSortOrder.Ascending);
            var lastMessage = messagesResult.LastOrDefault();
            var rawResponse = lastMessage?.ContentItems.OfType<MessageTextContent>().FirstOrDefault()?.Text;

            // For criteria extraction, expect JSON response and extract it properly
            var response = ExtractCriteriaJsonResponse(rawResponse);

            return (response, thread.Id);
        }

        private string? ExtractCriteriaJsonResponse(string? rawResponse)
        {
            if (string.IsNullOrEmpty(rawResponse))
                return "{}";

            try
            {
                // Try to parse as JSON to see if it's a structured response
                var jsonDoc = JsonDocument.Parse(rawResponse);
                
                // If it's a messages array, extract the assistant's content
                if (jsonDoc.RootElement.TryGetProperty("messages", out var messagesProperty))
                {
                    foreach (var message in messagesProperty.EnumerateArray())
                    {
                        if (message.TryGetProperty("role", out var role) &&
                            role.GetString() == "assistant" &&
                            message.TryGetProperty("content", out var content))
                        {
                            return content.GetString();
                        }
                    }
                }
                // If it's a direct content object
                else if (jsonDoc.RootElement.TryGetProperty("content", out var directContent))
                {
                    return directContent.GetString();
                }
                
                // If it's already valid JSON that looks like criteria, return as-is
                return rawResponse;
            }
            catch (JsonException)
            {
                // If it's not JSON, try to extract JSON from the text
                // Look for JSON patterns in the response
                var jsonStart = rawResponse.IndexOf('{');
                var jsonEnd = rawResponse.LastIndexOf('}');
                
                if (jsonStart >= 0 && jsonEnd > jsonStart)
                {
                    var potentialJson = rawResponse.Substring(jsonStart, jsonEnd - jsonStart + 1);
                    try
                    {
                        // Validate it's proper JSON
                        JsonDocument.Parse(potentialJson);
                        return potentialJson;
                    }
                    catch (JsonException)
                    {
                        // If extraction failed, return empty criteria
                        return "{}";
                    }
                }
                
                // If no JSON found, return empty criteria
                return "{}";
            }
        }

        // Converts games to plain text
        private string FormatGamesForRag(IEnumerable<GameDocument> games)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Here are some board games that match the criteria:");
            if (!games.Any())
            {
                sb.AppendLine("No games found matching the criteria.");
                return sb.ToString();
            }
            sb.AppendLine($"Found {games.Count()} games:");
            sb.AppendLine();

            foreach (var game in games)
            {
                sb.AppendLine($"- {game.name}: {game.overview} (Players: {game.minPlayers}-{game.maxPlayers}, Playtime: {game.minPlaytime}-{game.maxPlaytime} min, Weight: {game.weight}, Rating: {game.averageRating:F1}/10)");
            }
            return sb.ToString();
        }

        private object ModifyPayloadForJsonResponse(object requestPayload)
        {
            // Extract the messages from the payload
            var payloadType = requestPayload.GetType();
            var messagesProperty = payloadType.GetProperty("messages");
            var messages = messagesProperty?.GetValue(requestPayload) as IEnumerable<object>;
            
            if (messages == null)
                return requestPayload;

            var messagesList = messages.ToList();
            
            // Find if there's already a system message
            bool hasSystemMessage = false;
            for (int i = 0; i < messagesList.Count; i++)
            {
                var message = messagesList[i];
                var messageType = message.GetType();
                var roleProperty = messageType.GetProperty("role");
                var role = roleProperty?.GetValue(message)?.ToString();
                  if (role == "system")
                {
                    hasSystemMessage = true;
                    // Modify existing system message to include JSON instruction and friendly tone
                    var contentProperty = messageType.GetProperty("content");
                    var existingContent = contentProperty?.GetValue(message)?.ToString() ?? "";
                    var newContent = existingContent + @"

IMPORTANT: Always respond with clear, natural language. Do not return raw JSON objects or structured data unless specifically requested to extract criteria. 

TONE & STYLE: Be friendly, warm, and playful in your responses! You're Gamer Uncle - a enthusiastic board game expert who loves helping people discover amazing games. Use:
- Warm, welcoming language (""Oh, you're going to love..."", ""I have just the perfect games for you!"")
- Excitement about games (""This one is absolutely fantastic!"", ""You're in for a treat!"")
- Personal touches (""Trust me on this one"", ""One of my all-time favorites"")
- Playful expressions (""Get ready for some serious fun!"", ""This will have you on the edge of your seat!"")
- Show genuine enthusiasm for helping people find their next favorite game
- Make recommendations feel personal and exciting, not just informational";
                    
                    messagesList[i] = new { role = "system", content = newContent };
                    break;
                }
            }
              // If no system message exists, add one
            if (!hasSystemMessage)
            {
                messagesList.Insert(0, new 
                { 
                    role = "system", 
                    content = @"You are Gamer Uncle - a friendly, enthusiastic board game expert who absolutely loves helping people discover amazing games!

IMPORTANT: Always respond with clear, natural language. Do not return raw JSON objects or structured data unless specifically requested to extract criteria.

TONE & STYLE: Be friendly, warm, and playful in your responses! Use:
- Warm, welcoming language (""Oh, you're going to love..."", ""I have just the perfect games for you!"")
- Excitement about games (""This one is absolutely fantastic!"", ""You're in for a treat!"")
- Personal touches (""Trust me on this one"", ""One of my all-time favorites"")
- Playful expressions (""Get ready for some serious fun!"", ""This will have you on the edge of your seat!"")
- Show genuine enthusiasm for helping people find their next favorite game
- Make recommendations feel personal and exciting, not just informational

Your goal is to make every interaction feel like chatting with a knowledgeable friend who can't wait to share their passion for board games!" 
                });
            }
            
            return new { messages = messagesList };
        }

        private string? ExtractAndValidateResponse(string? rawResponse)
        {
            if (string.IsNullOrEmpty(rawResponse))
                return rawResponse;

            try
            {
                // Try to parse as JSON to see if it's a structured response
                var jsonDoc = JsonDocument.Parse(rawResponse);
                
                // If it's a messages array, extract the assistant's content
                if (jsonDoc.RootElement.TryGetProperty("messages", out var messagesProperty))
                {
                    foreach (var message in messagesProperty.EnumerateArray())
                    {
                        if (message.TryGetProperty("role", out var role) &&
                            role.GetString() == "assistant" &&
                            message.TryGetProperty("content", out var content))
                        {
                            return content.GetString();
                        }
                    }
                }
                // If it's a direct content object
                else if (jsonDoc.RootElement.TryGetProperty("content", out var directContent))
                {
                    return directContent.GetString();
                }                // Check if this looks like a criteria extraction response (only contains fields like name, MinPlayers, etc.)
                else if (IsLikelyCriteriaResponse(jsonDoc.RootElement))
                {
                    // This is probably a criteria extraction response being returned as the main response
                    // Return a user-friendly message instead
                    return "Oh, I love helping with game recommendations! Let me find some absolutely fantastic games that are perfect for you! 🎲";
                }
                
                // If we can parse it as JSON but it doesn't match expected patterns, 
                // it might be an unwanted JSON response - return a friendly message
                return "I'm so excited to help you discover your next favorite game! Give me just a moment to find some amazing recommendations for you! 🎯";
            }
            catch (JsonException)
            {
                // If it's not JSON, return as-is (this is the expected case for normal responses)
                return rawResponse;
            }
        }

        private bool IsLikelyCriteriaResponse(JsonElement element)
        {
            // Check if the JSON contains typical criteria fields
            var criteriaFields = new[] { "name", "MinPlayers", "MaxPlayers", "MinPlaytime", "MaxPlaytime", "Mechanics", "Categories", "MaxWeight", "averageRating", "ageRequirement" };
            
            // If it has any of these fields and relatively few other fields, it's likely a criteria response
            int criteriaFieldCount = 0;
            int totalFieldCount = 0;
            
            foreach (var property in element.EnumerateObject())
            {
                totalFieldCount++;
                if (criteriaFields.Contains(property.Name))
                {
                    criteriaFieldCount++;
                }
            }
            
            // If most fields are criteria fields, this is likely a criteria extraction response
            return totalFieldCount > 0 && (criteriaFieldCount / (double)totalFieldCount) > 0.5;
        }
    }
}
