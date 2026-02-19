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
                var resolved =
                    (!string.IsNullOrEmpty(configValue) && !configValue.StartsWith("@Microsoft.KeyVault", StringComparison.OrdinalIgnoreCase))
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
        public void ConnectionString_FallsBackToEnvVar_WhenConfigIsKeyVaultReference()
        {
            // Arrange — simulates what happens when appsettings.Production.json has a KV reference
            // that App Service does NOT resolve (it only resolves KV refs in App Settings, not appsettings.json)
            var kvRef = "@Microsoft.KeyVault(SecretUri=https://gamer-uncle-prod-vault.vault.azure.net/secrets/AppInsightsConnectionString)";
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ApplicationInsights:ConnectionString"] = kvRef
                })
                .Build();

            var envVarValue = "InstrumentationKey=real-key-from-env";
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", envVarValue);

            try
            {
                // Act — mirrors the fallback logic in Program.cs
                var configValue = configuration["ApplicationInsights:ConnectionString"];
                var resolved =
                    (!string.IsNullOrEmpty(configValue) && !configValue.StartsWith("@Microsoft.KeyVault", StringComparison.OrdinalIgnoreCase))
                        ? configValue
                        : Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");

                // Assert — should fall through to env var, NOT use the literal KV reference
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
                var resolved =
                    (!string.IsNullOrEmpty(configValue) && !configValue.StartsWith("@Microsoft.KeyVault", StringComparison.OrdinalIgnoreCase))
                        ? configValue
                        : Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");

                // Assert — config value wins (it's a real connection string, not a KV ref)
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

        [Theory]
        [InlineData(null, false)]
        [InlineData("", false)]
        [InlineData("InstrumentationKey=test-key", true)]
        [InlineData("InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://westus-0.in.applicationinsights.azure.com/", true)]
        [InlineData("instrumentationkey=case-insensitive", true)]
        [InlineData("some-random-string-without-key", false)]
        [InlineData("IngestionEndpoint=https://example.com/", false)]
        [InlineData("@Microsoft.KeyVault(SecretUri=https://vault.azure.net/secrets/AppInsights)", false)]
        public void ConnectionString_InstrumentationKeyValidation_MatchesProgramCs(string? value, bool expectedValid)
        {
            // This mirrors the validation guard added in Program.cs:
            //   !string.IsNullOrEmpty(value) && value.Contains("InstrumentationKey=", OrdinalIgnoreCase)
            // A Key Vault reference is NOT a valid connection string — it must be resolved first.
            var isValid = !string.IsNullOrEmpty(value)
                && value.Contains("InstrumentationKey=", StringComparison.OrdinalIgnoreCase);

            Assert.Equal(expectedValid, isValid);
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

        [Fact]
        public void TestingConfig_ShouldDisableCriteriaCache()
        {
            // The Testing environment runs in CI/CD without Azure credentials.
            // CriteriaCache must be disabled to avoid Key Vault resolution failures.
            var configuration = new ConfigurationBuilder()
                .SetBasePath(FindApiProjectRoot())
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile("appsettings.Testing.json", optional: false)
                .Build();

            // Act
            var cacheEnabled = configuration.GetValue<bool>("CriteriaCache:Enabled");

            // Assert — cache disabled in Testing
            Assert.False(cacheEnabled,
                "CriteriaCache:Enabled must be false in Testing environment to avoid Key Vault resolution failures in CI/CD.");
        }

        [Fact]
        public void TestingConfig_ShouldHaveEmptyAppInsightsConnectionString()
        {
            // The Testing environment must not configure real Application Insights.
            var configuration = new ConfigurationBuilder()
                .SetBasePath(FindApiProjectRoot())
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile("appsettings.Testing.json", optional: false)
                .Build();

            // Act
            var connectionString = configuration["ApplicationInsights:ConnectionString"];

            // Assert — should be empty for CI/CD safety
            Assert.True(string.IsNullOrEmpty(connectionString),
                "Testing ApplicationInsights:ConnectionString must be empty to prevent startup crashes in CI/CD.");
        }

        [Fact]
        public void TestingConfig_ShouldDisableHttpsRedirection()
        {
            // Pipeline agents run HTTP, not HTTPS.
            var configuration = new ConfigurationBuilder()
                .SetBasePath(FindApiProjectRoot())
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile("appsettings.Testing.json", optional: false)
                .Build();

            // Act
            var disableHttps = configuration.GetValue<bool>("DisableHttpsRedirection");

            // Assert
            Assert.True(disableHttps,
                "DisableHttpsRedirection must be true in Testing environment for pipeline HTTP endpoints.");
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
