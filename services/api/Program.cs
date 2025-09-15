using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Services.AgentService;
using GamerUncle.Api.Services.Cosmos;
using GamerUncle.Api.Services.Authentication;
using GamerUncle.Api.Services.GameData;
using GamerUncle.Api.Services.VoiceService;
using Azure.Identity;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using System.Reflection;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Validate Azure authentication configuration early
var authValidator = new AzureAuthenticationValidator(
    LoggerFactory.Create(config => config.AddConsole()).CreateLogger<AzureAuthenticationValidator>());
authValidator.ValidateConfiguration(builder.Configuration);

// Configure Application Insights with RBAC (Managed Identity)
var appInsightsConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
if (!string.IsNullOrEmpty(appInsightsConnectionString))
{
    // Use OpenTelemetry with Azure Monitor for modern telemetry
    builder.Services.AddOpenTelemetry().UseAzureMonitor(options =>
    {
        options.ConnectionString = appInsightsConnectionString;
        options.Credential = new DefaultAzureCredential();
    });
    
    // Add traditional Application Insights as well for compatibility
    builder.Services.AddApplicationInsightsTelemetry(options =>
    {
        options.ConnectionString = appInsightsConnectionString;
        options.DeveloperMode = builder.Environment.IsDevelopment();
    });
}

// Register services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));
});

// Add rate limiting
builder.Services.AddRateLimiter(options =>
{
    // Check if we're in a testing environment (via environment variable or config)
    var isTestEnvironment = builder.Environment.EnvironmentName.Equals("Testing", StringComparison.OrdinalIgnoreCase) 
                           || builder.Configuration.GetValue<bool>("Testing:DisableRateLimit");
    
    var isRateLimitTestEnvironment = builder.Environment.EnvironmentName.Equals("RateLimitTesting", StringComparison.OrdinalIgnoreCase);
    
    if (isTestEnvironment)
    {
        // Very permissive limits for testing
        options.AddFixedWindowLimiter("GameRecommendations", configure =>
        {
            configure.PermitLimit = 10000; // Very high limit for tests
            configure.Window = TimeSpan.FromMinutes(1);
            configure.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            configure.QueueLimit = 1000;
        });
    }
    else if (isRateLimitTestEnvironment)
    {
        // Strict limits for rate limiting integration tests
        var permitLimit = builder.Configuration.GetValue<int>("RateLimiting:PermitLimit", 1);
        var windowMinutes = builder.Configuration.GetValue<int>("RateLimiting:WindowMinutes", 1);
        var queueLimit = builder.Configuration.GetValue<int>("RateLimiting:QueueLimit", 0);
        
        options.AddFixedWindowLimiter("GameRecommendations", configure =>
        {
            configure.PermitLimit = permitLimit;
            configure.Window = TimeSpan.FromSeconds(5); // Use shorter window for tests
            configure.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            configure.QueueLimit = queueLimit;
        });
    }
    else
    {
        // Production rate limiting
        options.AddFixedWindowLimiter("GameRecommendations", configure =>
        {
            configure.PermitLimit = 15; // 15 requests per minute
            configure.Window = TimeSpan.FromMinutes(1); // per minute
            configure.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            configure.QueueLimit = 5; // Allow 5 requests to queue when limit is hit
        });
    }
    
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429; // Too Many Requests
        await context.HttpContext.Response.WriteAsync("Rate limit exceeded. Please try again later.", token);
    };
});

// DI registration
builder.Services.AddSingleton<ICosmosDbService, CosmosDbService>();
builder.Services.AddHttpClient<IFoundryVoiceService, FoundryVoiceService>();
// Use fake agent only when explicitly requested
if (Environment.GetEnvironmentVariable("AGENT_USE_FAKE") == "true")
{
    builder.Services.AddSingleton<IAgentServiceClient, FakeAgentServiceClient>();
}
else
{
    builder.Services.AddTransient<IAgentServiceClient, AgentServiceClient>();
}
builder.Services.AddTransient<AzureAuthenticationValidator>();

// Add health checks including authentication
builder.Services.AddHealthChecks()
    .AddCheck<AuthenticationHealthCheck>("azure_auth", HealthStatus.Degraded)
    .AddCheck("self", () => HealthCheckResult.Healthy("API is running"));

// CORS policy configuration
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:8081") // Adjust based on Expo port
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Enable Swagger based on configuration
var swaggerEnabled = app.Configuration.GetValue<bool>("Swagger:Enabled", app.Environment.IsDevelopment());
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseRouting();

// Add authentication error handling middleware
app.UseAuthenticationErrorHandling();

// Enable rate limiting after routing
app.UseRateLimiter();

app.UseAuthorization();
app.MapControllers();
app.UseCors();
app.UseStaticFiles();

// Add health check endpoints
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var result = System.Text.Json.JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                exception = e.Value.Exception?.Message,
                duration = e.Value.Duration,
                data = e.Value.Data
            })
        });
        await context.Response.WriteAsync(result);
    }
});

app.Run();

// Make Program class accessible for testing
public partial class Program { }
