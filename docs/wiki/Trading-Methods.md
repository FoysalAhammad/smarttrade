# 🎯 Trading Methods

Two playbooks — switch in `⚙ Settings → Trading method`.

---

## Method 1 — Sell first

**You hold coins → sell the top → buy the dip back.**

```
sell at market  →  arm LOWER re-entry target  →  re-buy below  →  extra coins kept
```

- Profit is counted in **coins** (`re-buy price < sell price`)
- The app shows the exact target price, progress bar and zone alerts
- Completing the re-buy writes a History row with net coin gain

## Method 2 — Buy first

**You want exposure → buy → ride the rise → sell higher.**

```
buy at market  →  arm HIGHER take-profit target  →  sell above  →  USDT profit
```

- Profit is counted in **USDT** after fees (`sell price > buy price`)
- The app shows secured-vs-baseline as you fill the sell
- Completion writes a History row with net USDT profit

---

## The fee rule

| | Value |
|---|---|
| Per leg (default) | 0.075% |
| Round trip | 0.15% |
| Auto mode | Exact VIP taker rate fetched from your account |
| Where it shows | Every price, profit, confirmation & History row |

Fees are deducted **before** any profit figure you see. No hidden numbers.

---

## Net target — ON vs OFF

| | ON (default) | OFF (manual journal) |
|---|---|---|
| Cycle armed on trade | ✅ | ❌ |
| Zone / target alerts | ✅ | ❌ |
| Re-entry panel | shown | hidden |
| History & P&L recorded | ✅ | ✅ |

Toggle: `⚙ Settings → Fees & target → Net target`.

---

## Risk notes

- Targets are **not guarantees** — gaps can skip them
- Journal mode (target OFF) never blocks a buy/sell
- Not financial advice

← [Features](Features.md) · [Strategy Script Guide](Strategy-Script-Guide.md) →
