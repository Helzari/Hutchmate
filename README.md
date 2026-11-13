# Hutchmate (Android)

Rabbit & guinea pig breeding app: colour genetics, due dates, litters, herd and health.
The app lives in `src/index.html`; `npm run build:web` copies it into `www/` with offline fonts,
and Capacitor wraps it as an Android app (`uk.helzari.hutchmate`).

## Get an APK (no Android Studio needed)
1. Create a new GitHub repo and upload everything in this folder (keep the `.github` folder).
2. Open the repo's **Actions** tab. The "Build Android app" run starts on every push (or press *Run workflow*).
3. When it goes green (~5 min), the APK is at **Releases → latest → Hutchmate.apk** (https://github.com/Helzari/hutchmate/releases/latest).
4. Send the APK to the phone, open it, and allow "Install unknown apps" for your file manager or browser when asked.

Updating: replace `src/index.html`, push, and install the new APK over the old one. Data is kept.

## Google Play (optional, later)
Create an upload key once on a PC with Java installed:

    keytool -genkeypair -v -keystore release.jks -alias hutchmate -keyalg RSA -keysize 2048 -validity 10000

Then in the repo: Settings → Secrets and variables → Actions, add
`KEYSTORE_BASE64` (output of `base64 -w0 release.jks`), `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`hutchmate`), `KEY_PASSWORD`.
The next build also produces **hutchmate-release** with `app-release.aab` for the Play Console.
Keep `release.jks` and its passwords safe: you can't update the Play listing without them. Never commit it.

## Data
Data is stored on the phone. Use **Herd → Backup & move to another device** to copy everything out
(e.g. from the claude.ai web version) and paste it in to restore.

## Website (Cloudflare Pages)
Workers & Pages → Create → Pages → Connect to Git → `Helzari/hutchmate`, then:
- Build command: `npm run build:web`
- Build output directory: `www`

Every push to `main` redeploys the site and builds a new APK.
