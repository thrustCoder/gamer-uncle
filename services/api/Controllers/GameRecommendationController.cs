using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("GameRecommendations")]
    public class RecommendationsController : ControllerBase
    {
        private readonly IAgentServiceClient _agentService;
        private readonly ILogger<RecommendationsController> _logger;

        public RecommendationsController(IAgentServiceClient agentService, ILogger<RecommendationsController> logger)
        {
            _agentService = agentService;
            _logger = logger;
        }

        [HttpPost]
        public async Task<IActionResult> RecommendGame([FromBody] UserQuery query)
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = HttpContext.Request.Headers.UserAgent.ToString();
            
            _logger.LogInformation("Game recommendation request from IP: {ClientIp}, UserAgent: {UserAgent}, ConversationId: {ConversationId}", 
                clientIp, userAgent, query.ConversationId);

            try
            {
                var result = await _agentService.GetRecommendationsAsync(query.Query, query.ConversationId);
                
                _logger.LogInformation("Game recommendation completed successfully for ConversationId: {ConversationId}", 
                    query.ConversationId);
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing game recommendation for ConversationId: {ConversationId}, IP: {ClientIp}", 
                    query.ConversationId, clientIp);
                
                return StatusCode(500, "An error occurred while processing your request");
            }
        }
    }
}