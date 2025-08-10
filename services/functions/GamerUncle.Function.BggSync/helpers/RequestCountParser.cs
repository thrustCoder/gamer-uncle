using System;
using System.Text.Json;

namespace GamerUncle.Functions.Helpers
{
    public static class RequestCountParser
    {
        /// <summary>
        /// Parses an optional count from a JSON request body. Supports either a raw number string (e.g., "500")
        /// or a JSON object with a numeric or string property named "count" (e.g., { "count": 500 }).
        /// Returns null when not provided or invalid. Enforces positive integers only.
        /// </summary>
        public static int? TryParseCountFromJson(string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            var trimmed = body.Trim();

            // Support simple numeric bodies (e.g., "500")
            if (!trimmed.StartsWith("{") && int.TryParse(trimmed, out var directValue) && directValue > 0)
            {
                return directValue;
            }

            try
            {
                using var doc = JsonDocument.Parse(trimmed);
                if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("count", out var countProp))
                {
                    if (countProp.ValueKind == JsonValueKind.Number && countProp.TryGetInt32(out var number) && number > 0)
                    {
                        return number;
                    }

                    if (countProp.ValueKind == JsonValueKind.String)
                    {
                        var s = countProp.GetString();
                        if (int.TryParse(s, out var parsed) && parsed > 0)
                        {
                            return parsed;
                        }
                    }
                }
            }
            catch
            {
                // Ignore JSON parse errors and fall through to null
            }

            return null;
        }
    }
}
