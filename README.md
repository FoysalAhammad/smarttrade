<div align="center">

# Smart Trade

**Crypto swing-trading journal for spot markets (USDT pairs).**

Live candlestick charts, fee-aware P&L, strategy scripts and a multi-coin
portfolio — privacy-first with no accounts, no trackers and keys stored in
Android Keystore.

[![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)](https://foysalahammad.github.io/smarttrade)
[![Release](https://img.shields.io/github/v/release/FoysalAhammad/smarttrade?color=4C8DFF)](https://github.com/FoysalAhammad/smarttrade/releases/latest)
[![APK](https://img.shields.io/badge/APK-112%20MB-orange)](https://github.com/FoysalAhammad/smarttrade/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[Website](https://foysalahammad.github.io/smarttrade) ·
[Features](#-features) ·
[Methods](#-swing-methods) ·
[Download](#-download) ·
[Privacy](privacy.html)

</div>

---

## Introduction

Most trading apps try to do everything — exchange, wallet, signals, social.
Smart Trade does one thing well: it's a **swing-trading journal**. You log
every trade, it calculates exact profit after Binance VIP fees, tracks your
portfolio in real time, and alerts you when price hits your target zone.

Your API keys never leave the device. There is no backend, no account,
no analytics — everything runs locally on your phone.

![Workspace](https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/playstore/screenshots/02-dashboard-chart.png)

- **Dashboard** — live chart, position tracking, buy/sell buttons, portfolio card
- **Account** — total balance, daily P&L, change percentage, asset breakdown
- **History** — every completed trade with entry/exit prices, fees and net profit

---

## ✨ Features

| | |
|---|---|
| 📊 **Live candlestick charts** | 1m, 5m, 15m, 1H, 4H intervals with two-finger pinch zoom & pan. |
| 📝 **Strategy scripts** | Paste TradingView-style Pine scripts (EMA, SMA, RSI, crossover) — rendered live on the chart as signals. |
| 💰 **Fee-aware P&L** | Auto-fetches your exact Binance VIP taker rate; every profit figure is net of fees. |
| 🎯 **Auto targets** | Set a net gain target, get zone alerts, auto-arm re-entry / take-profit cycles. |
| 📱 **Multi-coin portfolio** | Any USDT pair. Live prices from Binance, full valuation in USDT. |
| 💵 **Demo paper wallet** | Practice with a simulated wallet using live market prices — no real funds move. |
| 🔒 **Privacy first** | No accounts, no servers, no trackers. API keys in Android Keystore, all data local. |
| 🔔 **AdMob at key moments** | Occasional interstitials only — never interrupts a live trade. |

---

## 📐 Swing Methods

| | |
|---|---|
| 🔁 **Method 1 — Sell First** | Already holding? Sell at market, wait for the dip, buy back lower. Profit shows in extra coins. |
| 📈 **Method 2 — Buy First** | Buy at market, wait for the rise, sell higher. Profit shows in USDT (expressed in SUI at entry). |

Both methods are fully supported with fee-aware P&L, auto targets, and
history tracking.

---

## 📱 Screenshots

| Dashboard | Chart & Trade | Account |
|---|---|---|
| ![Dashboard](https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/playstore/screenshots/02-dashboard-chart.png) | ![Chart](https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/playstore/screenshots/03-chart-crosshair.png) | ![Account](https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/playstore/screenshots/06-account-pnl.png) |

---

## 📦 Download

**[⬇ Download Smart Trade v1.1.2](https://github.com/FoysalAhammad/smarttrade/releases/latest)**

- Android 7.0+
- Universal APK (~112 MB) — arm64 + x86_64 + armeabi-v7a
- Enable "Install from unknown sources" for your browser/file manager

---

## 🔒 Privacy

- **No accounts, no servers** — the app has no backend whatsoever
- **API keys** stored only in Android Keystore / iOS Keychain with strong encryption
- **Market data** fetched anonymously from Binance public endpoints
- **Local data** — positions, history, settings stay on your device
- **Google AdMob** is the only third party — receives advertising ID only

Full policy: [privacy.html](privacy.html) · [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

---

## 🛠️ Tech Stack

- **React Native / Expo** — cross-platform with native modules
- **TypeScript** — strict type safety throughout
- **Binance API** — public ticker + signed account endpoints
- **AdMob** — Google Mobile Ads for interstitials
- **Expo SecureStore** — encrypted API key storage

---

## 📖 Documentation

Full documentation lives at [foysalahammad.github.io/smarttrade](https://foysalahammad.github.io/smarttrade) — features, methods, privacy policy, and installation guide.

Wiki: [GitHub Wiki](https://github.com/FoysalAhammad/smarttrade/wiki)

---

## 🗺️ Roadmap

- [x] Auto-update from GitHub Releases
- [x] Strategy script engine (Pine-style)
- [x] Multi-coin portfolio
- [x] Daily P&L with change percentage
- [ ] Push notification target alerts
- [ ] Telegram bot integration
- [ ] Web dashboard companion
- [ ] Export journal as CSV / PDF

Bug reports and feature ideas are welcome in [issues](https://github.com/FoysalAhammad/smarttrade/issues).

---

<div align="center">

**Developer:** [Foysal Ahammad](https://github.com/FoysalAhammad)

Released under the [MIT License](LICENSE).

**⭐ Star the repository if Smart Trade is useful to you.**

Made for the crypto trading community

</div>
