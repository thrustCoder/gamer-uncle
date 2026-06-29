# Android Implementation Plan — Gamer Uncle

> Plan for expanding Gamer Uncle from iOS-only to Android, from first emulator build through Google Play Store production rollout. The mobile codebase (`apps/mobile/`) is already cross-platform Expo React Native; most work is logistics, Android-specific QA, and Play Console setup — not a rewrite.

---

## 1. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Play Console account | Personal (not yet created) | Subject to **one-time 20-tester / 14-day Closed Testing gate** before Production is unlocked. After this gate is passed once, all future releases (this app and any future apps on this account) ship straight to Production without re-testing. |
| Android package name | `com.thrustCoder.gamerUncle` | Mirrors iOS `bundleIdentifier`; **permanent once published**. |
| Release track plan | Internal → Closed → Open → Production (phased %) | Required path for new personal accounts; safest rollout. |
| CI/CD integration | Local EAS builds for v1; Azure DevOps integration in v1.1+ | Ship Android faster; automate after the first stable release. |
| `MinVersion` strategy | Keep single shared `AppVersionPolicy:MinVersion`; bump only when Android forces it | Avoids backend schema split; revisit if iOS/Android drift causes pain. |
| Test surfaces | Android Studio AVD emulator (primary) + physical device gate before Production | Emulator covers most cases; real device validates audio/network. |
| Voice / WebRTC scope | **Cut from v1.** Ship Android audio-text only; voice in v1.1 | Removes the largest risk (mic permission UX, WebRTC behavior, speech recognition). |
| Versioning scheme | **Single shared SemVer** (`app.json` → `version`) across iOS + Android, released simultaneously from the same commit | One source of truth; no `-android` suffix; iterative updates ship to both stores together. |
| Per-platform build counters | iOS `buildNumber` and Android `versionCode` tracked independently and incremented monotonically per upload | Apple and Google each enforce strictly-increasing build numbers per store, independent of SemVer. |
| Release artifact | Android App Bundle (`.aab`) | Required by Play Store since Aug 2021. |
| App signing | Google Play App Signing (Google holds the signing key) with EAS-managed upload key | Standard, recoverable; supports dynamic delivery. |

---

## 2. Phase Overview & Timeline

| Phase | Duration | Blocking? |
|---|---|---|
| 0 — Pre-flight (account + assets) | 1–7 days (verification waits) | Blocks all uploads |
| 1 — Codebase prep | 1–2 days | Can run parallel to Phase 0 |
| 2 — Play Console app creation + store listing | 1 day | Needs Phase 0 done |
| 3 — Emulator build & smoke test | 1 day | Needs Phase 1 done |
| 4 — Physical device test | 0.5 day | Needs Phase 3 done |
| 5 — Internal Testing track upload | Same day | Needs Phase 2 + 4 done |
| 6 — Closed Testing (≥20 testers × 14 consecutive days) | **14–21 days** | Personal-account gate |
| 7 — Open Testing | 3–7 days | Optional polish gate |
| 8 — Production release (phased) | 7–14 days for full 100% rollout | Final gate |
| 9 — Post-launch (voice v1.1, CI/CD) | Ongoing | — |

> **Critical path = Phase 6.** Start recruiting 20 testers during Phase 0/1 so the 14-day clock starts the moment the first Closed Testing build is live.

---

## 3. Phase 0 — Pre-flight

### 3.1 Google Play Console developer account
- [ ] Create personal account at <https://play.google.com/console>
- [ ] Pay one-time **$25 USD** registration fee
- [ ] Complete identity verification (government ID; can take 1–7 days)
- [ ] Complete tax + payment profile (even for free apps — required for the account)
- [ ] Accept Developer Distribution Agreement

### 3.2 Recruit Closed Testing cohort (start early — long pole)

**One-time investment.** This 20-tester / 14-day requirement is a per-account gate that only blocks the *first* time you publish to Production. After it's passed, every subsequent release (and every future app on this same developer account) goes straight to Production through Internal track — no closed testing required again.

**Per-tester ask** (what you commit them to):
- Click an opt-in link + install on a real Android device: ~5 minutes
- **Leave the app installed for 14 consecutive days** — they do *not* have to open it daily
- Google measures "opted-in testers with active install," not active usage
- Optionally try it once or twice and share feedback

**Recruitment strategies** — two legitimate sources only:

| Source | Effort | Notes |
|---|---|---|
| **r/AndroidAppTesters** + **r/GooglePlayBetaTest** subreddits (and equivalent Discord / Telegram mutual-testing servers) | Low — typically fills 20 slots in 1–3 days | Mutual-testing norm: "I'll test yours if you test mine." Intended use of these communities. Fastest legitimate path for solo devs. |
| **Family / friends with real Android phones** | Low — if you have 3–5 willing people | Use as the *seed* (3–5) to guarantee you don't drop below threshold mid-window |

> **Explicitly out of scope:** Paid tester services (Google's detection has a rising rejection rate for Production access applications) and self-created alt accounts (violates ToS — risks $25 forfeit, account termination, and developer-account ban via device/IP/payment fingerprinting). Don't use either.

**Recommended cohort composition** for first-time publishers:
- 3–5 personal contacts (family/friends with Android phones) — reliable, won't disappear
- 15–20 from Reddit mutual-testing subs — reciprocity-based, post one short call for testers
- Aim for **25–30 total opt-ins** to have buffer against drop-outs

**Briefing template** (copy/paste to testers):
> "Hi! I'm launching a board-game assistant app called Gamer Uncle on Google Play and need 20 testers to satisfy Google's 14-day closed testing requirement. Ask: install via this link [opt-in URL], keep installed on any Android phone for 14 days. You don't have to actually use it daily — just leave it on your device. Happy to test your app in return!"

**Critically: this is a one-time effort.** After your first release graduates to Production, the cohort can uninstall and disband. Every iterative release after that ships straight to Production with no testing-track gate.

- [ ] Post in r/AndroidAppTesters and r/GooglePlayBetaTest (do this *before* Phase 6 starts so the cohort is queued)
- [ ] Collect **≥ 25 unique Google account emails** willing to install via opt-in link for 14 consecutive days (over-recruit by 5+)
- [ ] Track in a private list (e.g., Notion / spreadsheet) — names + emails + commit confirmation + source (reddit / personal)
- [ ] Brief them with the template above

### 3.3 Store listing assets (prepare offline)
| Asset | Spec | Source |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, no alpha | Generate from `apps/mobile/assets/icon.png` |
| Feature graphic | 1024×500 JPG/PNG, no alpha | New — design needed |
| Phone screenshots | 2–8 images, 16:9 or 9:16, min 320 px, max 3840 px | Capture from AVD in Phase 3 |
| 7" tablet screenshots (optional) | 2–8 images | Optional v1; recommended v1.1 |
| Short description | ≤ 80 chars | Reuse iOS App Store subtitle |
| Full description | ≤ 4000 chars | Reuse iOS App Store description, edit for Android tone |
| Privacy policy URL | Public HTTPS URL | Reuse iOS privacy policy URL |
| Content rating | IARC questionnaire | Complete in Console (no profanity / no gambling / no violence) |
| Data safety form | Declare data collected & shared | Mirror iOS App Privacy answers |

### 3.4 Acceptance criteria for Phase 0
- Console account verified (status: "Account verified" in Settings)
- 20+ committed testers on the list
- All store listing assets sitting in a `apps/mobile/assets/store/android/` folder (new, gitignored if assets are large)

---

## 4. Phase 1 — Codebase Prep

> Goal: produce an Android-buildable, Play-Store-uploadable repo state without breaking iOS. All changes covered by unit tests where applicable.

### 4.1 `apps/mobile/app.json` — Android block
Add the missing `package` and `versionCode`; tighten permissions to v1 scope.

```json
"android": {
  "package": "com.thrustCoder.gamerUncle",
  "versionCode": 1,
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "edgeToEdgeEnabled": true,
  "permissions": []
}
```

- **`package`**: Required for any Android build. Mirrors iOS bundle ID.
- **`versionCode`**: Monotonically increasing integer, **independent of SemVer and independent of iOS `buildNumber`**. Start at `1` (first Play Store upload) and increment by 1 for every AAB you upload to Play Console — even if SemVer stays the same. Tracked separately from iOS `buildNumber`, which keeps its own counter.
- **Shared SemVer**: The top-level `app.json` → `version` (currently `4.0.0`) is the single source of truth. Expo feeds it into iOS `CFBundleShortVersionString` and Android `versionName` automatically — no Android-specific override needed.
- **`permissions: []`**: Drop `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` for v1 since voice is cut. Restoring them in v1.1 is non-breaking.

### 4.2 `apps/mobile/eas.json` — Android production + submit
Add an Android production build profile and a submit profile.

```json
"production": {
  "ios": { ... },
  "android": {
    "buildType": "app-bundle",
    "developmentClient": false,
    "cache": { "paths": [] }
  }
},
"submit": {
  "production": {
    "ios": { ... },
    "android": {
      "serviceAccountKeyPath": "./google-play-service-account.json",
      "track": "internal",
      "releaseStatus": "draft"
    }
  }
}
```

- `google-play-service-account.json` must be **gitignored** (already covered if it sits under `apps/mobile/` and matches `*.json` ignore patterns; verify and explicitly add an ignore rule).
- We'll switch `track` from `internal` → `production` once Closed Testing graduates.

### 4.3 Hide voice UI on Android in v1
- File: [apps/mobile/screens/ChatScreen.tsx](apps/mobile/screens/ChatScreen.tsx) (and any other voice-button entry points)
- Wrap the mic/voice button render and any voice-init effects in:
  ```ts
  const voiceEnabled = Platform.OS === 'ios';
  // render mic button only if voiceEnabled
  ```
- Do **not** delete voice services / hooks — keep them dormant so v1.1 just flips the flag.
- **Unit test**: add a Jest test that renders `ChatScreen` with `Platform.OS = 'android'` mocked and asserts the mic button is not in the tree; same test with `'ios'` asserts it is rendered.

### 4.4 Backend: populate `AppVersionPolicy:UpgradeUrlAndroid`
After the Play Store listing exists, update all three files with the live Play Store URL:

- [services/api/appsettings.json](services/api/appsettings.json)
- [services/api/appsettings.Development.json](services/api/appsettings.Development.json)
- [services/api/appsettings.Production.json](services/api/appsettings.Production.json)

```json
"AppVersionPolicy": {
  "MinVersion": "3.3.4",
  "UpgradeUrlIos": "https://apps.apple.com/.../id6747456645",
  "UpgradeUrlAndroid": "https://play.google.com/store/apps/details?id=com.thrustCoder.gamerUncle"
}
```

- **Backward compatibility**: This is additive — existing iOS clients ignore the Android field; Android clients pick it up via `AppConfigService.ts` which already handles `Platform.OS === 'android'`.
- No `MinVersion` change for v1: Android launches at `3.7.x`, well above current `3.3.4` floor.

### 4.5 Verify cross-platform code already in place
Already correct — no changes needed, but verify behavior on emulator in Phase 3:
- [apps/mobile/utils/permissionChecker.ts](apps/mobile/utils/permissionChecker.ts) — has `Platform.OS === 'android'` branches
- [apps/mobile/services/ratingPrompt.ts](apps/mobile/services/ratingPrompt.ts) — uses `FALLBACK_ANDROID_PLAY_STORE_URL` already pointing at the right package
- [apps/mobile/services/AppConfigService.ts](apps/mobile/services/AppConfigService.ts) — already routes to `upgradeUrlAndroid`
- [apps/mobile/screens/ChatScreen.tsx](apps/mobile/screens/ChatScreen.tsx), [apps/mobile/screens/GameSearchScreen.tsx](apps/mobile/screens/GameSearchScreen.tsx), [apps/mobile/screens/GameSetupScreen.tsx](apps/mobile/screens/GameSetupScreen.tsx) — already branch keyboard behavior on `Platform.OS`

### 4.6 Verify iOS-specific plugins don't break Android
- [apps/mobile/plugins/ios-build-fixes.js](apps/mobile/plugins/ios-build-fixes.js) uses `withDangerousMod(config, ['ios', ...])` — gated to iOS, **safe**.
- [apps/mobile/plugins/ensure-permissions.js](apps/mobile/plugins/ensure-permissions.js) uses `withInfoPlist` — iOS-only, **safe** (note: this plugin is currently not referenced in `app.json` `plugins` array; ignore unless we wire it in).
- `@config-plugins/react-native-webrtc` will configure Android WebRTC code paths even though we hide voice UI. Two options:
  - **Option A (recommended)**: Leave the plugin enabled. WebRTC native modules build but are never invoked. Smallest change.
  - **Option B**: Conditionally exclude the plugin for Android v1 to shrink AAB size by ~5–10 MB. Defer to v1.1 if size becomes an issue.

### 4.7 `.gitignore` updates
Add to repo `.gitignore`:
```
# Android signing / Play Console
apps/mobile/google-play-service-account.json
apps/mobile/upload-keystore.jks
apps/mobile/android/app/release.keystore
```

### 4.8 Acceptance criteria for Phase 1
- `eas build --platform android --profile preview --local` succeeds (or via EAS cloud)
- Jest tests pass: `cd apps/mobile && npm test`
- Voice button does **not** render on Android (verified in unit test)
- iOS build still succeeds — no regressions
- `git diff` is reviewed: no secrets, no service account JSON, no keystore

---

## 5. Phase 2 — Google Play Console App Creation

- [ ] Console → All apps → Create app
  - App name: **Gamer Uncle**
  - Default language: English (United States)
  - App or game: **App**
  - Free or paid: **Free**
  - Accept declarations (Play Policies + US export laws)
- [ ] Set up store listing (paste assets from Phase 0.3)
- [ ] Complete **App content** sections (each is independently required):
  - Privacy policy URL
  - App access (no login walls / provide demo creds if any)
  - Ads (we have none)
  - Content rating (IARC questionnaire)
  - Target audience and content (13+ recommended — board games)
  - News app (no)
  - COVID-19 contact tracing (no)
  - Data safety (mirror iOS App Privacy answers)
  - Government apps (no)
  - Financial features (no)
  - Health (no)
- [ ] Set up **App pricing & distribution** → Free, select countries (start with same as iOS App Store)

### Acceptance criteria
- All red exclamation marks cleared in Console sidebar
- Store listing previewable
- App ready to receive its first release upload

---

## 6. Phase 3 — Local Emulator Build & Smoke Test

### 6.1 Tooling install (one-time, Windows)
- [ ] Install **Android Studio** (Giraffe / Hedgehog / Iguana — latest stable)
- [ ] Android Studio → SDK Manager → install **Android 14 (API 34)** SDK + Platform Tools + Build-Tools
- [ ] Android Studio → AVD Manager → create **Pixel 7 / API 34** emulator
- [ ] Add Android SDK to PATH:
  ```powershell
  [Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
  [Environment]::SetEnvironmentVariable('Path', "$env:Path;$env:LOCALAPPDATA\Android\Sdk\platform-tools", 'User')
  ```
- [ ] Verify: `adb devices` prints emulator

### 6.2 EAS Android dev build (cloud or local)
From `apps/mobile/`:
```powershell
Set-Location "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile"
eas build --platform android --profile development
# OR locally (faster after first run; needs Android SDK + JDK 17):
# eas build --platform android --profile development --local
```
This produces a `.apk` (development client). Install:
```powershell
adb install path\to\app.apk
```

### 6.3 Smoke test checklist (on AVD)
- [ ] App launches; splash screen renders correctly
- [ ] Adaptive icon shows on launcher (round + square mask)
- [ ] Chat screen: send a query → receive an AI response (anti-fallback)
- [ ] Game search: search → results render with images
- [ ] Score tracker: create a game, add players, record scores
- [ ] Rating prompt: opens correct Play Store URL (when triggered)
- [ ] App version policy: app respects upgrade URL when forced upgrade is simulated (server-side `MinVersion` bump in dev)
- [ ] Keyboard behavior on input screens does not cover input fields
- [ ] Status bar / edge-to-edge layout looks clean (no content under system bars where unintended)
- [ ] Verify voice button is **not** rendered (per cut decision)

### 6.4 Capture store listing screenshots
- [ ] 8 portrait phone screenshots from AVD at 1080×1920 (Settings → screenshot in AVD toolbar)
- [ ] Save to `apps/mobile/assets/store/android/phone/` (gitignored if heavy)

### Acceptance criteria
- All checklist items pass
- 5+ usable screenshots captured

---

## 7. Phase 4 — Physical Device Gate (pre-Production)

> Run before promoting to Open Testing or Production. Skipped for Internal/Closed if needed for time.

- [ ] Pick a recent Android phone (API 31+) — borrow if needed
- [ ] Enable Developer Options → USB Debugging
- [ ] `adb install` the same dev or preview build
- [ ] Re-run smoke checklist from §6.3, plus:
  - Network behavior on cellular + Wi-Fi
  - Background/foreground transitions (kill from recents → reopen → state preserved?)
  - Real screen density (text legibility, button hit targets)
  - Battery / thermal sanity over a 10-min session

---

## 8. Phase 5 — Internal Testing Track

### 8.1 Generate production AAB
```powershell
Set-Location "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile"
eas build --platform android --profile production
```
- First run prompts EAS to generate an **upload keystore** — accept (EAS stores it on their servers; you can also `eas credentials` to download for safekeeping).
- Output: `.aab` file (download from EAS dashboard).

### 8.2 Set up Play Console service account (one-time, for `eas submit`)
- [ ] Console → Setup → API access → Create new service account (or link existing GCP project)
- [ ] Grant role: **Release manager** for the Gamer Uncle app
- [ ] Download JSON key → save as `apps/mobile/google-play-service-account.json` (gitignored)

### 8.3 First upload (manual via Console, to verify chain)
- [ ] Console → Testing → Internal testing → Create new release
- [ ] Upload the `.aab`
- [ ] Release name: `3.7.x (1)` (versionName + versionCode)
- [ ] Release notes: copy from iOS release notes
- [ ] Save → Review release → Roll out to Internal testing

### 8.4 Internal tester setup
- [ ] Create email list (5–10 internal accounts — yourself, alt accounts, immediate family)
- [ ] Save & activate
- [ ] Copy opt-in URL → install on test devices
- [ ] Verify app installs from Play Store via the opt-in link

### 8.5 Automate future uploads
Once manual works, switch to:
```powershell
eas submit --platform android --profile production
```

### Acceptance criteria
- AAB accepted by Play Console with no policy warnings
- Pre-launch report (auto-generated by Google) shows no crashes / no security blockers
- Internal testers can install and launch successfully

---

## 9. Phase 6 — Closed Testing (THE 14-DAY GATE)

> **This phase is the critical path.** For new personal Play accounts (post-Nov 2023), you cannot publish to Production until you have run a Closed Testing track with **at least 20 opted-in testers for 14 consecutive days**.
>
> **This is a one-time gate.** Once you've satisfied it and received "production access" approval, all future releases of this app — and any new apps on the same developer account — ship straight to Production via the Internal track. You never have to run a closed test again.

### What testers are actually committing to
- Click opt-in link → install via Play Store: ~5 minutes
- Keep installed on a real Android device for 14 consecutive days (passive presence is enough; daily use not required)
- Optional: try the app once or twice, share quick feedback
- They can uninstall the moment the gate is passed

### 9.1 Set up Closed Testing track
- [ ] Console → Testing → Closed testing → Create track (name it `closed-alpha`)
- [ ] Upload the same (or newer) AAB built in Phase 5
- [ ] Add tester list: paste 20+ tester emails (from Phase 0.2)
- [ ] Copy opt-in URL → send to all testers with install instructions

### 9.2 During the 14 days
- [ ] Day 0–3: chase testers who haven't installed; goal = 20 active installs by Day 3
- [ ] Day 1+: monitor Play Console → Statistics → daily active testers — must stay ≥ 12 (Google's de-facto threshold)
- [ ] Collect feedback via shared form / email; triage into:
  - **Blockers** → patch in a new AAB uploaded as a new release on the same Closed track (does **not** reset the 14-day clock as long as testers stay installed)
  - **Non-blockers** → backlog for v1.1
- [ ] Publish 1–2 small updates during the period to keep testers engaged

### 9.3 Apply for Production access
- [ ] After Day 14 with ≥ 20 active testers: Console → Publishing overview → "Apply for production access"
- [ ] Fill the questionnaire (testing details, audience targeting, monetization)
- [ ] **Approval takes 1–7 days** — plan accordingly

### Acceptance criteria
- ≥ 20 testers active for 14 consecutive days (verified in Console stats)
- No P0/P1 bugs reported in last 3 days of the window
- "Apply for production" submitted and approved

---

## 10. Phase 7 — Open Testing (optional polish gate)

- [ ] Console → Testing → Open testing → Create release from same AAB
- [ ] Public opt-in link goes live — anyone can join via Play Store
- [ ] Run for 3–7 days to catch issues that only show up at slightly larger scale
- [ ] Pre-launch report runs automatically across more device models; review every report

### Acceptance criteria
- No new crashes in Android vitals
- Open tester rating ≥ 4.0

---

## 11. Phase 8 — Production Release

### 11.1 Promote AAB
- [ ] Console → Production → Create new release
- [ ] **Promote** the same AAB from Open Testing (no rebuild needed if no fixes)
- [ ] Release notes (≤ 500 chars)
- [ ] **Phased rollout**: start at **10%**

### 11.2 Phased rollout cadence (suggested)
| Day | Rollout % | Gate |
|---|---|---|
| 0 | 10% | No crash spike in vitals after 24 h |
| 2 | 25% | Crash-free sessions ≥ 99% |
| 5 | 50% | No P1 reports in 48 h |
| 8 | 100% | All gates green |

### 11.3 Monitoring during rollout
- [ ] Play Console → Android vitals → Crashes & ANRs daily
- [ ] App Insights / Azure Monitor → API error rates per `User-Agent` (Android slice)
- [ ] User reviews → respond to anything 3-star or below within 24 h

### 11.4 Post-release backend update
- [ ] Update `UpgradeUrlAndroid` in [services/api/appsettings.Production.json](services/api/appsettings.Production.json) with the **live** Play Store URL (the one the app produces post-publish — verify the URL resolves)
- [ ] Deploy backend (additive change; no `MinVersion` bump needed)

### Acceptance criteria
- 100% rollout reached
- Crash-free sessions ≥ 99.5% sustained for 7 days
- No policy violations in Console

---

## 12. Phase 9 — Post-Launch (v1.1+)

### 12.1 Voice / WebRTC on Android (v1.1)
- [ ] Restore `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` in [apps/mobile/app.json](apps/mobile/app.json) Android `permissions`
- [ ] Re-enable voice UI on Android by removing the `Platform.OS === 'ios'` gate added in §4.3
- [ ] Validate mic permission prompt UX on first invocation (Android shows runtime permission dialog vs. iOS Info.plist string)
- [ ] Validate `@react-native-voice/voice` on emulator + physical device (emulators have no mic; physical device required)
- [ ] Validate `react-native-webrtc` audio path against the API's WebSocket voice endpoint
- [ ] Bump `versionCode` to 2; ship as Closed → Open → Production phased

### 12.2 CI/CD integration (v1.1+)
- [ ] Add an `androidBuild` stage to [pipelines/azure-pipelines.yml](pipelines/azure-pipelines.yml) parallel to the iOS stage
- [ ] Use `eas build --platform android --non-interactive --no-wait`
- [ ] Auto-submit Internal track on every `main` build
- [ ] Manual approval gate before Production track submit

### 12.3 Future improvements
- 7"/10" tablet screenshots → unlock Android tablet visibility in Play Store search
- Wear OS / Chrome OS support evaluation (likely defer)
- `versionCode` + iOS `buildNumber` auto-increment via `eas.json` → `"appVersionSource": "remote"` with EAS metadata (removes manual bump step on every upload)
- Consider splitting `MinVersion` into `MinVersionIos` / `MinVersionAndroid` if cadences diverge

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Personal account ID verification stalls | Med | Blocks Phase 0 | Submit Day 1; have a backup person to re-submit if rejected |
| Can't recruit 20 testers / drop below 12 active | Med | Blocks Production | Over-recruit to 25–30; post early in r/AndroidAppTesters + r/GooglePlayBetaTest (typically fills in 1–3 days) and combine with 3–5 personal contacts as a stability seed |
| Production access application rejected | Low | Adds 1–2 weeks; have to re-test | Ensure testers are real humans on real devices; fill out application carefully describing the testing done |
| Pre-launch report finds crash on a device model we can't reproduce | Med | Blocks Closed → Open | Use Firebase Test Lab (via Play Console pre-launch report) screenshots + stack traces; add try/catch around suspected surfaces |
| App Bundle policy rejection (e.g., data safety mismatch) | Low | Blocks any upload | Cross-check Data Safety form against iOS App Privacy answers; declare conservatively |
| WebRTC native code causes Android build to fail under Expo prebuild | Low | Delays v1 | Mitigated by deferring voice; if it fails, conditionally exclude `@config-plugins/react-native-webrtc` plugin for Android in `app.json` |
| Adaptive icon foreground escapes the 66% safe zone | Low | Cosmetic; Open Testing rejection from reviewers | Validate `assets/adaptive-icon.png` against [Android adaptive icon guidance](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive); the foreground must keep critical content inside the inner 66dp circle |
| Backend `UpgradeUrlAndroid` empty when first Android client hits force-upgrade path | Low | Confusing UX | `AppConfigService.ts` already falls back gracefully when empty; populate URL same day as Play Store goes live |

---

## 14. File-Level Change Summary

| File | Change | Phase |
|---|---|---|
| [apps/mobile/app.json](apps/mobile/app.json) | Add `android.package`, `android.versionCode`; drop `permissions` for v1 | 1 |
| [apps/mobile/eas.json](apps/mobile/eas.json) | Add Android `production` build profile + `submit.production.android` | 1 |
| [apps/mobile/screens/ChatScreen.tsx](apps/mobile/screens/ChatScreen.tsx) | Gate voice/mic UI with `Platform.OS === 'ios'` for v1 | 1 |
| [apps/mobile/__tests__/](apps/mobile/__tests__/) | New unit test asserting mic button hidden on Android, visible on iOS | 1 |
| [services/api/appsettings.json](services/api/appsettings.json) | Populate `UpgradeUrlAndroid` (post-publish) | 8.4 |
| [services/api/appsettings.Development.json](services/api/appsettings.Development.json) | Populate `UpgradeUrlAndroid` (test value first) | 8.4 |
| [services/api/appsettings.Production.json](services/api/appsettings.Production.json) | Populate `UpgradeUrlAndroid` (live Play Store URL) | 8.4 |
| `.gitignore` | Add Android keystore + Play service-account JSON paths | 1 |
| [pipelines/azure-pipelines.yml](pipelines/azure-pipelines.yml) | Add Android build/submit stage | 9.2 (deferred) |

> **No breaking backend API changes.** All backend edits are additive (filling existing empty config keys) and respect the backward-compatibility contract in [.github/copilot-instructions.md](.github/copilot-instructions.md).

---

## 15. Versioning & Simultaneous Release Workflow

With shared SemVer, every release iteration follows the same script for both platforms:

1. **Bump SemVer once** in [apps/mobile/app.json](apps/mobile/app.json) → `version` (e.g., `3.7.0` → `3.8.0`). This automatically becomes iOS `CFBundleShortVersionString` and Android `versionName`.
2. **Bump per-platform build counters independently:**
   - iOS: `ios.buildNumber` in [apps/mobile/app.json](apps/mobile/app.json) (currently kept in sync with `version` — that's fine, just must be strictly increasing per App Store upload).
   - Android: `android.versionCode` in [apps/mobile/app.json](apps/mobile/app.json) — increment by 1 for every AAB uploaded to Play Console.
3. **Build both artifacts from the same commit:**
   ```powershell
   Set-Location "C:\Users\rajsin\r\Code\gamer-uncle\apps\mobile"
   eas build --platform all --profile production
   ```
4. **Submit to both stores within the same window:**
   ```powershell
   eas submit --platform ios --profile production
   eas submit --platform android --profile production
   ```
5. **Stagger only the final rollout %** — iOS phased release and Android phased rollout run on each store's own schedule but start from the same SemVer.

### Drift handling (when iOS or Android needs a hotfix the other doesn't)
Two viable models — pick when the first hotfix happens:

| Model | Behavior | Trade-off |
|---|---|---|
| **Lock-step (recommended)** | iOS-only bug at `3.8.0` → bump to `3.8.1`, rebuild *both* platforms, resubmit both | Tiny extra Android upload; versions stay aligned; release notes simpler |
| **Allow drift** | iOS goes to `3.8.1`, Android stays at `3.8.0` until next planned release | No wasted Android upload, but version-tracking and `MinVersion` reasoning gets harder |

Backend `AppVersionPolicy:MinVersion` is a single value and handles either model fine — it's a floor, not an equality check.

### What the backend should expect
- `User-Agent` from the mobile app already includes platform (`ios` / `android`) and SemVer — no schema change needed
- Functional tests in [services/tests/functional/](services/tests/functional/) should remain platform-agnostic (the API contract is the same for iOS and Android clients of the same version)

---

## 16. Open Questions (revisit during execution)

1. **Privacy policy**: confirm the existing iOS privacy policy URL is generic enough to cover Android, or do we need a separate one?
2. **Data Safety form**: cross-walk the iOS App Privacy answers — anyone need to be a "shared with third parties" toggle changed for Android (e.g., Azure AI, BGG)?
3. **App naming**: does "Gamer Uncle" trip any Play Store trademark filters? (Worth a pre-check before account submission.)
4. **Hotfix drift policy**: pick lock-step vs. allow-drift the first time a platform-specific hotfix is needed (default to lock-step).

---

## 17. Definition of Done (v1)

- [ ] App available on Google Play Store as **Gamer Uncle** at `com.thrustCoder.gamerUncle`
- [ ] iOS and Android both shipped from the same SemVer (e.g., `3.8.0`) from the same commit
- [ ] 100% production rollout achieved with crash-free sessions ≥ 99.5%
- [ ] Backend `UpgradeUrlAndroid` populated and deployed
- [ ] iOS app continues to function with no regressions
- [ ] Voice deferred to v1.1 with a tracked work item
- [ ] CI/CD integration tracked as a v1.1+ work item
