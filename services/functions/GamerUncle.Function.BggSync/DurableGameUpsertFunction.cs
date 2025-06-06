using System.Collections.Generic;
using System.Threading.Tasks;
using Azure.Identity;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.DurableTask.Client;
using Microsoft.DurableTask;
using GamerUncle.Functions.Helpers;
using System.Net.Http;
using System.Net;
using System;
using Microsoft.Extensions.Logging;
using GamerUncle.Shared.Models;

namespace GamerUncle.Functions
{
    public class DurableGameUpsertFunction
    {
        private readonly CosmosClient _cosmosClient;
        private readonly Container _container;

        public DurableGameUpsertFunction()
        {
            var tenantId = Environment.GetEnvironmentVariable("AZURE_TENANT_ID");
            var clientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID");
            var cosmosEndpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT");

            Console.WriteLine($"🔍 Tenant ID: {tenantId}");
            Console.WriteLine($"🔍 Client ID: {clientId}");
            Console.WriteLine($"🔍 Cosmos Endpoint: {cosmosEndpoint}");

            if (!string.IsNullOrEmpty(clientId))
            {
                Console.WriteLine("🔐 Using Managed Identity for Azure environment");
                var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
                {
                    TenantId = tenantId,
                    ManagedIdentityClientId = clientId,
                    ExcludeEnvironmentCredential = true,
                    ExcludeAzureCliCredential = true,
                    ExcludeAzurePowerShellCredential = true,
                    ExcludeVisualStudioCredential = true,
                    ExcludeVisualStudioCodeCredential = true,
                    ExcludeInteractiveBrowserCredential = true
                });
                _cosmosClient = new CosmosClient(cosmosEndpoint, credential);
            }
            else
            {
                Console.WriteLine("🔓 Using DefaultAzureCredential for local development (Azure CLI/VS)");
                var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
                {
                    TenantId = tenantId,
                    // Don't exclude Azure CLI and VS for local development
                    ExcludeEnvironmentCredential = true,
                    ExcludeAzurePowerShellCredential = true,
                    ExcludeInteractiveBrowserCredential = true
                });
                _cosmosClient = new CosmosClient(cosmosEndpoint, credential);
            }
            _container = _cosmosClient.GetContainer("gamer-uncle-dev-cosmos-container", "Games");
        }

        [Function(nameof(DurableGameUpsertOrchestrator))]
        public async Task DurableGameUpsertOrchestrator([OrchestrationTrigger] TaskOrchestrationContext context)
        {
            // Get the input and handle potential JSON serialization issues
            var input = context.GetInput<string>();
            
            // Remove any extra quotes that might come from JSON serialization
            if (input != null && input.StartsWith("\"") && input.EndsWith("\""))
            {
                input = input.Trim('"');
            }

            int syncCount = int.TryParse(
                input,
                out var result
            ) ? result : 5;

            for (int i = 1; i <= syncCount; i++)
            {
                string gameId = i.ToString();
                GameDocument gameDocument = await context.CallActivityAsync<GameDocument>(
                    nameof(FetchGameDataActivity), gameId);

                if (gameDocument != null)
                {
                    await context.CallActivityAsync(nameof(UpsertGameDocumentActivity), gameDocument);
                }
            }
        }

        [Function(nameof(FetchGameDataActivity))]
        public async Task<GameDocument> FetchGameDataActivity([ActivityTrigger] string gameId)
        {
            #region mocked response
            // Mocked data for demonstration purposes
            // return Task.FromResult(new GameDocument
            // {
            //     id = $"bgg-{gameId}",
            //     name = "Mocked Game Name",
            //     overview = "This is a mocked overview.",
            //     description = "This is a mocked description.",
            //     minPlayers = 1,
            //     maxPlayers = 4,
            //     minPlaytime = 30,
            //     maxPlaytime = 120,
            //     weight = 2.5,
            //     averageRating = 4.5,
            //     bggRating = 4.7,
            //     numVotes = 100,
            //     ageRequirement = 12,
            //     yearPublished = 2020,
            //     imageUrl = "http://example.com/image.jpg",
            //     shopLink = "http://example.com/shop",
            //     mechanics = new List<string> { "Mechanic1", "Mechanic2" },
            //     categories = new List<string> { "Category1", "Category2" },
            //     setupGuide = "Setup guide content.",
            //     rulesUrl = "http://example.com/rules",
            //     ruleQnA = new List<RuleQnA>(),
            //     moderatorScripts = new List<ModeratorScript>(),
            //     narrationTTS = new NarrationTTS()
            // });
            #endregion

            // Remove any extra quotes that might come from JSON serialization
            if (gameId != null && gameId.StartsWith("\"") && gameId.EndsWith("\""))
            {
                gameId = gameId.Trim('"');
            }

            var httpClient = new HttpClient();
            var client = new BggApiClient(httpClient);
            var gameDocument = await client.FetchGameDataAsync(gameId);

            if (gameDocument == null)
            {
                Console.WriteLine($"Game ID {gameId} could not be fetched or parsed.");
            }

            return gameDocument;
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
            string syncCountStr = Environment.GetEnvironmentVariable("SyncGameCount") ?? "5";
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableGameUpsertOrchestrator), syncCountStr);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            await response.WriteStringAsync($"{{\"instanceId\": \"{instanceId}\"}}");
            return response;
        }
        
        [Function("GameSyncTimerTrigger")]
        public async Task GameSyncTimerTrigger(
            [Microsoft.Azure.Functions.Worker.TimerTrigger("0 0 6 * * *")] Microsoft.Azure.Functions.Worker.TimerInfo timerInfo,
            [DurableClient] DurableTaskClient client,
            FunctionContext context)
        {
            var log = context.GetLogger("GameSyncTimerTrigger");
            log.LogInformation($"Game sync timer trigger executed at: {DateTime.Now}");
            
            string syncCountStr = Environment.GetEnvironmentVariable("SyncGameCount") ?? "5";
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableGameUpsertOrchestrator), syncCountStr);
            
            log.LogInformation($"Started orchestration with ID = '{instanceId}'");
        }
    }
}