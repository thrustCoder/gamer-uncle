using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask.Client;

namespace GamerUncle.Functions
{
    public class TimerTriggers
    {
        [Function("ScheduledSyncBggGames")]
        public async Task Run(
            [TimerTrigger("*/30 * * * * *")] TimerInfo myTimer, // Every 30 minutes
            [DurableClient] DurableTaskClient client)
        {
            // This starts your orchestrator automatically
            string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(
                "SyncBggGamesOrchestrator");
        }
    }
}
