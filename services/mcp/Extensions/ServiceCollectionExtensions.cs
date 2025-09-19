using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using GamerUncle.Mcp.Services;
using GamerUncle.Mcp.Tools;

namespace GamerUncle.Mcp.Extensions
{
    /// <summary>
    /// Extension methods for configuring MCP services
    /// </summary>
    public static class ServiceCollectionExtensions
    {
        /// <summary>
        /// Adds MCP services to the dependency injection container
        /// </summary>
        public static IServiceCollection AddMcpServices(this IServiceCollection services, IConfiguration configuration)
        {
            // Register core MCP services
            services.AddSingleton<IConversationStateService, ConversationStateService>();
            services.AddSingleton<ISseConnectionManager, SseConnectionManager>();
            services.AddSingleton<GamerUncleMcpServer>();

            // Register MCP tools
            services.AddScoped<BoardGameQueryTool>();

            // Configure cleanup timer for expired conversations
            services.AddHostedService<ConversationCleanupService>();

            return services;
        }
    }

    /// <summary>
    /// Background service to clean up expired conversations
    /// </summary>
    internal class ConversationCleanupService : Microsoft.Extensions.Hosting.BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ConversationCleanupService> _logger;
        private readonly TimeSpan _cleanupInterval = TimeSpan.FromMinutes(30);

        public ConversationCleanupService(
            IServiceProvider serviceProvider,
            ILogger<ConversationCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var conversationService = scope.ServiceProvider.GetRequiredService<IConversationStateService>();
                    conversationService.CleanupExpiredConversations();

                    _logger.LogDebug("Completed MCP conversation cleanup");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during MCP conversation cleanup");
                }

                await Task.Delay(_cleanupInterval, stoppingToken);
            }
        }
    }
}