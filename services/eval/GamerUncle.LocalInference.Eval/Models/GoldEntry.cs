using GamerUncle.Shared.Models;

namespace GamerUncle.LocalInference.Eval.Models
{
    /// <summary>
    /// One entry in the gold evaluation set. Represents a self-contained first-message
    /// (conversationId == null) board-game query together with the hand-corrected
    /// GameQueryCriteria that a perfect extractor should produce, and optionally the
    /// set of game ids that the query should surface.
    /// </summary>
    public class GoldEntry
    {
        /// <summary>Stable identifier for the query (used to join predictions to gold).</summary>
        public string Id { get; set; } = default!;

        /// <summary>The raw user query text (first message of a thread).</summary>
        public string Query { get; set; } = default!;

        /// <summary>The hand-corrected criteria that should be extracted from <see cref="Query"/>.</summary>
        public GameQueryCriteria Gold { get; set; } = new();

        /// <summary>
        /// Optional gold set of relevant game ids for recall@k. When omitted, the relevant
        /// set is derived by matching <see cref="Gold"/> against the games snapshot.
        /// </summary>
        public List<string>? ExpectedGameIds { get; set; }

        /// <summary>Optional free-form tag (e.g. "named", "mechanic", "players") for slice reporting.</summary>
        public string? Tag { get; set; }
    }
}
