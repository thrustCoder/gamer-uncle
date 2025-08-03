using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Net.Http;
using System.Text.Json;
using Xunit;
using GamerUncle.Api.FunctionalTests.Infrastructure;
using Xunit.Abstractions;

namespace GamerUncle.Api.FunctionalTests.Authentication
{
    public class AuthenticationIntegrationTests : IClassFixture<TestFixture>
    {
        private readonly TestFixture _fixture;
        private readonly HttpClient _client;
        private readonly ITestOutputHelper _output;
        private readonly bool _isLocalTesting;

        public AuthenticationIntegrationTests(TestFixture fixture, ITestOutputHelper output)
        {
            _fixture = fixture;
            _output = output;
            _isLocalTesting = _fixture.Configuration.BaseUrl.Contains("localhost") || 
                             Environment.GetEnvironmentVariable("TEST_ENVIRONMENT") == "Local";

            if (_isLocalTesting)
            {
                // For local testing, use WebApplicationFactory for in-process testing
                var factory = new WebApplicationFactory<Program>();
                _client = factory.CreateClient();
            }
            else
            {
                // For external API testing (Dev/Prod), use the external HTTP client
                _client = _fixture.HttpClient;
            }
        }

        [Fact]
        public async Task HealthCheck_ShouldReturnStatus()
        {
            _output.WriteLine($"Testing health endpoint at: {_fixture.Configuration.BaseUrl}");
            _output.WriteLine($"Using local testing: {_isLocalTesting}");
            
            // Act
            var response = await _client.GetAsync("/health");

            // Assert
            _output.WriteLine($"Health check response: {response.StatusCode}");
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
            _output.WriteLine($"Testing Azure auth health check at: {_fixture.Configuration.BaseUrl}");
            
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
            _output.WriteLine($"Testing self health check at: {_fixture.Configuration.BaseUrl}");
            
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
            // This test only runs for local in-process testing where DI container is available
            if (!_isLocalTesting)
            {
                _output.WriteLine("Skipping DI container test for external API testing");
                return;
            }

            // Arrange & Act
            var factory = new WebApplicationFactory<Program>();
            using var scope = factory.Services.CreateScope();
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
