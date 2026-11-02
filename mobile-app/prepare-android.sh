#!/usr/bin/env bash
# Runs after `npx cap add android` (Capacitor 8): permissions, icons, splash, version.
set -euo pipefail
cd "$(dirname "$0")"
MAN=android/app/src/main/AndroidManifest.xml
RES=android/app/src/main/res

# Camera for screenshot import (<input type=file capture>). Internet is already declared.
grep -q 'android.permission.CAMERA' "$MAN" || \
  sed -i 's#</manifest>#    <uses-permission android:name="android.permission.CAMERA" />\n</manifest>#' "$MAN"
grep -q 'android.hardware.camera' "$MAN" || \
  sed -i 's#</manifest>#    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>#' "$MAN"

# Launcher icons (legacy + adaptive) from the logo
declare -A SZ=([mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
declare -A FG=([mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432)
for d in "${!SZ[@]}"; do
  s=${SZ[$d]}; f=${FG[$d]}
  mkdir -p "$RES/mipmap-$d"
  inner=$(( s * 80 / 100 ))
  convert -size ${s}x${s} xc:white \( www/icon.png -resize ${inner}x${inner} \) -gravity center -composite \
    "$RES/mipmap-$d/ic_launcher.png"
  convert -size ${s}x${s} xc:none -fill white -draw "circle $((s/2)),$((s/2)) $((s/2)),0" \
    \( www/icon.png -resize $(( s * 66 / 100 ))x$(( s * 66 / 100 )) \) -gravity center -composite \
    "$RES/mipmap-$d/ic_launcher_round.png"
  # adaptive foreground: logo inside the 66% safe zone on a transparent canvas
  fi=$(( f * 58 / 100 ))
  convert -size ${f}x${f} xc:none \( www/icon.png -resize ${fi}x${fi} \) -gravity center -composite \
    "$RES/mipmap-$d/ic_launcher_foreground.png"
done
if [ -f "$RES/values/ic_launcher_background.xml" ]; then
  sed -i 's#<color name="ic_launcher_background">[^<]*</color>#<color name="ic_launcher_background">\#FFFFFF</color>#' \
    "$RES/values/ic_launcher_background.xml"
fi

# Splash image (pre-Android 12 and in-app splash)
for f in "$RES"/drawable*/splash.png; do
  [ -f "$f" ] || continue
  w=$(identify -format "%w" "$f"); h=$(identify -format "%h" "$f")
  m=$(( w < h ? w : h ))
  convert -size ${w}x${h} xc:'#FAF7F2' \( resources/android/splash.png -resize ${m}x${m} \) \
    -gravity center -composite "$f"
done

# Version: name from package.json, code from the CI run number (must go up for every Play upload)
VN=$(node -p "require('./package.json').version")
VC=${VERSION_CODE:-1}
sed -i -E "s/versionCode [0-9]+/versionCode $VC/; s/versionName \"[^\"]+\"/versionName \"$VN\"/" android/app/build.gradle
sed -i -E "s/^def fnjeeVersionCode = [0-9]+/def fnjeeVersionCode = $VC/; s/^def fnjeeVersionName = \"[^\"]+\"/def fnjeeVersionName = \"$VN\"/" android/app/build.gradle
echo "prepared android: versionName $VN, versionCode $VC"
grep -E "versionCode|versionName|targetSdk|compileSdk|minSdk" android/app/build.gradle android/variables.gradle || true
