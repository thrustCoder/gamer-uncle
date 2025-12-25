# Voice Options for "Gamer Uncle" Character

## Current Configuration (December 2025 - Iteration 6)
- **Voice**: `en-US-DavisNeural` - naturally deeper, mature male
- **Rate**: `0.75` (25% slower than normal)
- **Pitch**: `-40%` (sweet spot for 60s-70s elderly)
- **Volume**: `soft` (intimate, less robotic)
- **Leading Silence**: `150ms` (natural pause before speaking)

## What We've Tried (Chronological)

### Iteration 1 - Initial SSML
- Voice: `en-GB-RyanNeural`
- Rate: `0.85` (15% slower)
- Pitch: `+0%` (default)
- Result: ❌ Still too fast, not deep enough, sounded childish

### Iteration 2 - Deeper Voice Attempt
- Voice: `en-US-AndrewMultilingualNeural`
- Rate: `0.78` (22% slower)
- Pitch: `-12%` (lower)
- Volume: `-5%`
- Result: ❌ Still synthetic, not human-like enough

### Iteration 3 - Aggressive Settings
- Voice: `en-US-DavisNeural`
- Rate: `0.65` (35% slower)
- Pitch: `-25%` (much deeper)
- Volume: `soft`
- Leading silence: `200ms`
- Result: ⚠️ Sounds like 30s man, need more elderly

### Iteration 4 - Elderly Voice
- Voice: `en-US-DavisNeural`
- Rate: `0.75` (25% slower - not too sluggish)
- Pitch: `-35%` (very deep)
- Volume: `soft`
- Leading silence: `150ms`
- Result: ⚠️ Sounds like 50s man, need deeper for 70s

### Iteration 5 - Extra Deep
- Voice: `en-US-DavisNeural`
- Rate: `0.75`
- Pitch: `-45%` (extra deep, 70s target)
- Volume: `soft`
- Leading silence: `150ms`
- Result: ❌ Too deep, sounded unnatural/garbled

### Iteration 6 - Sweet Spot (Current)
- Voice: `en-US-DavisNeural`
- Rate: `0.75`
- Pitch: `-40%` (targeting 60s-70s)
- Volume: `soft`
- Leading silence: `150ms`
- Result: 🧪 Works!

## Fixes Applied
✅ **Conversation Context**: Fixed `conversationId` passing from ChatScreen → useVoiceSession → API
✅ **SSML Support**: Using `SpeakSsmlAsync()` instead of `SpeakTextAsync()`
✅ **Azure Tenant Auth**: Fixed with `az login --tenant c88223a3-60b3-4697-9374-209fc154bdf1`

## Currently Testing
- **en-US-DavisNeural** with aggressive SSML settings

## Other Mature Male Voices to Try

### US English Voices
1. **en-US-TonyNeural** - Already tested, supports emotional styles
2. **en-US-GuyNeural** - Mature male, supports various emotional styles
3. **en-US-JasonNeural** - Male with emotional range
4. **en-US-DavisNeural** - Already tested, mature male
5. **en-US-AndrewNeural** - Male voice
6. **en-US-BrianNeural** - Male voice
7. **en-US-EricNeural** - Male voice

### British English (Often Sound More Mature)
1. **en-GB-RyanNeural** ← CURRENT - British male with chat/cheerful/sad styles
2. **en-GB-AlfieNeural** - British male
3. **en-GB-ElliotNeural** - British male
4. **en-GB-EthanNeural** - British male
5. **en-GB-NoahNeural** - British male
6. **en-GB-OliverNeural** - British male
7. **en-GB-ThomasNeural** - British male

### Australian English (Deeper Tones)
1. **en-AU-WilliamNeural** - Australian male
2. **en-AU-DarrenNeural** - Australian male
3. **en-AU-DuncanNeural** - Australian male
4. **en-AU-KenNeural** - Australian male
5. **en-AU-NeilNeural** - Australian male
6. **en-AU-TimNeural** - Australian male

### OpenAI-style Voices (May Have Better Character)
These are preview voices with potentially richer character:
1. **en-US-OnyxMultilingualNeural** - Male, OpenAI-style
2. **en-US-EchoMultilingualNeural** - Male, OpenAI-style  
3. **en-US-AlloyMultilingualNeural** - Male, OpenAI-style

## How to Test
1. Edit `services/api/appsettings.Development.json`
2. Change the `DefaultVoice` value to the voice name above
3. Restart the API server (Ctrl+C, then up arrow + Enter)
4. Test with the mobile app

## What We're Looking For
- Deeper, gravelly voice
- Sounds elderly/mature
- Warm, friendly "uncle" character
- Not synthetic/teenage sounding
