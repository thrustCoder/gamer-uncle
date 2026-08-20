using System.Globalization;
using GamerUncle.LocalInference.Eval.Models;
using GamerUncle.Shared.Models;

namespace GamerUncle.LocalInference.Eval.Scoring
{
    /// <summary>
    /// Scores a predicted <see cref="GameQueryCriteria"/> against a gold one, field by field,
    /// across the 10 fields of the schema. Scalars use null-aware exact equality; doubles use a
    /// tolerance (fuzzy words map to approximate numbers upstream); arrays are compared as
    /// normalized sets and also emit micro precision/recall counts.
    /// </summary>
    public static class CriteriaScorer
    {
        /// <summary>Tolerance for MaxWeight / averageRating agreement (both are coarse mappings from language).</summary>
        public const double DoubleTolerance = 0.25;

        /// <summary>Canonical ordered list of the scored field names.</summary>
        public static readonly IReadOnlyList<string> FieldNames = new[]
        {
            nameof(GameQueryCriteria.name),
            nameof(GameQueryCriteria.MinPlayers),
            nameof(GameQueryCriteria.MaxPlayers),
            nameof(GameQueryCriteria.MinPlaytime),
            nameof(GameQueryCriteria.MaxPlaytime),
            nameof(GameQueryCriteria.Mechanics),
            nameof(GameQueryCriteria.Categories),
            nameof(GameQueryCriteria.MaxWeight),
            nameof(GameQueryCriteria.averageRating),
            nameof(GameQueryCriteria.ageRequirement),
        };

        public static FieldScoreResult Score(GameQueryCriteria gold, GameQueryCriteria? predicted)
        {
            // A null prediction disagrees on every field.
            var pred = predicted ?? new GameQueryCriteria();

            var agreement = new Dictionary<string, bool>(StringComparer.Ordinal)
            {
                [nameof(GameQueryCriteria.name)] = NameAgree(gold.name, pred.name),
                [nameof(GameQueryCriteria.MinPlayers)] = IntAgree(gold.MinPlayers, pred.MinPlayers),
                [nameof(GameQueryCriteria.MaxPlayers)] = IntAgree(gold.MaxPlayers, pred.MaxPlayers),
                [nameof(GameQueryCriteria.MinPlaytime)] = IntAgree(gold.MinPlaytime, pred.MinPlaytime),
                [nameof(GameQueryCriteria.MaxPlaytime)] = IntAgree(gold.MaxPlaytime, pred.MaxPlaytime),
                [nameof(GameQueryCriteria.MaxWeight)] = DoubleAgree(gold.MaxWeight, pred.MaxWeight),
                [nameof(GameQueryCriteria.averageRating)] = DoubleAgree(gold.averageRating, pred.averageRating),
                [nameof(GameQueryCriteria.ageRequirement)] = IntAgree(gold.ageRequirement, pred.ageRequirement),
            };

            var mechanics = SetCounts(gold.Mechanics, pred.Mechanics);
            var categories = SetCounts(gold.Categories, pred.Categories);
            agreement[nameof(GameQueryCriteria.Mechanics)] = mechanics.ExactMatch;
            agreement[nameof(GameQueryCriteria.Categories)] = categories.ExactMatch;

            bool exact = predicted != null && agreement.Values.All(v => v);

            return new FieldScoreResult
            {
                FieldAgreement = agreement,
                ExactMatch = exact,
                PredictionWasNull = predicted == null,
                Mechanics = mechanics,
                Categories = categories
            };
        }

        internal static bool NameAgree(string? a, string? b)
        {
            var na = NormalizeName(a);
            var nb = NormalizeName(b);
            if (na == null && nb == null) return true;
            if (na == null || nb == null) return false;
            return string.Equals(na, nb, StringComparison.Ordinal);
        }

        internal static bool IntAgree(int? a, int? b) => a == b;

        internal static bool DoubleAgree(double? a, double? b)
        {
            if (!a.HasValue && !b.HasValue) return true;
            if (!a.HasValue || !b.HasValue) return false;
            return Math.Abs(a.Value - b.Value) <= DoubleTolerance;
        }

        internal static string? NormalizeName(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var collapsed = string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            return collapsed.ToLower(CultureInfo.InvariantCulture);
        }

        internal static string NormalizeTerm(string value) =>
            value.Trim().ToLower(CultureInfo.InvariantCulture);

        internal static HashSet<string> NormalizeSet(string[]? values)
        {
            var set = new HashSet<string>(StringComparer.Ordinal);
            if (values == null) return set;
            foreach (var v in values)
            {
                if (string.IsNullOrWhiteSpace(v)) continue;
                set.Add(NormalizeTerm(v));
            }
            return set;
        }

        internal static SetCountResult SetCounts(string[]? gold, string[]? predicted)
        {
            var g = NormalizeSet(gold);
            var p = NormalizeSet(predicted);

            int tp = p.Count(g.Contains);
            int fp = p.Count(x => !g.Contains(x));
            int fn = g.Count(x => !p.Contains(x));

            return new SetCountResult
            {
                TruePositives = tp,
                FalsePositives = fp,
                FalseNegatives = fn,
                ExactMatch = fp == 0 && fn == 0
            };
        }
    }

    /// <summary>Result of scoring one gold/prediction pair (per-entry).</summary>
    public class FieldScoreResult
    {
        public Dictionary<string, bool> FieldAgreement { get; set; } = new();
        public bool ExactMatch { get; set; }
        public bool PredictionWasNull { get; set; }
        public SetCountResult Mechanics { get; set; } = new();
        public SetCountResult Categories { get; set; } = new();
    }

    /// <summary>Micro counts for a single array-valued field comparison.</summary>
    public class SetCountResult
    {
        public int TruePositives { get; set; }
        public int FalsePositives { get; set; }
        public int FalseNegatives { get; set; }
        public bool ExactMatch { get; set; }
    }
}
