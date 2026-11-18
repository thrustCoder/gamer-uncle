using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using GamerUncle.Functions;
using GamerUncle.Shared.Models;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Core.FunctionMetadata;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.DurableTask;
using Microsoft.DurableTask.Client;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace GamerUncle.Functions.Tests;

// Durable analyzers cannot discover function implementations in the referenced application assembly.
#pragma warning disable DURABLE2003, DURABLE2004

public class FunctionsMigrationRegressionTests
{
    private readonly Mock<Container> _container = new();
    private readonly DurableGameUpsertFunction _function;

    public FunctionsMigrationRegressionTests()
    {
        var cosmos = new Mock<CosmosClient>();
        cosmos.Setup(client => client.GetContainer(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(_container.Object);
        _function = new DurableGameUpsertFunction(
            cosmos.Object, Mock.Of<ILogger<DurableGameUpsertFunction>>());
    }

    [Fact]
    public void FunctionNames_ShouldPreserveTheDeployedContract()
    {
        var names = typeof(DurableGameUpsertFunction).GetMethods()
            .Select(method => method.GetCustomAttribute<FunctionAttribute>()?.Name)
            .Where(name => name != null).OrderBy(name => name).ToArray();

        var expected = new[]
        {
            "DurableGameUpsertOrchestrator", "FetchGameDataActivity", "CheckGameExistsActivity",
            "UpsertGameDocumentActivity", "GameSyncHttpStart", "GameSyncTimerTriggerDev",
            "GameSyncTimerTriggerProd", "DurableHighSignalUpsertOrchestrator",
            "HighSignalChunkOrchestrator", "GameSyncHighSignalStart",
            "DurableRankedSyncOrchestrator", "FetchRankedGameIdsActivity", "GameSyncRankedStart"
        };
        Assert.Equal(expected.OrderBy(name => name), names);
    }

    [Theory]
    [InlineData(nameof(DurableGameUpsertFunction.GameSyncTimerTriggerDev), "0 0 0 1 */3 *")]
    [InlineData(nameof(DurableGameUpsertFunction.GameSyncTimerTriggerProd), "0 0 0 1 */6 *")]
    public void TimerAttributes_ShouldPreserveSchedulesAndDisableStartupRuns(string method, string schedule)
    {
        var attribute = typeof(DurableGameUpsertFunction).GetMethod(method)!
            .GetParameters()[0].GetCustomAttribute<TimerTriggerAttribute>();

        Assert.NotNull(attribute);
        Assert.Equal(schedule, attribute!.Schedule);
        Assert.False(attribute.RunOnStartup);
    }

    [Theory]
    [InlineData(nameof(DurableGameUpsertFunction.HttpStart))]
    [InlineData(nameof(DurableGameUpsertFunction.GameSyncHighSignalStart))]
    [InlineData(nameof(DurableGameUpsertFunction.GameSyncRankedStart))]
    public void HttpStarters_ShouldRemainFunctionAuthorizedPostEndpoints(string method)
    {
        var attribute = typeof(DurableGameUpsertFunction).GetMethod(method)!
            .GetParameters()[0].GetCustomAttribute<HttpTriggerAttribute>();

        Assert.NotNull(attribute);
        Assert.Equal(AuthorizationLevel.Function, attribute!.AuthLevel);
        Assert.Equal(new[] { "post" }, attribute.Methods);
        Assert.Null(attribute.Route);
    }

    [Theory]
    [InlineData("{\"count\":2}", 2)]
    [InlineData("{\"count\":\"3\"}", 3)]
    public async Task HttpStart_ShouldPreserveStatusResponseAndStringOrchestrationInput(string body, int count)
    {
        var request = CreateRequest(body);
        var client = CreateClient();

        var response = await _function.HttpStart(request, client.Object);

        using var json = await ReadResponse(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("migration-instance", json.RootElement.GetProperty("instanceId").GetString());
        Assert.Equal(count, json.RootElement.GetProperty("count").GetInt32());
        Assert.Equal(2, json.RootElement.EnumerateObject().Count());
        client.Verify(value => value.ScheduleNewOrchestrationInstanceAsync(
            It.Is<TaskName>(name => name.Name == nameof(DurableGameUpsertFunction.DurableGameUpsertOrchestrator)),
            count.ToString(), It.IsAny<StartOrchestrationOptions>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RankedStarter_ShouldPreserveCaseInsensitiveInputAndResponseShape()
    {
        var client = CreateClient();
        var response = await _function.GameSyncRankedStart(
            CreateRequest("{\"startpage\":3,\"endpage\":4}"), client.Object);

        using var json = await ReadResponse(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("migration-instance", json.RootElement.GetProperty("instanceId").GetString());
        var request = json.RootElement.GetProperty("request");
        Assert.Equal(3, request.GetProperty("StartPage").GetInt32());
        Assert.Equal(4, request.GetProperty("EndPage").GetInt32());
        client.Verify(value => value.ScheduleNewOrchestrationInstanceAsync(
            It.Is<TaskName>(name => name.Name == nameof(DurableGameUpsertFunction.DurableRankedSyncOrchestrator)),
            It.Is<RankedSyncRequest>(input => input.StartPage == 3 && input.EndPage == 4),
            It.IsAny<StartOrchestrationOptions>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HighSignalStarter_ShouldPreserveBoundsFiltersAndResponseShape()
    {
        var client = CreateClient();
        var response = await _function.GameSyncHighSignalStart(CreateRequest(
            """{"startId":10,"endId":14,"chunkSize":2,"maxChunksPerCycle":2,"minAverage":6.5,"minBayes":6,"minVotes":100}"""),
            client.Object);

        using var json = await ReadResponse(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("migration-instance", json.RootElement.GetProperty("instanceId").GetString());
        Assert.Equal(14, json.RootElement.GetProperty("request").GetProperty("EndId").GetInt32());
        client.Verify(value => value.ScheduleNewOrchestrationInstanceAsync(
            It.Is<TaskName>(name => name.Name == nameof(DurableGameUpsertFunction.DurableHighSignalUpsertOrchestrator)),
            It.Is<HighSignalSyncRequest>(input => input.StartId == 10 && input.EndId == 14 &&
                input.ChunkSize == 2 && input.MaxChunksPerCycle == 2 &&
                input.MinAverage == 6.5 && input.MinBayes == 6 && input.MinVotes == 100),
            It.IsAny<StartOrchestrationOptions>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LegacyOrchestrator_ShouldSkipExistingGamesAndAcceptQuotedCount()
    {
        var context = new Mock<TaskOrchestrationContext>();
        context.Setup(value => value.GetInput<string>()).Returns("\"2\"");
        context.Setup(value => value.CallActivityAsync<bool>(
            nameof(DurableGameUpsertFunction.CheckGameExistsActivity), "1", null)).ReturnsAsync(true);
        var game = new GameDocument { id = "bgg-2", name = "Migration fixture" };
        context.Setup(value => value.CallActivityAsync<GameDocument?>(
            nameof(DurableGameUpsertFunction.FetchGameDataActivity), "2", null)).ReturnsAsync(game);

        await _function.DurableGameUpsertOrchestrator(context.Object);

        var fetches = ActivityInputs(context, nameof(DurableGameUpsertFunction.FetchGameDataActivity));
        Assert.Equal(new object[] { "2" }, fetches);
        Assert.Same(game, Assert.Single(ActivityInputs(
            context, nameof(DurableGameUpsertFunction.UpsertGameDocumentActivity))));
    }

    [Fact]
    public async Task HighSignalOrchestrator_ShouldContinueAtTheNextUnprocessedChunk()
    {
        var request = new HighSignalSyncRequest
        {
            StartId = 10, EndId = 14, ChunkSize = 2, MaxChunksPerCycle = 2,
            MinAverage = 6.5, MinBayes = 6, MinVotes = 100
        };
        var context = new Mock<TaskOrchestrationContext>();
        context.Setup(value => value.GetInput<HighSignalSyncRequest>()).Returns(request);
        var chunks = new List<HighSignalChunkRequest>();
        context.Setup(value => value.CallSubOrchestratorAsync<int>(
            nameof(DurableGameUpsertFunction.HighSignalChunkOrchestrator), It.IsAny<object>(), null))
            .Callback<TaskName, object, TaskOptions>((_, input, _) => chunks.Add((HighSignalChunkRequest)input))
            .ReturnsAsync(1);

        await _function.DurableHighSignalUpsertOrchestrator(context.Object);

        Assert.Equal(new[] { (10, 11), (12, 13) }, chunks.Select(chunk => (chunk.StartId, chunk.EndId)));
        Assert.All(chunks, chunk =>
        {
            Assert.Equal(6.5, chunk.MinAverage);
            Assert.Equal(6, chunk.MinBayes);
            Assert.Equal(100, chunk.MinVotes);
        });
        context.Verify(value => value.ContinueAsNew(
            It.Is<HighSignalSyncRequest>(input => input.StartId == 14 && input.EndId == 14 &&
                input.MinVotes == 100 && input.MaxChunksPerCycle == 2), true), Times.Once);
    }

    [Fact]
    public async Task HighSignalChunk_ShouldOnlyUpsertQualifyingMissingGames()
    {
        var context = new Mock<TaskOrchestrationContext>();
        context.Setup(value => value.GetInput<HighSignalChunkRequest>())
            .Returns(new HighSignalChunkRequest { StartId = 7, EndId = 10 });
        context.Setup(value => value.CallActivityAsync<bool>(
            nameof(DurableGameUpsertFunction.CheckGameExistsActivity), "7", null)).ReturnsAsync(true);
        context.Setup(value => value.CallActivityAsync<GameDocument?>(
            nameof(DurableGameUpsertFunction.FetchGameDataActivity), "9", null))
            .ReturnsAsync(new GameDocument { id = "bgg-9", numVotes = 49, averageRating = 8, bggRating = 8 });
        var game = new GameDocument { id = "bgg-10", numVotes = 50, averageRating = 5, bggRating = 5 };
        context.Setup(value => value.CallActivityAsync<GameDocument?>(
            nameof(DurableGameUpsertFunction.FetchGameDataActivity), "10", null)).ReturnsAsync(game);

        var result = await _function.HighSignalChunkOrchestrator(context.Object);

        Assert.Equal(1, result);
        Assert.Equal(new object[] { "8", "9", "10" },
            ActivityInputs(context, nameof(DurableGameUpsertFunction.FetchGameDataActivity)));
        Assert.Same(game, Assert.Single(ActivityInputs(
            context, nameof(DurableGameUpsertFunction.UpsertGameDocumentActivity))));
    }

    [Fact]
    public async Task RankedOrchestrator_ShouldPreserveSkipsPageFailureAndDurableDelays()
    {
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var context = new Mock<TaskOrchestrationContext>();
        context.Setup(value => value.GetInput<RankedSyncRequest>())
            .Returns(new RankedSyncRequest { StartPage = 2, EndPage = 3 });
        context.SetupGet(value => value.CurrentUtcDateTime).Returns(now);
        context.Setup(value => value.CallActivityAsync<List<string>>(
            nameof(DurableGameUpsertFunction.FetchRankedGameIdsActivity), 2, null))
            .ReturnsAsync(new List<string> { "7", "8", "9" });
        context.Setup(value => value.CallActivityAsync<List<string>>(
            nameof(DurableGameUpsertFunction.FetchRankedGameIdsActivity), 3, null))
            .ThrowsAsync(new InvalidOperationException("Simulated page failure"));
        context.Setup(value => value.CallActivityAsync<bool>(
            nameof(DurableGameUpsertFunction.CheckGameExistsActivity), "7", null)).ReturnsAsync(true);
        var game = new GameDocument { id = "bgg-9", name = "Ranked fixture" };
        context.Setup(value => value.CallActivityAsync<GameDocument?>(
            nameof(DurableGameUpsertFunction.FetchGameDataActivity), "9", null)).ReturnsAsync(game);

        await _function.DurableRankedSyncOrchestrator(context.Object);

        Assert.Equal(new object[] { 2, 3 },
            ActivityInputs(context, nameof(DurableGameUpsertFunction.FetchRankedGameIdsActivity)));
        Assert.Equal(new object[] { "8", "9" },
            ActivityInputs(context, nameof(DurableGameUpsertFunction.FetchGameDataActivity)));
        Assert.Same(game, Assert.Single(ActivityInputs(
            context, nameof(DurableGameUpsertFunction.UpsertGameDocumentActivity))));
        context.Verify(value => value.CreateTimer(now.AddSeconds(1), CancellationToken.None), Times.Exactly(2));
        context.Verify(value => value.CreateTimer(now.AddSeconds(3), CancellationToken.None), Times.Once);
    }

    [Theory]
    [InlineData(true, "Development", true)]
    [InlineData(true, "Production", false)]
    [InlineData(false, "Development", false)]
    [InlineData(false, "Production", true)]
    public async Task Timers_ShouldPreserveEnvironmentGatingAndRankedDispatch(
        bool developmentTimer, string environment, bool shouldStart)
    {
        var previousEnvironment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT");
        var previousPages = Environment.GetEnvironmentVariable("RankedSyncPages");
        try
        {
            Environment.SetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT", environment);
            Environment.SetEnvironmentVariable("RankedSyncPages", "2");
            using var services = new ServiceCollection().AddLogging().BuildServiceProvider();
            var context = new Mock<FunctionContext>();
            context.SetupProperty(value => value.InstanceServices, services);
            var client = CreateClient();
            var timer = new TimerInfo { IsPastDue = false };

            if (developmentTimer)
                await _function.GameSyncTimerTriggerDev(timer, client.Object, context.Object);
            else
                await _function.GameSyncTimerTriggerProd(timer, client.Object, context.Object);

            client.Verify(value => value.ScheduleNewOrchestrationInstanceAsync(
                It.Is<TaskName>(name => name.Name == nameof(DurableGameUpsertFunction.DurableRankedSyncOrchestrator)),
                It.Is<RankedSyncRequest>(input => input.StartPage == 1 && input.EndPage == 2),
                It.IsAny<StartOrchestrationOptions>(), It.IsAny<CancellationToken>()),
                shouldStart ? Times.Once() : Times.Never());
        }
        finally
        {
            Environment.SetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT", previousEnvironment);
            Environment.SetEnvironmentVariable("RankedSyncPages", previousPages);
        }
    }

    [Fact]
    public void WorkerSerializer_ShouldPreserveExistingCosmosDocumentShape()
    {
        using var host = new HostBuilder().ConfigureFunctionsWorkerDefaults().Build();
        var serializer = host.Services.GetRequiredService<IOptions<WorkerOptions>>().Value.Serializer!;
        var game = new GameDocument
        {
            id = "bgg-42", name = "Migration fixture", minPlayers = 2, maxPlayers = 4,
            averageRating = 7.25, bggRating = 6.75, numVotes = 123,
            mechanics = new List<string> { "Drafting" }, categories = new List<string> { "Cards" },
            ruleQnA = new List<RuleQnA> { new() { question = "Who starts?", answer = "Youngest" } },
            updatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        using var stream = new MemoryStream();
        serializer.Serialize(stream, game, typeof(GameDocument), CancellationToken.None);
        stream.Position = 0;
        using var json = JsonDocument.Parse(stream);
        var root = json.RootElement;
        Assert.Equal("bgg-42", root.GetProperty("id").GetString());
        Assert.False(root.TryGetProperty("Id", out _));
        Assert.Equal(7.25, root.GetProperty("averageRating").GetDouble());
        Assert.Equal(123, root.GetProperty("numVotes").GetInt32());
        Assert.Equal("Drafting", root.GetProperty("mechanics")[0].GetString());
        Assert.Equal("Who starts?", root.GetProperty("ruleQnA")[0].GetProperty("question").GetString());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("narrationTTS").ValueKind);
        Assert.Equal("game", root.GetProperty("type").GetString());
        Assert.Equal(game.updatedAt, root.GetProperty("updatedAt").GetDateTime());
        stream.Position = 0;
        var restored = Assert.IsType<GameDocument>(serializer.Deserialize(stream, typeof(GameDocument), CancellationToken.None));
        Assert.Equal(game.id, restored.id);
        Assert.Equal(game.mechanics, restored.mechanics);
        Assert.Equal(DateTimeKind.Utc, restored.updatedAt.Kind);
    }

    [Fact]
    public async Task UpsertActivity_ShouldPreserveDocumentPartitionKeyAndSurfaceWriteFailure()
    {
        var game = new GameDocument { id = "bgg-42", name = "Migration fixture" };
        var failure = new CosmosException("Simulated failure", HttpStatusCode.ServiceUnavailable, 0, "", 0);
        _container.Setup(value => value.UpsertItemAsync(
            game, new PartitionKey(game.id), null, It.IsAny<CancellationToken>())).ThrowsAsync(failure);

        Assert.Same(failure, await Assert.ThrowsAsync<CosmosException>(
            () => _function.UpsertGameDocumentActivity(game)));
        _container.Verify(value => value.UpsertItemAsync(
            game, new PartitionKey(game.id), null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GeneratedMetadata_ShouldDiscoverEveryFunctionAndBinding()
    {
        var assembly = typeof(DurableGameUpsertFunction).Assembly;
        var providerType = Assert.Single(assembly.GetTypes().Where(type =>
            typeof(IFunctionMetadataProvider).IsAssignableFrom(type) && !type.IsAbstract));
        var provider = (IFunctionMetadataProvider)Activator.CreateInstance(providerType)!;
        var metadata = await provider.GetFunctionMetadataAsync(Path.GetDirectoryName(assembly.Location)!);
        var expectedNames = typeof(DurableGameUpsertFunction).GetMethods()
            .Select(method => method.GetCustomAttribute<FunctionAttribute>()?.Name)
            .Where(name => name != null).OrderBy(name => name);

        Assert.Equal(expectedNames, metadata.Select(function => function.Name).OrderBy(name => name));
        Assert.Equal(13, metadata.Length);
        var manifest = metadata.Select(function => new
        {
            name = function.Name,
            entryPoint = function.EntryPoint,
            bindings = Assert.IsAssignableFrom<IEnumerable<string>>(function.RawBindings)
                .Select(binding => JsonSerializer.Deserialize<JsonElement>(binding)).ToArray()
        }).ToArray();
        Assert.All(manifest, function =>
        {
            Assert.False(string.IsNullOrWhiteSpace(function.entryPoint));
            Assert.NotEmpty(function.bindings);
            Assert.All(function.bindings, binding =>
            {
                Assert.False(string.IsNullOrWhiteSpace(binding.GetProperty("type").GetString()));
            });
        });

        // The SDK embeds metadata in the worker; CI records it alongside the tested artifact.
        var manifestPath = Environment.GetEnvironmentVariable("FUNCTIONS_MANIFEST_PATH");
        if (!string.IsNullOrEmpty(manifestPath))
        {
            await File.WriteAllTextAsync(manifestPath, JsonSerializer.Serialize(manifest));
        }
    }

    private static Mock<DurableTaskClient> CreateClient()
    {
        var client = new Mock<DurableTaskClient>("migration-tests");
        client.Setup(value => value.ScheduleNewOrchestrationInstanceAsync(
            It.IsAny<TaskName>(), It.IsAny<object>(), It.IsAny<StartOrchestrationOptions>(),
            It.IsAny<CancellationToken>())).ReturnsAsync("migration-instance");
        return client;
    }

    private static HttpRequestData CreateRequest(string body)
    {
        var context = new Mock<FunctionContext>();
        var request = new Mock<HttpRequestData>(context.Object);
        request.SetupGet(value => value.Body).Returns(new MemoryStream(Encoding.UTF8.GetBytes(body)));
        var response = new Mock<HttpResponseData>(context.Object);
        response.SetupProperty(value => value.StatusCode);
        response.SetupProperty(value => value.Headers, new HttpHeadersCollection());
        response.SetupProperty(value => value.Body, new MemoryStream());
        request.Setup(value => value.CreateResponse()).Returns(response.Object);
        return request.Object;
    }

    private static Task<JsonDocument> ReadResponse(HttpResponseData response)
    {
        Assert.Contains("application/json", response.Headers.GetValues("Content-Type"));
        response.Body.Position = 0;
        return JsonDocument.ParseAsync(response.Body);
    }

    private static object[] ActivityInputs(Mock<TaskOrchestrationContext> context, string name) =>
        context.Invocations.Where(invocation =>
                invocation.Method.Name == nameof(TaskOrchestrationContext.CallActivityAsync) &&
                invocation.Arguments[0] is TaskName task && task.Name == name)
            .Select(invocation => invocation.Arguments[1]).ToArray();
}

#pragma warning restore DURABLE2003, DURABLE2004
