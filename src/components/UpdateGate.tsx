import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTradeStore } from '../hooks/useTradeStore';
import { checkForUpdate, downloadAndInstall, UpdateInfo } from '../services/update';
import { useTheme } from '../theme';

/**
 * Update gate — shows a full-screen prompt whenever a newer GitHub release
 * exists. Hidden while a position/cycle is open (never interrupt a live
 * trade); re-appears on every launch until the user updates ("Later" only
 * dismisses for the current session).
 */
export const UpdateGate: React.FC<{ children: ReactNode }> = ({ children }) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { position, cycle } = useTradeStore();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    checkForUpdate()
      .then((info) => {
        if (alive) setUpdate(info);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const tradeOpen = !!position || !!cycle;
  if (!update || dismissed || tradeOpen) return <>{children}</>;

  const startUpdate = () => {
    setError(null);
    setProgress(0);
    downloadAndInstall(update.apkUrl, setProgress)
      .then(() => {
        setProgress(100);
        /* Android system installer takes over from here */
      })
      .catch((e: unknown) => {
        setProgress(null);
        setError(e instanceof Error ? e.message : 'Update failed — try again');
      });
  };

  const busy = progress !== null;

  return (
    <View style={{ flex: 1 }}>
      {children}
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.82)', paddingTop: insets.top }]}>
        <View style={[styles.card, { backgroundColor: t.colors.bg.card, borderColor: t.colors.border.subtle }]}>
          <LinearGradient
            colors={['rgba(76,141,255,0.22)', 'rgba(11,14,17,0)']}
            style={styles.hero}
          >
            <View style={[styles.iconTile, { backgroundColor: t.colors.brand.primary }]}>
              <MaterialCommunityIcons name="update" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Update available</Text>
            <Text style={styles.version}>v{update.version}</Text>
          </LinearGradient>

          <Text style={[styles.headline, { color: t.colors.text.secondary }]}>
            {update.title}
          </Text>

          {!!update.notes && (
            <View style={[styles.notesBox, { backgroundColor: t.colors.bg.elevated, borderColor: t.colors.border.subtle }]}>
              <Text numberOfLines={7} style={[styles.notes, { color: t.colors.text.secondary }]}>
                {update.notes}
              </Text>
            </View>
          )}

          {progress !== null && (
            <View style={styles.progressWrap}>
              <View style={[styles.progressTrack, { backgroundColor: t.colors.bg.elevated }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(3, progress)}%`, backgroundColor: t.colors.brand.primary },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: t.colors.text.tertiary }]}>
                {progress >= 100 ? 'Installer opening…' : `Downloading… ${progress}%`}
              </Text>
            </View>
          )}

          {!!error && <Text style={[styles.error, { color: t.colors.feedback.danger }]}>{error}</Text>}

          <Pressable
            onPress={startUpdate}
            disabled={busy}
            style={({ pressed }) => [styles.updateWrap, { opacity: busy ? 0.7 : pressed ? 0.88 : 1 }]}
          >
            <LinearGradient
              colors={[t.colors.feedback.success, '#0AA568']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.updateBtn}
            >
              {busy && progress !== null && progress < 100 ? (
                <ActivityIndicator color="#04111F" />
              ) : (
                <MaterialCommunityIcons name="download" size={19} color="#04111F" />
              )}
              <Text style={styles.updateText}>
                {busy ? (progress !== null && progress < 100 ? `${progress}%` : 'Preparing…') : 'UPDATE & INSTALL'}
              </Text>
            </LinearGradient>
          </Pressable>

          {!busy && (
            <Pressable
              onPress={() => setDismissed(true)}
              style={({ pressed }) => [styles.later, { borderColor: t.colors.border.strong, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.laterText, { color: t.colors.text.tertiary }]}>
                Later — remind me next launch
              </Text>
            </Pressable>
          )}

          <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
            Your current data, wallet and history stay untouched after the update.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 90,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  hero: { paddingTop: 24, paddingBottom: 16, paddingHorizontal: 4, gap: 6 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { color: '#EAECEF', fontSize: 21, fontWeight: '800' },
  version: { color: '#00D9FF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  headline: { fontSize: 13.5, fontWeight: '600', marginBottom: 10, paddingHorizontal: 4 },
  notesBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 14,
    maxHeight: 140,
  },
  notes: { fontSize: 12.5, lineHeight: 18 },
  progressWrap: { gap: 6, marginBottom: 12 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressText: { fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  error: { fontSize: 12, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  updateWrap: { borderRadius: 15, overflow: 'hidden' },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    borderRadius: 15,
  },
  updateText: { color: '#04111F', fontSize: 15, fontWeight: '900', letterSpacing: 0.6 },
  later: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: 'center',
  },
  laterText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 10.5, textAlign: 'center', marginTop: 12, lineHeight: 15 },
});
