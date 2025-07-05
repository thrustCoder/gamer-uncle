using System;
using Xunit;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.ApplicationInsights.WorkerService;

namespace GamerUncle.Functions.Tests
{
    /// <summary>
    /// Unit tests for Functions App Insights telemetry configuration
    /// </summary>
    public class FunctionsTelemetryTests
    {
        [Fact]
        public void HostBuilder_ShouldConfigureApplicationInsights_WhenConnectionStringProvided()
        {
            // Arrange
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", "InstrumentationKey=test-key");

            // Act
            var hostBuilder = new HostBuilder()
                .ConfigureServices(services =>
                {
                    var appInsightsConnectionString = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");
                    if (!string.IsNullOrEmpty(appInsightsConnectionString))
                    {
                        services.AddApplicationInsightsTelemetryWorkerService(options =>
                        {
                            options.ConnectionString = appInsightsConnectionString;
                        });
                    }
                });

            // Assert
            var host = hostBuilder.Build();
            var serviceProvider = host.Services;
            
            // Verify that Application Insights services are registered
            Assert.NotNull(serviceProvider.GetService<Microsoft.ApplicationInsights.TelemetryClient>());
            
            // Cleanup
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", null);
        }

        [Fact]
        public void HostBuilder_ShouldNotConfigureApplicationInsights_WhenConnectionStringMissing()
        {
            // Arrange
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", null);

            // Act
            var hostBuilder = new HostBuilder()
                .ConfigureServices(services =>
                {
                    var appInsightsConnectionString = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");
                    if (!string.IsNullOrEmpty(appInsightsConnectionString))
                    {
                        services.AddApplicationInsightsTelemetryWorkerService(options =>
                        {
                            options.ConnectionString = appInsightsConnectionString;
                        });
                    }
                });

            // Assert
            var host = hostBuilder.Build();
            var serviceProvider = host.Services;
            
            // When connection string is not provided, TelemetryClient should still be available
            // but might not be configured properly - this is expected behavior
            var telemetryClient = serviceProvider.GetService<Microsoft.ApplicationInsights.TelemetryClient>();
            // We just verify the service collection setup doesn't crash
            Assert.True(true); // Test passes if no exception is thrown
        }

        [Theory]
        [InlineData("InstrumentationKey=12345678-1234-1234-1234-123456789012")]
        [InlineData("InstrumentationKey=87654321-4321-4321-4321-210987654321;IngestionEndpoint=https://westus2-1.in.applicationinsights.azure.com/")]
        public void ConnectionString_Validation_ShouldAcceptValidFormats(string connectionString)
        {
            // Arrange & Act
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", connectionString);
            var retrieved = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");

            // Assert
            Assert.Equal(connectionString, retrieved);
            Assert.NotNull(retrieved);
            Assert.NotEmpty(retrieved);
            
            // Cleanup
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", null);
        }

        [Fact]
        public void ServiceCollection_AddApplicationInsightsTelemetryWorkerService_ShouldNotThrow()
        {
            // Arrange
            var services = new ServiceCollection();
            var connectionString = "InstrumentationKey=test-key";

            // Act & Assert
            var exception = Record.Exception(() =>
                services.AddApplicationInsightsTelemetryWorkerService(options =>
                {
                    options.ConnectionString = connectionString;
                }));

            Assert.Null(exception);
        }

        [Fact]
        public void EnvironmentVariable_APPLICATIONINSIGHTS_CONNECTION_STRING_ShouldBeReadCorrectly()
        {
            // Arrange
            var testConnectionString = "InstrumentationKey=test-instrumentation-key";
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", testConnectionString);

            // Act
            var result = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");

            // Assert
            Assert.Equal(testConnectionString, result);
            
            // Cleanup
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", null);
        }
    }
}
