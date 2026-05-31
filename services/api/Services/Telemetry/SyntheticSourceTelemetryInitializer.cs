using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace GamerUncle.Api.Services.Telemetry
{
    /// <summary>
    /// Marks telemetry as originating from synthetic sources (e.g. functional tests, Playwright)
    /// by populating <c>telemetry.Context.Operation.SyntheticSource</c>. This propagates into
    /// the Log Analytics workspace tables (AppRequests, AppMetrics, AppDependencies, AppTraces,
    /// AppExceptions) as the <c>SyntheticSource</c> column, allowing alert KQL queries to
    /// exclude synthetic traffic via <c>where isempty(SyntheticSource)</c>.
    ///
    /// Patterns are loaded from configuration under
    /// <c>SyntheticTraffic:UserAgentPatterns</c>. When no patterns are configured, a default
    /// list covering the in-repo functional-test harness and Playwright is used.
    /// </summary>
    public sealed class SyntheticSourceTelemetryInitializer : ITelemetryInitializer
    {
        internal const string ConfigSectionName = "SyntheticTraffic:UserAgentPatterns";

        private static readonly IReadOnlyList<(string Pattern, string Label)> DefaultPatterns = new List<(string, string)>
        {
            ("GamerUncle-FunctionalTests", "GamerUncle-FunctionalTests"),
            ("Playwright",                 "Playwright"),
        };

        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IReadOnlyList<(string Pattern, string Label)> _patterns;

        public SyntheticSourceTelemetryInitializer(IHttpContextAccessor httpContextAccessor, IConfiguration configuration)
        {
            _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
            _patterns = LoadPatterns(configuration);
        }

        public void Initialize(ITelemetry telemetry)
        {
            if (telemetry == null)
            {
                return;
            }

            // Preserve anything an upstream initializer (e.g. Availability tests) has already set.
            if (!string.IsNullOrEmpty(telemetry.Context.Operation.SyntheticSource))
            {
                return;
            }

            var userAgent = _httpContextAccessor.HttpContext?.Request?.Headers["User-Agent"].ToString();
            if (string.IsNullOrEmpty(userAgent))
            {
                return;
            }

            foreach (var (pattern, label) in _patterns)
            {
                if (userAgent.IndexOf(pattern, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    telemetry.Context.Operation.SyntheticSource = label;
                    return;
                }
            }
        }

        private static IReadOnlyList<(string Pattern, string Label)> LoadPatterns(IConfiguration configuration)
        {
            if (configuration == null)
            {
                return DefaultPatterns;
            }

            var configured = configuration
                .GetSection(ConfigSectionName)
                .Get<List<SyntheticUserAgentPattern>>();

            if (configured == null || configured.Count == 0)
            {
                return DefaultPatterns;
            }

            var normalized = configured
                .Where(c => !string.IsNullOrWhiteSpace(c?.Pattern))
                .Select(c => (
                    Pattern: c!.Pattern!.Trim(),
                    Label: string.IsNullOrWhiteSpace(c.Label) ? c.Pattern!.Trim() : c.Label!.Trim()))
                .ToList();

            return normalized.Count > 0 ? normalized : DefaultPatterns;
        }
    }
}
