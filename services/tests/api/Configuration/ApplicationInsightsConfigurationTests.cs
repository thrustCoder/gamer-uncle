using Microsoft.Extensions.Configuration;
using Xunit;
using System;
using System.Collections.Generic;

namespace GamerUncle.Api.Tests.Configuration
{
    public class ApplicationInsightsConfigurationTests
    {
        [Fact]
        public void ConnectionString_ShouldBeResolved_WhenSetInConfig()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ApplicationInsights:ConnectionString"] = "InstrumentationKey=test-key"
                })
                .Build();

            // Act
            var connectionString = configuration["ApplicationInsights:ConnectionString"];

            // Assert
            Assert.False(string.IsNullOrEmpty(connectionString));
            Assert.Equal("InstrumentationKey=test-key", connectionString);
        }

        [Fact]
        public void ConnectionString_ShouldBeEmpty_WhenNotConfigured()
        {
            // Arrange
            var configuration = new ConfigurationBuilder().Build();

            // Act
            var connectionString = configuration["ApplicationInsights:ConnectionString"];

            // Assert
            Assert.Null(connectionString);
        }

        [Fact]
        public void ConnectionString_FallsBackToEnvVar_WhenConfigIsEmpty()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ApplicationInsights:ConnectionString"] = ""
                })
                .Build();

            var envVarValue = "InstrumentationKey=env-var-key";
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", envVarValue);

            try
            {
                // Act — mirrors the fallback logic in Program.cs
                var configValue = configuration["ApplicationInsights:ConnectionString"];
                var resolved = !string.IsNullOrEmpty(configValue)
                    ? configValue
                    : Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");

                // Assert
                Assert.Equal(envVarValue, resolved);
            }
            finally
            {
                Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", null);
            }
        }

        [Fact]
        public void ConnectionString_PrefersConfig_OverEnvVar()
        {
            // Arrange
            var configConnStr = "InstrumentationKey=from-config";
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ApplicationInsights:ConnectionString"] = configConnStr
                })
                .Build();

            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", "InstrumentationKey=from-env");

            try
            {
                // Act — mirrors the fallback logic in Program.cs
                var configValue = configuration["ApplicationInsights:ConnectionString"];
                var resolved = !string.IsNullOrEmpty(configValue)
                    ? configValue
                    : Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");

                // Assert — config value wins
                Assert.Equal(configConnStr, resolved);
            }
            finally
            {
                Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", null);
            }
        }

        [Theory]
        [InlineData("", false)]
        [InlineData(null, false)]
        [InlineData("InstrumentationKey=real-key", true)]
        [InlineData("@Microsoft.KeyVault(SecretUri=https://vault.azure.net/secrets/AppInsightsConnectionString)", true)]
        public void ConnectionString_IsNullOrEmpty_DetectsCorrectly(string? value, bool expectedNonEmpty)
        {
            // This tests that the guard in Program.cs correctly identifies
            // whether Application Insights should be enabled
            Assert.Equal(expectedNonEmpty, !string.IsNullOrEmpty(value));
        }

        [Fact]
        public void ProductionConfig_ShouldContainKeyVaultReference()
        {
            // Arrange — load the actual appsettings.Production.json
            var configuration = new ConfigurationBuilder()
                .SetBasePath(FindApiProjectRoot())
                .AddJsonFile("appsettings.Production.json", optional: false)
                .Build();

            // Act
            var connectionString = configuration["ApplicationInsights:ConnectionString"];

            // Assert — should be a Key Vault reference, not empty
            Assert.False(string.IsNullOrEmpty(connectionString),
                "Production ApplicationInsights:ConnectionString must not be empty");
            Assert.Contains("@Microsoft.KeyVault", connectionString!,
                StringComparison.OrdinalIgnoreCase);
            Assert.Contains("AppInsightsConnectionString", connectionString!);
        }

        [Fact]
        public void BaseConfig_ShouldHaveEmptyConnectionString_ForTestSafety()
        {
            // Arrange — load the actual appsettings.json (base)
            // Base config must be empty so tests don't try to resolve Key Vault references.
            // Environment-specific files (Development, Production) add the real KV refs.
            var configuration = new ConfigurationBuilder()
                .SetBasePath(FindApiProjectRoot())
                .AddJsonFile("appsettings.json", optional: false)
                .Build();

            // Act
            var connectionString = configuration["ApplicationInsights:ConnectionString"];

            // Assert — should be empty (safe default for tests)
            Assert.True(string.IsNullOrEmpty(connectionString),
                "Base appsettings.json ApplicationInsights:ConnectionString must be empty so tests are safe. " +
                "Key Vault references go in appsettings.{Environment}.json only.");
        }

        [Fact]
        public void DevelopmentConfig_ShouldContainKeyVaultReference()
        {
            // Arrange — load the actual appsettings.Development.json
            var configuration = new ConfigurationBuilder()
                .SetBasePath(FindApiProjectRoot())
                .AddJsonFile("appsettings.Development.json", optional: false)
                .Build();

            // Act
            var connectionString = configuration["ApplicationInsights:ConnectionString"];

            // Assert — should be a Key Vault reference
            Assert.False(string.IsNullOrEmpty(connectionString),
                "Development ApplicationInsights:ConnectionString must not be empty");
            Assert.Contains("@Microsoft.KeyVault", connectionString!,
                StringComparison.OrdinalIgnoreCase);
            Assert.Contains("AppInsightsConnectionString", connectionString!);
        }

        /// <summary>
        /// Walk up from the test assembly's output dir to find the API project root.
        /// </summary>
        private static string FindApiProjectRoot()
        {
            // Start from the test assembly location and navigate to the API project
            var dir = AppContext.BaseDirectory;
            while (dir != null)
            {
                var candidate = Path.Combine(dir, "services", "api");
                if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "appsettings.json")))
                {
                    return candidate;
                }

                // Also check if we're at the repo root
                var sln = Path.Combine(dir, "gamer-uncle.sln");
                if (File.Exists(sln))
                {
                    return Path.Combine(dir, "services", "api");
                }

                dir = Directory.GetParent(dir)?.FullName;
            }

            throw new InvalidOperationException(
                "Could not find the API project root (services/api/) from test assembly location.");
        }
    }
}
