using System.Threading.RateLimiting;
using GamerUncle.Api.Services.RateLimiting;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Unit tests for RedisFixedWindowRateLimiter — Finding #5 (distributed rate limiting).
    /// Tests cover: permit acquisition, rejection with retry-after, fail-open on Redis errors,
    /// fail-open on Redis disconnection, and window key generation.
    /// </summary>
    public class RedisFixedWindowRateLimiterTests
    {
        private readonly Mock<IConnectionMultiplexer> _mockRedis;
        private readonly Mock<IDatabase> _mockDatabase;
        private readonly Mock<ILogger<RedisFixedWindowRateLimiter>> _mockLogger;
        private readonly RedisFixedWindowRateLimiterOptions _defaultOptions;

        public RedisFixedWindowRateLimiterTests()
        {
            _mockRedis = new Mock<IConnectionMultiplexer>();
            _mockDatabase = new Mock<IDatabase>();
            _mockLogger = new Mock<ILogger<RedisFixedWindowRateLimiter>>();

            _mockRedis.Setup(r => r.IsConnected).Returns(true);
            _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>()))
                .Returns(_mockDatabase.Object);

            _defaultOptions = new RedisFixedWindowRateLimiterOptions
            {
                PolicyName = "TestPolicy",
                PartitionKey = "127.0.0.1",
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1)
            };
        }

        [Fact]
        public void AttemptAcquire_WithinLimit_ReturnsAcquiredLease()
        {
            // Arrange — script returns count 1 (within limit of 5)
            _mockDatabase
                .Setup(d => d.ScriptEvaluate(
                    It.IsAny<string>(),
                    It.IsAny<RedisKey[]?>(),
                    It.IsAny<RedisValue[]?>(),
                    It.IsAny<CommandFlags>()))
                .Returns(RedisResult.Create((RedisValue)1L));

            var limiter = CreateLimiter();

            // Act
            using var lease = limiter.AttemptAcquire(1);

            // Assert
            Assert.True(lease.IsAcquired);
        }

        [Fact]
        public void AttemptAcquire_AtExactLimit_ReturnsAcquiredLease()
        {
            // Arrange — count equals permit limit
            _mockDatabase
                .Setup(d => d.ScriptEvaluate(
                    It.IsAny<string>(),
                    It.IsAny<RedisKey[]?>(),
                    It.IsAny<RedisValue[]?>(),
                    It.IsAny<CommandFlags>()))
                .Returns(RedisResult.Create((RedisValue)5L));

            var limiter = CreateLimiter();

            // Act
            using var lease = limiter.AttemptAcquire(1);

            // Assert
            Assert.True(lease.IsAcquired);
        }

        [Fact]
        public void AttemptAcquire_ExceedsLimit_ReturnsRejectedLeaseWithRetryAfter()
        {
            // Arrange — count exceeds permit limit
            _mockDatabase
                .Setup(d => d.ScriptEvaluate(
                    It.IsAny<string>(),
                    It.IsAny<RedisKey[]?>(),
                    It.IsAny<RedisValue[]?>(),
                    It.IsAny<CommandFlags>()))
                .Returns(RedisResult.Create((RedisValue)6L));

            var limiter = CreateLimiter();

            // Act
            using var lease = limiter.AttemptAcquire(1);

            // Assert
            Assert.False(lease.IsAcquired);
            Assert.True(lease.TryGetMetadata(MetadataName.RetryAfter.Name, out var retryAfter));
            Assert.IsType<TimeSpan>(retryAfter);
            Assert.True(((TimeSpan)retryAfter!).TotalSeconds >= 1);
        }

        [Fact]
        public void AttemptAcquire_RedisDisconnected_FailsOpen()
        {
            // Arrange — Redis reports disconnected
            _mockRedis.Setup(r => r.IsConnected).Returns(false);
            var limiter = CreateLimiter();

            // Act
            using var lease = limiter.AttemptAcquire(1);

            // Assert — should allow the request (fail-open)
            Assert.True(lease.IsAcquired);
        }

        [Fact]
        public void AttemptAcquire_RedisThrowsException_FailsOpen()
        {
            // Arrange — Redis throws an exception during script evaluation
            _mockDatabase
                .Setup(d => d.ScriptEvaluate(
                    It.IsAny<string>(),
                    It.IsAny<RedisKey[]?>(),
                    It.IsAny<RedisValue[]?>(),
                    It.IsAny<CommandFlags>()))
                .Throws(new RedisException("Connection reset"));

            var limiter = CreateLimiter();

            // Act
            using var lease = limiter.AttemptAcquire(1);

            // Assert — should allow the request (fail-open)
            Assert.True(lease.IsAcquired);
        }

        [Fact]
        public async Task AcquireAsync_WithinLimit_ReturnsAcquiredLease()
        {
            // Arrange
            _mockDatabase
                .Setup(d => d.ScriptEvaluateAsync(
                    It.IsAny<string>(),
                    It.IsAny<RedisKey[]?>(),
                    It.IsAny<RedisValue[]?>(),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(RedisResult.Create((RedisValue)3L));

            var limiter = CreateLimiter();

            // Act
            using var lease = await limiter.AcquireAsync(1);

            // Assert
            Assert.True(lease.IsAcquired);
        }

        [Fact]
        public async Task AcquireAsync_ExceedsLimit_ReturnsRejectedLease()
        {
            // Arrange
            _mockDatabase
                .Setup(d => d.ScriptEvaluateAsync(
                    It.IsAny<string>(),
                    It.IsAny<RedisKey[]?>(),
                    It.IsAny<RedisValue[]?>(),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(RedisResult.Create((RedisValue)10L));

            var limiter = CreateLimiter();

            // Act
            using var lease = await limiter.AcquireAsync(1);

            // Assert
            Assert.False(lease.IsAcquired);
        }

        [Fact]
        public async Task AcquireAsync_RedisDisconnected_FailsOpen()
        {
            // Arrange
            _mockRedis.Setup(r => r.IsConnected).Returns(false);
            var limiter = CreateLimiter();

            // Act
            using var lease = await limiter.AcquireAsync(1);

            // Assert
            Assert.True(lease.IsAcquired);
        }

        [Fact]
        public async Task AcquireAsync_RedisThrowsException_FailsOpen()
        {
            // Arrange
            _mockDatabase
                .Setup(d => d.ScriptEvaluateAsync(
                    It.IsAny<string>(),
                    It.IsAny<RedisKey[]?>(),
                    It.IsAny<RedisValue[]?>(),
                    It.IsAny<CommandFlags>()))
                .ThrowsAsync(new RedisTimeoutException("Timeout waiting for response", CommandStatus.WaitingToBeSent));

            var limiter = CreateLimiter();

            // Act
            using var lease = await limiter.AcquireAsync(1);

            // Assert
            Assert.True(lease.IsAcquired);
        }

        [Fact]
        public void GetWindowKey_GeneratesConsistentFormat()
        {
            // Arrange
            var limiter = CreateLimiter();

            // Act
            var key = limiter.GetWindowKey();

            // Assert — key should contain policy name, partition key, and a numeric window ID
            Assert.StartsWith("ratelimit:TestPolicy:127.0.0.1:", key);
            var windowId = key.Split(':').Last();
            Assert.True(long.TryParse(windowId, out _), "Window ID should be a numeric value");
        }

        [Fact]
        public void GetWindowKey_SameWindow_ReturnsSameKey()
        {
            // Arrange
            var limiter = CreateLimiter();

            // Act — call twice within the same time window
            var key1 = limiter.GetWindowKey();
            var key2 = limiter.GetWindowKey();

            // Assert
            Assert.Equal(key1, key2);
        }

        [Fact]
        public void GetStatistics_ReturnsNull()
        {
            // Distributed statistics are not implemented
            var limiter = CreateLimiter();
            Assert.Null(limiter.GetStatistics());
        }

        [Fact]
        public void IdleDuration_ReturnsZero()
        {
            var limiter = CreateLimiter();
            Assert.Equal(TimeSpan.Zero, limiter.IdleDuration);
        }

        [Fact]
        public void AttemptAcquire_VerifiesScriptContainsIncrAndExpire()
        {
            // Verify the Lua script uses INCR and EXPIRE for atomic rate limiting
            Assert.Contains("INCR", RedisFixedWindowRateLimiter.IncrementScript);
            Assert.Contains("EXPIRE", RedisFixedWindowRateLimiter.IncrementScript);
        }

        [Fact]
        public void Constructor_NullRedis_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() =>
                new RedisFixedWindowRateLimiter(null!, _defaultOptions, _mockLogger.Object));
        }

        [Fact]
        public void Constructor_NullOptions_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() =>
                new RedisFixedWindowRateLimiter(_mockRedis.Object, null!, _mockLogger.Object));
        }

        [Fact]
        public void Constructor_NullLogger_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() =>
                new RedisFixedWindowRateLimiter(_mockRedis.Object, _defaultOptions, null!));
        }

        private RedisFixedWindowRateLimiter CreateLimiter()
        {
            return new RedisFixedWindowRateLimiter(
                _mockRedis.Object, _defaultOptions, _mockLogger.Object);
        }
    }
}
