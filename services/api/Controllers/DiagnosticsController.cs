using Microsoft.AspNetCore.Mvc;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DiagnosticsController : ControllerBase
    {
        private readonly ICriteriaCache? _criteriaCache;

        public DiagnosticsController(ICriteriaCache? criteriaCache = null)
        {
            _criteriaCache = criteriaCache;
        }

        /// <summary>
        /// Returns cache statistics for monitoring cache effectiveness.
        /// </summary>
        [HttpGet("cache/stats")]
        public IActionResult GetCacheStats()
        {
            if (_criteriaCache == null)
            {
                return Ok(new
                {
                    enabled = false,
                    message = "Criteria cache is not configured"
                });
            }

            var stats = _criteriaCache.GetStatistics();
            return Ok(new
            {
                enabled = true,
                l1Hits = stats.L1Hits,
                l2Hits = stats.L2Hits,
                misses = stats.Misses,
                hitRate = stats.HitRate,
                hitRatePercent = $"{stats.HitRate * 100:F1}%"
            });
        }
    }
}
