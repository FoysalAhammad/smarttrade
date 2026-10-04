import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { useTheme } from '../theme';

interface ActionButtonsProps {
  onBuy: () => void;
  onSell: () => void;
  disabled?: boolean;
  buyBadge?: string;
  sellBadge?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onBuy,
  onSell,
  disabled,
  buyBadge,
  sellBadge,
}) => {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Action
        label="BUY"
        caption={buyBadge ?? 'Open / re-enter'}
        icon="arrow-up-bold"
        colors={[t.colors.feedback.success, '#0AA568'] as const}
        glow={t.colors.feedback.success}
        textColor="#04111F"
        onPress={onBuy}
        disabled={disabled}
      />
      <Action
        label="SELL"
        caption={sellBadge ?? 'Log & arm target'}
        icon="arrow-down-bold"
        colors={[t.colors.feedback.danger, '#D93A50'] as const}
        glow={t.colors.feedback.danger}
        textColor="#FFFFFF"
        onPress={onSell}
        disabled={disabled}
      />
    </View>
  );
};

const Action: React.FC<{
  label: string;
  caption: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  colors: readonly [string, string];
  glow: string;
  textColor: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ label, caption, icon, colors, glow, textColor, onPress, disabled }) => {
  return (
    <Pressable
      onPress={() => {
        Vibration.vibrate(10);
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrap,
        {
          shadowColor: glow,
          shadowOpacity: disabled ? 0 : pressed ? 0.25 : 0.5,
          shadowRadius: pressed ? 6 : 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: disabled ? 0 : 8,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          style={styles.sheen}
          pointerEvents="none"
        />
        <View style={styles.labelRow}>
          <MaterialCommunityIcons name={icon} size={20} color={textColor} />
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </View>
        <Text style={[styles.caption, { color: textColor }]} numberOfLines={1}>
          {caption}
        </Text>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  wrap: { flex: 1, borderRadius: 18, overflow: 'hidden' },
  gradient: { paddingVertical: 15, alignItems: 'center', borderRadius: 18, overflow: 'hidden' },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 46 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 19, fontWeight: '900', letterSpacing: 1.6 },
  caption: { fontSize: 10.5, fontWeight: '700', marginTop: 3, opacity: 0.9 },
});
