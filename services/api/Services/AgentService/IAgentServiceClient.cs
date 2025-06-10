using GamerUncle.Api.Models;

namespace GamerUncle.Api.Services.Interfaces
{
    public interface IAgentServiceClient
    {
        Task<AgentResponse> GetRecommendationsAsync(string userInput, string? threadId = null);
    }
}