using GamerUncle.LocalInference.Eval.Models;

namespace GamerUncle.LocalInference.Eval.Extractors
{
    /// <summary>
    /// Deterministic extractor that replays previously-captured predictions keyed by entry id.
    /// This keeps Phase 1 scoring reproducible and offline: predictions are generated once
    /// (e.g. from cloud gpt-4.1-mini) and committed alongside the gold set. If an entry has no
    /// captured prediction, it is reported as a null prediction (hard failure) rather than throwing,
    /// so partial capture files still score.
    /// </summary>
    public class ReplayExtractor : ICriteriaExtractor
    {
        private readonly Dictionary<string, PredictionEntry> _byId;

        public string Label { get; }

        public ReplayExtractor(string label, IEnumerable<PredictionEntry> predictions)
        {
            Label = label;
            _byId = new Dictionary<string, PredictionEntry>(StringComparer.Ordinal);
            foreach (var p in predictions)
            {
                if (!string.IsNullOrEmpty(p.Id))
                {
                    _byId[p.Id] = p;
                }
            }
        }

        public Task<PredictionEntry> ExtractAsync(GoldEntry entry, CancellationToken ct = default)
        {
            if (_byId.TryGetValue(entry.Id, out var prediction))
            {
                return Task.FromResult(prediction);
            }

            return Task.FromResult(new PredictionEntry
            {
                Id = entry.Id,
                Predicted = null,
                CriteriaSource = null
            });
        }
    }
}
