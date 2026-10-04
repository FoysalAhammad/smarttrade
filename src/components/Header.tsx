import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { StatusBadge, BadgeTone } from './StatusBadge';

interface HeaderProps {
  /** Explicitly pass to show the feed badge; omit on non-market screens. */
  live?: boolean;
  error?: string | null;
  demo?: boolean;
  /** Opens the navigation drawer (hamburger, left side). */
  onMenu?: () => void;
  /** Shows the gear button when provided. */
  onSettings?: () => void;
  /** Overrides the subtitle line (defaults to spot/demo trading info). */
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  live,
  error,
  demo,
  onMenu,
  onSettings,
  subtitle,
}) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tone: BadgeTone = error ? 'danger' : live ? 'success' : 'neutral';
  const label = error ? 'FEED ERROR' : live ? 'LIVE' : 'CONNECTING';
  const sub =
    subtitle ?? `${demo ? 'Demo paper trading' : 'Spot'} · Fee 0.15% RT`;

  return (
    <LinearGradient
      colors={['rgba(76,141,255,0.10)', 'rgba(11,14,17,0)']}
      style={[styles.wrap, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.left}>
        {onMenu && (
          <Pressable
            onPress={onMenu}
            hitSlop={10}
            accessibilityLabel="Open menu"
            style={({ pressed }) => [
              styles.menuBtn,
              {
                backgroundColor: pressed ? t.colors.bg.elevated : t.colors.bg.card,
                borderColor: t.colors.border.subtle,
              },
            ]}
          >
            <Text style={[styles.menuGlyph, { color: t.colors.text.primary }]}>☰</Text>
          </Pressable>
        )}
        <View style={styles.titleCol}>
          <Text numberOfLines={1} style={[styles.title, { color: t.colors.text.primary }]}>
            Smart Trade
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.subtitle, { color: t.colors.text.tertiary }]}>
            {sub}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        {demo && <StatusBadge label="DEMO" tone="warning" dot />}
        {live !== undefined && <StatusBadge label={label} tone={tone} dot={live} />}
        {onSettings && (
          <Pressable
            onPress={onSettings}
            hitSlop={10}
            accessibilityLabel="Settings"
            style={({ pressed }) => [
              styles.gear,
              {
                backgroundColor: pressed ? t.colors.bg.elevated : t.colors.bg.card,
                borderColor: t.colors.border.subtle,
              },
            ]}
          >
            <Text style={[styles.gearText, { color: t.colors.text.secondary }]}>⚙</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35,42,51,0.9)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  titleCol: { flexShrink: 1, maxWidth: 200 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuGlyph: { fontSize: 17, fontWeight: '700', lineHeight: 20 },
  title: { fontSize: 15.5, fontWeight: '700' },
  subtitle: { fontSize: 11, marginTop: 1 },
  gear: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: { fontSize: 16 },
});
