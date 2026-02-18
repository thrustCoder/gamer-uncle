using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Interfaces
{
    public interface ICosmosDbService
    {
        Task<IEnumerable<GameDocument>> QueryGamesAsync(GameQueryCriteria criteria);

        /// <summary>
        /// Queries Cosmos DB with field projection and server-side TOP clause.
        /// Returns only lightweight GameSummary objects (no description, setupGuide, ruleQnA, etc.)
        /// ordered by averageRating descending, limited to <paramref name="top"/> results.
        /// </summary>
        Task<IEnumerable<GameSummary>> QueryGameSummariesAsync(GameQueryCriteria criteria, int top = 50);
    }
}
