using System.ComponentModel.DataAnnotations;

namespace GamerUncle.Api.Services.Authentication
{
    /// <summary>
    /// Configuration options for Azure authentication
    /// </summary>
    public class AzureAuthenticationOptions
    {
        public const string SectionName = "AzureAuthentication";

        /// <summary>
        /// Azure tenant ID for authentication
        /// </summary>
        [Required]
        public string TenantId { get; set; } = string.Empty;

        /// <summary>
        /// Client ID for managed identity (optional for system-assigned identity)
        /// </summary>
        public string? ClientId { get; set; }

        /// <summary>
        /// Whether to use managed identity authentication
        /// </summary>
        public bool UseManagedIdentity { get; set; } = true;

        /// <summary>
        /// Timeout for authentication operations in seconds
        /// </summary>
        [Range(1, 300)]
        public int TimeoutSeconds { get; set; } = 30;

        /// <summary>
        /// Whether to enable additional authentication logging
        /// </summary>
        public bool EnableVerboseLogging { get; set; } = false;
    }

    /// <summary>
    /// Validator for Azure authentication configuration
    /// </summary>
    public class AzureAuthenticationValidator
    {
        private readonly ILogger<AzureAuthenticationValidator> _logger;

        public AzureAuthenticationValidator(ILogger<AzureAuthenticationValidator> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Validates Azure authentication configuration at startup
        /// </summary>
        public void ValidateConfiguration(IConfiguration configuration)
        {
            var requiredSettings = new[]
            {
                "AgentService:Endpoint",
                "AgentService:AgentId", 
                "CosmosDb:Endpoint",
                "CosmosDb:TenantId"
            };

            var missingSettings = new List<string>();

            foreach (var setting in requiredSettings)
            {
                var value = configuration[setting];
                if (string.IsNullOrEmpty(value))
                {
                    missingSettings.Add(setting);
                }
                else
                {
                    _logger.LogInformation("Configuration validated: {Setting} is present", setting);
                }
            }

            if (missingSettings.Any())
            {
                var missing = string.Join(", ", missingSettings);
                _logger.LogError("Missing required Azure configuration settings: {MissingSettings}", missing);
                throw new InvalidOperationException($"Missing required Azure configuration settings: {missing}");
            }

            // Validate URLs
            ValidateUrl(configuration["AgentService:Endpoint"], "AgentService:Endpoint");
            ValidateUrl(configuration["CosmosDb:Endpoint"], "CosmosDb:Endpoint");

            // Validate tenant ID format
            ValidateTenantId(configuration["CosmosDb:TenantId"], "CosmosDb:TenantId");

            _logger.LogInformation("All Azure authentication configuration validated successfully");
        }

        private void ValidateUrl(string? url, string settingName)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || 
                (uri.Scheme != "https" && uri.Scheme != "http"))
            {
                _logger.LogError("Invalid URL format for {SettingName}: {Url}", settingName, url);
                throw new InvalidOperationException($"Invalid URL format for {settingName}: {url}");
            }
        }

        private void ValidateTenantId(string? tenantId, string settingName)
        {
            if (!Guid.TryParse(tenantId, out _))
            {
                _logger.LogError("Invalid tenant ID format for {SettingName}: {TenantId}", settingName, tenantId);
                throw new InvalidOperationException($"Invalid tenant ID format for {settingName}: {tenantId}");
            }
        }
    }
}
