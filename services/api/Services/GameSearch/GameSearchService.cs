using System.Text.Json;
using Azure.Identity;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Shared.Models;
using Microsoft.ApplicationInsights;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Caching.Memory;
using StackExchange.Redis;

namespace GamerUncle.Api.Services.GameSearch
{
    /// <summary>
    /// Service for game search functionality with L1 (memory) and L2 (Redis) caching.
    /// </summary>
    public class GameSearchService : IGameSearchService
    {
        private const string CacheVersion = "v1";
        private const string SearchCachePrefix = "game-search";
        private const string DetailsCachePrefix = "game-details";

        private readonly Container? _container;
        private readonly IMemoryCache _l1Cache;
        private readonly IConnectionMultiplexer? _redis;
        private readonly ILogger<GameSearchService> _logger;
        private readonly TelemetryClient? _telemetry;
        private readonly TimeSpan _l1Expiration;
        private readonly TimeSpan _l2Expiration;
        private readonly string _environment;
        private readonly bool _isTestEnvironment;

        public GameSearchService(
            IConfiguration config,
            IMemoryCache memoryCache,
            IConnectionMultiplexer? redis,
            ILogger<GameSearchService> logger,
            IWebHostEnvironment environment,
            TelemetryClient? telemetry = null)
        {
            _l1Cache = memoryCache ?? throw new ArgumentNullException(nameof(memoryCache));
            _redis = redis;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _telemetry = telemetry;

            _isTestEnvironment = environment.EnvironmentName.Equals("Testing", StringComparison.OrdinalIgnoreCase)
                               || config.GetValue<bool>("Testing:DisableRateLimit");

            // Cache configuration
            _l1Expiration = TimeSpan.FromMinutes(config.GetValue<int>("CriteriaCache:L1ExpirationMinutes", 10));
            _l2Expiration = TimeSpan.FromMinutes(config.GetValue<int>("CriteriaCache:L2ExpirationMinutes", 30));
            _environment = config.GetValue<string>("CriteriaCache:Environment") ?? "default";

            // Initialize Cosmos DB (skip in test environment)
            if (!_isTestEnvironment)
            {
                var endpoint = config["CosmosDb:Endpoint"]
                    ?? throw new InvalidOperationException("Missing Cosmos DB endpoint config.");

                var tenantId = config["CosmosDb:TenantId"]
                    ?? throw new InvalidOperationException("Missing Cosmos DB tenant ID config.");

                var databaseName = config["CosmosDb:DatabaseName"]
                    ?? throw new InvalidOperationException("Missing Cosmos DB database name config.");

                var containerName = config["CosmosDb:ContainerName"] ?? "Games";

                var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
                {
                    TenantId = tenantId,
                });

                var client = new CosmosClient(endpoint, credential);
                _container = client.GetContainer(databaseName, containerName);
            }

            _logger.LogInformation(
                "GameSearchService initialized. Environment={Env}, L1={L1Min}min, L2={L2Min}min, Redis={RedisEnabled}",
                _environment,
                _l1Expiration.TotalMinutes,
                _l2Expiration.TotalMinutes,
                _redis != null);
        }

        /// <inheritdoc />
        public async Task<GameSearchResponse> SearchGamesAsync(string query, int maxResults = 5)
        {
            if (string.IsNullOrWhiteSpace(query) || query.Length < 3)
            {
                return new GameSearchResponse { Results = new List<GameSearchResult>(), TotalCount = 0 };
            }

            var normalizedQuery = NormalizeQuery(query);
            var cacheKey = GetSearchCacheKey(normalizedQuery);

            // Try L1 cache first
            if (_l1Cache.TryGetValue(cacheKey, out GameSearchResponse? cachedResult) && cachedResult != null)
            {
                _logger.LogDebug("Game search L1 cache hit for query: {Query}", query);
                TrackCacheHit("L1", "Search", query);
                return cachedResult;
            }

            // Try L2 cache (Redis)
            var l2Result = await GetFromL2CacheAsync<GameSearchResponse>(cacheKey);
            if (l2Result != null)
            {
                _logger.LogDebug("Game search L2 cache hit for query: {Query}", query);
                TrackCacheHit("L2", "Search", query);
                
                // Promote to L1
                _l1Cache.Set(cacheKey, l2Result, _l1Expiration);
                return l2Result;
            }

            // Cache miss - query Cosmos DB
            _logger.LogDebug("Game search cache miss for query: {Query}", query);
            TrackCacheMiss("Search", query);

            var result = await QueryGamesFromCosmosAsync(normalizedQuery, maxResults);

            // Store in both caches
            _l1Cache.Set(cacheKey, result, _l1Expiration);
            await SetInL2CacheAsync(cacheKey, result);

            return result;
        }

        /// <inheritdoc />
        public async Task<GameDetailsResponse?> GetGameDetailsAsync(string gameId)
        {
            if (string.IsNullOrWhiteSpace(gameId))
            {
                return null;
            }

            var cacheKey = GetDetailsCacheKey(gameId);

            // Try L1 cache first
            if (_l1Cache.TryGetValue(cacheKey, out GameDetailsResponse? cachedResult) && cachedResult != null)
            {
                _logger.LogDebug("Game details L1 cache hit for gameId: {GameId}", gameId);
                TrackCacheHit("L1", "Details", gameId);
                return cachedResult;
            }

            // Try L2 cache (Redis)
            var l2Result = await GetFromL2CacheAsync<GameDetailsResponse>(cacheKey);
            if (l2Result != null)
            {
                _logger.LogDebug("Game details L2 cache hit for gameId: {GameId}", gameId);
                TrackCacheHit("L2", "Details", gameId);
                
                // Promote to L1
                _l1Cache.Set(cacheKey, l2Result, _l1Expiration);
                return l2Result;
            }

            // Cache miss - query Cosmos DB
            _logger.LogDebug("Game details cache miss for gameId: {GameId}", gameId);
            TrackCacheMiss("Details", gameId);

            var result = await GetGameFromCosmosAsync(gameId);

            if (result != null)
            {
                // Store in both caches
                _l1Cache.Set(cacheKey, result, _l1Expiration);
                await SetInL2CacheAsync(cacheKey, result);
            }

            return result;
        }

        private async Task<GameSearchResponse> QueryGamesFromCosmosAsync(string normalizedQuery, int maxResults)
        {
            if (_isTestEnvironment || _container == null)
            {
                return GetTestSearchResults(normalizedQuery, maxResults);
            }

            try
            {
                // Query for games where name contains the search term, ordered by popularity
                var query = @"
                    SELECT c.id, c.name, c.imageUrl, c.averageRating, c.minPlayers, c.maxPlayers, c.numVotes
                    FROM c 
                    WHERE CONTAINS(LOWER(c.name), LOWER(@searchTerm))
                    ORDER BY c.numVotes DESC
                    OFFSET 0 LIMIT @maxResults";

                var queryDef = new QueryDefinition(query)
                    .WithParameter("@searchTerm", normalizedQuery)
                    .WithParameter("@maxResults", maxResults);

                var results = new List<GameSearchResult>();
                using var iterator = _container.GetItemQueryIterator<dynamic>(queryDef);

                while (iterator.HasMoreResults)
                {
                    var response = await iterator.ReadNextAsync();
                    foreach (var item in response)
                    {
                        results.Add(new GameSearchResult
                        {
                            Id = item.id?.ToString() ?? string.Empty,
                            Name = item.name?.ToString() ?? string.Empty,
                            ImageUrl = item.imageUrl?.ToString(),
                            AverageRating = item.averageRating != null ? (double)item.averageRating : 0,
                            MinPlayers = item.minPlayers != null ? (int)item.minPlayers : 0,
                            MaxPlayers = item.maxPlayers != null ? (int)item.maxPlayers : 0
                        });
                    }
                }

                _logger.LogInformation("Game search returned {Count} results for query: {Query}", results.Count, normalizedQuery);

                return new GameSearchResponse
                {
                    Results = results.Take(maxResults).ToList(),
                    TotalCount = results.Count
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching games for query: {Query}", normalizedQuery);
                throw;
            }
        }

        private async Task<GameDetailsResponse?> GetGameFromCosmosAsync(string gameId)
        {
            if (_isTestEnvironment || _container == null)
            {
                return GetTestGameDetails(gameId);
            }

            try
            {
                var query = "SELECT * FROM c WHERE c.id = @gameId";
                var queryDef = new QueryDefinition(query).WithParameter("@gameId", gameId);

                using var iterator = _container.GetItemQueryIterator<GameDocument>(queryDef);

                if (iterator.HasMoreResults)
                {
                    var response = await iterator.ReadNextAsync();
                    var game = response.FirstOrDefault();

                    if (game != null)
                    {
                        _logger.LogInformation("Retrieved game details for gameId: {GameId}, Name: {GameName}", gameId, game.name);
                        return MapToGameDetailsResponse(game);
                    }
                }

                _logger.LogWarning("Game not found for gameId: {GameId}", gameId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving game details for gameId: {GameId}", gameId);
                throw;
            }
        }

        private static GameDetailsResponse MapToGameDetailsResponse(GameDocument game)
        {
            return new GameDetailsResponse
            {
                Id = game.id,
                Name = game.name,
                ImageUrl = game.imageUrl,
                Overview = !string.IsNullOrEmpty(game.overview) ? game.overview : game.description,
                AverageRating = game.averageRating,
                BggRating = game.bggRating,
                NumVotes = game.numVotes,
                MinPlayers = game.minPlayers,
                MaxPlayers = game.maxPlayers,
                AgeRequirement = game.ageRequirement,
                RulesUrl = game.rulesUrl,
                MinPlaytime = game.minPlaytime,
                MaxPlaytime = game.maxPlaytime,
                YearPublished = game.yearPublished,
                Weight = game.weight,
                Mechanics = game.mechanics ?? new List<string>(),
                Categories = game.categories ?? new List<string>()
            };
        }

        #region Caching Helpers

        private string GetSearchCacheKey(string normalizedQuery)
        {
            return $"{SearchCachePrefix}:{_environment}:{CacheVersion}:{normalizedQuery}";
        }

        private string GetDetailsCacheKey(string gameId)
        {
            return $"{DetailsCachePrefix}:{_environment}:{CacheVersion}:{gameId}";
        }

        private static string NormalizeQuery(string query)
        {
            if (string.IsNullOrEmpty(query)) return string.Empty;
            
            // Lowercase, trim, and limit to 50 chars for cache key
            var normalized = query.ToLowerInvariant().Trim();
            return normalized.Length > 50 ? normalized.Substring(0, 50) : normalized;
        }

        private async Task<T?> GetFromL2CacheAsync<T>(string cacheKey) where T : class
        {
            if (_redis == null) return null;

            try
            {
                var db = _redis.GetDatabase();
                var value = await db.StringGetAsync(cacheKey);

                if (!value.HasValue || value.IsNullOrEmpty)
                {
                    return null;
                }

                return JsonSerializer.Deserialize<T>(value!);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error retrieving from L2 cache for key: {Key}", cacheKey);
                return null;
            }
        }

        private async Task SetInL2CacheAsync<T>(string cacheKey, T value)
        {
            if (_redis == null) return;

            try
            {
                var db = _redis.GetDatabase();
                var json = JsonSerializer.Serialize(value);
                await db.StringSetAsync(cacheKey, json, _l2Expiration);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error storing in L2 cache for key: {Key}", cacheKey);
            }
        }

        private void TrackCacheHit(string level, string operation, string key)
        {
            _telemetry?.TrackEvent($"GameSearch.{operation}.{level}Hit", new Dictionary<string, string>
            {
                ["Key"] = key.Length > 50 ? key.Substring(0, 50) : key
            });
        }

        private void TrackCacheMiss(string operation, string key)
        {
            _telemetry?.TrackEvent($"GameSearch.{operation}.CacheMiss", new Dictionary<string, string>
            {
                ["Key"] = key.Length > 50 ? key.Substring(0, 50) : key
            });
        }

        #endregion

        #region Test Data

        private static GameSearchResponse GetTestSearchResults(string query, int maxResults)
        {
            var testGames = new List<GameSearchResult>
            {
                new() { Id = "bgg-13", Name = "Catan", ImageUrl = "https://example.com/catan.jpg", AverageRating = 7.1, MinPlayers = 3, MaxPlayers = 4 },
                new() { Id = "bgg-822", Name = "Carcassonne", ImageUrl = "https://example.com/carcassonne.jpg", AverageRating = 7.4, MinPlayers = 2, MaxPlayers = 5 },
                new() { Id = "bgg-30549", Name = "Pandemic", ImageUrl = "https://example.com/pandemic.jpg", AverageRating = 7.6, MinPlayers = 2, MaxPlayers = 4 },
                new() { Id = "bgg-174430", Name = "Gloomhaven", ImageUrl = "https://example.com/gloomhaven.jpg", AverageRating = 8.7, MinPlayers = 1, MaxPlayers = 4 },
                new() { Id = "bgg-167791", Name = "Terraforming Mars", ImageUrl = "https://example.com/terraforming.jpg", AverageRating = 8.4, MinPlayers = 1, MaxPlayers = 5 }
            };

            var filtered = testGames
                .Where(g => g.Name.ToLowerInvariant().Contains(query.ToLowerInvariant()))
                .Take(maxResults)
                .ToList();

            return new GameSearchResponse { Results = filtered, TotalCount = filtered.Count };
        }

        private static GameDetailsResponse? GetTestGameDetails(string gameId)
        {
            if (gameId == "bgg-13")
            {
                return new GameDetailsResponse
                {
                    Id = "bgg-13",
                    Name = "Catan",
                    ImageUrl = "https://example.com/catan.jpg",
                    Overview = "In Catan, players try to be the dominant force on the island of Catan by building settlements, cities, and roads.",
                    AverageRating = 7.1,
                    BggRating = 7.0,
                    NumVotes = 98234,
                    MinPlayers = 3,
                    MaxPlayers = 4,
                    AgeRequirement = 10,
                    RulesUrl = "https://www.catan.com/understand-catan/game-rules",
                    MinPlaytime = 60,
                    MaxPlaytime = 120,
                    YearPublished = 1995,
                    Weight = 2.3,
                    Mechanics = new List<string> { "Dice Rolling", "Trading", "Route Building" },
                    Categories = new List<string> { "Strategy", "Family" }
                };
            }

            return null;
        }

        #endregion
    }
}
