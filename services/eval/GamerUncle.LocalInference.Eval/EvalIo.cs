using System.Text.Json;
using GamerUncle.LocalInference.Eval.Json;
using GamerUncle.LocalInference.Eval.Models;
using GamerUncle.Shared.Models;

namespace GamerUncle.LocalInference.Eval
{
    /// <summary>File loading/saving helpers for the eval harness.</summary>
    public static class EvalIo
    {
        public static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            WriteIndented = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            Converters = { new NanNullDoubleConverter() }
        };

        /// <summary>Loads a JSON Lines file (one object per non-empty line), tolerant of blank lines and comments.</summary>
        public static List<T> LoadJsonl<T>(string path)
        {
            var results = new List<T>();
            foreach (var raw in File.ReadLines(path))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("//") || line.StartsWith("#")) continue;
                var item = JsonSerializer.Deserialize<T>(line, JsonOptions);
                if (item != null) results.Add(item);
            }
            return results;
        }

        /// <summary>Loads a games snapshot: a JSON array of GameDocument.</summary>
        public static List<GameDocument> LoadGames(string path)
        {
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<List<GameDocument>>(json, JsonOptions) ?? new List<GameDocument>();
        }

        public static void SaveJson<T>(string path, T value)
        {
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(path, JsonSerializer.Serialize(value, JsonOptions));
        }
    }
}
