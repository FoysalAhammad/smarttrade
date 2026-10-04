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
  /** Previous day's portfolio value for change % calc. */
  prevValue?: number;
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

  // Daily P&L with previous day portfolio value for change %
  const dayRows = useMemo<DayRow[]>(() => {
    const map = new Map<string, DayRow>();
    // Build daily P&L from completed trades
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
    const rows = [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
    // Add previous day portfolio value for change % (simplified: use current portfolio value - today's P&L as prev)
    if (portfolioValue !== null && rows.length > 0) {
      const today = rows[0];
      // Estimate previous day value: current portfolio - today's P&L (in USDT)
      today.prevValue = portfolioValue - (today.profitUsdt || 0);
    }
    return rows;
  }, [history, portfolioValue]);

  const signed = (v: number, decimals = 2) => `${v >= 0 ? '+' : ''}${formatSui(v, decimals)}`;
  const signedUsdt = (v: number) => `${v >= 0 ? '+' : ''}${formatUsdt(v)}`;

  // Calculate change % for today
  const todayRow = dayRows[0];
  const todayChangePct = todayRow && todayRow.prevValue !== undefined && todayRow.prevValue > 0
    ? ((portfolioValue! - todayRow.prevValue) / todayRow.prevValue) * 100
    : null;

  return (
    <View style={[styles.root, { backgroundColor: t.colors.bg.screen }]}>
      <Header onMenu={openDrawer} demo={demoMode} subtitle="Account · balance & daily P&L" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Balance Card */}
        <Card
          title="Total Balance"
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
                Portfolio Value
              </Text>
              <Text style={[styles.totalValue, { color: t.colors.text.primary }]}>
                {known && portfolioValue !== null ? `${formatUsdt(portfolioValue)} USDT` : '— USDT'}
              </Text>
            </View>
            <View style={styles.changeBox}>
              {todayChangePct !== null && (
                <Text style={[
                  styles.changePct,
                  { color: todayChangePct >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
                ]}>
                  {todayChangePct >= 0 ? '+' : ''}{todayChangePct.toFixed(2)}% today
                </Text>
              )}
              <Text style={[styles.livePrice, { color: t.colors.text.secondary }]}>
                {price ? `${baseOf(activeSymbol)} ${formatSui(price, 4)}` : ''}
              </Text>
            </View>
          </View>

          {!known && (
            <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
              Connect a Binance API key to see live balances here — or switch on DEMO mode in
              Settings to use the paper wallet.
            </Text>
          )}
        </Card>

        {/* Daily P&L Card */}
        <Card title="Daily P&L">
          <View style={[styles.dailyHeader, { borderBottomColor: t.colors.border.subtle }]}>
            <View>
              <Text style={[styles.dailyLabel, { color: t.colors.text.tertiary }]}>Today</Text>
              <Text style={[styles.dailyCount, { color: t.colors.text.secondary }]}>
                {todayRow ? `${todayRow.count} completed {todayRow.count === 1 ? 'trade' : 'trades'}` : '0 completed trades'}
              </Text>
            </View>
            <View style={styles.dailyRight}>
              <Text
                style={[
                  styles.dailySui,
                  { color: todayRow?.profitSui ?? 0 >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
                ]}
              >
                {todayRow ? signed(todayRow.profitSui, 3) : '+0.000'} SUI
              </Text>
              <Text
                style={[
                  styles.dailyUsdt,
                  { color: todayRow?.profitUsdt ?? 0 >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
                ]}
              >
                {todayRow ? signedUsdt(todayRow.profitUsdt) : '+0.00'} USDT
              </Text>
              {todayChangePct !== null && (
                <Text style={[
                  styles.dailyChange,
                  { color: todayChangePct >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
                ]}>
                  {todayChangePct >= 0 ? '+' : ''}{todayChangePct.toFixed(2)}%
                </Text>
              )}
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
              const isToday = row.key === dayRows[0]?.key;
              return (
                <View key={row.key} style={[styles.dayRow, { borderBottomColor: t.colors.border.subtle }]}>
                  <View style={styles.dayLeft}>
                    <Text style={[styles.dayLabel, { color: t.colors.text.primary }]}>
                      {dayLabel(row.ts)}{isToday ? ' · Today' : ''}
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
                      {signedUsdt(row.profitUsdt)}
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
  changeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  changePct: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  dailyLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  dailyCount: { fontSize: 12, marginTop: 4 },
  dailyRight: { alignItems: 'flex-end', gap: 6 },
  dailySui: { fontSize: 17, fontWeight: '800' },
  dailyUsdt: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  dailyChange: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
