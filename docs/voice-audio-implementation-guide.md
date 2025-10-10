# Voice Audio Implementation Guide

## Overview

This document explains how to implement bidirectional audio streaming for the Azure OpenAI Realtime API in the Gamer Uncle mobile app.

## Current Status (✅ Working)

1. **WebSocket Connection**: Successfully connects to Azure OpenAI Realtime API
2. **Session Management**: Creates sessions with board game context from backend
3. **Microphone Permissions**: Gets user mic access via react-native-webrtc
4. **Transcription**: 
   - ✅ English language forced (`language: 'en'`)
   - ✅ AI responses buffered (no more character-by-character display)
   - ✅ User transcripts displayed immediately
5. **Audio Track**: Microphone audio track is enabled and accessible

## Missing Components (❌ Not Implemented)

### 1. Send Microphone Audio to Azure (Input Audio Streaming)

**What's needed:**
- Capture raw PCM16 audio from microphone in real-time
- Base64 encode the PCM16 data
- Send via WebSocket as `input_audio_buffer.append` events

**Technical Challenge:**
- React Native doesn't have native `MediaRecorder` or Web Audio API
- `react-native-webrtc` provides MediaStream but not direct PCM access
- Need a React Native audio processing library

**Implementation Options:**

#### Option A: Use `react-native-audio-toolkit` (Recommended)
```bash
npm install react-native-audio-toolkit
```

**Pros:**
- Direct PCM16 access
- Low latency
- Works on iOS and Android

**Cons:**
- Additional native dependency
- Requires linking and configuration

**Code Pattern:**
```typescript
import { Recorder } from 'react-native-audio-toolkit';

private async startAudioCapture(): Promise<void> {
  const recorder = new Recorder('recording.wav', {
    format: 'pcm_16bit',
    sampleRate: 24000,
    channels: 1,
    quality: 'high'
  });

  recorder.prepare((err) => {
    if (err) return;
    
    // Set up callback to receive audio chunks
    recorder.on('data', (data: Buffer) => {
      // Convert to base64
      const base64Audio = data.toString('base64');
      
      // Send to Azure
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio
        }));
      }
    });
    
    recorder.record();
  });
}
```

#### Option B: Use `expo-audio` with File Reading
```typescript
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Record audio to file
const recording = new Audio.Recording();
await recording.prepareToRecordAsync({
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 24000,
    numberOfChannels: 1,
    linearPCMBitDepth: 16
  }
});

await recording.startAsync();

// When user stops talking:
await recording.stopAndUnloadAsync();
const uri = recording.getURI();

// Read the WAV file
const fileContent = await FileSystem.readAsStringAsync(uri, {
  encoding: FileSystem.EncodingType.Base64
});

// Extract PCM16 data (skip WAV header - first 44 bytes)
const wavHeader = 44 * 4 / 3; // 44 bytes in base64
const pcm16Base64 = fileContent.substring(wavHeader);

// Send to Azure
this.websocket.send(JSON.stringify({
  type: 'input_audio_buffer.append',
  audio: pcm16Base64
}));
```

**Pros:**
- Uses existing expo-av dependency
- No additional native modules

**Cons:**
- Not real-time (records full utterance then sends)
- Higher latency
- Requires expo-file-system

### 2. Play Azure's Audio Response (Output Audio Playback)

**What's needed:**
- Receive base64 PCM16 from `response.audio.delta` events
- Decode and convert to playable format
- Play through device speakers

**Current Implementation:**
```typescript
private async handleIncomingAudio(base64Audio: string): Promise<void> {
  // 1. Decode base64 to binary PCM16
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // 2. Queue for playback
  this.audioBufferQueue.push(bytes.buffer);
  
  // 3. Convert PCM16 to WAV and play
  if (!this.soundObject) {
    await this.playAudioQueue();
  }
}

private async playAudioQueue(): Promise<void> {
  // Concatenate all queued buffers
  const totalLength = this.audioBufferQueue.reduce((sum, buf) => sum + buf.byteLength, 0);
  const concatenated = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const buffer of this.audioBufferQueue) {
    concatenated.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  
  this.audioBufferQueue = [];
  
  // Convert PCM16 to WAV
  const wavBuffer = this.pcm16ToWav(concatenated, 24000, 1);
  const base64Wav = this.arrayBufferToBase64(wavBuffer);
  const uri = `data:audio/wav;base64,${base64Wav}`;
  
  // Play using expo-av
  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
  this.soundObject = sound;
  
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
      this.soundObject = null;
      
      // Play next chunk if available
      if (this.audioBufferQueue.length > 0) {
        this.playAudioQueue();
      }
    }
  });
}
```

**Status:** ✅ This implementation is complete and should work!

**Helper Functions Needed:**
```typescript
private pcm16ToWav(pcm16Data: Uint8Array, sampleRate: number, numChannels: number): ArrayBuffer {
  const dataLength = pcm16Data.length;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  
  // WAV file header
  this.writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  this.writeString(view, 8, 'WAVE');
  
  // "fmt " sub-chunk
  this.writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM format
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  
  // "data" sub-chunk
  this.writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Copy PCM data
  new Uint8Array(buffer, 44).set(pcm16Data);
  
  return buffer;
}

private writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

private arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

### 3. Testing the Current Implementation

**What You Can Test Now:**
1. **Session Creation**: Verify backend creates sessions successfully
2. **WebSocket Connection**: Confirm connection to Azure OpenAI
3. **Transcript Buffering**: Check AI responses appear as complete messages
4. **English Transcription**: Verify transcripts are in English

**How to Test:**
```bash
# 1. Start API server (in separate PowerShell window)
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\rajsin\r\Code\gamer-uncle'; `$env:AZURE_OPENAI_API_KEY='your_key'; dotnet run --project services/api/GamerUncle.Api.csproj --urls 'http://0.0.0.0:5001'"

# 2. Start Expo dev server (from apps/mobile directory)
Set-Location "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile"
npx expo start --clear

# 3. Open app on iPhone dev client
# Scan QR code from Expo dev server

# 4. Test voice features:
# - Tap microphone icon
# - Verify session creates (check API logs)
# - Verify WebSocket connects (check mobile app logs)
# - Check transcription appears (when Azure responds)
```

## Implementation Priority

### Phase 1: Audio Playback (READY TO IMPLEMENT) ✅
1. Add helper functions (`pcm16ToWav`, `writeString`, `arrayBufferToBase64`)
2. Implement `handleIncomingAudio` with queuing
3. Implement `playAudioQueue` with expo-av
4. Test with backend responses

**Estimated Time:** 1-2 hours  
**Risk:** Low (all dependencies available)

### Phase 2: Audio Capture (REQUIRES DECISION) ⚠️
**Option A: Real-time with react-native-audio-toolkit**
- Install library
- Implement streaming capture
- Test latency

**Estimated Time:** 4-6 hours  
**Risk:** Medium (native module setup)

**Option B: Batch with expo-audio + expo-file-system**
- Install expo-file-system
- Implement file-based capture
- Extract PCM16 from WAV

**Estimated Time:** 2-3 hours  
**Risk:** Low (pure JS), but higher latency

### Phase 3: Integration Testing
1. End-to-end voice conversation
2. Latency measurement
3. Error handling edge cases

**Estimated Time:** 2-4 hours

## Recommended Next Steps

1. **Implement Audio Playback First** (Phase 1)
   - It's ready to code with current dependencies
   - You can test with Azure's responses
   - Low risk, high value

2. **Test Playback Thoroughly**
   - Verify audio quality
   - Check latency
   - Ensure smooth playback

3. **Choose Audio Capture Strategy** (Phase 2)
   - Real-time: Better UX, more complex
   - Batch: Simpler code, higher latency
   - Depends on your priority (UX vs. speed of implementation)

4. **Full Integration** (Phase 3)
   - Only after both parts work independently

## Code to Add to foundryVoiceService.ts

```typescript
// Add these properties to the class:
private audioBufferQueue: ArrayBuffer[] = [];
private soundObject: Audio.Sound | null = null;

// Add these helper methods:
// (paste pcm16ToWav, writeString, arrayBufferToBase64 from above)

// Update handleIncomingAudio:
// (paste handleIncomingAudio implementation from above)

// Add playAudioQueue method:
// (paste playAudioQueue implementation from above)

// Update stopVoiceSession to clean up:
if (this.soundObject) {
  await this.soundObject.unloadAsync();
  this.soundObject = null;
}
this.audioBufferQueue = [];
```

## Expected Behavior After Implementation

### With Audio Playback Only:
- ✅ User taps mic, session creates
- ✅ User speaks (mic is active but audio isn't sent yet)
- ✅ Server detects silence (server-side VAD timeout)
- ✅ Azure responds with text + audio
- ✅ **Audio plays from speakers**
- ✅ Transcript appears in chat

### With Audio Playback + Capture:
- ✅ User taps mic, session creates
- ✅ **User speaks, audio streams to Azure**
- ✅ **Azure detects speech end via VAD**
- ✅ Azure responds with text + audio
- ✅ **Audio plays from speakers**
- ✅ Transcripts appear in chat (both user and AI)

## Troubleshooting

### Audio Playback Issues:
- Check expo-av permissions in Info.plist
- Verify base64 encoding is correct
- Test WAV header generation with known PCM16 data
- Check Audio.setAudioModeAsync settings

### Audio Capture Issues:
- Verify microphone permissions
- Check PCM16 format settings (24kHz, mono, 16-bit)
- Test WebSocket send with small audio chunks first
- Monitor Azure logs for input_audio_buffer events

## References

- [Azure OpenAI Realtime API Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio)
- [Expo AV Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
- [React Native WebRTC](https://github.com/react-native-webrtc/react-native-webrtc)
- [React Native Audio Toolkit](https://github.com/react-native-audio-toolkit/react-native-audio-toolkit)
