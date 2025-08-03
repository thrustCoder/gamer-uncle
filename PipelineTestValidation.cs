using System;
using System.IO;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace GamerUncle.PipelineValidation
{
    [TestClass]
    public class PipelineTestValidation
    {
        [TestMethod]
        public void ValidateE2ETestsRemovalIsDocumented()
        {
            // Arrange
            var pipelineConfigPath = Path.Combine("..", "..", "..", "..", "pipelines", "azure-pipelines.yml");
            var pipelineContent = File.ReadAllText(pipelineConfigPath);

            // Act & Assert
            // Verify E2E tests removal is documented
            Assert.IsTrue(pipelineContent.Contains("E2E Tests removed due to reliability issues"), 
                "Pipeline should document that E2E tests were removed");
            
            // Verify FunctionalTestsProd stage exists
            Assert.IsTrue(pipelineContent.Contains("stage: FunctionalTestsProd"), 
                "Pipeline should have FunctionalTestsProd stage");
            
            // Verify mobile tests have continueOnError
            Assert.IsTrue(pipelineContent.Contains("continueOnError: true"), 
                "Pipeline should have continueOnError for appropriate stages");
        }
    }
}
