using GamerUncle.LocalInference.Eval.Models;
using GamerUncle.Shared.Models;

namespace GamerUncle.LocalInference.Eval.Scoring
{
    /// <summary>
    /// Computes recall@k: of the games the gold criteria considers relevant, how many appear in the
    /// top-k results retrieved using the <em>predicted</em> criteria. This captures the plan's
    /// "recall@k change in returned games" — i.e. whether a slightly-wrong extraction still surfaces
    /// the right games. Retrieval is ranked exactly like the app (rating desc) via <see cref="CriteriaMatcher"/>.
    /// </summary>
    public static class RecallScorer
    {
        public static readonly int[] DefaultKs = { 1, 3, 5, 10 };

        /// <summary>
        /// Relevant set for an entry: the explicit gold game ids when provided, otherwise every game
        /// matched by the gold criteria against the snapshot.
        /// </summary>
        public static HashSet<string> RelevantSet(GoldEntry entry, IReadOnlyList<GameDocument> games)
        {
            if (entry.ExpectedGameIds is { Count: > 0 })
            {
                return new HashSet<string>(entry.ExpectedGameIds, StringComparer.Ordinal);
            }

            return CriteriaMatcher.Match(entry.Gold, games)
                .Select(g => g.id)
                .ToHashSet(StringComparer.Ordinal);
        }

        /// <summary>
        /// Recall@k for one entry, keyed by k. Returns <see cref="double.NaN"/> for every k when the
        /// entry has no relevant games (undefined recall — excluded from the aggregate mean).
        /// </summary>
        public static Dictionary<int, double> ScoreEntry(
            GoldEntry entry,
            GameQueryCriteria? predicted,
            IReadOnlyList<GameDocument> games,
            IEnumerable<int>? ks = null)
        {
            var kList = (ks ?? DefaultKs).Distinct().OrderBy(k => k).ToList();
            var relevant = RelevantSet(entry, games);

            var result = new Dictionary<int, double>();
            if (relevant.Count == 0)
            {
                foreach (var k in kList) result[k] = double.NaN;
                return result;
            }

            var retrieved = predicted == null
                ? new List<string>()
                : CriteriaMatcher.MatchRanked(predicted, games).Select(g => g.id).ToList();

            foreach (var k in kList)
            {
                var topK = retrieved.Take(k);
                int hits = topK.Count(relevant.Contains);
                result[k] = (double)hits / relevant.Count;
            }

            return result;
        }
    }
}
