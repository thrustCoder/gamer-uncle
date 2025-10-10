using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using GamerUncle.Shared.Models;
using GamerUncle.Api.Services.Interfaces;

namespace GamerUncle.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("GameRecommendations")] // Use same rate limiting policy as recommendations
    public class VoiceController : ControllerBase
    {
        private readonly IFoundryVoiceService _foundryVoiceService;
        private readonly ILogger<VoiceController> _logger;

        public VoiceController(
            IFoundryVoiceService foundryVoiceService,
            ILogger<VoiceController> logger)
        {
            _foundryVoiceService = foundryVoiceService;
            _logger = logger;
        }

        [HttpPost("sessions")]
        public async Task<IActionResult> CreateVoiceSession([FromBody] VoiceSessionRequest request)
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = HttpContext.Request.Headers.UserAgent.ToString();
            
            _logger.LogInformation("Voice session creation request from IP: {ClientIp}, UserAgent: {UserAgent}, ConversationId: {ConversationId}", 
                clientIp, userAgent, request.ConversationId);

            try
            {
                // Validate model state
                if (!ModelState.IsValid)
                {
                    _logger.LogWarning("Invalid voice session request from IP: {ClientIp}, ValidationErrors: {ValidationErrors}", 
                        clientIp, string.Join(", ", ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage))));
                    return BadRequest(ModelState);
                }

                // Create voice session with Foundry service
                var voiceSession = await _foundryVoiceService.CreateVoiceSessionAsync(request);

                _logger.LogInformation("Voice session created successfully. SessionId: {SessionId}, ConversationId: {ConversationId}", 
                    voiceSession.SessionId, request.ConversationId);

                return Ok(voiceSession);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating voice session. ConversationId: {ConversationId}, IP: {ClientIp}", 
                    request.ConversationId, clientIp);
                
                return StatusCode(500, "An error occurred while creating the voice session");
            }
        }

        [HttpGet("sessions/{sessionId}/status")]
        public async Task<IActionResult> GetVoiceSessionStatus([FromRoute] string sessionId)
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            
            _logger.LogInformation("Voice session status request from IP: {ClientIp}, SessionId: {SessionId}", 
                clientIp, sessionId);

            try
            {
                if (string.IsNullOrWhiteSpace(sessionId))
                {
                    _logger.LogWarning("Empty session ID provided from IP: {ClientIp}", clientIp);
                    return BadRequest("Session ID is required");
                }

                var status = await _foundryVoiceService.GetVoiceSessionStatusAsync(sessionId);
                if (status == null)
                {
                    _logger.LogWarning("Voice session not found. SessionId: {SessionId}, IP: {ClientIp}", sessionId, clientIp);
                    return NotFound($"Voice session '{sessionId}' not found");
                }

                _logger.LogInformation("Voice session status retrieved. SessionId: {SessionId}, Status: {Status}", 
                    sessionId, status.Status);

                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting voice session status. SessionId: {SessionId}, IP: {ClientIp}", 
                    sessionId, clientIp);
                
                return StatusCode(500, "An error occurred while retrieving the voice session status");
            }
        }

        [HttpDelete("sessions/{sessionId}")]
        public async Task<IActionResult> TerminateVoiceSession([FromRoute] string sessionId)
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            
            _logger.LogInformation("Voice session termination request from IP: {ClientIp}, SessionId: {SessionId}", 
                clientIp, sessionId);

            try
            {
                if (string.IsNullOrWhiteSpace(sessionId))
                {
                    _logger.LogWarning("Empty session ID provided for termination from IP: {ClientIp}", clientIp);
                    return BadRequest("Session ID is required");
                }

                var terminated = await _foundryVoiceService.TerminateVoiceSessionAsync(sessionId);
                if (!terminated)
                {
                    _logger.LogWarning("Failed to terminate voice session. SessionId: {SessionId}, IP: {ClientIp}", sessionId, clientIp);
                    return NotFound($"Voice session '{sessionId}' not found or could not be terminated");
                }

                _logger.LogInformation("Voice session terminated successfully. SessionId: {SessionId}", sessionId);

                return Ok(new { message = "Voice session terminated successfully", sessionId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error terminating voice session. SessionId: {SessionId}, IP: {ClientIp}", 
                    sessionId, clientIp);
                
                return StatusCode(500, "An error occurred while terminating the voice session");
            }
        }
    }
}