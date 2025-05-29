using System.Net.Http;
using System.Text.Json;
using GamerUncle.Api.Models;

namespace GamerUncle.Api.Services.ExternalGameData
{
    public class BoardGameAtlasAdapter : IBoardGameDataAdapter
    {
        private readonly HttpClient _httpClient;

        public BoardGameAtlasAdapter(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<List<BoardGameSearchResult>> SearchGamesAsync(string query)
        {
            var url = $"https://api.boardgameatlas.com/api/search?name={Uri.EscapeDataString(query)}&client_id=YOUR_CLIENT_ID";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var games = doc.RootElement.GetProperty("games");

            var results = new List<BoardGameSearchResult>();
            foreach (var game in games.EnumerateArray())
            {
                results.Add(new BoardGameSearchResult
                {
                    Name = game.GetProperty("name").GetString(),
                    MinPlayers = game.GetProperty("min_players").GetInt32(),
                    MaxPlayers = game.GetProperty("max_players").GetInt32(),
                    ImageUrl = game.GetProperty("image_url").GetString(),
                    Description = game.GetProperty("description").GetString()
                });
            }

            return results;
        }
    }
}
