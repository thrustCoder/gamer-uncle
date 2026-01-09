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
        public void ContinueOnError_ShouldBeUsedAppropriately()
        {
            // Arrange
            var pipelineContent = File.ReadAllText(_pipelineConfigPath);

            // Act & Assert
            // Mobile unit tests should NOT have continueOnError - test failures should fail the build
            var mobileTestSection = GetSectionAfter(pipelineContent, "Running mobile unit tests");
            Assert.IsFalse(mobileTestSection.Contains("continueOnError: true"),
                "Mobile unit tests should NOT have continueOnError: true - test failures should fail the build");
            
            // Verify mobile tests step exists
            Assert.IsTrue(pipelineContent.Contains("displayName: 'Run Mobile Tests'"),
                "Pipeline should have mobile tests step");
                
            // Note: E2E tests have been removed due to reliability issues
            // Verify the removal is documented
            Assert.IsTrue(pipelineContent.Contains("E2E Tests removed due to reliability issues"),
                "Pipeline should document that E2E tests were removed");
        }
        
        /// <summary>
        /// Gets the content after a marker string, up to the next stage or 200 characters
        /// </summary>
        private string GetSectionAfter(string content, string marker)
        {
            var index = content.IndexOf(marker);
            if (index == -1) return string.Empty;
            
            var endIndex = Math.Min(index + 500, content.Length);
            return content.Substring(index, endIndex - index);
        }
    }
}
