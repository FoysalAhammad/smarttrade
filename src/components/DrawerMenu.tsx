import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerContentComponentProps, DrawerContentScrollView } from 'expo-router/drawer';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTradeStore } from '../hooks/useTradeStore';
import { useTheme } from '../theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD_NO = Constants.expoConfig?.android?.versionCode ?? 1;

interface MenuItem {
  route: string;
  label: string;
  caption: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const ITEMS: MenuItem[] = [
  { route: 'index', label: 'Dashboard', caption: 'Chart · trade · targets', icon: 'view-dashboard-outline' },
  { route: 'account', label: 'Account', caption: 'Balance & daily P&L', icon: 'wallet-outline' },
  { route: 'history', label: 'History', caption: 'Completed trades', icon: 'history' },
];

export const DrawerMenu: React.FC<DrawerContentComponentProps> = (props) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useTradeStore();
  const demo = settings.mode === 'demo';

  const activeRoute = props.state.routeNames[props.state.index];

  const { closeDrawer } = props.navigation;

  const handleNavigate = (route: string) => {
    props.navigation.navigate(route);
    setTimeout(() => closeDrawer?.(), 50);
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flex: 1, backgroundColor: t.colors.bg.screen }}
      style={{ backgroundColor: t.colors.bg.screen }}
    >
      <LinearGradient
        colors={['#182946', '#101722']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 18 }]}
      >
        <View style={styles.heroRow}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            accessibilityLabel="Smart Trade logo"
          />
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Smart Trade</Text>
            <Text style={styles.heroSub}>Spot swing · SUI/USDT</Text>
          </View>
          <View
            style={[
              styles.modePill,
              {
                backgroundColor: demo ? t.colors.feedback.warningDim : 'rgba(14,203,129,0.16)',
                borderColor: demo ? t.colors.feedback.warning : t.colors.feedback.success,
              },
            ]}
          >
            <Text
              style={[
                styles.modeText,
                { color: demo ? t.colors.feedback.warning : t.colors.feedback.success },
              ]}
            >
              {demo ? 'DEMO' : 'LIVE'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.items}>
        {ITEMS.map((item) => {
          const active = activeRoute === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => handleNavigate(item.route)}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: active ? 'rgba(76,141,255,0.13)' : pressed ? t.colors.bg.elevated : 'transparent',
                  borderColor: active ? 'rgba(76,141,255,0.45)' : 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.itemIcon,
                  {
                    backgroundColor: active ? t.colors.brand.primary : t.colors.bg.elevated,
                    borderColor: active ? 'transparent' : t.colors.border.subtle,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={17}
                  color={active ? '#04111F' : t.colors.text.secondary}
                />
              </View>
              <View style={styles.itemTexts}>
                <Text
                  style={[
                    styles.itemLabel,
                    { color: active ? t.colors.brand.primary : t.colors.text.primary },
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={[styles.itemCaption, { color: t.colors.text.tertiary }]}>
                  {item.caption}
                </Text>
              </View>
              {active && <View style={[styles.activeBar, { backgroundColor: t.colors.brand.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.footer, { borderTopColor: t.colors.border.subtle }]}>
        <Text style={[styles.appName, { color: t.colors.text.secondary }]}>SMART TRADE</Text>
        <Text style={[styles.version, { color: t.colors.text.primary }]}>
          v{APP_VERSION} <Text style={{ color: t.colors.text.tertiary }}>· Build {BUILD_NO}</Text>
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
            <Text style={[styles.metaPillText, { color: t.colors.text.tertiary }]}>Android</Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
            <Text style={[styles.metaPillText, { color: t.colors.text.tertiary }]}>MIT License</Text>
          </View>
        </View>
        <Text style={[styles.footerText, { color: t.colors.text.tertiary }]}>
          Not financial advice
        </Text>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 13,
  },
  heroTexts: { flex: 1 },
  heroTitle: { color: '#EAECEF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  heroSub: { color: '#8B94A3', fontSize: 11, marginTop: 2, fontWeight: '500' },
  modePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  modeText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  items: { paddingHorizontal: 12, paddingTop: 16, gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTexts: { flex: 1 },
  itemLabel: { fontSize: 14.5, fontWeight: '700' },
  itemCaption: { fontSize: 10.5, marginTop: 1, fontWeight: '500' },
  activeBar: {
    width: 4,
    height: 22,
    borderRadius: 2,
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -11,
  },
  footer: {
    marginTop: 'auto',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 5,
    alignItems: 'flex-start',
  },
  appName: { fontSize: 10.5, fontWeight: '900', letterSpacing: 2.4 },
  version: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4, marginBottom: 3 },
  metaPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  metaPillText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },
  footerText: { fontSize: 10.5, fontWeight: '500' },
});
