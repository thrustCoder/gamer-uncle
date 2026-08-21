using GamerUncle.LocalInference.Eval.Models;

namespace GamerUncle.LocalInference.Eval.Extractors
{
    /// <summary>
    /// Abstraction over "something that turns a query into GameQueryCriteria". Phase 1 ships a
    /// deterministic replay extractor (reads pre-captured predictions). Phases 2/5 plug in the
    /// live cloud-mini extractor and the on-device Qwen extractor behind the same interface, so
    /// the scorer never changes.
    /// </summary>
    public interface ICriteriaExtractor
    {
        /// <summary>A short label describing this extractor, surfaced in the scorecard.</summary>
        string Label { get; }

        /// <summary>Produce a prediction for the given gold entry.</summary>
        Task<PredictionEntry> ExtractAsync(GoldEntry entry, CancellationToken ct = default);
    }
}
