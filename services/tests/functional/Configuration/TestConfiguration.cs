namespace GamerUncle.Api.FunctionalTests.Configuration
{
    public class TestConfiguration
    {
        public string BaseUrl { get; set; } = string.Empty;
        public string Environment { get; set; } = string.Empty;
        public int TimeoutSeconds { get; set; } = 30;
    }
}
