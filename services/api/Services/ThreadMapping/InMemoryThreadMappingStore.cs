using System.Collections.Concurrent;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.ThreadMapping
{
    /// <summary>
    /// In-memory fallback for thread mapping when Redis is unavailable.
    /// Uses ConcurrentDictionary with periodic cleanup of expired entries.
    /// Not suitable for multi-instance deployments — use RedisThreadMappingStore in production.
    /// </summary>
    public class InMemoryThreadMappingStore : IThreadMappingStore
    {
        private readonly ConcurrentDictionary<string, (string ThreadId, DateTime ExpiresAt)> _store = new();
        private readonly ILogger<InMemoryThreadMappingStore> _logger;
        private readonly TimeSpan _ttl;
        private readonly Timer _cleanupTimer;

        public InMemoryThreadMappingStore(
            ILogger<InMemoryThreadMappingStore> logger,
            IConfiguration? config = null)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));

            var ttlMinutes = config?.GetValue<int>("ThreadMapping:TtlMinutes", 120) ?? 120;
            _ttl = TimeSpan.FromMinutes(ttlMinutes);

            // Periodic cleanup every 10 minutes to evict expired entries
            _cleanupTimer = new Timer(CleanupExpiredEntries, null, TimeSpan.FromMinutes(10), TimeSpan.FromMinutes(10));

            _logger.LogWarning("InMemoryThreadMappingStore initialized (fallback mode). " +
                "Thread mappings will be lost on restart and are per-instance only. TTL={TtlMinutes}min", ttlMinutes);
        }

        public Task<string?> GetThreadIdAsync(string conversationId)
        {
            if (string.IsNullOrEmpty(conversationId))
                return Task.FromResult<string?>(null);

            if (_store.TryGetValue(conversationId, out var entry))
            {
                if (entry.ExpiresAt > DateTime.UtcNow)
                {
                    // Refresh TTL on access
                    _store[conversationId] = (entry.ThreadId, DateTime.UtcNow.Add(_ttl));
                    return Task.FromResult<string?>(entry.ThreadId);
                }

                // Expired — remove and return null
                _store.TryRemove(conversationId, out _);
            }

            return Task.FromResult<string?>(null);
        }

        public Task SetThreadIdAsync(string conversationId, string threadId)
        {
            if (string.IsNullOrEmpty(conversationId) || string.IsNullOrEmpty(threadId))
                return Task.CompletedTask;

            _store[conversationId] = (threadId, DateTime.UtcNow.Add(_ttl));
            _logger.LogDebug("InMemory thread mapping set: {ConversationId} -> {ThreadId}", conversationId, threadId);
            return Task.CompletedTask;
        }

        public Task RemoveAsync(string conversationId)
        {
            if (string.IsNullOrEmpty(conversationId))
                return Task.CompletedTask;

            _store.TryRemove(conversationId, out _);
            return Task.CompletedTask;
        }

        private void CleanupExpiredEntries(object? state)
        {
            var now = DateTime.UtcNow;
            var expiredKeys = _store.Where(kvp => kvp.Value.ExpiresAt <= now).Select(kvp => kvp.Key).ToList();

            foreach (var key in expiredKeys)
            {
                _store.TryRemove(key, out _);
            }

            if (expiredKeys.Count > 0)
            {
                _logger.LogInformation("Cleaned up {Count} expired thread mappings. Active: {Active}",
                    expiredKeys.Count, _store.Count);
            }
        }
    }
}
