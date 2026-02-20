using Azure;
using GamerUncle.Api.Services.Resilience;
using Microsoft.Extensions.Logging;
using Moq;
using Polly.Timeout;
using StackExchange.Redis;
using Xunit;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Unit tests for ResiliencePolicyProvider — Finding #6 (Polly timeout + retry).
    /// Tests verify policy creation, retry behavior on transient errors, timeout enforcement,
    /// and non-retry on non-transient errors.
    /// </summary>
    public class ResiliencePolicyProviderTests
    {
        private readonly Mock<ILogger<ResiliencePolicyProvider>> _mockLogger;
        private readonly ResilienceSettings _defaultSettings;

        public ResiliencePolicyProviderTests()
        {
            _mockLogger = new Mock<ILogger<ResiliencePolicyProvider>>();
            _defaultSettings = new ResilienceSettings
            {
                AgentCallTimeoutSeconds = 5, // Short timeout for tests
                AgentCallMaxRetries = 2,
                AgentCallRetryBaseDelaySeconds = 0.05, // Very short for tests (50ms)
                RedisMaxRetries = 2,
                RedisRetryBaseDelayMs = 10 // Very short for tests
            };
        }

        [Fact]
        public void Constructor_CreatesNonNullPolicies()
        {
            var provider = CreateProvider();

            Assert.NotNull(provider.AgentCallPolicy);
            Assert.NotNull(provider.RedisOperationPolicy);
        }

        [Fact]
        public void Constructor_NullSettings_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() =>
                new ResiliencePolicyProvider(null!, _mockLogger.Object));
        }

        [Fact]
        public void Constructor_NullLogger_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() =>
                new ResiliencePolicyProvider(_defaultSettings, null!));
        }

        [Fact]
        public async Task AgentCallPolicy_SuccessfulCall_ReturnsResult()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act
            var result = await provider.AgentCallPolicy.ExecuteAsync(async ct =>
            {
                callCount++;
                await Task.Delay(1, ct);
                return "success";
            }, CancellationToken.None);

            // Assert
            Assert.Equal("success", result);
            Assert.Equal(1, callCount);
        }

        [Fact]
        public async Task AgentCallPolicy_TransientError_RetriesAndSucceeds()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act — fail twice with transient 502, then succeed
            var result = await provider.AgentCallPolicy.ExecuteAsync(async ct =>
            {
                callCount++;
                await Task.Delay(1, ct);
                if (callCount <= 2)
                {
                    throw new RequestFailedException(502, "Bad Gateway");
                }
                return "success after retries";
            }, CancellationToken.None);

            // Assert — should have been called 3 times (1 initial + 2 retries)
            Assert.Equal("success after retries", result);
            Assert.Equal(3, callCount);
        }

        [Fact]
        public async Task AgentCallPolicy_429Error_RetriesAndSucceeds()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act — fail once with 429, then succeed
            var result = await provider.AgentCallPolicy.ExecuteAsync(async ct =>
            {
                callCount++;
                await Task.Delay(1, ct);
                if (callCount == 1)
                {
                    throw new RequestFailedException(429, "Too Many Requests");
                }
                return "success";
            }, CancellationToken.None);

            // Assert
            Assert.Equal("success", result);
            Assert.Equal(2, callCount);
        }

        [Fact]
        public async Task AgentCallPolicy_NonTransientError_DoesNotRetry()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act & Assert — 400 Bad Request is NOT transient, should not retry
            var ex = await Assert.ThrowsAsync<RequestFailedException>(async () =>
            {
                await provider.AgentCallPolicy.ExecuteAsync(async ct =>
                {
                    callCount++;
                    await Task.Delay(1, ct);
                    throw new RequestFailedException(400, "Bad Request");
                }, CancellationToken.None);
            });

            Assert.Equal(400, ex.Status);
            Assert.Equal(1, callCount); // Should NOT have retried
        }

        [Fact]
        public async Task AgentCallPolicy_AllRetriesFail_ThrowsException()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act & Assert — all 3 attempts (1 + 2 retries) fail with transient errors
            await Assert.ThrowsAsync<RequestFailedException>(async () =>
            {
                await provider.AgentCallPolicy.ExecuteAsync(async ct =>
                {
                    callCount++;
                    await Task.Delay(1, ct);
                    throw new RequestFailedException(503, "Service Unavailable");
                }, CancellationToken.None);
            });

            // Assert — 1 initial + 2 retries = 3 total attempts
            Assert.Equal(3, callCount);
        }

        [Fact]
        public async Task AgentCallPolicy_TimeoutExceeded_ThrowsTimeoutRejectedException()
        {
            // Arrange — very short timeout
            var settings = new ResilienceSettings
            {
                AgentCallTimeoutSeconds = 1, // 1 second timeout
                AgentCallMaxRetries = 0, // No retries so we isolate timeout behavior
                AgentCallRetryBaseDelaySeconds = 0.05
            };
            var provider = new ResiliencePolicyProvider(settings, _mockLogger.Object);

            // Act & Assert — call that takes longer than timeout
            await Assert.ThrowsAsync<TimeoutRejectedException>(async () =>
            {
                await provider.AgentCallPolicy.ExecuteAsync(async ct =>
                {
                    // This should be cancelled by Polly's timeout
                    await Task.Delay(TimeSpan.FromSeconds(10), ct);
                    return "should not reach here";
                }, CancellationToken.None);
            });
        }

        [Fact]
        public async Task AgentCallPolicy_PessimisticTimeout_ForciblyAbandonsHungCall()
        {
            // Arrange — simulates the exact production scenario where Azure SDK
            // ignores CancellationToken and the call hangs indefinitely.
            // Pessimistic timeout must forcibly abandon it.
            var settings = new ResilienceSettings
            {
                AgentCallTimeoutSeconds = 1, // 1 second timeout
                AgentCallMaxRetries = 0, // No retries so we isolate timeout behavior
                AgentCallRetryBaseDelaySeconds = 0.05
            };
            var provider = new ResiliencePolicyProvider(settings, _mockLogger.Object);
            var delegateStarted = new TaskCompletionSource<bool>();

            // Act & Assert — delegate ignores CancellationToken (simulating hung Azure SDK call)
            await Assert.ThrowsAsync<TimeoutRejectedException>(async () =>
            {
                await provider.AgentCallPolicy.ExecuteAsync(async ct =>
                {
                    delegateStarted.SetResult(true);
                    // Simulate a hung call that ignores CancellationToken entirely
                    // (using Thread.Sleep instead of Task.Delay to avoid honoring ct)
                    await Task.Run(() => Thread.Sleep(TimeSpan.FromSeconds(30)));
                    return "should not reach here";
                }, CancellationToken.None);
            });

            // Verify the delegate was actually started (ensures Pessimistic kicked in)
            Assert.True(await delegateStarted.Task);
        }

        [Fact]
        public async Task AgentCallPolicy_TimeoutTriggersRetry()
        {
            // Arrange — timeout triggers, then retry succeeds quickly
            var settings = new ResilienceSettings
            {
                AgentCallTimeoutSeconds = 1, // 1 second timeout
                AgentCallMaxRetries = 1, // 1 retry
                AgentCallRetryBaseDelaySeconds = 0.01
            };
            var provider = new ResiliencePolicyProvider(settings, _mockLogger.Object);
            var callCount = 0;

            // Act
            var result = await provider.AgentCallPolicy.ExecuteAsync(async ct =>
            {
                callCount++;
                if (callCount == 1)
                {
                    // First call times out
                    await Task.Delay(TimeSpan.FromSeconds(10), ct);
                }
                // Second call returns quickly
                return "success after timeout retry";
            }, CancellationToken.None);

            // Assert
            Assert.Equal("success after timeout retry", result);
            Assert.Equal(2, callCount);
        }

        [Fact]
        public async Task RedisOperationPolicy_RedisException_RetriesAndSucceeds()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act
            var result = await provider.RedisOperationPolicy.ExecuteAsync(async () =>
            {
                callCount++;
                await Task.Delay(1);
                if (callCount == 1)
                {
                    throw new RedisException("Connection lost");
                }
                return "redis success";
            });

            // Assert
            Assert.Equal("redis success", result);
            Assert.Equal(2, callCount);
        }

        [Fact]
        public async Task RedisOperationPolicy_AllRetriesFail_ThrowsRedisException()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act & Assert
            await Assert.ThrowsAsync<RedisException>(async () =>
            {
                await provider.RedisOperationPolicy.ExecuteAsync(async () =>
                {
                    callCount++;
                    await Task.Delay(1);
                    throw new RedisException("Persistent failure");
                });
            });

            // Assert — 1 initial + 2 retries = 3 total attempts
            Assert.Equal(3, callCount);
        }

        [Fact]
        public async Task RedisOperationPolicy_NonRedisException_DoesNotRetry()
        {
            // Arrange
            var provider = CreateProvider();
            var callCount = 0;

            // Act & Assert — InvalidOperationException is NOT handled by the Redis policy
            await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            {
                await provider.RedisOperationPolicy.ExecuteAsync(async () =>
                {
                    callCount++;
                    await Task.Delay(1);
                    throw new InvalidOperationException("Not a Redis error");
                });
            });

            Assert.Equal(1, callCount);
        }

        [Fact]
        public void IsTransientHttpError_TransientCodes_ReturnsTrue()
        {
            Assert.True(ResiliencePolicyProvider.IsTransientHttpError(408));
            Assert.True(ResiliencePolicyProvider.IsTransientHttpError(429));
            Assert.True(ResiliencePolicyProvider.IsTransientHttpError(502));
            Assert.True(ResiliencePolicyProvider.IsTransientHttpError(503));
            Assert.True(ResiliencePolicyProvider.IsTransientHttpError(504));
        }

        [Fact]
        public void IsTransientHttpError_NonTransientCodes_ReturnsFalse()
        {
            Assert.False(ResiliencePolicyProvider.IsTransientHttpError(400));
            Assert.False(ResiliencePolicyProvider.IsTransientHttpError(401));
            Assert.False(ResiliencePolicyProvider.IsTransientHttpError(403));
            Assert.False(ResiliencePolicyProvider.IsTransientHttpError(404));
            Assert.False(ResiliencePolicyProvider.IsTransientHttpError(500));
            Assert.False(ResiliencePolicyProvider.IsTransientHttpError(200));
        }

        [Fact]
        public void ResilienceSettings_DefaultValues_AreCorrect()
        {
            var settings = new ResilienceSettings();

            Assert.Equal(15, settings.AgentCallTimeoutSeconds);
            Assert.Equal(1, settings.AgentCallMaxRetries);
            Assert.Equal(1.0, settings.AgentCallRetryBaseDelaySeconds);
            Assert.Equal(2, settings.RedisMaxRetries);
            Assert.Equal(100, settings.RedisRetryBaseDelayMs);
        }

        [Fact]
        public void ResilienceSettings_SectionName_IsCorrect()
        {
            Assert.Equal("Resilience", ResilienceSettings.SectionName);
        }

        private ResiliencePolicyProvider CreateProvider()
        {
            return new ResiliencePolicyProvider(_defaultSettings, _mockLogger.Object);
        }
    }
}
