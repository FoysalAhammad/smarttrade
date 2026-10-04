import { baseOf } from '../services/trading';
import { useNavigation } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { StatusBadge } from '../components/StatusBadge';
import { useAssetPrices } from '../hooks/useAssetPrices';
import { useBalances } from '../hooks/useBalances';
import { useTicker } from '../hooks/useTicker';
import { useTradeStore } from '../hooks/useTradeStore';
import { useTheme } from '../theme';
import { dayKey, dayLabel, formatSui, formatUsdt } from '../utils/format';

interface DayRow {
  key: string;
  ts: number;
  profitSui: number;
  profitUsdt: number;
  count: number;
}

export const AccountScreen: React.FC = () => {
  const t = useTheme();
  const navigation = useNavigation();
  const balances = useBalances();
  const { settings, history } = useTradeStore();
  const activeSymbol = settings.activeSymbol;
  const ticker = useTicker(activeSymbol);

  const openDrawer = () => {
    (navigation as unknown as { openDrawer?: () => void }).openDrawer?.();
  };

  const demoMode = settings.mode === 'demo';
  const price = ticker.ticker?.lastPrice ?? null;
  const known = demoMode || !!balances.credentials;
  // All held assets (demo multi-asset wallet or live exchange balances).
  const heldAssets = useMemo(() => {
    const out: Record<string, number> = {};
    if (demoMode) {
      for (const [k, v] of Object.entries(settings.demoWallet)) {
        if (typeof v === 'number' && v !== 0) out[k.toUpperCase()] = v;
      }
    } else if (balances.balances?.assets) {
      Object.assign(out, balances.balances.assets);
    }
    return out;
  }, [demoMode, settings.demoWallet, balances.balances]);
  const assetPrices = useAssetPrices(
    Object.keys(heldAssets).filter((b) => b !== 'USDT'),
  );
  const assetRows = useMemo(() => {
    const rows = Object.entries(heldAssets).map(([b, v]) => ({
      base: b,
      amount: v,
      price: b === 'USDT' ? 1 : assetPrices[`${b}USDT`] ?? null,
      value: b === 'USDT' ? v : (assetPrices[`${b}USDT`] ?? null) !== null ? v * (assetPrices[`${b}USDT`] as number) : null,
    }));
    rows.sort((a, b) => {
      if (a.base === 'USDT') return -1;
      if (b.base === 'USDT') return 1;
      return (b.value ?? 0) - (a.value ?? 0);
    });
    return rows;
  }, [heldAssets, assetPrices]);
  const portfolioValue = known
    ? assetRows.reduce<number | null>((sum, r) => (r.value === null ? sum : (sum ?? 0) + r.value), assetRows.length ? 0 : null)
    : null;

  const totals = useMemo(
    () =>
      history.reduce(
        (acc, r) => {
          acc.sui += r.profitSui;
          acc.usdt += r.profitUsdt;
          acc.count += 1;
          return acc;
        },
        { sui: 0, usdt: 0, count: 0 },
      ),
    [history],
  );

  const dayRows = useMemo<DayRow[]>(() => {
    const map = new Map<string, DayRow>();
    for (const r of history) {
      const key = dayKey(r.completedAt);
      const row = map.get(key) ?? {
        key,
        ts: r.completedAt,
        profitSui: 0,
        profitUsdt: 0,
        count: 0,
      };
      row.profitSui += r.profitSui;
      row.profitUsdt += r.profitUsdt;
      row.count += 1;
      row.ts = Math.max(row.ts, r.completedAt);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [history]);

  const signed = (v: number, decimals = 2) => `${v >= 0 ? '+' : ''}${formatSui(v, decimals)}`;

  return (
    <View style={[styles.root, { backgroundColor: t.colors.bg.screen }]}>
      <Header onMenu={openDrawer} demo={demoMode} subtitle="Account · balance & daily P&L" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card
          title="Account Balance"
          right={
            demoMode ? (
              <StatusBadge label="DEMO WALLET" tone="warning" dot />
            ) : (
              <StatusBadge label={known ? 'API CONNECTED' : 'NO API KEYS'} tone={known ? 'success' : 'neutral'} dot={known} />
            )
          }
        >
          {!known && (
            <View style={styles.balanceRow}>
              <View style={styles.balanceCol}>
                <Text style={[styles.balLabel, { color: t.colors.text.tertiary }]}>Balance</Text>
                <Text style={[styles.balValue, { color: t.colors.text.tertiary }]}>—</Text>
                <Text style={[styles.balSub, { color: t.colors.text.tertiary }]}>connect API keys</Text>
              </View>
            </View>
          )}
          {known &&
            assetRows.map((r) => (
              <View
                key={r.base}
                style={[
                  styles.assetLine,
                  {
                    backgroundColor: t.colors.bg.elevated,
                    borderColor: r.base === baseOf(activeSymbol) ? t.colors.brand.primary : 'transparent',
                  },
                ]}
              >
                <View style={[styles.assetDot, { backgroundColor: r.base === baseOf(activeSymbol) ? t.colors.brand.primary : t.colors.border.strong }]} />
                <Text style={[styles.assetSym, { color: t.colors.text.primary }]}>{r.base}</Text>
                <View style={styles.assetRight}>
                  <Text style={[styles.assetAmt, { color: t.colors.text.primary }]}>
                    {formatSui(r.amount, r.amount >= 1000 ? 2 : 6)}
                  </Text>
                  <Text style={[styles.assetVal, { color: t.colors.text.tertiary }]}>
                    {r.value !== null ? `≈ ${formatUsdt(r.value)}` : r.base === 'USDT' ? '' : 'price n/a'}
                  </Text>
                </View>
              </View>
            ))}

          <View style={[styles.totalBox, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
            <View>
              <Text style={[styles.totalLabel, { color: t.colors.text.tertiary }]}>
                Portfolio value
              </Text>
              <Text style={[styles.totalValue, { color: t.colors.text.primary }]}>
                {known && portfolioValue !== null ? `${formatUsdt(portfolioValue)} USDT` : '— USDT'}
              </Text>
            </View>
            <Text style={[styles.livePrice, { color: t.colors.text.secondary }]}>
              {price ? `${baseOf(activeSymbol)} ${formatSui(price, 4)}` : ''}
            </Text>
          </View>

          {!known && (
            <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
              Connect a Binance API key to see live balances here — or switch on DEMO mode in
              Settings to use the paper wallet.
            </Text>
          )}
        </Card>

        <Card title="Profit & Loss · by date">
          <View style={[styles.summaryRow, { borderBottomColor: t.colors.border.subtle }]}>
            <View>
              <Text style={[styles.sumLabel, { color: t.colors.text.tertiary }]}>All time</Text>
              <Text style={[styles.sumCount, { color: t.colors.text.secondary }]}>
                {totals.count} completed {totals.count === 1 ? 'trade' : 'trades'}
              </Text>
            </View>
            <View style={styles.sumRight}>
              <Text
                style={[
                  styles.sumSui,
                  { color: totals.sui >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
                ]}
              >
                {signed(totals.sui, 3)} SUI
              </Text>
              <Text
                style={[
                  styles.sumUsdt,
                  { color: totals.usdt >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
                ]}
              >
                {signed(totals.usdt)} USDT
              </Text>
            </View>
          </View>

          {dayRows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: t.colors.text.secondary }]}>
                No completed trades yet
              </Text>
              <Text style={[styles.emptyText, { color: t.colors.text.tertiary }]}>
                Completed cycles (entry → exit) appear here with date-wise profit & loss.
              </Text>
            </View>
          ) : (
            dayRows.map((row) => {
              const suiPos = row.profitSui >= 0;
              const usdtPos = row.profitUsdt >= 0;
              return (
                <View key={row.key} style={[styles.dayRow, { borderBottomColor: t.colors.border.subtle }]}>
                  <View style={styles.dayLeft}>
                    <Text style={[styles.dayLabel, { color: t.colors.text.primary }]}>
                      {dayLabel(row.ts)}
                    </Text>
                    <Text style={[styles.dayCount, { color: t.colors.text.tertiary }]}>
                      {row.count} {row.count === 1 ? 'trade' : 'trades'}
                    </Text>
                  </View>
                  <View style={styles.dayRight}>
                    <Text
                      style={[
                        styles.daySui,
                        { color: suiPos ? t.colors.feedback.success : t.colors.feedback.danger },
                      ]}
                    >
                      {signed(row.profitSui, 3)} SUI
                    </Text>
                    <Text
                      style={[
                        styles.dayUsdt,
                        { color: usdtPos ? t.colors.feedback.success : t.colors.feedback.danger },
                      ]}
                    >
                      {signed(row.profitUsdt)} USDT
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Text style={[styles.note, { color: t.colors.text.tertiary }]}>
          P&L figures are net of the {(settings.feeRate * 100).toFixed(3)}% per-leg fee (
          {(settings.feeRate * 200).toFixed(3)}% round trip). Daily totals group completed cycle
          trades by device-local date.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingTop: 4, gap: 14 },
  balanceRow: { flexDirection: 'row', alignItems: 'stretch' },
  balanceCol: { flex: 1 },
  vDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  balLabel: { fontSize: 11, marginBottom: 5, fontWeight: '600', letterSpacing: 0.5 },
  balValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  balSub: { fontSize: 11.5, marginTop: 4 },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 13,
    marginTop: 14,
  },
  totalLabel: { fontSize: 11, marginBottom: 4 },
  totalValue: { fontSize: 21, fontWeight: '800' },
  livePrice: { fontSize: 13, fontWeight: '600' },
  assetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  assetDot: { width: 8, height: 8, borderRadius: 4 },
  assetSym: { fontSize: 14.5, fontWeight: '800', flex: 1 },
  assetRight: { alignItems: 'flex-end' },
  assetAmt: { fontSize: 14.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  assetVal: { fontSize: 10.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 11.5, lineHeight: 17, marginTop: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  sumLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  sumCount: { fontSize: 12, marginTop: 4 },
  sumRight: { alignItems: 'flex-end' },
  sumSui: { fontSize: 17, fontWeight: '800' },
  sumUsdt: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayLeft: {},
  dayLabel: { fontSize: 15, fontWeight: '700' },
  dayCount: { fontSize: 11.5, marginTop: 3 },
  dayRight: { alignItems: 'flex-end' },
  daySui: { fontSize: 15.5, fontWeight: '800' },
  dayUsdt: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  empty: { paddingVertical: 18 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyText: { fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  note: { fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
});
