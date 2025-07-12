using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.IO;
using System.Text.RegularExpressions;

namespace GamerUncle.Pipeline.Tests
{
    [TestClass]
    public class PipelineConfigurationTests
    {
        private readonly string _pipelineConfigPath = Path.Combine("..", "..", "..", "..", "azure-pipelines.yml");

        [TestMethod]
        public void Pipeline_ShouldHaveValidationStageForPRs()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("stage: Validation"), 
                "Pipeline should have a Validation stage");
            Assert.IsTrue(pipelineContent.Contains("condition: eq(variables['Build.Reason'], 'PullRequest')"), 
                "Validation stage should only run for PRs");
        }



        [TestMethod]
        public void Pipeline_ShouldUseCIOptimizedNpmInstall()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("npm ci --prefer-offline --no-audit"), 
                "Pipeline should use npm ci instead of npm install for better CI performance");
        }

        [TestMethod]
        public void Pipeline_ShouldHaveProperJobDependencies()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("dependsOn: BuildMobileJob"), 
                "BuildApiJob should depend on BuildMobileJob");
            Assert.IsTrue(pipelineContent.Contains("in(dependencies.BuildMobileJob.result, 'Succeeded', 'SucceededWithIssues')"), 
                "BuildApiJob should check mobile build result");
        }

        [TestMethod]
        public void Pipeline_ShouldHaveEnvironmentVariablesForE2ETests()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("export CI=true"), 
                "E2E tests should set CI environment variable");
            Assert.IsTrue(pipelineContent.Contains("export NODE_ENV=test"), 
                "E2E tests should set NODE_ENV to test");
        }



        [TestMethod]
        public void Pipeline_ShouldHaveValidBuildSteps()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            // Validate mobile build process
            Assert.IsTrue(pipelineContent.Contains("export NODE_ENV=production"), 
                "Mobile build should set NODE_ENV to production");
            
            // Validate API build process
            Assert.IsTrue(pipelineContent.Contains("dotnet build $(apiProject)"), 
                "Pipeline should build API project");
                
            // Validate function build process
            Assert.IsTrue(pipelineContent.Contains("dotnet build $(functionAppProject)"), 
                "Pipeline should build function project");
        }

        [TestMethod]
        public void Pipeline_ShouldHaveErrorHandlingInBuildSteps()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("if [ ! -f \"app.json\" ]"), 
                "Mobile build should validate essential files exist");
            Assert.IsTrue(pipelineContent.Contains("echo \"❌"), 
                "Pipeline should have error indicators");
            Assert.IsTrue(pipelineContent.Contains("echo \"✅"), 
                "Pipeline should have success indicators");
        }

        [TestMethod]
        public void Pipeline_ShouldUseCorrectNodeVersion()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("versionSpec: '18.x'"), 
                "Pipeline should use Node.js 18.x");
        }

        [TestMethod]
        public void Pipeline_ShouldHaveCorrectTriggerConfiguration()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("trigger:"), 
                "Pipeline should have trigger configuration");
            Assert.IsTrue(pipelineContent.Contains("pr:"), 
                "Pipeline should have PR trigger configuration");
            Assert.IsTrue(pipelineContent.Contains("- main"), 
                "Pipeline should trigger on main branch");
        }
    }
}
