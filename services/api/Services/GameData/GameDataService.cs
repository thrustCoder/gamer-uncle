using Azure.Identity;
using Microsoft.Azure.Cosmos;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.GameData
{
    public class GameDataService : IGameDataService
    {
        private readonly Container? _container;
        private readonly ILogger<GameDataService> _logger;
        private readonly bool _isTestEnvironment;

        public GameDataService(IConfiguration config, ILogger<GameDataService> logger, IWebHostEnvironment environment)
        {
            _logger = logger;
            _isTestEnvironment = environment.EnvironmentName.Equals("Testing", StringComparison.OrdinalIgnoreCase) 
                               || config.GetValue<bool>("Testing:DisableRateLimit")
                               || Environment.GetEnvironmentVariable("TEST_ENVIRONMENT") == "Testing";

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
            else
            {
                _logger.LogInformation("Running in test environment - using mock game data");
            }
        }

        public async Task<GameDocument?> GetGameForVoiceSessionAsync(string gameId)
        {
            try
            {
                _logger.LogInformation("Retrieving game data for voice session. GameId: {GameId}", gameId);

                if (_isTestEnvironment)
                {
                    return GetTestGameDocument(gameId);
                }

                if (_container == null)
                {
                    throw new InvalidOperationException("Cosmos container not initialized for non-test environment");
                }

                var query = "SELECT * FROM c WHERE c.id = @gameId";
                var queryDef = new QueryDefinition(query).WithParameter("@gameId", gameId);

                using var iterator = _container.GetItemQueryIterator<GameDocument>(queryDef);
                
                if (iterator.HasMoreResults)
                {
                    var response = await iterator.ReadNextAsync();
                    var game = response.FirstOrDefault();
                    
                    if (game != null)
                    {
                        _logger.LogInformation("Successfully retrieved game data for voice session. GameId: {GameId}, GameName: {GameName}", 
                            gameId, game.name);
                        return game;
                    }
                }

                _logger.LogWarning("Game not found for voice session. GameId: {GameId}", gameId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving game data for voice session. GameId: {GameId}", gameId);
                throw;
            }
        }

        public async Task<bool> ValidateGameForVoiceSessionAsync(string gameId)
        {
            try
            {
                _logger.LogInformation("Validating game for voice session. GameId: {GameId}", gameId);

                if (_isTestEnvironment)
                {
                    // In test environment, validate against known test games
                    var testGame = GetTestGameDocument(gameId);
                    var testGameIsValid = testGame != null;
                    _logger.LogInformation("Test game validation result. GameId: {GameId}, IsValid: {IsValid}", gameId, testGameIsValid);
                    return testGameIsValid;
                }

                // Check if game exists
                var game = await GetGameForVoiceSessionAsync(gameId);
                
                if (game == null)
                {
                    _logger.LogWarning("Game validation failed - game not found. GameId: {GameId}", gameId);
                    return false;
                }

                // Validate game has minimum required data for voice sessions
                var isValid = !string.IsNullOrWhiteSpace(game.name) && 
                             game.minPlayers > 0 && 
                             game.maxPlayers > 0;

                _logger.LogInformation("Game validation result. GameId: {GameId}, IsValid: {IsValid}", gameId, isValid);
                return isValid;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating game for voice session. GameId: {GameId}", gameId);
                return false; // Return false on error for safety
            }
        }

        private GameDocument? GetTestGameDocument(string gameId)
        {
            // Return test game data for known test game IDs
            return gameId switch
            {
                "bgg-224517" => new GameDocument
                {
                    id = "bgg-224517",
                    name = "Brass: Birmingham",
                    minPlayers = 2,
                    maxPlayers = 4,
                    setupGuide = "Each player starts with £17 and 2 cards. Place the market tiles and set up the canal/rail eras.",
                    rulesUrl = "https://boardgamegeek.com/boardgame/224517/brass-birmingham/files",
                    mechanics = new List<string> { "Network Building", "Economic", "Hand Management", "Route Building" },
                    moderatorScripts = new List<ModeratorScript>
                    {
                        new ModeratorScript
                        {
                            language = "en",
                            script = "Welcome to Brass: Birmingham! This economic strategy game focuses on coal, iron, and beer production during the Industrial Revolution."
                        }
                    }
                },
                "bgg-invalid-game-id" => null, // Explicitly return null for invalid test game
                _ => null // Return null for unknown game IDs
            };
        }
    }
}