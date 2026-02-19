namespace GamerUncle.Api.Models
{
    /// <summary>
    /// Server-driven version policy returned by /api/AppConfig.
    /// Used by the mobile app to determine whether a force-upgrade is required.
    /// </summary>
    public class AppVersionPolicy
    {
        /// <summary>
        /// Minimum app version required to use the API.
        /// Clients below this version will be prompted (or forced) to update.
        /// </summary>
        public required string MinVersion { get; set; }

        /// <summary>
        /// Latest available app version in the stores.
        /// </summary>
        public required string LatestVersion { get; set; }

        /// <summary>
        /// App Store / TestFlight URL for iOS upgrades.
        /// </summary>
        public string? UpgradeUrl { get; set; }

        /// <summary>
        /// Play Store URL for Android upgrades.
        /// </summary>
        public string? UpgradeUrlAndroid { get; set; }

        /// <summary>
        /// User-facing message shown in the upgrade prompt.
        /// </summary>
        public string? Message { get; set; }

        /// <summary>
        /// When true, the client must show a blocking modal that prevents use until upgraded.
        /// When false, the client may show a dismissible banner instead.
        /// </summary>
        public bool ForceUpgrade { get; set; }
    }
}
