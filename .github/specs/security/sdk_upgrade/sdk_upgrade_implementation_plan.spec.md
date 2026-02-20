# iOS 26 SDK Upgrade Implementation Plan

## Trigger

**Apple Warning (Build Upload 3.1.1)**:
> 90725: SDK version issue. This app was built with the iOS 18.5 SDK. Starting April 28, 2026, all iOS and iPadOS apps must be built with the iOS 26 SDK or later, included in Xcode 26 or later, in order to be uploaded to App Store Connect or submitted for distribution.

**Deadline**: April 28, 2026
**Date of Assessment**: February 20, 2026
**Runway**: ~2 months

---

## Current State

| Component | Current Version |
|---|---|
| Expo SDK | 53 (released April 30, 2025) |
| React Native | 0.79.5 |
| React | 19.0.0 |
| TypeScript | ~5.8.3 |
| New Architecture | **Disabled** (`newArchEnabled: false`) |
| EAS Build image | Default (no `image` specified — resolves to Xcode with iOS 18.5 SDK) |
| iOS SDK in builds | **18.5** (needs to be 26+) |

---

## Expo SDK Release Timeline (Relevant)

| SDK | Release Date | React Native | Xcode 26 Support | Notes |
|---|---|---|---|---|
| **SDK 53** (current) | April 30, 2025 | 0.79 | No | Current version |
| **SDK 54** | **September 10, 2025** | 0.81 | **Yes - Full** | Recommended target. iOS 26 + Liquid Glass support. Last SDK with Legacy Architecture. |
| **SDK 55 Beta** | January 22, 2026 | 0.83.1 | Yes | Currently in beta (~2 week beta period). Drops Legacy Architecture entirely. |
| **SDK 55 Stable** | ~February 2026 (est.) | 0.83.x | Yes | Expected shortly after beta period ends |

**Key insight**: SDK 54 is already available and has full iOS 26 / Xcode 26 support. No need to wait for SDK 55.

---

## Recommended Upgrade Path: SDK 53 → SDK 54

SDK 54 is the safest upgrade because:
1. It has **full iOS 26 and Xcode 26 support** (EAS Build defaults to Xcode 26 for SDK 54 projects)
2. It is the **last SDK supporting Legacy Architecture** (`newArchEnabled: false`), giving a migration path
3. It has been stable since September 2025 (~5 months of community usage)
4. SDK 55 drops Legacy Architecture entirely, which would require enabling New Architecture simultaneously — a much riskier change

### Alternative: SDK 53 → SDK 55

Not recommended at this time because:
- SDK 55 is still in beta (released January 22, 2026)
- It **removes Legacy Architecture support** — our app has `newArchEnabled: false`
- It removes `expo-av` from Expo Go (we use `expo-av` ~15.1.7)
- Combines two major changes (SDK bump + New Architecture migration) into one

---

## Risk Assessment: 4 / 10

### Why relatively low risk:
- This is a **build toolchain upgrade**, not a business logic change — TypeScript/React Native app code stays the same
- Expo has a well-established SDK upgrade path with `npx expo install --fix`
- EAS handles the Xcode version server-side; no local Xcode setup needed on Windows
- SDK 54 has been stable for 5 months with broad community adoption
- Most Expo-managed packages auto-align with `npx expo install --fix`
- 2 months of runway before the April 28 deadline

### What pushes risk to 4:
- `react-native-webrtc` (v124.0.5) — heavy native code, historically lags behind iOS SDK updates
- `@react-native-voice/voice` (v3.2.4) — uses Speech framework
- `react-native-reanimated` v4 (shipped with SDK 54) **only supports New Architecture** — we must either enable New Architecture or pin Reanimated v3
- `expo-av` is deprecated in SDK 53, will be removed in SDK 55 — should migrate to `expo-audio` (which we already have)

---

## Scope of Changes

### 1. EAS Build Image (Effort: Low | Risk: 1/10)

**Current**: No `image` specified in `eas.json` — uses default Xcode (iOS 18.5 SDK)
**Change**: For SDK 54, EAS Build **defaults to Xcode 26** — no `image` change needed.

If we want to be explicit:
```json
{
  "build": {
    "production": {
      "ios": {
        "image": "latest"
      }
    }
  }
}
```

### 2. Expo SDK + React Native Upgrade (Effort: Medium | Risk: 3/10)

**Commands**:
```powershell
cd apps/mobile
npx expo install expo@^54.0.0 --fix
```

This will upgrade:
- `expo`: 53.0.22 → 54.x
- `react-native`: 0.79.5 → 0.81.x
- `react`: 19.0.0 → 19.1.x
- All `expo-*` packages to SDK 54 compatible versions
- TypeScript: ~5.8.3 → ~5.9.2 (recommended by SDK 54)

### 3. Reanimated v3 → v4 Decision (Effort: Medium-High | Risk: 5/10)

**Problem**: Reanimated v4 (shipped with SDK 54) **only supports New Architecture**.
Our app has `newArchEnabled: false`.

**Options**:

| Option | Approach | Risk |
|---|---|---|
| **A (Recommended)** | Keep `newArchEnabled: false` and pin Reanimated v3 | Low — [documented by Expo](https://github.com/expo/fyi/blob/main/expo-54-reanimated.md) |
| **B** | Enable New Architecture (`newArchEnabled: true`) and use Reanimated v4 | Medium — requires testing all screens/animations |

**Option A steps** (from Expo docs):
- Keep `newArchEnabled: false` in app.json
- Pin `react-native-reanimated` to v3.x compatible version
- Skip modifying babel.config.js (handled by `babel-preset-expo`)

**Option B** should be a separate follow-up task after the SDK upgrade is validated.

### 4. Native Dependencies Audit (Effort: Medium | Risk: 4/10)

| Package | Current | SDK 54 Compatible? | Action |
|---|---|---|---|
| `react-native-webrtc` | ^124.0.5 | TBD — verify | Check for iOS 26 compatible version |
| `@react-native-voice/voice` | ^3.2.4 | TBD — verify | Check for iOS 26 compatible version |
| `react-native-reanimated` | ~3.17.4 | v3 with pin (see above) | Pin to v3 or upgrade to v4 with New Arch |
| `react-native-screens` | ~4.11.1 | Auto-aligned | `npx expo install --fix` |
| `react-native-gesture-handler` | ~2.24.0 | Auto-aligned | `npx expo install --fix` |
| `react-native-safe-area-context` | 5.4.0 | Auto-aligned | `npx expo install --fix` |
| `expo-av` | ~15.1.7 | Deprecated | Plan migration to `expo-audio` (already in deps) |
| `expo-audio` | ~0.4.9 | Auto-aligned | `npx expo install --fix` |
| `expo-file-system` | ^19.0.17 | Breaking change | Default exports replaced. Quick fix: change imports to `expo-file-system/legacy` |
| `lottie-react-native` | 7.2.2 | TBD — verify | Check compatibility |

### 5. Breaking Changes from SDK 54 (Effort: Low-Medium | Risk: 3/10)

| Breaking Change | Impact on Our App | Action Required |
|---|---|---|
| `expo-file-system` default exports replaced | If we use `expo-file-system` imports | Change to `expo-file-system/legacy` or migrate to new API |
| Reanimated v4 requires New Architecture | We have `newArchEnabled: false` | Pin Reanimated v3 (Option A above) |
| JSC support removed from React Native | Only if using JSC engine | No action — we use Hermes (default) |
| `expo-av` deprecated | We use `expo-av` ~15.1.7 | Still works in SDK 54; plan migration to `expo-audio` for SDK 55 |
| Metro internal imports changed | Only if custom metro config | Review `metro.config.js` if present |
| React Native `<SafeAreaView>` deprecated | If used directly | We use `react-native-safe-area-context` — no action |
| `@expo/vector-icons` families updated | If using renamed icons | TypeScript check will catch issues |

### 6. Pipeline / CI Updates (Effort: Low | Risk: 1/10)

The Azure pipeline (`pipelines/azure-pipelines.yml`) triggers EAS builds remotely. Since EAS handles Xcode version selection server-side, no pipeline changes are needed. SDK 54 projects **default to Xcode 26** on EAS Build.

### 7. iOS 26 Info.plist / Privacy Changes (Effort: Low | Risk: 1/10)

Review Apple's iOS 26 release notes for any new required privacy keys. Current `infoPlist` declarations in `app.json`:
- `NSMicrophoneUsageDescription` ✓
- `NSCameraUsageDescription` ✓
- `NSPhotoLibraryUsageDescription` ✓
- `NSSpeechRecognitionUsageDescription` ✓
- `ITSAppUsesNonExemptEncryption: false` ✓

### 8. Testing (Effort: Medium | Risk: 2/10)

After the upgrade:
1. Rebuild dev client: `eas build --platform ios --profile development`
2. Run unit tests: `cd apps/mobile && npm test`
3. Run E2E tests: `npm run test:e2e`
4. Manual testing: voice chat, WebRTC, animations, all navigation flows
5. Validate on physical iOS device
6. Build and submit to TestFlight for wider testing

---

## Implementation Steps

### Phase 1: SDK Upgrade (Target: Week 1)
1. Create feature branch `feature/ios26-sdk-upgrade`
2. Run `npx expo install expo@^54.0.0 --fix` from `apps/mobile/`
3. Pin Reanimated v3 if keeping Legacy Architecture (Option A)
4. Update `expo-file-system` imports if needed
5. Run `npx expo-doctor@latest` to check for issues
6. Run unit tests
7. Build dev client on EAS and validate

### Phase 2: Native Dependency Validation (Target: Week 1-2)
8. Test `react-native-webrtc` compilation with Xcode 26 / iOS 26 SDK
9. Test `@react-native-voice/voice` compilation
10. Test `lottie-react-native` compilation
11. Verify all EAS build profiles succeed

### Phase 3: App Validation (Target: Week 2)
12. Full manual testing on iOS device
13. Run E2E test suite
14. Run functional API tests (no changes expected, but validate)
15. TestFlight submission for wider testing

### Phase 4: Production Release (Target: Week 3)
16. Merge to main
17. Production build: `eas build --platform ios --profile production`
18. Submit to App Store
19. Verify no Apple SDK warnings on upload

---

## Rollback Plan

If the upgrade fails or introduces critical issues:
- Revert the feature branch
- Continue submitting with SDK 53 / iOS 18.5 SDK (still accepted until April 28, 2026)
- Investigate specific failure and retry

---

## Post-SDK 54 Roadmap (Future Work)

| Task | Timeline | Dependency |
|---|---|---|
| Enable New Architecture (`newArchEnabled: true`) | After SDK 54 stable | Test all native modules |
| Upgrade Reanimated v3 → v4 | After New Architecture enabled | New Architecture |
| Migrate `expo-av` → `expo-audio` fully | Before SDK 55 upgrade | `expo-av` removed in SDK 55 |
| Upgrade to SDK 55 | After stable release (~March 2026) | New Architecture required |
| Adopt Liquid Glass / `.icon` format | Optional | SDK 54+ |

---

## References

- [Expo SDK 54 Release Notes](https://expo.dev/changelog/sdk-54) (September 10, 2025)
- [Expo SDK 55 Beta](https://expo.dev/changelog/sdk-55-beta) (January 22, 2026)
- [Xcode 26 Beta Support on EAS Build](https://expo.dev/changelog/xcode-26-0-beta-support-for-eas-build-and-workflows) (August 27, 2025)
- [Reanimated v3 with SDK 54](https://github.com/expo/fyi/blob/main/expo-54-reanimated.md)
- [SDK 54 Upgrade Guide](https://docs.expo.dev/bare/upgrade/)
- [Expo Skills for Upgrading](https://github.com/expo/skills/tree/main/plugins/upgrading-expo)