using System.Collections.Generic;
using GamerUncle.Api.Services.Telemetry;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace GamerUncle.Api.Tests.Telemetry
{
    public class SyntheticSourceTelemetryInitializerTests
    {
        private static IConfiguration BuildConfig(params (string Pattern, string? Label)[] patterns)
        {
            var dict = new Dictionary<string, string?>();
            for (var i = 0; i < patterns.Length; i++)
            {
                dict[$"SyntheticTraffic:UserAgentPatterns:{i}:Pattern"] = patterns[i].Pattern;
                if (patterns[i].Label != null)
                {
                    dict[$"SyntheticTraffic:UserAgentPatterns:{i}:Label"] = patterns[i].Label;
                }
            }

            return new ConfigurationBuilder()
                .AddInMemoryCollection(dict)
                .Build();
        }

        private static IConfiguration EmptyConfig() => new ConfigurationBuilder().Build();

        private static IHttpContextAccessor AccessorWith(string? userAgent)
        {
            var httpContext = new DefaultHttpContext();
            if (userAgent != null)
            {
                httpContext.Request.Headers["User-Agent"] = userAgent;
            }

            return new HttpContextAccessor { HttpContext = httpContext };
        }

        private static IHttpContextAccessor EmptyAccessor() => new HttpContextAccessor { HttpContext = null };

        [Fact]
        public void Initialize_FunctionalTestUserAgent_SetsSyntheticSourceFromDefaults()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("GamerUncle-FunctionalTests/1.0"),
                EmptyConfig());
            var telemetry = new MetricTelemetry("AgentRequest.Duration", 30000);

            sut.Initialize(telemetry);

            Assert.Equal("GamerUncle-FunctionalTests", telemetry.Context.Operation.SyntheticSource);
        }

        [Fact]
        public void Initialize_PlaywrightUserAgent_SetsSyntheticSourceFromDefaults()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("Mozilla/5.0 ... Playwright/1.58.2"),
                EmptyConfig());
            var telemetry = new RequestTelemetry();

            sut.Initialize(telemetry);

            Assert.Equal("Playwright", telemetry.Context.Operation.SyntheticSource);
        }

        [Fact]
        public void Initialize_RealUserAgent_LeavesSyntheticSourceUnset()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("GamerUncle/4.0.2 CFNetwork/1494 Darwin/23.0.0"),
                EmptyConfig());
            var telemetry = new MetricTelemetry("AgentRequest.Duration", 1234);

            sut.Initialize(telemetry);

            Assert.True(string.IsNullOrEmpty(telemetry.Context.Operation.SyntheticSource));
        }

        [Fact]
        public void Initialize_MissingUserAgent_LeavesSyntheticSourceUnset()
        {
            var sut = new SyntheticSourceTelemetryInitializer(AccessorWith(userAgent: null), EmptyConfig());
            var telemetry = new RequestTelemetry();

            sut.Initialize(telemetry);

            Assert.True(string.IsNullOrEmpty(telemetry.Context.Operation.SyntheticSource));
        }

        [Fact]
        public void Initialize_NoHttpContext_LeavesSyntheticSourceUnset()
        {
            var sut = new SyntheticSourceTelemetryInitializer(EmptyAccessor(), EmptyConfig());
            var telemetry = new MetricTelemetry("AgentRequest.Duration", 1234);

            sut.Initialize(telemetry);

            Assert.True(string.IsNullOrEmpty(telemetry.Context.Operation.SyntheticSource));
        }

        [Fact]
        public void Initialize_ExistingSyntheticSource_IsPreserved()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("GamerUncle-FunctionalTests/1.0"),
                EmptyConfig());
            var telemetry = new RequestTelemetry();
            telemetry.Context.Operation.SyntheticSource = "Availability";

            sut.Initialize(telemetry);

            Assert.Equal("Availability", telemetry.Context.Operation.SyntheticSource);
        }

        [Fact]
        public void Initialize_MatchIsCaseInsensitive()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("gameruncle-functionaltests/1.0"),
                EmptyConfig());
            var telemetry = new MetricTelemetry("voice.total_duration_ms", 200);

            sut.Initialize(telemetry);

            Assert.Equal("GamerUncle-FunctionalTests", telemetry.Context.Operation.SyntheticSource);
        }

        [Fact]
        public void Initialize_ConfiguredPatternOverridesDefaults()
        {
            // Configured patterns take precedence over the built-in defaults.
            // Defaults include "GamerUncle-FunctionalTests" but the configured set does not,
            // so a functional-test UA should NOT be tagged here.
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("GamerUncle-FunctionalTests/1.0"),
                BuildConfig(("LoadTest-Agent", "LoadTest")));
            var telemetry = new RequestTelemetry();

            sut.Initialize(telemetry);

            Assert.True(string.IsNullOrEmpty(telemetry.Context.Operation.SyntheticSource));
        }

        [Fact]
        public void Initialize_ConfiguredPatternMatches()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("LoadTest-Agent/2.0"),
                BuildConfig(("LoadTest-Agent", "LoadTest")));
            var telemetry = new RequestTelemetry();

            sut.Initialize(telemetry);

            Assert.Equal("LoadTest", telemetry.Context.Operation.SyntheticSource);
        }

        [Fact]
        public void Initialize_ConfiguredPatternWithoutLabel_FallsBackToPattern()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("LoadTest-Agent/2.0"),
                BuildConfig(("LoadTest-Agent", null)));
            var telemetry = new RequestTelemetry();

            sut.Initialize(telemetry);

            Assert.Equal("LoadTest-Agent", telemetry.Context.Operation.SyntheticSource);
        }

        [Fact]
        public void Initialize_NullTelemetry_DoesNotThrow()
        {
            var sut = new SyntheticSourceTelemetryInitializer(
                AccessorWith("GamerUncle-FunctionalTests/1.0"),
                EmptyConfig());

            var exception = Record.Exception(() => sut.Initialize(null!));

            Assert.Null(exception);
        }
    }
}
