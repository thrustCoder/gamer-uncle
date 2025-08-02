using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Net.Http;
using System.Text.Json;
using Xunit;

namespace GamerUncle.Api.FunctionalTests.Authentication
{
    public class AuthenticationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
    {
        private readonly WebApplicationFactory<Program> _factory;
        private readonly HttpClient _client;

        public AuthenticationIntegrationTests(WebApplicationFactory<Program> factory)
        {
            _factory = factory;
            _client = _factory.CreateClient();
        }

        [Fact]
        public async Task HealthCheck_ShouldReturnStatus()
        {
            // Act
            var response = await _client.GetAsync("/health");

            // Assert
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            var healthResult = JsonSerializer.Deserialize<HealthCheckResponse>(content);
            
            Assert.NotNull(healthResult);
            Assert.NotNull(healthResult.Status);
            Assert.NotNull(healthResult.Checks);
        }

        [Fact]
        public async Task HealthCheck_ShouldIncludeAzureAuthCheck()
        {
            // Act
            var response = await _client.GetAsync("/health");

            // Assert
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            var healthResult = JsonSerializer.Deserialize<HealthCheckResponse>(content);
            
            Assert.NotNull(healthResult);
            Assert.Contains(healthResult.Checks, check => check.Name == "azure_auth");
        }

        [Fact]
        public async Task HealthCheck_ShouldIncludeSelfCheck()
        {
            // Act
            var response = await _client.GetAsync("/health");

            // Assert
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            var healthResult = JsonSerializer.Deserialize<HealthCheckResponse>(content);
            
            Assert.NotNull(healthResult);
            Assert.Contains(healthResult.Checks, check => check.Name == "self");
            
            var selfCheck = healthResult.Checks.First(check => check.Name == "self");
            Assert.Equal("Healthy", selfCheck.Status);
        }

        [Fact]
        public void Services_ShouldContainAuthenticationComponents()
        {
            // Arrange & Act
            using var scope = _factory.Services.CreateScope();
            var healthCheckService = scope.ServiceProvider.GetService<HealthCheckService>();
            
            // Assert
            Assert.NotNull(healthCheckService);
        }

        private class HealthCheckResponse
        {
            public string Status { get; set; } = string.Empty;
            public List<HealthCheckItem> Checks { get; set; } = new();
        }

        private class HealthCheckItem
        {
            public string Name { get; set; } = string.Empty;
            public string Status { get; set; } = string.Empty;
            public string? Exception { get; set; }
            public TimeSpan Duration { get; set; }
            public object? Data { get; set; }
        }
    }
}
