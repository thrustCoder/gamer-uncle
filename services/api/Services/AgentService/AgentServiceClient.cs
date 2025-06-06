using System.Text;
using System.Text.Json;
using Azure;
using Azure.AI.Agents.Persistent;
using Azure.AI.Projects;
using Azure.Identity;
using GamerUncle.Shared.Models;
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

        public async Task<string> GetRecommendationsAsync(string userInput)
        {
            try
            {
                Console.WriteLine($"Starting agent request with input: {userInput}");

                // Step 1: Extract query criteria using AI Agent
                var criteria = await ExtractGameCriteriaViaAgent(userInput);

                // Step 2: Query Cosmos DB for matching games
                var matchingGames = await _cosmosDbService.QueryGamesAsync(criteria);

                // Step 3: Format RAG context
                var ragContext = FormatGamesForRag(matchingGames); // Converts game list to plain text

                // Step 4: Start agent conversation with context + input
                var messages = new[]
                {
                    new { role = "system", content = "Use the following board games data to help answer the query." },
                    new { role = "user", content = ragContext },
                    new { role = "user", content = userInput }
                };

                var requestPayload = new { messages };

                // Step 5: Create and run agent thread
                var response = await RunAgentWithMessagesAsync(requestPayload);
                return response ?? "No response from agent.";
            }
            catch (Exception ex)
            {
                return $"Error: {ex.Message}";
            }
        }

        private async Task<GameQueryCriteria> ExtractGameCriteriaViaAgent(string userInput)
        {
            var messages = new[]
            {
                new {
                    role = "system",
                    content = @"Extract relevant game filter parameters from the following user request and return as a JSON object using these fields: 
                                name, MinPlayers, MaxPlayers, MinPlaytime, MaxPlaytime, Mechanics (array), Categories (array), MaxWeight, averageRating, 
                                ageRequirement. Remember the following rules:
                                1. If a field is not mentioned, it should be null or omitted.
                                2. If a field is mentioned but not specified, it should be null.
                                3. If a field is mentioned with a count of players range (e.g., '2-4 players'), use the min and max values.
                                4. If a field is mentioned with a single value for count of players (e.g., '2 players'), set both Min and Max to that value.
                                5. If a field is mentioned with a list of mechanics or categories (e.g., 'strategy, card game'), split into an array.
                                6. If a field is mentioned with a rating (e.g., 'average rating 4.5'), set averageRating to that value.
                                7. If a field is mentioned with an age requirement (e.g., 'age 12+'), set ageRequirement to that value.
                                8. If a field is mentioned with a weight (e.g., 'lightweight'), set MaxWeight to a reasonable value based on the context.
                                9. If the user asks for a specific game, set name to that game title. However, if the user asks for games similar to a specific game, do not set name.
                                10. If the user asks for games with specific mechanics or categories, set Mechanics and Categories arrays accordingly."
                },
                new { role = "user", content = userInput }
            };

            var requestPayload = new { messages };
            var json = await RunAgentWithMessagesAsync(requestPayload);

            return JsonSerializer.Deserialize<GameQueryCriteria>(json ?? "{}") ?? new GameQueryCriteria();
        }

        private async Task<string?> RunAgentWithMessagesAsync(object requestPayload)
        {
            PersistentAgent agent = _agentsClient.Administration.GetAgent(_agentId);
            PersistentAgentThread thread = _agentsClient.Threads.CreateThread();
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
            return lastMessage?.ContentItems.OfType<MessageTextContent>().FirstOrDefault()?.Text;
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
                sb.AppendLine($"- {game.name}: {game.overview} (Players: {game.minPlayers}-{game.maxPlayers}, Playtime: {game.minPlaytime}-{game.maxPlaytime} min, Weight: {game.weight})");
            }
            return sb.ToString();
        }
    }
}
