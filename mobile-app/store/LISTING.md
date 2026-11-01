# FNJEE — store submission kit

Everything to paste into **Google Play Console** and **App Store Connect**.
Screenshots: `screenshots/play-phone/` (1080×1920) and `screenshots/appstore-6.9/` (1290×2796, the 6.9" iPhone slot).
Play feature graphic: `feature-graphic-1024x500.png`. Play icon: `icon-512.png`. The iOS icon is inside the build.

> **Before you submit:** deploy the website PR (privacy, terms and delete-account pages must be live on fnjee.com),
> set the real support email in `frontend/src/lib/appInfo.js`, and create the reviewer demo account below.

---

## Common

| Field | Value |
|---|---|
| App name | FNJEE: JEE & NEET Mock Tests |
| Short name (under icon) | FNJEE |
| Category | Education |
| Website | https://fnjee.com |
| Privacy policy URL | https://fnjee.com/privacy |
| Terms URL | https://fnjee.com/terms |
| Account deletion URL | https://fnjee.com/delete-account |
| Support email | *(the address set in `appInfo.js`)* |
| Package / Bundle ID | `com.fnjee.app` |
| Version | 1.0.0 |
| Price | Free (no in-app purchases in v1) |

### Short description (Play, max 80)

    CBT mock tests, chapter-wise practice and AI doubt help for JEE & NEET.

### Subtitle (App Store, max 30)

    JEE & NEET CBT mock tests

### Promotional text (App Store, max 170)

    Practise JEE and NEET in the real computer-based-test format, pick any chapter or topic, and see where you stand after every test.

### Full description (Play max 4000 / App Store max 4000)

    FNJEE helps JEE and NEET aspirants practise the way the real exam feels.

    REAL CBT EXPERIENCE
    • Full mock tests in the NTA-style computer-based-test layout: question palette, mark for review, timer and negative marking
    • Chapter-wise and topic-wise tests for Physics, Chemistry, Mathematics and Biology (Class 11 and 12)

    PRACTICE YOUR WAY
    • Build a fresh practice paper in one tap — choose subjects, chapters, topics and difficulty
    • Questions you have already attempted are skipped automatically
    • Daily practice problems, flashcards, mind maps and chapter revision playlists

    KNOW WHERE YOU STAND
    • Instant score, accuracy, time per question and detailed solutions after every test
    • Predicted percentile and rank, class leaderboard and study streaks
    • Spaced-repetition revision of the questions you got wrong

    AI STUDY HELP
    • Ask the AI tutor any doubt and get a step-by-step explanation
    • Turn your notes (PDF, Word or text) into a quiz in one tap
    • Personal study plan and coaching tips after each test

    FOR PARENTS AND TEACHERS
    • Parents can follow their child's progress, get weekly summaries and assign practice tests
    • Teachers can pick questions from the bank, build papers and see results

    Your account works the same on the app and on fnjee.com.

### Keywords (App Store, max 100, comma separated)

    jee,neet,mock test,cbt,jee main,jee advanced,physics,chemistry,biology,maths,practice,mcq,exam prep

### What's new (v1.0.0)

    First release of the FNJEE app.

---

## Google Play Console

1. **Create app** → name above, default language English (India), App, Free.
2. **Set up your app** (dashboard tasks):
   * Privacy policy: `https://fnjee.com/privacy`
   * App access: *All or some functionality is restricted* → add the reviewer login below.
   * Ads: **No, my app does not contain ads**.
   * Content rating questionnaire: category *Education / Reference*; answer **No** to violence, sexual content,
     gambling, drugs, profanity. User-to-user interaction: **No** (leaderboards show names only, no chat). Result: Everyone / 3+.
   * Target audience: **13–15, 16–17, 18+** (the app is not designed for children under 13). If asked "could appeal to
     children": No.
   * News app: No. COVID app: No. Government app: No. Financial features: None. Health: None.
   * **Data safety** (answers):
     - Data collected: **Yes**. Shared with third parties: **No** (service providers don't count as sharing).
     - Encrypted in transit: **Yes**. Users can request deletion: **Yes** — `https://fnjee.com/delete-account`.
     - Personal info → *Name*, *Email address*, *User IDs*: collected, required, for App functionality + Account management.
     - App activity → *App interactions* (tests, answers, scores), *Other user-generated content* (doubts, uploaded notes):
       collected, required, App functionality + Analytics (in-app progress).
     - Photos: collected only when a teacher/admin uploads a picture of a question, optional, App functionality.
     - Files and docs: notes a student uploads for "Notes to quiz", optional, App functionality.
     - App info and performance → *Crash logs / Diagnostics*: collected, App functionality.
     - Not collected: location, contacts, financial info, health, messages, audio, files, calendar, device IDs for ads.
3. **Main store listing**: texts above, icon `icon-512.png`, feature graphic, 2–8 phone screenshots from
   `screenshots/play-phone/`. (Tablet screenshots optional.)
4. **Testing → Internal testing → Create release** → upload `FNJEE-release.aab` → add yourself as tester → install
   from the Play link and check login, a test, results and delete account.
   *New personal developer accounts must run a closed test with at least 12 testers for 14 days before Production;
   organisation accounts can go to Production directly.*
5. **Production → Create release** → same AAB → Review → **Start rollout**.

## App Store Connect

1. **Apps → + New App**: iOS, name *FNJEE: JEE & NEET Mock Tests*, language English (India), bundle ID `com.fnjee.app`,
   SKU `fnjee-ios`, full access.
2. Upload a build (see `../README.md` → iOS) and pick it under **Build**.
3. **App Information**: category Education (secondary Reference), content rights: does not use third-party content
   you don't have rights to, age rating questionnaire → all **None** → 4+.
4. **App Privacy** → Data types (all *Linked to the user*, *Not used for tracking*):
   Contact info → Name, Email; User content → Photos or Videos (optional upload), Other user content; Identifiers → User ID;
   Usage data → Product interaction; Diagnostics → Crash data. Purpose: App Functionality (and Analytics for product
   interaction). Privacy policy URL above.
5. **Pricing**: Free, all countries (or India only).
6. **iPhone screenshots**: upload `screenshots/appstore-6.9/` to the 6.9" slot (the others are generated from it).
7. **App Review Information**: sign-in required → reviewer account below; notes below; contact phone + email.
8. **Submit for Review**.

## Reviewer account + notes (both stores)

Create on the live site before submitting (Sign up as Student), then take one demo test so results show:

    Email:    appreview@fnjee.com   (any address you control)
    Password: (choose one, at least 8 characters)

Notes for the reviewer:

    FNJEE is an exam-practice app for Indian JEE and NEET students. Sign in with the student account above.
    Try: My Tests → open a test → answer a few questions → Submit to see the result and solutions;
    Practice → choose a subject and chapter → Generate & start; AI Tutor → ask a doubt.
    The app has no purchases. Account deletion: profile menu (top right) → Delete account.
    Camera / photo access is only used when the user uploads a picture of a question.

## Answers you may be asked

* **Export compliance (iOS)**: already declared in the build (`ITSAppUsesNonExemptEncryption = NO`) — the app only uses HTTPS.
* **Advertising ID (Play)**: the app does not use the advertising ID.
* **Why a web view?** The app is the full FNJEE student/parent/teacher service; it is not a link to a marketing site.
  Inside the app the marketing and pricing pages are hidden, sharing uses the native share sheet, and an offline screen
  is shown without internet.
