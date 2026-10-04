import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import {
  CycleStatus,
  getCycleStatus,
  getTargetProgress,
  projectNetGain,
  SwingCycle,
} from '../services/trading';
import { formatPrice, formatPct, formatSui, timeLabel } from '../utils/format';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { StatusBadge, BadgeTone } from './StatusBadge';

interface ReentryPanelProps {
  /** Base asset code for amount labels. */
  base: string;
  cycle: SwingCycle;
  price: number | null;
  feeRate: number;
  onCancel: () => void;
  /** Opens the trade sheet that completes this cycle (buy for method 1, sell for method 2). */
  onPrimaryAction: () => void;
}

const STATUS_META: Record<CycleStatus, { label: string; tone: BadgeTone; hintDown: string; hintUp: string }> = {
  waiting: {
    label: 'WAITING',
    tone: 'info',
    hintDown: 'Price must fall to the re-entry target.',
    hintUp: 'Price must rise to the target sell price.',
  },
  zone: {
    label: 'TARGET ZONE',
    tone: 'warning',
    hintDown: 'Approaching the re-entry price — get ready to buy back.',
    hintUp: 'Approaching the target sell price — get ready to sell.',
  },
  hit: {
    label: 'TARGET REACHED',
    tone: 'success',
    hintDown: 'Re-buy now to lock the net coin gain.',
    hintUp: 'Sell now to lock the net profit.',
  },
};

export const ReentryPanel: React.FC<ReentryPanelProps> = ({
  base,
  cycle,
  price,
  feeRate,
  onCancel,
  onPrimaryAction,
}) => {
  const t = useTheme();
  const isUp = cycle.method === 'buy_first';

  const status: CycleStatus = price ? getCycleStatus(price, cycle.targetPrice, cycle.method) : 'waiting';
  const meta = STATUS_META[status];
  const hint = isUp ? meta.hintUp : meta.hintDown;

  const progress = price ? getTargetProgress(cycle, price, feeRate) : 0;
  const projected = price ? projectNetGain(cycle, price, feeRate) : 0;
  const deltaPct =
    cycle.baselinePrice > 0 ? ((cycle.targetPrice - cycle.baselinePrice) / cycle.baselinePrice) * 100 : 0;

  const fillColor =
    status === 'hit'
      ? t.colors.feedback.success
      : status === 'zone'
        ? t.colors.feedback.warning
        : t.colors.brand.primary;

  const panelTitle = isUp ? 'Buy → Target-Sell Cycle' : 'Sell → Re-entry Cycle';
  const baselineLabel = isUp ? 'Bought @' : 'Sold @';
  const targetLabel = isUp ? 'Target sell price' : 'Re-entry target price';
  const comparison = isUp ? '≥' : '≤';
  const primaryLabel = isUp ? 'SELL AT TARGET' : 'RE-BUY AT MARKET';

  return (
    <Card
      title={panelTitle}
      right={<StatusBadge label={meta.label} tone={meta.tone} dot={status !== 'waiting'} />}
      style={status === 'hit' ? { borderColor: t.colors.feedback.success, borderWidth: 1.5 } : undefined}
    >
      <View style={styles.baselineRow}>
        <Baseline label={baselineLabel} value={formatPrice(cycle.baselinePrice)} color={isUp ? t.colors.feedback.success : t.colors.feedback.danger} />
        <Baseline label="Amount" value={`${formatSui(cycle.baselineAmount, 1)} ${base}`} />
        <Baseline label="Target net" value={`+${formatSui(cycle.targetGain, 1)} ${base}`} color={t.colors.feedback.success} />
      </View>

      <View style={[styles.targetBox, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
        <View style={styles.targetLeft}>
          <Text style={[styles.targetLabel, { color: t.colors.text.tertiary }]}>{targetLabel}</Text>
          <Text style={[styles.targetValue, { color: t.colors.feedback.success }]}>
            {comparison} {formatPrice(cycle.targetPrice)}
          </Text>
          <Text style={[styles.targetDrop, { color: t.colors.text.secondary }]}>
            needs {formatPct(deltaPct)} from baseline · fees {((feeRate * 2) * 100).toFixed(3)}% deducted
          </Text>
        </View>
        <View style={styles.targetRight}>
          <Text style={[styles.currentLabel, { color: t.colors.text.tertiary }]}>Live price</Text>
          <Text
            style={[
              styles.currentValue,
              {
                color: price
                  ? getCycleStatus(price, cycle.targetPrice, cycle.method) === 'hit'
                    ? t.colors.feedback.success
                    : t.colors.text.primary
                  : t.colors.text.tertiary,
              },
            ]}
          >
            {price ? formatPrice(price) : '----'}
          </Text>
        </View>
      </View>

      <View style={styles.progressHead}>
        <Text style={[styles.progressLabel, { color: t.colors.text.secondary }]}>Progress to net target</Text>
        <Text style={[styles.progressPct, { color: fillColor }]}>{Math.round(progress * 100)}%</Text>
      </View>
      <ProgressBar progress={progress} from={t.colors.brand.primary} to={fillColor} />

      <Text style={[styles.projected, { color: t.colors.text.secondary }]}>
        {isUp ? 'Exit now → ' : 'Re-buy now → '}
        <Text style={{ color: projected >= 0 ? t.colors.feedback.success : t.colors.feedback.danger }}>
          {projected >= 0 ? '+' : ''}
          {formatSui(projected, 3)} ${base}
        </Text>{' '}
        net vs baseline
      </Text>
      <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>{hint}</Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: t.colors.border.strong, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.secondaryText, { color: t.colors.text.secondary }]}>Cancel cycle</Text>
        </Pressable>
        <Pressable
          onPress={onPrimaryAction}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: status === 'hit' ? t.colors.feedback.success : t.colors.bg.elevated,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.primaryText,
              { color: status === 'hit' ? '#04111F' : t.colors.text.primary },
            ]}
          >
            {primaryLabel}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.started, { color: t.colors.text.tertiary }]}>
        Cycle opened {timeLabel(cycle.startedAt)} · {cycle.method === 'buy_first' ? 'Method 2 · buy first' : 'Method 1 · sell first'}
      </Text>
    </Card>
  );
};

const Baseline: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => {
  const t = useTheme();
  return (
    <View style={styles.baseline}>
      <Text style={[styles.baselineLabel, { color: t.colors.text.tertiary }]}>{label}</Text>
      <Text style={[styles.baselineValue, { color: color ?? t.colors.text.primary }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  baselineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
  baseline: { flex: 1 },
  baselineLabel: { fontSize: 10.5, marginBottom: 3 },
  baselineValue: { fontSize: 15, fontWeight: '700' },
  targetBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 13,
  },
  targetLeft: { flex: 1, paddingRight: 10 },
  targetRight: { alignItems: 'flex-end' },
  targetLabel: { fontSize: 10.5, marginBottom: 4 },
  targetValue: { fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  targetDrop: { fontSize: 10.5, marginTop: 4 },
  currentLabel: { fontSize: 10.5, marginBottom: 4 },
  currentValue: { fontSize: 17, fontWeight: '700' },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 7,
  },
  progressLabel: { fontSize: 12, fontWeight: '600' },
  progressPct: { fontSize: 15, fontWeight: '800' },
  projected: { fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  hint: { fontSize: 11.5, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    flex: 1.6,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0.4 },
  started: { fontSize: 10.5, marginTop: 10, textAlign: 'center' },
});
