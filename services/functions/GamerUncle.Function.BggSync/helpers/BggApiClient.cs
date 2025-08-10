using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Xml.Linq;
using System.Linq;
using System.Text.RegularExpressions;
using GamerUncle.Shared.Models;

namespace GamerUncle.Functions.Helpers
{
    public class BggApiClient
    {
        private readonly HttpClient _httpClient;

        public BggApiClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<GameDocument?> FetchGameDataAsync(string gameId)
        {
            try
            {
                var response = await _httpClient.GetAsync($"https://www.boardgamegeek.com/xmlapi2/thing?id={gameId}&stats=1");
                response.EnsureSuccessStatusCode();

                var stream = await response.Content.ReadAsStreamAsync();
                var xml = XDocument.Load(stream);
                var item = xml.Root?.Element("item");
                if (item == null)
                    return null;

                // Only accept base games (exclude expansions and other subtypes)
                var type = item.Attribute("type")?.Value;
                if (!string.Equals(type, "boardgame", StringComparison.OrdinalIgnoreCase))
                {
                    return null;
                }

                var name = item.Elements("name")
                            .FirstOrDefault(e => e.Attribute("type")?.Value == "primary")?.Attribute("value")?.Value;
                var description = item.Element("description")?.Value ?? string.Empty;

                // Extract mechanics from link elements (non-null strings)
                var mechanics = item.Elements("link")
                    .Where(e => e.Attribute("type")?.Value == "boardgamemechanic")
                    .Select(e => e.Attribute("value")?.Value)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Select(v => v!)
                    .ToList();

                // Extract categories from link elements (non-null strings)
                var categories = item.Elements("link")
                    .Where(e => e.Attribute("type")?.Value == "boardgamecategory")
                    .Select(e => e.Attribute("value")?.Value)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Select(v => v!)
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
                    id = $"bgg-{gameId}",
                    name = name ?? "Unknown Game",
                    overview = !string.IsNullOrEmpty(description) ? TruncateDescription(description, 200) : string.Empty,
                    description = description,
                    yearPublished = int.TryParse(item.Element("yearpublished")?.Attribute("value")?.Value, out var y) ? y : 0,
                    minPlayers = int.TryParse(item.Element("minplayers")?.Attribute("value")?.Value, out var minP) ? minP : 0,
                    maxPlayers = int.TryParse(item.Element("maxplayers")?.Attribute("value")?.Value, out var maxP) ? maxP : 0,
                    minPlaytime = int.TryParse(item.Element("minplaytime")?.Attribute("value")?.Value, out var minT) ? minT : 0,
                    maxPlaytime = int.TryParse(item.Element("maxplaytime")?.Attribute("value")?.Value, out var maxT) ? maxT : 0,
                    ageRequirement = int.TryParse(item.Element("minage")?.Attribute("value")?.Value, out var age) ? age : 0,
                    imageUrl = item.Element("image")?.Value ?? string.Empty,
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
                    ruleQnA = new List<RuleQnA>(),
                    moderatorScripts = new List<ModeratorScript>(),
                    narrationTTS = null
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

            var cleanText = System.Text.RegularExpressions.Regex.Replace(description, "<.*?>", "");

            if (cleanText.Length <= maxLength)
                return cleanText;

            var sentences = cleanText.Split('.', '!', '?');
            var result = string.Empty;

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

            var slug = gameName.ToLowerInvariant();

            slug = Regex.Replace(slug, @"[^a-z0-9\s]", "");
            slug = Regex.Replace(slug, @"\s+", " ");
            slug = slug.Trim().Replace(" ", "-");
            slug = slug.Trim('-');

            return slug;
        }
    }
}