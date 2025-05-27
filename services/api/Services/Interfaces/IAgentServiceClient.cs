namespace GamerUncle.Api.Services.Interfaces
{
    public interface IAgentServiceClient
    {
        Task<string> GetRecommendationsAsync(string userInput);
    }
}