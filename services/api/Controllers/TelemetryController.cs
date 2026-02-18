using Microsoft.ApplicationInsights;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.AspNetCore.Mvc;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.Authentication;

namespace GamerUncle.Api.Controllers
{
    /// <summary>
    /// Receives telemetry events from the mobile client and forwards them
    /// to Application Insights for unified analytics.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [RequireAppKey]
    public class TelemetryController : ControllerBase
    {
        private readonly TelemetryClient? _telemetry;
        private readonly ILogger<TelemetryController> _logger;

        public TelemetryController(ILogger<TelemetryController> logger, TelemetryClient? telemetry = null)
        {
            _logger = logger;
            _telemetry = telemetry;
        }

        /// <summary>
        /// Ingest a batch of client telemetry events.
        /// </summary>
        /// <param name="batch">Batch payload containing one or more events.</param>
        /// <returns>202 Accepted on success.</returns>
        [HttpPost("events")]
        public IActionResult IngestEvents([FromBody] ClientTelemetryBatch batch)
        {
            if (batch.Events == null || batch.Events.Count == 0)
            {
                return BadRequest("No events provided.");
            }

            var accepted = 0;

            foreach (var evt in batch.Events)
            {
                if (string.IsNullOrWhiteSpace(evt.EventName))
                {
                    continue;
                }

                // Build the properties dictionary with standard dimensions
                var properties = new Dictionary<string, string>
                {
                    ["ClientTimestamp"] = evt.Timestamp ?? string.Empty,
                    ["SessionId"] = evt.SessionId ?? string.Empty,
                    ["DeviceId"] = evt.DeviceId ?? string.Empty,
                    ["ClientPlatform"] = evt.Platform ?? string.Empty,
                };

                // Merge caller-supplied properties
                if (evt.Properties != null)
                {
                    foreach (var kv in evt.Properties)
                    {
                        properties[kv.Key] = kv.Value;
                    }
                }

                // Build metrics
                var metrics = new Dictionary<string, double>();
                if (evt.Metrics != null)
                {
                    foreach (var kv in evt.Metrics)
                    {
                        metrics[kv.Key] = kv.Value;
                    }
                }

                // Forward to Application Insights
                if (_telemetry != null)
                {
                    _telemetry.TrackEvent(
                        $"Client.{evt.EventName}",
                        properties,
                        metrics.Count > 0 ? metrics : null);
                }
                else
                {
                    _logger.LogInformation(
                        "Client telemetry (no AI sink): {EventName} | Session={SessionId} Device={DeviceId}",
                        evt.EventName, evt.SessionId, evt.DeviceId);
                }

                accepted++;
            }

            _logger.LogDebug("Ingested {Count} client telemetry events", accepted);

            return Accepted(new { accepted });
        }
    }
}
