using Microsoft.AspNetCore.Mvc;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecommendationsController : ControllerBase
    {
        private readonly IAgentServiceClient _agentService;

        public RecommendationsController(IAgentServiceClient agentService)
        {
            _agentService = agentService;
        }

        [HttpPost]
        public async Task<IActionResult> RecommendGame([FromBody] UserQuery query)
        {
            var result = await _agentService.GetRecommendationsAsync(query.Query);
            return Ok(new AgentResponse { ResponseText = result });
        }
    }
}