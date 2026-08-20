using System.Collections.Generic;
using System.Text.Json;
using GamerUncle.LocalInference.Eval;
using GamerUncle.LocalInference.Eval.Json;
using Xunit;

namespace GamerUncle.LocalInference.Eval.Tests
{
    public class NanNullDoubleConverterTests
    {
        private static JsonSerializerOptions Options() => new()
        {
            Converters = { new NanNullDoubleConverter() }
        };

        [Fact]
        public void Write_Nan_EmitsNull()
        {
            var json = JsonSerializer.Serialize(double.NaN, Options());
            Assert.Equal("null", json);
        }

        [Theory]
        [InlineData(double.PositiveInfinity)]
        [InlineData(double.NegativeInfinity)]
        public void Write_Infinity_EmitsNull(double value)
        {
            var json = JsonSerializer.Serialize(value, Options());
            Assert.Equal("null", json);
        }

        [Fact]
        public void Write_FiniteValue_EmitsNumber()
        {
            var json = JsonSerializer.Serialize(0.875, Options());
            Assert.Equal("0.875", json);
        }

        [Fact]
        public void Read_Null_ReturnsNaN()
        {
            var value = JsonSerializer.Deserialize<double>("null", Options());
            Assert.True(double.IsNaN(value));
        }

        [Fact]
        public void Read_Number_ReturnsValue()
        {
            var value = JsonSerializer.Deserialize<double>("0.5", Options());
            Assert.Equal(0.5, value);
        }

        [Fact]
        public void Dictionary_WithNaN_SerializesToValidJsonAndRoundTrips()
        {
            var source = new Dictionary<int, double> { [1] = 0.5, [3] = double.NaN };
            var json = JsonSerializer.Serialize(source, Options());

            // Must be valid JSON (the original bug threw here for NaN).
            using var doc = JsonDocument.Parse(json);
            Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("3").ValueKind);
            Assert.Equal(0.5, doc.RootElement.GetProperty("1").GetDouble());

            var back = JsonSerializer.Deserialize<Dictionary<int, double>>(json, Options())!;
            Assert.Equal(0.5, back[1]);
            Assert.True(double.IsNaN(back[3]));
        }

        [Fact]
        public void SharedEvalIoOptions_SerializeNaN_DoesNotThrow()
        {
            // Guards the real regression: scorecards contain NaN recall cells for entries with no
            // relevant games; EvalIo.JsonOptions must serialize them as null rather than throwing.
            var payload = new Dictionary<string, double> { ["recall"] = double.NaN };
            var json = JsonSerializer.Serialize(payload, EvalIo.JsonOptions);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("recall").ValueKind);
        }
    }
}
