namespace GamerUncle.Api.Services.RateLimiting
{
    /// <summary>
    /// Configuration options for the Redis-backed fixed window rate limiter.
    /// </summary>
    public class RedisFixedWindowRateLimiterOptions
    {
        /// <summary>
        /// The name of the rate limiting policy (e.g., "GameRecommendations").
        /// Used as part of the Redis key for namespacing.
        /// </summary>
        public string PolicyName { get; set; } = string.Empty;

        /// <summary>
        /// The partition key for this rate limiter (typically the client IP address).
        /// </summary>
        public string PartitionKey { get; set; } = string.Empty;

        /// <summary>
        /// Maximum number of permits allowed in the window.
        /// </summary>
        public int PermitLimit { get; set; }

        /// <summary>
        /// The time window for the rate limit.
        /// </summary>
        public TimeSpan Window { get; set; }
    }
}
