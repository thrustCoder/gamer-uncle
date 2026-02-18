using Polly;

namespace GamerUncle.Api.Services.Resilience
{
    /// <summary>
    /// Provides pre-configured Polly resilience policies for external service calls.
    /// </summary>
    public interface IResiliencePolicyProvider
    {
        /// <summary>
        /// Policy for Azure AI Agent calls: timeout + retry with exponential backoff.
        /// Handles RequestFailedException for transient HTTP errors (408, 429, 502, 503, 504)
        /// and TimeoutRejectedException from the inner timeout.
        /// </summary>
        IAsyncPolicy AgentCallPolicy { get; }

        /// <summary>
        /// Policy for Redis/Upstash operations: retry with short delays.
        /// Handles RedisException and related transient errors.
        /// </summary>
        IAsyncPolicy RedisOperationPolicy { get; }
    }
}
