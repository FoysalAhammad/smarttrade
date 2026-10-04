import { useNavigation } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { useTradeStore } from '../hooks/useTradeStore';
import { useTheme } from '../theme';
import { baseOf, TradingMethod, TradeRecord } from '../services/trading';
import { dateTimeLabel, formatSui, formatUsdt } from '../utils/format';

type Tab = TradingMethod;

const TABS: { id: Tab; label: string; caption: string }[] = [
  { id: 'sell_first', label: 'Method 1', caption: 'Sell → Re-buy' },
  { id: 'buy_first', label: 'Method 2', caption: 'Buy → Sell' },
];

export const HistoryScreen: React.FC = () => {
  const t = useTheme();
  const navigation = useNavigation();
  const { history, settings } = useTradeStore();
  const [tab, setTab] = useState<Tab>('sell_first');

  const openDrawer = () => {
    (navigation as unknown as { openDrawer?: () => void }).openDrawer?.();
  };

  const rows = useMemo(() => history.filter((r) => r.method === tab), [history, tab]);

  // Base-unit totals only make sense when every row shares one market.
  const uniformBase = rows.length > 0 && rows.every((r) => r.symbol === rows[0].symbol);
  const tabBase = rows.length ? baseOf(rows[0].symbol) : 'SUI';

  const tabTotal = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.sui += r.profitSui;
          acc.usdt += r.profitUsdt;
          return acc;
        },
        { sui: 0, usdt: 0 },
      ),
    [rows],
  );

  return (
    <View style={[styles.root, { backgroundColor: t.colors.bg.screen }]}>
      <Header onMenu={openDrawer} subtitle="History · all completed trades" />

      <View style={styles.tabs}>
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: active ? t.colors.feedback.infoDim : t.colors.bg.card,
                  borderColor: active ? t.colors.brand.primary : t.colors.border.subtle,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? t.colors.brand.primary : t.colors.text.secondary },
                ]}
              >
                {item.label}
              </Text>
              <Text
                style={[
                  styles.tabCaption,
                  { color: active ? t.colors.text.secondary : t.colors.text.tertiary },
                ]}
              >
                {item.caption}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.totalStrip}>
          <Text style={[styles.totalText, { color: t.colors.text.secondary }]}>
            {rows.length} {rows.length === 1 ? 'trade' : 'trades'} · net{' '}
            {uniformBase && (
              <Text
                style={{
                  color: tabTotal.sui >= 0 ? t.colors.feedback.success : t.colors.feedback.danger,
                  fontWeight: '800',
                }}
              >
                {tabTotal.sui >= 0 ? '+' : ''}
                {formatSui(tabTotal.sui, 3)} {tabBase}{' '}
              </Text>
            )}
            <Text
              style={{
                color: tabTotal.usdt >= 0 ? t.colors.feedback.success : t.colors.feedback.danger,
                fontWeight: '800',
              }}
            >
              {tabTotal.usdt >= 0 ? '+' : ''}
              {formatUsdt(tabTotal.usdt)} USDT
            </Text>
          </Text>
        </View>

        {rows.length === 0 ? (
          <Card>
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: t.colors.text.secondary }]}>
                No {tab === 'sell_first' ? 'Method 1' : 'Method 2'} trades yet
              </Text>
              <Text style={[styles.emptyText, { color: t.colors.text.tertiary }]}>
                {tab === 'sell_first'
                  ? 'Sell-first cycle shesh (re-buy at target) hole row ekhane thakbe.'
                  : 'Buy-first cycle shesh (target-e sell) hole row ekhane thakbe.'}
              </Text>
            </View>
          </Card>
        ) : (
          rows.map((row) => <TradeRow key={row.id} record={row} />)
        )}

        <Text style={[styles.note, { color: t.colors.text.tertiary }]}>
          Entry/exit price দুই leg-ই fee ({(settings.feeRate * 100).toFixed(3)}% each) কেটে দেখানো —
          balance snapshots demo wallet বা live exchange balance থেকে নেওয়া।
        </Text>
      </ScrollView>
    </View>
  );
};

const TradeRow: React.FC<{ record: TradeRecord }> = ({ record }) => {
  const t = useTheme();
  const isM1 = record.method === 'sell_first';
  const unit = baseOf(record.symbol ?? 'SUIUSDT');
  const market = `${unit}/USDT`;
  const primaryProfit = isM1 ? record.profitSui : record.profitUsdt;
  const primaryPositive = primaryProfit >= 0;
  const entryTag = isM1 ? 'SELL' : 'BUY';
  const exitTag = isM1 ? 'RE-BUY' : 'SELL';

  const bal = (b?: { sui: number; usdt: number }) =>
    b ? `${formatSui(b.sui, 2)} ${unit} · ${formatUsdt(b.usdt)} USDT` : '—';

  return (
    <Card
      right={
        <View
          style={[
            styles.profitChip,
            {
              backgroundColor: primaryPositive ? t.colors.feedback.successDim : t.colors.feedback.dangerDim,
              borderColor: primaryPositive ? t.colors.feedback.success : t.colors.feedback.danger,
            },
          ]}
        >
          <Text
            style={[
              styles.profitChipText,
              { color: primaryPositive ? t.colors.feedback.success : t.colors.feedback.danger },
            ]}
          >
            {primaryPositive ? '+' : ''}
            {isM1 ? `${formatSui(record.profitSui, 3)} ${unit}` : `${formatUsdt(record.profitUsdt)} USDT`}
          </Text>
        </View>
      }
    >
      <View style={styles.dateRow}>
        <Text style={[styles.date, { color: t.colors.text.tertiary }]}>
          {dateTimeLabel(record.completedAt)}
        </Text>
        <View style={[styles.marketChip, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
          <Text style={[styles.marketChipText, { color: t.colors.text.secondary }]}>{market}</Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceCol}>
          <Text style={[styles.priceTag, { color: t.colors.text.tertiary }]}>Entry ({entryTag})</Text>
          <Text style={[styles.price, { color: t.colors.text.primary }]}>
            {formatSui(record.entryPrice, 4)}
          </Text>
        </View>
        <Text style={[styles.arrow, { color: t.colors.text.tertiary }]}>→</Text>
        <View style={styles.priceColRight}>
          <Text style={[styles.priceTag, { color: t.colors.text.tertiary }]}>Exit ({exitTag})</Text>
          <Text style={[styles.price, { color: t.colors.text.primary }]}>
            {formatSui(record.exitPrice, 4)}
          </Text>
        </View>
      </View>

      <View style={[styles.metaRow, { borderTopColor: t.colors.border.subtle }]}>
        <Text style={[styles.meta, { color: t.colors.text.secondary }]}>
          Amount {formatSui(record.amount, 1)} {unit}
        </Text>
        <Text style={[styles.meta, { color: t.colors.text.secondary }]}>
          Fee {formatUsdt(record.feeUsdt)} USDT ({(record.feeRate * 100).toFixed(3)}%×2)
        </Text>
      </View>

      <View style={styles.netRow}>
        <Text style={[styles.netLabel, { color: t.colors.text.tertiary }]}>Net profit</Text>
        <View style={styles.netValues}>
          <Text
            style={[
              styles.netSui,
              { color: record.profitSui >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
            ]}
          >
            {record.profitSui >= 0 ? '+' : ''}
            {formatSui(record.profitSui, 3)} {unit}
          </Text>
          <Text
            style={[
              styles.netUsdt,
              { color: record.profitUsdt >= 0 ? t.colors.feedback.success : t.colors.feedback.danger },
            ]}
          >
            {record.profitUsdt >= 0 ? '+' : ''}
            {formatUsdt(record.profitUsdt)} USDT
          </Text>
        </View>
      </View>

      <View style={[styles.balBox, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
        <View style={styles.balLine}>
          <Text style={[styles.balTag, { color: t.colors.text.tertiary }]}>Entry balance</Text>
          <Text style={[styles.balVal, { color: t.colors.text.secondary }]}>{bal(record.entryBalance)}</Text>
        </View>
        <View style={styles.balLine}>
          <Text style={[styles.balTag, { color: t.colors.text.tertiary }]}>Exit balance</Text>
          <Text style={[styles.balVal, { color: t.colors.text.secondary }]}>{bal(record.exitBalance)}</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 4 },
  tab: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 13,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabLabel: { fontSize: 14.5, fontWeight: '800' },
  tabCaption: { fontSize: 11, marginTop: 2 },
  scroll: { paddingHorizontal: 14, paddingTop: 8, gap: 12 },
  totalStrip: {
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingVertical: 6,
  },
  totalText: { fontSize: 13, textAlign: 'center' },
  date: { fontSize: 11.5, marginBottom: 9, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marketChip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 2 },
  marketChipText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceCol: { flex: 1 },
  priceColRight: { flex: 1, alignItems: 'flex-end' },
  priceTag: { fontSize: 10.5, marginBottom: 3, fontWeight: '600' },
  price: { fontSize: 18, fontWeight: '700' },
  arrow: { fontSize: 16, paddingHorizontal: 8, marginTop: 12 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  meta: { fontSize: 12, fontWeight: '600' },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  netLabel: { fontSize: 11.5, fontWeight: '600' },
  netValues: { alignItems: 'flex-end' },
  netSui: { fontSize: 17, fontWeight: '800' },
  netUsdt: { fontSize: 12.5, fontWeight: '700', marginTop: 1 },
  balBox: {
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    marginTop: 11,
    gap: 7,
  },
  balLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balTag: { fontSize: 11, fontWeight: '600' },
  balVal: { fontSize: 12, fontWeight: '600' },
  profitChip: {
    borderWidth: 1.4,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  profitChipText: { fontSize: 13, fontWeight: '800' },
  empty: { paddingVertical: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyText: { fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  note: { fontSize: 10.5, lineHeight: 15, textAlign: 'center', marginTop: 2 },
});
