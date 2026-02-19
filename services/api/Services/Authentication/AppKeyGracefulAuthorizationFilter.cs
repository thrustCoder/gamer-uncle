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
        private readonly string? _configuredAppKey;
        private readonly ILogger<AppKeyGracefulAuthorizationFilter> _logger;
        private readonly bool _isTestEnvironment;

        public AppKeyGracefulAuthorizationFilter(
            IConfiguration configuration,
            ILogger<AppKeyGracefulAuthorizationFilter> logger,
            IWebHostEnvironment environment)
        {
            _configuredAppKey = configuration["ApiAuthentication:AppKey"];
            _logger = logger;
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
                _logger.LogWarning(
                    "AppKey graceful - request without App Key header. IP: {ClientIp}, UserAgent: {UserAgent}, Path: {Path}. " +
                    "Unauthenticated access to this endpoint will be removed in a future release.",
                    clientIp, userAgent, path);

                context.HttpContext.Response.Headers[DeprecatedResponseHeader] = "true";
                await next();
                return;
            }

            // If a key is provided but invalid, reject immediately (wrong key = unauthorized)
            if (!string.Equals(providedAppKey, _configuredAppKey, StringComparison.Ordinal))
            {
                _logger.LogWarning(
                    "AppKey graceful validation failed - invalid key. IP: {ClientIp}, UserAgent: {UserAgent}, Path: {Path}",
                    clientIp, userAgent, path);

                context.Result = new UnauthorizedObjectResult(new { error = "Invalid or missing app key" });
                return;
            }

            _logger.LogDebug("AppKey graceful validation successful for request from IP: {ClientIp}", clientIp);
            await next();
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
