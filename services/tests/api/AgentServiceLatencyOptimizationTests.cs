using System.Reflection;
using Xunit;
using GamerUncle.Api.Services.AgentService;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Unit tests for the A5/A6/A7 latency optimizations in AgentServiceClient.
    /// A5: Adaptive polling starts at 200ms (not 50ms) since runs never complete faster.
    /// A6: PersistentAgent objects are cached to avoid GetAgent() HTTP roundtrip per request.
    /// A7: Criteria extraction thread ID is returned so the response agent can reuse it.
    /// </summary>
    public class AgentServiceLatencyOptimizationTests
    {
        /// <summary>
        /// A5: Polling should start at 200ms – the Foundry HTTP roundtrip alone is ~300ms,
        /// so polls at 50/100/150ms always return InProgress and waste ~300ms total.
        /// </summary>
        [Fact]
        public void AdaptivePollDelays_ShouldStartAt200ms()
        {
            // Arrange – read the static field via reflection
            var field = typeof(AgentServiceClient)
                .GetField("AdaptivePollDelaysMs", BindingFlags.NonPublic | BindingFlags.Static);
            Assert.NotNull(field);

            var delays = field.GetValue(null) as int[];

            // Assert
            Assert.NotNull(delays);
            Assert.True(delays!.Length >= 3, "Should have at least 3 polling intervals");
            Assert.Equal(200, delays[0]); // First poll at 200ms, not 50ms
        }

        /// <summary>
        /// A5: No polling interval should be below 200ms – anything lower wastes time
        /// because the AI Foundry HTTP roundtrip is ~300ms minimum.
        /// </summary>
        [Fact]
        public void AdaptivePollDelays_AllIntervalsShouldBeAtLeast200ms()
        {
            var field = typeof(AgentServiceClient)
                .GetField("AdaptivePollDelaysMs", BindingFlags.NonPublic | BindingFlags.Static);
            var delays = (int[])field!.GetValue(null)!;

            foreach (var delay in delays)
            {
                Assert.True(delay >= 200, $"Polling interval {delay}ms is below the 200ms minimum");
            }
        }

        /// <summary>
        /// A5: Polling intervals should increase monotonically (or stay flat) to implement backoff.
        /// </summary>
        [Fact]
        public void AdaptivePollDelays_ShouldBeNonDecreasing()
        {
            var field = typeof(AgentServiceClient)
                .GetField("AdaptivePollDelaysMs", BindingFlags.NonPublic | BindingFlags.Static);
            var delays = (int[])field!.GetValue(null)!;

            for (int i = 1; i < delays.Length; i++)
            {
                Assert.True(delays[i] >= delays[i - 1],
                    $"Poll delay at index {i} ({delays[i]}ms) should be >= previous ({delays[i - 1]}ms)");
            }
        }

        /// <summary>
        /// A6: The agent cache fields should exist and be nullable (populated lazily).
        /// </summary>
        [Fact]
        public void AgentCacheFields_ShouldExistOnClass()
        {
            var criteriaField = typeof(AgentServiceClient)
                .GetField("_cachedCriteriaAgent", BindingFlags.NonPublic | BindingFlags.Instance);
            var responseField = typeof(AgentServiceClient)
                .GetField("_cachedResponseAgent", BindingFlags.NonPublic | BindingFlags.Instance);
            var lockField = typeof(AgentServiceClient)
                .GetField("_agentCacheLock", BindingFlags.NonPublic | BindingFlags.Instance);

            Assert.NotNull(criteriaField);
            Assert.NotNull(responseField);
            Assert.NotNull(lockField);
        }

        /// <summary>
        /// A6: Cache helper methods should exist so GetAgent() is not called every request.
        /// </summary>
        [Fact]
        public void AgentCacheMethods_ShouldExist()
        {
            var getCriteria = typeof(AgentServiceClient)
                .GetMethod("GetCachedCriteriaAgent", BindingFlags.NonPublic | BindingFlags.Instance);
            var getResponse = typeof(AgentServiceClient)
                .GetMethod("GetCachedResponseAgent", BindingFlags.NonPublic | BindingFlags.Instance);

            Assert.NotNull(getCriteria);
            Assert.NotNull(getResponse);
        }

        /// <summary>
        /// A7: ExtractGameCriteriaViaAgent should return a tuple with (criteria, threadId)
        /// so the caller can reuse the criteria thread for the response agent.
        /// </summary>
        [Fact]
        public void ExtractGameCriteriaViaAgent_ShouldReturnTupleWithThreadId()
        {
            var method = typeof(AgentServiceClient)
                .GetMethod("ExtractGameCriteriaViaAgent", BindingFlags.NonPublic | BindingFlags.Instance);

            Assert.NotNull(method);

            // The return type should be Task<(GameQueryCriteria, string?)>
            var returnType = method!.ReturnType;
            Assert.True(returnType.IsGenericType, "Return type should be generic (Task<T>)");

            var innerType = returnType.GetGenericArguments()[0];
            // ValueTuple<GameQueryCriteria, string?> → check it's a ValueTuple with 2 items
            Assert.True(innerType.IsValueType, "Inner type should be a ValueTuple");
            Assert.Equal(2, innerType.GetGenericArguments().Length);
        }

        /// <summary>
        /// A7: The response agent call should accept a threadId parameter that allows thread reuse.
        /// </summary>
        [Fact]
        public void RunAgentWithMessagesAsync_ShouldAcceptThreadIdForReuse()
        {
            var method = typeof(AgentServiceClient)
                .GetMethod("RunAgentWithMessagesAsync", BindingFlags.NonPublic | BindingFlags.Instance);

            Assert.NotNull(method);

            var parameters = method!.GetParameters();
            // Should have: requestPayload, threadId, [cancellationToken]
            Assert.True(parameters.Length >= 2, "Should accept at least requestPayload and threadId");
            Assert.Equal("requestPayload", parameters[0].Name);
            Assert.Equal("threadId", parameters[1].Name);
        }

        /// <summary>
        /// Verify the old inefficient 50ms start delay is no longer present in the codebase.
        /// This is a regression guard to prevent accidentally reverting the optimization.
        /// </summary>
        [Fact]
        public void AdaptivePollDelays_ShouldNotContain50ms()
        {
            var field = typeof(AgentServiceClient)
                .GetField("AdaptivePollDelaysMs", BindingFlags.NonPublic | BindingFlags.Static);
            var delays = (int[])field!.GetValue(null)!;

            Assert.DoesNotContain(50, delays);
            Assert.DoesNotContain(100, delays);
            Assert.DoesNotContain(150, delays);
        }
    }
}
