namespace GamerUncle.Api.Services.Resilience
{
    /// <summary>
    /// Configuration settings for resilience policies (timeout, retry).
    /// Maps to the "Resilience" section in appsettings.json.
    /// </summary>
    public class ResilienceSettings
    {
        public const string SectionName = "Resilience";

        /// <summary>
        /// Timeout in seconds for each individual AI Agent call attempt.
        /// Default: 30 seconds.
        /// </summary>
        public int AgentCallTimeoutSeconds { get; set; } = 30;

        /// <summary>
        /// Maximum number of retry attempts for transient AI Agent errors.
        /// Default: 2 (total 3 attempts including the initial call).
        /// </summary>
        public int AgentCallMaxRetries { get; set; } = 2;

        /// <summary>
        /// Base delay in seconds for exponential backoff between retries.
        /// Actual delay: baseDelay * 2^(attemptNumber-1). Default: 1 second.
        /// </summary>
        public double AgentCallRetryBaseDelaySeconds { get; set; } = 1.0;

        /// <summary>
        /// Maximum number of retry attempts for Redis operations.
        /// Default: 2.
        /// </summary>
        public int RedisMaxRetries { get; set; } = 2;

        /// <summary>
        /// Base delay in milliseconds for Redis retry backoff.
        /// Default: 100ms.
        /// </summary>
        public int RedisRetryBaseDelayMs { get; set; } = 100;
    }
}
