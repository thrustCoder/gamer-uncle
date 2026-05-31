namespace GamerUncle.Api.Services.Telemetry
{
    /// <summary>
    /// Configuration entry that maps a User-Agent substring to a
    /// <c>SyntheticSource</c> label written onto all telemetry produced
    /// for the matching request.
    /// </summary>
    public sealed class SyntheticUserAgentPattern
    {
        /// <summary>Case-insensitive substring matched against the User-Agent header.</summary>
        public string? Pattern { get; set; }

        /// <summary>
        /// Value written to <c>telemetry.Context.Operation.SyntheticSource</c>
        /// when <see cref="Pattern"/> matches. Defaults to <see cref="Pattern"/>
        /// when not supplied.
        /// </summary>
        public string? Label { get; set; }
    }
}
