using System.Reflection;
using GamerUncle.Api.Services.AgentService;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;
using Microsoft.ApplicationInsights;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace GamerUncle.Api.Tests
{
    public class ResponseQualityTests
    {
        private class FakeCosmos : ICosmosDbService
        {
            public Task<IEnumerable<GameDocument>> QueryGamesAsync(GameQueryCriteria criteria) => Task.FromResult<IEnumerable<GameDocument>>(new List<GameDocument>());
            public Task<IEnumerable<GameSummary>> QueryGameSummariesAsync(GameQueryCriteria criteria, int top = 50) => Task.FromResult<IEnumerable<GameSummary>>(new List<GameSummary>());
        }

        private AgentServiceClient CreateClient()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                {"AgentService:Endpoint", "https://example.contoso.azure.com"},
                {"AgentService:AgentId", "agent-test"},
                {"ASPNETCORE_ENVIRONMENT", "Testing"}
            }).Build();
            return new AgentServiceClient(config, new FakeCosmos(), null, null);
        }

        private static bool InvokeIsLowQuality(AgentServiceClient client, string? text)
        {
            var m = typeof(AgentServiceClient).GetMethod("IsLowQualityResponse", BindingFlags.NonPublic | BindingFlags.Instance)!;
            return (bool)m.Invoke(client, new object?[] { text })!;
        }

        private static string InvokeEnhanced(AgentServiceClient client, string input)
        {
            var m = typeof(AgentServiceClient).GetMethod("GenerateEnhancedResponse", BindingFlags.NonPublic | BindingFlags.Instance)!;
            return (string)m.Invoke(client, new object?[] { input, new List<GameSummary>() })!;
        }

        [Theory]
        [InlineData("Looking into that for you! 🎲")]
        [InlineData("On it! Give me a moment to help! ⭐")]
        [InlineData("Let me help you with that board game question! 🎯")]
        public void DetectsFallbackPatterns(string text)
        {
            var client = CreateClient();
            Assert.True(InvokeIsLowQuality(client, text));
        }

        [Fact]
        public void EnhancedResponse_IncludesCoreGames()
        {
            var client = CreateClient();
            var enhanced = InvokeEnhanced(client, "How to win at Ticket to Ride?");
            Assert.Contains("Catan", enhanced);
            Assert.Contains("Ticket to Ride", enhanced);
            Assert.Contains("tip", enhanced.ToLowerInvariant());
        }

        [Fact]
        public void ShortEmpty_IsLowQuality()
        {
            var client = CreateClient();
            Assert.True(InvokeIsLowQuality(client, ""));
            Assert.True(InvokeIsLowQuality(client, "Hi"));
        }
    }
}
