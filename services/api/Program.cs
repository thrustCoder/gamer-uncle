using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Services.AgentService;
using GamerUncle.Api.Services.Cosmos;
using Azure.Identity;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

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

// DI registration
builder.Services.AddSingleton<ICosmosDbService, CosmosDbService>();
builder.Services.AddTransient<IAgentServiceClient, AgentServiceClient>();

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

// Enable Swagger in development
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.UseCors();
app.UseStaticFiles();

app.Run();
