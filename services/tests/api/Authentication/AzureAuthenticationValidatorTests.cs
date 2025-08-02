using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using GamerUncle.Api.Services.Authentication;
using Xunit;
using Microsoft.Extensions.Logging.Abstractions;

namespace GamerUncle.Api.Tests.Authentication
{
    public class AzureAuthenticationValidatorTests
    {
        private readonly ILogger<AzureAuthenticationValidator> _logger;

        public AzureAuthenticationValidatorTests()
        {
            _logger = NullLogger<AzureAuthenticationValidator>.Instance;
        }

        [Fact]
        public void ValidateConfiguration_WithValidConfig_ShouldNotThrow()
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

            var validator = new AzureAuthenticationValidator(_logger);

            // Act & Assert
            var exception = Record.Exception(() => validator.ValidateConfiguration(configuration));
            Assert.Null(exception);
        }

        [Fact]
        public void ValidateConfiguration_WithMissingAgentEndpoint_ShouldThrow()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["AgentService:AgentId"] = "test-agent-id",
                    ["CosmosDb:Endpoint"] = "https://test-cosmos.documents.azure.com/",
                    ["CosmosDb:TenantId"] = "c88223a3-60b3-4697-9374-209fc154bdf1"
                })
                .Build();

            var validator = new AzureAuthenticationValidator(_logger);

            // Act & Assert
            var exception = Assert.Throws<InvalidOperationException>(() => validator.ValidateConfiguration(configuration));
            Assert.Contains("AgentService:Endpoint", exception.Message);
        }

        [Fact]
        public void ValidateConfiguration_WithInvalidUrl_ShouldThrow()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["AgentService:Endpoint"] = "invalid-url",
                    ["AgentService:AgentId"] = "test-agent-id",
                    ["CosmosDb:Endpoint"] = "https://test-cosmos.documents.azure.com/",
                    ["CosmosDb:TenantId"] = "c88223a3-60b3-4697-9374-209fc154bdf1"
                })
                .Build();

            var validator = new AzureAuthenticationValidator(_logger);

            // Act & Assert
            var exception = Assert.Throws<InvalidOperationException>(() => validator.ValidateConfiguration(configuration));
            Assert.Contains("Invalid URL format", exception.Message);
        }

        [Fact]
        public void ValidateConfiguration_WithInvalidTenantId_ShouldThrow()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["AgentService:Endpoint"] = "https://example.services.ai.azure.com/api/projects/test",
                    ["AgentService:AgentId"] = "test-agent-id",
                    ["CosmosDb:Endpoint"] = "https://test-cosmos.documents.azure.com/",
                    ["CosmosDb:TenantId"] = "invalid-tenant-id"
                })
                .Build();

            var validator = new AzureAuthenticationValidator(_logger);

            // Act & Assert
            var exception = Assert.Throws<InvalidOperationException>(() => validator.ValidateConfiguration(configuration));
            Assert.Contains("Invalid tenant ID format", exception.Message);
        }

        [Theory]
        [InlineData("http://example.com")]
        [InlineData("https://example.com")]
        [InlineData("https://test.services.ai.azure.com/api/projects/test")]
        public void ValidateConfiguration_WithValidUrls_ShouldNotThrow(string url)
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["AgentService:Endpoint"] = url,
                    ["AgentService:AgentId"] = "test-agent-id",
                    ["CosmosDb:Endpoint"] = "https://test-cosmos.documents.azure.com/",
                    ["CosmosDb:TenantId"] = "c88223a3-60b3-4697-9374-209fc154bdf1"
                })
                .Build();

            var validator = new AzureAuthenticationValidator(_logger);

            // Act & Assert
            var exception = Record.Exception(() => validator.ValidateConfiguration(configuration));
            Assert.Null(exception);
        }

        [Theory]
        [InlineData("c88223a3-60b3-4697-9374-209fc154bdf1")]
        [InlineData("12345678-1234-1234-1234-123456789012")]
        public void ValidateConfiguration_WithValidTenantIds_ShouldNotThrow(string tenantId)
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["AgentService:Endpoint"] = "https://example.services.ai.azure.com/api/projects/test",
                    ["AgentService:AgentId"] = "test-agent-id",
                    ["CosmosDb:Endpoint"] = "https://test-cosmos.documents.azure.com/",
                    ["CosmosDb:TenantId"] = tenantId
                })
                .Build();

            var validator = new AzureAuthenticationValidator(_logger);

            // Act & Assert
            var exception = Record.Exception(() => validator.ValidateConfiguration(configuration));
            Assert.Null(exception);
        }
    }
}
