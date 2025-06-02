using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;

namespace GamerUncle.Functions
{
    public class Orchestrator
    {
        [Function("SyncBggGamesOrchestrator")]
        public async Task<List<string>> RunOrchestrator(
            [OrchestrationTrigger] TaskOrchestrationContext context,
            FunctionContext rawContext)
        {
            var outputs = new List<string>();

            for (int i = 0; i < 10; i++)
            {
                string result = await context.CallActivityAsync<string>("SyncGameActivity", i);
                outputs.Add(result);
            }

            return outputs;
        }
    }
}
