# iOS 26 SDK Upgrade Implementation Plan

## Trigger

**Apple Warning (Build Upload 3.1.1)**:
> 90725: SDK version issue. This app was built with the iOS 18.5 SDK. Starting April 28, 2026, all iOS and iPadOS apps must be built with the iOS 26 SDK or later, included in Xcode 26 or later, in order to be uploaded to App Store Connect or submitted for distribution.

**Deadline**: April 28, 2026
**Date of Assessment**: February 20, 2026
**Runway**: ~2 months
**Status**: ✅ Phases 1–2 complete. Phase 3 nearly complete (TestFlight pending). Phase 4 pending.

### Phase Status Summary

| Phase | Description | Status | Remaining |
|---|---|---|---|
| **Phase 1** | SDK Upgrade | ✅ Complete | — |
| **Phase 2** | Native Dependency Validation | ✅ Complete | — |
| **Phase 3** | App Validation | ⏳ In Progress | TestFlight submission (step 15) |
| **Phase 4** | Production Release | ⬜ Pending | Merge, prod build, App Store submit, verify (steps 16–19) |

---

## Current State (Post-Upgrade)

| Component | Before | After | Status |
|---|---|---|---|
| Expo SDK | 53 | **~54.0.33** | ✅ Upgraded |
| React Native | 0.79.5 | **0.81.5** | ✅ Upgraded |
| React | 19.0.0 | **19.1.0** | ✅ Upgraded |
| TypeScript | ~5.8.3 | **~5.9.2 (5.9.3)** | ✅ Upgraded |
| New Architecture | Disabled | **Disabled** (`newArchEnabled: false`) | ✅ Preserved |
| react-native-reanimated | ~3.17.4 | **v3.17.4 (pinned)** | ✅ Pinned v3 (Option A) |
| EAS Build image | Default (Xcode / iOS 18.5) | **Default (Xcode 26 / iOS 26)** | ✅ Auto-resolved |
| iOS SDK in builds | 18.5 | **26+** | ✅ Resolved |

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

### 1. EAS Build Image (Effort: Low | Risk: 1/10) ✅ COMPLETE

**Current**: No `image` specified in `eas.json` — uses default Xcode (iOS 18.5 SDK)
**Change**: For SDK 54, EAS Build **defaults to Xcode 26** — no `image` change needed.
**Result**: No changes required. EAS auto-selects Xcode 26 for SDK 54 projects.

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

### 2. Expo SDK + React Native Upgrade (Effort: Medium | Risk: 3/10) ✅ COMPLETE

**Commands**:
```powershell
cd apps/mobile
npx expo install expo@^54.0.0 --fix
```

**Actual results**:
- `expo`: 53.0.22 → **~54.0.33**
- `react-native`: 0.79.5 → **0.81.5**
- `react`: 19.0.0 → **19.1.0**
- All `expo-*` packages aligned to SDK 54
- TypeScript: ~5.8.3 → **~5.9.2 (5.9.3 installed)**
- `@config-plugins/react-native-webrtc`: ^12.0.0 → **^13.0.0**
- `expo-asset` added as dependency and plugin
- `expo-doctor@latest`: **17/17 checks passed**
- Unit tests: **499/500 passed** (1 skipped)

**Additional fix required**: `react-native-web` 0.21.2 (shipped with SDK 54) removed `requireNativeComponent` export, which crashed the web build via `@react-native-masked-view/masked-view`. Fixed with `patch-package` polyfill applied to `react-native-web/dist/index.js`. Patch persisted via `postinstall: "patch-package"` script.

### 3. Reanimated v3 → v4 Decision (Effort: Medium-High | Risk: 5/10) ✅ COMPLETE — Option A selected

**Problem**: Reanimated v4 (shipped with SDK 54) **only supports New Architecture**.
Our app has `newArchEnabled: false`.

**Decision**: **Option A** — Keep `newArchEnabled: false` and pin Reanimated v3.

**What was done**:
- Kept `newArchEnabled: false` in app.json
- Pinned `react-native-reanimated` at v3.17.4 via `expo.install.exclude` in `package.json`
- Added `expo.doctor.reactNativeDirectoryCheck.exclude` for `react-native-webrtc` and `@react-native-voice/voice`
- No babel.config.js changes needed (handled by `babel-preset-expo`)

**Option B** (enable New Architecture + Reanimated v4) remains a follow-up task.

### 4. Native Dependencies Audit (Effort: Medium | Risk: 4/10) ✅ COMPLETE

| Package | Current | SDK 54 Compatible? | Action | Status |
|---|---|---|---|---|
| `react-native-webrtc` | ^124.0.5 | ✅ Yes | Kept as-is; `@config-plugins/react-native-webrtc` upgraded 12→13 | ✅ Verified on device |
| `@react-native-voice/voice` | ^3.2.4 | ✅ Yes | Kept as-is | ✅ Verified on device |
| `react-native-reanimated` | ~3.17.4 | ✅ v3 pinned | Pinned v3 via `expo.install.exclude` | ✅ Done |
| `react-native-screens` | ~4.11.1 | ✅ Auto-aligned | `npx expo install --fix` | ✅ Done |
| `react-native-gesture-handler` | ~2.24.0 | ✅ Auto-aligned | `npx expo install --fix` | ✅ Done |
| `react-native-safe-area-context` | 5.4.0 | ✅ Auto-aligned | `npx expo install --fix` | ✅ Done |
| `expo-av` | ~15.1.7 | ⚠️ Deprecated | Still works in SDK 54; deprecation warning shown | ⏳ Migrate to `expo-audio` before SDK 55 |
| `expo-audio` | ~0.4.9 | ✅ Auto-aligned | `npx expo install --fix` | ✅ Done |
| `expo-file-system` | ^19.0.17 | ✅ No issues | No import changes needed (not using removed exports) | ✅ Done |
| `lottie-react-native` | 7.2.2 | ✅ Yes | Compatible | ✅ Verified |

### 5. Breaking Changes from SDK 54 (Effort: Low-Medium | Risk: 3/10) ✅ RESOLVED

| Breaking Change | Impact on Our App | Action Required | Status |
|---|---|---|---|
| `expo-file-system` default exports replaced | No impact — not using removed exports | None | ✅ No action needed |
| Reanimated v4 requires New Architecture | We have `newArchEnabled: false` | Pinned Reanimated v3 | ✅ Done |
| JSC support removed from React Native | No impact — we use Hermes | None | ✅ No action needed |
| `expo-av` deprecated | We use `expo-av` ~15.1.7 | Still works in SDK 54; plan migration for SDK 55 | ⚠️ Deprecation warning only |
| Metro internal imports changed | No custom metro config issues | Added `metro.config.js` for web resolver | ✅ Done |
| React Native `<SafeAreaView>` deprecated | No impact — uses `react-native-safe-area-context` | None | ✅ No action needed |
| `@expo/vector-icons` families updated | No impact | None | ✅ No action needed |
| **`react-native-web` 0.21.2 removed `requireNativeComponent`** | **Crashed web build** via `@react-native-masked-view/masked-view` | **Patched via `patch-package`** | ✅ Fixed |

### 6. Pipeline / CI Updates (Effort: Low | Risk: 1/10) ✅ COMPLETE

The Azure pipeline (`pipelines/azure-pipelines.yml`) triggers EAS builds remotely. Since EAS handles Xcode version selection server-side, no pipeline changes were needed. SDK 54 projects **default to Xcode 26** on EAS Build.
**Result**: No pipeline changes required.

### 7. iOS 26 Info.plist / Privacy Changes (Effort: Low | Risk: 1/10) ✅ COMPLETE

All existing privacy keys remain valid for iOS 26. No new required keys identified.
- `NSMicrophoneUsageDescription` ✓
- `NSCameraUsageDescription` ✓
- `NSPhotoLibraryUsageDescription` ✓
- `NSSpeechRecognitionUsageDescription` ✓
- `ITSAppUsesNonExemptEncryption: false` ✓

### 8. Testing (Effort: Medium | Risk: 2/10) ✅ COMPLETE

| Test | Result | Details |
|---|---|---|
| `npx expo-doctor@latest` | ✅ 17/17 passed | All compatibility checks green |
| Unit tests (`npm test`) | ✅ 499/500 passed | 1 skipped (pre-existing) |
| E2E tests (Playwright) | ✅ 49/70 passed | 21 failures are pre-existing (API backend needed, web-incompatible voice features, UI selector updates unrelated to SDK) |
| Physical device testing | ✅ Passed | Voice chat, WebRTC, animations, navigation all working |
| EAS dev client build | ✅ Succeeded | Built with Xcode 26 / iOS 26 SDK |

---

## Implementation Steps

### Phase 1: SDK Upgrade ✅ COMPLETE
1. ✅ Create feature branch `feature/ios26-sdk-upgrade`
2. ✅ Run `npx expo install expo@^54.0.0 --fix` — upgraded to SDK ~54.0.33, RN 0.81.5, React 19.1.0, TS 5.9.3
3. ✅ Pinned Reanimated v3.17.4 (Option A) via `expo.install.exclude`
4. ✅ No `expo-file-system` import changes needed
5. ✅ `npx expo-doctor@latest` — 17/17 checks passed
6. ✅ Unit tests — 499/500 passed (1 skipped, pre-existing)
7. ✅ Dev client built on EAS successfully

**Additional work in Phase 1**:
- ✅ Fixed `react-native-web` 0.21.2 `requireNativeComponent` removal via `patch-package`
- ✅ Upgraded `@config-plugins/react-native-webrtc` 12→13
- ✅ Added `expo-asset` as dependency and plugin
- ✅ Migrated E2E tests from `uncle-header` → `center-circle` (19 occurrences across 12 files)
- ✅ Fixed voiceChat E2E tests to navigate to chat screen before testing
- ✅ Cleaned up temporary debug files

### Phase 2: Native Dependency Validation ✅ COMPLETE
8. ✅ `react-native-webrtc` compiles and works with Xcode 26 / iOS 26 SDK
9. ✅ `@react-native-voice/voice` compiles and works
10. ✅ `lottie-react-native` compiles and works
11. ✅ All EAS build profiles succeed

### Phase 3: App Validation ✅ COMPLETE
12. ✅ Full manual testing on physical iOS device — all features working
13. ✅ E2E test suite — 49/70 passed (remaining failures are pre-existing, not SDK-related)
14. ✅ API tests unaffected (no backend changes)
15. ⬜ TestFlight submission for wider testing

### Phase 4: Production Release ⬜ PENDING
16. ⬜ Merge to main
17. ⬜ Production build: `eas build --platform ios --profile production`
18. ⬜ Submit to App Store
19. ⬜ Verify no Apple SDK warnings on upload

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