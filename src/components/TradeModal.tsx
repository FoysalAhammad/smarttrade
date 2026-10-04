import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import {
  amountStep,
  buyCostUsdt,
  buyNetSui,
  MIN_NOTIONAL_USDT,
  sellProceeds,
  SwingCycle,
  TradingMethod,
} from '../services/trading';
import { formatPrice, formatSui, formatUsdt, roundToStep } from '../utils/format';
import { ModalShell } from './ModalShell';
import { StatusBadge } from './StatusBadge';

export type TradeMode = 'buy' | 'sell';

interface TradeModalProps {
  visible: boolean;
  mode: TradeMode;
  price: number | null;
  feeRate: number;
  method: TradingMethod;
  /** Base asset code ('SUI') of the active market. */
  base: string;
  /** Full market symbol ('SUIUSDT') — drives lot size. */
  symbol: string;
  /** Real base-asset holdings the user can sell (demo wallet / exchange). */
  sellableSui: number;
  /** USDT available as buy budget (exchange or demo wallet). */
  buyBudgetUsdt: number;
  /** True when the budget is known (API keys or demo wallet) — limits enforced then. */
  budgetKnown: boolean;
  cycle: SwingCycle | null;
  onSubmit: (amount: number) => void;
  onClose: () => void;
}

const PRESETS = [0.25, 0.5, 0.75, 1];

export const TradeModal: React.FC<TradeModalProps> = ({
  visible,
  mode,
  price,
  feeRate,
  method,
  base,
  symbol,
  sellableSui,
  buyBudgetUsdt,
  budgetKnown,
  cycle,
  onSubmit,
  onClose,
}) => {
  const t = useTheme();

  const maxSui = useMemo(() => {
    if (!price || price <= 0) return 0;
    if (mode === 'sell') {
      const sellable = Math.max(sellableSui, 0);
      if (sellable > 0) return roundToStep(sellable, amountStep(symbol, price));
      // No known balance → journal mode only when nothing is connected.
      return budgetKnown ? 0 : Infinity;
    }
    // Buy: without a known budget → journal mode (unlimited).
    const fromBudget = budgetKnown ? buyNetSui(buyBudgetUsdt, price, feeRate) : Infinity;
    if (cycle && cycle.method === 'sell_first') {
      // Suggested full re-entry uses the baseline sell proceeds.
      const suggested = buyNetSui(
        sellProceeds(cycle.baselineAmount, cycle.baselinePrice, feeRate),
        price,
        feeRate,
      );
      const capped = Math.min(suggested, fromBudget);
      return Number.isFinite(capped) ? roundToStep(capped, amountStep(symbol, price)) : roundToStep(suggested, amountStep(symbol, price));
    }
    return Number.isFinite(fromBudget) ? roundToStep(fromBudget, amountStep(symbol, price)) : Infinity;
  }, [mode, price, sellableSui, buyBudgetUsdt, budgetKnown, cycle, feeRate, symbol]);

  const unlimited = !Number.isFinite(maxSui);
  // Balance caps matter once a budget is known; sells are capped by the
  // tracked position/wallet amount whenever one exists.
  const enforceMax = !unlimited && (mode === 'sell' || budgetKnown);

  // Default amount: full re-entry proceeds (m1), the baseline slice (m2
  // take-profit) or the whole available max otherwise.
  const [text, setText] = useState(() => {
    let def = maxSui;
    if (mode === 'sell' && cycle?.method === 'buy_first' && Number.isFinite(maxSui)) {
      def = Math.min(cycle.baselineAmount, maxSui);
    }
    if (mode === 'sell' && cycle?.method === 'buy_first' && unlimited) {
      def = cycle.baselineAmount;
    }
    return Number.isFinite(def) && def > 0 ? def.toFixed(1) : '';
  });

  const amount = Number.parseFloat(text.replace(/,/g, ''));
  const validAmount = Number.isFinite(amount) && amount > 0;
  const valueUsdt = validAmount && price ? amount * price : 0;
  const feeUsdt = valueUsdt * feeRate;
  const withinMax = validAmount && (!enforceMax || amount <= maxSui + 1e-9);
  const notionalOk = validAmount && valueUsdt >= MIN_NOTIONAL_USDT;
  const canSubmit = validAmount && withinMax && notionalOk && !!price;

  const applyPreset = (fraction: number) => {
    if (unlimited) return;
    const next = roundToStep(maxSui * fraction, amountStep(symbol, price ?? 0));
    setText(next > 0 ? next.toFixed(1) : '');
  };

  const secured = (() => {
    if (!validAmount || !price || !cycle) return null;
    if (mode === 'buy' && cycle.method === 'sell_first') {
      const delta = amount - cycle.baselineAmount;
      return {
        label: 'Secured vs baseline',
        value: `${delta >= 0 ? '+' : ''}${formatSui(delta, 3)} ${base}`,
        positive: delta >= 0,
      };
    }
    if (mode === 'sell' && cycle.method === 'buy_first') {
      const usdt =
        sellProceeds(amount, price, feeRate) -
        buyCostUsdt(cycle.baselineAmount, cycle.baselinePrice, feeRate);
      return {
        label: 'Secured vs baseline',
        value: `${usdt >= 0 ? '+' : ''}${formatUsdt(usdt)} USDT`,
        positive: usdt >= 0,
      };
    }
    return null;
  })();

  const headline =
    mode === 'buy'
      ? cycle?.method === 'sell_first'
        ? 'Re-enter position'
        : method === 'buy_first'
          ? 'Buy & set target sell'
          : 'Open long position'
      : cycle?.method === 'buy_first'
        ? 'Sell & take profit'
        : method === 'sell_first'
          ? 'Sell & arm re-entry'
          : 'Sell position';

  return (
    <ModalShell
      visible={visible}
      title={mode === 'buy' ? `BUY ${base}` : `SELL ${base}`}
      onClose={onClose}
      footer={
        <Pressable
          disabled={!canSubmit}
          onPress={() => onSubmit(Math.floor(amount / amountStep(symbol, price ?? 0)) * amountStep(symbol, price ?? 0))}
          style={({ pressed }) => [
            styles.confirm,
            {
              backgroundColor: canSubmit
                ? mode === 'buy'
                  ? t.colors.feedback.success
                  : t.colors.feedback.danger
                : t.colors.bg.elevated,
              opacity: pressed && canSubmit ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.confirmText,
              {
                color: canSubmit
                  ? mode === 'buy'
                    ? '#04111F'
                    : '#FFFFFF'
                  : t.colors.text.tertiary,
              },
            ]}
          >
            {canSubmit
              ? `CONFIRM ${mode === 'buy' ? 'BUY' : 'SELL'} · ${formatSui(amount, 1)} ${base}`
              : !withinMax && validAmount
                ? 'AMOUNT EXCEEDS AVAILABLE'
                : 'ENTER AMOUNT'}
          </Text>
        </Pressable>
      }
    >
      <Text style={[styles.headline, { color: t.colors.text.secondary }]}>{headline}</Text>

      <View style={[styles.inputBox, { backgroundColor: t.colors.bg.input, borderColor: t.colors.border.subtle }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder="0.0"
          placeholderTextColor={t.colors.text.tertiary}
          style={[styles.input, { color: t.colors.text.primary }]}
          selectionColor={t.colors.brand.primary}
        />
        <Text style={[styles.inputSuffix, { color: t.colors.text.secondary }]}>{base}</Text>
      </View>

      <View style={styles.presets}>
        {PRESETS.map((f) => {
          const active =
            !unlimited && maxSui > 0 && Math.abs(amount - roundToStep(maxSui * f, amountStep(symbol, price ?? 0))) < 1e-9;
          return (
            <Pressable
              key={f}
              onPress={() => applyPreset(f)}
              disabled={unlimited}
              style={({ pressed }) => [
                styles.preset,
                {
                  backgroundColor: active ? t.colors.feedback.infoDim : t.colors.bg.elevated,
                  borderColor: active ? t.colors.brand.primary : t.colors.border.subtle,
                  opacity: unlimited ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  { color: active ? t.colors.brand.primary : t.colors.text.secondary },
                ]}
              >
                {f === 1 ? 'MAX' : `${f * 100}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.maxHint, { color: t.colors.text.tertiary }]}>
        {unlimited
          ? 'Journal mode — enter any amount (connect API keys or use demo mode for balance limits)'
          : `Available max: ${formatSui(maxSui, 1)} ${base}${
              mode === 'buy'
                ? budgetKnown
                  ? ` · budget ${formatUsdt(buyBudgetUsdt)} USDT`
                  : ' · journal mode (no balance check)'
                : ''
            }`}
      </Text>

      <View style={[styles.breakdown, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
        <Row label="Market price" value={price ? formatPrice(price) : '—'} />
        <Row label="Trade value" value={`${formatUsdt(valueUsdt)} USDT`} />
        <Row
          label={`Fee @ ${(feeRate * 100).toFixed(3)}%`}
          value={`- ${formatUsdt(feeUsdt)} USDT`}
          danger
        />
        {mode === 'buy' ? (
          <Row label={`Net ${base} received (after fee)`} value={`${formatSui(validAmount ? buyNetSui(valueUsdt, price ?? 0, feeRate) : 0, 2)} ${base}`} />
        ) : (
          <Row label="Net USDT proceeds (after fee)" value={`${formatUsdt(validAmount && price ? sellProceeds(amount, price, feeRate) : 0)} USDT`} />
        )}
        {secured && (
          <Row label={secured.label} value={secured.value} accent={secured.positive} />
        )}
      </View>

      {cycle && ((mode === 'buy' && cycle.method === 'sell_first') || (mode === 'sell' && cycle.method === 'buy_first')) && (
        <View style={styles.cycleNote}>
          <StatusBadge label={`BASELINE ${formatPrice(cycle.baselinePrice)}`} tone="info" />
          <Text style={[styles.cycleText, { color: t.colors.text.tertiary }]}>
            {cycle.method === 'sell_first'
              ? 'Re-buying at this price completes the swing cycle and locks the net coin gain.'
              : 'Selling here completes the swing cycle and locks the fee-adjusted profit.'}
          </Text>
        </View>
      )}

      {!notionalOk && validAmount ? (
        <Text style={[styles.warn, { color: t.colors.feedback.warning }]}>
          Below Binance min notional of {MIN_NOTIONAL_USDT} USDT.
        </Text>
      ) : null}
    </ModalShell>
  );
};

const Row: React.FC<{ label: string; value: string; danger?: boolean; accent?: boolean }> = ({
  label,
  value,
  danger,
  accent,
}) => {
  const t = useTheme();
  const color = danger
    ? t.colors.feedback.danger
    : accent
      ? t.colors.feedback.success
      : t.colors.text.primary;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.colors.text.tertiary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  headline: { fontSize: 13, marginBottom: 10, fontWeight: '500' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 64,
  },
  input: { flex: 1, fontSize: 30, fontWeight: '700', paddingVertical: 0 },
  inputSuffix: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
  presets: { flexDirection: 'row', gap: 8, marginTop: 12 },
  preset: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetText: { fontSize: 12.5, fontWeight: '700' },
  maxHint: { fontSize: 11.5, marginTop: 9 },
  breakdown: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 13,
    marginTop: 14,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 12.5 },
  rowValue: { fontSize: 13, fontWeight: '700' },
  cycleNote: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 13 },
  cycleText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  warn: { fontSize: 12, marginTop: 10, fontWeight: '600' },
  confirm: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmText: { fontSize: 14.5, fontWeight: '800', letterSpacing: 0.4 },
});
