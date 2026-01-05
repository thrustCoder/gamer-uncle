using System.Collections.Concurrent;
using GamerUncle.Api.Services.Interfaces;
using Microsoft.ApplicationInsights;
using Microsoft.Extensions.Caching.Memory;
using StackExchange.Redis;

namespace GamerUncle.Api.Services.Cache
{
    /// <summary>
    /// Two-level cache for criteria extraction results.
    /// L1: In-memory cache (fastest, per-instance)
    /// L2: Redis cache (shared across instances, supports Upstash)
    /// </summary>
    public class CriteriaCache : ICriteriaCache
    {
        /// <summary>
        /// Cache version prefix for invalidation. Increment when:
        /// - Criteria extraction prompt changes
        /// - New criteria fields are added
        /// - Normalization logic changes
        /// </summary>
        private const string CacheVersion = "v1";
        
        private readonly IMemoryCache _l1Cache;
        private readonly IConnectionMultiplexer? _redis;
        private readonly ILogger<CriteriaCache> _logger;
        private readonly TelemetryClient? _telemetry;
        private readonly TimeSpan _l1Expiration;
        private readonly TimeSpan _l2Expiration;
        private readonly string _keyPrefix;

        // Thread-safe statistics
        private long _l1Hits;
        private long _l2Hits;
        private long _misses;

        public CriteriaCache(
            IMemoryCache memoryCache,
            IConnectionMultiplexer? redis,
            ILogger<CriteriaCache> logger,
            TelemetryClient? telemetry = null,
            IConfiguration? config = null)
        {
            _l1Cache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _redis = redis; // Can be null if Redis is not configured
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _telemetry = telemetry;

            // Configurable expiration times (defaults: L1=10min, L2=30min)
            var l1Minutes = 10;
            var l2Minutes = 30;
            var environment = "default";
            if (config != null)
            {
                l1Minutes = config.GetValue<int>("CriteriaCache:L1ExpirationMinutes", 10);
                l2Minutes = config.GetValue<int>("CriteriaCache:L2ExpirationMinutes", 30);
                environment = config.GetValue<string>("CriteriaCache:Environment") ?? "default";
            }
            _l1Expiration = TimeSpan.FromMinutes(l1Minutes);
            _l2Expiration = TimeSpan.FromMinutes(l2Minutes);
            _keyPrefix = $"criteria:{environment}:{CacheVersion}:";

            _logger.LogInformation(
                "CriteriaCache initialized. Environment={Env}, L1={L1Min}min, L2={L2Min}min, Redis={RedisEnabled}",
                environment,
                _l1Expiration.TotalMinutes,
                _l2Expiration.TotalMinutes,
                _redis != null);
        }

        /// <summary>
        /// Gets cached criteria. Checks L1 first, then L2.
        /// On L2 hit, promotes to L1 for faster subsequent access.
        /// </summary>
        public async Task<string?> GetAsync(string query)
        {
            var normalizedKey = NormalizeQuery(query);
            var cacheKey = $"{_keyPrefix}{normalizedKey}";

            // L1 check (in-memory - fastest)
            if (_l1Cache.TryGetValue(cacheKey, out string? l1Result) && !string.IsNullOrEmpty(l1Result))
            {
                Interlocked.Increment(ref _l1Hits);
                _telemetry?.TrackEvent("CriteriaCache.L1Hit", new Dictionary<string, string>
                {
                    ["Query"] = query.Substring(0, Math.Min(query.Length, 100)),
                    ["NormalizedKey"] = normalizedKey.Substring(0, Math.Min(normalizedKey.Length, 50))
                });
                _logger.LogDebug("L1 cache hit for query: {Query}", query);
                return l1Result;
            }

            // L2 check (Redis - shared across instances)
            if (_redis != null)
            {
                try
                {
                    var db = _redis.GetDatabase();
                    var l2Result = await db.StringGetAsync(cacheKey);

                    if (l2Result.HasValue)
                    {
                        Interlocked.Increment(ref _l2Hits);
                        var value = l2Result.ToString();

                        // Promote to L1 for faster subsequent access
                        _l1Cache.Set(cacheKey, value, _l1Expiration);

                        _telemetry?.TrackEvent("CriteriaCache.L2Hit", new Dictionary<string, string>
                        {
                            ["Query"] = query.Substring(0, Math.Min(query.Length, 100)),
                            ["NormalizedKey"] = normalizedKey.Substring(0, Math.Min(normalizedKey.Length, 50))
                        });
                        _logger.LogDebug("L2 cache hit for query: {Query}", query);
                        return value;
                    }
                }
                catch (Exception ex)
                {
                    // Redis failures should not break the flow - log and continue
                    _logger.LogWarning(ex, "Redis L2 cache read failed for query: {Query}", query);
                    _telemetry?.TrackException(ex, new Dictionary<string, string>
                    {
                        ["Operation"] = "CriteriaCache.L2Get",
                        ["Query"] = query.Substring(0, Math.Min(query.Length, 100))
                    });
                }
            }

            // Cache miss
            Interlocked.Increment(ref _misses);
            _telemetry?.TrackEvent("CriteriaCache.Miss", new Dictionary<string, string>
            {
                ["Query"] = query.Substring(0, Math.Min(query.Length, 100)),
                ["NormalizedKey"] = normalizedKey.Substring(0, Math.Min(normalizedKey.Length, 50))
            });
            _logger.LogDebug("Cache miss for query: {Query}", query);
            return null;
        }

        /// <summary>
        /// Stores criteria in both L1 and L2 caches.
        /// </summary>
        public async Task SetAsync(string query, string criteriaJson)
        {
            if (string.IsNullOrEmpty(criteriaJson))
            {
                _logger.LogDebug("Skipping cache set for empty criteria");
                return;
            }

            var normalizedKey = NormalizeQuery(query);
            var cacheKey = $"{_keyPrefix}{normalizedKey}";

            // Set in L1 (in-memory)
            _l1Cache.Set(cacheKey, criteriaJson, _l1Expiration);

            // Set in L2 (Redis) - fire and forget with error handling
            if (_redis != null)
            {
                try
                {
                    var db = _redis.GetDatabase();
                    await db.StringSetAsync(cacheKey, criteriaJson, _l2Expiration);
                    _logger.LogDebug("Cached criteria in L1+L2 for query: {Query}", query);
                }
                catch (Exception ex)
                {
                    // Redis failures should not break the flow
                    _logger.LogWarning(ex, "Redis L2 cache write failed for query: {Query}", query);
                    _telemetry?.TrackException(ex, new Dictionary<string, string>
                    {
                        ["Operation"] = "CriteriaCache.L2Set",
                        ["Query"] = query.Substring(0, Math.Min(query.Length, 100))
                    });
                }
            }
            else
            {
                _logger.LogDebug("Cached criteria in L1 only (no Redis) for query: {Query}", query);
            }
        }

        /// <summary>
        /// Returns current cache statistics.
        /// </summary>
        public CacheStatistics GetStatistics()
        {
            return new CacheStatistics
            {
                L1Hits = Interlocked.Read(ref _l1Hits),
                L2Hits = Interlocked.Read(ref _l2Hits),
                Misses = Interlocked.Read(ref _misses)
            };
        }

        /// <summary>
        /// Normalizes query for cache key consistency.
        /// Handles variations like "4 player games" vs "games for 4 players".
        /// </summary>
        private static string NormalizeQuery(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
                return string.Empty;

            // Lowercase and normalize whitespace
            var normalized = query.ToLowerInvariant().Trim();

            // Remove common filler words that don't affect criteria extraction
            var fillerWords = new[] { "a", "an", "the", "for", "with", "and", "or", "to", "me", "i", "want", "need", "looking", "please", "can", "you", "suggest", "recommend" };
            
            var words = normalized
                .Split(new[] { ' ', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => !fillerWords.Contains(w))
                .OrderBy(w => w) // Sort for consistency ("4 player game" == "game 4 player")
                .ToArray();

            // Create deterministic hash-friendly key
            return string.Join("_", words);
        }
    }
}
