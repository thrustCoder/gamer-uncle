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
        private readonly CosmosDbService _cosmosDbService;

        public AgentServiceClient(IConfiguration config, CosmosDbService cosmosDbService)
        {
            var endpoint = new Uri(config["AgentService:Endpoint"] ?? throw new InvalidOperationException("Agent endpoint missing"));
            _agentId = config["AgentService:AgentId"] ?? throw new InvalidOperationException("Agent ID missing");

            // Uses DefaultAzureCredential - works in Codespaces with Azure login or local dev with `az login`
            _projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
            _agentsClient = _projectClient.GetPersistentAgentsClient();
            _cosmosDbService = cosmosDbService ?? throw new ArgumentNullException(nameof(cosmosDbService));
        }

        // TODO: Remove this backup method once the new one is stable
        public async Task<string> GetRecommendationsAsync_bkp(string userInput)
        {
            try
            {
                Console.WriteLine($"Starting agent request with input: {userInput}");

                // Step 0: Construct original GPT prompt with RAG-style context
                var requestPayload = new
                {
                    messages = new[] {
                new { role = "user", content = userInput }
            }
                };

                Console.WriteLine($"Getting agent with ID: {_agentId}");

                // Step 1: Get agent reference
                PersistentAgent agent = _agentsClient.Administration.GetAgent(_agentId);
                Console.WriteLine($"Agent retrieved: {agent.Name}");

                // Step 2: Create thread (can be reused if you store IDs)
                Console.WriteLine("Creating thread...");
                PersistentAgentThread thread = _agentsClient.Threads.CreateThread();
                Console.WriteLine($"Thread created: {thread.Id}");

                // Step 3: Add user message
                Console.WriteLine("Adding user message...");
                _agentsClient.Messages.CreateMessage(thread.Id, MessageRole.User, JsonSerializer.Serialize(requestPayload));

                // Step 4: Run the agent
                Console.WriteLine("Starting agent run...");
                ThreadRun run = _agentsClient.Runs.CreateRun(thread.Id, agent.Id);
                Console.WriteLine($"Run started: {run.Id}, Status: {run.Status}");

                // Step 5: Poll until complete
                int pollCount = 0;
                do
                {
                    await Task.Delay(500);
                    run = _agentsClient.Runs.GetRun(thread.Id, run.Id);
                    pollCount++;
                    Console.WriteLine($"Poll {pollCount}: Status = {run.Status}");

                    if (pollCount > 60) // 30 second timeout
                    {
                        throw new InvalidOperationException("Agent run timed out after 30 seconds");
                    }
                }
                while (run.Status == RunStatus.Queued || run.Status == RunStatus.InProgress);

                Console.WriteLine($"Final status: {run.Status}");

                if (run.Status != RunStatus.Completed)
                {
                    var errorMessage = run.LastError?.Message ?? "Unknown error";
                    Console.WriteLine($"Agent run failed with status {run.Status}: {errorMessage}");
                    throw new InvalidOperationException($"Agent run failed: {errorMessage}");
                }

                // Step 6: Read response messages
                Console.WriteLine("Reading response messages...");
                Pageable<PersistentThreadMessage> messages = _agentsClient.Messages.GetMessages(thread.Id, order: ListSortOrder.Descending);

                var response = messages.FirstOrDefault(m => m.Role.ToString().Equals("assistant", StringComparison.OrdinalIgnoreCase));
                var responseText = response?.ContentItems.OfType<MessageTextContent>().FirstOrDefault()?.Text;

                Console.WriteLine($"Response received: {responseText}");
                return responseText ?? "No response received from agent.";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Exception in GetRecommendationsAsync: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
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
                    content = "Extract relevant game filter parameters from the following user request and return as a JSON object using these fields: name, MinPlayers, MaxPlayers, MinPlaytime, MaxPlaytime, Mechanics (array), Categories (array), MaxWeight, averageRating, ageRequirement."
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
            foreach (var game in games)
            {
                sb.AppendLine($"- {game.name}: {game.overview} (Players: {game.minPlayers}-{game.maxPlayers}, Playtime: {game.minPlaytime}-{game.maxPlaytime} min, Weight: {game.weight})");
            }
            return sb.ToString();
        }
    }
}
