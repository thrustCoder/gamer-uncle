using System;
using System.IO;
using System.Linq;
using Xunit;

namespace GamerUncle.Pipeline.Tests
{
    public class PipelineTestValidation
    {
        private readonly string _rootPath;

        public PipelineTestValidation()
        {
            _rootPath = GetSolutionRoot();
        }

        [Fact]
        public void ValidateE2ETestsRemovalIsDocumented()
        {
            // Arrange
            var pipelineConfigPath = Path.Combine(_rootPath, "pipelines", "azure-pipelines.yml");
            var pipelineContent = File.ReadAllText(pipelineConfigPath);

            // Act & Assert
            // Verify E2E tests removal is documented
            Assert.True(pipelineContent.Contains("E2E Tests removed due to reliability issues"), 
                "Pipeline should document that E2E tests were removed");
            
            // Verify FunctionalTestsProd stage exists
            Assert.True(pipelineContent.Contains("stage: FunctionalTestsProd"), 
                "Pipeline should have FunctionalTestsProd stage");
            
            // Verify mobile tests are configured to fail the build on test failures
            Assert.True(pipelineContent.Contains("displayName: 'Run Mobile Tests'"), 
                "Pipeline should have mobile tests step");
            
            // Ensure mobile tests don't have continueOnError (tests should fail the build)
            Assert.False(pipelineContent.Contains("Run Mobile Tests'") && pipelineContent.Contains("continueOnError: true"), 
                "Mobile tests should not have continueOnError - test failures should fail the build");
        }

        /// <summary>
        /// Helper method to find the solution root directory by looking for .sln files
        /// </summary>
        private string GetSolutionRoot()
        {
            var currentDirectory = Directory.GetCurrentDirectory();
            var directory = new DirectoryInfo(currentDirectory);

            while (directory != null)
            {
                if (directory.GetFiles("*.sln").Any())
                {
                    return directory.FullName;
                }
                directory = directory.Parent;
            }

            throw new InvalidOperationException("Could not find solution root directory");
        }
    }
}
