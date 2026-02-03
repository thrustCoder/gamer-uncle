using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Services.Authentication;

namespace GamerUncle.Api.Controllers
{
    /// <summary>
    /// Controller for game search and details endpoints.
    /// Provides type-ahead search and detailed game information.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("GameSearch")]
    [RequireAppKey]
    public class GamesController : ControllerBase
    {
        private readonly IGameSearchService _gameSearchService;
        private readonly ILogger<GamesController> _logger;
        private const int MinQueryLength = 3;
        private const int DefaultMaxResults = 5;

        public GamesController(IGameSearchService gameSearchService, ILogger<GamesController> logger)
        {
            _gameSearchService = gameSearchService;
            _logger = logger;
        }

        /// <summary>
        /// Search for games by name using type-ahead matching.
        /// </summary>
        /// <param name="q">Search query (minimum 3 characters)</param>
        /// <returns>List of matching games (max 5)</returns>
        /// <response code="200">Returns the search results</response>
        /// <response code="400">If query is less than 3 characters</response>
        /// <response code="401">If app key is invalid or missing</response>
        /// <response code="429">If rate limit is exceeded</response>
        [HttpGet("search")]
        [ProducesResponseType(typeof(GameSearchResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(object), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> SearchGames([FromQuery] string q)
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = HttpContext.Request.Headers.UserAgent.ToString();

            _logger.LogInformation("Game search request from IP: {ClientIp}, UserAgent: {UserAgent}, Query: {Query}",
                clientIp, userAgent, q?.Substring(0, Math.Min(q?.Length ?? 0, 50)));

            // Validate query length
            if (string.IsNullOrWhiteSpace(q) || q.Length < MinQueryLength)
            {
                _logger.LogWarning("Game search rejected - query too short. Query: {Query}, MinLength: {MinLength}",
                    q, MinQueryLength);
                return BadRequest(new { error = $"Query must be at least {MinQueryLength} characters" });
            }

            try
            {
                var result = await _gameSearchService.SearchGamesAsync(q, DefaultMaxResults);

                _logger.LogInformation("Game search completed. Query: {Query}, ResultCount: {Count}",
                    q, result.TotalCount);

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during game search. Query: {Query}, IP: {ClientIp}",
                    q, clientIp);

                return StatusCode(500, new { error = "An error occurred while searching for games" });
            }
        }

        /// <summary>
        /// Get detailed information for a specific game.
        /// </summary>
        /// <param name="id">Game ID (e.g., "bgg-13")</param>
        /// <returns>Detailed game information</returns>
        /// <response code="200">Returns the game details</response>
        /// <response code="401">If app key is invalid or missing</response>
        /// <response code="404">If game is not found</response>
        /// <response code="429">If rate limit is exceeded</response>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(GameDetailsResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(object), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> GetGameDetails([FromRoute] string id)
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = HttpContext.Request.Headers.UserAgent.ToString();

            _logger.LogInformation("Game details request from IP: {ClientIp}, UserAgent: {UserAgent}, GameId: {GameId}",
                clientIp, userAgent, id);

            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { error = "Game ID is required" });
            }

            try
            {
                var result = await _gameSearchService.GetGameDetailsAsync(id);

                if (result == null)
                {
                    _logger.LogWarning("Game not found. GameId: {GameId}, IP: {ClientIp}",
                        id, clientIp);
                    return NotFound(new { error = "Game not found" });
                }

                _logger.LogInformation("Game details retrieved. GameId: {GameId}, GameName: {GameName}",
                    id, result.Name);

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving game details. GameId: {GameId}, IP: {ClientIp}",
                    id, clientIp);

                return StatusCode(500, new { error = "An error occurred while retrieving game details" });
            }
        }
    }
}
