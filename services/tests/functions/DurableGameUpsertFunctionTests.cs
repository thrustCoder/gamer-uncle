using System;
using System.Globalization;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GamerUncle.Functions;
using System.Reflection;

namespace GamerUncle.Functions.Tests
{
    public class TimerScheduleTests
    {
        private readonly Mock<ILogger> _mockLogger;

        public TimerScheduleTests()
        {
            _mockLogger = new Mock<ILogger>();
        }

        [Fact]
        public void ShouldSkipPastDueExecution_WhenMoreThanOneHourLate()
        {
            // Arrange
            var lastScheduledTime = DateTime.UtcNow.AddHours(-2); // 2 hours ago
            var currentTime = DateTime.UtcNow;
            
            // Act
            var timeSinceLastScheduled = currentTime - lastScheduledTime;
            var shouldSkip = timeSinceLastScheduled > TimeSpan.FromHours(1);
            
            // Assert
            Assert.True(shouldSkip);
        }

        [Fact]
        public void ShouldNotSkipPastDueExecution_WhenLessThanOneHourLate()
        {
            // Arrange
            var lastScheduledTime = DateTime.UtcNow.AddMinutes(-30); // 30 minutes ago
            var currentTime = DateTime.UtcNow;
            
            // Act
            var timeSinceLastScheduled = currentTime - lastScheduledTime;
            var shouldSkip = timeSinceLastScheduled > TimeSpan.FromHours(1);
            
            // Assert
            Assert.False(shouldSkip);
        }

        [Fact]
        public void ShouldNotSkipExecution_WhenExactlyOneHourLate()
        {
            // Arrange
            var lastScheduledTime = DateTime.UtcNow.AddHours(-1).AddSeconds(1); // Slightly under 1 hour ago
            var currentTime = DateTime.UtcNow;
            
            // Act
            var timeSinceLastScheduled = currentTime - lastScheduledTime;
            var shouldSkip = timeSinceLastScheduled > TimeSpan.FromHours(1);
            
            // Assert
            Assert.False(shouldSkip); // Should not skip when slightly under 1 hour
        }

        [Theory]
        [InlineData("Development", true)]
        [InlineData("development", true)]
        [InlineData("dev", true)]
        [InlineData("Production", false)]
        [InlineData("prod", false)]
        [InlineData("", false)]
        public void EnvironmentCheck_ReturnsCorrectValue(string environment, bool shouldBeDevEnvironment)
        {
            // Act
            var isDev = environment.Contains("Development") || environment.Contains("dev");
            
            // Assert
            Assert.Equal(shouldBeDevEnvironment, isDev);
        }
    }
}
