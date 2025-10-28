using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Controllers
{
    /// <summary>
    /// Controller for voice interaction endpoints using Azure Speech Services
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("GameRecommendations")] // Use same rate limiting policy as recommendations
    public class VoiceController : ControllerBase
    {
        private readonly IAudioProcessingService _audioProcessingService;
        private readonly ILogger<VoiceController> _logger;

        public VoiceController(
            IAudioProcessingService audioProcessingService,
            ILogger<VoiceController> logger)
        {
            _audioProcessingService = audioProcessingService;
            _logger = logger;
        }

        /// <summary>
        /// Process audio from user through complete voice pipeline (STT → AI → TTS)
        /// </summary>
        /// <param name="request">Audio processing request with base64-encoded audio data</param>
        /// <returns>Audio response with transcription, AI response text, and TTS audio</returns>
        [HttpPost("process")]
        [ProducesResponseType(typeof(AudioResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(429)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> ProcessAudio([FromBody] AudioRequest request)
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = HttpContext.Request.Headers.UserAgent.ToString();
            
            _logger.LogInformation("Audio processing request from IP: {ClientIp}, UserAgent: {UserAgent}, ConversationId: {ConversationId}, Format: {Format}", 
                clientIp, userAgent, request.ConversationId, request.Format);

            try
            {
                // Validate model state
                if (!ModelState.IsValid)
                {
                    _logger.LogWarning("Invalid audio processing request from IP: {ClientIp}, ValidationErrors: {ValidationErrors}", 
                        clientIp, string.Join(", ", ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage))));
                    return BadRequest(ModelState);
                }

                // Validate audio data size (e.g., max 5MB)
                const int maxAudioSizeBytes = 5 * 1024 * 1024; // 5MB
                var estimatedSize = (request.AudioData.Length * 3) / 4; // Base64 to bytes approximation
                if (estimatedSize > maxAudioSizeBytes)
                {
                    _logger.LogWarning("Audio data too large from IP: {ClientIp}, Size: ~{Size} bytes", clientIp, estimatedSize);
                    return BadRequest($"Audio data too large. Maximum size is {maxAudioSizeBytes / (1024 * 1024)}MB");
                }

                // Process audio through complete pipeline
                var result = await _audioProcessingService.ProcessAudioAsync(
                    request.AudioData,
                    request.Format,
                    request.ConversationId,
                    HttpContext.RequestAborted);

                _logger.LogInformation("Audio processing completed successfully. ConversationId: {ConversationId}, Transcription: {Transcription}", 
                    result.ConversationId, result.TranscribedText);

                // Return response with TTS audio
                return Ok(new AudioResponse
                {
                    Transcription = result.TranscribedText,
                    ResponseText = result.ResponseText,
                    AudioData = Convert.ToBase64String(result.ResponseAudio),
                    ConversationId = result.ConversationId
                });
            }
            catch (InvalidOperationException ex)
            {
                // Business logic errors (e.g., invalid audio format, no speech detected)
                _logger.LogWarning(ex, "Audio processing validation error from IP: {ClientIp}", clientIp);
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing audio. ConversationId: {ConversationId}, IP: {ClientIp}", 
                    request.ConversationId, clientIp);
                
                return StatusCode(500, new { error = "An error occurred while processing the audio" });
            }
        }
    }
}