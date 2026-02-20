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
        /// Uses Pessimistic strategy to forcibly abandon hung Azure SDK calls.
        /// Default: 15 seconds (allows retry within 30s frontend timeout).
        /// </summary>
        public int AgentCallTimeoutSeconds { get; set; } = 15;

        /// <summary>
        /// Maximum number of retry attempts for transient AI Agent errors.
        /// Default: 1 (total 2 attempts including the initial call).
        /// Budget: STT ~3s + attempt1 15s + delay 1s + attempt2 ~10s + TTS ~1s = ~30s.
        /// </summary>
        public int AgentCallMaxRetries { get; set; } = 1;

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
