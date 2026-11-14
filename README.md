# Hutchmate

**Genetics, litters and health for rabbits and guinea pigs.**

Hutchmate is a breeding companion for hobby breeders. It works out what colours a pairing can produce, keeps track of your herd and litters, and helps you act quickly when an animal is unwell. It runs on your phone and works offline.

## What it does

- **Colour & coat calculator** – pick a doe and a buck (or sow and boar) and see every possible colour with its odds, plus coat type and size. Warns about risky pairings such as charlies, peanuts (two true dwarfs) and lethal whites (two roan guinea pigs).
- **Simulate a litter** – watch a random litter appear, drawn from the real odds.
- **Breed for a colour** – choose the colour you want and see which of your pairings can produce it, or which new animal would be worth bringing in.
- **Identify a colour** – add photos and answer a few questions to get the most likely colours, each with a confidence score.
- **Pedigrees** – add each animal's sire and dam so the calculator can estimate the hidden genes it carries.
- **Colour guide** – every colour with its swatch, eye colour, genes and what the parents need.
- **Due dates & litter log** – due date, normal window and a timeline from mating to new homes.
- **Herd records** – colours, hidden genes, ages and notes, with warnings such as "too young to breed".
- **Health check** – emergency signs, a symptom checker by body area, what to do now, a health log per animal and a summary to send to your vet.
- **19 rabbit breeds and 13 guinea pig breeds**, each with breed notes.
- Light, dark, night and high-contrast screen modes, larger text, and a built-in user guide.

## Get the app (Android)

1. On your phone, download **[Hutchmate.apk](https://github.com/Helzari/Hutchmate/releases/download/latest/Hutchmate.apk)**.
2. Open the downloaded file and tap **Install**. The first time, Android asks you to allow installs from your browser or file manager.

**Updating:** the app tells you on the Home page when a newer version is available. Download it and install it over the top; your records are kept.

## Your data

Your animals, litters and health records are stored only on your own device. Nothing is uploaded, and the app contains no one else's data. Use **Settings → Backup** to copy your records to another phone.

## Please note

Hutchmate is a guide, not a guarantee. The genetics cover the main colour, pattern and coat genes and some rarer ones aren't modelled; real litters vary. The health checker helps you decide how urgently to act and is **not veterinary advice** – if you are worried about an animal, contact your vet.

---

## For developers

The whole app is one page, `src/index.html`. `npm run build:web` copies it into `www/` with offline fonts, a web-app manifest and a service worker; [Capacitor](https://capacitorjs.com) wraps that as the Android app (`uk.helzari.hutchmate`).

- **APK:** every push to `main` runs `.github/workflows/build-apk.yml`, which builds the APK and publishes it to the rolling [`latest` release](https://github.com/Helzari/hutchmate/releases/latest).
- **Website:** Cloudflare builds with `npm run build:web` and deploys `www/` using `wrangler.jsonc`.
- **Google Play (optional):** add the secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD` and the workflow also produces a signed `app-release.aab`. Never commit your release keystore.

© Helzari. All rights reserved.
