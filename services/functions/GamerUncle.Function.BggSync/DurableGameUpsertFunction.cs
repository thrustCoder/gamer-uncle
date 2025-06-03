using System.Collections.Generic;
using System.Threading.Tasks;
using Azure.Identity;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask.Client;
using Microsoft.DurableTask;
using GamerUncle.Functions.Models;

using Microsoft.DurableTask.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using System;

namespace GamerUncle.Functions
{
    public class DurableGameUpsertFunction
    {
        private readonly CosmosClient _cosmosClient;
        private readonly Container _container;

        public DurableGameUpsertFunction()
        {
            var credential = new DefaultAzureCredential();
            var cosmosEndpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT") ?? "https://gamer-uncle-dev-cosmos.documents.azure.com:443/";
            _cosmosClient = new CosmosClient(cosmosEndpoint, credential);
            _container = _cosmosClient.GetContainer("gamer-uncle-dev-cosmos-container", "Games");
        }

        [Function(nameof(DurableGameUpsertOrchestrator))]
        public async Task DurableGameUpsertOrchestrator([OrchestrationTrigger] TaskOrchestrationContext context)
        {
            string gameId = context.GetInput<string>();
            GameDocument gameDocument = await context.CallActivityAsync<GameDocument>(nameof(FetchGameDataActivity), gameId);
            await context.CallActivityAsync(nameof(UpsertGameDocumentActivity), gameDocument);
        }

        [Function(nameof(FetchGameDataActivity))]
        public Task<GameDocument> FetchGameDataActivity([ActivityTrigger] string gameId)
        {
            // Mocked data for demonstration purposes
            return Task.FromResult(new GameDocument
            {
                id = $"bgg-{gameId}",
                name = "Mocked Game Name",
                overview = "This is a mocked overview.",
                description = "This is a mocked description.",
                minPlayers = 1,
                maxPlayers = 4,
                minPlaytime = 30,
                maxPlaytime = 120,
                weight = 2.5,
                averageRating = 4.5,
                bggRating = 4.7,
                numVotes = 100,
                ageRequirement = 12,
                yearPublished = 2020,
                imageUrl = "http://example.com/image.jpg",
                shopLink = "http://example.com/shop",
                mechanics = new List<string> { "Mechanic1", "Mechanic2" },
                categories = new List<string> { "Category1", "Category2" },
                setupGuide = "Setup guide content.",
                rulesUrl = "http://example.com/rules",
                ruleQnA = new List<RuleQnA>(),
                moderatorScripts = new List<ModeratorScript>(),
                narrationTTS = new NarrationTTS()
            });
        }

        [Function(nameof(UpsertGameDocumentActivity))]
        public async Task UpsertGameDocumentActivity([ActivityTrigger] GameDocument gameDocument)
        {
            await _container.UpsertItemAsync(gameDocument, new PartitionKey(gameDocument.id));
        }

        [Function("GameSyncHttpStart")]
        public async Task<HttpResponseData> HttpStart(
            [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req,
            [DurableClient] DurableTaskClient client)
        {
            string gameId = await req.ReadAsStringAsync();
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableGameUpsertOrchestrator), gameId);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            await response.WriteStringAsync($"{{\"instanceId\": \"{instanceId}\"}}");
            return response;
        }
    }
}