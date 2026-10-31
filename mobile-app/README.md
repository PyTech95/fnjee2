# FNJEE mobile app (Android + iOS)

A Capacitor 8 app that opens **https://fnjee.com/login** in a native shell. Every website update
(`docker compose up -d --build` on the VPS) shows up in the app instantly; a new store build is only
needed when something in this folder changes.

| | Android | iOS |
|---|---|---|
| App ID / Bundle ID | `com.fnjee.app` | `com.fnjee.app` |
| Name on phone | FNJEE | FNJEE |
| Minimum OS | Android 7 (API 24) | iOS 15 |
| Target | Android 16 (API 36, required by Google Play since 31 Aug 2026) | iOS 26 SDK / Xcode 26 (required by App Store since Apr 2026) |
| Devices | phones + tablets | iPhone (runs on iPad in compatibility mode) |

Inside the app the website knows it is in the app (user agent contains `FNJEE-App`): marketing and
pricing pages are skipped (Apple rule 3.1.1), the Android back button goes back inside the site,
links to other sites open in the phone's browser, and a friendly offline page is shown without internet.

## Builds (no Android Studio / Xcode needed)

Both are built by GitHub Actions on every push to `main` (or `feature/mobile-*`) that touches this folder,
or by hand: **Actions → Android app / iOS app → Run workflow**.

* Android → Releases tag **android-latest**: `FNJEE-debug.apk` (install on a phone),
  `FNJEE-release-unsigned.aab/.apk` (+ `apksigner.jar`), and `FNJEE-release.aab/.apk` when signing secrets are set.
* iOS → Releases tag **ios-latest**: `FNJEE-iOS-Simulator.zip`, `FNJEE-unsigned.xcarchive.zip`, and `FNJEE.ipa`
  when the App Store Connect secrets are set (then *Run workflow* also uploads it to TestFlight).

## Android: Google Play

1. Keep the upload keystore (`fnjee-upload.jks`) and its password safe — every future update must be signed with it
   (Play App Signing lets Google reset a lost upload key, but that takes days).
2. To let GitHub sign automatically, add repo secrets (Settings → Secrets and variables → Actions):
   `ANDROID_KEYSTORE_BASE64` (`base64 -w0 fnjee-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`fnjee`),
   `ANDROID_KEY_PASSWORD`.
3. Or sign the unsigned files yourself (Java 17+):

       jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore fnjee-upload.jks \
         -signedjar FNJEE-release.aab FNJEE-release-unsigned.aab fnjee
       java -jar apksigner.jar sign --ks fnjee-upload.jks --ks-key-alias fnjee \
         --out FNJEE-release.apk FNJEE-release-unsigned.apk

4. Play Console → Create app → upload **FNJEE-release.aab** to *Internal testing* first, then *Production*.
   Every new upload needs a higher version code — GitHub uses the run number, so just rebuild.

## iOS: App Store

Needs an Apple Developer account (₹ 8,700 / year).

1. developer.apple.com → Identifiers → register Bundle ID `com.fnjee.app`.
2. App Store Connect → Apps → **+ New App** → iOS, name *FNJEE*, bundle ID `com.fnjee.app`, SKU `fnjee-ios`.
3. App Store Connect → Users and Access → Integrations → **App Store Connect API** → generate a key with role **Admin**.
   Download `AuthKey_XXXX.p8` (only downloadable once).
4. GitHub repo secrets: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (`base64 -i AuthKey_XXXX.p8`).
5. Actions → **iOS app** → Run workflow (upload ✔). ~15 min later the build appears in TestFlight
   (Xcode creates the distribution certificate and profile itself).
6. In App Store Connect pick that build, fill the listing (see `store/` in this folder) and **Submit for Review**.

### With a Mac instead

    cd mobile-app && npm install
    npx cap add ios --packagemanager SPM && ./prepare-ios.sh && npx cap sync ios
    npx cap open ios      # Xcode: Signing → choose your team → Product → Archive → Distribute App

## Local Android build (Android Studio)

    cd mobile-app && npm install
    npx cap add android && ./prepare-android.sh && npx cap sync android
    npx cap open android

## Files

* `capacitor.config.json` — start URL, allowed domains, splash, system bars
* `www/index.html` — offline page (shown when there is no internet)
* `resources/` — icon (1024, no transparency), splash, Play Store icon
* `prepare-android.sh` / `prepare-ios.sh` — permissions, icons, splash, version, iPhone-only, export compliance
* `store/` — store listing texts, screenshots, feature graphic, reviewer notes
