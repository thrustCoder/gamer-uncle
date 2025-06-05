using System.Text;
using System.Text.Json;
using Azure;
using Azure.AI.Agents.Persistent;
using Azure.AI.Projects;
using Azure.Core;
using Azure.Identity;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.AgentService
{
    public class AgentServiceClient : IAgentServiceClient
    {
        private readonly AIProjectClient _projectClient;
        private readonly PersistentAgentsClient _agentsClient;
        private readonly string _agentId;

        public AgentServiceClient(IConfiguration config)
        {
            var endpoint = new Uri(config["AgentService:Endpoint"] ?? throw new InvalidOperationException("Agent endpoint missing"));
            _agentId = config["AgentService:AgentId"] ?? throw new InvalidOperationException("Agent ID missing");

            // Uses DefaultAzureCredential - works in Codespaces with Azure login or local dev with `az login`
            _projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
            _agentsClient = _projectClient.GetPersistentAgentsClient();
        }

        public async Task<string> GetRecommendationsAsync(string userInput)
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

    }
}
