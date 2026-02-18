using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GamerUncle.Api.Services.Authentication
{
    /// <summary>
    /// Action filter that validates the X-GamerUncle-AppKey header for app-only endpoints.
    /// Provides first line of defense against non-app clients.
    /// </summary>
    public class AppKeyAuthorizationFilter : IAsyncActionFilter
    {
        private const string AppKeyHeaderName = "X-GamerUncle-AppKey";
        private readonly string? _configuredAppKey;
        private readonly ILogger<AppKeyAuthorizationFilter> _logger;
        private readonly bool _isTestEnvironment;

        public AppKeyAuthorizationFilter(
            IConfiguration configuration,
            ILogger<AppKeyAuthorizationFilter> logger,
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
                _logger.LogDebug("AppKey validation skipped in test environment");
                await next();
                return;
            }

            // If no app key is configured, skip validation (allows gradual rollout)
            if (string.IsNullOrEmpty(_configuredAppKey))
            {
                _logger.LogWarning("AppKey validation skipped - no app key configured. Configure ApiAuthentication:AppKey to enable.");
                await next();
                return;
            }

            var clientIp = context.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var userAgent = context.HttpContext.Request.Headers.UserAgent.ToString();

            // Check for the app key header
            if (!context.HttpContext.Request.Headers.TryGetValue(AppKeyHeaderName, out var providedAppKey))
            {
                _logger.LogWarning(
                    "AppKey validation failed - header missing. IP: {ClientIp}, UserAgent: {UserAgent}, Path: {Path}",
                    clientIp, userAgent, context.HttpContext.Request.Path);

                context.Result = new UnauthorizedObjectResult(new { error = "Invalid or missing app key" });
                return;
            }

            // Validate the app key
            if (!string.Equals(providedAppKey, _configuredAppKey, StringComparison.Ordinal))
            {
                _logger.LogWarning(
                    "AppKey validation failed - invalid key. IP: {ClientIp}, UserAgent: {UserAgent}, Path: {Path}",
                    clientIp, userAgent, context.HttpContext.Request.Path);

                context.Result = new UnauthorizedObjectResult(new { error = "Invalid or missing app key" });
                return;
            }

            _logger.LogDebug("AppKey validation successful for request from IP: {ClientIp}", clientIp);
            await next();
        }
    }

    /// <summary>
    /// Attribute to apply AppKey authorization to controllers or actions.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
    public class RequireAppKeyAttribute : TypeFilterAttribute
    {
        public RequireAppKeyAttribute() : base(typeof(AppKeyAuthorizationFilter))
        {
        }
    }
}
