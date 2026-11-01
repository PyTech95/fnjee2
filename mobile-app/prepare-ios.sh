#!/usr/bin/env bash
# Runs on macOS after `npx cap add ios` (Capacitor 8, Swift Package Manager):
# name, icon, splash, permissions text, iPhone-only, portrait, export compliance, version.
set -euo pipefail
cd "$(dirname "$0")"
APP=ios/App/App
PLIST="$APP/Info.plist"
PBX=ios/App/App.xcodeproj/project.pbxproj
PB=/usr/libexec/PlistBuddy

pset() {  # pset <key> <type> <value>  (add or replace)
  "$PB" -c "Delete :$1" "$PLIST" >/dev/null 2>&1 || true
  "$PB" -c "Add :$1 $2 $3" "$PLIST"
}

pset CFBundleDisplayName string "FNJEE"
pset ITSAppUsesNonExemptEncryption bool false
pset NSCameraUsageDescription string "FNJEE uses the camera only when you choose to take a photo of a question or your notes to upload it."
pset NSPhotoLibraryUsageDescription string "FNJEE lets you pick a photo or screenshot of a question from your library to upload it."
pset LSApplicationCategoryType string "public.app-category.education"

# Portrait on iPhone (exam UI is designed for it)
"$PB" -c "Delete :UISupportedInterfaceOrientations" "$PLIST" >/dev/null 2>&1 || true
"$PB" -c "Add :UISupportedInterfaceOrientations array" "$PLIST"
"$PB" -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$PLIST"

# 64-bit only (armv7 is long gone)
"$PB" -c "Delete :UIRequiredDeviceCapabilities" "$PLIST" >/dev/null 2>&1 || true
"$PB" -c "Add :UIRequiredDeviceCapabilities array" "$PLIST"
"$PB" -c "Add :UIRequiredDeviceCapabilities:0 string arm64" "$PLIST"

# Icon (1024, no transparency) + splash
cp resources/ios/AppIcon-512@2x.png "$APP/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
for f in splash-2732x2732.png splash-2732x2732-1.png splash-2732x2732-2.png; do
  cp resources/ios/splash-2732x2732.png "$APP/Assets.xcassets/Splash.imageset/$f"
done

# iPhone only (iPad runs it in compatibility mode; no iPad screenshots needed for review)
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' "$PBX"

# Versions: marketing version from package.json, build number from CI run number
VN=$(node -p "require('./package.json').version")
VC=${VERSION_CODE:-1}
sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $VN;/g; s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $VC;/g" "$PBX"

echo "prepared ios: $VN ($VC)"
grep -E "PRODUCT_BUNDLE_IDENTIFIER|MARKETING_VERSION|CURRENT_PROJECT_VERSION|TARGETED_DEVICE_FAMILY|IPHONEOS_DEPLOYMENT_TARGET" "$PBX" | sort -u
