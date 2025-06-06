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

            var tenantId = config["CosmosDb:TenantId"]
                ?? throw new InvalidOperationException("Missing Cosmos DB tenant ID config.");

            var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
            {
                TenantId = tenantId,
                // For API running in Azure, you might also need to specify:
                // ManagedIdentityClientId = config["CosmosDb:ClientId"] // if using UAMI
            });

            var client = new CosmosClient(endpoint, credential);
            _container = client.GetContainer("gamer-uncle-dev-cosmos-container", "Games");
        }

        public async Task<IEnumerable<GameDocument>> QueryGamesAsync(GameQueryCriteria criteria)
        {
            var query = "SELECT * FROM c WHERE 1=1";
            var parameters = new Dictionary<string, object>();

            if (!string.IsNullOrEmpty(criteria.name))
            {
                query += " AND CONTAINS(LOWER(c.name), LOWER(@name))";
                parameters.Add("@name", criteria.name);
            }

            // Player count logic - corrected for proper range overlap
            if (criteria.MinPlayers.HasValue && criteria.MaxPlayers.HasValue)
            {
                // Range query: "2-4 players" - find games that overlap with this range
                query += " AND c.maxPlayers >= @minPlayers AND c.minPlayers <= @maxPlayers";
                parameters.Add("@minPlayers", criteria.MinPlayers.Value);
                parameters.Add("@maxPlayers", criteria.MaxPlayers.Value);
            }
            else if (criteria.MinPlayers.HasValue)
            {
                // "At least X players" - game must support AT LEAST this many
                query += " AND c.maxPlayers >= @minPlayers";
                parameters.Add("@minPlayers", criteria.MinPlayers.Value);
            }
            else if (criteria.MaxPlayers.HasValue)
            {
                // "Up to X players" - game must work with this few players
                query += " AND c.minPlayers <= @maxPlayers";
                parameters.Add("@maxPlayers", criteria.MaxPlayers.Value);
            }

            // Playtime logic - same pattern as player count
            if (criteria.MinPlaytime.HasValue && criteria.MaxPlaytime.HasValue)
            {
                // Range query: "30-60 minutes" - find games that overlap with this range
                query += " AND c.maxPlaytime >= @minPlaytime AND c.minPlaytime <= @maxPlaytime";
                parameters.Add("@minPlaytime", criteria.MinPlaytime.Value);
                parameters.Add("@maxPlaytime", criteria.MaxPlaytime.Value);
            }
            else if (criteria.MinPlaytime.HasValue)
            {
                // "At least X minutes" - game can be played for at least this long
                query += " AND c.maxPlaytime >= @minPlaytime";
                parameters.Add("@minPlaytime", criteria.MinPlaytime.Value);
            }
            else if (criteria.MaxPlaytime.HasValue)
            {
                // "Up to X minutes" - game doesn't require more time than this
                query += " AND c.minPlaytime <= @maxPlaytime";
                parameters.Add("@maxPlaytime", criteria.MaxPlaytime.Value);
            }

            if (criteria.MaxWeight.HasValue)
            {
                query += " AND c.weight <= @maxWeight";
                parameters.Add("@maxWeight", criteria.MaxWeight.Value);
            }

            if (criteria.averageRating.HasValue)
            {
                query += " AND c.averageRating >= @averageRating";
                parameters.Add("@averageRating", criteria.averageRating.Value);
            }

            if (criteria.ageRequirement.HasValue)
            {
                query += " AND c.ageRequirement <= @ageRequirement";
                parameters.Add("@ageRequirement", criteria.ageRequirement.Value);
            }

            // More flexible mechanics and categories matching
            var allSearchTerms = new List<string>();
            if (criteria.Mechanics?.Any() == true)
            {
                // Convert to title case to match database format
                allSearchTerms.AddRange(criteria.Mechanics.Select(ToTitleCase));
            }
            if (criteria.Categories?.Any() == true)
            {
                // Convert to title case to match database format
                allSearchTerms.AddRange(criteria.Categories.Select(ToTitleCase));
            }

            if (allSearchTerms.Any())
            {
                // Search in both mechanics AND categories arrays for any of the terms
                var mechanicsOrCategories = "(";
                for (int i = 0; i < allSearchTerms.Count; i++)
                {
                    var paramName = $"@term{i}";
                    if (i > 0) mechanicsOrCategories += " OR ";
                    mechanicsOrCategories += $"ARRAY_CONTAINS(c.mechanics, {paramName}, true) OR ARRAY_CONTAINS(c.categories, {paramName}, true)";
                    parameters.Add(paramName, allSearchTerms[i]);
                }
                mechanicsOrCategories += ")";

                query += $" AND {mechanicsOrCategories}";
            }

            // Create QueryDefinition with final query string
            var queryDef = new QueryDefinition(query);

            // Add all parameters to the QueryDefinition
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

        private static string ToTitleCase(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            
            var textInfo = System.Globalization.CultureInfo.CurrentCulture.TextInfo;
            return textInfo.ToTitleCase(input.ToLowerInvariant());
        }
    }
}
