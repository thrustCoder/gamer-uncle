using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;
using System.Diagnostics;

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
        
        // Activity source for distributed tracing
        private static readonly ActivitySource _activitySource = new("GamerUncle.VoiceController", "1.0");

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
            // Start distributed tracing activity
            using var activity = _activitySource.StartActivity("ProcessAudio", ActivityKind.Server);
            
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = HttpContext.Request.Headers.UserAgent.ToString();
            
            // Add tags to activity for better observability
            activity?.SetTag("voice.conversation_id", request.ConversationId);
            activity?.SetTag("voice.audio_format", request.Format.ToString());
            activity?.SetTag("http.client_ip", clientIp);
            activity?.SetTag("http.user_agent", userAgent);
            
            _logger.LogInformation("Audio processing request from IP: {ClientIp}, UserAgent: {UserAgent}, ConversationId: {ConversationId}, Format: {Format}", 
                clientIp, userAgent, request.ConversationId, request.Format);

            try
            {
                // Validate model state
                if (!ModelState.IsValid)
                {
                    activity?.SetStatus(ActivityStatusCode.Error, "Invalid model state");
                    _logger.LogWarning("Invalid audio processing request from IP: {ClientIp}, ValidationErrors: {ValidationErrors}", 
                        clientIp, string.Join(", ", ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage))));
                    return BadRequest(ModelState);
                }

                // Validate audio data size (e.g., max 5MB)
                const int maxAudioSizeBytes = 5 * 1024 * 1024; // 5MB
                var estimatedSize = (request.AudioData.Length * 3) / 4; // Base64 to bytes approximation
                if (estimatedSize > maxAudioSizeBytes)
                {
                    activity?.SetStatus(ActivityStatusCode.Error, "Audio too large");
                    _logger.LogWarning("Audio data too large from IP: {ClientIp}, Size: ~{Size} bytes", clientIp, estimatedSize);
                    return BadRequest($"Audio data too large. Maximum size is {maxAudioSizeBytes / (1024 * 1024)}MB");
                }

                // Process audio through complete pipeline
                var result = await _audioProcessingService.ProcessAudioAsync(
                    request.AudioData,
                    request.Format,
                    request.ConversationId,
                    HttpContext.RequestAborted);

                activity?.SetTag("voice.transcription_length", result.TranscribedText.Length);
                activity?.SetTag("voice.response_length", result.ResponseText.Length);
                activity?.SetTag("voice.response_audio_size", result.ResponseAudio.Length);
                activity?.SetStatus(ActivityStatusCode.Ok);
                
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
                activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
                activity?.SetTag("error.type", "InvalidOperation");
                _logger.LogWarning(ex, "Audio processing validation error from IP: {ClientIp}", clientIp);
                return BadRequest(new { error = ex.Message });
            }
            catch (FormatException ex)
            {
                // Invalid base64 encoding
                activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
                activity?.SetTag("error.type", "InvalidFormat");
                _logger.LogWarning(ex, "Invalid base64 audio data from IP: {ClientIp}", clientIp);
                return BadRequest(new { error = "Invalid audio data format. Audio must be base64-encoded." });
            }
            catch (Exception ex)
            {
                activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
                activity?.SetTag("error.type", ex.GetType().Name);
                _logger.LogError(ex, "Error processing audio. ConversationId: {ConversationId}, IP: {ClientIp}", 
                    request.ConversationId, clientIp);
                
                return StatusCode(500, new { error = "An error occurred while processing the audio" });
            }
        }
    }
}