using System.Net.Http;
using System.Text;
using System.Text.Json;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.AgentService
{
    public class AgentServiceClient : IAgentServiceClient
    {
        private readonly HttpClient _httpClient;
        private readonly string AgentServiceEndpoint;
        private readonly string ApiKey;

        public AgentServiceClient(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            AgentServiceEndpoint = Environment.GetEnvironmentVariable("AGENT_SERVICE_ENDPOINT") 
                ?? config["AgentService:Endpoint"] 
                ?? throw new InvalidOperationException("AgentService endpoint is not configured.");
            ApiKey = Environment.GetEnvironmentVariable("AGENT_SERVICE_API_KEY") 
                ?? config["AgentService:ApiKey"] 
                ?? throw new InvalidOperationException("AgentService API key is not configured.");
        }

        public async Task<string> GetRecommendationsAsync(string userInput)
        {
            var requestPayload = new
            {
                messages = new[] {
                    new { role = "user", content = userInput }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, AgentServiceEndpoint)
            {
                Content = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json")
            };

            request.Headers.Add("Authorization", $"Bearer {ApiKey}");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }
    }
}