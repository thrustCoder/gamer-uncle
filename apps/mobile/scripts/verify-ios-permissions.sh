#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INFO_PLIST_PATH="$APP_ROOT/ios/GamerUncle/Info.plist"
# Fallback: attempt to discover automatically if structure changes
if [ ! -f "$INFO_PLIST_PATH" ]; then
  INFO_PLIST_PATH=$(find "$APP_ROOT/ios" -maxdepth 3 -name Info.plist | head -n1 || true)
fi

if [ ! -f "$INFO_PLIST_PATH" ]; then
  echo "Info.plist not found. Have you run 'npx expo prebuild --platform ios'?" >&2
  exit 1
fi

echo "Verifying required iOS usage descriptions in $INFO_PLIST_PATH";

missing=0

check_key () {
  local key=$1
  if ! /usr/libexec/PlistBuddy -c "Print :$key" "$INFO_PLIST_PATH" >/dev/null 2>&1; then
    echo "[MISSING] $key"; missing=1; return
  fi
  local value=$(/usr/libexec/PlistBuddy -c "Print :$key" "$INFO_PLIST_PATH")
  if [ -z "$value" ]; then
    echo "[EMPTY] $key"; missing=1; return
  fi
  echo "[OK] $key = $value"
}

check_key NSMicrophoneUsageDescription
check_key NSCameraUsageDescription

# Background modes (audio)
if /usr/libexec/PlistBuddy -c 'Print :UIBackgroundModes' "$INFO_PLIST_PATH" >/dev/null 2>&1; then
  if /usr/libexec/PlistBuddy -c 'Print :UIBackgroundModes' "$INFO_PLIST_PATH" | grep -q audio; then
    echo "[OK] UIBackgroundModes contains audio"
  else
    echo "[MISSING] UIBackgroundModes audio"; missing=1
  fi
else
  echo "[MISSING] UIBackgroundModes array"; missing=1
fi

if [ $missing -ne 0 ]; then
  echo "\nOne or more required keys are missing. Failing." >&2
  exit 2
fi

echo "All required iOS permission keys present.";
