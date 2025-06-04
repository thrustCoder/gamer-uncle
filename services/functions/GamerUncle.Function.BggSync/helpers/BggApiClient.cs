using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using GamerUncle.Functions.Models;
using System.Collections.Generic;
using System.Xml.Linq;
using System.Linq;
using System.Text.RegularExpressions;

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
            try
            {
                #region mocked response
                // Parse the response here (mocked for simplicity)
                // In a real implementation, you would deserialize the XML response into a GameDocument object
                // var gameData = new GameDocument
                // {
                //     id = gameId,
                //     name = "Mocked Game Name",
                //     overview = "Mocked Overview",
                //     description = "Mocked Description",
                //     minPlayers = 1,
                //     maxPlayers = 4,
                //     minPlaytime = 30,
                //     maxPlaytime = 120,
                //     weight = 2.5,
                //     averageRating = 7.5,
                //     bggRating = 8.0,
                //     numVotes = 100,
                //     ageRequirement = 12,
                //     yearPublished = 2020,
                //     imageUrl = "http://example.com/image.jpg",
                //     shopLink = "http://example.com/shop",
                //     mechanics = new List<string> { "Strategy", "Cooperative" },
                //     categories = new List<string> { "Family", "Card Game" },
                //     setupGuide = "Mocked Setup Guide",
                //     rulesUrl = "http://example.com/rules",
                //     ruleQnA = new List<RuleQnA>(),
                //     moderatorScripts = new List<ModeratorScript>(),
                //     narrationTTS = new NarrationTTS()
                // };
                #endregion

                var response = await _httpClient.GetAsync($"https://www.boardgamegeek.com/xmlapi2/thing?id={gameId}&stats=1");
                response.EnsureSuccessStatusCode();

                var stream = await response.Content.ReadAsStreamAsync();
                var xml = XDocument.Load(stream);
                var item = xml.Root?.Element("item");
                if (item == null)
                    return null;

                var name = item.Elements("name")
                            .FirstOrDefault(e => e.Attribute("type")?.Value == "primary")?.Attribute("value")?.Value;
                var description = item.Element("description")?.Value ?? "";

                // Extract mechanics from link elements
                var mechanics = item.Elements("link")
                    .Where(e => e.Attribute("type")?.Value == "boardgamemechanic")
                    .Select(e => e.Attribute("value")?.Value)
                    .Where(v => !string.IsNullOrEmpty(v))
                    .ToList();

                // Extract categories from link elements
                var categories = item.Elements("link")
                    .Where(e => e.Attribute("type")?.Value == "boardgamecategory")
                    .Select(e => e.Attribute("value")?.Value)
                    .Where(v => !string.IsNullOrEmpty(v))
                    .ToList();

                // Extract weight (complexity rating)
                var weight = double.TryParse(item.Element("statistics")?
                    .Element("ratings")?
                    .Element("averageweight")?
                    .Attribute("value")?.Value, out var w) ? w : 0.0;

                // Generate BGG URLs with proper game name formatting
                var gameSlug = ConvertNameToBggSlug(name);
                var shopLink = $"https://boardgamegeek.com/boardgame/{gameId}/{gameSlug}/marketplace/stores";
                var rulesUrl = $"https://boardgamegeek.com/boardgame/{gameId}/{gameSlug}/files";

                var game = new GameDocument
                {
                    id = $"bgg-{gameId}", // Prefix with bgg- as per your model
                    name = name ?? "Unknown Game",
                    overview = !string.IsNullOrEmpty(description) ?
                        TruncateDescription(description, 200) : "", // Create overview from description
                    description = description,
                    yearPublished = int.TryParse(item.Element("yearpublished")?.Attribute("value")?.Value, out var y) ? y : 0,
                    minPlayers = int.TryParse(item.Element("minplayers")?.Attribute("value")?.Value, out var minP) ? minP : 0,
                    maxPlayers = int.TryParse(item.Element("maxplayers")?.Attribute("value")?.Value, out var maxP) ? maxP : 0,
                    minPlaytime = int.TryParse(item.Element("minplaytime")?.Attribute("value")?.Value, out var minT) ? minT : 0,
                    maxPlaytime = int.TryParse(item.Element("maxplaytime")?.Attribute("value")?.Value, out var maxT) ? maxT : 0,
                    ageRequirement = int.TryParse(item.Element("minage")?.Attribute("value")?.Value, out var age) ? age : 0,
                    imageUrl = item.Element("image")?.Value ?? "",
                    shopLink = shopLink,
                
                    // Ratings and stats
                    averageRating = double.TryParse(item.Element("statistics")?
                        .Element("ratings")?
                        .Element("average")?
                        .Attribute("value")?.Value, out var avgRating) ? avgRating : 0.0,

                    bggRating = double.TryParse(item.Element("statistics")?
                        .Element("ratings")?
                        .Element("bayesaverage")?
                        .Attribute("value")?.Value, out var bayes) ? bayes : 0.0,

                    numVotes = int.TryParse(item.Element("statistics")?
                        .Element("ratings")?
                        .Element("usersrated")?
                        .Attribute("value")?.Value, out var votes) ? votes : 0,

                    // Enhanced properties
                    weight = weight,
                    mechanics = mechanics,
                    categories = categories,
                    setupGuide = GenerateSetupGuide(name, minP, maxP, minT, maxT, age),
                    rulesUrl = rulesUrl,
                    ruleQnA = new List<RuleQnA>(), // Empty for now - would need additional API calls
                    moderatorScripts = new List<ModeratorScript>(), // Empty for now - custom content
                    narrationTTS = null // Empty for now - custom content
                };

                return game;
            }
            catch (System.Xml.XmlException ex)
            {
                Console.WriteLine($"XML parsing error for game ID {gameId}: {ex.Message}");
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching game data for ID {gameId}: {ex.Message}");
                return null;
            }
        }

        private string TruncateDescription(string description, int maxLength)
        {
            if (string.IsNullOrEmpty(description) || description.Length <= maxLength)
                return description;

            // Remove HTML tags for overview
            var cleanText = System.Text.RegularExpressions.Regex.Replace(description, "<.*?>", "");

            if (cleanText.Length <= maxLength)
                return cleanText;

            // Find the last sentence that fits
            var sentences = cleanText.Split('.', '!', '?');
            var result = "";

            foreach (var sentence in sentences)
            {
                if ((result + sentence + ".").Length > maxLength)
                    break;
                result += sentence + ".";
            }

            return result.TrimEnd('.');
        }

        private string GenerateSetupGuide(string? gameName, int minPlayers, int maxPlayers,
            int minPlaytime, int maxPlaytime, int ageRequirement)
        {
            var guide = $"Setup Guide for {gameName ?? "this game"}:\n\n";
            guide += $"• Players: {minPlayers}-{maxPlayers}\n";
            guide += $"• Playtime: {minPlaytime}-{maxPlaytime} minutes\n";
            guide += $"• Age: {ageRequirement}+\n\n";
            guide += "For detailed setup instructions, please refer to the official rulebook or visit BoardGameGeek for community resources.";

            return guide;
        }

        private string ConvertNameToBggSlug(string? gameName)
        {
            if (string.IsNullOrEmpty(gameName))
                return "unknown-game";

            // Convert to lowercase
            var slug = gameName.ToLowerInvariant();

            // Replace common Unicode characters with ASCII equivalents
            slug = slug
                .Replace("ä", "a").Replace("à", "a").Replace("á", "a").Replace("â", "a").Replace("ã", "a").Replace("å", "a")
                .Replace("ö", "o").Replace("ò", "o").Replace("ó", "o").Replace("ô", "o").Replace("õ", "o")
                .Replace("ü", "u").Replace("ù", "u").Replace("ú", "u").Replace("û", "u")
                .Replace("ë", "e").Replace("è", "e").Replace("é", "e").Replace("ê", "e")
                .Replace("ï", "i").Replace("ì", "i").Replace("í", "i").Replace("î", "i")
                .Replace("ç", "c").Replace("ñ", "n").Replace("ß", "ss")
                .Replace("æ", "ae").Replace("œ", "oe");

            // Remove special characters except spaces, numbers, and letters
            slug = Regex.Replace(slug, @"[^a-z0-9\s]", "");

            // Replace multiple spaces with single space
            slug = Regex.Replace(slug, @"\s+", " ");

            // Trim and replace spaces with hyphens
            slug = slug.Trim().Replace(" ", "-");

            // Remove any trailing or leading hyphens
            slug = slug.Trim('-');

            return slug;
        }
    }
}