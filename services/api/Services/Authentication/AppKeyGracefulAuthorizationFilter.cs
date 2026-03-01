using Microsoft.ApplicationInsights;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GamerUncle.Api.Services.Authentication
{
    /// <summary>
    /// Action filter that validates the X-GamerUncle-AppKey header in grace mode.
    /// Unlike <see cref="AppKeyAuthorizationFilter"/> which rejects all unauthenticated requests,
    /// this filter allows requests without an App Key (for backward compatibility during migration)
    /// but rejects requests with an invalid key. Requests without a key are logged as warnings
    /// and receive an X-AppKey-Deprecated response header.
    /// 
    /// This is a transitional filter for Phase 2 of the App Key enforcement rollout.
    /// Once all clients are sending the correct key, replace with [RequireAppKey].
    /// </summary>
    public class AppKeyGracefulAuthorizationFilter : IAsyncActionFilter
    {
        private const string AppKeyHeaderName = "X-GamerUncle-AppKey";
        private const string DeprecatedResponseHeader = "X-AppKey-Deprecated";

        /// <summary>
        /// Stable event IDs used by <see cref="ILogger"/> so that KQL queries on the
        /// <c>traces</c> table can filter by <c>customDimensions.EventId</c> instead of
        /// fragile string matching.  These are also emitted as structured properties
        /// (<c>AppKeyOutcome</c>, <c>AppKeyPath</c>) so the <c>traces</c> table is
        /// queryable even when <c>customEvents</c> from <see cref="TelemetryClient"/>
        /// is not ingested (e.g. classic SDK channel misconfiguration).
        /// </summary>
        internal static class EventIds
        {
            internal static readonly EventId GraceModeValid   = new(7001, "AppKeyGraceMode.Valid");
            internal static readonly EventId GraceModeMissing = new(7002, "AppKeyGraceMode.Missing");
            internal static readonly EventId GraceModeInvalid = new(7003, "AppKeyGraceMode.Invalid");
        }

        private readonly string? _configuredAppKey;
        private readonly ILogger<AppKeyGracefulAuthorizationFilter> _logger;
        private readonly TelemetryClient? _telemetryClient;
        private readonly bool _isTestEnvironment;

        public AppKeyGracefulAuthorizationFilter(
            IConfiguration configuration,
            ILogger<AppKeyGracefulAuthorizationFilter> logger,
            IWebHostEnvironment environment,
            TelemetryClient? telemetryClient = null)
        {
            _configuredAppKey = configuration["ApiAuthentication:AppKey"];
            _logger = logger;
            _telemetryClient = telemetryClient;
            _isTestEnvironment = environment.EnvironmentName.Equals("Testing", StringComparison.OrdinalIgnoreCase)
                               || configuration.GetValue<bool>("Testing:DisableRateLimit");
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // Skip validation in test environment
            if (_isTestEnvironment)
            {
                _logger.LogDebug("AppKey graceful validation skipped in test environment");
                await next();
                return;
            }

            // If no app key is configured server-side, skip validation entirely
            if (string.IsNullOrEmpty(_configuredAppKey))
            {
                _logger.LogWarning("AppKey graceful validation skipped - no app key configured. Configure ApiAuthentication:AppKey to enable.");
                await next();
                return;
            }

            var clientIp = context.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var userAgent = context.HttpContext.Request.Headers.UserAgent.ToString();
            var path = context.HttpContext.Request.Path.ToString();

            // Check if the App Key header is present
            if (!context.HttpContext.Request.Headers.TryGetValue(AppKeyHeaderName, out var providedAppKey))
            {
                // Grace mode: allow the request but log a warning and add deprecation header
                _logger.LogWarning(EventIds.GraceModeMissing,
                    "AppKey graceful - request without App Key header. " +
                    "AppKeyOutcome={AppKeyOutcome}, AppKeyPath={AppKeyPath}, ClientIp={ClientIp}, UserAgent={UserAgent}. " +
                    "Unauthenticated access to this endpoint will be removed in a future release.",
                    "Missing", path, clientIp, userAgent);

                TrackAuthEvent("AppKey.GraceModeRequest", "Missing", clientIp, userAgent, path);

                context.HttpContext.Response.Headers[DeprecatedResponseHeader] = "true";
                await next();
                return;
            }

            // If a key is provided but invalid, reject immediately (wrong key = unauthorized)
            if (!string.Equals(providedAppKey, _configuredAppKey, StringComparison.Ordinal))
            {
                _logger.LogWarning(EventIds.GraceModeInvalid,
                    "AppKey graceful validation failed - invalid key. " +
                    "AppKeyOutcome={AppKeyOutcome}, AppKeyPath={AppKeyPath}, ClientIp={ClientIp}, UserAgent={UserAgent}",
                    "Invalid", path, clientIp, userAgent);

                TrackAuthEvent("AppKey.GraceModeRequest", "Invalid", clientIp, userAgent, path);

                context.Result = new UnauthorizedObjectResult(new { error = "Invalid or missing app key" });
                return;
            }

            // Logged at Information (not Debug) so it appears in the traces table in prod.
            // This is critical for measuring the Valid / Missing ratio via KQL.
            _logger.LogInformation(EventIds.GraceModeValid,
                "AppKey graceful validation successful. " +
                "AppKeyOutcome={AppKeyOutcome}, AppKeyPath={AppKeyPath}, ClientIp={ClientIp}",
                "Valid", path, clientIp);

            TrackAuthEvent("AppKey.GraceModeRequest", "Valid", clientIp, userAgent, path);
            await next();
        }

        /// <summary>
        /// Track a structured custom event in Application Insights for auth filter outcomes.
        /// Enables dashboards and KQL queries on structured dimensions rather than string log parsing.
        /// This is a belt-and-suspenders companion to the ILogger calls above; in some environments
        /// the classic SDK TelemetryClient may not be wired (customEvents table empty). The ILogger
        /// path writes to the traces table which is always ingested.
        /// </summary>
        private void TrackAuthEvent(string eventName, string outcome, string clientIp, string userAgent, string path)
        {
            _telemetryClient?.TrackEvent(eventName, new Dictionary<string, string>
            {
                ["Outcome"] = outcome,
                ["Path"] = path,
                ["ClientIp"] = clientIp,
                ["UserAgent"] = userAgent,
            });
        }
    }

    /// <summary>
    /// Attribute to apply graceful (non-blocking) App Key authorization to controllers or actions.
    /// Requests without a key are allowed with a warning; requests with an invalid key are rejected.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
    public class RequireAppKeyGracefulAttribute : TypeFilterAttribute
    {
        public RequireAppKeyGracefulAttribute() : base(typeof(AppKeyGracefulAuthorizationFilter))
        {
        }
    }
}
