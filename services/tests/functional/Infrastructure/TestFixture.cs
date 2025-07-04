using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using GamerUncle.Api.FunctionalTests.Configuration;

namespace GamerUncle.Api.FunctionalTests.Infrastructure
{
    public class TestFixture : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        
        public TestConfiguration Configuration { get; }
        public HttpClient HttpClient => _httpClient;

        public TestFixture()
        {
            var environment = Environment.GetEnvironmentVariable("TEST_ENVIRONMENT") ?? "Local";
            
            var configBuilder = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile($"appsettings.{environment.ToLower()}.json", optional: true)
                .AddEnvironmentVariables();

            _configuration = configBuilder.Build();
            
            Configuration = new TestConfiguration();
            _configuration.GetSection("TestConfiguration").Bind(Configuration);

            // Override with environment variables if provided
            if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("API_BASE_URL")))
            {
                Configuration.BaseUrl = Environment.GetEnvironmentVariable("API_BASE_URL")!;
            }

            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(Configuration.BaseUrl),
                Timeout = TimeSpan.FromSeconds(Configuration.TimeoutSeconds)
            };

            _httpClient.DefaultRequestHeaders.Add("User-Agent", "GamerUncle-FunctionalTests/1.0");
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }
}
