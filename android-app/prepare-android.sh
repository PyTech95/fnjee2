#!/usr/bin/env bash
# Runs after `npx cap add android`: permissions, icons, version, splash colour.
set -euo pipefail
cd "$(dirname "$0")"
MAN=android/app/src/main/AndroidManifest.xml
# camera (screenshot import), notifications; internet is already there
for perm in android.permission.CAMERA android.permission.POST_NOTIFICATIONS; do
  grep -q "$perm" "$MAN" || sed -i "s#</manifest>#    <uses-permission android:name=\"$perm\" />\n</manifest>#" "$MAN"
done
grep -q 'android.hardware.camera' "$MAN" || \
  sed -i 's#</manifest>#    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>#' "$MAN"

# launcher icons from the website icon
RES=android/app/src/main/res
declare -A SZ=([mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
declare -A FG=([mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432)
for d in "${!SZ[@]}"; do
  s=${SZ[$d]}; f=${FG[$d]}
  mkdir -p "$RES/mipmap-$d"
  convert www/icon.png -resize ${s}x${s} "$RES/mipmap-$d/ic_launcher.png"
  convert www/icon.png -resize ${s}x${s} "$RES/mipmap-$d/ic_launcher_round.png"
  # adaptive icon foreground: logo in the middle 66% safe zone on transparent canvas
  inner=$(( f * 60 / 100 ))
  convert -size ${f}x${f} xc:none \( www/icon.png -resize ${inner}x${inner} \) -gravity center -composite \
    "$RES/mipmap-$d/ic_launcher_foreground.png"
done
if [ -f "$RES/values/ic_launcher_background.xml" ]; then
  sed -i 's#<color name="ic_launcher_background">[^<]*</color>#<color name="ic_launcher_background">\#FFFFFF</color>#' \
    "$RES/values/ic_launcher_background.xml"
fi

# version from the CI run number
VC=${VERSION_CODE:-1}
sed -i -E "s/versionCode [0-9]+/versionCode $VC/; s/versionName \"[^\"]+\"/versionName \"1.0.$VC\"/" android/app/build.gradle
echo "prepared: versionCode $VC"
