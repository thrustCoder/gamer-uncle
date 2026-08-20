using System.Text.Json;
using System.Text.Json.Serialization;

namespace GamerUncle.LocalInference.Eval.Json
{
    /// <summary>
    /// Serializes <see cref="double"/> values, writing non-finite values (NaN / +/-Infinity) as JSON
    /// <c>null</c> instead of throwing. The eval harness uses <see cref="double.NaN"/> to mean
    /// "undefined" (e.g. recall@k for an entry with no relevant games), which is not representable in
    /// strict JSON; mapping it to <c>null</c> keeps scorecards valid and readable. On read, a JSON
    /// <c>null</c> maps back to <see cref="double.NaN"/> so the semantics round-trip.
    /// </summary>
    public sealed class NanNullDoubleConverter : JsonConverter<double>
    {
        public override double Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
            {
                return double.NaN;
            }

            return reader.GetDouble();
        }

        public override void Write(Utf8JsonWriter writer, double value, JsonSerializerOptions options)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                writer.WriteNullValue();
            }
            else
            {
                writer.WriteNumberValue(value);
            }
        }
    }
}
