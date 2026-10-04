import React, { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme';

interface CardProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ title, right, children, style }) => {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.colors.bg.card,
          borderColor: t.colors.border.subtle,
        },
        t.shadows.card,
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(76,141,255,0.35)', 'rgba(76,141,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.accent, { backgroundColor: 'transparent' }]}
        pointerEvents="none"
      />
      {(title || right) && (
        <View style={styles.header}>
          {title ? (
            <Text style={[styles.title, { color: t.colors.text.secondary }]}>{title}</Text>
          ) : (
            <View />
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
