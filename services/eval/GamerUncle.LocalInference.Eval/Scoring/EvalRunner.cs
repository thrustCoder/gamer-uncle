using GamerUncle.LocalInference.Eval.Extractors;
using GamerUncle.LocalInference.Eval.Models;
using GamerUncle.Shared.Models;

namespace GamerUncle.LocalInference.Eval.Scoring
{
    /// <summary>
    /// Orchestrates a full evaluation: runs an extractor over the gold set, scores each prediction
    /// (field agreement + recall@k), and aggregates into a <see cref="Scorecard"/>.
    /// </summary>
    public static class EvalRunner
    {
        public static async Task<Scorecard> RunAsync(
            IReadOnlyList<GoldEntry> gold,
            ICriteriaExtractor extractor,
            IReadOnlyList<GameDocument> games,
            int[]? ks = null,
            CancellationToken ct = default)
        {
            ks ??= RecallScorer.DefaultKs;

            var card = new Scorecard
            {
                ExtractorLabel = extractor.Label,
                EntryCount = gold.Count
            };

            var fieldAgreeCounts = CriteriaScorer.FieldNames.ToDictionary(f => f, _ => 0, StringComparer.Ordinal);
            var recallSums = ks.ToDictionary(k => k, _ => 0.0);
            var recallCounts = ks.ToDictionary(k => k, _ => 0);
            int exactMatches = 0;
            int nullPredictions = 0;
            int mechTp = 0, mechFp = 0, mechFn = 0;
            int catTp = 0, catFp = 0, catFn = 0;
            var latencies = new List<double>();

            foreach (var entry in gold)
            {
                ct.ThrowIfCancellationRequested();

                var prediction = await extractor.ExtractAsync(entry, ct);
                var fieldScore = CriteriaScorer.Score(entry.Gold, prediction.Predicted);
                var recall = RecallScorer.ScoreEntry(entry, prediction.Predicted, games, ks);

                if (fieldScore.PredictionWasNull) nullPredictions++;
                if (fieldScore.ExactMatch) exactMatches++;

                foreach (var f in CriteriaScorer.FieldNames)
                {
                    if (fieldScore.FieldAgreement.TryGetValue(f, out var agreed) && agreed)
                        fieldAgreeCounts[f]++;
                }

                mechTp += fieldScore.Mechanics.TruePositives;
                mechFp += fieldScore.Mechanics.FalsePositives;
                mechFn += fieldScore.Mechanics.FalseNegatives;
                catTp += fieldScore.Categories.TruePositives;
                catFp += fieldScore.Categories.FalsePositives;
                catFn += fieldScore.Categories.FalseNegatives;

                foreach (var k in ks)
                {
                    var v = recall[k];
                    if (!double.IsNaN(v))
                    {
                        recallSums[k] += v;
                        recallCounts[k]++;
                    }
                }

                if (prediction.LatencyMs.HasValue) latencies.Add(prediction.LatencyMs.Value);

                card.Entries.Add(new EntryScore
                {
                    Id = entry.Id,
                    Query = entry.Query,
                    ExactMatch = fieldScore.ExactMatch,
                    PredictionWasNull = fieldScore.PredictionWasNull,
                    FieldAgreement = fieldScore.FieldAgreement,
                    RecallAtK = recall
                });
            }

            int n = Math.Max(1, gold.Count);
            card.NullPredictionCount = nullPredictions;
            card.ExactMatchRate = (double)exactMatches / n;
            card.FieldAgreement = fieldAgreeCounts.ToDictionary(
                kv => kv.Key, kv => (double)kv.Value / n, StringComparer.Ordinal);
            card.Mechanics = BuildSetMetric(mechTp, mechFp, mechFn);
            card.Categories = BuildSetMetric(catTp, catFp, catFn);
            card.RecallAtK = ks.ToDictionary(
                k => k, k => recallCounts[k] == 0 ? double.NaN : recallSums[k] / recallCounts[k]);

            if (latencies.Count > 0)
            {
                card.Latency = new LatencySummary
                {
                    P50Ms = Percentile(latencies, 50),
                    P95Ms = Percentile(latencies, 95),
                    SampleCount = latencies.Count
                };
            }

            return card;
        }

        internal static SetMetric BuildSetMetric(int tp, int fp, int fn)
        {
            double precision = (tp + fp) == 0 ? 1.0 : (double)tp / (tp + fp);
            double recall = (tp + fn) == 0 ? 1.0 : (double)tp / (tp + fn);
            double f1 = (precision + recall) == 0 ? 0.0 : 2 * precision * recall / (precision + recall);
            return new SetMetric
            {
                Precision = precision,
                Recall = recall,
                F1 = f1,
                TruePositives = tp,
                FalsePositives = fp,
                FalseNegatives = fn
            };
        }

        internal static double Percentile(IReadOnlyList<double> values, double percentile)
        {
            if (values.Count == 0) return double.NaN;
            var sorted = values.OrderBy(v => v).ToList();
            if (sorted.Count == 1) return sorted[0];
            double rank = (percentile / 100.0) * (sorted.Count - 1);
            int low = (int)Math.Floor(rank);
            int high = (int)Math.Ceiling(rank);
            if (low == high) return sorted[low];
            double weight = rank - low;
            return sorted[low] + weight * (sorted[high] - sorted[low]);
        }
    }
}
