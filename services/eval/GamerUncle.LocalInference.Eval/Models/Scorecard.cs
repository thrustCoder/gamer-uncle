namespace GamerUncle.LocalInference.Eval.Models
{
    /// <summary>Aggregated scorecard for one extractor run over the gold set.</summary>
    public class Scorecard
    {
        /// <summary>Human label for the extractor being scored (e.g. "cloud-mini-baseline").</summary>
        public string ExtractorLabel { get; set; } = default!;

        /// <summary>Number of gold entries scored.</summary>
        public int EntryCount { get; set; }

        /// <summary>Number of entries where the extractor produced no criteria at all (hard failure).</summary>
        public int NullPredictionCount { get; set; }

        /// <summary>Fraction of entries where all 10 fields agreed with gold.</summary>
        public double ExactMatchRate { get; set; }

        /// <summary>Per-field agreement rate, keyed by field name.</summary>
        public Dictionary<string, double> FieldAgreement { get; set; } = new();

        /// <summary>Micro-averaged precision/recall/F1 for the Mechanics array across all entries.</summary>
        public SetMetric Mechanics { get; set; } = new();

        /// <summary>Micro-averaged precision/recall/F1 for the Categories array across all entries.</summary>
        public SetMetric Categories { get; set; } = new();

        /// <summary>Mean recall@k of predicted-criteria retrieval vs the gold-relevant game set, keyed by k.</summary>
        public Dictionary<int, double> RecallAtK { get; set; } = new();

        /// <summary>Optional latency summary when predictions carry LatencyMs.</summary>
        public LatencySummary? Latency { get; set; }

        /// <summary>Per-entry detail, useful for drilling into disagreements.</summary>
        public List<EntryScore> Entries { get; set; } = new();
    }

    /// <summary>Micro-averaged set metric (precision/recall/F1) over array-valued fields.</summary>
    public class SetMetric
    {
        public double Precision { get; set; }
        public double Recall { get; set; }
        public double F1 { get; set; }

        // Raw micro counts, retained for auditability.
        public int TruePositives { get; set; }
        public int FalsePositives { get; set; }
        public int FalseNegatives { get; set; }
    }

    /// <summary>Latency percentiles (only populated when predictions include LatencyMs).</summary>
    public class LatencySummary
    {
        public double P50Ms { get; set; }
        public double P95Ms { get; set; }
        public int SampleCount { get; set; }
    }

    /// <summary>Per-entry scoring detail.</summary>
    public class EntryScore
    {
        public string Id { get; set; } = default!;
        public string Query { get; set; } = default!;
        public bool ExactMatch { get; set; }
        public bool PredictionWasNull { get; set; }

        /// <summary>Field name -> agreed? for this entry.</summary>
        public Dictionary<string, bool> FieldAgreement { get; set; } = new();

        /// <summary>Recall@k for this entry, keyed by k (NaN when the entry has no relevant games).</summary>
        public Dictionary<int, double> RecallAtK { get; set; } = new();
    }
}
