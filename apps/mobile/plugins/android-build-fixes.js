// Config plugin to fix Android build issues:
//
// 1. Duplicate class conflict between the legacy Android Support Library and
//    AndroidX.
//
//    `@react-native-voice/voice` (kept for iOS voice; gated off on Android for
//    v1 — see utils/voiceFeatureFlag.ts) transitively pulls
//    `com.android.support:appcompat-v7:28.0.0`. That legacy artifact ships the
//    same classes as `androidx.core:core` / `androidx.versionedparcelable`,
//    which fails the `:app:checkReleaseDuplicateClasses` Gradle task with
//    errors like:
//      Duplicate class android.support.v4.app.INotificationSideChannel found in
//      modules core-1.16.0.aar and support-compat-28.0.0.aar
//
//    The voice native module's Java only imports `androidx.annotation.NonNull`
//    (the appcompat dependency is vestigial), so excluding the legacy
//    `com.android.support` group is safe: the voice module still compiles and
//    links, and AndroidX provides every class the app actually uses.
//
// 2. Removes unused foreground-service permissions.
//
//    `expo-audio` auto-declares `FOREGROUND_SERVICE` and
//    `FOREGROUND_SERVICE_MEDIA_PLAYBACK` in its library manifest. Gamer Uncle
//    does not run a foreground media-playback service on Android (voice/audio
//    playback is gated to iOS for v1; Android only plays short in-app sound
//    effects). Shipping these permissions would force a Play Console
//    foreground-service usage declaration for a service we never start, so we
//    strip them from the merged manifest via `tools:node="remove"`.

const { withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

const EXCLUDE_SNIPPET = `
// [android-build-fixes] Drop the legacy Android Support Library so it does not
// collide with AndroidX (fixes :app:checkReleaseDuplicateClasses).
configurations.all {
    exclude group: 'com.android.support'
}
`;

// Foreground-service permissions auto-added by expo-audio that the app never uses.
const REMOVED_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

function withExcludeLegacySupport(config) {
  return withAppBuildGradle(config, (config) => {
    const marker = '// [android-build-fixes]';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `\n${EXCLUDE_SNIPPET}`;
    }
    return config;
  });
}

function withRemovedForegroundServicePermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure the tools namespace is declared so tools:node="remove" works.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const name of REMOVED_PERMISSIONS) {
      // Drop any existing add of this permission in the app manifest.
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (perm) => perm?.$?.['android:name'] !== name,
      );
      // Add an explicit remove directive so the manifest merger strips the
      // permission contributed by expo-audio's library manifest.
      manifest['uses-permission'].push({
        $: {
          'android:name': name,
          'tools:node': 'remove',
        },
      });
    }

    return config;
  });
}

function androidBuildFixes(config) {
  config = withExcludeLegacySupport(config);
  config = withRemovedForegroundServicePermissions(config);
  return config;
}

module.exports = androidBuildFixes;
