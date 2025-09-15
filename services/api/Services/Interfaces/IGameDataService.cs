using GamerUncle.Shared.Models;

namespace GamerUncle.Api.Services.Interfaces
{
    public interface IGameDataService
    {
        /// <summary>
        /// Retrieves game data for voice session preload context
        /// </summary>
        /// <param name="gameId">The BGG game ID (with bgg- prefix)</param>
        /// <returns>Game document if found, null otherwise</returns>
        Task<GameDocument?> GetGameForVoiceSessionAsync(string gameId);
        
        /// <summary>
        /// Validates if a game ID exists and can be used for voice sessions
        /// </summary>
        /// <param name="gameId">The BGG game ID (with bgg- prefix)</param>
        /// <returns>True if game exists and is suitable for voice sessions</returns>
        Task<bool> ValidateGameForVoiceSessionAsync(string gameId);
    }
}