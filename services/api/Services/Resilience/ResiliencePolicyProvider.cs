using Azure;
using Polly;
using Polly.Timeout;
using StackExchange.Redis;

namespace GamerUncle.Api.Services.Resilience
{
    /// <summary>
    /// Provides pre-configured Polly resilience policies for external service calls.
    /// Policies are created once at startup and reused across all requests (thread-safe).
    /// </summary>
    public class ResiliencePolicyProvider : IResiliencePolicyProvider
    {
        private readonly ILogger<ResiliencePolicyProvider> _logger;

        public IAsyncPolicy AgentCallPolicy { get; }
        public IAsyncPolicy RedisOperationPolicy { get; }

        /// <summary>
        /// HTTP status codes considered transient and eligible for retry.
        /// </summary>
        private static readonly int[] TransientStatusCodes = { 408, 429, 502, 503, 504 };

        public ResiliencePolicyProvider(
            ResilienceSettings settings,
            ILogger<ResiliencePolicyProvider> logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            settings = settings ?? throw new ArgumentNullException(nameof(settings));

            AgentCallPolicy = BuildAgentCallPolicy(settings);
            RedisOperationPolicy = BuildRedisOperationPolicy(settings);

            _logger.LogInformation(
                "Resilience policies initialized. AgentTimeout={TimeoutSec}s, AgentRetries={Retries}, RedisRetries={RedisRetries}",
                settings.AgentCallTimeoutSeconds, settings.AgentCallMaxRetries, settings.RedisMaxRetries);
        }

        /// <summary>
        /// Builds a combined timeout + retry policy for AI Agent calls.
        /// Structure: [Retry (outer)] → [Timeout (inner)]
        /// Each individual call gets a timeout. If it times out, the retry policy kicks in.
        /// Uses Pessimistic timeout strategy to forcibly abandon hung calls even when the
        /// delegate (Azure AI SDK) does not honor CancellationToken.
        /// </summary>
        private IAsyncPolicy BuildAgentCallPolicy(ResilienceSettings settings)
        {
            // Inner policy: timeout per individual call attempt
            // Pessimistic strategy ensures the timeout fires even if the underlying
            // Azure SDK call ignores cancellation (e.g., hung HTTP connections).
            var timeoutPolicy = Policy.TimeoutAsync(
                TimeSpan.FromSeconds(settings.AgentCallTimeoutSeconds),
                TimeoutStrategy.Pessimistic,
                onTimeoutAsync: (context, timespan, task) =>
                {
                    _logger.LogWarning("AI Agent call timed out after {Timeout}s (pessimistic)", timespan.TotalSeconds);
                    return Task.CompletedTask;
                });

            // Outer policy: retry on transient errors (including timeout)
            var retryPolicy = Policy
                .Handle<RequestFailedException>(ex => IsTransientHttpError(ex.Status))
                .Or<TimeoutRejectedException>()
                .Or<TaskCanceledException>()
                .WaitAndRetryAsync(
                    retryCount: settings.AgentCallMaxRetries,
                    sleepDurationProvider: attempt =>
                        TimeSpan.FromSeconds(settings.AgentCallRetryBaseDelaySeconds * Math.Pow(2, attempt - 1)),
                    onRetry: (exception, delay, retryAttempt, context) =>
                    {
                        _logger.LogWarning(
                            "AI Agent call retry {Attempt}/{MaxRetries} after {Delay}s. Error: {Error}",
                            retryAttempt, settings.AgentCallMaxRetries, delay.TotalSeconds, exception.Message);
                    });

            // Wrap: retry is outer, timeout is inner
            return Policy.WrapAsync(retryPolicy, timeoutPolicy);
        }

        /// <summary>
        /// Builds a retry policy for Redis/Upstash operations.
        /// Uses short delays since Redis operations are typically fast.
        /// </summary>
        private IAsyncPolicy BuildRedisOperationPolicy(ResilienceSettings settings)
        {
            return Policy
                .Handle<RedisException>()
                .Or<RedisTimeoutException>()
                .Or<RedisConnectionException>()
                .WaitAndRetryAsync(
                    retryCount: settings.RedisMaxRetries,
                    sleepDurationProvider: attempt =>
                        TimeSpan.FromMilliseconds(settings.RedisRetryBaseDelayMs * Math.Pow(2, attempt - 1)),
                    onRetry: (exception, delay, retryAttempt, context) =>
                    {
                        _logger.LogWarning(
                            "Redis operation retry {Attempt}/{MaxRetries} after {Delay}ms. Error: {Error}",
                            retryAttempt, settings.RedisMaxRetries, delay.TotalMilliseconds, exception.Message);
                    });
        }

        /// <summary>
        /// Determines if an HTTP status code represents a transient error eligible for retry.
        /// </summary>
        public static bool IsTransientHttpError(int statusCode)
        {
            return Array.Exists(TransientStatusCodes, code => code == statusCode);
        }
    }
}
