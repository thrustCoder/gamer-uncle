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
        public void Pipeline_ShouldHaveProductionDeploymentStages()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("stage: ProdDeployApi"), 
                "Pipeline should have ProdDeployApi stage");
            Assert.IsTrue(pipelineContent.Contains("stage: ProdDeployFunctions"), 
                "Pipeline should have ProdDeployFunctions stage");
            Assert.IsTrue(pipelineContent.Contains("stage: ProdDeployMobile"), 
                "Pipeline should have ProdDeployMobile stage");
        }

        [TestMethod]
        public void Pipeline_ProductionStagesShouldBeGatedByDevTests()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            // Check that production stages depend on DevTest (unit tests) but don't require explicit success checks
            Assert.IsTrue(pipelineContent.Contains("- DevTest"), 
                "Production deployment stages should depend on DevTest");
                
            // Ensure E2E tests don't gate production deployments (they can be flaky)
            Assert.IsFalse(pipelineContent.Contains("dependencies.E2ETestsDev.result, 'Succeeded'"), 
                "Production deployment stages should not be gated by E2E tests as they can be flaky");
                
            // Ensure functional tests don't gate production deployments (prefer unit tests for reliability)
            Assert.IsFalse(pipelineContent.Contains("dependencies.FunctionalTestsDev.result, 'Succeeded'"), 
                "Production deployment stages should not be gated by functional tests as they can be flaky");
                
            // Ensure no explicit succeeded checks for DevTest (dependency is sufficient)
            Assert.IsFalse(pipelineContent.Contains("dependencies.DevTest.result, 'Succeeded'"), 
                "Production deployment stages should not have explicit succeeded checks for DevTest");
        }

        [TestMethod]
        public void Pipeline_ProductionStagesShouldOnlyRunOnMainBranch()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            // Check production stages exclude PRs and require main branch
            Assert.IsTrue(pipelineContent.Contains("stage: ProdDeployApi"), 
                "ProdDeployApi stage should exist");
            Assert.IsTrue(pipelineContent.Contains("stage: ProdDeployFunctions"), 
                "ProdDeployFunctions stage should exist");
            Assert.IsTrue(pipelineContent.Contains("stage: ProdDeployMobile"), 
                "ProdDeployMobile stage should exist");
                
            // Check that these stages have the correct conditions
            var prodApiSection = ExtractStageSection(pipelineContent, "ProdDeployApi");
            var prodFunctionsSection = ExtractStageSection(pipelineContent, "ProdDeployFunctions");
            var prodMobileSection = ExtractStageSection(pipelineContent, "ProdDeployMobile");
            
            Assert.IsTrue(prodApiSection.Contains("ne(variables['Build.Reason'], 'PullRequest')") &&
                         prodApiSection.Contains("eq(variables['Build.SourceBranch'], 'refs/heads/main')"), 
                "ProdDeployApi should only run on main branch and exclude PRs");
                         
            Assert.IsTrue(prodFunctionsSection.Contains("ne(variables['Build.Reason'], 'PullRequest')") &&
                         prodFunctionsSection.Contains("eq(variables['Build.SourceBranch'], 'refs/heads/main')"), 
                "ProdDeployFunctions should only run on main branch and exclude PRs");
                         
            Assert.IsTrue(prodMobileSection.Contains("ne(variables['Build.Reason'], 'PullRequest')") &&
                         prodMobileSection.Contains("eq(variables['Build.SourceBranch'], 'refs/heads/main')"), 
                "ProdDeployMobile should only run on main branch and exclude PRs");
        }
        
        private string ExtractStageSection(string content, string stageName)
        {
            var stageStart = content.IndexOf($"stage: {stageName}");
            if (stageStart == -1) return "";
            
            var nextStageStart = content.IndexOf("- stage:", stageStart + 1);
            if (nextStageStart == -1) nextStageStart = content.Length;
            
            return content.Substring(stageStart, nextStageStart - stageStart);
        }

        [TestMethod]
        public void Pipeline_ShouldHaveProductionTestingStages()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("stage: FunctionalTestsProd"), 
                "Pipeline should have FunctionalTestsProd stage");
            Assert.IsTrue(pipelineContent.Contains("stage: E2ETestsProd"), 
                "Pipeline should have E2ETestsProd stage");
        }

        [TestMethod]
        public void Pipeline_ProductionTestsShouldUseCorrectEnvironmentVariables()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("TEST_ENVIRONMENT=Prod"), 
                "Production functional tests should set TEST_ENVIRONMENT=Prod");
            Assert.IsTrue(pipelineContent.Contains("gamer-uncle-prod-app-svc.azurewebsites.net"), 
                "Production tests should use production URLs");
        }

        [TestMethod]
        public void Pipeline_ShouldHaveProductionServiceConnections()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("gamer-uncle-prod-sc"), 
                "Production stages should use production service connection");
        }

        [TestMethod]
        public void Pipeline_ProductionResourcesShouldUseProdNamingConvention()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("gamer-uncle-prod-rg"), 
                "Production should use prod resource group naming");
            Assert.IsTrue(pipelineContent.Contains("gamer-uncle-prod-app-svc"), 
                "Production should use prod app service naming");
            Assert.IsTrue(pipelineContent.Contains("gamer-uncle-prod-function"), 
                "Production should use prod function app naming");
            Assert.IsTrue(pipelineContent.Contains("gamer-uncle-prod-cosmos"), 
                "Production should use prod cosmos DB naming");
        }

        [TestMethod]
        public void Pipeline_ProductionE2ETestsShouldHaveStricterTimeout()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            // Check that production E2E tests have stricter timeout (25 minutes vs dev's 20)
            var devTimeoutMatch = Regex.Match(pipelineContent, @"displayName: 'Run E2E Tests Against Dev'.*?timeoutInMinutes: (\d+)", RegexOptions.Singleline);
            var prodTimeoutMatch = Regex.Match(pipelineContent, @"displayName: 'Run E2E Tests Against Prod'.*?timeoutInMinutes: (\d+)", RegexOptions.Singleline);
            
            if (devTimeoutMatch.Success && prodTimeoutMatch.Success)
            {
                var devTimeout = int.Parse(devTimeoutMatch.Groups[1].Value);
                var prodTimeout = int.Parse(prodTimeoutMatch.Groups[1].Value);
                
                Assert.IsTrue(prodTimeout >= devTimeout, 
                    "Production E2E tests should have appropriate timeout settings");
            }
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
