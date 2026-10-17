# FNJEE Android app

A Capacitor shell that opens the live website **https://fnjee.com** inside a native Android app.
Every website update (after `docker compose up -d --build`) shows up in the app instantly — no new APK needed.

## Get the APK (no Android Studio needed)

1. GitHub → repo **Actions** → **Android APK** → **Run workflow** (or push a change under `android-app/`).
2. When it finishes (~8 min), open the run and download **fnjee-android-apk**, or take `FNJEE.apk` from the
   **Releases** page (tag `android-latest`).
3. Copy the APK to the phone and install it (allow "Install unknown apps" once).

## Play Store build (optional)

Add these repo secrets and the workflow also builds a signed release APK + AAB:
`ANDROID_KEYSTORE_BASE64` (base64 of a .jks file), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Create a keystore once (keep it safe — Play Store updates need the same one):

    keytool -genkey -v -keystore fnjee.jks -keyalg RSA -keysize 2048 -validity 10000 -alias fnjee
    base64 -w0 fnjee.jks   # paste output into ANDROID_KEYSTORE_BASE64

## What works in the app

Login, tests/CBT, results, question bank, Import Wizard (file picker + camera for screenshots, with crop),
AI tutor. Links to other sites (YouTube, Meet, WhatsApp) open in the phone's browser/app.
The Android back button goes back inside the site.
