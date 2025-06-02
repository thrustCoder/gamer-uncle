using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.DurableTask;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;

namespace GamerUncle.Functions
{
    public class SyncGameActivity
    {
        [Function("SyncGameActivity")]
        public async Task Run(
            [ActivityTrigger] int gameId,
            FunctionContext context,
            ILogger logger)
        {
            logger.LogInformation($"Syncing game with ID: {gameId}");
            // TODO: Use DefaultAzureCredential to connect to Cosmos and sync game data
        }
    }
}
