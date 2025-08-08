using System.Collections.Generic;
using System.Threading.Tasks;
using Azure;
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
        private readonly ILogger<DurableGameUpsertFunction> _logger;

        public DurableGameUpsertFunction(CosmosClient cosmosClient, ILogger<DurableGameUpsertFunction> logger)
        {
            _cosmosClient = cosmosClient ?? throw new ArgumentNullException(nameof(cosmosClient));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            
            var databaseName = Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME") ?? "gamer-uncle-dev-cosmos-container";
            var containerName = Environment.GetEnvironmentVariable("COSMOS_CONTAINER_NAME") ?? "Games";

            _logger.LogInformation("Initializing Cosmos DB container: {DatabaseName}/{ContainerName}", databaseName, containerName);
            _container = _cosmosClient.GetContainer(databaseName, containerName);
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
            try
            {
                _logger.LogInformation("Attempting to upsert game document: {GameId}", gameDocument.id);
                await _container.UpsertItemAsync(gameDocument, new PartitionKey(gameDocument.id));
                _logger.LogInformation("Successfully upserted game document: {GameId}", gameDocument.id);
            }
            catch (CredentialUnavailableException ex)
            {
                _logger.LogError(ex, "Azure credentials unavailable when trying to upsert game document {GameId}. Check managed identity configuration.", gameDocument.id);
                throw;
            }
            catch (AuthenticationFailedException ex)
            {
                _logger.LogError(ex, "Authentication failed when trying to upsert game document {GameId}. This indicates a managed identity issue.", gameDocument.id);
                throw;
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure request failed when trying to upsert game document {GameId}. Status: {Status}, Error: {ErrorCode}", 
                    gameDocument.id, ex.Status, ex.ErrorCode);
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error when trying to upsert game document {GameId}", gameDocument.id);
                throw;
            }
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
        
        [Function("GameSyncTimerTriggerDev")]
        public async Task GameSyncTimerTriggerDev(
            [Microsoft.Azure.Functions.Worker.TimerTrigger("0 5 8 * * 1,4", RunOnStartup = false)] Microsoft.Azure.Functions.Worker.TimerInfo timerInfo,
            [DurableClient] DurableTaskClient client,
            FunctionContext context)
        {
            var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT") ?? "Development";
            
            // Only run in development environments
            if (!environment.Contains("Development") && !environment.Contains("dev"))
            {
                return;
            }
            
            var log = context.GetLogger("GameSyncTimerTriggerDev");
            
            // Check if this is a past due execution (e.g., after restart/deployment)
            if (timerInfo.IsPastDue)
            {
                log.LogInformation("Timer trigger was past due - checking if we should skip execution");
                
                // Skip if the missed execution was more than 1 hour ago to avoid deployment-triggered runs
                if (timerInfo.ScheduleStatus?.Last != null)
                {
                    var timeSinceLastScheduled = DateTime.UtcNow - timerInfo.ScheduleStatus.Last;
                    if (timeSinceLastScheduled > TimeSpan.FromHours(1))
                    {
                        log.LogInformation($"Skipping past due execution - was {timeSinceLastScheduled.TotalMinutes:F0} minutes late");
                        return;
                    }
                }
            }
            
            log.LogInformation($"Dev game sync timer trigger executed at: {DateTime.Now}");
            
            string syncCountStr = Environment.GetEnvironmentVariable("SyncGameCount") ?? "5";
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableGameUpsertOrchestrator), syncCountStr);
            
            log.LogInformation($"Started dev orchestration with ID = '{instanceId}'");
        }

        [Function("GameSyncTimerTriggerProd")]
        public async Task GameSyncTimerTriggerProd(
            [Microsoft.Azure.Functions.Worker.TimerTrigger("0 5 8 * * *", RunOnStartup = false)] Microsoft.Azure.Functions.Worker.TimerInfo timerInfo,
            [DurableClient] DurableTaskClient client,
            FunctionContext context)
        {
            var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT") ?? "Development";
            
            // Only run in production environments
            if (environment.Contains("Development") || environment.Contains("dev"))
            {
                return;
            }
            
            var log = context.GetLogger("GameSyncTimerTriggerProd");
            
            // Check if this is a past due execution (e.g., after restart/deployment)
            if (timerInfo.IsPastDue)
            {
                log.LogInformation("Timer trigger was past due - checking if we should skip execution");
                
                // Skip if the missed execution was more than 1 hour ago to avoid deployment-triggered runs
                if (timerInfo.ScheduleStatus?.Last != null)
                {
                    var timeSinceLastScheduled = DateTime.UtcNow - timerInfo.ScheduleStatus.Last;
                    if (timeSinceLastScheduled > TimeSpan.FromHours(1))
                    {
                        log.LogInformation($"Skipping past due execution - was {timeSinceLastScheduled.TotalMinutes:F0} minutes late");
                        return;
                    }
                }
            }
            
            log.LogInformation($"Prod game sync timer trigger executed at: {DateTime.Now}");
            
            string syncCountStr = Environment.GetEnvironmentVariable("SyncGameCount") ?? "5";
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableGameUpsertOrchestrator), syncCountStr);
            
            log.LogInformation($"Started prod orchestration with ID = '{instanceId}'");
        }
    }
}