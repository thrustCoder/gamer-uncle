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
        private readonly HttpClient _httpClient;

        public AgentServiceClient(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            var endpoint = new Uri(config["AgentService:Endpoint"] ?? throw new InvalidOperationException("Agent endpoint missing"));
            _agentId = config["AgentService:AgentId"] ?? throw new InvalidOperationException("Agent ID missing");

            var toolApiBaseUrl = config["AgentService:ToolApiBaseUrl"];
            if (!string.IsNullOrWhiteSpace(toolApiBaseUrl))
            {
                _httpClient.BaseAddress = new Uri(toolApiBaseUrl);
            }

            // Uses DefaultAzureCredential - works in Codespaces with Azure login or local dev with `az login`
            _projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
            _agentsClient = _projectClient.GetPersistentAgentsClient();
        }

        public async Task<string> GetRecommendationsAsync(string userInput)
        {
            // Step -1: Query the local App Service tool endpoint for board game data
            string toolJson = "[]";
            try
            {
                var localToolResponse = await _httpClient.GetAsync($"/api/Tools/GameSearchExternal?query={Uri.EscapeDataString(userInput)}");
                if (localToolResponse.IsSuccessStatusCode)
                {
                    toolJson = await localToolResponse.Content.ReadAsStringAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AgentServiceClient] Warning: Tool endpoint call failed. {ex.Message}");
            }

            // Step 0: Construct original GPT prompt with RAG-style context
            var requestPayload = new
            {
                messages = new[] {
                    new { role = "user", content = userInput },
                    new { role = "user", content = $"Here are some structured board game suggestions to consider: {toolJson}" }
                }
            };

            // Step 1: Get agent reference
            PersistentAgent agent = _agentsClient.Administration.GetAgent(_agentId);

            // Step 2: Create thread (can be reused if you store IDs)
            PersistentAgentThread thread = _agentsClient.Threads.CreateThread();

            // Step 3: Add user message
            _agentsClient.Messages.CreateMessage(thread.Id, MessageRole.User, JsonSerializer.Serialize(requestPayload));

            // Step 4: Run the agent
            ThreadRun run = _agentsClient.Runs.CreateRun(thread.Id, agent.Id);

            // Step 5: Poll until complete
            do
            {
                await Task.Delay(500);
                run = _agentsClient.Runs.GetRun(thread.Id, run.Id);
            }
            while (run.Status == RunStatus.Queued || run.Status == RunStatus.InProgress);

            if (run.Status != RunStatus.Completed)
                throw new InvalidOperationException($"Agent run failed: {run.LastError?.Message}");

            // Step 6: Read response messages
            Pageable<PersistentThreadMessage> messages = _agentsClient.Messages.GetMessages(thread.Id, order: ListSortOrder.Descending);

            var response = messages.FirstOrDefault(m => m.Role.ToString().Equals("assistant", StringComparison.OrdinalIgnoreCase));
            var responseText = response?.ContentItems.OfType<MessageTextContent>().FirstOrDefault()?.Text;

            return responseText ?? "No response received from agent.";        }
    }
}
