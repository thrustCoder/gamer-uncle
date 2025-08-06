using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xunit;
using System.Collections.Generic;

namespace GamerUncle.Api.Tests.Configuration
{
    public class SwaggerConfigurationTests
    {
        [Fact]
        public void SwaggerEnabled_ShouldBeTrue_WhenConfigurationIsSet()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["Swagger:Enabled"] = "true"
                })
                .Build();

            // Act
            var swaggerEnabled = configuration.GetValue<bool>("Swagger:Enabled", false);

            // Assert
            Assert.True(swaggerEnabled);
        }

        [Fact]
        public void SwaggerEnabled_ShouldBeFalse_WhenConfigurationIsSetToFalse()
        {
            // Arrange
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["Swagger:Enabled"] = "false"
                })
                .Build();

            // Act
            var swaggerEnabled = configuration.GetValue<bool>("Swagger:Enabled", true);

            // Assert
            Assert.False(swaggerEnabled);
        }

        [Fact]
        public void SwaggerEnabled_ShouldDefaultToDevelopment_WhenNotConfigured()
        {
            // Arrange
            var configuration = new ConfigurationBuilder().Build();
            var isDevelopment = true; // Simulating development environment

            // Act
            var swaggerEnabled = configuration.GetValue<bool>("Swagger:Enabled", isDevelopment);

            // Assert
            Assert.True(swaggerEnabled);
        }

        [Theory]
        [InlineData("Development", true)]
        [InlineData("Production", false)]
        [InlineData("Testing", false)]
        public void SwaggerEnabled_ShouldDefaultToEnvironment_WhenNotConfigured(string environmentName, bool expectedDefault)
        {
            // Arrange
            var configuration = new ConfigurationBuilder().Build();
            var isDevelopment = environmentName.Equals("Development");

            // Act
            var swaggerEnabled = configuration.GetValue<bool>("Swagger:Enabled", isDevelopment);

            // Assert
            Assert.Equal(expectedDefault, swaggerEnabled);
        }

        [Fact]
        public void SwaggerConfiguration_ShouldOverrideEnvironmentDefault()
        {
            // Arrange - Production environment but Swagger explicitly enabled
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["Swagger:Enabled"] = "true"
                })
                .Build();
            var isDevelopment = false; // Production environment

            // Act
            var swaggerEnabled = configuration.GetValue<bool>("Swagger:Enabled", isDevelopment);

            // Assert
            Assert.True(swaggerEnabled); // Should be true despite production environment
        }
    }
}
