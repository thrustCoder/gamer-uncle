using Microsoft.Extensions.Configuration;
using GamerUncle.Api.FunctionalTests.Configuration;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;

namespace GamerUncle.Api.FunctionalTests.Infrastructure
{
    public partial class TestFixture : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
    private readonly WebApplicationFactory<Program>? _factory; // Only used for in-process hosting fallback
        
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

            // Decide whether to use external running API or spin up in-process server
            _httpClient = CreateHttpClient(out _factory);
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
            _factory?.Dispose();
        }
    }
}

namespace GamerUncle.Api.FunctionalTests.Infrastructure
{
    public partial class TestFixture
    {
        private HttpClient CreateHttpClient(out WebApplicationFactory<Program>? factory)
        {
            factory = null;

            if (string.IsNullOrWhiteSpace(Configuration.BaseUrl))
            {
                Configuration.BaseUrl = "http://localhost"; // Let factory assign dynamic port
            }

            // Use external client only for clearly external hosts (azurewebsites.net) or when explicitly requested
        if (IsExternalHost(Configuration.BaseUrl) && !IsLocalHost(Configuration.BaseUrl))
            {
                if (Uri.TryCreate(Configuration.BaseUrl, UriKind.Absolute, out var externalUri))
                {
                    var client = new HttpClient
                    {
                        BaseAddress = externalUri,
                        Timeout = TimeSpan.FromSeconds(Configuration.TimeoutSeconds)
                    };
                    client.DefaultRequestHeaders.Add("User-Agent", "GamerUncle-FunctionalTests/1.0");
            Console.WriteLine($"[TestFixture] Using external API at {externalUri}");
                    return client;
                }
            }

            // Default: spin up in-process server
            factory = new WebApplicationFactory<Program>();
            var inProcClient = factory.CreateClient();
            Configuration.BaseUrl = inProcClient.BaseAddress?.ToString()?.TrimEnd('/') ?? Configuration.BaseUrl;
            inProcClient.Timeout = TimeSpan.FromSeconds(Configuration.TimeoutSeconds);
            if (!inProcClient.DefaultRequestHeaders.Contains("User-Agent"))
            {
                inProcClient.DefaultRequestHeaders.Add("User-Agent", "GamerUncle-FunctionalTests/1.0");
            }
            Console.WriteLine($"[TestFixture] Using in-process server with BaseUrl {Configuration.BaseUrl}");
            return inProcClient;
        }

        private static bool IsLocalHost(string url) =>
            url.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
            url.Contains("127.0.0.1") ||
            url.Contains("::1");

        private static bool IsExternalHost(string url) =>
            url.Contains("azurewebsites.net", StringComparison.OrdinalIgnoreCase) ||
            url.Contains("gamer-uncle-dev", StringComparison.OrdinalIgnoreCase) ||
            Environment.GetEnvironmentVariable("USE_EXTERNAL_API") == "true";
    }
}
