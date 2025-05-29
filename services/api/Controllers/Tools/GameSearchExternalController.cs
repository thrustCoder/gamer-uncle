using Microsoft.AspNetCore.Mvc;
using GamerUncle.Api.Services.ExternalGameData;
using GamerUncle.Api.Models;

namespace GamerUncle.Api.Controllers
{
    [ApiController]
    [Route("api/Tools/[controller]")]
    public class GameSearchExternalController : ControllerBase
    {
        private readonly IBoardGameDataAdapter _adapter;

        public GameSearchExternalController(IBoardGameDataAdapter adapter)
        {
            _adapter = adapter;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string query)
        {
            var results = await _adapter.SearchGamesAsync(query);
            return Ok(results);
        }
    }
}
