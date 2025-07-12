using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.IO;

namespace GamerUncle.Pipeline.Tests
{
    [TestClass]
    public class MobileDependencyTests
    {
        private readonly string _pipelineConfigPath = Path.Combine("..", "..", "..", "..", "azure-pipelines.yml");

        [TestMethod]
        public void Pipeline_ShouldHavePackageLockSyncHandling()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("npm ci --dry-run 2>/dev/null"), 
                "Pipeline should check if package-lock.json is in sync");
            Assert.IsTrue(pipelineContent.Contains("package-lock.json is in sync"), 
                "Pipeline should have sync validation message");
            Assert.IsTrue(pipelineContent.Contains("package-lock.json out of sync"), 
                "Pipeline should handle out-of-sync package-lock.json");
        }

        [TestMethod]
        public void Pipeline_ShouldFallbackToNpmInstall()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("npm install --prefer-offline --no-audit"), 
                "Pipeline should fallback to npm install when npm ci fails");
        }



        [TestMethod]
        public void Pipeline_ShouldHandleDependencyInstallationErrors()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("Dependencies installed successfully"), 
                "Pipeline should confirm successful dependency installation");
            Assert.IsTrue(pipelineContent.Contains("Node modules size"), 
                "Pipeline should report node modules size for diagnostics");
        }

        [TestMethod]
        public void Pipeline_ShouldHaveExpoCLIFallback()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("node_modules/@expo/cli"), 
                "Pipeline should check for local Expo CLI installation");
            Assert.IsTrue(pipelineContent.Contains("installing globally as fallback"), 
                "Pipeline should have global Expo CLI fallback");
            Assert.IsTrue(pipelineContent.Contains("npm install -g @expo/cli@latest"), 
                "Pipeline should install Expo CLI globally if needed");
        }

        [TestMethod]
        public void Pipeline_ShouldValidateEssentialFiles()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("Essential project files missing"), 
                "Pipeline should validate essential project files exist");
            Assert.IsTrue(pipelineContent.Contains("app.json"), 
                "Pipeline should check for app.json");
            Assert.IsTrue(pipelineContent.Contains("App.tsx"), 
                "Pipeline should check for App.tsx");
        }

        [TestMethod]
        public void Pipeline_ShouldSetProductionEnvironment()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("export NODE_ENV=production"), 
                "Pipeline should set NODE_ENV to production for builds");
        }

        [TestMethod]
        public void Pipeline_ShouldHandleBuildArtifacts()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("Build artifacts created successfully"), 
                "Pipeline should confirm successful artifact creation");
            Assert.IsTrue(pipelineContent.Contains("No build artifacts found"), 
                "Pipeline should detect when no artifacts are created");
        }
    }
}
