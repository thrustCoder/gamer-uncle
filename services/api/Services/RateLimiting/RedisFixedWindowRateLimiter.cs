using System.Threading.RateLimiting;
using StackExchange.Redis;

namespace GamerUncle.Api.Services.RateLimiting
{
    /// <summary>
    /// A fixed-window rate limiter backed by Redis for distributed rate limiting across
    /// multiple App Service instances. Uses Lua scripting for atomic increment+expire operations.
    /// 
    /// Falls open (allows requests) if Redis is unavailable to prevent blocking traffic
    /// due to infrastructure failures.
    /// 
    /// Key format: ratelimit:{policyName}:{partitionKey}:{windowId}
    /// Window alignment: floor(currentUnixSeconds / windowSeconds) for consistent windows
    /// across all instances.
    /// </summary>
    public sealed class RedisFixedWindowRateLimiter : RateLimiter
    {
        private readonly IConnectionMultiplexer _redis;
        private readonly RedisFixedWindowRateLimiterOptions _options;
        private readonly ILogger<RedisFixedWindowRateLimiter> _logger;

        /// <summary>
        /// Lua script: atomically increment counter and set expiry on first increment.
        /// Returns the current count after increment.
        /// Using a Lua script ensures atomicity — no race condition between INCR and EXPIRE.
        /// </summary>
        internal const string IncrementScript = @"
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return current";

        public RedisFixedWindowRateLimiter(
            IConnectionMultiplexer redis,
            RedisFixedWindowRateLimiterOptions options,
            ILogger<RedisFixedWindowRateLimiter> logger)
        {
            _redis = redis ?? throw new ArgumentNullException(nameof(redis));
            _options = options ?? throw new ArgumentNullException(nameof(options));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// The partition manager uses this to determine when to expire idle limiters.
        /// Zero means the limiter is always considered active.
        /// </summary>
        public override TimeSpan? IdleDuration => TimeSpan.Zero;

        /// <summary>
        /// Returns null because distributed statistics require additional Redis calls.
        /// </summary>
        public override RateLimiterStatistics? GetStatistics() => null;

        /// <summary>
        /// Synchronous rate limit check. Called by the middleware when queuing is not configured.
        /// Uses synchronous Redis operations (blocking but fast for Upstash).
        /// </summary>
        protected override RateLimitLease AttemptAcquireCore(int permitCount)
        {
            try
            {
                if (!_redis.IsConnected)
                {
                    _logger.LogWarning(
                        "Redis unavailable for rate limiting ({Policy}/{Partition}), failing open",
                        _options.PolicyName, _options.PartitionKey);
                    return new RedisRateLimitLease(isAcquired: true);
                }

                var db = _redis.GetDatabase();
                var key = GetWindowKey();
                var windowSeconds = (int)Math.Ceiling(_options.Window.TotalSeconds);

                var result = db.ScriptEvaluate(
                    IncrementScript,
                    new RedisKey[] { key },
                    new RedisValue[] { windowSeconds });

                var currentCount = (long)result;

                if (currentCount <= _options.PermitLimit)
                {
                    return new RedisRateLimitLease(isAcquired: true);
                }

                var retryAfter = CalculateRetryAfter();
                return new RedisRateLimitLease(isAcquired: false, retryAfter: retryAfter);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Redis rate limiter error ({Policy}/{Partition}), failing open",
                    _options.PolicyName, _options.PartitionKey);
                return new RedisRateLimitLease(isAcquired: true);
            }
        }

        /// <summary>
        /// Asynchronous rate limit check. Primary path used by the ASP.NET Core rate limiting middleware.
        /// </summary>
        protected override async ValueTask<RateLimitLease> AcquireAsyncCore(
            int permitCount, CancellationToken cancellationToken)
        {
            try
            {
                if (!_redis.IsConnected)
                {
                    _logger.LogWarning(
                        "Redis unavailable for rate limiting ({Policy}/{Partition}), failing open",
                        _options.PolicyName, _options.PartitionKey);
                    return new RedisRateLimitLease(isAcquired: true);
                }

                var db = _redis.GetDatabase();
                var key = GetWindowKey();
                var windowSeconds = (int)Math.Ceiling(_options.Window.TotalSeconds);

                var result = await db.ScriptEvaluateAsync(
                    IncrementScript,
                    new RedisKey[] { key },
                    new RedisValue[] { windowSeconds });

                var currentCount = (long)result;

                if (currentCount <= _options.PermitLimit)
                {
                    return new RedisRateLimitLease(isAcquired: true);
                }

                var retryAfter = CalculateRetryAfter();
                return new RedisRateLimitLease(isAcquired: false, retryAfter: retryAfter);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Redis rate limiter error ({Policy}/{Partition}), failing open",
                    _options.PolicyName, _options.PartitionKey);
                return new RedisRateLimitLease(isAcquired: true);
            }
        }

        /// <summary>
        /// Generates a Redis key aligned to the current time window.
        /// All instances compute the same window ID for the same point in time,
        /// ensuring consistent distributed counting.
        /// </summary>
        internal string GetWindowKey()
        {
            var windowSeconds = (long)_options.Window.TotalSeconds;
            var windowId = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / windowSeconds;
            return $"ratelimit:{_options.PolicyName}:{_options.PartitionKey}:{windowId}";
        }

        /// <summary>
        /// Calculates how long the client should wait before retrying,
        /// based on the remaining time in the current window.
        /// </summary>
        private TimeSpan CalculateRetryAfter()
        {
            var windowSeconds = (long)_options.Window.TotalSeconds;
            var currentSecond = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var windowStart = (currentSecond / windowSeconds) * windowSeconds;
            var windowEnd = windowStart + windowSeconds;
            var remaining = windowEnd - currentSecond;
            return TimeSpan.FromSeconds(Math.Max(1, remaining));
        }
    }
}
