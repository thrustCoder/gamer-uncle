using GamerUncle.Api.Services.Interfaces;
using Microsoft.ApplicationInsights;
using StackExchange.Redis;

namespace GamerUncle.Api.Services.ThreadMapping
{
    /// <summary>
    /// Redis-backed thread mapping store using Upstash (or Azure Cache for Redis).
    /// Provides distributed, durable conversation-to-thread mappings with TTL-based expiry.
    /// Resolves Finding #2: in-memory ConcurrentDictionary lost on restart / per-instance.
    /// </summary>
    public class RedisThreadMappingStore : IThreadMappingStore
    {
        private const string KeyPrefix = "thread:";
        private readonly IConnectionMultiplexer _redis;
        private readonly ILogger<RedisThreadMappingStore> _logger;
        private readonly TelemetryClient? _telemetry;
        private readonly TimeSpan _ttl;

        public RedisThreadMappingStore(
            IConnectionMultiplexer redis,
            ILogger<RedisThreadMappingStore> logger,
            TelemetryClient? telemetry = null,
            IConfiguration? config = null)
        {
            _redis = redis ?? throw new ArgumentNullException(nameof(redis));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _telemetry = telemetry;

            // Configurable TTL; default 2 hours matches typical conversation lifetime
            var ttlMinutes = config?.GetValue<int>("ThreadMapping:TtlMinutes", 120) ?? 120;
            _ttl = TimeSpan.FromMinutes(ttlMinutes);

            _logger.LogInformation("RedisThreadMappingStore initialized. TTL={TtlMinutes}min", ttlMinutes);
        }

        public async Task<string?> GetThreadIdAsync(string conversationId)
        {
            if (string.IsNullOrEmpty(conversationId))
                return null;

            try
            {
                var db = _redis.GetDatabase();
                var value = await db.StringGetAsync($"{KeyPrefix}{conversationId}");

                if (value.HasValue)
                {
                    _logger.LogDebug("Thread mapping found for conversation {ConversationId}", conversationId);
                    _telemetry?.TrackEvent("ThreadMapping.Hit", new Dictionary<string, string>
                    {
                        ["ConversationId"] = conversationId
                    });

                    // Refresh TTL on access to keep active conversations alive
                    await db.KeyExpireAsync($"{KeyPrefix}{conversationId}", _ttl);

                    return value.ToString();
                }

                _logger.LogDebug("No thread mapping for conversation {ConversationId}", conversationId);
                _telemetry?.TrackEvent("ThreadMapping.Miss", new Dictionary<string, string>
                {
                    ["ConversationId"] = conversationId
                });
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis error reading thread mapping for {ConversationId}, returning null", conversationId);
                _telemetry?.TrackEvent("ThreadMapping.RedisError", new Dictionary<string, string>
                {
                    ["ConversationId"] = conversationId,
                    ["Operation"] = "Get",
                    ["Error"] = ex.Message
                });
                return null;
            }
        }

        public async Task SetThreadIdAsync(string conversationId, string threadId)
        {
            if (string.IsNullOrEmpty(conversationId) || string.IsNullOrEmpty(threadId))
                return;

            try
            {
                var db = _redis.GetDatabase();
                await db.StringSetAsync($"{KeyPrefix}{conversationId}", threadId, _ttl);

                _logger.LogDebug("Thread mapping set: {ConversationId} -> {ThreadId}", conversationId, threadId);
                _telemetry?.TrackEvent("ThreadMapping.Set", new Dictionary<string, string>
                {
                    ["ConversationId"] = conversationId,
                    ["ThreadId"] = threadId
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis error setting thread mapping for {ConversationId}", conversationId);
                _telemetry?.TrackEvent("ThreadMapping.RedisError", new Dictionary<string, string>
                {
                    ["ConversationId"] = conversationId,
                    ["Operation"] = "Set",
                    ["Error"] = ex.Message
                });
                // Fail silently — worst case, a new thread is created on next request
            }
        }

        public async Task RemoveAsync(string conversationId)
        {
            if (string.IsNullOrEmpty(conversationId))
                return;

            try
            {
                var db = _redis.GetDatabase();
                await db.KeyDeleteAsync($"{KeyPrefix}{conversationId}");

                _logger.LogDebug("Thread mapping removed for {ConversationId}", conversationId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis error removing thread mapping for {ConversationId}", conversationId);
            }
        }
    }
}
