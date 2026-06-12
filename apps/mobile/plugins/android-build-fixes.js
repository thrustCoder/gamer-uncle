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

const { withAppBuildGradle } = require('@expo/config-plugins');

const EXCLUDE_SNIPPET = `
// [android-build-fixes] Drop the legacy Android Support Library so it does not
// collide with AndroidX (fixes :app:checkReleaseDuplicateClasses).
configurations.all {
    exclude group: 'com.android.support'
}
`;

function androidBuildFixes(config) {
  return withAppBuildGradle(config, (config) => {
    const marker = '// [android-build-fixes]';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `\n${EXCLUDE_SNIPPET}`;
    }
    return config;
  });
}

module.exports = androidBuildFixes;
