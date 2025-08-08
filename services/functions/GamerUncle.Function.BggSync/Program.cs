using Microsoft.Extensions.Hosting;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.ApplicationInsights.WorkerService;
using Microsoft.Azure.Cosmos;
using Azure.Identity;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        // Configure Application Insights with RBAC (Managed Identity)
        var appInsightsConnectionString = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");
        if (!string.IsNullOrEmpty(appInsightsConnectionString))
        {
            // Add Application Insights for Azure Functions
            services.AddApplicationInsightsTelemetryWorkerService(options =>
            {
                options.ConnectionString = appInsightsConnectionString;
            });
        }

        // Register CosmosClient as a singleton with proper authentication
        services.AddSingleton<CosmosClient>(provider =>
        {
            var tenantId = Environment.GetEnvironmentVariable("AZURE_TENANT_ID");
            var clientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID");
            var cosmosEndpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT");

            if (string.IsNullOrEmpty(cosmosEndpoint))
            {
                throw new InvalidOperationException("COSMOS_ENDPOINT environment variable is required");
            }

            if (string.IsNullOrEmpty(tenantId))
            {
                throw new InvalidOperationException("AZURE_TENANT_ID environment variable is required");
            }

            DefaultAzureCredential credential;
            if (!string.IsNullOrEmpty(clientId))
            {
                // Azure environment - use managed identity with specific client ID
                credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
                {
                    TenantId = tenantId,
                    ManagedIdentityClientId = clientId,
                    ExcludeEnvironmentCredential = true,
                    ExcludeAzureCliCredential = true,
                    ExcludeAzurePowerShellCredential = true,
                    ExcludeVisualStudioCredential = true,
                    ExcludeVisualStudioCodeCredential = true,
                    ExcludeInteractiveBrowserCredential = true
                });
            }
            else
            {
                // Local development - allow Azure CLI and VS
                credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
                {
                    TenantId = tenantId,
                    ExcludeEnvironmentCredential = true,
                    ExcludeAzurePowerShellCredential = true,
                    ExcludeInteractiveBrowserCredential = true
                });
            }

            return new CosmosClient(cosmosEndpoint, credential);
        });
    })
    .Build();

host.Run();
