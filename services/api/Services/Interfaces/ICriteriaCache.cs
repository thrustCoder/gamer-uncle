namespace GamerUncle.Api.Services.Interfaces
{
    /// <summary>
    /// Cache interface for criteria extraction results.
    /// Supports L1 (in-memory) + L2 (distributed cache like Redis) pattern.
    /// </summary>
    public interface ICriteriaCache
    {
        /// <summary>
        /// Attempts to retrieve cached criteria for a given query.
        /// </summary>
        /// <param name="query">The user query to look up</param>
        /// <returns>Cached criteria JSON if found, null otherwise</returns>
        Task<string?> GetAsync(string query);

        /// <summary>
        /// Stores criteria extraction result in cache.
        /// </summary>
        /// <param name="query">The user query (key)</param>
        /// <param name="criteriaJson">The extracted criteria as JSON</param>
        Task SetAsync(string query, string criteriaJson);

        /// <summary>
        /// Gets cache statistics for telemetry/monitoring.
        /// </summary>
        CacheStatistics GetStatistics();
    }

    /// <summary>
    /// Cache statistics for monitoring cache effectiveness.
    /// </summary>
    public class CacheStatistics
    {
        public long L1Hits { get; set; }
        public long L2Hits { get; set; }
        public long Misses { get; set; }
        public double HitRate => (L1Hits + L2Hits + Misses) == 0 ? 0 : (double)(L1Hits + L2Hits) / (L1Hits + L2Hits + Misses);
    }
}
