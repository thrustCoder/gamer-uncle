using System.Collections.Generic;
using System.Linq;
using GamerUncle.Api.Services.Cosmos;
using GamerUncle.Shared.Models;
using Xunit;

namespace GamerUncle.Api.Tests
{
    /// <summary>
    /// Tests for <see cref="CosmosDbService.BuildWhereClause"/>, the RAG filter builder that
    /// turns extracted <see cref="GameQueryCriteria"/> into a Cosmos SQL WHERE clause.
    ///
    /// Regression context: the criteria extraction emits everyday shorthand words such as
    /// "Cooperative", "Strategy", and "Mystery", but the database stores BoardGameGeek's
    /// canonical taxonomy ("Cooperative Game", "Abstract Strategy", "Murder / Mystery").
    /// The previous exact ARRAY_CONTAINS match returned zero games for those queries. The
    /// fix does a case-insensitive SUBSTRING match over each array element, which these
    /// tests lock in.
    /// </summary>
    public class CosmosDbServiceBuildWhereClauseTests
    {
        // ── Mechanics / Categories (the regression fix) ─────────────────────

        [Fact]
        public void SingleCategory_UsesCaseInsensitiveSubstringMatch_NotExactArrayContains()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(
                new GameQueryCriteria { Categories = new string[] { "Cooperative" } });

            // Must NOT use the old exact-match operator that misses "Cooperative Game".
            Assert.DoesNotContain("ARRAY_CONTAINS", where);

            // Must use a correlated EXISTS + CONTAINS substring match over both arrays.
            Assert.Contains("EXISTS(SELECT VALUE m FROM m IN c.mechanics WHERE CONTAINS(LOWER(m), LOWER(@term0)))", where);
            Assert.Contains("EXISTS(SELECT VALUE cat FROM cat IN c.categories WHERE CONTAINS(LOWER(cat), LOWER(@term0)))", where);

            // Term is passed through verbatim (trimmed); LOWER() in SQL handles casing.
            Assert.Equal("Cooperative", parameters["@term0"]);
        }

        [Fact]
        public void SingleMechanic_ProducesSubstringMatchClause()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(
                new GameQueryCriteria { Mechanics = new string[] { "hand management" } });

            Assert.Contains("CONTAINS(LOWER(m), LOWER(@term0))", where);
            Assert.Contains("CONTAINS(LOWER(cat), LOWER(@term0))", where);
            Assert.Equal("hand management", parameters["@term0"]);
        }

        [Fact]
        public void MechanicsAndCategories_AreCombinedWithOr_EachTermGetsOwnParameter()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(new GameQueryCriteria
            {
                Mechanics = new string[] { "Cooperative" },
                Categories = new string[] { "Mystery" }
            });

            Assert.Equal("Cooperative", parameters["@term0"]);
            Assert.Equal("Mystery", parameters["@term1"]);

            // The two terms are OR-ed together inside a single parenthesized condition.
            Assert.Contains("@term0", where);
            Assert.Contains("@term1", where);
            Assert.Contains(" OR ", where);
        }

        [Fact]
        public void SearchTerms_AreTrimmed()
        {
            var (_, parameters) = CosmosDbService.BuildWhereClause(
                new GameQueryCriteria { Categories = new string[] { "  Strategy  " } });

            Assert.Equal("Strategy", parameters["@term0"]);
        }

        [Fact]
        public void BlankOrWhitespaceSearchTerms_AreIgnored()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(new GameQueryCriteria
            {
                Categories = new string[] { "", "   ", null! },
                Mechanics = new string[] { "" }
            });

            Assert.Equal(string.Empty, where);
            Assert.Empty(parameters);
        }

        // ── Numeric / name filters (unchanged behavior, guard against regressions) ──

        [Fact]
        public void EmptyCriteria_ProducesNoWhereClause()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(new GameQueryCriteria());

            Assert.Equal(string.Empty, where);
            Assert.Empty(parameters);
        }

        [Fact]
        public void Name_UsesCaseInsensitiveContains()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(
                new GameQueryCriteria { name = "Catan" });

            Assert.Contains("CONTAINS(LOWER(c.name), LOWER(@name))", where);
            Assert.Equal("Catan", parameters["@name"]);
        }

        [Fact]
        public void PlayerRange_ProducesOverlapCondition()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(
                new GameQueryCriteria { MinPlayers = 8, MaxPlayers = 8 });

            Assert.Contains("c.maxPlayers >= @minPlayers AND c.minPlayers <= @maxPlayers", where);
            Assert.Equal(8, parameters["@minPlayers"]);
            Assert.Equal(8, parameters["@maxPlayers"]);
        }

        [Fact]
        public void MinPlayersOnly_ProducesMaxPlayersCondition()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(
                new GameQueryCriteria { MinPlayers = 6 });

            Assert.Contains("c.maxPlayers >= @minPlayers", where);
            Assert.Equal(6, parameters["@minPlayers"]);
            Assert.False(parameters.ContainsKey("@maxPlayers"));
        }

        [Fact]
        public void MaxPlaytimeOnly_ProducesMinPlaytimeCondition()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(
                new GameQueryCriteria { MaxPlaytime = 60 });

            Assert.Contains("c.minPlaytime <= @maxPlaytime", where);
            Assert.Equal(60, parameters["@maxPlaytime"]);
        }

        [Fact]
        public void MaxWeight_AverageRating_AgeRequirement_ProduceExpectedConditions()
        {
            var (where, parameters) = CosmosDbService.BuildWhereClause(new GameQueryCriteria
            {
                MaxWeight = 3.0,
                averageRating = 7.5,
                ageRequirement = 10
            });

            Assert.Contains("c.weight <= @maxWeight", where);
            Assert.Contains("c.averageRating >= @averageRating", where);
            Assert.Contains("c.ageRequirement <= @ageRequirement", where);
            Assert.Equal(3.0, parameters["@maxWeight"]);
            Assert.Equal(7.5, parameters["@averageRating"]);
            Assert.Equal(10, parameters["@ageRequirement"]);
        }

        [Fact]
        public void CombinedCriteria_AreJoinedWithAnd_AndStartWithWhere()
        {
            // "mystery games for 6 players that take less than 60 minutes" — the exact shape
            // that returned zero games in production before the fix.
            var (where, parameters) = CosmosDbService.BuildWhereClause(new GameQueryCriteria
            {
                MinPlayers = 6,
                MaxPlayers = 6,
                MaxPlaytime = 60,
                Categories = new string[] { "Mystery" }
            });

            Assert.StartsWith(" WHERE ", where);
            Assert.Contains(" AND ", where);
            Assert.Contains("c.maxPlayers >= @minPlayers AND c.minPlayers <= @maxPlayers", where);
            Assert.Contains("c.minPlaytime <= @maxPlaytime", where);
            Assert.Contains("CONTAINS(LOWER(cat), LOWER(@term0))", where);
            Assert.Equal("Mystery", parameters["@term0"]);
        }
    }
}

