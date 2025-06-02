using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.DurableTask;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace GamerUncle.Functions
{
    public class Orchestrator
    {
        [Function("SyncBggGamesOrchestrator")]
        public async Task RunOrchestrator(
            [OrchestrationTrigger] FunctionContext context,
            [DurableClient] IDurableOrchestrationClient starter,
            ILogger log)
        {
            var tasks = new List<Task>();
            for (int i = 0; i < 10; i++)
            {
                tasks.Add(context.CallActivityAsync("SyncGameActivity", i));
            }
            await Task.WhenAll(tasks);
        }
    }
}
