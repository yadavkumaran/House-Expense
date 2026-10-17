# Hearth

A responsive household expense tracker that uses Supabase Auth and Postgres. Hearth does not seed example transactions or store financial records in browser local storage.

## Run it

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy `supabase-config.js.example` to `supabase-config.js`, then set the project URL and **anon/publishable** key. Do not put a service-role key in this file.
4. Serve this directory over localhost or HTTPS. ES modules, service workers, camera access and microphone access do not work reliably from `file://`. For example, use `python -m http.server 8000` and open `http://localhost:8000`.
5. Create an account, then create a household or join one with its invite code. From Settings, you can create or join additional households and switch between every household you belong to. Each member must have a Hearth account.

The Supabase schema enforces household-level row security. Keep RLS enabled, and never expose a service-role key in the browser. For production, configure Supabase Auth email confirmation and allowed redirect URLs for the deployed origin.

### Netlify build configuration

Set the Netlify build environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the project URL and public anon/publishable key. Netlify runs `npm run build:web`; when no local `supabase-config.js` exists, the build safely generates `dist/supabase-config.js` from those variables and fails with the missing variable names if either is empty. The generated file uses JavaScript string serialization and is build output only. Local builds continue to copy an existing, ignored `supabase-config.js` without requiring or overwriting environment-specific local configuration. Never set a service-role key or provider API key as `SUPABASE_ANON_KEY`.

## Voice expense entry

Open **Add expense → Voice entry**, choose English or Tamil, allow microphone access, and record up to 60 seconds. Before transcription, explicitly agree to send that recording to Groq. Hearth uploads it to an authenticated Supabase Edge Function, which verifies the Supabase user and transcribes it with Groq's `whisper-large-v3-turbo` model. Recordings are held in memory only and are not saved as expenses. You can cancel, retry, or continue manually.

The transcript is parsed into a draft using deterministic rules. Amount, description, category, date, payer and funding are editable; fields that cannot be identified are left blank for you to supply. Payer is not inferred from funding, or vice versa. You must review the populated expense form and explicitly press **Save**; transcription never creates a financial transaction by itself. The existing Supabase expense insert and household RLS remain the only save path.

The Groq API key is stored only as the `GROQ_API_KEY` Supabase Edge Function secret. The function requires a valid Supabase access token, verifies it with Supabase Auth, applies a database-backed limit of 10 transcription requests per signed-in user per rolling hour, validates the declared audio signature/type and size, and checks that the submitted duration is at most 60 seconds. The browser recorder itself stops at 60 seconds; duration metadata is client-reported, so server-enforced size and per-user rate limits are the protections against callers that bypass the UI. The browser recorder chooses a supported WebM or MP4 format where available; the function forwards the audio as multipart form data to Groq with the selected `en` or `ta` language hint. Audio is sent to Groq only after you press **Transcribe recording** with the consent checkbox selected. Provider errors are replaced with safe messages; API keys, audio, transcript, tokens and provider response bodies are not logged.

Hearth uses Groq's [speech-to-text API](https://console.groq.com/docs/speech-to-text), endpoint `https://api.groq.com/openai/v1/audio/transcriptions`, with model `whisper-large-v3-turbo`. Groq documents multilingual support, ISO-639-1 language hints and a 25 MB Free-tier file limit; Hearth keeps its own 60-second/5 MiB limits. Start with Groq's Free plan. Free-plan request and usage limits can change; a provider HTTP 429 is reported as a rate-limit message with retry guidance. Hearth does not upgrade the account or fall back to any paid service. Transcription availability and Tamil accuracy are not guaranteed.

### Deploy the transcription function (PowerShell)

Run these commands from the project directory after the existing Supabase schema is installed. You need the Supabase CLI and access to the correct Supabase project. The secret is read silently in the terminal; **do not paste it into chat, a source file, or a checked-in `.env` file**.

```powershell
npx supabase --version
npx supabase login
npx supabase link --project-ref kbhixaiseqkcbsdswyta
npx supabase db push
$secret = Read-Host -AsSecureString "Groq API key"
$env:GROQ_API_KEY = [System.Net.NetworkCredential]::new("", $secret).Password
npx supabase secrets set --project-ref kbhixaiseqkcbsdswyta "GROQ_API_KEY=$env:GROQ_API_KEY"
Remove-Item Env:GROQ_API_KEY
$secret = $null
npx supabase functions deploy transcribe-expense --project-ref kbhixaiseqkcbsdswyta
npx supabase functions list --project-ref kbhixaiseqkcbsdswyta
```

The function uses the fixed `whisper-large-v3-turbo` model and reads `GROQ_API_KEY` only from its server-side environment. The key is never part of `supabase-config.js`, the web bundle, browser storage, or APK assets. If the secret is absent or invalid, transcription fails with a safe configuration error; expense entry remains available manually. The existing `verify_jwt = true` setting in `supabase/config.toml`, explicit user verification, CORS handling and rate-limit migration remain in effect. No database migration change is needed for the provider switch. Verify deployment with `npx supabase functions list --project-ref kbhixaiseqkcbsdswyta`; an Edge Gateway `404 NOT_FOUND` means the function is not deployed to this project. When missing, the gateway rejects preflight before the authenticated upload is sent, which can look like a network failure. Hearth's short unauthenticated GET diagnostic distinguishes an undeployed function, blocked upload/CORS and an unreachable network without sending audio or an access token.

## Install Hearth (PWA)

Serve the site from localhost or deploy it to HTTPS. Hearth's supplied family-expense logo is used on sign-in, onboarding, as the install/favicon artwork, and as the native Android launcher icon. In a supported browser, use the **Install Hearth** prompt when it appears, or choose **Install app / Add to Home Screen** from the browser menu. The service worker caches only the static application shell and icons; Supabase auth, household and financial API responses are never cached. Editing shared records still requires connectivity. An online/offline indicator is shown, and available app updates can be applied using the update prompt.

For Android, use Chrome's **Install app** or **Add to Home screen** menu on the HTTPS deployment. This installs the PWA without an APK and keeps the browser's supported speech-recognition environment. Microphone access still depends on browser support and permission.

### Android debug APK (Capacitor)

The project includes a Capacitor Android wrapper. Building requires Node.js 22+, JDK 21+, Android SDK Platform/Build Tools 36, and an internet connection for Gradle and Maven dependencies. Install Android Studio and accept the SDK licenses if these components are missing. Android microphone permission is requested when recording starts.

```powershell
npm install
npm run android:add
npm run android:debug
```

`android:add` creates the Android project once; `android:debug` prepares the static web assets, syncs Capacitor, and runs Gradle. The debug APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`. For an emulator/device with USB debugging enabled:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

The APK is a debug build signed with the local debug key, not a release artifact. Recording requires a secure origin (Capacitor's local HTTPS origin qualifies), microphone permission, a supported MediaRecorder format, network access, a signed-in Supabase session and the deployed transcription function.

## Implemented workflows

- **Recurring bills:** create a cadence, next due date, payer, category, and amount. Upcoming and overdue dates appear in Bills. Only the explicit “Confirm payment” action records an expense; the database RPC creates that expense and advances the due date together, and prevents recording the same bill twice for one date.
- **Receipts:** choose a camera/gallery image. Tesseract.js runs English or Tamil OCR in the browser based on the language preference; amount/date/description are editable and must be reviewed before saving. The image is not uploaded. Exact image fingerprints are unique per household, and matching amount/description/date entries are flagged for review. OCR requires an internet connection to load its library and language data; extracted values are estimates, not AI-verified facts.
- **Groceries:** shopping-list changes are shared over Supabase Realtime. Items track quantity, unit, and estimated unit price. Mark an item purchased, enter its actual unit price, and explicitly convert it. A database RPC links one expense to the item and is idempotent, preventing duplicate accounting.
- **Spending alerts:** deterministic rules check category budget thresholds, matching duplicate entries, unusually large purchases against a 90-day category average, and category increases against the same elapsed days last month. Each alert renders its recorded comparison transactions and thresholds; no AI-generated findings are used.
- **Other features:** per-user English/Tamil preference; savings goals with separately recorded contributions; authenticated API-powered voice transcription into a reviewable expense form; CSV export; print-to-PDF; and a room-scoped audit log.
- **Multiple households:** one account can create many households and join many others. Manage them in Household, switch the active household there, and share the selected household's invite code.
- **PWA:** installable app manifest, maskable and standard icons, safe static-shell caching, update prompt and connectivity status. Private Supabase data is never placed in the service-worker cache.

Due reminders are in-app; this static client does not claim to send push notifications or background reminders when closed. Voice recording/transcription requires an available microphone, permission, connectivity and a configured provider. Print-to-PDF uses the browser's print dialog.

## Mobile navigation

The fixed bottom bar contains only **Home**, **Transactions**, **Insights**, **Household** and **More**. Household settings, room switching and preferences are directly reachable from **Household**; the spending calendar, groceries, bills, goals and reports are organized under **More**. The calendar uses the selected household's actual transactions for the current month and up to the previous 11 months, with per-day amounts and transaction details. Add Expense floats above, not over, the navigation. Navigation buttons wrap their labels instead of clipping or creating horizontal scrolling, honor Android safe-area insets, and remain touch-sized on narrow screens. Sheets keep their title visible while their content scrolls, and their actions stay reachable above the keyboard/viewport edge.

## Checks

The static web app has no bundler. Capacitor dependencies are needed only for the optional Android wrapper. Run the voice parser and server-side request-validation tests plus JavaScript syntax checks with:

```powershell
npm test
node --check app.js
node --check voice.js
node --check pwa.js
node --check service-worker.js
node --check supabase\functions\transcribe-expense\validation.mjs
```

Local tests cover deterministic draft parsing, explicit non-inference of unknown fields, accepted audio types/languages, upload size/duration validation, mocked Groq success and error responses, and calendar month aggregation/rendering. They do not call Groq or a deployed Edge Function. After deployment, test authorized and unauthorized function calls, missing/invalid provider secrets, rate limiting, malformed/empty recordings, English and Tamil dictation, and provider/network failures. On a real signed-in browser/device, verify microphone permission denial/recovery, cancellation during recording/upload, edit-before-save, duplicate-submit protection, and successful/failed expense inserts. Do not test by creating sample expenses in production.

For visual checks, use browser device emulation at 320, 360, 375, 390 and 430 CSS-pixel widths and tablet/desktop widths. Verify all five bottom destinations and the floating add action remain visible, Settings/Household and every More destination are reachable, and sheets can scroll with the on-screen keyboard open. Existing Supabase, authentication, RLS, accounting, PWA, offline-shell, CSV and print workflows should also be regression-tested.
