using Microsoft.Extensions.Diagnostics.HealthChecks;
using Azure.Identity;
using Azure.Core;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Services.Authentication
{
    /// <summary>
    /// Health check to verify Azure authentication is working properly
    /// </summary>
    public class AuthenticationHealthCheck : IHealthCheck
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthenticationHealthCheck> _logger;
        private readonly DefaultAzureCredential _credential;

        public AuthenticationHealthCheck(IConfiguration configuration, ILogger<AuthenticationHealthCheck> logger)
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _credential = new DefaultAzureCredential();
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                // Test Azure credential by getting an access token
                var tokenRequestContext = new TokenRequestContext(new[] { "https://management.azure.com/.default" });
                var token = await _credential.GetTokenAsync(tokenRequestContext, cancellationToken);

                if (token.Token != null && token.ExpiresOn > DateTimeOffset.UtcNow.AddMinutes(5))
                {
                    _logger.LogInformation("Azure authentication successful. Token expires at {ExpiresOn}", token.ExpiresOn);
                    
                    var data = new Dictionary<string, object>
                    {
                        ["TokenExpiresAt"] = token.ExpiresOn,
                        ["TenantId"] = _configuration["CosmosDb:TenantId"] ?? "Not configured",
                        ["AgentEndpoint"] = _configuration["AgentService:Endpoint"] ?? "Not configured"
                    };

                    return HealthCheckResult.Healthy("Azure authentication is working", data);
                }
                else
                {
                    _logger.LogWarning("Azure token is null or expires too soon. ExpiresOn: {ExpiresOn}", token.ExpiresOn);
                    return HealthCheckResult.Degraded("Azure token is invalid or expires soon");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Azure authentication failed");
                return HealthCheckResult.Unhealthy("Azure authentication failed", ex);
            }
        }
    }
}
