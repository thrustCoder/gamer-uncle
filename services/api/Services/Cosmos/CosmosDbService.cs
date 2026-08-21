using Microsoft.Azure.Cosmos;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.Cosmos
{
    /// <summary>
    /// Cosmos DB service for game query operations.
    /// Uses a shared singleton Container injected via DI (single CosmosClient per application).
    /// </summary>
    public class CosmosDbService : ICosmosDbService
    {
        private readonly Container _container;

        public CosmosDbService(Container container)
        {
            _container = container ?? throw new ArgumentNullException(nameof(container));
        }

        public async Task<IEnumerable<GameDocument>> QueryGamesAsync(GameQueryCriteria criteria)
        {
            var (whereClause, parameters) = BuildWhereClause(criteria);
            var query = $"SELECT * FROM c{whereClause}";

            var queryDef = new QueryDefinition(query);
            foreach (var param in parameters)
            {
                queryDef.WithParameter(param.Key, param.Value);
            }

            var results = new List<GameDocument>();
            using var iterator = _container.GetItemQueryIterator<GameDocument>(queryDef);
            while (iterator.HasMoreResults)
            {
                var response = await iterator.ReadNextAsync();
                results.AddRange(response);
            }

            return results;
        }

        public async Task<IEnumerable<GameSummary>> QueryGameSummariesAsync(GameQueryCriteria criteria, int top = 50)
        {
            var (whereClause, parameters) = BuildWhereClause(criteria);

            // Use SELECT projection to fetch only lightweight fields needed for RAG
            // and TOP + ORDER BY to let Cosmos DB return only the best matches
            var query = $@"SELECT TOP {top}
    c.id, c.name, c.overview,
    c.minPlayers, c.maxPlayers,
    c.minPlaytime, c.maxPlaytime,
    c.weight, c.averageRating,
    c.imageUrl, c.mechanics, c.categories
FROM c{whereClause}
ORDER BY c.averageRating DESC";

            var queryDef = new QueryDefinition(query);
            foreach (var param in parameters)
            {
                queryDef.WithParameter(param.Key, param.Value);
            }

            var results = new List<GameSummary>();
            using var iterator = _container.GetItemQueryIterator<GameSummary>(queryDef);
            while (iterator.HasMoreResults)
            {
                var response = await iterator.ReadNextAsync();
                results.AddRange(response);
            }

            return results;
        }

        /// <summary>
        /// Builds the WHERE clause and parameter dictionary from the query criteria.
        /// Shared between QueryGamesAsync and QueryGameSummariesAsync.
        /// </summary>
        internal static (string whereClause, Dictionary<string, object> parameters) BuildWhereClause(GameQueryCriteria criteria)
        {
            var conditions = new List<string>();
            var parameters = new Dictionary<string, object>();

            if (!string.IsNullOrEmpty(criteria.name))
            {
                conditions.Add("CONTAINS(LOWER(c.name), LOWER(@name))");
                parameters.Add("@name", criteria.name);
            }

            // Player count logic - corrected for proper range overlap
            if (criteria.MinPlayers.HasValue && criteria.MaxPlayers.HasValue)
            {
                // Range query: "2-4 players" - find games that overlap with this range
                conditions.Add("c.maxPlayers >= @minPlayers AND c.minPlayers <= @maxPlayers");
                parameters.Add("@minPlayers", criteria.MinPlayers.Value);
                parameters.Add("@maxPlayers", criteria.MaxPlayers.Value);
            }
            else if (criteria.MinPlayers.HasValue)
            {
                // "At least X players" - game must support AT LEAST this many
                conditions.Add("c.maxPlayers >= @minPlayers");
                parameters.Add("@minPlayers", criteria.MinPlayers.Value);
            }
            else if (criteria.MaxPlayers.HasValue)
            {
                // "Up to X players" - game must work with this few players
                conditions.Add("c.minPlayers <= @maxPlayers");
                parameters.Add("@maxPlayers", criteria.MaxPlayers.Value);
            }

            // Playtime logic - same pattern as player count
            if (criteria.MinPlaytime.HasValue && criteria.MaxPlaytime.HasValue)
            {
                // Range query: "30-60 minutes" - find games that overlap with this range
                conditions.Add("c.maxPlaytime >= @minPlaytime AND c.minPlaytime <= @maxPlaytime");
                parameters.Add("@minPlaytime", criteria.MinPlaytime.Value);
                parameters.Add("@maxPlaytime", criteria.MaxPlaytime.Value);
            }
            else if (criteria.MinPlaytime.HasValue)
            {
                // "At least X minutes" - game can be played for at least this long
                conditions.Add("c.maxPlaytime >= @minPlaytime");
                parameters.Add("@minPlaytime", criteria.MinPlaytime.Value);
            }
            else if (criteria.MaxPlaytime.HasValue)
            {
                // "Up to X minutes" - game doesn't require more time than this
                conditions.Add("c.minPlaytime <= @maxPlaytime");
                parameters.Add("@maxPlaytime", criteria.MaxPlaytime.Value);
            }

            if (criteria.MaxWeight.HasValue)
            {
                conditions.Add("c.weight <= @maxWeight");
                parameters.Add("@maxWeight", criteria.MaxWeight.Value);
            }

            if (criteria.averageRating.HasValue)
            {
                conditions.Add("c.averageRating >= @averageRating");
                parameters.Add("@averageRating", criteria.averageRating.Value);
            }

            if (criteria.ageRequirement.HasValue)
            {
                conditions.Add("c.ageRequirement <= @ageRequirement");
                parameters.Add("@ageRequirement", criteria.ageRequirement.Value);
            }

            // Flexible mechanics and categories matching.
            //
            // The database stores BoardGameGeek's canonical taxonomy strings (e.g. the mechanic
            // "Cooperative Game", the category "Abstract Strategy", or "Murder / Mystery"), while
            // the criteria extraction emits everyday shorthand words ("Cooperative", "Strategy",
            // "Mystery"). An exact ARRAY_CONTAINS therefore misses almost every genre/mechanic
            // query and returns zero games. We instead do a case-insensitive SUBSTRING match over
            // each array element via a correlated EXISTS subquery, so "cooperative" matches
            // "Cooperative Game", "strategy" matches "Abstract Strategy", "mystery" matches
            // "Murder / Mystery", and so on.
            var allSearchTerms = new List<string>();
            if (criteria.Mechanics?.Any() == true)
            {
                allSearchTerms.AddRange(criteria.Mechanics.Where(t => !string.IsNullOrWhiteSpace(t)));
            }
            if (criteria.Categories?.Any() == true)
            {
                allSearchTerms.AddRange(criteria.Categories.Where(t => !string.IsNullOrWhiteSpace(t)));
            }

            if (allSearchTerms.Any())
            {
                // A game matches if ANY search term appears (case-insensitively) as a substring of
                // any element in its mechanics OR categories arrays.
                var termClauses = new List<string>();
                for (int i = 0; i < allSearchTerms.Count; i++)
                {
                    var paramName = $"@term{i}";
                    termClauses.Add(
                        $"EXISTS(SELECT VALUE m FROM m IN c.mechanics WHERE CONTAINS(LOWER(m), LOWER({paramName}))) " +
                        $"OR EXISTS(SELECT VALUE cat FROM cat IN c.categories WHERE CONTAINS(LOWER(cat), LOWER({paramName})))");
                    parameters.Add(paramName, allSearchTerms[i].Trim());
                }

                conditions.Add("(" + string.Join(" OR ", termClauses) + ")");
            }

            var whereClause = conditions.Count > 0
                ? " WHERE " + string.Join(" AND ", conditions)
                : "";

            return (whereClause, parameters);
        }
    }
}
