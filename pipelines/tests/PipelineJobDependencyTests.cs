using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.IO;
using System.Text.RegularExpressions;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace GamerUncle.Pipeline.Tests
{
    [TestClass]
    public class PipelineJobDependencyTests
    {
        private readonly string _pipelineConfigPath = Path.Combine("..", "..", "..", "..", "azure-pipelines.yml");

        [TestMethod]
        public void BuildApiJob_ShouldHaveCorrectDependency()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            var buildApiJobPattern = @"job:\s*BuildApiJob[\s\S]*?dependsOn:\s*BuildMobileJob";
            Assert.IsTrue(Regex.IsMatch(pipelineContent, buildApiJobPattern), 
                "BuildApiJob should depend on BuildMobileJob");
        }

        [TestMethod]
        public void BuildApiJob_ShouldCheckMobileBuildResult()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("in(dependencies.BuildMobileJob.result, 'Succeeded', 'SucceededWithIssues')"),
                "BuildApiJob should check if BuildMobileJob succeeded or succeeded with issues");
        }



        [TestMethod]
        public void FunctionalTestsPR_ShouldDependOnDevBuild()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            var functionalTestStagePattern = @"stage:\s*FunctionalTestsPR[\s\S]*?dependsOn:\s*DevBuild";
            Assert.IsTrue(Regex.IsMatch(pipelineContent, functionalTestStagePattern),
                "FunctionalTestsPR stage should depend on DevBuild stage");
        }

        [TestMethod]
        public void DevTest_ShouldDependOnDevBuild()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            var devTestStagePattern = @"stage:\s*DevTest[\s\S]*?dependsOn:\s*DevBuild";
            Assert.IsTrue(Regex.IsMatch(pipelineContent, devTestStagePattern),
                "DevTest stage should depend on DevBuild stage");
        }

        [TestMethod]
        public void DevBuild_ShouldDependOnValidationForPRs()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            var devBuildStagePattern = @"stage:\s*DevBuild[\s\S]*?dependsOn:[\s\S]*?-\s*Validation";
            Assert.IsTrue(Regex.IsMatch(pipelineContent, devBuildStagePattern),
                "DevBuild stage should depend on Validation stage");
        }

        [TestMethod]
        public void ValidationStage_ShouldOnlyRunForPRs()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            var validationStagePattern = @"stage:\s*Validation[\s\S]*?condition:\s*eq\(variables\['Build\.Reason'\],\s*'PullRequest'\)";
            Assert.IsTrue(Regex.IsMatch(pipelineContent, validationStagePattern),
                "Validation stage should only run for Pull Requests");
        }

        [TestMethod]
        public void DeploymentStages_ShouldNotRunForPRs()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("ne(variables['Build.Reason'], 'PullRequest')"),
                "Deployment stages should not run for Pull Requests");
        }

        [TestMethod]
        public void AllStages_ShouldHaveValidConditions()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act
            var stageConditions = Regex.Matches(pipelineContent, @"condition:\s*\|[\s\S]*?(?=\s*jobs:)");

            // Assert
            Assert.IsTrue(stageConditions.Count > 0, "Pipeline should have conditional stages");
            
            foreach (Match condition in stageConditions)
            {
                var conditionText = condition.Value;
                // Ensure conditions have proper syntax
                Assert.IsFalse(conditionText.Contains("variables[Build.Reason]"), 
                    "Condition should use proper variable syntax with quotes");
            }
        }

        [TestMethod]
        public void Pipeline_ShouldHaveCorrectBranchTriggers()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            Assert.IsTrue(pipelineContent.Contains("eq(variables['Build.SourceBranchName'], 'main')"),
                "Pipeline should check for main branch");
            Assert.IsTrue(pipelineContent.Contains("eq(variables['Build.Reason'], 'PullRequest')"),
                "Pipeline should check for pull request trigger");
        }

        [TestMethod]
        public void ContinueOnError_ShouldBeUsedAppropriately()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            // E2E tests should continue on error to gather results
            var e2eTestPattern = @"Run E2E Tests[\s\S]*?continueOnError:\s*true";
            Assert.IsTrue(Regex.IsMatch(pipelineContent, e2eTestPattern),
                "E2E tests should have continueOnError: true");
            
            // Mobile unit tests should continue on error
            var mobileTestPattern = @"Running mobile unit tests[\s\S]*?continueOnError:\s*true";
            Assert.IsTrue(Regex.IsMatch(pipelineContent, mobileTestPattern),
                "Mobile unit tests should have continueOnError: true");
        }
    }
}
