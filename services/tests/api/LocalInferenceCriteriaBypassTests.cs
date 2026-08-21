using System;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;
using GamerUncle.Api.Models;
using GamerUncle.Api.Services.AgentService;
using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Phase 0 (local-inference experiment) tests:
    /// 1. The <see cref="AgentServiceClient.IsCriteriaEmpty"/> gate that decides whether client-supplied
    ///    criteria are usable (and therefore whether the cloud mini extraction call is bypassed).
    /// 2. The additive, backward-compatible <see cref="UserQuery"/> contract (Criteria / CriteriaSource).
    /// 3. That the moved <see cref="GameQueryCriteria"/> still serializes with its original property names.
    /// </summary>
    public class LocalInferenceCriteriaBypassTests
    {
        // Deserialization mirrors ASP.NET Core's case-insensitive JSON binding.
        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        // ── IsCriteriaEmpty ────────────────────────────────────────────────

        [Fact]
        public void IsCriteriaEmpty_AllFieldsNull_ReturnsTrue()
        {
            Assert.True(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria()));
        }

        [Fact]
        public void IsCriteriaEmpty_WithName_ReturnsFalse()
        {
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { name = "Catan" }));
        }

        [Fact]
        public void IsCriteriaEmpty_WithMinPlayers_ReturnsFalse()
        {
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { MinPlayers = 2 }));
        }

        [Fact]
        public void IsCriteriaEmpty_WithMaxPlayers_ReturnsFalse()
        {
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { MaxPlayers = 4 }));
        }

        [Fact]
        public void IsCriteriaEmpty_WithPlaytime_ReturnsFalse()
        {
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { MinPlaytime = 30 }));
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { MaxPlaytime = 60 }));
        }

        [Fact]
        public void IsCriteriaEmpty_WithMechanics_ReturnsFalse()
        {
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { Mechanics = new[] { "Worker Placement" } }));
        }

        [Fact]
        public void IsCriteriaEmpty_WithCategories_ReturnsFalse()
        {
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { Categories = new[] { "Strategy" } }));
        }

        [Fact]
        public void IsCriteriaEmpty_WithWeightRatingAge_ReturnsFalse()
        {
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { MaxWeight = 2.5 }));
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { averageRating = 7.5 }));
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { ageRequirement = 10 }));
        }

        [Fact]
        public void IsCriteriaEmpty_NonNullEmptyArray_ReturnsFalse_PreservesExistingSemantics()
        {
            // The gate checks `Mechanics == null`, so a non-null (even empty) array counts as "has criteria".
            // This documents/locks the pre-existing behavior unchanged by the refactor.
            Assert.False(AgentServiceClient.IsCriteriaEmpty(new GameQueryCriteria { Mechanics = Array.Empty<string>() }));
        }

        // ── UserQuery backward compatibility ───────────────────────────────

        [Fact]
        public void UserQuery_OldClientPayload_DeserializesWithNullCriteria()
        {
            // An older mobile client sends only Query/UserId/ConversationId — no Criteria fields.
            const string json = @"{""Query"":""suggest games for 4 players"",""UserId"":""u1"",""ConversationId"":""c1""}";

            var q = JsonSerializer.Deserialize<UserQuery>(json, JsonOpts);

            Assert.NotNull(q);
            Assert.Equal("suggest games for 4 players", q!.Query);
            Assert.Equal("u1", q.UserId);
            Assert.Equal("c1", q.ConversationId);
            Assert.Null(q.Criteria);        // additive field defaults to null
            Assert.Null(q.CriteriaSource);
        }

        [Fact]
        public void UserQuery_NewClientPayload_DeserializesCriteriaAndSource()
        {
            const string json = @"{
                ""Query"":""how many players does it support"",
                ""ConversationId"":""c2"",
                ""Criteria"":{""name"":""Catan"",""MinPlayers"":3,""MaxPlayers"":4,""Mechanics"":[""Trading""]},
                ""CriteriaSource"":""on-device""
            }";

            var q = JsonSerializer.Deserialize<UserQuery>(json, JsonOpts);

            Assert.NotNull(q);
            Assert.Equal("on-device", q!.CriteriaSource);
            Assert.NotNull(q.Criteria);
            Assert.Equal("Catan", q.Criteria!.name);
            Assert.Equal(3, q.Criteria.MinPlayers);
            Assert.Equal(4, q.Criteria.MaxPlayers);
            Assert.NotNull(q.Criteria.Mechanics);
            Assert.Contains("Trading", q.Criteria.Mechanics!);
        }

        // ── GameQueryCriteria serialization stability (namespace move) ──────

        [Fact]
        public void GameQueryCriteria_RoundTrips_WithOriginalPropertyNames()
        {
            var criteria = new GameQueryCriteria
            {
                name = "Wingspan",
                MinPlayers = 1,
                MaxPlayers = 5,
                MinPlaytime = 40,
                MaxPlaytime = 70,
                Mechanics = new[] { "Engine Building" },
                Categories = new[] { "Strategy" },
                MaxWeight = 2.5,
                averageRating = 8.1,
                ageRequirement = 10
            };

            var json = JsonSerializer.Serialize(criteria);

            // Property names must be unchanged so the on-device client and server agree on the shape.
            Assert.Contains("\"name\":\"Wingspan\"", json);
            Assert.Contains("\"MinPlayers\":1", json);
            Assert.Contains("\"MaxPlayers\":5", json);
            Assert.Contains("\"Mechanics\":[\"Engine Building\"]", json);
            Assert.Contains("\"averageRating\":8.1", json);
            Assert.Contains("\"ageRequirement\":10", json);

            var back = JsonSerializer.Deserialize<GameQueryCriteria>(json, JsonOpts);
            Assert.NotNull(back);
            Assert.Equal("Wingspan", back!.name);
            Assert.Equal(70, back.MaxPlaytime);
            Assert.Equal(2.5, back.MaxWeight);
        }

        // ── Interface overload accepts criteria (fake path) ────────────────

        [Fact]
        public async Task FakeClient_AcceptsPreExtractedCriteria_AndReturnsResponse()
        {
            IAgentServiceClient fake = new FakeAgentServiceClient();
            var criteria = new GameQueryCriteria { name = "Catan" };

            var result = await fake.GetRecommendationsAsync("Tell me about Catan", null, criteria, "on-device");

            Assert.NotNull(result);
            Assert.False(string.IsNullOrWhiteSpace(result.ResponseText));
        }
    }
}
