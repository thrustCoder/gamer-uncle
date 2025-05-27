using System.Net.Http;
using System.Text;
using System.Text.Json;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.AgentService
{
    public class AgentServiceClient : IAgentServiceClient
    {
        private readonly HttpClient _httpClient;
        private const string AgentServiceEndpoint = "https://your-agent-service-endpoint/v1/chat/completions"; // TODO: Replace with real URL
        private const string ApiKey = "your-api-key"; // TODO: Replace with secure retrieval

        public AgentServiceClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
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