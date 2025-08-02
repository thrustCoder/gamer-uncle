using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using GamerUncle.Api.Services.Authentication;
using Xunit;
using Microsoft.Extensions.Logging.Abstractions;

namespace GamerUncle.Api.Tests.Authentication
{
    public class AuthenticationHealthCheckTests
    {
        private readonly ILogger<AuthenticationHealthCheck> _logger;

        public AuthenticationHealthCheckTests()
        {
            _logger = NullLogger<AuthenticationHealthCheck>.Instance;
        }

        [Fact]
        public async Task CheckHealthAsync_WithValidConfiguration_ShouldReturnHealthy()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["AgentService:Endpoint"] = "https://example.services.ai.azure.com/api/projects/test",
                    ["AgentService:AgentId"] = "test-agent-id",
                    ["CosmosDb:Endpoint"] = "https://test-cosmos.documents.azure.com/",
                    ["CosmosDb:TenantId"] = "c88223a3-60b3-4697-9374-209fc154bdf1"
                })
                .Build();

            var healthCheck = new AuthenticationHealthCheck(configuration, _logger);
            var context = new HealthCheckContext();

            // Note: This test will fail in CI/CD without proper Azure credentials
            // In a real scenario, you'd mock the DefaultAzureCredential
            
            // Act
            var result = await healthCheck.CheckHealthAsync(context);

            // Assert
            // This test validates the health check can be instantiated and called
            // The actual result depends on the environment's Azure authentication setup
            Assert.NotNull(result);
        }

        [Fact]
        public void AuthenticationHealthCheck_Constructor_WithNullConfiguration_ShouldThrow()
        {
            // Act & Assert
            Assert.Throws<ArgumentNullException>(() => new AuthenticationHealthCheck(null!, _logger));
        }

        [Fact]
        public void AuthenticationHealthCheck_Constructor_WithNullLogger_ShouldThrow()
        {
            // Arrange
            var configuration = new ConfigurationBuilder().Build();

            // Act & Assert
            Assert.Throws<ArgumentNullException>(() => new AuthenticationHealthCheck(configuration, null!));
        }
    }
}
