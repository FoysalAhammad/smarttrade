import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { formatPrice, formatUsdt } from '../utils/format';
import { ModalShell } from './ModalShell';

interface EntryModalProps {
  /** Base asset code for amount labels. */
  base: string;
  visible: boolean;
  initialAmount: number;
  initialEntry: number;
  currentPrice: number | null;
  amountEditable?: boolean;
  onSave: (amount: number, entryPrice: number) => void;
  onClear?: () => void;
  onClose: () => void;
}

export const EntryModal: React.FC<EntryModalProps> = ({
  base,
  visible,
  initialAmount,
  initialEntry,
  currentPrice,
  amountEditable = true,
  onSave,
  onClear,
  onClose,
}) => {
  const t = useTheme();
  // Mounted fresh on every open → seed inputs from props.
  const [amountText, setAmountText] = useState(() =>
    initialAmount > 0 ? String(Number(initialAmount.toFixed(2))) : '',
  );
  const [entryText, setEntryText] = useState(() =>
    initialEntry > 0 ? initialEntry.toFixed(4) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const amount = Number.parseFloat(amountText.replace(/,/g, ''));
    const entry = Number.parseFloat(entryText.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (!Number.isFinite(entry) || entry <= 0) {
      setError('Entry price must be greater than 0.');
      return;
    }
    onSave(Number(amount.toFixed(1)), Number(entry.toFixed(4)));
  };

  return (
    <ModalShell
      visible={visible}
      title="Track Position"
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          {onClear && (
            <Pressable
              onPress={onClear}
              style={({ pressed }) => [
                styles.clearBtn,
                { borderColor: t.colors.feedback.danger, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.clearText, { color: t.colors.feedback.danger }]}>CLEAR</Text>
            </Pressable>
          )}
          <Pressable
            onPress={save}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: t.colors.brand.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.saveText, { color: '#04111F' }]}>SAVE POSITION</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={[styles.label, { color: t.colors.text.tertiary }]}>{base} amount held</Text>
      <TextInput
        value={amountText}
        onChangeText={setAmountText}
        editable={amountEditable}
        keyboardType="decimal-pad"
        placeholder="0.0"
        placeholderTextColor={t.colors.text.tertiary}
        style={[
          styles.input,
          {
            backgroundColor: t.colors.bg.input,
            borderColor: t.colors.border.subtle,
            color: amountEditable ? t.colors.text.primary : t.colors.text.tertiary,
          },
        ]}
        selectionColor={t.colors.brand.primary}
      />

      <Text style={[styles.label, { color: t.colors.text.tertiary }]}>Average entry price (USDT)</Text>
      <View style={styles.entryRow}>
        <TextInput
          value={entryText}
          onChangeText={setEntryText}
          keyboardType="decimal-pad"
          placeholder="0.0000"
          placeholderTextColor={t.colors.text.tertiary}
          style={[
            styles.input,
            { flex: 1, backgroundColor: t.colors.bg.input, borderColor: t.colors.border.subtle, color: t.colors.text.primary },
          ]}
          selectionColor={t.colors.brand.primary}
        />
        {currentPrice && (
          <Pressable
            onPress={() => setEntryText(currentPrice.toFixed(4))}
            style={({ pressed }) => [
              latestBtnStyle(t.colors.brand.primary),
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.latestText, { color: t.colors.brand.primary }]}>
              LIVE {formatPrice(currentPrice)}
            </Text>
          </Pressable>
        )}
      </View>

      {error && <Text style={[styles.error, { color: t.colors.feedback.danger }]}>{error}</Text>}

      <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
        P&L is calculated with your full 0.15% round-trip fee: cost basis carries the 0.075% buy
        fee and exit proceeds deduct the 0.075% sell fee.
        {currentPrice ? ` Current market: ${formatPrice(currentPrice)} (${formatUsdt(currentPrice)}/${base}).` : ''}
      </Text>
    </ModalShell>
  );
};

const latestBtnStyle = (color: string): ViewStyle => ({
  marginLeft: 10,
  borderWidth: 1,
  borderColor: color,
  borderRadius: 11,
  paddingHorizontal: 12,
  justifyContent: 'center',
});

const styles = StyleSheet.create({
  label: { fontSize: 11.5, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  entryRow: { flexDirection: 'row', alignItems: 'center' },
  latestText: { fontSize: 11.5, fontWeight: '800' },
  error: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 11.5, lineHeight: 16.5, marginTop: 4, marginBottom: 8 },
  footerRow: { flexDirection: 'row', gap: 10 },
  clearBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 13, fontWeight: '800' },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
