using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using GamerUncle.Mcp.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace GamerUncle.Mcp.Tests
{
    public class ConversationStateServiceTests
    {
        private ConversationStateService CreateService(int maxHistory = 5, int lifetimeHours = 2)
        {
            var inMemoryConfig = new Dictionary<string, string?>
            {
                {"Mcp:MaxQueryHistorySize", maxHistory.ToString()},
                {"Mcp:ConversationLifetimeHours", lifetimeHours.ToString()}
            };
            IConfiguration config = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemoryConfig!)
                .Build();
            return new ConversationStateService(new NullLogger<ConversationStateService>(), config);
        }

        [Fact]
        public void GetOrCreateConversation_ReturnsSameInstance_ForSameId()
        {
            var service = CreateService();
            var c1 = service.GetOrCreateConversation("abc");
            var c2 = service.GetOrCreateConversation("abc");
            Assert.Same(c1, c2);
            Assert.Equal("abc", c1.ConversationId);
        }

        [Fact]
        public void UpdateConversation_AddsHistoryEntriesAndRespectsLimit()
        {
            var service = CreateService(maxHistory: 3);
            var convo = service.GetOrCreateConversation("conv1");

            for (int i = 0; i < 5; i++)
            {
                service.UpdateConversation("conv1", $"q{i}", $"r{i}");
            }

            Assert.Equal(3, convo.QueryHistory.Count); // limited
            Assert.Equal("q2", convo.QueryHistory[0].Query); // oldest retained should be q2
            Assert.Equal("q4", convo.QueryHistory[^1].Query);
        }

        [Fact]
        public void UpdateConversation_SetsThreadId_WhenProvided()
        {
            var service = CreateService();
            var convo = service.GetOrCreateConversation("conv2");
            service.UpdateConversation("conv2", "question", "answer", threadId: "thread-123");
            Assert.Single(convo.QueryHistory);
            Assert.Equal("thread-123", convo.QueryHistory[0].ThreadId);
        }

        [Fact]
        public void CleanupExpiredConversations_RemovesOldOnes()
        {
            // Use very small lifetime to simulate expiration
            var service = CreateService(lifetimeHours: 0); // 0 hours -> immediate expiration window (UTC now - 0 hours)
            var convo = service.GetOrCreateConversation("old");
            // Manually backdate last activity to guarantee expiration
            convo.LastActivityAt = DateTime.UtcNow.AddHours(-1);

            service.CleanupExpiredConversations();

            // After cleanup, requesting again should create a new instance
            var newConvo = service.GetOrCreateConversation("old");
            Assert.NotSame(convo, newConvo);
        }

        [Fact]
        public void UpdateConversation_DoesNothing_ForMissingConversation()
        {
            var service = CreateService();
            // Not calling GetOrCreateConversation first; update should do nothing
            service.UpdateConversation("missing", "q", "r");
            var newInstance = service.GetOrCreateConversation("missing");
            Assert.Empty(newInstance.QueryHistory); // ensure history wasn't pre-populated
        }
    }
}
