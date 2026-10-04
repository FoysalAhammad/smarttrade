import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTradeStore } from '../hooks/useTradeStore';
import { useTheme } from '../theme';

/** Host this file (playstore/PRIVACY_POLICY.html) and update the URL before Play submission. */
export const PRIVACY_POLICY_URL = 'https://foysalahammad.github.io/smarttrade/privacy-policy.html';

const POLICY: { title: string; body: string[] }[] = [
  {
    title: '1 · Overview',
    body: [
      'Smart Trade ("the app") is a personal crypto swing-trading journal for spot markets (USDT pairs). This policy explains what the app does with your information. By tapping "I Agree" you accept this policy.',
    ],
  },
  {
    title: '2 · Data we collect',
    body: [
      '• No personal data. The app has no accounts, no servers, no analytics and no trackers.',
      '• Advertising — Google AdMob: shown only at a few in-app moments (applying a strategy script, changing the trading method, copying your IP, saving an API key, enabling demo mode). AdMob receives your advertising ID and coarse device information to serve ads; you can reset the advertising ID in Android Settings → Privacy → Ads. It receives nothing else.',
      '• Binance API key & secret: entered by you, stored ONLY on this device inside the operating system keystore (Android Keystore / iOS Keychain) with strong encryption. They are never sent anywhere except directly to Binance APIs.',
      '• Demo wallet, positions, trade history and settings: stored only in local app storage on this device.',
      '• Market data (prices, candles): fetched anonymously from Binance public endpoints.',
    ],
  },
  {
    title: '3 · How your information is used',
    body: [
      '• API credentials are used solely to read your Binance spot balances/fees so the journal can display them.',
      '• The app never places orders on your behalf and never enables withdrawals.',
      '• Local data stays on the device; you can erase it at any time via Settings → Reset trade data or by uninstalling the app.',
    ],
  },
  {
    title: '4 · Sharing & disclosure',
    body: [
      '• We do not sell, rent or share any personal data — there is no backend to share it with.',
      '• The only third party is Google AdMob (ads only): it receives the advertising ID described above and nothing else.',
      '• Market data requests leave your device only as signed TLS traffic to the exchange you configured.',
    ],
  },
  {
    title: '5 · Security',
    body: [
      '• Credentials: OS-level keystore encryption (Keystore/Keychain).',
      '• Transport: TLS (HTTPS/WSS) to Binance only.',
      '• No data is transmitted to the developer.',
    ],
  },
  {
    title: '6 · Children & changes',
    body: [
      'The app is not directed at children under 13. This policy may be updated with new app versions; the effective date below always applies.',
    ],
  },
  {
    title: '7 · Contact',
    body: [
      'Questions? Contact the developer through the support channel listed on the app store listing, or open an issue in the project repository.',
    ],
  },
];

export const ConsentScreen: React.FC<{ onAgree: () => void }> = ({ onAgree }) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: t.colors.bg.screen, paddingTop: insets.top + 18 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['rgba(76,141,255,0.18)', 'rgba(11,14,17,0)']}
          style={styles.hero}
        >
          <View style={[styles.logo, { backgroundColor: t.colors.brand.primary }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Privacy & Data Policy</Text>
          <Text style={styles.subtitle}>Smart Trade · please read before continuing</Text>
        </LinearGradient>

        <View style={[styles.notice, { backgroundColor: t.colors.feedback.infoDim, borderColor: t.colors.brand.primary }]}>
          <MaterialCommunityIcons name="information-outline" size={17} color={t.colors.brand.primary} />
          <Text style={[styles.noticeText, { color: t.colors.text.primary }]}>
            Your keys never leave this device. No accounts, no trackers — only Google AdMob for the occasional ad.
          </Text>
        </View>

        {POLICY.map((sec) => (
          <View key={sec.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.colors.text.primary }]}>{sec.title}</Text>
            {sec.body.map((para) => (
              <Text key={para} style={[styles.para, { color: t.colors.text.secondary }]}>
                {para}
              </Text>
            ))}
          </View>
        ))}

        <Text style={[styles.meta, { color: t.colors.text.tertiary }]}>
          Effective date: 3 October 2026 · Version 1.0.0
        </Text>
        <Text selectable style={[styles.url, { color: t.colors.brand.primary }]}>
          {PRIVACY_POLICY_URL}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.colors.border.subtle, paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          onPress={onAgree}
          style={({ pressed }) => [styles.agreeWrap, { opacity: pressed ? 0.88 : 1 }]}
        >
          <LinearGradient
            colors={[t.colors.feedback.success, '#0AA568']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.agree}
          >
            <MaterialCommunityIcons name="check-decagram" size={19} color="#04111F" />
            <Text style={styles.agreeText}>I AGREE & CONTINUE</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={() => BackHandler.exitApp()}
          style={({ pressed }) => [styles.decline, { borderColor: t.colors.border.strong, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.declineText, { color: t.colors.text.tertiary }]}>Decline & exit</Text>
        </Pressable>
      </View>
    </View>
  );
};

/** Blocks the app until the first-launch privacy consent is accepted. */
export const ConsentGate: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, hydrated, updateSettings } = useTradeStore();
  if (!hydrated) return null;
  if (settings.privacyAccepted) return <>{children}</>;
  return <ConsentScreen onAgree={() => updateSettings({ privacyAccepted: true })} />;
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 28 },
  hero: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 14,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { color: '#EAECEF', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#A7B0BA', fontSize: 12.5, fontWeight: '500' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 6 },
  para: { fontSize: 13, lineHeight: 20, marginBottom: 5 },
  meta: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  url: { fontSize: 10.5, textAlign: 'center', marginTop: 4 },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 9,
    backgroundColor: 'rgba(11,14,17,0.6)',
  },
  agreeWrap: { borderRadius: 15, overflow: 'hidden' },
  agree: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 15,
  },
  agreeText: { color: '#04111F', fontSize: 15, fontWeight: '900', letterSpacing: 0.6 },
  decline: {
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineText: { fontSize: 13, fontWeight: '700' },
});
