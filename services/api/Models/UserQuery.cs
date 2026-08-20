using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Models
{
    public class UserQuery
    {
        public required string Query { get; set; }
        public string? UserId { get; set; }
        public string? ConversationId { get; set; } // optional, client-managed

        /// <summary>
        /// Optional pre-extracted query criteria supplied by the client (e.g. from on-device
        /// inference). When present and non-empty, the server bypasses the cloud criteria
        /// extraction call (gpt-4.1-mini) and uses these directly for Cosmos RAG.
        /// Additive and backward-compatible: older clients omit this and the server behaves as before.
        /// </summary>
        public GameQueryCriteria? Criteria { get; set; }

        /// <summary>
        /// Provenance of <see cref="Criteria"/> — e.g. "on-device" or "cloud". Telemetry only.
        /// </summary>
        public string? CriteriaSource { get; set; }
    }
}