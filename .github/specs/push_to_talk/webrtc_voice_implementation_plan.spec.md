# WebRTC + Expo Voice Implementation Plan

## Overview
This document outlines the implementation plan for push-to-talk voice functionality using **WebRTC for signaling/connection management** and **Expo libraries (expo-av, @react-native-voice/voice) for audio capture and playback**. This approach provides better cross-platform compatibility and leverages React Native's mature audio ecosystem.

> **Last Updated:** December 2024  
> **Status:** Phase 2 & 3 Complete, Phase 4-5 In Progress

---

## 🔒 Voice Data Privacy & Security

### User Voice Data Handling Policy

**⚠️ IMPORTANT: No user voice recordings are persistently stored anywhere in the system.**

#### Frontend (Mobile App)
| Stage | Data | Storage | Retention |
|-------|------|---------|-----------|
| Recording | Audio captured via `expo-av` | Temporary device file | **Deleted immediately** after transmission |
| Transmission | Base64-encoded audio | In-memory only | Cleared after API response |
| Playback | AI TTS response | Data URI (memory) | Cleared after playback |

**Implementation Details:**
- Temporary WAV file created during recording at device temp directory
- File is read, converted to base64, and sent to API
- **Temporary file is immediately deleted** via `File.delete()` in `voiceAudioService.ts`
- No audio data stored in `AsyncStorage` or any persistent storage
- `appCache.ts` only stores game preferences (player count, dice count) - **never audio**

```typescript
// From voiceAudioService.ts - Cleanup after processing
finally {
  this.recording = null;
  // Delete temporary file using new v19 API
  try {
    const audioFile = new File(uri);
    await audioFile.delete();
  } catch (error) {
    console.warn('⚠️ [AUDIO] Failed to delete temporary recording:', error);
  }
}
```

#### Backend API
| Stage | Data | Storage | Retention |
|-------|------|---------|-----------|
| Receive | Base64 audio in request body | In-memory only | Cleared after request completes |
| STT Processing | Audio bytes | Azure Speech Services | **No retention** (transient processing) |
| AI Processing | Transcribed text only | In-memory only | Not stored |
| TTS Generation | Response audio | Azure Speech Services | **No retention** (transient processing) |
| Response | TTS audio bytes | In-memory only | Cleared after response sent |

**What is NOT stored in Azure:**
- ❌ Raw audio recordings
- ❌ Voice samples or biometrics
- ❌ Audio files in Blob Storage
- ❌ Audio data in Cosmos DB
- ❌ Audio in Application Insights telemetry

**What IS logged (metadata only):**
- ✅ Request timestamps and duration
- ✅ Audio size in bytes (for monitoring)
- ✅ Processing latency metrics (STT, AI, TTS)
- ✅ Transcribed text (for debugging - can be disabled in production)
- ✅ Conversation IDs for session tracking
- ✅ Error information (no audio content)

#### Azure Services Used
| Service | Data Processed | Retention Policy |
|---------|---------------|------------------|
| Azure Speech Services (STT) | Audio stream | Transient - no storage |
| Azure Speech Services (TTS) | Text input | Transient - no storage |
| Azure AI Agent Service | Text only | Conversation threads (configurable) |
| Azure Key Vault | API keys only | N/A - no user data |

### Compliance Considerations
- Audio data exists only during active processing (typically <5 seconds)
- No audio fingerprinting or voice recognition storage
- Suitable for GDPR/CCPA compliance (no persistent voice data)
- Users can verify: no audio files appear in device storage after voice interactions

---

## Architecture Decision

### Why This Approach?
1. **Proven Foundation**: The `useVoiceSession` hook already implements WebRTC peer connection management
2. **Better Audio Quality**: Expo-av provides high-quality audio recording/playback with PCM16 support
3. **Speech Recognition**: @react-native-voice/voice offers native STT capabilities
4. **Cross-Platform**: Works consistently on iOS, Android, and (potentially) web
5. **Simpler Backend**: WebRTC signaling through standard endpoints, no Azure Realtime API complexity

### Key Components
- **Frontend Audio Capture**: `expo-av` Recording API for microphone input
- **Frontend Audio Playback**: `expo-av` Sound API for TTS output
- **Speech Recognition**: `@react-native-voice/voice` for STT
- **WebRTC Signaling**: Existing peer connection management from `useVoiceSession`
- **Backend Processing**: .NET API handles audio processing, STT/TTS via Azure Speech Services

---

## Phase 1: Core Voice Session Management ✅ (Complete)

### 🎯 Current State
The following components are implemented in `apps/mobile/hooks/useVoiceSession.ts`:

#### Implemented Features
- [x] WebRTC peer connection setup
- [x] ICE candidate handling
- [x] Audio stream management (getUserMedia)
- [x] Session state management (connecting/active/recording)
- [x] Speech recognition integration via `@react-native-voice/voice`
- [x] Push-to-talk controls (setRecording)
- [x] Pre-initialization for faster startup
- [x] Error handling and cleanup
- [x] VoiceAudioService integration for recording/playback

#### Existing Services
- [x] `speechRecognitionService.ts` - Wrapper for @react-native-voice/voice
- [x] `voiceAudioService.ts` - Audio recording/playback with cleanup
- [x] Backend `/api/voice/process` endpoint (VoiceController)
- [x] Shared models: `VoiceSessionRequest`, `VoiceSessionResponse`

### 📋 What's Already Working
```typescript
// Voice session lifecycle
await startVoiceSession({ Query: "recommend games", ConversationId: "123" });
setRecording(true);  // User holds mic button
setRecording(false); // User releases - triggers STT processing
await stopVoiceSession();

// Speech recognition
speechRecognitionService.startListening({ 
  onResult: (result) => console.log(result.transcription),
  onError: (error) => console.log(error)
});
```

---

## Phase 2: Backend Audio Processing Implementation ✅ (Complete)

### 🎯 Status: Fully Implemented
Backend services for audio processing are complete and deployed.

### ✅ Implemented Components

#### 2.1 Audio Processing Service ✅

##### `services/api/Services/Interfaces/IAudioProcessingService.cs`
```csharp
public interface IAudioProcessingService
{
    Task<AudioProcessingResult> ProcessAudioAsync(
        string audioBase64,
        AudioFormat format,
        string? conversationId = null,
        CancellationToken cancellationToken = default);
}
```

##### `services/api/Services/Speech/AudioProcessingService.cs`
- ✅ Full STT → AI Agent → TTS pipeline
- ✅ Custom metrics for Application Insights
- ✅ Detailed logging with timing breakdowns
- ✅ Error handling with proper status codes

#### 2.2 Azure Speech Service ✅

##### `services/api/Services/Speech/AzureSpeechService.cs`
- ✅ STT with PCM16/WAV format support
- ✅ TTS with SSML for natural speech
- ✅ Key Vault integration for production
- ✅ Direct API key support for development

#### 2.3 Voice Controller ✅

##### `services/api/Controllers/VoiceController.cs`
- ✅ `POST /api/voice/process` endpoint
- ✅ Rate limiting via `GameRecommendations` policy
- ✅ Distributed tracing with ActivitySource
- ✅ Audio size validation (max 5MB)
- ✅ Comprehensive error handling

#### 2.4 Configuration ✅

##### `appsettings.json` (Current)
```json
{
  "AzureSpeech": {
    "KeyVaultUri": "https://gamer-uncle-dev-vault.vault.azure.net/",
    "KeySecretName": "AzureSpeechKey",
    "Region": "westus",
    "DefaultVoice": "en-US-AvaMultilingualNeural"
  }
}
```

##### `appsettings.Development.json`
- Supports direct `ApiKey` for local development
- Falls back to Key Vault for production

---

## Phase 3: Frontend Audio Integration ✅ (Complete)

### 🎯 Status: Fully Implemented
Frontend audio recording and playback are complete with privacy-respecting cleanup.

### ✅ Implemented Components

#### 3.1 VoiceAudioService ✅

##### `apps/mobile/services/voiceAudioService.ts`
```typescript
export class VoiceAudioService {
  // Recording with PCM16 WAV format (24kHz, mono, 16-bit)
  async startRecording(): Promise<void>;
  
  // Stop, process, and cleanup temporary file
  async stopRecordingAndProcess(conversationId?: string): Promise<AudioProcessingResponse>;
  
  // Play TTS with PCM16 to WAV conversion
  async playAudioResponse(base64Audio: string): Promise<void>;
  
  // Interrupt AI playback
  async stopAudioPlayback(): Promise<void>;
  
  // Resource cleanup
  async cleanup(): Promise<void>;
}
```

**Key Features:**
- ✅ Expo-av Recording API with proper format configuration
- ✅ Automatic temporary file cleanup after transmission
- ✅ PCM16 to WAV header construction for playback
- ✅ Data URI playback (avoids file system permissions)
- ✅ Playback interruption support

#### 3.2 useVoiceSession Hook Integration ✅

##### `apps/mobile/hooks/useVoiceSession.ts`
- ✅ VoiceAudioService instantiation
- ✅ Pre-initialization for faster startup
- ✅ Recording state management
- ✅ Error handling and user feedback
- ✅ Conversation ID tracking across voice turns

#### 3.3 Audio Utilities ✅

##### `apps/mobile/services/audioUtils.ts`
- ✅ `pcm16ToWav()` - WAV header construction
- ✅ `arrayBufferToBase64()` - Binary encoding
- ✅ `decodeBase64PCM16()` - Binary decoding
- ✅ `extractPCM16FromWav()` - Header stripping
- ✅ `concatenateAudioBuffers()` - Buffer management

#### 3.3 UI Components ✅ (Existing)

The ChatScreen UI works with the new implementation:
- ✅ Microphone button for push-to-talk
- ✅ Visual recording state indicator
- ✅ Conversation display with voice messages
- ✅ Error state handling

---

## Phase 4: Testing & Validation 🔄 (In Progress)

### 🎯 Objective
Ensure end-to-end voice functionality works correctly across all scenarios.

### ✅ Completed Testing

#### 4.1 E2E Tests ✅
##### `apps/mobile/e2e/voiceChat.spec.ts`
- ✅ Microphone button visibility
- ✅ Recording state indication
- ✅ Voice session initialization
- ✅ Error handling for unavailable service

### 📋 Remaining Testing Tasks

#### 4.2 Backend Functional Tests

##### Create `services/tests/functional/AudioProcessingTests.cs`
```csharp
[TestClass]
public class AudioProcessingTests
{
    [TestMethod]
    public async Task ProcessAudio_ValidWavFile_ReturnsTranscriptionAndTTS()
    {
        // Arrange
        var audioService = new AudioProcessingService(...);
        var testAudioBase64 = LoadTestAudioFile("hello.wav");

        // Act
        var result = await audioService.ProcessAudioAsync(
            testAudioBase64, 
            AudioFormat.Wav);

        // Assert
        Assert.IsNotNull(result.TranscribedText);
        Assert.IsTrue(result.TranscribedText.Length > 0);
        Assert.IsNotNull(result.ResponseAudio);
        Assert.IsTrue(result.ResponseAudio.Length > 0);
    }

    [TestMethod]
    public async Task VoiceController_ProcessAudio_ReturnsSuccessWithConversationId()
    {
        // Test full endpoint with rate limiting
    }
}
```

#### 4.2 Frontend Tests

##### Create `apps/mobile/__tests__/voiceAudioService.test.ts`
```typescript
describe('VoiceAudioService', () => {
  it('should start and stop recording', async () => {
    const service = new VoiceAudioService(API_URL);
    await service.startRecording();
    expect(service.isRecording()).toBe(true);
    
    const result = await service.stopRecordingAndProcess();
    expect(result.transcription).toBeDefined();
  });

  it('should play audio response', async () => {
    const service = new VoiceAudioService(API_URL);
    await service.playAudioResponse(mockBase64Audio);
    expect(service.isPlaying()).toBe(true);
  });
});
```

##### Update `apps/mobile/e2e/voice.spec.ts`
```typescript
test('complete voice interaction flow', async () => {
  await page.goto('/chat');
  
  // Start voice session
  await page.click('[data-testid="mic-button"]');
  
  // Wait for recording state
  await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
  
  // Release mic (stop recording)
  await page.click('[data-testid="mic-button"]');
  
  // Verify AI response appears
  await expect(page.locator('[data-testid="chat-message"]').last()).toContainText('recommend');
});
```

#### 4.3 Integration Testing

##### Manual Test Checklist
- [x] Voice session starts successfully
- [x] Push-to-talk recording captures audio
- [x] Audio is transcribed correctly (STT)
- [x] AI response is generated
- [x] TTS audio plays back clearly
- [x] Conversation ID is maintained across turns
- [x] Temporary audio files are deleted after transmission
- [ ] Error handling works (no permissions, network failure)
- [ ] Rate limiting is enforced
- [ ] Multiple consecutive voice interactions work
- [ ] Cross-platform testing (iOS/Android/Web)

---

## Phase 5: Production Readiness 🔄 (In Progress)

### 🎯 Objective
Prepare voice functionality for production deployment with monitoring and security.

### ✅ Completed Production Tasks

#### 5.1 Application Insights Telemetry ✅
- [x] Custom metrics tracking for voice endpoints (via `AudioProcessingService`)
- [x] Track audio processing performance (STT, AI, TTS latency)
- [x] Log audio sizes and formats
- [x] Monitor success/failure rates via counters

**Implemented Metrics:**
- `voice.audio_requests_total` - Request counter
- `voice.audio_failures_total` - Failure counter
- `voice.stt_duration_ms` - STT latency histogram
- `voice.agent_duration_ms` - AI processing histogram
- `voice.tts_duration_ms` - TTS latency histogram
- `voice.total_duration_ms` - End-to-end latency
- `voice.audio_size_bytes` - Response audio size

#### 5.2 Azure Front Door Verification ✅
- [x] AFD routes `/api/*` traffic (includes `/api/voice/process`)
- [x] WAF protection active on all API routes
- [x] Rate limiting configured in VoiceController (`GameRecommendations` policy)
- [x] Voice endpoint accessible through AFD URL

#### 5.3 Security ✅
- [x] Key Vault integration for Azure Speech API keys
- [x] No persistent storage of user audio data
- [x] Request validation and size limits (5MB max)
- [x] Distributed tracing for debugging

### 📋 Remaining Production Tasks

#### 5.4 Monitoring & Alerting
- [ ] Set up Application Insights alerts for voice endpoint failures
- [ ] Monitor Azure Speech Service quota usage
- [ ] Alert on high latency (>5s end-to-end)
- [ ] Track error rates and patterns

---

## Dependencies

### Frontend
- `expo-av` - ✅ Installed (audio recording/playback)
- `expo-file-system` - ✅ Installed (v19 File API for cleanup)
- `@react-native-voice/voice` - ✅ Installed (speech recognition)
- `react-native-webrtc` - ✅ Installed (peer connection management)

### Backend
- `Microsoft.CognitiveServices.Speech` - ✅ Installed (Azure Speech SDK)
- `Azure.AI.Projects` - ✅ Installed (AI Agent integration)
- `Azure.Security.KeyVault.Secrets` - ✅ Installed (Key Vault)
- `Microsoft.AspNetCore.RateLimiting` - ✅ Installed

### Azure Services
- Azure Speech Services (STT/TTS) - ✅ Configured (westus region)
- Azure AI Agent Service - ✅ Configured
- Azure Key Vault - ✅ Configured (gamer-uncle-dev-vault)
- Cosmos DB - ✅ Configured

---

## Current Implementation Status

### Files Implemented

#### Backend (Complete)
| File | Status | Description |
|------|--------|-------------|
| `services/api/Controllers/VoiceController.cs` | ✅ | Voice processing endpoint |
| `services/api/Services/Speech/AzureSpeechService.cs` | ✅ | STT/TTS integration |
| `services/api/Services/Speech/AudioProcessingService.cs` | ✅ | Full pipeline orchestration |
| `services/api/Services/Interfaces/IAzureSpeechService.cs` | ✅ | Speech service interface |
| `services/api/Services/Interfaces/IAudioProcessingService.cs` | ✅ | Processing interface |
| `services/shared/models/AudioRequest.cs` | ✅ | Request model |
| `services/shared/models/AudioResponse.cs` | ✅ | Response model |

#### Frontend (Complete)
| File | Status | Description |
|------|--------|-------------|
| `apps/mobile/services/voiceAudioService.ts` | ✅ | Audio recording/playback |
| `apps/mobile/services/audioUtils.ts` | ✅ | PCM16/WAV utilities |
| `apps/mobile/hooks/useVoiceSession.ts` | ✅ | Voice session hook |
| `apps/mobile/services/speechRecognitionService.ts` | ✅ | Speech recognition wrapper |
| `apps/mobile/e2e/voiceChat.spec.ts` | ✅ | E2E tests |

#### Legacy Files (To Be Cleaned Up)
| File | Status | Notes |
|------|--------|-------|
| `apps/mobile/services/foundryVoiceService.ts` | 🗑️ Deprecated | Azure OpenAI Realtime implementation |

### Configuration Files Updated
- ✅ `services/api/appsettings.json` - AzureSpeech config
- ✅ `services/api/appsettings.Development.json` - Dev API key support
- ✅ `services/api/appsettings.Production.json` - Production Key Vault
- ✅ `services/api/Program.cs` - Service registration

---

## Success Metrics

### Technical Performance
- **Audio Recording Start Time**: <100ms
- **STT Processing Time**: <1 second for typical utterance
- **AI Response Time**: <3 seconds
- **TTS Processing Time**: <1 second
- **End-to-End Latency**: <5 seconds (user speaks → hears AI response)

### Quality Metrics
- **STT Accuracy**: >95% for clear speech
- **TTS Quality**: Natural-sounding, clear pronunciation
- **Session Success Rate**: >99%
- **Error Rate**: <1% of voice interactions

### User Experience
- **Voice Feature Adoption**: >40% of active users
- **Session Completion Rate**: >95%
- **Repeat Usage**: >60% of users who try voice use it again

---

## Timeline & Progress

| Phase | Duration | Status | Notes |
|-------|----------|--------|-------|
| Phase 1 | - | ✅ Complete | Core voice session management |
| Phase 2 | - | ✅ Complete | Backend audio processing |
| Phase 3 | - | ✅ Complete | Frontend audio integration |
| Phase 4 | - | 🔄 In Progress | Testing & validation |
| Phase 5 | - | 🔄 In Progress | Production setup |

### Remaining Work
- [ ] Additional functional tests for edge cases
- [ ] Cross-platform testing (iOS physical device)
- [ ] Application Insights alerting setup
- [ ] Azure Speech quota monitoring
- [ ] Cleanup deprecated Foundry voice files

---

## Rollout Strategy

### Stage 1: Development Environment
- Deploy backend audio services to dev App Service
- Test with local mobile builds
- Validate E2E flow with Azure Speech Services

### Stage 2: Beta Testing
- Release TestFlight build to beta testers
- Collect feedback on audio quality and usability
- Monitor telemetry for errors/performance issues

### Stage 3: Production Deployment
- Deploy backend to production App Service
- Release mobile app update via App Store
- Monitor adoption metrics and user feedback
- Gradually increase rate limits based on demand

---

## Risk Mitigation

### Identified Risks
1. **Audio Quality**: Poor STT accuracy or unnatural TTS
   - Mitigation: Use Azure's premium voices, validate audio formats
2. **Latency**: Slow end-to-end response times
   - Mitigation: Optimize audio encoding, use regional Speech Services
3. **Cost**: High Azure Speech Services usage
   - Mitigation: Implement caching for common phrases, set quotas
4. **Platform Issues**: iOS/Android audio handling differences
   - Mitigation: Thorough cross-platform testing, fallback mechanisms

### Fallback Plan
If voice quality is insufficient:
- Fall back to text chat (already implemented)
- Display transcription for user verification
- Allow manual text edits before sending

---

## Future Enhancements (Post-MVP)

1. **Streaming STT**: Real-time transcription as user speaks
2. **Voice Activity Detection**: Auto-stop recording when user stops talking
3. **Offline Mode**: Cache common responses for offline playback
4. **Multi-language Support**: Support for languages beyond English
5. **Voice Profiles**: Personalized TTS voice selection
6. **Noise Cancellation**: Enhanced audio quality in noisy environments

---

## Conclusion

This implementation provides a **robust, scalable, and privacy-respecting** voice solution by:
- ✅ Leveraging proven React Native audio libraries (expo-av)
- ✅ Using Azure Speech Services for high-quality STT/TTS
- ✅ Building on existing WebRTC infrastructure
- ✅ Maintaining architectural consistency with the codebase
- ✅ **No persistent storage of user voice data** - audio exists only during processing
- ✅ Automatic cleanup of temporary files on mobile devices
- ✅ Comprehensive telemetry for monitoring and debugging

The approach delivers a superior user experience through native audio capabilities while maintaining user privacy and data protection compliance.
