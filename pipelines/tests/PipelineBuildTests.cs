using System;
using System.IO;
using System.Threading.Tasks;
using Xunit;
using System.Text.Json;
using System.Linq;

namespace GamerUncle.Pipeline.Tests
{
    /// <summary>
    /// Unit tests for validating pipeline build configurations and project structure
    /// </summary>
    public class PipelineBuildTests
    {
        private readonly string _rootPath;

        public PipelineBuildTests()
        {
            // Get the solution root directory
            _rootPath = GetSolutionRoot();
        }

        [Fact]
        public void MobilePackageJson_ShouldExist_AndContainRequiredScripts()
        {
            // Arrange
            var packageJsonPath = Path.Combine(_rootPath, "apps", "mobile", "package.json");

            // Act & Assert
            Assert.True(File.Exists(packageJsonPath), "Mobile package.json should exist");

            var packageJsonContent = File.ReadAllText(packageJsonPath);
            var packageJson = JsonDocument.Parse(packageJsonContent);

            // Verify required scripts exist
            Assert.True(packageJson.RootElement.TryGetProperty("scripts", out var scripts), 
                "Package.json should contain scripts section");

            Assert.True(scripts.TryGetProperty("start", out _), 
                "Package.json should contain 'start' script");

            Assert.True(scripts.TryGetProperty("web", out _), 
                "Package.json should contain 'web' script");
        }

        [Fact]
        public void MobileAppJson_ShouldExist_AndContainExpoConfiguration()
        {
            // Arrange
            var appJsonPath = Path.Combine(_rootPath, "apps", "mobile", "app.json");

            // Act & Assert
            Assert.True(File.Exists(appJsonPath), "Mobile app.json should exist");

            var appJsonContent = File.ReadAllText(appJsonPath);
            var appJson = JsonDocument.Parse(appJsonContent);

            // Verify expo configuration
            Assert.True(appJson.RootElement.TryGetProperty("expo", out var expo), 
                "App.json should contain expo configuration");

            Assert.True(expo.TryGetProperty("name", out _), 
                "Expo configuration should contain app name");

            Assert.True(expo.TryGetProperty("slug", out _), 
                "Expo configuration should contain app slug");
        }

        [Fact]
        public void ApiProject_ShouldExist_AndBeValidCsprojFile()
        {
            // Arrange
            var apiProjectPath = Path.Combine(_rootPath, "services", "api", "GamerUncle.Api.csproj");

            // Act & Assert
            Assert.True(File.Exists(apiProjectPath), "API project file should exist");

            var projectContent = File.ReadAllText(apiProjectPath);

            // Verify it's a valid .NET project
            Assert.Contains("<Project", projectContent);
            Assert.Contains("Sdk=", projectContent);
            Assert.Contains("TargetFramework", projectContent);
        }

        [Fact]
        public void FunctionProject_ShouldExist_AndBeValidCsprojFile()
        {
            // Arrange
            var functionProjectPath = Path.Combine(_rootPath, "services", "functions", 
                "GamerUncle.Function.BggSync", "GamerUncle.Function.BggSync.csproj");

            // Act & Assert
            Assert.True(File.Exists(functionProjectPath), "Function project file should exist");

            var projectContent = File.ReadAllText(functionProjectPath);

            // Verify it's a valid .NET project
            Assert.Contains("<Project", projectContent);
            Assert.Contains("Sdk=", projectContent);
            Assert.Contains("TargetFramework", projectContent);
        }

        [Fact]
        public void PipelineYaml_ShouldExist_AndContainRequiredSections()
        {
            // Arrange
            var pipelineYamlPath = Path.Combine(_rootPath, "pipelines", "azure-pipelines.yml");

            // Act & Assert
            Assert.True(File.Exists(pipelineYamlPath), "Pipeline YAML file should exist");

            var pipelineContent = File.ReadAllText(pipelineYamlPath);

            // Verify required sections
            Assert.Contains("trigger:", pipelineContent);
            Assert.Contains("pr:", pipelineContent);
            Assert.Contains("stages:", pipelineContent);
            Assert.Contains("jobs:", pipelineContent);
        }

        [Fact]
        public void PipelineYaml_ShouldContain_PathBasedTriggers()
        {
            // Arrange
            var pipelineYamlPath = Path.Combine(_rootPath, "pipelines", "azure-pipelines.yml");

            // Act & Assert
            Assert.True(File.Exists(pipelineYamlPath), "Pipeline YAML file should exist");

            var pipelineContent = File.ReadAllText(pipelineYamlPath);

            // Verify path-based triggers exist
            Assert.Contains("paths:", pipelineContent);
            Assert.Contains("services/api/*", pipelineContent);
            Assert.Contains("services/functions/*", pipelineContent);
            Assert.Contains("apps/mobile/*", pipelineContent);
        }

        [Fact]
        public void PipelineYaml_ShouldContain_MobileBuildJob()
        {
            // Arrange
            var pipelineYamlPath = Path.Combine(_rootPath, "pipelines", "azure-pipelines.yml");

            // Act & Assert
            Assert.True(File.Exists(pipelineYamlPath), "Pipeline YAML file should exist");

            var pipelineContent = File.ReadAllText(pipelineYamlPath);

            // Verify mobile-specific content
            Assert.Contains("BuildMobileJob", pipelineContent);
            Assert.Contains("NodeTool@0", pipelineContent);
            Assert.Contains("npm install", pipelineContent);
            Assert.Contains("expo export", pipelineContent);
            Assert.Contains("dropMobile", pipelineContent);
        }

        [Fact]
        public void PipelineYaml_ShouldContain_ConditionalJobExecution()
        {
            // Arrange
            var pipelineYamlPath = Path.Combine(_rootPath, "pipelines", "azure-pipelines.yml");

            // Act & Assert
            Assert.True(File.Exists(pipelineYamlPath), "Pipeline YAML file should exist");

            var pipelineContent = File.ReadAllText(pipelineYamlPath);

            // Verify conditional execution logic
            Assert.Contains("condition:", pipelineContent);
            Assert.Contains("Build.SourceVersionMessage", pipelineContent);
            Assert.Contains("services/api", pipelineContent);
            Assert.Contains("services/functions", pipelineContent);
            Assert.Contains("apps/mobile", pipelineContent);
        }

        [Fact]
        public void PipelineYaml_ShouldContain_SeparateDeploymentStages()
        {
            // Arrange
            var pipelineYamlPath = Path.Combine(_rootPath, "pipelines", "azure-pipelines.yml");

            // Act & Assert
            Assert.True(File.Exists(pipelineYamlPath), "Pipeline YAML file should exist");

            var pipelineContent = File.ReadAllText(pipelineYamlPath);

            // Verify separate deployment stages exist
            Assert.Contains("DevDeployApi", pipelineContent);
            Assert.Contains("DevDeployFunctions", pipelineContent);
            Assert.Contains("DevDeployMobile", pipelineContent);

            // Verify each stage has proper dependencies
            Assert.Contains("dependsOn: DevBuild", pipelineContent);
        }

        [Theory]
        [InlineData("services/api")]
        [InlineData("services/functions/GamerUncle.Function.BggSync")]
        [InlineData("apps/mobile")]
        public void RequiredDirectories_ShouldExist(string relativePath)
        {
            // Arrange
            var fullPath = Path.Combine(_rootPath, relativePath);

            // Act & Assert
            Assert.True(Directory.Exists(fullPath), $"Directory {relativePath} should exist");
        }

        [Theory]
        [InlineData("apps/mobile/package.json")]
        [InlineData("apps/mobile/app.json")]
        [InlineData("services/api/GamerUncle.Api.csproj")]
        [InlineData("services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj")]
        [InlineData("pipelines/azure-pipelines.yml")]
        public void RequiredFiles_ShouldExist(string relativePath)
        {
            // Arrange
            var fullPath = Path.Combine(_rootPath, relativePath);

            // Act & Assert
            Assert.True(File.Exists(fullPath), $"File {relativePath} should exist");
        }

        [Fact]
        public void MobileProject_ShouldHave_ValidDependencies()
        {
            // Arrange
            var packageJsonPath = Path.Combine(_rootPath, "apps", "mobile", "package.json");

            // Act & Assert
            Assert.True(File.Exists(packageJsonPath), "Mobile package.json should exist");

            var packageJsonContent = File.ReadAllText(packageJsonPath);
            var packageJson = JsonDocument.Parse(packageJsonContent);

            // Verify required dependencies exist
            Assert.True(packageJson.RootElement.TryGetProperty("dependencies", out var dependencies), 
                "Package.json should contain dependencies section");

            // Check for key React Native/Expo dependencies
            var requiredDependencies = new[] { "expo", "react", "react-native" };
            
            foreach (var dependency in requiredDependencies)
            {
                Assert.True(dependencies.TryGetProperty(dependency, out _), 
                    $"Package.json should contain '{dependency}' dependency");
            }
        }

        [Fact]
        public void ValidationScripts_ShouldExist()
        {
            // Arrange
            var bashScriptPath = Path.Combine(_rootPath, "pipelines", "validate-pipeline.sh");
            var powershellScriptPath = Path.Combine(_rootPath, "pipelines", "validate-pipeline.ps1");

            // Act & Assert
            Assert.True(File.Exists(bashScriptPath), "Bash validation script should exist");
            Assert.True(File.Exists(powershellScriptPath), "PowerShell validation script should exist");

            // Verify scripts contain required test functions
            var bashContent = File.ReadAllText(bashScriptPath);
            var psContent = File.ReadAllText(powershellScriptPath);

            Assert.Contains("test_mobile_package_json", bashContent);
            Assert.Contains("test_api_build", bashContent);
            Assert.Contains("test_function_build", bashContent);

            Assert.Contains("Test-MobilePackageJson", psContent);
            Assert.Contains("Test-ApiBuild", psContent);
            Assert.Contains("Test-FunctionBuild", psContent);
        }

        /// <summary>
        /// Helper method to find the solution root directory
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
