# ⚙️ Features

Everything Smart Trade does, screen by screen.

---

## 📊 Live chart

- Candlesticks + volume bars, dark theme
- Live price line with animated tag
- Crosshair: single-finger tap → OHLC + timestamp tooltip
- Two-finger **pinch zoom** (1×–16×) and **pan** through history
- **−50 / +50** zoom buttons + **⟲ reset**
- Intervals: 1m · 5m · 15m · 1H · 4H
- Streaming updates while the app is open

## 🧠 Strategy scripts

Built-in editor in Settings → Strategy script:

- `ema/sma/wma/rsi` overlays via `plot()`
- `crossover/crossunder` conditions
- `plotchar()` / `plotshape()` → coloured ▲ markers on the chart
- `buy` / `sell` variables → default green/red markers
- Supports TradingView-style headers: `//@version=5`, `indicator(...)`, `ta.*`, `input.*`, `color.*`

See the full syntax in the [Strategy Script Guide](Strategy-Script-Guide.md).

## 🪙 Multi-coin markets

- Tap the pair to open the **coin selector**
- Account coins worth **≥ 1 USDT** float to the top
- Only **coin/USDT** spot markets are tradable
- Chart, ticker, position and history labels all follow the active market

## 💹 Two swing methods

- **Method 1 — Sell first:** sell holdings, arm a lower re-entry, buy the dip back (profit in coins)
- **Method 2 — Buy first:** buy, arm a higher take-profit, sell the rise (profit in USDT)
- **Net target OFF** → manual mode: no alerts, trades still journaled

## 🧮 Fee-aware math

- Per-leg fee (default **0.075%**, round trip **0.15%**)
- Auto-fetches your exact VIP rate when a key is connected
- Every profit figure is displayed **net of fees**

## 💼 Portfolio & Account

- Multi-coin balances with live USDT valuation
- All-time + per-day profit/loss grouping
- Demo wallet: set your own starting amounts in Settings

## 📜 History

Each completed cycle stores: entry price, exit price, amount, fee, net profit (base + USDT), entry/exit balance snapshots, method and market — with Method 1 / Method 2 tabs.

## 🔒 Privacy by design

First-launch consent screen · no accounts · no servers · no analytics · keys encrypted on-device.

---

← [Home](Home.md) · [Trading Methods](Trading-Methods.md) →
