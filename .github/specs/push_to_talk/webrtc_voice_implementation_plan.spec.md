# WebRTC + Expo Voice Implementation Plan

## Overview
This document outlines the implementation plan for push-to-talk voice functionality using **WebRTC for signaling/connection management** and **Expo libraries (expo-av, @react-native-voice/voice) for audio capture and playback**. This approach provides better cross-platform compatibility and leverages React Native's mature audio ecosystem.

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

## Phase 1: Core Voice Session Management ✅ (Existing)

### 🎯 Current State
The following components are already implemented in `apps/mobile/hooks/useVoiceSession.ts`:

#### Implemented Features
- [x] WebRTC peer connection setup
- [x] ICE candidate handling
- [x] Audio stream management (getUserMedia)
- [x] Session state management (connecting/active/recording)
- [x] Speech recognition integration via `@react-native-voice/voice`
- [x] Push-to-talk controls (setRecording)
- [x] Pre-initialization for faster startup
- [x] Error handling and cleanup

#### Existing Services
- [x] `speechRecognitionService.ts` - Wrapper for @react-native-voice/voice
- [x] Backend `/api/voice/session` endpoint (VoiceController)
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

## Phase 2: Backend Audio Processing Implementation

### 🎯 Objective
Implement backend services to process audio from mobile app and return AI-generated TTS audio.

### 📋 Backend Tasks

#### 2.1 Audio Processing Service

##### Create `services/api/Services/IAudioProcessingService.cs`
```csharp
public interface IAudioProcessingService
{
    /// <summary>
    /// Process audio from user (STT), get AI response, convert to speech (TTS)
    /// </summary>
    Task<AudioProcessingResult> ProcessAudioAsync(
        string audioBase64,
        AudioFormat format,
        string? conversationId = null,
        CancellationToken cancellationToken = default);
}

public class AudioProcessingResult
{
    public string TranscribedText { get; set; } = string.Empty;
    public string ResponseText { get; set; } = string.Empty;
    public byte[] ResponseAudio { get; set; } = Array.Empty<byte>();
    public string ConversationId { get; set; } = string.Empty;
}

public enum AudioFormat
{
    Wav,
    Pcm16
}
```

##### Implement `services/api/Services/AudioProcessingService.cs`
```csharp
public class AudioProcessingService : IAudioProcessingService
{
    private readonly IAzureSpeechService _speechService;
    private readonly IAgentService _agentService;
    
    public async Task<AudioProcessingResult> ProcessAudioAsync(...)
    {
        // 1. Convert audio to speech (STT)
        var transcription = await _speechService.SpeechToTextAsync(audioBase64, format);
        
        // 2. Get AI response from agent
        var aiResponse = await _agentService.GetResponseAsync(
            new UserQuery { Query = transcription, ConversationId = conversationId });
        
        // 3. Convert response to speech (TTS)
        var audioBytes = await _speechService.TextToSpeechAsync(aiResponse.Response);
        
        return new AudioProcessingResult
        {
            TranscribedText = transcription,
            ResponseText = aiResponse.Response,
            ResponseAudio = audioBytes,
            ConversationId = aiResponse.ThreadId
        };
    }
}
```

#### 2.2 Azure Speech Service Integration

##### Create `services/api/Services/IAzureSpeechService.cs`
```csharp
public interface IAzureSpeechService
{
    Task<string> SpeechToTextAsync(string audioBase64, AudioFormat format);
    Task<byte[]> TextToSpeechAsync(string text, string voice = "en-US-AvaMultilingualNeural");
}
```

##### Implement `services/api/Services/AzureSpeechService.cs`
```csharp
public class AzureSpeechService : IAzureSpeechService
{
    private readonly SpeechConfig _speechConfig;
    
    public AzureSpeechService(IConfiguration configuration)
    {
        var key = configuration["AzureSpeech:Key"];
        var region = configuration["AzureSpeech:Region"];
        _speechConfig = SpeechConfig.FromSubscription(key, region);
    }
    
    public async Task<string> SpeechToTextAsync(string audioBase64, AudioFormat format)
    {
        var audioBytes = Convert.FromBase64String(audioBase64);
        using var audioStream = new MemoryStream(audioBytes);
        using var audioConfig = AudioConfig.FromStreamInput(
            new BinaryAudioStreamReader(audioStream));
        using var recognizer = new SpeechRecognizer(_speechConfig, audioConfig);
        
        var result = await recognizer.RecognizeOnceAsync();
        return result.Text;
    }
    
    public async Task<byte[]> TextToSpeechAsync(string text, string voice)
    {
        _speechConfig.SpeechSynthesisVoiceName = voice;
        using var synthesizer = new SpeechSynthesizer(_speechConfig, null);
        var result = await synthesizer.SpeakTextAsync(text);
        return result.AudioData;
    }
}
```

#### 2.3 Update Voice Controller

##### Extend `services/api/Controllers/VoiceController.cs`
```csharp
[ApiController]
[Route("api/voice")]
[EnableRateLimiting("DefaultPolicy")]
public class VoiceController : ControllerBase
{
    // Existing: POST /api/voice/session - Create voice session
    
    // NEW: Process audio from user
    [HttpPost("process")]
    public async Task<IActionResult> ProcessAudio([FromBody] AudioRequest request)
    {
        try
        {
            var result = await _audioProcessingService.ProcessAudioAsync(
                request.AudioData,
                request.Format,
                request.ConversationId);
            
            return Ok(new AudioResponse
            {
                Transcription = result.TranscribedText,
                ResponseText = result.ResponseText,
                AudioData = Convert.ToBase64String(result.ResponseAudio),
                ConversationId = result.ConversationId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process audio");
            return StatusCode(500, "Audio processing failed");
        }
    }
}
```

#### 2.4 Configuration Updates

##### Add to `appsettings.json`
```json
{
  "AzureSpeech": {
    "Key": "your-azure-speech-key",
    "Region": "eastus2",
    "DefaultVoice": "en-US-AvaMultilingualNeural"
  }
}
```

##### Update `Program.cs`
```csharp
// Register audio services
builder.Services.AddSingleton<IAzureSpeechService, AzureSpeechService>();
builder.Services.AddScoped<IAudioProcessingService, AudioProcessingService>();
```

---

## Phase 3: Frontend Audio Integration

### 🎯 Objective
Complete the audio recording/playback cycle in the mobile app using expo-av.

### 📋 Frontend Tasks

#### 3.1 Audio Service Enhancement

##### Update `apps/mobile/services/voiceAudioService.ts` (New File)
```typescript
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

export interface AudioProcessingRequest {
  audioData: string; // Base64
  format: 'Wav' | 'Pcm16';
  conversationId?: string;
}

export interface AudioProcessingResponse {
  transcription: string;
  responseText: string;
  audioData: string; // Base64 TTS audio
  conversationId: string;
}

export class VoiceAudioService {
  private recording: Audio.Recording | null = null;
  private soundObject: Audio.Sound | null = null;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  // Start recording audio
  async startRecording(): Promise<void> {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Audio permission not granted');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    });

    this.recording = new Audio.Recording();
    await this.recording.prepareToRecordAsync({
      ios: {
        extension: '.wav',
        outputFormat: 'lpcm',
        audioQuality: 127,
        sampleRate: 24000,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false
      },
      android: {
        extension: '.wav',
        outputFormat: 0,
        audioEncoder: 3,
        sampleRate: 24000,
        numberOfChannels: 1,
        bitRate: 128000
      }
    });

    await this.recording.startAsync();
  }

  // Stop recording and send to backend
  async stopRecordingAndProcess(conversationId?: string): Promise<AudioProcessingResponse> {
    if (!this.recording) throw new Error('No active recording');

    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    if (!uri) throw new Error('No recording URI');

    // Read WAV file as base64
    const base64Audio = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64
    });

    // Strip WAV header (44 bytes) for PCM16 format
    const wavHeaderSize = Math.ceil(44 * 4 / 3); // Base64 representation
    const pcm16Data = base64Audio.substring(wavHeaderSize);

    // Send to backend for processing
    const response = await axios.post<AudioProcessingResponse>(
      `${this.apiBaseUrl}/voice/process`,
      {
        audioData: pcm16Data,
        format: 'Pcm16',
        conversationId
      }
    );

    this.recording = null;
    return response.data;
  }

  // Play TTS audio response
  async playAudioResponse(base64Audio: string): Promise<void> {
    // Convert base64 to WAV
    const wavData = this.pcm16ToWav(base64Audio);
    const base64Wav = this.arrayBufferToBase64(wavData);
    const uri = `data:audio/wav;base64,${base64Wav}`;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );

    this.soundObject = sound;
    
    return new Promise((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          this.soundObject = null;
          resolve();
        }
      });
    });
  }

  // Stop audio playback (interrupt AI)
  async stopAudioPlayback(): Promise<void> {
    if (this.soundObject) {
      await this.soundObject.unloadAsync();
      this.soundObject = null;
    }
  }

  isPlaying(): boolean {
    return this.soundObject !== null;
  }

  // Helper: Convert PCM16 to WAV
  private pcm16ToWav(base64Pcm: string): ArrayBuffer {
    const pcmData = Uint8Array.from(atob(base64Pcm), c => c.charCodeAt(0));
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // WAV header construction
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels (mono)
    view.setUint32(24, 24000, true); // SampleRate
    view.setUint32(28, 48000, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    this.writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);

    const wavFile = new Uint8Array(44 + pcmData.length);
    wavFile.set(new Uint8Array(wavHeader), 0);
    wavFile.set(pcmData, 44);

    return wavFile.buffer;
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
```

#### 3.2 Update useVoiceSession Hook

##### Modify `apps/mobile/hooks/useVoiceSession.ts`
```typescript
// Add VoiceAudioService integration
import { VoiceAudioService } from '../services/voiceAudioService';

export const useVoiceSession = (onVoiceResponse?: ...) => {
  const audioServiceRef = useRef<VoiceAudioService | null>(null);
  
  // Initialize audio service
  useEffect(() => {
    audioServiceRef.current = new VoiceAudioService(getApiBaseUrl());
  }, []);

  // Enhanced setRecording with audio processing
  const setRecording = useCallback(async (recording: boolean) => {
    if (!audioServiceRef.current) return;

    if (recording) {
      // Start recording
      await audioServiceRef.current.startRecording();
      updateState({ isRecording: true });
    } else {
      // Stop recording and process
      try {
        updateState({ isRecording: false });
        
        const result = await audioServiceRef.current.stopRecordingAndProcess(
          conversationIdRef.current || undefined
        );

        // Update conversation ID
        if (result.conversationId) {
          conversationIdRef.current = result.conversationId;
        }

        // Notify with user transcription
        onVoiceResponse?.({
          responseText: result.transcription,
          threadId: result.conversationId,
          isUserMessage: true
        });

        // Play AI response
        await audioServiceRef.current.playAudioResponse(result.audioData);

        // Notify with AI response
        onVoiceResponse?.({
          responseText: result.responseText,
          threadId: result.conversationId,
          isUserMessage: false
        });
      } catch (error) {
        console.error('Audio processing failed:', error);
        updateState({ error: 'Failed to process audio' });
      }
    }
  }, [onVoiceResponse, updateState]);

  // Add stop audio playback method
  const stopAudioPlayback = useCallback(async () => {
    if (audioServiceRef.current) {
      await audioServiceRef.current.stopAudioPlayback();
    }
  }, []);

  return {
    ...state,
    startVoiceSession,
    stopVoiceSession,
    setRecording,
    stopAudioPlayback,
    isSupported: true,
    clearError
  };
};
```

#### 3.3 UI Updates (Minimal - Reuse Existing)

The existing ChatScreen UI can remain largely unchanged:
- Mic button for push-to-talk (already implemented)
- Visual feedback for recording state (already implemented)
- Conversation display with voice messages (already implemented)

Only minor adjustments needed:
- Remove Foundry-specific toggle/UI elements
- Ensure voice mode indicators work with new implementation

---

## Phase 4: Testing & Validation

### 🎯 Objective
Ensure end-to-end voice functionality works correctly across all scenarios.

### 📋 Testing Tasks

#### 4.1 Backend Tests

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
- [ ] Voice session starts successfully
- [ ] Push-to-talk recording captures audio
- [ ] Audio is transcribed correctly (STT)
- [ ] AI response is generated
- [ ] TTS audio plays back clearly
- [ ] Conversation ID is maintained across turns
- [ ] Error handling works (no permissions, network failure)
- [ ] Rate limiting is enforced
- [ ] Multiple consecutive voice interactions work

---

## Phase 5: Production Readiness

### 🎯 Objective
Prepare voice functionality for production deployment with monitoring and security.

### 📋 Production Tasks

#### 5.1 Security & Performance
- [ ] Add Application Insights tracking for voice endpoints
- [ ] Implement audio file size limits (prevent abuse)
- [ ] Add audio format validation
- [ ] Configure Azure Speech Service quotas
- [ ] Set up alerting for failures/high latency

#### 5.2 Azure Front Door Configuration
- [ ] Route `/api/voice/*` through AFD
- [ ] Configure WAF rules for voice endpoints
- [ ] Set appropriate rate limits (e.g., 10 requests/min per user)
- [ ] Add health checks for voice service

#### 5.3 Monitoring & Telemetry
```csharp
// Add to AudioProcessingService
_telemetryClient.TrackEvent("VoiceProcessing", new Dictionary<string, string>
{
    { "TranscriptionLength", result.TranscribedText.Length.ToString() },
    { "AudioSizeBytes", audioBytes.Length.ToString() },
    { "ProcessingTimeMs", stopwatch.ElapsedMilliseconds.ToString() }
});
```

#### 5.4 Documentation
- [ ] Update API documentation with voice endpoints
- [ ] Create user guide for voice features
- [ ] Document audio format requirements
- [ ] Add troubleshooting guide

---

## Dependencies

### Frontend
- `expo-av` - ✅ Already installed (audio recording/playback)
- `@react-native-voice/voice` - ✅ Already installed (speech recognition)
- `react-native-webrtc` - ✅ Already installed (peer connection management)
- `expo-file-system` - ✅ Already installed (file reading)

### Backend
- `Microsoft.CognitiveServices.Speech` - 🔴 **NEW** (Azure Speech SDK)
- Existing: `Azure.AI.Projects`, `Microsoft.AspNetCore.RateLimiting`

### Azure Services
- Azure Speech Services (STT/TTS) - **Required**
- Azure AI Agent Service - ✅ Already configured
- Cosmos DB - ✅ Already configured

---

## Migration from Foundry Live Voice

### Files to Remove
1. `apps/mobile/services/foundryVoiceService.ts` - ❌ Delete
2. `apps/mobile/hooks/useFoundryVoiceSession.ts` - ❌ Delete
3. `.github/specs/push_to_talk/full_foundry_live_voice_integration_plan.spec.md` - ❌ Delete
4. `.github/specs/push_to_talk/top_level_plan.spec.md` - ❌ Delete (if Foundry-specific)

### Files to Keep & Refactor
1. `apps/mobile/hooks/useVoiceSession.ts` - ✅ Keep (add audio processing)
2. `apps/mobile/services/speechRecognitionService.ts` - ✅ Keep (unchanged)
3. `services/api/Controllers/VoiceController.cs` - ✅ Keep (extend with audio endpoint)
4. `services/shared/models/VoiceSessionRequest.cs` - ✅ Keep (add audio models)
5. `apps/mobile/screens/ChatScreen.tsx` - ✅ Keep (remove Foundry toggle UI)

### Configuration Changes
```json
// Remove from appsettings.json
{
  "VoiceService": {
    "Endpoint": "...", // Remove Azure OpenAI Realtime references
    "AzureOpenAIKey": "..." // Remove
  }
}

// Add to appsettings.json
{
  "AzureSpeech": {
    "Key": "your-azure-speech-key",
    "Region": "eastus2",
    "DefaultVoice": "en-US-AvaMultilingualNeural"
  }
}
```

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

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1 | ✅ Complete | Already implemented |
| Phase 2 | 2-3 days | Backend audio processing |
| Phase 3 | 2-3 days | Frontend audio integration |
| Phase 4 | 2 days | Testing & validation |
| Phase 5 | 1-2 days | Production setup |
| **Total** | **7-10 days** | For full production-ready implementation |

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

This implementation plan provides a **robust, scalable, and maintainable** voice solution by:
- Leveraging proven React Native audio libraries
- Using Azure Speech Services for high-quality STT/TTS
- Building on existing WebRTC infrastructure
- Maintaining architectural consistency with the rest of the codebase

The approach avoids the complexity of Azure OpenAI Realtime API while delivering a superior user experience through native audio capabilities and battle-tested speech recognition.
