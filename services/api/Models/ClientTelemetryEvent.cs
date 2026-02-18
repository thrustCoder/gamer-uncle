namespace GamerUncle.Api.Models
{
    /// <summary>
    /// Batch of telemetry events sent from the mobile client.
    /// </summary>
    public class ClientTelemetryBatch
    {
        /// <summary>
        /// The collection of telemetry events in this batch.
        /// </summary>
        public List<ClientTelemetryEvent> Events { get; set; } = new();
    }

    /// <summary>
    /// A single telemetry event reported by the mobile client.
    /// </summary>
    public class ClientTelemetryEvent
    {
        /// <summary>Event name following the Category.Action convention.</summary>
        public string EventName { get; set; } = string.Empty;

        /// <summary>String properties attached to the event.</summary>
        public Dictionary<string, string>? Properties { get; set; }

        /// <summary>Numeric metrics attached to the event.</summary>
        public Dictionary<string, double>? Metrics { get; set; }

        /// <summary>ISO 8601 timestamp when the event was captured on the client.</summary>
        public string? Timestamp { get; set; }

        /// <summary>Unique session identifier (new per cold start).</summary>
        public string? SessionId { get; set; }

        /// <summary>Persistent device identifier (stable across sessions).</summary>
        public string? DeviceId { get; set; }

        /// <summary>Client platform (ios / android / web).</summary>
        public string? Platform { get; set; }
    }
}
