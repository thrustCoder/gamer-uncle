using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using GamerUncle.Functions.Models;
using System.Collections.Generic;

namespace GamerUncle.Functions.Helpers
{
    public class BggApiClient
    {
        private readonly HttpClient _httpClient;

        public BggApiClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<GameDocument> FetchGameDataAsync(string gameId)
        {
            var response = await _httpClient.GetAsync($"https://www.boardgamegeek.com/xmlapi2/thing?id={gameId}&stats=1");
            response.EnsureSuccessStatusCode();

            // Parse the response here (mocked for simplicity)
            // In a real implementation, you would deserialize the XML response into a GameDocument object
            var gameData = new GameDocument
            {
                id = gameId,
                name = "Mocked Game Name",
                overview = "Mocked Overview",
                description = "Mocked Description",
                minPlayers = 1,
                maxPlayers = 4,
                minPlaytime = 30,
                maxPlaytime = 120,
                weight = 2.5,
                averageRating = 7.5,
                bggRating = 8.0,
                numVotes = 100,
                ageRequirement = 12,
                yearPublished = 2020,
                imageUrl = "http://example.com/image.jpg",
                shopLink = "http://example.com/shop",
                mechanics = new List<string> { "Strategy", "Cooperative" },
                categories = new List<string> { "Family", "Card Game" },
                setupGuide = "Mocked Setup Guide",
                rulesUrl = "http://example.com/rules",
                ruleQnA = new List<RuleQnA>(),
                moderatorScripts = new List<ModeratorScript>(),
                narrationTTS = new NarrationTTS()
            };

            return gameData;
        }
    }
}