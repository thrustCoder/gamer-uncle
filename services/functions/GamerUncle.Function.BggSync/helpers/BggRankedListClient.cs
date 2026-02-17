using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace GamerUncle.Functions.Helpers
{
    /// <summary>
    /// Fetches ranked board game IDs from BGG's browse pages.
    /// Each page at boardgamegeek.com/browse/boardgame/page/{N} contains ~100 ranked games.
    /// </summary>
    public class BggRankedListClient
    {
        private readonly HttpClient _httpClient;

        // Matches links like /boardgame/174430/brass-birmingham — captures the numeric game ID
        private static readonly Regex GameIdRegex = new Regex(
            @"/boardgame/(\d+)/", RegexOptions.Compiled);

        public BggRankedListClient(HttpClient httpClient)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        }

        /// <summary>
        /// Fetches a single BGG browse page and extracts board game IDs.
        /// Each page contains up to 100 ranked games sorted by BGG rank.
        /// </summary>
        /// <param name="pageNumber">The page number (1-based) to fetch.</param>
        /// <returns>A list of unique BGG game IDs found on the page, in rank order.</returns>
        public async Task<List<string>> FetchRankedGameIdsAsync(int pageNumber)
        {
            if (pageNumber < 1)
            {
                throw new ArgumentOutOfRangeException(nameof(pageNumber), "Page number must be >= 1");
            }

            var url = $"https://boardgamegeek.com/browse/boardgame/page/{pageNumber}";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "GamerUncle-BggSync/1.0 (board game assistant)");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var html = await response.Content.ReadAsStringAsync();
            return ParseGameIdsFromHtml(html);
        }

        /// <summary>
        /// Extracts unique board game IDs from BGG browse page HTML.
        /// Matches links in the format /boardgame/{id}/{slug}.
        /// </summary>
        internal static List<string> ParseGameIdsFromHtml(string html)
        {
            if (string.IsNullOrEmpty(html))
            {
                return new List<string>();
            }

            var matches = GameIdRegex.Matches(html);
            var gameIds = matches
                .Select(m => m.Groups[1].Value)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();

            return gameIds;
        }
    }
}
