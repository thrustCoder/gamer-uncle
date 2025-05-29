using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace GamerUncle.Api.Controllers.Tools
{
    [ApiController]
    [Route("api/Tools/FetchGames")]
    public class FetchBoardGameSuggestionsController : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> FetchGames([FromBody] JObject context)
        {
            string userQuery = context["userQuery"]?.ToString() ?? "";
            var suggestions = new List<string> {
                "Avalon", "Codenames", "Blood on the Clocktower"
            };

            return Ok(new { Suggestions = suggestions });
        }
    }
}