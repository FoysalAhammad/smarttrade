import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import {
  calcPositionPnl,
  Position,
} from '../services/trading';
import { formatPct, formatPrice, formatSui, formatUsdt, timeLabel } from '../utils/format';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

/** Base asset code for amount labels. */
interface PositionCardProps {
  base: string;
  position: Position | null;
  price: number | null;
  feeRate: number;
  onEditEntry: () => void;
  onTrackFromBalance: () => void;
  hasBalance: boolean;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  base,
  position,
  price,
  feeRate,
  onEditEntry,
  onTrackFromBalance,
  hasBalance,
}) => {
  const t = useTheme();
  const active = !!position && position.amount > 0 && !!price;
  const pnl = active ? calcPositionPnl(position!, price!, feeRate) : null;
  const netColor =
    !pnl || pnl.netPnlUsdt > 0
      ? t.colors.feedback.success
      : pnl.netPnlUsdt < 0
        ? t.colors.feedback.danger
        : t.colors.text.secondary;

  return (
    <Card
      title="Open Position"
      right={
        active ? (
          <StatusBadge label={`ENTRY ${formatPrice(position!.entryPrice)}`} tone="info" />
        ) : (
          <StatusBadge label="FLAT" tone="neutral" />
        )
      }
    >
      {active && pnl ? (
        <>
          <View style={styles.mainRow}>
            <View>
              <Text style={[styles.pnlLabel, { color: t.colors.text.tertiary }]}>
                Net P&L (after 0.15% fee)
              </Text>
              <Text style={[styles.pnlValue, { color: netColor }]}>
                {pnl.netPnlSui >= 0 ? '+' : ''}
                {formatSui(pnl.netPnlSui, 3)} ${base}
              </Text>
              <Text style={[styles.pnlSub, { color: netColor }]}>
                {pnl.netPnlUsdt >= 0 ? '+' : ''}
                {formatUsdt(pnl.netPnlUsdt)} USDT ({formatPct(pnl.netPnlPct)})
              </Text>
            </View>
            <View style={styles.holdingWrap}>
              <Text style={[styles.holdingLabel, { color: t.colors.text.tertiary }]}>Holding</Text>
              <Text style={[styles.holding, { color: t.colors.text.primary }]}>
                {formatSui(position!.amount, 1)} ${base}
              </Text>
              <Text style={[styles.holdingUsdt, { color: t.colors.text.secondary }]}>
                ≈ {formatUsdt(pnl.grossValue)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: t.colors.border.subtle }]} />

          <View style={styles.metaRow}>
            <Meta label="Cost basis (fee incl.)" value={`${formatUsdt(pnl.costUsdt)} USDT`} />
            <Meta label="Exit proceeds (net)" value={`${formatUsdt(pnl.exitProceedsUsdt)} USDT`} />
          </View>
          <View style={styles.metaRow}>
            <Meta label="Est. round-trip fees" value={`${formatUsdt(pnl.estFeesUsdt)} USDT`} />
            <Meta label="Gross P&L" value={`${formatUsdt(pnl.grossPnlUsdt)} USDT`} />
          </View>

          <Pressable
            onPress={onEditEntry}
            style={({ pressed }) => [styles.editBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.editText, { color: t.colors.brand.primary }]}>
              Edit entry price · updated {timeLabel(position!.updatedAt)}
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: t.colors.bg.elevated }]}>
            <MaterialCommunityIcons name="chart-line-variant" size={22} color={t.colors.brand.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: t.colors.text.secondary }]}>
            No tracked position
          </Text>
          <Text style={[styles.emptyText, { color: t.colors.text.tertiary }]}>
            Tap BUY to open a swing position, or track your existing exchange balance here.
          </Text>
          {hasBalance && (
            <Pressable
              onPress={onTrackFromBalance}
              style={({ pressed }) => [
                styles.trackBtn,
                {
                  borderColor: t.colors.brand.primary,
                  backgroundColor: pressed ? t.colors.brand.primary : 'transparent',
                },
              ]}
            >
              {({ pressed }) => (
                <Text
                  style={[
                    styles.trackText,
                    { color: pressed ? '#04111F' : t.colors.brand.primary },
                  ]}
                >
                  Track balance as position
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
};

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const t = useTheme();
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaLabel, { color: t.colors.text.tertiary }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: t.colors.text.secondary }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pnlLabel: { fontSize: 11, marginBottom: 5, fontWeight: '500' },
  pnlValue: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  pnlSub: { fontSize: 13, marginTop: 3, fontWeight: '600' },
  holdingWrap: { alignItems: 'flex-end' },
  holdingLabel: { fontSize: 11, marginBottom: 5 },
  holding: { fontSize: 16, fontWeight: '700' },
  holdingUsdt: { fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  meta: { flex: 1 },
  metaLabel: { fontSize: 10.5, marginBottom: 2 },
  metaValue: { fontSize: 12.5, fontWeight: '600' },
  editBtn: { marginTop: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  editText: { fontSize: 11.5, fontWeight: '600' },
  emptyWrap: { alignItems: 'flex-start', paddingVertical: 2 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyText: { fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  trackBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  trackText: { fontSize: 13, fontWeight: '700' },
});
