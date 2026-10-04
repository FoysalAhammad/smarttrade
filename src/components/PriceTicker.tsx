import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { Ticker24h } from '../services/binance';
import { formatNumber, formatPrice, formatUsdt, timeLabel } from '../utils/format';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

interface PriceTickerProps {
  ticker: Ticker24h | null;
  updatedAt: number | null;
  loading: boolean;
  /** Base asset of the active market ('SUI'). */
  base: string;
  /** Opens the coin picker (tap the pair). */
  onPairPress?: () => void;
}

const timeAgo = (ts: number | null): string => {
  if (!ts) return '—';
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 5) return 'now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
};

export const PriceTicker: React.FC<PriceTickerProps> = ({ ticker, updatedAt, loading, base, onPairPress }) => {
  const t = useTheme();
  const [, setTick] = useState(0);
  const [scale] = useState(() => new Animated.Value(1));
  const lastPrice = useRef<number | null>(null);

  // Local 1s ticker so "updated Xs ago" stays fresh between polls.
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Subtle pulse on price change.
  useEffect(() => {
    if (!ticker) return;
    if (lastPrice.current !== null && lastPrice.current !== ticker.lastPrice) {
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.035,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
    lastPrice.current = ticker.lastPrice;
  }, [ticker, scale]);

  const up = (ticker?.priceChangePercent ?? 0) >= 0;
  const changeColor = up ? t.colors.feedback.success : t.colors.feedback.danger;
  const price = ticker?.lastPrice ?? 0;

  return (
    <Card>
      <View style={styles.topRow}>
        <Pressable onPress={onPairPress} style={styles.symbolRow} hitSlop={8}>
          <View style={[styles.pairBadge, { backgroundColor: t.colors.bg.elevated }]}>
            <Text style={[styles.pairText, { color: t.colors.text.primary }]}>{base}</Text>
          </View>
          <Text style={[styles.quote, { color: t.colors.text.tertiary }]}>/USDT</Text>
          <Text style={[styles.spot, { color: t.colors.text.tertiary }]}>· SPOT</Text>
          <Text style={[styles.quote, { color: t.colors.brand.primary, fontSize: 11 }]}>▾</Text>
        </Pressable>
        <Text style={[styles.updated, { color: t.colors.text.tertiary }]}>
          {loading && !ticker ? 'loading…' : `${timeAgo(updatedAt)} · ${updatedAt ? timeLabel(updatedAt) : ''}`}
        </Text>
      </View>

      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={[styles.price, { color: ticker ? t.colors.text.primary : t.colors.text.tertiary }]}>
          {ticker ? formatPrice(price) : '----.----'}
        </Text>
      </Animated.View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: t.colors.text.tertiary }]}>24h Change</Text>
          <Text numberOfLines={1} style={[styles.statValue, { color: changeColor }]}>
            {ticker
              ? `${up ? '▲' : '▼'} ${formatNumber(Math.abs(ticker.priceChange), 4)} (${formatNumber(
                  ticker.priceChangePercent,
                  2,
                )}%)`
              : '—'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: t.colors.text.tertiary }]}>24h High</Text>
          <Text style={[styles.statValue, { color: t.colors.text.primary }]}>
            {ticker ? formatPrice(ticker.highPrice) : '—'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: t.colors.text.tertiary }]}>24h Low</Text>
          <Text style={[styles.statValue, { color: t.colors.text.primary }]}>
            {ticker ? formatPrice(ticker.lowPrice) : '—'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: t.colors.text.tertiary }]}>24h Vol (USDT)</Text>
          <Text style={[styles.statValue, { color: t.colors.text.primary }]}>
            {ticker ? `${formatUsdt(ticker.quoteVolume, 0)}` : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <StatusBadge
          label={loading && !ticker ? 'SYNCING' : 'LIVE FEED · 3S'}
          tone={loading && !ticker ? 'warning' : 'info'}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pairBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pairText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  quote: { fontSize: 13, fontWeight: '600' },
  spot: { fontSize: 11, fontWeight: '600' },
  updated: { fontSize: 11 },
  price: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 6,
  },
  stat: { flex: 1, minWidth: 0 },
  statLabel: { fontSize: 10, marginBottom: 3, fontWeight: '500' },
  statValue: { fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  footerRow: { flexDirection: 'row', marginTop: 14 },
});
