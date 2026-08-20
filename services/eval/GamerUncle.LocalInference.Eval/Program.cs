using GamerUncle.LocalInference.Eval;
using GamerUncle.LocalInference.Eval.Extractors;
using GamerUncle.LocalInference.Eval.Models;
using GamerUncle.LocalInference.Eval.Scoring;

// ---------------------------------------------------------------------------
// Local-inference criteria eval harness (Phase 1).
//
// Scores a criteria extractor against a fixed gold set, producing field-level
// agreement + recall@k. Phase 1 ships a deterministic replay extractor: predictions
// are captured once (e.g. from cloud gpt-4.1-mini) and committed next to the gold set.
// Phases 2/5 plug the on-device extractor behind the same ICriteriaExtractor.
//
//   dotnet run --project services/eval/GamerUncle.LocalInference.Eval -- \
//       --predictions data/predictions/cloud-mini-baseline.jsonl --label cloud-mini-baseline
// ---------------------------------------------------------------------------

var argMap = ParseArgs(args);

string goldPath = Resolve(argMap.GetValueOrDefault("gold"), "gold-set.jsonl");
string gamesPath = Resolve(argMap.GetValueOrDefault("games"), "games-snapshot.json");
string predictionsPath = Resolve(
    argMap.GetValueOrDefault("predictions"),
    Path.Combine("predictions", "cloud-mini-baseline.jsonl"));
string label = argMap.GetValueOrDefault("label")
    ?? Path.GetFileNameWithoutExtension(predictionsPath);
string outDir = argMap.GetValueOrDefault("out") ?? "eval-output";
int[] ks = ParseKs(argMap.GetValueOrDefault("k"));

foreach (var (name, path) in new[] { ("gold", goldPath), ("games", gamesPath), ("predictions", predictionsPath) })
{
    if (!File.Exists(path))
    {
        Console.Error.WriteLine($"error: {name} file not found: {path}");
        return 1;
    }
}

var gold = EvalIo.LoadJsonl<GoldEntry>(goldPath);
var games = EvalIo.LoadGames(gamesPath);
var predictions = EvalIo.LoadJsonl<PredictionEntry>(predictionsPath);

Console.WriteLine($"Loaded {gold.Count} gold entries, {games.Count} games, {predictions.Count} predictions.");

var extractor = new ReplayExtractor(label, predictions);
var card = await EvalRunner.RunAsync(gold, extractor, games, ks);

Directory.CreateDirectory(outDir);
var jsonPath = Path.Combine(outDir, $"scorecard.{label}.json");
var mdPath = Path.Combine(outDir, $"summary.{label}.md");
EvalIo.SaveJson(jsonPath, card);
File.WriteAllText(mdPath, ReportWriter.ToMarkdown(card));

Console.WriteLine();
Console.WriteLine(ReportWriter.ToMarkdown(card));
Console.WriteLine($"Wrote {jsonPath}");
Console.WriteLine($"Wrote {mdPath}");
return 0;

static Dictionary<string, string> ParseArgs(string[] args)
{
    var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (int i = 0; i < args.Length; i++)
    {
        if (!args[i].StartsWith("--")) continue;
        var key = args[i][2..];
        var value = (i + 1 < args.Length && !args[i + 1].StartsWith("--")) ? args[++i] : "true";
        map[key] = value;
    }
    return map;
}

// Resolve a path: explicit override wins; otherwise look in the copied ./data folder,
// then fall back to the source data folder so `dotnet run` works from the repo without a build copy.
static string Resolve(string? overridePath, string relativeToData)
{
    if (!string.IsNullOrEmpty(overridePath)) return overridePath;

    var candidates = new[]
    {
        Path.Combine(AppContext.BaseDirectory, "data", relativeToData),
        Path.Combine(Directory.GetCurrentDirectory(), "data", relativeToData),
    };
    return candidates.FirstOrDefault(File.Exists) ?? candidates[0];
}

static int[] ParseKs(string? raw)
{
    if (string.IsNullOrWhiteSpace(raw) || raw == "true") return RecallScorer.DefaultKs;
    return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
              .Select(int.Parse)
              .ToArray();
}
