using System;
using System.Threading.Tasks;
using GamerUncle.Api.Services.Interfaces;
using GamerUncle.Api.Services.ThreadMapping;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace GamerUncle.Api.Tests
{
    public class ThreadMappingStoreTests
    {
        #region InMemoryThreadMappingStore Tests

        [Fact]
        public async Task InMemory_SetAndGet_ReturnsStoredThreadId()
        {
            // Arrange
            var store = CreateInMemoryStore();

            // Act
            await store.SetThreadIdAsync("conv-1", "thread_abc");
            var result = await store.GetThreadIdAsync("conv-1");

            // Assert
            Assert.Equal("thread_abc", result);
        }

        [Fact]
        public async Task InMemory_GetNonExistent_ReturnsNull()
        {
            var store = CreateInMemoryStore();

            var result = await store.GetThreadIdAsync("nonexistent");

            Assert.Null(result);
        }

        [Fact]
        public async Task InMemory_Remove_DeletesMapping()
        {
            var store = CreateInMemoryStore();
            await store.SetThreadIdAsync("conv-1", "thread_abc");

            await store.RemoveAsync("conv-1");
            var result = await store.GetThreadIdAsync("conv-1");

            Assert.Null(result);
        }

        [Fact]
        public async Task InMemory_OverwriteMapping_ReturnsLatest()
        {
            var store = CreateInMemoryStore();
            await store.SetThreadIdAsync("conv-1", "thread_old");
            await store.SetThreadIdAsync("conv-1", "thread_new");

            var result = await store.GetThreadIdAsync("conv-1");

            Assert.Equal("thread_new", result);
        }

        [Fact]
        public async Task InMemory_NullConversationId_ReturnsNull()
        {
            var store = CreateInMemoryStore();

            var result = await store.GetThreadIdAsync(null!);

            Assert.Null(result);
        }

        [Fact]
        public async Task InMemory_EmptyConversationId_ReturnsNull()
        {
            var store = CreateInMemoryStore();

            var result = await store.GetThreadIdAsync("");

            Assert.Null(result);
        }

        [Fact]
        public async Task InMemory_SetWithNullValues_DoesNotThrow()
        {
            var store = CreateInMemoryStore();

            // Should not throw
            await store.SetThreadIdAsync(null!, "thread_abc");
            await store.SetThreadIdAsync("conv-1", null!);

            // Neither should be stored
            var result1 = await store.GetThreadIdAsync(null!);
            var result2 = await store.GetThreadIdAsync("conv-1");
            Assert.Null(result1);
            Assert.Null(result2);
        }

        [Fact]
        public async Task InMemory_RemoveNonExistent_DoesNotThrow()
        {
            var store = CreateInMemoryStore();

            // Should not throw
            await store.RemoveAsync("nonexistent");
        }

        [Fact]
        public async Task InMemory_ExpiredEntry_ReturnsNull()
        {
            // Arrange — TTL of 0 minutes means entries expire immediately
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ThreadMapping:TtlMinutes"] = "0"
                })
                .Build();
            var store = new InMemoryThreadMappingStore(
                NullLogger<InMemoryThreadMappingStore>.Instance, config);

            await store.SetThreadIdAsync("conv-1", "thread_abc");

            // Wait a tick so the entry expires (TTL = 0 minutes → immediate expiry)
            await Task.Delay(10);

            var result = await store.GetThreadIdAsync("conv-1");

            Assert.Null(result);
        }

        [Fact]
        public async Task InMemory_MultipleConversations_IndependentMappings()
        {
            var store = CreateInMemoryStore();
            await store.SetThreadIdAsync("conv-1", "thread_a");
            await store.SetThreadIdAsync("conv-2", "thread_b");
            await store.SetThreadIdAsync("conv-3", "thread_c");

            Assert.Equal("thread_a", await store.GetThreadIdAsync("conv-1"));
            Assert.Equal("thread_b", await store.GetThreadIdAsync("conv-2"));
            Assert.Equal("thread_c", await store.GetThreadIdAsync("conv-3"));
        }

        #endregion

        #region RedisThreadMappingStore Tests

        [Fact]
        public async Task Redis_SetAndGet_ReturnsStoredThreadId()
        {
            // Arrange
            var (store, mockDb) = CreateRedisStoreWithMock();
            var storedValue = new RedisValue("thread_abc");

            mockDb.Setup(db => db.StringSetAsync(
                    It.Is<RedisKey>(k => k.ToString().Contains("conv-1")),
                    It.Is<RedisValue>(v => v.ToString() == "thread_abc"),
                    It.IsAny<TimeSpan?>(),
                    It.IsAny<bool>(),
                    It.IsAny<When>(),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(true);

            mockDb.Setup(db => db.StringGetAsync(
                    It.Is<RedisKey>(k => k.ToString().Contains("conv-1")),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(storedValue);

            mockDb.Setup(db => db.KeyExpireAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<TimeSpan?>(),
                    It.IsAny<ExpireWhen>(),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(true);

            // Act
            await store.SetThreadIdAsync("conv-1", "thread_abc");
            var result = await store.GetThreadIdAsync("conv-1");

            // Assert
            Assert.Equal("thread_abc", result);
        }

        [Fact]
        public async Task Redis_GetNonExistent_ReturnsNull()
        {
            var (store, mockDb) = CreateRedisStoreWithMock();

            mockDb.Setup(db => db.StringGetAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(RedisValue.Null);

            var result = await store.GetThreadIdAsync("nonexistent");

            Assert.Null(result);
        }

        [Fact]
        public async Task Redis_Remove_CallsKeyDelete()
        {
            var (store, mockDb) = CreateRedisStoreWithMock();

            mockDb.Setup(db => db.KeyDeleteAsync(
                    It.Is<RedisKey>(k => k.ToString().Contains("conv-1")),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(true);

            await store.RemoveAsync("conv-1");

            mockDb.Verify(db => db.KeyDeleteAsync(
                It.Is<RedisKey>(k => k.ToString().Contains("conv-1")),
                It.IsAny<CommandFlags>()), Times.Once);
        }

        [Fact]
        public async Task Redis_GetWithRedisError_ReturnsNullGracefully()
        {
            var (store, mockDb) = CreateRedisStoreWithMock();

            mockDb.Setup(db => db.StringGetAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<CommandFlags>()))
                .ThrowsAsync(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Connection failed"));

            // Should return null instead of throwing
            var result = await store.GetThreadIdAsync("conv-1");

            Assert.Null(result);
        }

        [Fact]
        public async Task Redis_SetWithRedisError_DoesNotThrow()
        {
            var (store, mockDb) = CreateRedisStoreWithMock();

            mockDb.Setup(db => db.StringSetAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<RedisValue>(),
                    It.IsAny<TimeSpan?>(),
                    It.IsAny<bool>(),
                    It.IsAny<When>(),
                    It.IsAny<CommandFlags>()))
                .ThrowsAsync(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Connection failed"));

            // Should not throw
            await store.SetThreadIdAsync("conv-1", "thread_abc");
        }

        [Fact]
        public async Task Redis_NullConversationId_ReturnsNull()
        {
            var (store, _) = CreateRedisStoreWithMock();

            var result = await store.GetThreadIdAsync(null!);

            Assert.Null(result);
        }

        [Fact]
        public async Task Redis_EmptyConversationId_ReturnsNull()
        {
            var (store, _) = CreateRedisStoreWithMock();

            var result = await store.GetThreadIdAsync("");

            Assert.Null(result);
        }

        [Fact]
        public async Task Redis_Set_UsesCorrectKeyPrefix()
        {
            var (store, mockDb) = CreateRedisStoreWithMock();
            RedisKey? capturedKey = null;

            mockDb.Setup(db => db.StringSetAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<RedisValue>(),
                    It.IsAny<TimeSpan?>(),
                    It.IsAny<bool>(),
                    It.IsAny<When>(),
                    It.IsAny<CommandFlags>()))
                .Callback<RedisKey, RedisValue, TimeSpan?, bool, When, CommandFlags>((key, val, exp, kaw, when, flags) =>
                {
                    capturedKey = key;
                })
                .ReturnsAsync(true);

            await store.SetThreadIdAsync("my-conversation", "thread_xyz");

            Assert.NotNull(capturedKey);
            Assert.StartsWith("thread:", capturedKey.Value.ToString());
            Assert.Contains("my-conversation", capturedKey.Value.ToString());
        }

        [Fact]
        public async Task Redis_Set_UsesTtl()
        {
            var (store, mockDb) = CreateRedisStoreWithMock();
            TimeSpan? capturedTtl = null;

            mockDb.Setup(db => db.StringSetAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<RedisValue>(),
                    It.IsAny<TimeSpan?>(),
                    It.IsAny<bool>(),
                    It.IsAny<When>(),
                    It.IsAny<CommandFlags>()))
                .Callback<RedisKey, RedisValue, TimeSpan?, bool, When, CommandFlags>((key, val, exp, kaw, when, flags) =>
                {
                    capturedTtl = exp;
                })
                .ReturnsAsync(true);

            await store.SetThreadIdAsync("conv-1", "thread_abc");

            Assert.NotNull(capturedTtl);
            Assert.Equal(TimeSpan.FromMinutes(120), capturedTtl.Value);
        }

        [Fact]
        public async Task Redis_Get_RefreshesTtlOnAccess()
        {
            var (store, mockDb) = CreateRedisStoreWithMock();

            mockDb.Setup(db => db.StringGetAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(new RedisValue("thread_abc"));

            mockDb.Setup(db => db.KeyExpireAsync(
                    It.IsAny<RedisKey>(),
                    It.IsAny<TimeSpan?>(),
                    It.IsAny<ExpireWhen>(),
                    It.IsAny<CommandFlags>()))
                .ReturnsAsync(true);

            await store.GetThreadIdAsync("conv-1");

            mockDb.Verify(db => db.KeyExpireAsync(
                It.IsAny<RedisKey>(),
                It.Is<TimeSpan?>(ts => ts.HasValue && ts.Value == TimeSpan.FromMinutes(120)),
                It.IsAny<ExpireWhen>(),
                It.IsAny<CommandFlags>()), Times.Once);
        }

        #endregion

        #region Helpers

        private static InMemoryThreadMappingStore CreateInMemoryStore(int? ttlMinutes = null)
        {
            var configData = new Dictionary<string, string?>();
            if (ttlMinutes.HasValue)
            {
                configData["ThreadMapping:TtlMinutes"] = ttlMinutes.Value.ToString();
            }
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(configData)
                .Build();

            return new InMemoryThreadMappingStore(
                NullLogger<InMemoryThreadMappingStore>.Instance,
                config);
        }

        private static (RedisThreadMappingStore store, Mock<IDatabase> mockDb) CreateRedisStoreWithMock()
        {
            var mockDb = new Mock<IDatabase>();
            var mockMultiplexer = new Mock<IConnectionMultiplexer>();
            mockMultiplexer.Setup(m => m.GetDatabase(It.IsAny<int>(), It.IsAny<object>()))
                .Returns(mockDb.Object);

            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ThreadMapping:TtlMinutes"] = "120"
                })
                .Build();

            var store = new RedisThreadMappingStore(
                mockMultiplexer.Object,
                NullLogger<RedisThreadMappingStore>.Instance,
                telemetry: null,
                config: config);

            return (store, mockDb);
        }

        #endregion
    }
}
