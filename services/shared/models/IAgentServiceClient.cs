namespace GamerUncle.Shared.Models
{
    public interface IAgentServiceClient
    {
        Task<AgentResponse> GetRecommendationsAsync(string userInput, string? threadId = null);
    }
}