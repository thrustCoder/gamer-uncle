using GamerUncle.Mcp.Services;
using GamerUncle.Mcp.Tools;
using GamerUncle.Shared.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace GamerUncle.Mcp.FunctionalTests;

public static class TestHostBuilder
{
    public static (ServiceProvider provider, Mock<IAgentServiceClient> agentMock) BuildHost(
        int maxHistory = 5,
        int lifetimeHours = 1,
        Func<string, string?, AgentResponse>? responseFactory = null)
    {
        var services = new ServiceCollection();
        // Logging
        services.AddSingleton<ILoggerFactory>(sp => NullLoggerFactory.Instance);
        services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));

        // Config
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
        {
            ["Mcp:MaxQueryHistorySize"] = maxHistory.ToString(),
            ["Mcp:ConversationLifetimeHours"] = lifetimeHours.ToString()
        }).Build();
        services.AddSingleton<IConfiguration>(config);

        // Conversation state
        services.AddSingleton<IConversationStateService, ConversationStateService>();

        // Agent client mock
        var agentMock = new Mock<IAgentServiceClient>();
        responseFactory ??= (q, thread) => new AgentResponse { ResponseText = $"Answer:{q}:{thread ?? "new"}", ThreadId = thread ?? "t-new", MatchingGamesCount = 1 };
        agentMock.Setup(a => a.GetRecommendationsAsync(It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync((string q, string? t) => responseFactory(q, t));
        services.AddSingleton(agentMock.Object);

        // Tool + server
        services.AddSingleton<BoardGameQueryTool>();
        services.AddSingleton<GamerUncleMcpServer>();

        var provider = services.BuildServiceProvider();
        return ((ServiceProvider)provider, agentMock);
    }
}
