using GamerUncle.Functions.Helpers;
using Xunit;

namespace GamerUncle.Functions.Tests
{
    public class RequestCountParserTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("not-json")] // invalid
        [InlineData("{\"notcount\":123}")]
        [InlineData("{\"count\":-1}")]
        public void TryParseCountFromJson_ReturnsNull_ForInvalid(string? body)
        {
            var result = RequestCountParser.TryParseCountFromJson(body);
            Assert.Null(result);
        }

        [Theory]
        [InlineData("500", 500)]
        [InlineData("  2500  ", 2500)]
        [InlineData("{\"count\":500}", 500)]
        [InlineData("{\"count\":\"1500\"}", 1500)]
        public void TryParseCountFromJson_ParsesValidInputs(string body, int expected)
        {
            var result = RequestCountParser.TryParseCountFromJson(body);
            Assert.NotNull(result);
            Assert.Equal(expected, result!.Value);
        }
    }
}
