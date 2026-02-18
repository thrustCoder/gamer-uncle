using Microsoft.ApplicationInsights;
using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GamerUncle.Api.Controllers;
using GamerUncle.Api.Models;

namespace GamerUncle.Api.Tests
{
    public class TelemetryControllerTests
    {
        private readonly Mock<ILogger<TelemetryController>> _mockLogger;
        private readonly TelemetryClient _telemetryClient;
        private readonly MockTelemetryChannel _channel;
        private readonly TelemetryController _controller;

        public TelemetryControllerTests()
        {
            _mockLogger = new Mock<ILogger<TelemetryController>>();
            _channel = new MockTelemetryChannel();
            var config = new TelemetryConfiguration
            {
                TelemetryChannel = _channel,
                ConnectionString = "InstrumentationKey=test-key-00000000-0000-0000-0000-000000000000"
            };
            _telemetryClient = new TelemetryClient(config);
            _controller = new TelemetryController(_mockLogger.Object, _telemetryClient);
        }

        [Fact]
        public void IngestEvents_ValidBatch_ReturnsAccepted()
        {
            // Arrange
            var batch = new ClientTelemetryBatch
            {
                Events = new List<ClientTelemetryEvent>
                {
                    new ClientTelemetryEvent
                    {
                        EventName = "Screen.Viewed",
                        Properties = new Dictionary<string, string> { ["screenName"] = "Landing" },
                        Timestamp = "2026-02-17T10:00:00Z",
                        SessionId = "session-123",
                        DeviceId = "device-456",
                        Platform = "ios"
                    }
                }
            };

            // Act
            var result = _controller.IngestEvents(batch);

            // Assert
            var acceptedResult = Assert.IsType<AcceptedResult>(result);
            Assert.NotNull(acceptedResult.Value);
        }

        [Fact]
        public void IngestEvents_EmptyBatch_ReturnsBadRequest()
        {
            // Arrange
            var batch = new ClientTelemetryBatch { Events = new List<ClientTelemetryEvent>() };

            // Act
            var result = _controller.IngestEvents(batch);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public void IngestEvents_NullEvents_ReturnsBadRequest()
        {
            // Arrange
            var batch = new ClientTelemetryBatch { Events = null! };

            // Act
            var result = _controller.IngestEvents(batch);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public void IngestEvents_SkipsEventsWithEmptyName()
        {
            // Arrange
            var batch = new ClientTelemetryBatch
            {
                Events = new List<ClientTelemetryEvent>
                {
                    new ClientTelemetryEvent { EventName = "" },
                    new ClientTelemetryEvent { EventName = "Valid.Event" }
                }
            };

            // Act
            var result = _controller.IngestEvents(batch);

            // Assert
            var acceptedResult = Assert.IsType<AcceptedResult>(result);
            // Only the valid event should be accepted
            var sentItems = _channel.SentItems;
            Assert.Single(sentItems);
        }

        [Fact]
        public void IngestEvents_ForwardsPropertiesToAppInsights()
        {
            // Arrange
            var batch = new ClientTelemetryBatch
            {
                Events = new List<ClientTelemetryEvent>
                {
                    new ClientTelemetryEvent
                    {
                        EventName = "Feature.Tapped",
                        Properties = new Dictionary<string, string>
                        {
                            ["feature"] = "dice",
                            ["target"] = "Dice"
                        },
                        SessionId = "sess-abc",
                        DeviceId = "dev-xyz",
                        Platform = "android",
                        Timestamp = "2026-02-17T12:00:00Z"
                    }
                }
            };

            // Act
            _controller.IngestEvents(batch);

            // Assert
            Assert.Single(_channel.SentItems);
            var telemetryItem = _channel.SentItems[0] as Microsoft.ApplicationInsights.DataContracts.EventTelemetry;
            Assert.NotNull(telemetryItem);
            Assert.Equal("Client.Feature.Tapped", telemetryItem!.Name);
            Assert.Equal("dice", telemetryItem.Properties["feature"]);
            Assert.Equal("target", telemetryItem.Properties.Keys.First(k => k == "target"));
            Assert.Equal("sess-abc", telemetryItem.Properties["SessionId"]);
            Assert.Equal("dev-xyz", telemetryItem.Properties["DeviceId"]);
            Assert.Equal("android", telemetryItem.Properties["ClientPlatform"]);
        }

        [Fact]
        public void IngestEvents_ForwardsMetricsToAppInsights()
        {
            // Arrange
            var batch = new ClientTelemetryBatch
            {
                Events = new List<ClientTelemetryEvent>
                {
                    new ClientTelemetryEvent
                    {
                        EventName = "Chat.Message.Sent",
                        Metrics = new Dictionary<string, double>
                        {
                            ["messageLength"] = 42
                        },
                        SessionId = "s1",
                        DeviceId = "d1",
                        Platform = "ios"
                    }
                }
            };

            // Act
            _controller.IngestEvents(batch);

            // Assert
            var telemetryItem = _channel.SentItems[0] as Microsoft.ApplicationInsights.DataContracts.EventTelemetry;
            Assert.NotNull(telemetryItem);
            Assert.Equal(42, telemetryItem!.Metrics["messageLength"]);
        }

        [Fact]
        public void IngestEvents_MultipleBatchEvents_AllForwarded()
        {
            // Arrange
            var batch = new ClientTelemetryBatch
            {
                Events = new List<ClientTelemetryEvent>
                {
                    new ClientTelemetryEvent { EventName = "Screen.Viewed", SessionId = "s1", DeviceId = "d1" },
                    new ClientTelemetryEvent { EventName = "Feature.Tapped", SessionId = "s1", DeviceId = "d1" },
                    new ClientTelemetryEvent { EventName = "Chat.Message.Sent", SessionId = "s1", DeviceId = "d1" },
                }
            };

            // Act
            _controller.IngestEvents(batch);

            // Assert
            Assert.Equal(3, _channel.SentItems.Count);
        }

        [Fact]
        public void IngestEvents_WithoutTelemetryClient_StillReturnsAccepted()
        {
            // Arrange - create controller without TelemetryClient
            var controller = new TelemetryController(_mockLogger.Object, null);
            var batch = new ClientTelemetryBatch
            {
                Events = new List<ClientTelemetryEvent>
                {
                    new ClientTelemetryEvent { EventName = "Test.Event", SessionId = "s1", DeviceId = "d1" }
                }
            };

            // Act
            var result = controller.IngestEvents(batch);

            // Assert
            Assert.IsType<AcceptedResult>(result);
        }

        /// <summary>
        /// In-memory telemetry channel for capturing sent items in tests.
        /// </summary>
        private class MockTelemetryChannel : ITelemetryChannel
        {
            public List<ITelemetry> SentItems { get; } = new();
            public bool? DeveloperMode { get; set; }
            public string EndpointAddress { get; set; } = "";

            public void Dispose() { }
            public void Flush() { }
            public void Send(ITelemetry item) => SentItems.Add(item);
        }
    }
}
