<div align="center">

# 💹 Smart Trade

**A privacy-first crypto swing-trading journal for Android.**

Live candlestick charts · TradingView-style signal scripts · fee-aware P&L · multi-coin portfolio

[![Android](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)](https://github.com/FoysalAhammad/smarttrade)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20on--device-0ECB81)](site/privacy-policy.html)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Wiki](https://img.shields.io/badge/docs-wiki-4C8DFF)](https://github.com/FoysalAhammad/smarttrade/wiki)
[![Site](https://img.shields.io/badge/website-live-00D9FF)](https://foysalahammad.github.io/smarttrade/)

**[🌐 Website](https://foysalahammad.github.io/smarttrade/)** · **[📚 Wiki](https://github.com/FoysalAhammad/smarttrade/wiki)** · **[🔒 Privacy Policy](https://foysalahammad.github.io/smarttrade/privacy-policy.html)**

<img src="https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/docs/images/feature-graphic.png" width="100%" alt="Smart Trade — live charts, signals, true P&L" />

</div>

---

## Introduction

Most crypto "trading apps" are exchange front-ends. **Smart Trade is a journal.** It sits beside your Binance account and answers the only question that matters after every swing: *did I actually make money — after fees?*

Connect your own read-only API key (or switch on the demo paper wallet), pick any USDT market you hold, and the app tracks entry → exit cycles with the real taker fee deducted from every profit figure. Your keys are encrypted in the device keystore and never leave the phone — there is no server, no account, no analytics.

---

## Screenshots

<table>
<tr>
<td><img src="https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/docs/images/2-dashboard-chart.png" width="240" alt="Dashboard with live candlestick chart"></td>
<td><img src="https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/docs/images/3-chart-crosshair.png" width="240" alt="Chart crosshair OHLC"></td>
<td><img src="https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/docs/images/4-pair-selector.png" width="240" alt="Coin selector"></td>
</tr>
<tr>
<td><img src="https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/docs/images/5-strategy-script.png" width="240" alt="Strategy script editor"></td>
<td><img src="https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/docs/images/6-account-pnl.png" width="240" alt="Account and daily P&L"></td>
<td><img src="https://raw.githubusercontent.com/FoysalAhammad/smarttrade/main/docs/images/1-consent.png" width="240" alt="Privacy consent on first launch"></td>
</tr>
</table>

---

## What you get

📈 **Realtime candlestick chart**

Candles, volume, crosshair OHLC, live price line and interval switching (1m → 4H) straight from official market data.

🤏 **Two-finger chart control**

Pinch to zoom, two-finger pan through history, −50/+50 quick steps, single-finger crosshair. The page never scrolls while your fingers are on the chart.

🧠 **Strategy scripts**

Write your own signal code in the built-in editor — `ema`, `sma`, `rsi`, `crossover`, `plot()`, `plotchar()` — and your buy/sell markers render live on the chart.

🪙 **Multi-coin markets**

Tap the pair name to pick any coin/USDT market you hold (worth ≥ 1 USDT) — chart, ticker and trading all follow instantly.

🧮 **Fee-aware P&L**

Every profit figure is shown **after** the real exchange fee (per-leg and round trip), fetched automatically when your key is connected.

🎯 **Two swing methods**

Sell-first (arm a lower re-entry) or Buy-first (arm a higher exit) — with target alerts you can switch **off** for fully manual journal trading.

📊 **History & daily P&L**

Entry, exit, amount, fee, net profit and wallet snapshots for every completed cycle, grouped by date with all-time and today totals.

👛 **Demo paper wallet**

Practice with a virtual balance and live prices before risking real funds — set your own starting amount in Settings.

🔒 **Permission-light security**

Read-only keys, encrypted on-device (OS keystore), TLS in transit, no withdrawals, ever.

---

## Trading methods

| | Method 1 · Sell first | Method 2 · Buy first |
|---|---|---|
| **Flow** | Sell holdings → arm lower re-entry target | Buy → arm higher take-profit target |
| **Profit in** | Extra coins | USDT |
| **Formula** | `re-buy price < sell price` | `sell price > buy price` |
| **Target off** | Journal only, fully manual | Journal only, fully manual |

Fees are deducted **per leg** (default 0.075% → 0.15% round trip) and shown in every result. Auto mode reads your exact VIP taker rate from your account.

---

## Getting started

1. **Install** Smart Trade on your Android device (Play Store listing coming soon).
2. **Accept** the privacy policy on first launch — full text in-app and on the [website](https://foysalahammad.github.io/smarttrade/privacy-policy.html).
3. Choose your mode: **DEMO** paper wallet (instant) or **LIVE** with a read-only Binance API key.
4. Connect a key from `⚙ Settings → Binance API` — the app shows the IP address to whitelist while you create it.
5. Tap the pair name to pick a market, read the chart, and log your swing.

---

## Documentation

Full user documentation lives in the **[Wiki](https://github.com/FoysalAhammad/smarttrade/wiki)**:

- [Getting Started](https://github.com/FoysalAhammad/smarttrade/wiki/Getting-Started)
- [Features](https://github.com/FoysalAhammad/smarttrade/wiki/Features)
- [Trading Methods](https://github.com/FoysalAhammad/smarttrade/wiki/Trading-Methods)
- [Strategy Script Guide](https://github.com/FoysalAhammad/smarttrade/wiki/Strategy-Script-Guide)
- [Privacy Policy](https://github.com/FoysalAhammad/smarttrade/wiki/Privacy-Policy)
- [FAQ](https://github.com/FoysalAhammad/smarttrade/wiki/FAQ)

---

## Privacy first

- ❌ No accounts, no servers, no analytics, no ads, no trackers
- ❌ No personal data collected or shared
- ✅ API keys stored **only** in your device's keystore (encrypted)
- ✅ Everything else — demo wallet, history, settings — stays in local app storage
- ✅ Data leaves the device only as your own TLS requests to the exchange you configured

Read the full **[Privacy Policy](https://foysalahammad.github.io/smarttrade/privacy-policy.html)**.

---

## Roadmap

- [ ] Google Play public release
- [ ] Price alerts & push notifications
- [ ] Widget + quick-glance portfolio
- [ ] CSV / PDF report export
- [ ] More indicators in the script engine (Bollinger, MACD)

Bug reports and feature ideas are welcome in [issues](https://github.com/FoysalAhammad/smarttrade/issues).

---

> ⚠️ **Disclaimer:** Smart Trade is a journal and analysis tool. It does **not** place trades and does **not** provide financial advice. Crypto assets are volatile — you are responsible for your own trading decisions.

<div align="center">

**Developer:** [Foysal Ahammad](https://github.com/FoysalAhammad)

Released under the [MIT License](LICENSE).

**⭐ Star the repository if Smart Trade is useful to you.**

</div>
