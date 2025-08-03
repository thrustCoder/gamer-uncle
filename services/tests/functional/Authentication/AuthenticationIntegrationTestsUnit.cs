using Xunit;
using GamerUncle.Api.FunctionalTests.Infrastructure;
using Xunit.Abstractions;

namespace GamerUncle.Api.FunctionalTests.Authentication
{
    public class AuthenticationIntegrationTestsUnit
    {
        private readonly ITestOutputHelper _output;

        public AuthenticationIntegrationTestsUnit(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void TestFixture_ShouldConfigureBaseUrlCorrectly()
        {
            // Arrange - Set up local environment
            Environment.SetEnvironmentVariable("TEST_ENVIRONMENT", "Local");
            Environment.SetEnvironmentVariable("API_BASE_URL", "http://localhost:5000");

            // Act
            using var fixture = new TestFixture();

            // Assert
            Assert.Equal("http://localhost:5000", fixture.Configuration.BaseUrl);
            _output.WriteLine($"Configured BaseUrl: {fixture.Configuration.BaseUrl}");
        }

        [Fact]
        public void TestFixture_ShouldConfigureDevUrlCorrectly()
        {
            // Arrange - Set up dev environment
            Environment.SetEnvironmentVariable("TEST_ENVIRONMENT", "Dev");
            Environment.SetEnvironmentVariable("API_BASE_URL", "https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net");

            // Act
            using var fixture = new TestFixture();

            // Assert
            Assert.Equal("https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net", fixture.Configuration.BaseUrl);
            _output.WriteLine($"Configured BaseUrl: {fixture.Configuration.BaseUrl}");
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
                "https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net",
                "https://gamer-uncle-prod-app-svc.azurewebsites.net"
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
