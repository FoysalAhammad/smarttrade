import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export type BannerTone = 'success' | 'warning' | 'danger' | 'info';

export interface BannerMessage {
  id: number;
  title: string;
  body: string;
  tone: BannerTone;
}

interface AlertBannerProps {
  message: BannerMessage | null;
  onDismiss: () => void;
}

const TONE_COLORS: Record<BannerTone, { bg: string; border: string; text: string }> = {
  success: { bg: '#06382380', border: '#0ECB81', text: '#0ECB81' },
  warning: { bg: '#3A2E0580', border: '#F0B90B', text: '#F0B90B' },
  danger: { bg: '#3D101780', border: '#F6465D', text: '#F6465D' },
  info: { bg: '#0B244780', border: '#4C8DFF', text: '#4C8DFF' },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({ message, onDismiss }) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [translateY] = useState(() => new Animated.Value(-120));
  const [opacity] = useState(() => new Animated.Value(0));

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDismiss());
  };

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    Vibration.vibrate(message.tone === 'success' ? [0, 90, 70, 90] : 70);

    const timer = setTimeout(() => {
      hide();
    }, 4500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message) return null;
  const tone = TONE_COLORS[message.tone];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 6, transform: [{ translateY }], opacity },
      ]}
    >
      <Pressable
        onPress={hide}
        style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.border }]}
      >
        <View style={[styles.stripe, { backgroundColor: tone.border }]} />
        <View style={styles.content}>
          <Text style={[styles.title, { color: tone.text }]}>{message.title}</Text>
          <Text style={[styles.body, { color: t.colors.text.primary }]}>{message.body}</Text>
        </View>
        <Text style={[styles.close, { color: t.colors.text.tertiary }]}>✕</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 50 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 11,
    paddingRight: 12,
    overflow: 'hidden',
  },
  stripe: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 10 },
  content: { flex: 1 },
  title: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  body: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  close: { fontSize: 12, marginLeft: 8, fontWeight: '600' },
});
