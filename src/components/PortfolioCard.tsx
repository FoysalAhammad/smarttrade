import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { DemoWallet } from '../services/trading';
import { formatNumber, formatUsdt } from '../utils/format';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

interface PortfolioCardProps {
  /** Held amounts by asset code (includes USDT). */
  assets: Record<string, number>;
  /** Market prices keyed by pair ('BTCUSDT'). USDT is treated as 1. */
  prices: Record<string, number>;
  /** Active market's base — highlighted in the list. */
  activeBase: string;
  demoMode: boolean;
  demoWallet: DemoWallet;
  connected: boolean;
  error: string | null;
  onConnect: () => void;
}

const valueOf = (amount: number, base: string, prices: Record<string, number>): number =>
  base === 'USDT' ? amount : amount * (prices[`${base}USDT`] ?? 0);

export const PortfolioCard: React.FC<PortfolioCardProps> = ({
  assets,
  prices,
  activeBase,
  demoMode,
  connected,
  error,
  onConnect,
}) => {
  const t = useTheme();

  const entries = Object.entries(assets)
    .filter(([, v]) => Number.isFinite(v) && v !== 0)
    .sort((a, b) => {
      if (a[0] === 'USDT') return -1;
      if (b[0] === 'USDT') return 1;
      if (a[0] === activeBase) return -1;
      if (b[0] === activeBase) return 1;
      return valueOf(b[1], b[0], prices) - valueOf(a[1], a[0], prices);
    });
  const totalValue = entries.reduce((sum, [b, v]) => sum + valueOf(v, b, prices), 0);
  const known = demoMode || connected;
  const locked = !demoMode && !!connected;

  return (
    <Card
      title={demoMode ? 'Demo Portfolio' : 'Portfolio'}
      right={
        <View style={styles.badges}>
          {demoMode && <StatusBadge label="PAPER" tone="warning" dot />}
          {connected && !demoMode && (
            <StatusBadge label={error ? 'STALE' : 'API CONNECTED'} tone={error ? 'warning' : 'success'} dot />
          )}
          {!known && (
            <Pressable onPress={onConnect} hitSlop={8}>
              <StatusBadge label={error ? 'API ERROR · RETRY' : 'CONNECT API'} tone={error ? 'danger' : 'info'} />
            </Pressable>
          )}
        </View>
      }
    >
      <View style={styles.valueRow}>
        <View>
          <Text style={[styles.valueLabel, { color: t.colors.text.tertiary }]}>Portfolio Value</Text>
          <Text style={[styles.value, { color: t.colors.text.primary }]}>
            {known ? `${formatUsdt(totalValue)} USDT` : '— USDT'}
          </Text>
        </View>
        <Text style={[styles.coinCount, { color: t.colors.text.secondary }]}>
          {known ? `${entries.length} coin${entries.length === 1 ? '' : 's'}` : ''}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: t.colors.border.subtle }]} />

      {known && entries.length === 0 && (
        <Text style={[styles.empty, { color: t.colors.text.tertiary }]}>
          {demoMode ? 'Demo wallet is empty — set an amount in Settings.' : 'No balances to show.'}
        </Text>
      )}

      {entries.map(([b, v]) => {
        const isActive = b === activeBase;
        const val = valueOf(v, b, prices);
        const hasPrice = b === 'USDT' || prices[`${b}USDT`] !== undefined;
        return (
          <View
            key={b}
            style={[
              styles.assetRow,
              {
                backgroundColor: isActive ? t.colors.feedback.infoDim : t.colors.bg.elevated,
                borderColor: isActive ? t.colors.brand.primary : 'transparent',
              },
            ]}
          >
            <View style={[styles.assetDot, { backgroundColor: isActive ? t.colors.brand.primary : t.colors.border.strong }]} />
            <Text style={[styles.assetSym, { color: t.colors.text.primary }]}>
              {b}{b === 'USDT' ? '' : '/USDT'}
            </Text>
            <View style={styles.assetRight}>
              <Text style={[styles.assetAmt, { color: t.colors.text.primary }]}>
                {formatNumber(v, v >= 1000 ? 2 : 6)}
              </Text>
              <Text style={[styles.assetVal, { color: t.colors.text.tertiary }]}>
                {hasPrice ? `≈ ${formatUsdt(val)}` : 'price n/a'}
              </Text>
            </View>
          </View>
        );
      })}

      {!known && (
        <Pressable
          onPress={onConnect}
          style={({ pressed }) => [
            styles.connectBtn,
            {
              backgroundColor: pressed ? t.colors.brand.primary : t.colors.feedback.infoDim,
              borderColor: t.colors.brand.primary,
            },
          ]}
        >
          {({ pressed }) => (
            <Text style={[styles.connectText, { color: pressed ? '#04111F' : t.colors.brand.primary }]}>
              Add Binance API keys
            </Text>
          )}
        </Pressable>
      )}

      {locked && entries.length > 0 ? (
        <Text style={[styles.lockedNote, { color: t.colors.text.tertiary }]}>
          Locked (in orders) balances are not shown above.
        </Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  valueLabel: { fontSize: 11, marginBottom: 4, fontWeight: '500' },
  value: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  coinCount: { fontSize: 11.5, fontWeight: '700', marginBottom: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  empty: { fontSize: 12.5, paddingVertical: 8, fontWeight: '500' },
  assetRow: {
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
  connectBtn: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  connectText: { fontSize: 13.5, fontWeight: '700' },
  lockedNote: { fontSize: 10.5, marginTop: 8 },
});
