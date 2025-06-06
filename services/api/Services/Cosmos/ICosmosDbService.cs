using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Interfaces
{
    public interface ICosmosDbService
    {
        Task<IEnumerable<GameDocument>> QueryGamesAsync(GameQueryCriteria criteria);
    }
}
