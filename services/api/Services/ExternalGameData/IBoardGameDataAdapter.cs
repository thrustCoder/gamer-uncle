using GamerUncle.Api.Models;

namespace GamerUncle.Api.Services.ExternalGameData
{
    public interface IBoardGameDataAdapter
    {
        Task<List<BoardGameSearchResult>> SearchGamesAsync(string query);
    }
}
