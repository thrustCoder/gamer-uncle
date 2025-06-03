using Azure.Identity;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

using GamerUncle.Functions.Models;

namespace GamerUncle.Functions
{
    public class SyncGameActivity
    {
        private readonly CosmosClient _cosmosClient;
        private readonly string _databaseId;
        private readonly string _containerId;

        public SyncGameActivity(IConfiguration config)
        {
            var cosmosEndpoint = config["CosmosDbEndpoint"];
            _databaseId = config["CosmosDbDatabaseId"];
            _containerId = config["CosmosDbContainerId"];

            _cosmosClient = new CosmosClient(cosmosEndpoint, new DefaultAzureCredential());
        }

        [Function("SyncGameActivity")]
        public async Task<string> Run(
            [ActivityTrigger] int gameId,
            FunctionContext context)
        {
            var logger = context.GetLogger("SyncGameActivity");
            logger.LogInformation($"Syncing game with ID: {gameId}");

            // TODO: Replace with actual fetch from BGG
            var game = new GameDocument
            {
                id = $"bgg-{gameId}",
                name = $"Fake Game {gameId}",
                minPlayers = 2,
                maxPlayers = 5,
                weight = 2.3,
                averageRating = 7.4,
                yearPublished = 2021,
                imageUrl = "https://example.com/fake.jpg"
            };

            var container = _cosmosClient.GetContainer(_databaseId, _containerId);
            var response = await container.UpsertItemAsync(game, new PartitionKey(game.id));

            logger.LogInformation($"Upserted game: {game.name} (Status: {response.StatusCode})");
            return $"Synced {game.name}";
        }
    }
}
