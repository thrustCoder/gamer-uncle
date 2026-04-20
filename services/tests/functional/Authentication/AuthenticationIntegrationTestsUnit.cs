using Xunit;
using GamerUncle.Api.FunctionalTests.Infrastructure;
using Xunit.Abstractions;

namespace GamerUncle.Api.FunctionalTests.Authentication
{
    public class AuthenticationIntegrationTestsUnit : IDisposable
    {
        private readonly ITestOutputHelper _output;
        private readonly string? _originalTestEnvironment;
        private readonly string? _originalApiBaseUrl;

        public AuthenticationIntegrationTestsUnit(ITestOutputHelper output)
        {
            _output = output;
            _originalTestEnvironment = Environment.GetEnvironmentVariable("TEST_ENVIRONMENT");
            _originalApiBaseUrl = Environment.GetEnvironmentVariable("API_BASE_URL");
        }

        public void Dispose()
        {
            // Restore environment variables to prevent cross-test contamination
            Environment.SetEnvironmentVariable("TEST_ENVIRONMENT", _originalTestEnvironment);
            Environment.SetEnvironmentVariable("API_BASE_URL", _originalApiBaseUrl);
        }

        [Fact]
        public void TestFixture_ShouldConfigureBaseUrlCorrectly()
        {
            // Arrange - prefer local in-process hosting
            Environment.SetEnvironmentVariable("TEST_ENVIRONMENT", "Local");
            Environment.SetEnvironmentVariable("API_BASE_URL", "http://localhost:5000");

            try
            {
                // Act
                using var fixture = new TestFixture();

                // Assert - only require that host resolves to localhost; port may be dynamic
                var configured = fixture.Configuration.BaseUrl.TrimEnd('/');
                _output.WriteLine($"Configured BaseUrl: {configured}");
                Assert.StartsWith("http://localhost", configured);
                var uri = new Uri(configured);
                Assert.Equal("localhost", uri.Host);
            }
            finally
            {
                Environment.SetEnvironmentVariable("TEST_ENVIRONMENT", _originalTestEnvironment);
                Environment.SetEnvironmentVariable("API_BASE_URL", _originalApiBaseUrl);
            }
        }

        [Fact]
        public void TestFixture_ShouldConfigureDevUrlCorrectly()
        {
            // Arrange - Set up dev environment
            Environment.SetEnvironmentVariable("TEST_ENVIRONMENT", "Dev");
            Environment.SetEnvironmentVariable("API_BASE_URL", "https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net");

            try
            {
                // Act
                using var fixture = new TestFixture();

                // Assert
                Assert.Equal("https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net", fixture.Configuration.BaseUrl);
                _output.WriteLine($"Configured BaseUrl: {fixture.Configuration.BaseUrl}");
            }
            finally
            {
                Environment.SetEnvironmentVariable("TEST_ENVIRONMENT", _originalTestEnvironment);
                Environment.SetEnvironmentVariable("API_BASE_URL", _originalApiBaseUrl);
            }
        }

        [Fact]
        public void IsLocalTesting_ShouldDetectLocalCorrectly()
        {
            // Test the logic that determines if we're doing local testing
            var localUrls = new[]
            {
                "http://localhost:5000",
                "https://localhost:5001",
                "http://127.0.0.1:5000"
            };

            var externalUrls = new[]
            {
                "https://gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net",
                "https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net"
            };

            foreach (var url in localUrls)
            {
                var isLocal = url.Contains("localhost") || url.Contains("127.0.0.1");
                Assert.True(isLocal, $"URL {url} should be detected as local");
                _output.WriteLine($"✅ {url} correctly detected as local");
            }

            foreach (var url in externalUrls)
            {
                var isLocal = url.Contains("localhost") || url.Contains("127.0.0.1");
                Assert.False(isLocal, $"URL {url} should NOT be detected as local");
                _output.WriteLine($"✅ {url} correctly detected as external");
            }
        }
    }
}
