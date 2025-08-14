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
using System.IO;
using System.Text.Json;

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
                GameDocument? gameDocument = await context.CallActivityAsync<GameDocument?>(
                    nameof(FetchGameDataActivity), gameId);

                if (gameDocument != null)
                {
                    await context.CallActivityAsync(nameof(UpsertGameDocumentActivity), gameDocument);
                }
            }
        }

        [Function(nameof(FetchGameDataActivity))]
        public async Task<GameDocument?> FetchGameDataActivity([ActivityTrigger] string gameId)
        {
            // Return null if invalid id
            if (string.IsNullOrWhiteSpace(gameId))
            {
                return null;
            }

            // Remove any extra quotes that might come from JSON serialization
            if (gameId.StartsWith("\"") && gameId.EndsWith("\""))
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
            // Try to parse count from JSON body: { "count": number }
            int? requestCount = null;
            try
            {
                if (req.Body != null)
                {
                    using var reader = new StreamReader(req.Body);
                    var body = await reader.ReadToEndAsync();
                    requestCount = RequestCountParser.TryParseCountFromJson(body);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse request body for count. Falling back to environment/default.");
            }

            var envDefault = Environment.GetEnvironmentVariable("SyncGameCount") ?? "5";
            int syncCount = requestCount.HasValue && requestCount.Value > 0
                ? requestCount.Value
                : (int.TryParse(envDefault, out var envParsed) && envParsed > 0 ? envParsed : 5);

            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableGameUpsertOrchestrator), syncCount.ToString());

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            await response.WriteStringAsync($"{{\"instanceId\": \"{instanceId}\", \"count\": {syncCount}}}");
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
            [Microsoft.Azure.Functions.Worker.TimerTrigger("0 5 8 1 * *", RunOnStartup = false)] Microsoft.Azure.Functions.Worker.TimerInfo timerInfo,
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

        [Function(nameof(DurableHighSignalUpsertOrchestrator))]
        public async Task DurableHighSignalUpsertOrchestrator([OrchestrationTrigger] TaskOrchestrationContext context)
        {
            var request = context.GetInput<HighSignalSyncRequest>() ?? new HighSignalSyncRequest();

            int upserted = 0;
            for (int id = request.StartId; id <= request.EndId; id++)
            {
                if (upserted >= request.Limit)
                {
                    break;
                }

                var gameId = id.ToString();
                GameDocument? game = await context.CallActivityAsync<GameDocument?>(nameof(FetchGameDataActivity), gameId);
                if (game == null)
                {
                    continue;
                }

                if (HighSignalFilter.IsHighSignal(game, request.MinAverage, request.MinBayes, request.MinVotes))
                {
                    await context.CallActivityAsync(nameof(UpsertGameDocumentActivity), game);
                    upserted++;
                }
            }
        }

        [Function("GameSyncHighSignalStart")]
        public async Task<HttpResponseData> GameSyncHighSignalStart(
            [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req,
            [DurableClient] DurableTaskClient client)
        {
            HighSignalSyncRequest? request = null;
            try
            {
                using var reader = new StreamReader(req.Body);
                var body = await reader.ReadToEndAsync();
                request = JsonSerializer.Deserialize<HighSignalSyncRequest>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse high-signal request body. Using defaults.");
            }

            request ??= new HighSignalSyncRequest();

            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableHighSignalUpsertOrchestrator), request);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                instanceId,
                request
            }));
            return response;
        }
    }

    public class HighSignalSyncRequest
    {
        public int StartId { get; set; } = 1;
        public int EndId { get; set; } = 1_000_000; // widened scan window to capture more high-signal games
        public int Limit { get; set; } = 5000; // how many to upsert
        public double MinAverage { get; set; } = 5.0;
        public double MinBayes { get; set; } = 5.0;
        public int MinVotes { get; set; } = 50;
    }

    public static class HighSignalFilter
    {
        public static bool IsHighSignal(GameDocument g, double minAverage, double minBayes, int minVotes)
        {
            if (g == null) return false;
            if (g.numVotes < minVotes) return false;
            if (g.bggRating < minBayes) return false;
            if (g.averageRating < minAverage) return false;
            return true;
        }
    }
}