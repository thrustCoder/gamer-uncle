# Push-to-Talk Implementation Plan - REDIRECTED

## 🔄 Implementation Approach Changed

**Date:** January 2025  
**Status:** Reverting to WebRTC + Expo Voice Implementation

---

## 📌 New Implementation Plan

This document has been **deprecated** in favor of a simpler, more maintainable approach using WebRTC for connection management and Expo libraries for audio capture/playback.

**Please refer to the new implementation plan:**

👉 **[WebRTC Voice Implementation Plan](./webrtc_voice_implementation_plan.spec.md)**

---

## 🎯 Why the Change?

The Foundry Live Voice implementation (Azure OpenAI Realtime API) has been **discontinued** due to:

1. **Complexity**: The Realtime API adds unnecessary complexity for the use case
2. **Audio Quality Issues**: Inconsistent audio playback and recording quality
3. **Better Alternatives**: Expo's audio libraries (`expo-av`) provide superior cross-platform support
4. **Proven Foundation**: The existing `useVoiceSession` hook with WebRTC already works well
5. **Maintainability**: Simpler architecture with fewer dependencies

---

## 📝 Historical Context (Completed Phases)

### Phase 0: Security Infrastructure ✅
- Azure Front Door (AFD) configured
- WAF policies active
- Rate limiting enforced

### Phase 1: Foundry Voice Core ✅ (Now Deprecated)
- Backend voice session endpoints created
- Mobile WebRTC connection established
- Basic UI implemented

### Phase 2: Foundry Integration ✅ (Now Deprecated)
- Full Azure OpenAI Realtime API integration
- Production security implemented
- All tests passing

---

## 🚀 Next Steps

1. **Review New Plan**: Read `webrtc_voice_implementation_plan.spec.md`
2. **Remove Foundry Code**: Clean up deprecated Foundry Live Voice implementation
3. **Implement Audio Services**: Add backend Azure Speech Services integration
4. **Update Frontend**: Integrate `expo-av` for recording/playback
5. **Test & Deploy**: Full E2E testing with new approach

---

## � Files Affected

### To Remove
- `apps/mobile/services/foundryVoiceService.ts`
- `apps/mobile/hooks/useFoundryVoiceSession.ts`
- Foundry-specific configuration in `appsettings.json`

### To Keep & Enhance
- `apps/mobile/hooks/useVoiceSession.ts` (add audio processing)
- `apps/mobile/services/speechRecognitionService.ts` (unchanged)
- `services/api/Controllers/VoiceController.cs` (extend with audio endpoint)
- `apps/mobile/screens/ChatScreen.tsx` (remove Foundry toggle)

---

## 📊 Success Metrics (Unchanged)

The technical and UX success metrics remain the same:
- End-to-end latency: <5 seconds
- STT accuracy: >95%
- Session success rate: >99%
- Voice feature adoption: >40%

---

**For detailed implementation instructions, see:**  
📖 **[webrtc_voice_implementation_plan.spec.md](./webrtc_voice_implementation_plan.spec.md)**