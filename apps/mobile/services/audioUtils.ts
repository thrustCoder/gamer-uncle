/**
 * Audio Utilities for Azure OpenAI Realtime API
 * Handles PCM16 ↔ WAV conversions and audio processing
 */

/**
 * Converts PCM16 audio data to WAV format for playback
 * @param pcm16Data - Raw PCM16 audio data (16-bit signed integers)
 * @param sampleRate - Audio sample rate (typically 24000 for Azure OpenAI)
 * @param numChannels - Number of audio channels (1 for mono, 2 for stereo)
 * @returns ArrayBuffer containing complete WAV file
 */
export function pcm16ToWav(
  pcm16Data: Uint8Array,
  sampleRate: number = 24000,
  numChannels: number = 1
): ArrayBuffer {
  const dataLength = pcm16Data.length;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true); // File size - 8
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
  view.setUint16(32, numChannels * 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true); // Subchunk size

  // Copy PCM data
  new Uint8Array(buffer, 44).set(pcm16Data);

  return buffer;
}

/**
 * Writes a string to a DataView at specified offset
 * Used for WAV file header construction
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Converts ArrayBuffer to base64 string
 * Used for creating data URIs for audio playback
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes base64 PCM16 audio from Azure OpenAI
 * @param base64Audio - Base64 encoded PCM16 audio data
 * @returns Uint8Array containing raw PCM16 data
 */
export function decodeBase64PCM16(base64Audio: string): Uint8Array {
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes PCM16 audio data to base64 for sending to Azure OpenAI
 * @param pcm16Data - Raw PCM16 audio data
 * @returns Base64 encoded string
 */
export function encodePCM16ToBase64(pcm16Data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < pcm16Data.length; i++) {
    binary += String.fromCharCode(pcm16Data[i]);
  }
  return btoa(binary);
}

/**
 * Concatenates multiple PCM16 audio buffers into a single buffer
 * Used for merging audio deltas from Azure OpenAI
 */
export function concatenateAudioBuffers(buffers: ArrayBuffer[]): Uint8Array {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const concatenated = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    concatenated.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return concatenated;
}

/**
 * Extracts PCM16 data from a WAV file
 * Skips the 44-byte WAV header
 * @param wavData - Complete WAV file data
 * @returns PCM16 audio data without WAV header
 */
export function extractPCM16FromWav(wavData: Uint8Array): Uint8Array {
  // WAV files have a 44-byte header, PCM data starts at byte 44
  return wavData.slice(44);
}

/**
 * Converts Float32 audio samples to Int16 PCM16 format
 * Used when capturing audio from Web Audio API (if available)
 */
export function float32ToPCM16(float32Array: Float32Array): Int16Array {
  const pcm16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return pcm16Array;
}

/**
 * Converts Int16 PCM16 format to Float32 audio samples
 * Used when playing audio through Web Audio API (if available)
 */
export function pcm16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return float32Array;
}
