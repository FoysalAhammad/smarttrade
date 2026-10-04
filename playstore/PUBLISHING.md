# Play Store Publishing Checklist — Smart Trade

## 0 · One-time setup

1. **Google Play Console** account (one-time $25 fee) → https://play.google.com/console
2. **Hosting for privacy policy** (free):
   ```
   # push the repo to GitHub, then enable Pages:
   # Settings → Pages → branch main → /playstore  (or root)
   # URL becomes: https://<user>.github.io/<repo>/privacy-policy.html
   ```
   Paste that URL in **Play Console → Privacy policy** field AND update `PRIVACY_POLICY_URL` in `src/components/ConsentGate.tsx`, then rebuild.
3. **AAB build** (Play requires Android App Bundle, not APK):
   ```bash
   cd android
   ./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
   # output: android/app/build/outputs/bundle/release/app-release.aab
   ```
4. **Signing note**: the current build signs with the debug key (fine for testing). For production either:
   - create a release keystore (`keytool -genkey -v -keystore smart-trade.keystore -alias smarttrade -keyalg RSA -keysize 2048 -validity 10000`) and add the standard `signingConfigs.release` block, **or**
   - in Play Console choose *"Enroll new upload key"* with the existing certificate.
   Keep the keystore + passwords safe — losing them blocks updates.

## 1 · Create the app

Play Console → **Create app** → Name `Smart Trade` → App (not game) → **Free** → category **Finance / Investing** → declare no ads (unless you add them later).

## 2 · Test & publish paths

- **Internal testing** track first → upload `app-release.aab` → add tester emails (yourself) → install via testing link.
- Verify on a real device: privacy consent gate, chart, pair switch, buy/sell, history.
- Then **Production** → staged rollout (start 10% → 100%).

## 3 · Store listing (copy from `listing-ASO.md`)

- App name, short description, full description → paste.
- Upload icon (512), `feature-graphic.png`, `screenshots/01–06`.
- Category: Finance → Investing. Contact email + privacy URL (step 0).

## 4 · Privacy policy

- Play Console → **Policy and programs → Privacy policy** → paste hosted URL.
- **Data safety** form (mirror `listing-ASO.md` + policy):

| Question | Answer |
|---|---|
| Data collected | **None** (no personal data, no location, no identifiers) |
| Data shared | **None** |
| Data in transit | Only your own signed requests to Binance (you enter the keys) |
| Data deleted on request | User can reset in-app (`Settings → Reset trade data`) or uninstall |
| Security practices | Encrypted in transit (TLS), encrypted at rest (OS keystore), user can request deletion |

> API keys are stored **on-device only** — say "collected: no; processed: yes (on device)" style entries carefully: Play's Data Safety asks about data handled off-device — since nothing leaves the phone except Binance calls the user configured, answer **"Collected: No"** for all categories.

## 5 · Content rating

- Complete the **Content Rating** questionnaire (IARC): **no violence, no gambling, no sexual content** → typically **Rated for 3+ / Everyone**.
- **Finance/investing apps** may need an extra declaration: app does NOT itself conduct financial transactions (journal only) → confirm that.

## 6 · Ads & families

- No ads declared → skip Ads section.
- Not targeting families under 13 → no Families declaration.

## 7 · Final pre-submit gate

- [ ] Version code incremented (`android/versionCode` via `app.json` → `expo.android.versionCode`)
- [ ] `npx tsc --noEmit` + `npx expo lint` + `npx expo-doctor` all pass
- [ ] Privacy gate verified on fresh install (delete `@sui-swing/settings` → relaunch → Agree)
- [ ] AAB built with release signing
- [ ] All 6 screenshots + feature graphic uploaded
- [ ] Data safety answers submitted BEFORE first release (Play blocks otherwise)

## 8 · Post-launch ASO hygiene

- Reply to reviews (rating velocity boosts discovery).
- Watch **Store listing → Experiments** (A/B test title/short description after ~100 installs).
- Keep screenshots updated with each major UI release.
- Add a short promo video (≤30s) when possible — improves conversion.
- Consider a `web` landing page (repo README) for the Website field + extra search surface.
