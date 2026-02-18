using System.Threading.RateLimiting;

namespace GamerUncle.Api.Services.RateLimiting
{
    /// <summary>
    /// Rate limit lease for Redis-backed rate limiting.
    /// Reports whether the request was permitted and provides retry-after metadata
    /// for rejected requests.
    /// </summary>
    internal sealed class RedisRateLimitLease : RateLimitLease
    {
        private readonly TimeSpan? _retryAfter;

        public RedisRateLimitLease(bool isAcquired, TimeSpan? retryAfter = null)
        {
            IsAcquired = isAcquired;
            _retryAfter = retryAfter;
        }

        public override bool IsAcquired { get; }

        public override IEnumerable<string> MetadataNames
        {
            get
            {
                if (_retryAfter.HasValue)
                {
                    yield return MetadataName.RetryAfter.Name;
                }
            }
        }

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            if (metadataName == MetadataName.RetryAfter.Name && _retryAfter.HasValue)
            {
                metadata = _retryAfter.Value;
                return true;
            }

            metadata = null;
            return false;
        }
    }
}
