import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone = 'neutral', dot }) => {
  const t = useTheme();
  const toneStyles: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
    success: {
      bg: t.colors.feedback.successDim,
      fg: t.colors.feedback.success,
      border: t.colors.feedback.success,
    },
    danger: {
      bg: t.colors.feedback.dangerDim,
      fg: t.colors.feedback.danger,
      border: t.colors.feedback.danger,
    },
    warning: {
      bg: t.colors.feedback.warningDim,
      fg: t.colors.feedback.warning,
      border: t.colors.feedback.warning,
    },
    info: { bg: t.colors.feedback.infoDim, fg: t.colors.feedback.info, border: t.colors.feedback.info },
    neutral: { bg: t.colors.bg.elevated, fg: t.colors.text.secondary, border: t.colors.border.strong },
  };
  const s = toneStyles[tone];
  return (
    <View style={[styles.wrap, { backgroundColor: s.bg, borderColor: s.border, borderRadius: t.radius.full }]}>
      {dot && <View style={[styles.dot, { backgroundColor: s.fg }]} />}
      <Text style={[styles.label, { color: s.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.7 },
});
