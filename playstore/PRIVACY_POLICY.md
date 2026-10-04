# Privacy Policy — Smart Trade

**Effective date:** 3 October 2026 · **Version:** 1.0.0

Smart Trade ("the app") is a personal crypto swing-trading journal for spot markets (USDT pairs). This policy explains what the app does with your information. By continuing to use the app you accept this policy.

## 1 · Overview

The app works fully on-device. It has no user accounts, no backend servers, no analytics SDKs, no advertising and no trackers.

## 2 · Data we collect

- **No personal data.** The app does not collect names, emails, phone numbers, contacts, location or any identifiers.
- **Advertising (Google AdMob).** Ads appear only at a few in-app moments (strategy apply, method change, IP copy, API key save, demo enable). AdMob receives your **advertising ID** + coarse device info to serve ads (reset: Android Settings → Privacy → Ads). Nothing else is shared.
- **Binance API key & secret** — entered by you, stored **only on this device** inside the operating system keystore (Android Keystore / iOS Keychain) with strong encryption. They are never transmitted anywhere except directly to Binance APIs.
- **Demo wallet, positions, trade history, settings** — stored only in local app storage on this device.
- **Market data** (prices, candles) — fetched anonymously from Binance public endpoints.

## 3 · How your information is used

- API credentials are used solely to read your Binance spot balances and trade fees so the journal can display them.
- The app never places orders on your behalf and never enables withdrawals.
- Local data stays on the device; you can erase it any time via **Settings → Reset trade data** or by uninstalling the app.

## 4 · Sharing & disclosure

- We do not sell, rent or share personal data — no backend exists to share it with. The only third party is **Google AdMob** (advertising ID only, for ad delivery).
- Data leaves your device only as signed TLS requests to Binance endpoints that you control.

## 5 · Security

- Credentials: OS-level keystore encryption (Android Keystore / iOS Keychain).
- Transport: TLS (HTTPS / WSS) to Binance only.
- No data is transmitted to the developer.

## 6 · Children & changes

The app is not directed at children under 13. This policy may be updated with new app versions; the effective date above always applies.

## 7 · Contact

Questions? Contact the developer through the support channel listed on the app store listing, or open an issue in the project repository.

---

*Host this document (e.g. `privacy-policy.html` in this folder) on a public URL — GitHub Pages is the easiest free option — and use that URL in the Play Console Data Safety & Privacy Policy fields.*
