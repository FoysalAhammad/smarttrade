import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getPrices } from '../services/binance';
import { baseOf, DemoWallet } from '../services/trading';
import { useTheme } from '../theme';
import { formatNumber, formatPrice, formatUsdt } from '../utils/format';
import { ModalShell } from './ModalShell';

/** Always-offered markets (USDT-quoted) when balances are unknown. */
const WATCH = ['SUI', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'TRX', 'DOT', 'MATIC'];

interface PairPickerModalProps {
  visible: boolean;
  onClose: () => void;
  activeSymbol: string;
  onSelect: (symbol: string) => void;
  mode: 'demo' | 'live';
  /** Demo paper wallet (multi-asset). */
  demoWallet: DemoWallet;
  /** Live free balances by asset code (null while loading / no keys). */
  liveAssets: Record<string, number> | null;
}

interface Row {
  symbol: string;
  base: string;
  price: number | null;
  /** Units held (0 for watch-only). */
  held: number;
  /** Held value in USDT (0 when unknown/no holding). */
  value: number;
}

export const PairPickerModal: React.FC<PairPickerModalProps> = ({
  visible,
  onClose,
  activeSymbol,
  onSelect,
  mode,
  demoWallet,
  liveAssets,
}) => {
  const t = useTheme();
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const heldMap = useMemo(() => {
    const out: Record<string, number> = {};
    if (mode === 'demo') {
      for (const [k, v] of Object.entries(demoWallet)) {
        if (k.toUpperCase() !== 'USDT' && typeof v === 'number' && v > 0) out[k.toUpperCase()] = v;
      }
    } else if (liveAssets) {
      for (const [k, v] of Object.entries(liveAssets)) {
        if (k !== 'USDT' && v > 0) out[k] = v;
      }
    }
    return out;
  }, [mode, demoWallet, liveAssets]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    // Defer the loading flip past the effect body (lint: no sync setState in effects).
    queueMicrotask(() => {
      if (alive) {
        setLoading(true);
        setError(null);
      }
    });
    const candidates = Array.from(
      new Set([...Object.keys(heldMap), ...WATCH, baseOf(activeSymbol)]),
    ).map((b) => `${b}USDT`);
    getPrices(candidates)
      .then((map) => {
        if (alive) setPrices(map);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Price fetch failed');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rows = useMemo<Row[]>(() => {
    const map = prices ?? {};
    const all = Array.from(
      new Set([...Object.keys(heldMap), ...WATCH, baseOf(activeSymbol)]),
    );
    const out: Row[] = [];
    for (const base of all) {
      const symbol = `${base}USDT`;
      const price = map[symbol] ?? null;
      const held = heldMap[base] ?? 0;
      const value = price !== null ? held * price : 0;
      out.push({ symbol, base, price, held, value });
    }
    // Stable ordering: account coins first, active pair pinned, then the
    // watchlist order — never reshuffle when prices arrive (tap targets stay put).
    const order = new Map(all.map((base, i) => [base, i]));
    out.sort((a, b) => {
      const aAcct = a.value >= 1 ? 0 : 1;
      const bAcct = b.value >= 1 ? 0 : 1;
      if (aAcct !== bAcct) return aAcct - bAcct;
      if (a.symbol === activeSymbol) return -1;
      if (b.symbol === activeSymbol) return 1;
      return (order.get(a.base) ?? 99) - (order.get(b.base) ?? 99);
    });
    const q = filter.trim().toUpperCase();
    return q ? out.filter((r) => r.base.includes(q)) : out;
  }, [prices, heldMap, activeSymbol, filter]);

  return (
    <ModalShell visible={visible} title="Select market (USDT pairs)" onClose={onClose}>
      <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
        Only coin/USDT spot markets are tradable. Account coins worth ≥ 1 USDT are listed first —
        tap one to chart & trade it.
      </Text>

      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Search coin (e.g. BTC)"
        placeholderTextColor={t.colors.text.tertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[styles.search, { backgroundColor: t.colors.bg.input, borderColor: t.colors.border.subtle, color: t.colors.text.primary }]}
        selectionColor={t.colors.brand.primary}
      />

      <View style={styles.list}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={t.colors.brand.primary} />
            <Text style={[styles.muted, { color: t.colors.text.tertiary }]}>Loading prices…</Text>
          </View>
        )}
        {!loading && error && (
          <View style={styles.center}>
            <Text style={[styles.muted, { color: t.colors.feedback.danger }]}>{error}</Text>
          </View>
        )}
        {!loading &&
          rows.map((r) => {
            const active = r.symbol === activeSymbol;
            const inAccount = r.value >= 1;
            return (
              <Pressable
                key={r.symbol}
                onPress={() => {
                  onSelect(r.symbol);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active ? t.colors.feedback.infoDim : pressed ? t.colors.bg.elevated : t.colors.bg.card,
                    borderColor: active ? t.colors.brand.primary : t.colors.border.subtle,
                  },
                ]}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.rowBase, { color: t.colors.text.primary }]}>{r.base}</Text>
                  <Text style={[styles.rowQuote, { color: t.colors.text.tertiary }]}>/USDT</Text>
                  {inAccount && (
                    <View style={[styles.holdPill, { backgroundColor: t.colors.feedback.successDim }]}>
                      <Text style={[styles.holdPillText, { color: t.colors.feedback.success }]}>
                        ≥1 USDT · {formatNumber(r.value, 2)}
                      </Text>
                    </View>
                  )}
                  {r.held > 0 && !inAccount && (
                    <Text style={[styles.heldSmall, { color: t.colors.text.tertiary }]}>
                      {formatNumber(r.held, 4)}
                    </Text>
                  )}
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowPrice, { color: t.colors.text.primary }]}>
                    {r.price !== null ? formatPrice(r.price) : '—'}
                  </Text>
                  {active && (
                    <Text style={[styles.rowActive, { color: t.colors.brand.primary }]}>ACTIVE</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        {!loading && !error && rows.length === 0 && (
          <View style={styles.center}>
            <Text style={[styles.muted, { color: t.colors.text.tertiary }]}>No matching coin</Text>
          </View>
        )}
      </View>

      <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
        {mode === 'demo'
          ? `Demo wallet: ${Object.keys(heldMap).length} coin(s) held · USDT budget ${formatUsdt(demoWallet.USDT ?? demoWallet.usdt ?? 0)}`
          : liveAssets
            ? 'Balances from your connected Binance account.'
            : 'Connect API keys to see your account coins — watchlist still works for charting.'}
      </Text>
    </ModalShell>
  );
};

const styles = StyleSheet.create({
  hint: { fontSize: 11.5, lineHeight: 16, marginBottom: 10 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  list: { gap: 8, minHeight: 180 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 26, gap: 8 },
  muted: { fontSize: 12.5, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  rowBase: { fontSize: 15.5, fontWeight: '800' },
  rowQuote: { fontSize: 11.5, fontWeight: '700' },
  holdPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5, marginLeft: 3 },
  holdPillText: { fontSize: 9.5, fontWeight: '800' },
  heldSmall: { fontSize: 10.5, fontWeight: '600' },
  rowRight: { alignItems: 'flex-end', gap: 1 },
  rowPrice: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowActive: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
});
