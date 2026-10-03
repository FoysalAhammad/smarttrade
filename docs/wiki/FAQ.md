# ❓ FAQ

---

### Is my API key safe?
Yes. It is written to the **device keystore** (hardware-backed encryption on modern Android), used read-only for balances/fees, and never leaves the phone except as your own TLS request to the exchange. There is no developer server.

### Why does it need an IP address when I create the key?
Exchange API keys should be **IP-restricted** for security. The app shows your current public IP in Settings so you can paste it while creating the key — only devices on that IP can use the key.

### What does "fee-aware P&L" mean?
Every profit number is shown **after** the trading fee (default 0.075% per leg, 0.15% round trip). When a key is connected the exact account rate is fetched automatically.

### Which markets can I trade?
Only **coin/USDT** spot pairs. Tap the pair name to switch; coins you hold worth ≥ 1 USDT appear first.

### Demo vs Live mode?
- **Demo** — paper wallet, live prices, zero risk (set your own starting balance in Settings)
- **Live** — real balances/fees displayed; orders are placed by **you** on the exchange (the app never places orders)

### The strategy script says "Line N: …"
That's a syntax error with its line number. Compare with the [Strategy Script Guide](Strategy-Script-Guide.md) and press **Apply to chart** again.

### Chart feels stuck / no candles
Check the network — the app streams official market data. Pull fresh by switching interval. If it persists, reopen the app.

### Where is my history stored?
Local app storage, per device. Uninstalling removes it — export (CSV/PDF) is on the roadmap.

### Can I use it while offline?
Charts and balances need a connection. Previously logged history stays readable offline.

### Is this financial advice?
**No.** Smart Trade is a journal & analysis tool and never places trades.

---

← [Privacy Policy](Privacy-Policy.md) · [Home](Home.md) →
