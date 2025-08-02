using Azure;
using Azure.Identity;
using System.Net;

namespace GamerUncle.Api.Services.Authentication
{
    /// <summary>
    /// Middleware to handle Azure authentication errors and provide meaningful responses
    /// </summary>
    public class AuthenticationErrorMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<AuthenticationErrorMiddleware> _logger;

        public AuthenticationErrorMiddleware(RequestDelegate next, ILogger<AuthenticationErrorMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (CredentialUnavailableException ex)
            {
                _logger.LogError(ex, "Azure credentials unavailable for request {RequestPath}", context.Request.Path);
                await HandleCredentialError(context, ex);
            }
            catch (AuthenticationFailedException ex)
            {
                _logger.LogError(ex, "Azure authentication failed for request {RequestPath}", context.Request.Path);
                await HandleAuthenticationError(context, ex);
            }
            catch (RequestFailedException ex) when (ex.Status == 401 || ex.Status == 403)
            {
                _logger.LogError(ex, "Azure request failed with authentication error for request {RequestPath}", context.Request.Path);
                await HandleRequestError(context, ex);
            }
        }

        private async Task HandleAuthenticationError(HttpContext context, AuthenticationFailedException ex)
        {
            var response = new
            {
                error = "Authentication Failed",
                message = "Unable to authenticate with Azure services. Please check your credentials.",
                details = "The Azure authentication failed. This may be due to expired credentials or insufficient permissions.",
                timestamp = DateTime.UtcNow,
                requestId = context.TraceIdentifier
            };

            context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(response));
        }

        private async Task HandleCredentialError(HttpContext context, CredentialUnavailableException ex)
        {
            var response = new
            {
                error = "Credentials Unavailable",
                message = "Azure credentials are not available. Please ensure managed identity is configured.",
                details = "The application cannot access Azure credentials. In local development, ensure you're logged in with 'az login'.",
                timestamp = DateTime.UtcNow,
                requestId = context.TraceIdentifier
            };

            context.Response.StatusCode = (int)HttpStatusCode.ServiceUnavailable;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(response));
        }

        private async Task HandleRequestError(HttpContext context, RequestFailedException ex)
        {
            var response = new
            {
                error = "Azure Request Failed",
                message = "Request to Azure service failed with authentication error.",
                details = $"Azure service returned status {ex.Status}: {ex.Message}",
                timestamp = DateTime.UtcNow,
                requestId = context.TraceIdentifier
            };

            context.Response.StatusCode = ex.Status == 401 ? 
                (int)HttpStatusCode.Unauthorized : 
                (int)HttpStatusCode.Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(response));
        }
    }

    /// <summary>
    /// Extension method to register the authentication error middleware
    /// </summary>
    public static class AuthenticationErrorMiddlewareExtensions
    {
        public static IApplicationBuilder UseAuthenticationErrorHandling(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<AuthenticationErrorMiddleware>();
        }
    }
}
