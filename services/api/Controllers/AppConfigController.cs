using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using GamerUncle.Api.Models;

namespace GamerUncle.Api.Controllers
{
    /// <summary>
    /// Public endpoint returning server-driven version policy.
    /// No App Key required — old clients must be able to reach this.
    /// Excluded from rate limiting (lightweight, cacheable).
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AppConfigController : ControllerBase
    {
        private readonly AppVersionPolicy _versionPolicy;
        private readonly ILogger<AppConfigController> _logger;

        public AppConfigController(IOptions<AppVersionPolicy> versionPolicy, ILogger<AppConfigController> logger)
        {
            _versionPolicy = versionPolicy.Value;
            _logger = logger;
        }

        /// <summary>
        /// Returns the current version policy and upgrade metadata.
        /// </summary>
        /// <returns>Version policy including minimum version and upgrade URLs</returns>
        /// <response code="200">Returns the version policy</response>
        [HttpGet]
        [ProducesResponseType(typeof(AppVersionPolicy), StatusCodes.Status200OK)]
        [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
        public IActionResult GetAppConfig()
        {
            _logger.LogInformation("AppConfig requested. MinVersion: {MinVersion}, ForceUpgrade: {ForceUpgrade}",
                _versionPolicy.MinVersion, _versionPolicy.ForceUpgrade);

            return Ok(_versionPolicy);
        }
    }
}
