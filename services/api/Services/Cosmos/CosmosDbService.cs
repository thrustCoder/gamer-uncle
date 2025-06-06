using Azure.Identity;
using Microsoft.Azure.Cosmos;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.Cosmos
{
    public class CosmosDbService : ICosmosDbService
    {
        private readonly Container _container;

        public CosmosDbService(IConfiguration config)
        {
            var endpoint = config["CosmosDb:Endpoint"]
                ?? throw new InvalidOperationException("Missing Cosmos DB endpoint config.");

            var credential = new DefaultAzureCredential();
            var client = new CosmosClient(endpoint, credential);
            _container = client.GetContainer("gamer-uncle-dev-cosmos-container", "Games");
        }

        public async Task<IEnumerable<GameDocument>> QueryGamesAsync(GameQueryCriteria criteria)
        {
            var query = "SELECT * FROM c WHERE 1=1";
            var queryDef = new QueryDefinition(query);

            if (!string.IsNullOrEmpty(criteria.name))
            {
                query += " AND CONTAINS(LOWER(c.name), LOWER(@name))";
                queryDef.WithParameter("@name", criteria.name);
            }
            if (criteria.MinPlayers.HasValue)
            {
                query += " AND c.minPlayers <= @minPlayers";
                queryDef.WithParameter("@minPlayers", criteria.MinPlayers.Value);
            }
            if (criteria.MaxPlayers.HasValue)
            {
                query += " AND c.maxPlayers >= @maxPlayers";
                queryDef.WithParameter("@maxPlayers", criteria.MaxPlayers.Value);
            }
            if (criteria.MinPlaytime.HasValue)
            {
                query += " AND c.minPlaytime >= @minPlaytime";
                queryDef.WithParameter("@minPlaytime", criteria.MinPlaytime.Value);
            }
            if (criteria.MaxPlaytime.HasValue)
            {
                query += " AND c.maxPlaytime <= @maxPlaytime";
                queryDef.WithParameter("@maxPlaytime", criteria.MaxPlaytime.Value);
            }
            if (criteria.MaxWeight.HasValue)
            {
                query += " AND c.weight <= @maxWeight";
                queryDef.WithParameter("@maxWeight", criteria.MaxWeight.Value);
            }
            if (criteria.averageRating.HasValue)
            {
                query += " AND c.averageRating >= @averageRating";
                queryDef.WithParameter("@averageRating", criteria.averageRating.Value);
            }
            if (criteria.ageRequirement.HasValue)
            {
                query += " AND c.ageRequirement <= @ageRequirement";
                queryDef.WithParameter("@ageRequirement", criteria.ageRequirement.Value);
            }
            if (criteria.Mechanics?.Any() == true)
            {
                for (int i = 0; i < criteria.Mechanics.Length; i++)
                {
                    var name = "@mech" + i;
                    query += $" AND ARRAY_CONTAINS(c.mechanics, {name}, true)";
                    queryDef.WithParameter(name, criteria.Mechanics[i]);
                }
            }
            if (criteria.Categories?.Any() == true)
            {
                for (int i = 0; i < criteria.Categories.Length; i++)
                {
                    var name = "@cat" + i;
                    query += $" AND ARRAY_CONTAINS(c.categories, {name}, true)";
                    queryDef.WithParameter(name, criteria.Categories[i]);
                }
            }

            // queryDef is already built with parameters above

            var results = new List<GameDocument>();
            using var iterator = _container.GetItemQueryIterator<GameDocument>(queryDef);
            while (iterator.HasMoreResults)
            {
                var response = await iterator.ReadNextAsync();
                results.AddRange(response);
            }

            return results;
        }
    }
}
