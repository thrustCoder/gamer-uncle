using System.Text.Json;
using GamerUncle.Api.Services.Cache;
using GamerUncle.Api.Services.Interfaces;
using Microsoft.ApplicationInsights;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace GamerUncle.Api.Tests.Cache;

public class CriteriaCacheTests
{
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<IDatabase> _mockRedisDb;
    private readonly Mock<ILogger<CriteriaCache>> _mockLogger;

    public CriteriaCacheTests()
    {
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockRedisDb = new Mock<IDatabase>();
        _mockLogger = new Mock<ILogger<CriteriaCache>>();

        // Setup Redis to return mock database
        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>()))
            .Returns(_mockRedisDb.Object);
    }

    [Fact]
    public async Task GetAsync_ReturnsL1CacheHit_WhenValueInMemory()
    {
        // Arrange
        var query = "recommend games for 4 players";
        var expectedJson = "{\"MinPlayers\":4,\"MaxPlayers\":4}";
        
        var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cache = CreateCache(memoryCache, withRedis: false);
        
        // Pre-populate cache
        await cache.SetAsync(query, expectedJson);

        // Act
        var result = await cache.GetAsync(query);

        // Assert
        Assert.Equal(expectedJson, result);
        var stats = cache.GetStatistics();
        Assert.Equal(1, stats.L1Hits);
        Assert.Equal(0, stats.L2Hits);
        Assert.Equal(0, stats.Misses);
    }

    [Fact]
    public async Task GetAsync_ReturnsL2CacheHit_WhenValueInRedis()
    {
        // Arrange
        var query = "recommend games for 4 players";
        var expectedJson = "{\"MinPlayers\":4,\"MaxPlayers\":4}";

        var memoryCache = new MemoryCache(new MemoryCacheOptions());

        _mockRedisDb.Setup(r => r.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(new RedisValue(expectedJson));

        var cache = CreateCache(memoryCache, withRedis: true);

        // Act
        var result = await cache.GetAsync(query);

        // Assert
        Assert.Equal(expectedJson, result);
        var stats = cache.GetStatistics();
        Assert.Equal(0, stats.L1Hits);
        Assert.Equal(1, stats.L2Hits);
        Assert.Equal(0, stats.Misses);
    }

    [Fact]
    public async Task GetAsync_ReturnsCacheMiss_WhenNotInCache()
    {
        // Arrange
        var query = "recommend games for 4 players";
        var memoryCache = new MemoryCache(new MemoryCacheOptions());

        _mockRedisDb.Setup(r => r.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(RedisValue.Null);

        var cache = CreateCache(memoryCache, withRedis: true);

        // Act
        var result = await cache.GetAsync(query);

        // Assert
        Assert.Null(result);
        var stats = cache.GetStatistics();
        Assert.Equal(0, stats.L1Hits);
        Assert.Equal(0, stats.L2Hits);
        Assert.Equal(1, stats.Misses);
    }

    [Fact]
    public async Task GetAsync_GracefullyHandlesRedisFailure()
    {
        // Arrange
        var query = "recommend games for 4 players";
        var memoryCache = new MemoryCache(new MemoryCacheOptions());

        _mockRedisDb.Setup(r => r.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Connection failed"));

        var cache = CreateCache(memoryCache, withRedis: true);

        // Act
        var result = await cache.GetAsync(query);

        // Assert - should not throw, returns null
        Assert.Null(result);
        var stats = cache.GetStatistics();
        Assert.Equal(1, stats.Misses);
    }

    [Fact]
    public async Task SetAsync_StoresInBothL1AndL2()
    {
        // Arrange
        var query = "recommend games for 4 players";
        var criteriaJson = "{\"MinPlayers\":4,\"MaxPlayers\":4}";
        var memoryCache = new MemoryCache(new MemoryCacheOptions());

        _mockRedisDb.Setup(r => r.StringSetAsync(
            It.IsAny<RedisKey>(),
            It.IsAny<RedisValue>(),
            It.IsAny<TimeSpan?>(),
            It.IsAny<bool>(),
            It.IsAny<When>(),
            It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        var cache = CreateCache(memoryCache, withRedis: true);

        // Act
        await cache.SetAsync(query, criteriaJson);

        // Assert - verify both L1 and L2 were called
        _mockRedisDb.Verify(r => r.StringSetAsync(
            It.IsAny<RedisKey>(),
            It.IsAny<RedisValue>(),
            It.IsAny<TimeSpan?>(),
            It.IsAny<bool>(),
            It.IsAny<When>(),
            It.IsAny<CommandFlags>()), Times.Once);
        
        // Verify L1 by reading back
        var result = await cache.GetAsync(query);
        Assert.Equal(criteriaJson, result);
    }

    [Fact]
    public async Task SetAsync_StoresInL1Only_WhenNoRedis()
    {
        // Arrange
        var query = "recommend games for 4 players";
        var criteriaJson = "{\"MinPlayers\":4,\"MaxPlayers\":4}";
        var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var cache = CreateCache(memoryCache, withRedis: false);

        // Act
        await cache.SetAsync(query, criteriaJson);

        // Assert - verify Redis was NOT called
        _mockRedisDb.Verify(r => r.StringSetAsync(
            It.IsAny<RedisKey>(),
            It.IsAny<RedisValue>(),
            It.IsAny<TimeSpan?>(),
            It.IsAny<bool>(),
            It.IsAny<When>(),
            It.IsAny<CommandFlags>()), Times.Never);
        
        // Verify L1 by reading back
        var result = await cache.GetAsync(query);
        Assert.Equal(criteriaJson, result);
    }

    [Fact]
    public async Task SetAsync_SkipsEmpty_WhenCriteriaJsonIsNull()
    {
        // Arrange
        var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cache = CreateCache(memoryCache, withRedis: false);

        // Act
        await cache.SetAsync("query", string.Empty);

        // Assert - cache should be empty
        var result = await cache.GetAsync("query");
        Assert.Null(result);
    }

    [Theory]
    [InlineData("games for 4 players", "games for 4 players")] // Same query
    [InlineData("Games For 4 Players", "games for 4 players")] // Different case
    public async Task GetAsync_NormalizesQueries_ForConsistentCacheKeys(string query1, string query2)
    {
        // Both queries should hit the same cache key after normalization
        var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cache = CreateCache(memoryCache, withRedis: false);
        var criteriaJson = "{\"MinPlayers\":4,\"MaxPlayers\":4}";

        // Act - set with query1, get with query2
        await cache.SetAsync(query1, criteriaJson);
        var result = await cache.GetAsync(query2);

        // Assert - should find it due to normalization
        Assert.Equal(criteriaJson, result);
    }

    [Fact]
    public void GetStatistics_ReturnsCorrectHitRate()
    {
        // Arrange
        var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cache = CreateCache(memoryCache, withRedis: false);

        // Act
        var stats = cache.GetStatistics();

        // Assert
        Assert.Equal(0, stats.HitRate); // 0 hits, 0 misses = 0 rate
    }

    private CriteriaCache CreateCache(IMemoryCache memoryCache, bool withRedis)
    {
        return new CriteriaCache(
            memoryCache,
            withRedis ? _mockRedis.Object : null,
            _mockLogger.Object,
            null, // telemetry
            null); // config - uses defaults
    }
}
