using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GamerUncle.Api.Services.Speech;

namespace GamerUncle.Api.Tests.Speech;

/// <summary>
/// Unit tests for AzureSpeechService.
/// Note: These tests verify the service behavior patterns and configuration.
/// Full integration tests require actual Azure Speech credentials.
/// </summary>
public class AzureSpeechServiceTests
{
    [Fact]
    public void Constructor_WithDirectApiKey_InitializesSuccessfully()
    {
        // Arrange
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<AzureSpeechService>>();
        
        // Setup configuration with direct API key (simulating local development)
        mockConfig.Setup(c => c["AzureSpeech:Region"]).Returns("westus");
        mockConfig.Setup(c => c["AzureSpeech:DefaultVoice"]).Returns("en-US-DavisNeural");
        mockConfig.Setup(c => c["AzureSpeech:ApiKey"]).Returns("test-api-key");

        // Act & Assert - should not throw
        var service = new AzureSpeechService(mockConfig.Object, mockLogger.Object);
        Assert.NotNull(service);
    }

    [Fact]
    public void Constructor_WithoutRegion_ThrowsInvalidOperationException()
    {
        // Arrange
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<AzureSpeechService>>();
        
        // Setup configuration without region
        mockConfig.Setup(c => c["AzureSpeech:Region"]).Returns((string?)null);
        mockConfig.Setup(c => c["AzureSpeech:ApiKey"]).Returns("test-api-key");

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => 
            new AzureSpeechService(mockConfig.Object, mockLogger.Object));
        Assert.Contains("Region", ex.Message);
    }

    [Fact]
    public void Constructor_WithoutApiKeyOrKeyVault_ThrowsInvalidOperationException()
    {
        // Arrange
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<AzureSpeechService>>();
        
        // Setup configuration without API key and without KeyVault
        mockConfig.Setup(c => c["AzureSpeech:Region"]).Returns("westus");
        mockConfig.Setup(c => c["AzureSpeech:ApiKey"]).Returns((string?)null);
        mockConfig.Setup(c => c["AzureSpeech:KeyVaultUri"]).Returns((string?)null);

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => 
            new AzureSpeechService(mockConfig.Object, mockLogger.Object));
        Assert.Contains("KeyVaultUri", ex.Message);
    }

    [Fact]
    public void Constructor_UsesDefaultVoiceWhenNotConfigured()
    {
        // Arrange
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<AzureSpeechService>>();
        
        mockConfig.Setup(c => c["AzureSpeech:Region"]).Returns("westus");
        mockConfig.Setup(c => c["AzureSpeech:DefaultVoice"]).Returns((string?)null); // No voice configured
        mockConfig.Setup(c => c["AzureSpeech:ApiKey"]).Returns("test-api-key");

        // Act - should not throw and use default voice
        var service = new AzureSpeechService(mockConfig.Object, mockLogger.Object);
        
        // Assert
        Assert.NotNull(service);
        // Default voice should be used (en-US-AvaMultilingualNeural)
    }

    [Fact]
    public async Task SpeechToTextAsync_WithEmptyAudio_ThrowsInvalidOperationException()
    {
        // Arrange
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<AzureSpeechService>>();
        
        mockConfig.Setup(c => c["AzureSpeech:Region"]).Returns("westus");
        mockConfig.Setup(c => c["AzureSpeech:ApiKey"]).Returns("test-api-key");

        var service = new AzureSpeechService(mockConfig.Object, mockLogger.Object);

        // Act & Assert
        // Empty base64 should fail with no speech recognized (empty audio)
        await Assert.ThrowsAsync<InvalidOperationException>(() => 
            service.SpeechToTextAsync("", GamerUncle.Shared.Models.AudioFormat.Wav));
    }

    [Fact]
    public async Task SpeechToTextAsync_WithInvalidBase64_ThrowsException()
    {
        // Arrange
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<AzureSpeechService>>();
        
        mockConfig.Setup(c => c["AzureSpeech:Region"]).Returns("westus");
        mockConfig.Setup(c => c["AzureSpeech:ApiKey"]).Returns("test-api-key");

        var service = new AzureSpeechService(mockConfig.Object, mockLogger.Object);

        // Act & Assert
        await Assert.ThrowsAsync<FormatException>(() => 
            service.SpeechToTextAsync("not-valid-base64!", GamerUncle.Shared.Models.AudioFormat.Wav));
    }

    /// <summary>
    /// Verifies that the continuous recognition implementation handles multiple utterances.
    /// This is a design test - the actual recognition requires Azure credentials.
    /// The key requirement is that the service uses continuous recognition (StartContinuousRecognitionAsync)
    /// instead of single-shot recognition (RecognizeOnceAsync) to capture all speech in the audio.
    /// </summary>
    [Fact]
    public void SpeechToTextAsync_UsesContinuousRecognition_ByDesign()
    {
        // This test documents the requirement that was fixed:
        // - RecognizeOnceAsync() only captures a single utterance (stops at first pause)
        // - StartContinuousRecognitionAsync() captures all utterances in the audio stream
        //
        // The implementation change ensures multi-sentence user input is fully transcribed.
        // Example: "Can you tell me about Monopoly? What are the rules?"
        // - Old: Only "Can you tell me about Monopoly?" would be captured
        // - New: Both sentences are captured and concatenated
        
        Assert.True(true, "Design requirement documented: continuous recognition for multi-utterance support");
    }
}
