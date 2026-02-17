using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace GamerUncle.Functions.Helpers
{
    /// <summary>
    /// Discovers board game IDs by batch-querying BGG's XML API v2.
    /// Each "page" covers a range of sequential BGG IDs, queried in batches of 20.
    /// Returns IDs of existing base games that pass quality filters (votes, rating).
    /// This avoids scraping BGG's website HTML, which has aggressive bot protection.
    /// </summary>
    public class BggRankedListClient
    {
        private readonly HttpClient _httpClient;
        private const int MaxRetries = 3;

        /// <summary>How many BGG IDs to request per XML API call. BGG supports up to ~20.</summary>
        internal const int BatchSize = 20;

        /// <summary>Number of sequential BGG IDs to scan per page. Default 4100 → 70 pages covers ~287k IDs.</summary>
        public int IdsPerPage { get; set; } = 4100;

        /// <summary>Minimum number of user votes for a game to qualify.</summary>
        public int MinVotes { get; set; } = 50;

        /// <summary>Minimum average rating for a game to qualify.</summary>
        public double MinAverage { get; set; } = 5.0;

        public BggRankedListClient(HttpClient httpClient)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        }

        /// <summary>
        /// Fetches a "page" of qualifying game IDs by batch-querying a range of sequential
        /// BGG IDs via the XML API v2 (xmlapi2/thing?id=...&amp;stats=1).
        /// Returns IDs of base games with enough votes and a good enough average rating.
        /// </summary>
        /// <param name="pageNumber">The page number (1-based). Maps to an ID range based on IdsPerPage.</param>
        /// <returns>A list of qualifying BGG game IDs found in this ID range.</returns>
        public async Task<List<string>> FetchRankedGameIdsAsync(int pageNumber)
        {
            if (pageNumber < 1)
            {
                throw new ArgumentOutOfRangeException(nameof(pageNumber), "Page number must be >= 1");
            }

            int startId = (pageNumber - 1) * IdsPerPage + 1;
            int endId = startId + IdsPerPage - 1;

            var qualifiedIds = new List<string>();

            for (int batchStart = startId; batchStart <= endId; batchStart += BatchSize)
            {
                int batchEnd = Math.Min(batchStart + BatchSize - 1, endId);
                var idList = string.Join(",", Enumerable.Range(batchStart, batchEnd - batchStart + 1));

                var batchIds = await FetchBatchWithRetryAsync(idList, batchStart);
                qualifiedIds.AddRange(batchIds);

                // Delay between batches to be polite to BGG (500ms)
                if (batchStart + BatchSize <= endId)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(500));
                }
            }

            return qualifiedIds;
        }

        /// <summary>
        /// Queries the BGG XML API for a batch of IDs with retry + exponential backoff.
        /// Returns an empty list on persistent failure (does not throw).
        /// </summary>
        internal async Task<List<string>> FetchBatchWithRetryAsync(string idList, int batchStart)
        {
            var url = $"https://www.boardgamegeek.com/xmlapi2/thing?id={idList}&stats=1";
            Exception? lastException = null;

            for (int attempt = 0; attempt <= MaxRetries; attempt++)
            {
                if (attempt > 0)
                {
                    // Exponential backoff: 2s, 4s, 8s
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                    await Task.Delay(delay);
                }

                try
                {
                    var response = await _httpClient.GetAsync(url);

                    // Retry on server errors and rate limiting
                    if (response.StatusCode == HttpStatusCode.TooManyRequests ||
                        (int)response.StatusCode >= 500)
                    {
                        lastException = new HttpRequestException(
                            $"BGG returned {response.StatusCode} for batch starting at {batchStart}");
                        continue;
                    }

                    // BGG returns 202 Accepted when XML API is busy — retry
                    if (response.StatusCode == HttpStatusCode.Accepted)
                    {
                        lastException = new HttpRequestException(
                            $"BGG returned 202 (busy) for batch starting at {batchStart}");
                        continue;
                    }

                    response.EnsureSuccessStatusCode();

                    var stream = await response.Content.ReadAsStreamAsync();
                    var xml = XDocument.Load(stream);

                    return ParseQualifiedGameIds(xml);
                }
                catch (HttpRequestException ex) when (attempt < MaxRetries)
                {
                    lastException = ex;
                    continue;
                }
                catch (TaskCanceledException ex) when (attempt < MaxRetries)
                {
                    lastException = ex;
                    continue;
                }
            }

            // Return empty on persistent failure — orchestrator will skip this batch
            return new List<string>();
        }

        /// <summary>
        /// Parses the BGG XML API response and returns IDs of base games that pass quality filters.
        /// Filters for: type=boardgame, usersrated >= MinVotes, average >= MinAverage.
        /// </summary>
        internal List<string> ParseQualifiedGameIds(XDocument xml)
        {
            if (xml?.Root == null)
            {
                return new List<string>();
            }

            var ids = new List<string>();

            foreach (var item in xml.Root.Elements("item"))
            {
                // Only base games, not expansions
                var type = item.Attribute("type")?.Value;
                if (!string.Equals(type, "boardgame", StringComparison.OrdinalIgnoreCase))
                    continue;

                var id = item.Attribute("id")?.Value;
                if (string.IsNullOrWhiteSpace(id))
                    continue;

                // Check quality filters from stats
                var ratings = item.Element("statistics")?.Element("ratings");
                if (ratings == null) continue;

                var usersRatedStr = ratings.Element("usersrated")?.Attribute("value")?.Value;
                var averageStr = ratings.Element("average")?.Attribute("value")?.Value;

                if (int.TryParse(usersRatedStr, out var votes) && votes >= MinVotes &&
                    double.TryParse(averageStr, NumberStyles.Float, CultureInfo.InvariantCulture, out var avg) && avg >= MinAverage)
                {
                    ids.Add(id);
                }
            }

            return ids;
        }
    }
}
