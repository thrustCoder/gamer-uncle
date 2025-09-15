# Push-to-Talk (PTT) with Foundry Live Voice (Option A: Preload / Stream-in Context)

## 🎯 Objective
Enable **Push-to-Talk (PTT)** in the Gamer Uncle app using **Foundry Live Voice** sessions, while removing dependency on Azure Speech.  
This plan uses the **preload / stream-in context** pattern:
- App Service fetches a lightweight RAG snippet from Cosmos DB and injects it into the agent session up front.
- The agent begins speaking immediately when the session starts.
- Additional context can be streamed in mid-turn if needed.

---

## 🖥 Backend Plan (App Service)

### 1. New Endpoint: `/api/voice/session`
**Purpose:** Bootstrap a Live Voice session for the mobile app.

**Flow:**
1. Mobile app calls:
   ```http
   POST /api/voice/session
   {
     "gameId": "85",
     "players": 4
   }
   ```
2. App Service queries Cosmos DB for **preload RAG snippet**:
   - Fields: `setupSummary`, `rulesUrl`, `playtime`, `mechanics[]`.
   - Keep response compact (few KB).
3. App Service starts a **Foundry Live Voice session**:
   - Binds to `{ agentId, conversationId }` of the persistent agent.
   - Injects preload snippet as a **system message**:
     ```
     Context: Quebec 1759 setup summary...
     Rules available at: https://boardgamegeek.com/...
     ```
4. App Service returns session info:
   ```json
   {
     "sessionId": "...",
     "token": "...",        // ephemeral token (<5 min)
     "rtcEndpoint": "...",  // Foundry Realtime URL
     "agentConversationId": "..."
   }
   ```

---

### 2. Cosmos Query Optimizations
- Use projection query to fetch **just the preload snippet**.  
- Cache common `{gameId, players}` lookups in-memory or Redis.  
- Target <50ms Cosmos latency.  
- TTL caches to manage cost.

---

### 3. Security
- Do **not** expose Foundry keys to the client.  
- App Service mints short-lived ephemeral tokens.  
- Protect `/api/voice/session` with EasyAuth + AFD/WAF.  
- Add correlation IDs for debugging session start → Cosmos → Foundry.

---

### 4. Logging / Telemetry
- Log:
  - `cosmosLookupMs`
  - `sessionStartMs`
  - `conversationId`
- Never log audio streams.  
- Use correlation IDs for tracing.

---

## 📱 Frontend Plan (React Native, Expo + RN WebRTC)

### 1. Dependencies
```sh
yarn add react-native-webrtc
expo install expo-av
```
> ⚠ Requires a **custom Expo dev client** (cannot run in Expo Go).

---

### 2. Mic Button UI
- In **ChatScreen.tsx**, add mic button in the bottom bar.  
- `onPressIn → startPTT()`, `onPressOut → stopPTT()`.  
- Background: `assets/images/tool-background.png`.  
- Styles: defined in `styles/chatVoiceStyles.ts`.  
- Keep BackButton embedded at top (per existing pattern).

---

### 3. Voice Hook
`hooks/useVoiceSession.ts`:

```ts
import { mediaDevices, RTCPeerConnection } from 'react-native-webrtc';

export function useVoiceSession() {
  let pc: RTCPeerConnection | null = null;

  const start = async (gameId: string, players: number) => {
    // 1. Request session info
    const res = await fetch(`${API_BASE}/api/voice/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, players })
    });
    const { rtcEndpoint, token } = await res.json();

    // 2. Create peer connection
    pc = new RTCPeerConnection();
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => pc!.addTrack(track, stream));

    // 3. Play remote audio
    pc.ontrack = event => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
    };

    // 4. Connect to Foundry Realtime (use token + rtcEndpoint)
    // Copilot will scaffold signaling logic (offer/answer).
  };

  const stop = () => {
    pc?.close();
    pc = null;
  };

  return { start, stop };
}
```

---

### 4. ChatScreen Integration
```tsx
const { start, stop } = useVoiceSession();

<TouchableOpacity
  onPressIn={() => start(selectedGameId, numPlayers)}
  onPressOut={stop}
  style={voiceStyles.micButton}
>
  <Text>🎤</Text>
</TouchableOpacity>
```

---

### 5. UX Enhancements
- **Visual feedback:** glowing mic button while pressed.  
- **Audio cues:** beep on press-in, chime on release.  
- **Fallback:** if WebRTC session fails, fall back to record → upload → STT.  
- **Accessibility:** support haptic feedback on press.

---

## 🔄 End-to-End Flow
1. User presses mic.  
2. Mobile calls `/api/voice/session { gameId, players }`.  
3. App Service:
   - Queries Cosmos DB for preload snippet.  
   - Starts Foundry Live Voice session.  
   - Injects preload context.  
   - Returns RTC endpoint + ephemeral token.  
4. Mobile opens WebRTC session to Foundry.  
5. Mic audio streams in; agent begins speaking immediately.  
6. App Service can append more context mid-turn if needed.  
7. User hears assistant reply within ~300ms.

---

## 📋 Implementation Tasks

### Backend
- [ ] Add `/api/voice/session`.  
- [ ] Query Cosmos for preload snippet.  
- [ ] Start Foundry Live Voice session with preload context.  
- [ ] Return session info + ephemeral token.  
- [ ] Secure endpoint (EasyAuth, AFD/WAF).  
- [ ] Add telemetry and correlation IDs.

### Frontend
- [ ] Add mic button to `ChatScreen.tsx`.  
- [ ] Create `styles/chatVoiceStyles.ts`.  
- [ ] Implement `hooks/useVoiceSession.ts`.  
- [ ] Handle WebRTC signaling + audio playback.  
- [ ] Add UX polish (beeps, glow, haptic).  
- [ ] Implement fallback if WebRTC not available.

---

## ✅ Outcome
- Azure Speech is no longer required.  
- Foundry Live Voice session provides **speech-in/speech-out** directly.  
- App Service still manages Cosmos RAG preload and session setup.  
- Users hear immediate voice feedback while enriched context streams in.
