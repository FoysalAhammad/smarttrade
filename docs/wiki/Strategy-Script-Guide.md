# 🧠 Strategy Script Guide

Write your own signals in `⚙ Settings → Strategy script` — they render **live** on the chart above Open Position.

---

## Quick start

```
//@version=5
indicator("My trend", overlay=true)
fast = ta.ema(close, 9)
slow = ta.ema(close, 21)
plot(fast, color=color.teal)
plot(slow, color=color.orange)
buy = ta.crossover(fast, slow)
sell = ta.crossunder(fast, slow)
```

Tap **Apply to chart** — a green ✓ confirms the script is live.

---

## Data series

| Name | Meaning |
|---|---|
| `open` `high` `low` `close` | Candle prices |
| `volume` | Candle volume |
| `hl2` `hlc3` `ohlc4` | Typical price variants |

## Indicators

| Call | Notes |
|---|---|
| `sma(src, len)` | Simple moving average |
| `ema(src, len)` | Exponential MA |
| `wma(src, len)` | Weighted MA |
| `rsi(src, len)` | Relative strength index |
| `highest(src, len)` / `lowest(src, len)` | Rolling extremes |
| `atr(len)` | Average true range |

`len` can be a number or an `input.int(...)` variable.

## Signals & plots

| Statement | Result |
|---|---|
| `plot(series)` | Line on the chart |
| `plot(series, color=teal)` | Coloured line |
| `plot(series, color=#00D9FF)` | Hex colour |
| `plotchar(cond, color=color.green)` | Coloured ▲ marker |
| `buy = cond` | Green ▲ markers |
| `sell = cond` | Red ▼ markers |

## Operators & logic

`+  -  *  /  %` · comparisons `> < >= <= == !=` · `and` `or` `not` · ternary `cond ? a : b` · `math.abs/max/min/sqrt/round`

## Colours

`teal` `cyan` `green` `lime` `red` `blue` `orange` `yellow` `purple` `magenta` `white` `gray` … or any `#hex`.
Also `color.new(#hex, transparency)` and `color.rgb(r,g,b)`.

## Headers you can paste

- `//@version=5` (comment — ignored)
- `indicator("Title", overlay=true)` / `study(...)` / `strategy(...)` — ignored, safe to keep
- `input.int(9, title="Length")` → returns the default value

## Errors

Mistakes show as **Line N: reason** under the editor and on the chart — fix and Apply again.

## Limits

Single-file scripts (≤ 8000 chars). Loops (`for`), user functions (`=>`) and `if` blocks are not supported yet.

---

**Examples that work:** default script · classic RSI `study()` · any single-file `ta.*` indicator with plots.

← [Features](Features.md) · [Privacy Policy](Privacy-Policy.md) →
