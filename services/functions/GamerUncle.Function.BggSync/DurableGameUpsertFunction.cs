using System.Collections.Generic;
using System.Linq;
using System.Threading;
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

            int processedCount = 0;
            int skippedCount = 0;

            for (int i = 1; i <= syncCount; i++)
            {
                string gameId = i.ToString();
                
                // First check if the game already exists in Cosmos DB
                bool gameExists = await context.CallActivityAsync<bool>(
                    nameof(CheckGameExistsActivity), gameId);

                if (gameExists)
                {
                    skippedCount++;
                    continue; // Skip this game as it already exists
                }

                // Only fetch and upsert if the game doesn't exist
                GameDocument? gameDocument = await context.CallActivityAsync<GameDocument?>(
                    nameof(FetchGameDataActivity), gameId);

                if (gameDocument != null)
                {
                    await context.CallActivityAsync(nameof(UpsertGameDocumentActivity), gameDocument);
                    processedCount++;
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

        [Function(nameof(CheckGameExistsActivity))]
        public async Task<bool> CheckGameExistsActivity([ActivityTrigger] string gameId)
        {
            try
            {
                // Return false if invalid id
                if (string.IsNullOrWhiteSpace(gameId))
                {
                    return false;
                }

                // Remove any extra quotes that might come from JSON serialization
                if (gameId.StartsWith("\"") && gameId.EndsWith("\""))
                {
                    gameId = gameId.Trim('"');
                }

                // Create the document ID that would be used in Cosmos DB (BGG ID prefixed with bgg-)
                var documentId = $"bgg-{gameId}";

                // Try to read the item from Cosmos DB
                var response = await _container.ReadItemAsync<GameDocument>(documentId, new PartitionKey(documentId));
                
                _logger.LogInformation("Game {GameId} already exists in Cosmos DB, skipping sync", gameId);
                return true;
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                // Game doesn't exist, we should sync it
                _logger.LogInformation("Game {GameId} not found in Cosmos DB, will sync from BGG", gameId);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error checking if game {GameId} exists in Cosmos DB, will attempt to sync", gameId);
                // If we can't check, err on the side of attempting to sync
                return false;
            }
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
            [Microsoft.Azure.Functions.Worker.TimerTrigger("0 0 0 1 */3 *", RunOnStartup = false)] Microsoft.Azure.Functions.Worker.TimerInfo timerInfo,
            [DurableClient] DurableTaskClient client,
            FunctionContext context)
        {
            var log = context.GetLogger("GameSyncTimerTriggerDev");

            // DISABLED: BGG XML API now requires Bearer token authentication.
            // Re-enable once BggApiBearerToken is configured. See docs/bgg/sync/api_access.md
            log.LogWarning("Dev ranked sync trigger fired but is DISABLED — BGG API requires authentication. Skipping.");
            return;

            var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT") ?? "Development";
            
            // Only run in development environments
            if (!environment.Contains("Development") && !environment.Contains("dev"))
            {
                return;
            }
            
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
            
            log.LogInformation($"Dev ranked game sync timer trigger executed at: {DateTime.Now}");
            
            var rankedSyncPages = Environment.GetEnvironmentVariable("RankedSyncPages") ?? "30";
            int endPage = int.TryParse(rankedSyncPages, out var rp) && rp > 0 ? rp : 30;
            var request = new RankedSyncRequest { StartPage = 1, EndPage = endPage };
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableRankedSyncOrchestrator), request);
            
            log.LogInformation($"Started dev ranked sync orchestration with ID = '{instanceId}', pages 1-{endPage}");
        }

        [Function("GameSyncTimerTriggerProd")]
        public async Task GameSyncTimerTriggerProd(
            [Microsoft.Azure.Functions.Worker.TimerTrigger("0 0 0 1 */6 *", RunOnStartup = false)] Microsoft.Azure.Functions.Worker.TimerInfo timerInfo,
            [DurableClient] DurableTaskClient client,
            FunctionContext context)
        {
            var log = context.GetLogger("GameSyncTimerTriggerProd");

            // DISABLED: BGG XML API now requires Bearer token authentication.
            // Re-enable once BggApiBearerToken is configured. See docs/bgg/sync/api_access.md
            log.LogWarning("Prod ranked sync trigger fired but is DISABLED — BGG API requires authentication. Skipping.");
            return;

            var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT") ?? "Development";
            
            // Only run in production environments
            if (environment.Contains("Development") || environment.Contains("dev"))
            {
                return;
            }
            
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
            
            log.LogInformation($"Prod ranked game sync timer trigger executed at: {DateTime.Now}");
            
            var rankedSyncPages = Environment.GetEnvironmentVariable("RankedSyncPages") ?? "70";
            int endPage = int.TryParse(rankedSyncPages, out var rp) && rp > 0 ? rp : 70;
            var request = new RankedSyncRequest { StartPage = 1, EndPage = endPage };
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(DurableRankedSyncOrchestrator), request);
            
            log.LogInformation($"Started prod ranked sync orchestration with ID = '{instanceId}', pages 1-{endPage}");
        }

        [Function(nameof(DurableHighSignalUpsertOrchestrator))]
        public async Task DurableHighSignalUpsertOrchestrator([OrchestrationTrigger] TaskOrchestrationContext context)
        {
            var request = context.GetInput<HighSignalSyncRequest>() ?? new HighSignalSyncRequest();

            int upserted = 0;
            int skipped = 0;
            
            for (int id = request.StartId; id <= request.EndId; id++)
            {
                if (upserted >= request.Limit)
                {
                    break;
                }

                var gameId = id.ToString();
                
                // First check if the game already exists in Cosmos DB
                bool gameExists = await context.CallActivityAsync<bool>(
                    nameof(CheckGameExistsActivity), gameId);

                if (gameExists)
                {
                    skipped++;
                    continue; // Skip this game as it already exists
                }

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

        // ─── Ranked Sync (BGG browse pages by rank) ───────────────────────

        [Function(nameof(DurableRankedSyncOrchestrator))]
        public async Task DurableRankedSyncOrchestrator([OrchestrationTrigger] TaskOrchestrationContext context)
        {
            var request = context.GetInput<RankedSyncRequest>() ?? new RankedSyncRequest();

            int upserted = 0;
            int skipped = 0;
            int failed = 0;

            for (int page = request.StartPage; page <= request.EndPage; page++)
            {
                // Delay between pages to avoid overwhelming BGG (3 seconds between page fetches)
                if (page > request.StartPage)
                {
                    await context.CreateTimer(context.CurrentUtcDateTime.AddSeconds(3), CancellationToken.None);
                }

                // Fetch ranked game IDs from this BGG browse page
                List<string> gameIds;
                try
                {
                    gameIds = await context.CallActivityAsync<List<string>>(
                        nameof(FetchRankedGameIdsActivity), page);
                }
                catch
                {
                    // If a page fetch fails, skip to the next page
                    failed++;
                    continue;
                }

                if (gameIds == null || gameIds.Count == 0)
                {
                    continue;
                }

                foreach (var gameId in gameIds)
                {
                    // Check if game already exists in Cosmos DB
                    bool gameExists = await context.CallActivityAsync<bool>(
                        nameof(CheckGameExistsActivity), gameId);

                    if (gameExists)
                    {
                        skipped++;
                        continue;
                    }

                    // Small delay before fetching game data from BGG XML API (1 second)
                    await context.CreateTimer(context.CurrentUtcDateTime.AddSeconds(1), CancellationToken.None);

                    // Fetch full game data from BGG XML API and upsert
                    GameDocument? game = await context.CallActivityAsync<GameDocument?>(
                        nameof(FetchGameDataActivity), gameId);

                    if (game != null)
                    {
                        await context.CallActivityAsync(nameof(UpsertGameDocumentActivity), game);
                        upserted++;
                    }
                }
            }
        }

        [Function(nameof(FetchRankedGameIdsActivity))]
        public async Task<List<string>> FetchRankedGameIdsActivity([ActivityTrigger] int pageNumber)
        {
            // Longer timeout — each page makes many batch XML API calls (~200 per page)
            var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
            var idsPerPageStr = Environment.GetEnvironmentVariable("IdsPerPage");
            int idsPerPage = int.TryParse(idsPerPageStr, out var ipp) && ipp > 0 ? ipp : 4100;

            var client = new BggRankedListClient(httpClient) { IdsPerPage = idsPerPage };
            var gameIds = await client.FetchRankedGameIdsAsync(pageNumber);

            _logger.LogInformation(
                "Fetched {Count} qualifying game IDs from BGG XML API for page {Page} (IDs {Start}-{End})",
                gameIds.Count, pageNumber, (pageNumber - 1) * idsPerPage + 1, pageNumber * idsPerPage);

            return gameIds;
        }

        [Function("GameSyncRankedStart")]
        public async Task<HttpResponseData> GameSyncRankedStart(
            [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req,
            [DurableClient] DurableTaskClient client)
        {
            RankedSyncRequest? request = null;
            try
            {
                using var reader = new StreamReader(req.Body);
                var body = await reader.ReadToEndAsync();
                request = JsonSerializer.Deserialize<RankedSyncRequest>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse ranked sync request body. Using defaults.");
            }

            request ??= new RankedSyncRequest();

            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(
                nameof(DurableRankedSyncOrchestrator), request);

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

    public class RankedSyncRequest
    {
        /// <summary>First page to scan (1-based). Each page covers IdsPerPage sequential BGG IDs.</summary>
        public int StartPage { get; set; } = 1;

        /// <summary>Last page to scan. With IdsPerPage=4100 and 70 pages, covers ~287k BGG IDs.</summary>
        public int EndPage { get; set; } = 70;
    }

    public class HighSignalSyncRequest
    {
        public int StartId { get; set; } = 1;
        public int EndId { get; set; } = 1_000_000; // widened scan window to capture more high-signal games
        public int Limit { get; set; } = 7_000; // how many to upsert
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