using System.Globalization;
using System.Text;
using GamerUncle.LocalInference.Eval.Models;

namespace GamerUncle.LocalInference.Eval
{
    /// <summary>Renders a <see cref="Scorecard"/> as a human-readable Markdown summary.</summary>
    public static class ReportWriter
    {
        public static string ToMarkdown(Scorecard card)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"# Criteria Extraction Scorecard — {card.ExtractorLabel}");
            sb.AppendLine();
            sb.AppendLine($"- Entries: **{card.EntryCount}**");
            sb.AppendLine($"- Null predictions (hard failures): **{card.NullPredictionCount}**");
            sb.AppendLine($"- Exact-match rate (all 10 fields): **{Pct(card.ExactMatchRate)}**");
            if (card.Latency != null)
            {
                sb.AppendLine($"- Extraction latency: p50 **{card.Latency.P50Ms:F0} ms**, " +
                              $"p95 **{card.Latency.P95Ms:F0} ms** (n={card.Latency.SampleCount})");
            }
            sb.AppendLine();

            sb.AppendLine("## Per-field agreement");
            sb.AppendLine();
            sb.AppendLine("| Field | Agreement |");
            sb.AppendLine("|---|---|");
            foreach (var field in Scoring.CriteriaScorer.FieldNames)
            {
                var v = card.FieldAgreement.TryGetValue(field, out var rate) ? Pct(rate) : "-";
                sb.AppendLine($"| {field} | {v} |");
            }
            sb.AppendLine();

            sb.AppendLine("## Array fields (micro precision / recall / F1)");
            sb.AppendLine();
            sb.AppendLine("| Field | Precision | Recall | F1 | TP | FP | FN |");
            sb.AppendLine("|---|---|---|---|---|---|---|");
            AppendSet(sb, "Mechanics", card.Mechanics);
            AppendSet(sb, "Categories", card.Categories);
            sb.AppendLine();

            sb.AppendLine("## Recall@k (predicted retrieval vs gold-relevant games)");
            sb.AppendLine();
            sb.AppendLine("| k | Mean recall |");
            sb.AppendLine("|---|---|");
            foreach (var kv in card.RecallAtK.OrderBy(x => x.Key))
            {
                sb.AppendLine($"| {kv.Key} | {(double.IsNaN(kv.Value) ? "n/a" : Pct(kv.Value))} |");
            }
            sb.AppendLine();

            return sb.ToString();
        }

        private static void AppendSet(StringBuilder sb, string name, SetMetric m)
        {
            sb.AppendLine($"| {name} | {Pct(m.Precision)} | {Pct(m.Recall)} | {Pct(m.F1)} | " +
                          $"{m.TruePositives} | {m.FalsePositives} | {m.FalseNegatives} |");
        }

        private static string Pct(double v) =>
            double.IsNaN(v) ? "n/a" : (v * 100).ToString("F1", CultureInfo.InvariantCulture) + "%";
    }
}
