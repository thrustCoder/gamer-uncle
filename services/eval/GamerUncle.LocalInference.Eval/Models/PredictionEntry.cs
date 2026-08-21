using GamerUncle.Shared.Models;

namespace GamerUncle.LocalInference.Eval.Models
{
    /// <summary>
    /// A predicted criteria extraction for a single gold entry, produced by some extractor
    /// (cloud gpt-4.1-mini today, on-device Qwen later). Joined to <see cref="GoldEntry"/> by <see cref="Id"/>.
    /// </summary>
    public class PredictionEntry
    {
        public string Id { get; set; } = default!;

        /// <summary>The criteria the extractor produced. Null means the extractor failed / returned nothing.</summary>
        public GameQueryCriteria? Predicted { get; set; }

        /// <summary>Where the prediction came from: "cloud" | "on-device" | null.</summary>
        public string? CriteriaSource { get; set; }

        /// <summary>Optional measured extraction latency in milliseconds (used by the report, not the score).</summary>
        public double? LatencyMs { get; set; }
    }
}
