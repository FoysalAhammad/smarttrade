import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '../theme';
import { maybeShowAd } from '../services/ads';
import { getTradeFee, testCredentials } from '../services/binance';
import {
  clearCredentials,
  clearDemoCredentials,
  loadCredentials,
  loadDemoCredentials,
  saveCredentials,
  saveDemoCredentials,
} from '../services/credentials';
import { getPublicIp } from '../services/ip';
import {
  AppMode,
  DEMO_START_SUI,
  DEMO_START_USDT,
  demoAsset,
  Settings,
  TradingMethod,
} from '../services/trading';
import { DEFAULT_STRATEGY, validateStrategy } from '../strategy/engine';
import { formatSui, formatUsdt } from '../utils/format';
import { ModalShell } from './ModalShell';
import { StatusBadge } from './StatusBadge';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onCredentialsChanged: () => void;
  hasCredentials: boolean;
  onResetAll: () => void;
  onResetDemo: () => void;
}

const METHOD_OPTIONS: {
  id: TradingMethod;
  title: string;
  desc: string;
  formula: string;
}[] = [
  {
    id: 'sell_first',
    title: 'Method 1 · Sell first',
    desc: 'Already hold SUI → sell at market → buy back lower on the dip.',
    formula: 'sell price − re-buy price = profit (extra coins)',
  },
  {
    id: 'buy_first',
    title: 'Method 2 · Buy first',
    desc: 'Buy at market → wait for the rise → sell higher.',
    formula: 'sell price − buy price = profit (USDT, fee deducted)',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  settings,
  onUpdateSettings,
  onCredentialsChanged,
  hasCredentials,
  onResetAll,
  onResetDemo,
}) => {
  const t = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [demoKey, setDemoKey] = useState('');
  const [demoSecret, setDemoSecret] = useState('');
  const [demoKeySet, setDemoKeySet] = useState(false);
  const [demoSuiText, setDemoSuiText] = useState(String(demoAsset(settings.demoWallet, 'SUI')));
  const [demoUsdtText, setDemoUsdtText] = useState(String(demoAsset(settings.demoWallet, 'USDT')));
  const [demoAmountMsg, setDemoAmountMsg] = useState<string | null>(null);
  const [apiMsg, setApiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [ipErr, setIpErr] = useState<string | null>(null);
  const [ipCopied, setIpCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [feeMsg, setFeeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fetchingFee, setFetchingFee] = useState(false);
  const [feeText, setFeeText] = useState((settings.feeRate * 100).toFixed(3));
  const [targetText, setTargetText] = useState(String(settings.targetGain));
  const [confirmReset, setConfirmReset] = useState(false);
  const [strategyText, setStrategyText] = useState(settings.strategyScript);
  const [strategyMsg, setStrategyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    loadDemoCredentials().then((c) => {
      if (alive) setDemoKeySet(!!(c && (c.apiKey || c.apiSecret)));
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchIp = useCallback(() => {
    getPublicIp()
      .then((value) => {
        setIp(value);
        setIpErr(null);
      })
      .catch((e: unknown) => {
        setIpErr(e instanceof Error ? e.message : 'IP detection failed');
      })
      .finally(() => {
        setIpLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchIp();
  }, [fetchIp]);

  const refreshIp = () => {
    setIpLoading(true);
    fetchIp();
  };

  const copyIp = () => {
    if (!ip) return;
    Clipboard.setStringAsync(ip).catch(() => {});
    setIpCopied(true);
    setTimeout(() => setIpCopied(false), 2000);
    maybeShowAd();
  };

  const applyAutoFee = async () => {
    const creds = await loadCredentials();
    if (!creds) {
      setFeeMsg({ ok: false, text: 'Connect a real Binance API key first.' });
      return;
    }
    setFetchingFee(true);
    setFeeMsg(null);
    try {
      const fees = await getTradeFee(creds);
      onUpdateSettings({ feeRate: fees.taker, feeSource: 'auto' });
      setFeeText((fees.taker * 100).toFixed(3));
      setFeeMsg({
        ok: true,
        text: `Auto fee from Binance · taker ${(fees.taker * 100).toFixed(3)}% · maker ${(
          fees.maker * 100
        ).toFixed(3)}%`,
      });
    } catch (e) {
      setFeeMsg({ ok: false, text: e instanceof Error ? e.message : 'Fee fetch failed' });
    } finally {
      setFetchingFee(false);
    }
  };

  const connect = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setResult({ ok: false, message: 'Enter both API key and secret.' });
      return;
    }
    setTesting(true);
    setResult(null);
    setApiMsg(null);
    try {
      // Validate first — only persist keys Binance actually accepts.
      const check = await testCredentials({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
      setResult(check);
      if (check.ok) {
        await saveCredentials(apiKey.trim(), apiSecret.trim());
        setApiKey('');
        setApiSecret('');
        onCredentialsChanged();
        maybeShowAd();
        // Best effort: pull the exact VIP fee for this account.
        applyAutoFee();
      } else {
        onCredentialsChanged();
      }
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    try {
      await clearCredentials();
      setResult(null);
      setApiKey('');
      setApiSecret('');
      setApiMsg({ ok: true, text: 'API keys removed from this device.' });
      onUpdateSettings({ feeSource: settings.feeSource === 'auto' ? 'default' : settings.feeSource });
      onCredentialsChanged();
    } catch (e) {
      setApiMsg({ ok: false, text: e instanceof Error ? e.message : 'Remove failed — try again.' });
    }
  };

  const applyFee = () => {
    const pct = Number.parseFloat(feeText.replace(/,/g, '.'));
    if (Number.isFinite(pct) && pct >= 0 && pct < 5) {
      onUpdateSettings({ feeRate: pct / 100, feeSource: 'manual' });
    } else {
      setFeeText((settings.feeRate * 100).toFixed(3));
    }
  };

  const applyTarget = () => {
    const v = Number.parseFloat(targetText.replace(/,/g, ''));
    if (Number.isFinite(v) && v > 0) onUpdateSettings({ targetGain: v });
    else setTargetText(String(settings.targetGain));
  };

  const applyStrategy = (text?: string) => {
    const value = (text ?? strategyText).trimEnd();
    onUpdateSettings({ strategyScript: value });
    const check = validateStrategy(value);
    if (check.ok) {
      setStrategyMsg({ ok: true, text: 'Valid — running live on the chart' });
      maybeShowAd();
    } else setStrategyMsg({ ok: false, text: check.message });
  };

  const resetStrategy = () => {
    setStrategyText(DEFAULT_STRATEGY);
    const check = validateStrategy(DEFAULT_STRATEGY);
    onUpdateSettings({ strategyScript: DEFAULT_STRATEGY });
    setStrategyMsg(check.ok ? { ok: true, text: 'Example restored' } : null);
  };

  const applyDemoCreds = (keyOverride?: string, secretOverride?: string) => {
    const key = (keyOverride ?? demoKey).trim();
    const secret = (secretOverride ?? demoSecret).trim();
    if (!key && !secret) return;
    saveDemoCredentials(key, secret)
      .then(() => setDemoKeySet(true))
      .catch(() => setApiMsg({ ok: false, text: 'SecureStore write failed.' }));
  };

  const applyDemoAmount = () => {
    const sui = Number.parseFloat(demoSuiText.replace(/,/g, ''));
    const usdt = Number.parseFloat(demoUsdtText.replace(/,/g, ''));
    if (!Number.isFinite(sui) || sui < 0 || !Number.isFinite(usdt) || usdt < 0) {
      setDemoAmountMsg('Enter valid amounts (0 or more).');
      return;
    }
    onUpdateSettings({ demoWallet: { ...settings.demoWallet, SUI: sui, USDT: usdt } });
    setDemoAmountMsg(`Demo wallet set — ${formatSui(sui, 2)} SUI · ${formatUsdt(usdt)} USDT`);
  };

  const resetDemoAmount = () => {
    onResetDemo();
    setDemoSuiText(String(DEMO_START_SUI));
    setDemoUsdtText(String(DEMO_START_USDT));
    setDemoAmountMsg(`Reset to default — ${DEMO_START_SUI} SUI · ${formatUsdt(DEMO_START_USDT)}`);
  };

  const removeDemoCreds = () => {
    clearDemoCredentials()
      .then(() => {
        setDemoKeySet(false);
        setDemoKey('');
        setDemoSecret('');
      })
      .catch(() => {});
  };

  // Persist edits even when the sheet is dismissed without blurring inputs.
  const close = () => {
    applyFee();
    applyTarget();
    if (strategyText !== settings.strategyScript) applyStrategy();
    // Only touch demo creds when there is input — never wipe a previously
    // saved key with an empty state snapshot.
    if (demoKey.trim() || demoSecret.trim()) applyDemoCreds();
    onClose();
  };

  const feeSourceLabel =
    settings.feeSource === 'auto'
      ? 'AUTO · BINANCE'
      : settings.feeSource === 'manual'
        ? 'MANUAL'
        : 'DEFAULT 0.075%';

  return (
    <ModalShell visible={visible} title="Settings" onClose={close}>
      <Text style={[styles.section, { color: t.colors.text.secondary }]}>Binance API</Text>
      <View style={styles.badgeRow}>
        <StatusBadge
          label={hasCredentials ? 'KEYS SAVED' : 'NO KEYS'}
          tone={hasCredentials ? 'success' : 'neutral'}
          dot={hasCredentials}
        />
        {result && (
          <StatusBadge label={result.ok ? 'CONNECTED' : 'FAILED'} tone={result.ok ? 'success' : 'danger'} />
        )}
      </View>

      <TextInput
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="API key"
        placeholderTextColor={t.colors.text.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, fieldStyle(t)]}
        selectionColor={t.colors.brand.primary}
      />
      <TextInput
        value={apiSecret}
        onChangeText={setApiSecret}
        placeholder="API secret"
        placeholderTextColor={t.colors.text.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={[styles.input, fieldStyle(t)]}
        selectionColor={t.colors.brand.primary}
      />
      <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
        Keys are encrypted on-device (SecureStore). Use a key with Spot trading permission only —
        never enable withdrawals. Used to read balances, trade fees and auto-set your exact fee.
      </Text>
      {apiMsg && (
        <Text
          style={[
            styles.result,
            { color: apiMsg.ok ? t.colors.feedback.success : t.colors.feedback.danger },
          ]}
        >
          {apiMsg.ok ? `✓ ${apiMsg.text}` : `✕ ${apiMsg.text}`}
        </Text>
      )}

      <View style={styles.ipBox}>
        <View style={styles.ipHead}>
          <Text style={[styles.fieldLabel, { color: t.colors.text.tertiary, marginBottom: 0 }]}>
            YOUR PUBLIC IP · whitelist in Binance
          </Text>
          <View style={styles.ipBtns}>
            <Pressable
              onPress={refreshIp}
              style={({ pressed }) => [styles.ipBtn, { borderColor: t.colors.border.strong, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.ipBtnText, { color: t.colors.text.secondary }]}>REFRESH</Text>
            </Pressable>
            <Pressable
              onPress={copyIp}
              disabled={!ip}
              style={({ pressed }) => [
                styles.ipBtn,
                { borderColor: t.colors.brand.primary, opacity: !ip ? 0.4 : pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.ipBtnText, { color: t.colors.brand.primary }]}>
                {ipCopied ? 'COPIED' : 'COPY'}
              </Text>
            </Pressable>
          </View>
        </View>
        <Text style={[styles.ipValue, { color: ipErr ? t.colors.feedback.danger : t.colors.text.primary }]}>
          {ipErr ? ipErr : ip ?? (ipLoading ? 'Detecting…' : 'Unavailable')}
        </Text>
        <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
          Binance → API Management → Create API → “Restrict access to trusted IPs only” → paste this
          address. Spot trading permission needs an IP whitelist (otherwise it expires after 30
          days), and every signed request from this app leaves from this IP.
        </Text>
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={connect}
          disabled={testing}
          style={({ pressed }) => [
            styles.btnPrimary,
            { backgroundColor: t.colors.brand.primary, opacity: testing ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          {testing ? (
            <ActivityIndicator color="#04111F" size="small" />
          ) : (
            <Text style={[styles.btnPrimaryText, { color: '#04111F' }]}>TEST & SAVE</Text>
          )}
        </Pressable>
        {hasCredentials && (
          <Pressable
            onPress={disconnect}
            style={({ pressed }) => [
              styles.btnGhost,
              { borderColor: t.colors.feedback.danger, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.btnGhostText, { color: t.colors.feedback.danger }]}>REMOVE</Text>
          </Pressable>
        )}
      </View>
      {result && (
        <Text style={[styles.result, { color: result.ok ? t.colors.feedback.success : t.colors.feedback.danger }]}>
          {result.message}
        </Text>
      )}

      <View style={[styles.divider, { backgroundColor: t.colors.border.subtle }]} />

      <Text style={[styles.section, { color: t.colors.text.secondary }]}>Trading method</Text>
      {METHOD_OPTIONS.map((opt) => {
        const active = settings.method === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              if (settings.method !== opt.id) {
                onUpdateSettings({ method: opt.id });
                maybeShowAd();
              }
            }}
            style={({ pressed }) => [
              styles.methodCard,
              {
                backgroundColor: active ? t.colors.feedback.infoDim : t.colors.bg.elevated,
                borderColor: active ? t.colors.brand.primary : t.colors.border.subtle,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={styles.methodHead}>
              <Text style={[styles.methodTitle, { color: active ? t.colors.brand.primary : t.colors.text.primary }]}>
                {opt.title}
              </Text>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: active ? t.colors.brand.primary : t.colors.border.strong,
                    backgroundColor: active ? t.colors.brand.primary : 'transparent',
                  },
                ]}
              >
                {active && <View style={[styles.radioDot, { backgroundColor: '#04111F' }]} />}
              </View>
            </View>
            <Text style={[styles.methodDesc, { color: t.colors.text.secondary }]}>{opt.desc}</Text>
            <Text style={[styles.methodFormula, { color: t.colors.text.tertiary }]}>{opt.formula}</Text>
          </Pressable>
        );
      })}

      <View style={[styles.divider, { backgroundColor: t.colors.border.subtle }]} />

      <Text style={[styles.section, { color: t.colors.text.secondary }]}>Mode</Text>
      <View style={styles.segment}>
        {(['live', 'demo'] as AppMode[]).map((m) => {
          const active = settings.mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => {
                if (m === 'demo' && settings.mode !== 'demo') {
                  onUpdateSettings({ mode: 'demo' });
                  maybeShowAd();
                } else {
                  onUpdateSettings({ mode: m });
                }
              }}
              style={({ pressed }) => [
                styles.segmentBtn,
                {
                  backgroundColor: active
                    ? m === 'demo'
                      ? t.colors.feedback.warning
                      : t.colors.feedback.success
                    : t.colors.bg.elevated,
                  borderColor: active ? 'transparent' : t.colors.border.subtle,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? '#04111F' : t.colors.text.secondary },
                ]}
              >
                {m === 'live' ? 'LIVE' : 'DEMO (paper)'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
        {settings.mode === 'demo'
          ? 'Demo mode: trades execute against a simulated wallet using live market prices — no real funds move.'
          : 'Live mode: journal + read-only balances. Orders are placed manually on Binance.'}
      </Text>

      {settings.mode === 'demo' && (
        <View style={styles.demoBox}>
          <View style={styles.badgeRow}>
            <StatusBadge label="DEMO WALLET" tone="warning" dot />
            {demoKeySet && (
              <Pressable onPress={removeDemoCreds} style={({ pressed }) => [styles.miniBtn, { borderColor: t.colors.feedback.danger, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.miniBtnText, { color: t.colors.feedback.danger }]}>REMOVE DEMO KEY</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.walletRow}>
            <View style={styles.walletCell}>
              <Text style={[styles.walletLabel, { color: t.colors.text.tertiary }]}>Demo SUI</Text>
              <Text style={[styles.walletValue, { color: t.colors.text.primary }]}>
                {formatSui(demoAsset(settings.demoWallet, 'SUI'), 2)}
              </Text>
            </View>
            <View style={styles.walletCell}>
              <Text style={[styles.walletLabel, { color: t.colors.text.tertiary }]}>Demo USDT</Text>
              <Text style={[styles.walletValue, { color: t.colors.text.primary }]}>
                {formatUsdt(demoAsset(settings.demoWallet, 'USDT'))}
              </Text>
            </View>
            <Pressable
              onPress={resetDemoAmount}
              style={({ pressed }) => [
                styles.miniBtn,
                { borderColor: t.colors.border.strong, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.miniBtnText, { color: t.colors.text.secondary }]}>RESET</Text>
            </Pressable>
          </View>

          <View style={styles.demoAmountRow}>
            <TextInput
              value={demoSuiText}
              onChangeText={setDemoSuiText}
              keyboardType="decimal-pad"
              placeholder="Demo SUI"
              placeholderTextColor={t.colors.text.tertiary}
              style={[styles.input, styles.demoAmountInput, fieldStyle(t)]}
              selectionColor={t.colors.brand.primary}
            />
            <TextInput
              value={demoUsdtText}
              onChangeText={setDemoUsdtText}
              keyboardType="decimal-pad"
              placeholder="Demo USDT"
              placeholderTextColor={t.colors.text.tertiary}
              style={[styles.input, styles.demoAmountInput, fieldStyle(t)]}
              selectionColor={t.colors.brand.primary}
            />
            <Pressable
              onPress={applyDemoAmount}
              style={({ pressed }) => [
                styles.miniBtn,
                { borderColor: t.colors.brand.primary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.miniBtnText, { color: t.colors.brand.primary }]}>SET</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
            Set your own paper starting balance — applies instantly to the demo wallet.
            {demoAmountMsg ? `  ·  ${demoAmountMsg}` : ''}
          </Text>
          <TextInput
            value={demoKey}
            onChangeText={setDemoKey}
            placeholder="Demo API key (any value, not validated)"
            placeholderTextColor={t.colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onEndEditing={(e) => {
              const v = e.nativeEvent.text;
              setDemoKey(v);
              applyDemoCreds(v);
            }}
            style={[styles.input, fieldStyle(t)]}
            selectionColor={t.colors.brand.primary}
          />
          <TextInput
            value={demoSecret}
            onChangeText={setDemoSecret}
            placeholder="Demo API secret (stored locally only)"
            placeholderTextColor={t.colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            onEndEditing={(e) => {
              const v = e.nativeEvent.text;
              setDemoSecret(v);
              applyDemoCreds(undefined, v);
            }}
            style={[styles.input, fieldStyle(t)]}
            selectionColor={t.colors.brand.primary}
          />
          <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
            Demo keys are only stored on-device so you can rehearse the full workflow — they are
            never sent to Binance.
          </Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: t.colors.border.subtle }]} />

      <View style={styles.strategyHead}>
        <Text style={[styles.section, { color: t.colors.text.secondary, marginBottom: 0 }]}>
          Fees & target
        </Text>
        <StatusBadge label={feeSourceLabel} tone={settings.feeSource === 'auto' ? 'success' : 'neutral'} />
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: t.colors.text.tertiary }]}>Fee per trade (%)</Text>
          <TextInput
            value={feeText}
            onChangeText={setFeeText}
            onEndEditing={applyFee}
            keyboardType="decimal-pad"
            style={[styles.input, fieldStyle(t)]}
            selectionColor={t.colors.brand.primary}
          />
        </View>
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: t.colors.text.tertiary }]}>Net target (SUI)</Text>
          <TextInput
            value={targetText}
            onChangeText={setTargetText}
            onEndEditing={applyTarget}
            keyboardType="decimal-pad"
            editable={settings.targetEnabled}
            style={[styles.input, fieldStyle(t), !settings.targetEnabled && styles.inputDisabled]}
            selectionColor={t.colors.brand.primary}
          />
        </View>
      </View>

      <View style={styles.targetToggleRow}>
        <View style={styles.targetToggleTexts}>
          <Text style={[styles.fieldLabel, { color: t.colors.text.secondary, marginBottom: 2 }]}>
            Net target
          </Text>
          <Text style={[styles.hint, { color: t.colors.text.tertiary, marginTop: 0 }]}>
            {settings.targetEnabled
              ? 'ON — sells/buys arm an auto re-entry / take-profit cycle with alerts.'
              : 'OFF — manual mode: no target alerts, but every trade still journals with history + P&L.'}
          </Text>
        </View>
        <Switch
          value={settings.targetEnabled}
          onValueChange={(v) => onUpdateSettings({ targetEnabled: v })}
          trackColor={{ false: t.colors.border.strong, true: t.colors.brand.primary }}
          thumbColor={settings.targetEnabled ? '#FFFFFF' : t.colors.text.tertiary}
          ios_backgroundColor={t.colors.border.strong}
        />
      </View>

      <Pressable
        onPress={applyAutoFee}
        disabled={fetchingFee}
        style={({ pressed }) => [
          styles.autoFeeBtn,
          { borderColor: t.colors.brand.primary, opacity: fetchingFee ? 0.6 : pressed ? 0.7 : 1 },
        ]}
      >
        {fetchingFee ? (
          <ActivityIndicator color={t.colors.brand.primary} size="small" />
        ) : (
          <Text style={[styles.autoFeeText, { color: t.colors.brand.primary }]}>
            Fetch exact fee from Binance
          </Text>
        )}
      </Pressable>
      {feeMsg && (
        <Text style={[styles.result, { color: feeMsg.ok ? t.colors.feedback.success : t.colors.feedback.danger }]}>
          {feeMsg.text}
        </Text>
      )}

      <Text style={[styles.hint, { color: t.colors.text.tertiary }]}>
        Fee applies to every leg (0.075% each → 0.15% round trip by default) and all profit figures
        are shown AFTER deducting it. With API keys connected the app auto-loads your exact VIP
        taker rate from Binance (or tap the button to refresh). Target applies to the next armed
        cycle; an armed cycle updates immediately.
      </Text>

      <View style={[styles.divider, { backgroundColor: t.colors.border.subtle }]} />

      <View style={styles.strategyHead}>
        <Text style={[styles.section, { color: t.colors.text.secondary, marginBottom: 0 }]}>
          Strategy script
        </Text>
        <StatusBadge label="CHART SIGNAL" tone="info" />
      </View>
      <Text style={[styles.hint, { color: t.colors.text.tertiary, marginTop: -6, marginBottom: 8 }]}>
        Works with global TradingView-style scripts — paste & Apply:
        {'//@version=5'} + indicator(...)/study(...) headers, ta.ema/ta.sma/ta.rsi/ta.crossover,
        input.int(...), color.teal / color.new / color.rgb, plot(..., color=…),
        plotchar()/plotshape() → chart signals, buy/sell lines. Also supports plain
        ema(close, 9), math.*, ternaries (a ? b : c), and colours like teal or #hex.
      </Text>
      <TextInput
        value={strategyText}
        onChangeText={(v) => {
          setStrategyText(v);
          setStrategyMsg(null);
        }}
        onEndEditing={(e) => applyStrategy(e.nativeEvent.text)}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={[styles.scriptInput, fieldStyle(t)]}
        selectionColor={t.colors.brand.primary}
        placeholder={'// e.g.\nfast = ema(close, 9)\nslow = ema(close, 21)\nplot(fast, color=teal)\nbuy = crossover(fast, slow)'}
        placeholderTextColor={t.colors.text.tertiary}
      />
      <View style={styles.scriptBtnRow}>
        <Pressable
          onPress={() => applyStrategy()}
          style={({ pressed }) => [
            styles.scriptBtn,
            { borderColor: t.colors.brand.primary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.scriptBtnText, { color: t.colors.brand.primary }]}>
            Apply to chart
          </Text>
        </Pressable>
        <Pressable
          onPress={resetStrategy}
          style={({ pressed }) => [
            styles.scriptBtn,
            { borderColor: t.colors.border.strong, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.scriptBtnText, { color: t.colors.text.secondary }]}>
            Load example
          </Text>
        </Pressable>
      </View>
      {strategyMsg && (
        <Text
          style={[
            styles.result,
            { color: strategyMsg.ok ? t.colors.feedback.success : t.colors.feedback.danger },
          ]}
        >
          {strategyMsg.ok ? `✓ ${strategyMsg.text}` : `✕ ${strategyMsg.text}`}
        </Text>
      )}

      <View style={[styles.divider, { backgroundColor: t.colors.border.subtle }]} />

      <Pressable
        onPress={() => {
          if (confirmReset) {
            onResetAll();
            setConfirmReset(false);
          } else {
            setConfirmReset(true);
            setTimeout(() => setConfirmReset(false), 4000);
          }
        }}
        style={({ pressed }) => [
          styles.resetBtn,
          {
            borderColor: confirmReset ? t.colors.feedback.danger : t.colors.border.strong,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.resetText,
            { color: confirmReset ? t.colors.feedback.danger : t.colors.text.secondary },
          ]}
        >
          {confirmReset ? 'TAP AGAIN TO WIPE POSITIONS & CYCLES' : 'Reset trade data'}
        </Text>
      </Pressable>
    </ModalShell>
  );
};

const fieldStyle = (t: ReturnType<typeof useTheme>) => ({
  backgroundColor: t.colors.bg.input,
  borderColor: t.colors.border.subtle,
  color: t.colors.text.primary,
});

const styles = StyleSheet.create({
  section: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 6,
  },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  input: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    marginBottom: 10,
  },
  hint: { fontSize: 11.5, lineHeight: 16.5, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0.5 },
  btnGhost: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  result: { fontSize: 12.5, marginTop: 10, fontWeight: '600', lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 18 },
  methodCard: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
  },
  methodHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodTitle: { fontSize: 14, fontWeight: '700' },
  methodDesc: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  methodFormula: { fontSize: 11, marginTop: 5, fontStyle: 'italic' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  demoBox: {
    backgroundColor: 'rgba(240,185,11,0.06)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.35)',
    padding: 12,
    marginBottom: 4,
  },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  walletCell: { flex: 1 },
  walletLabel: { fontSize: 11, marginBottom: 3 },
  walletValue: { fontSize: 17, fontWeight: '700' },
  miniBtn: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  miniBtnText: { fontSize: 11.5, fontWeight: '800' },
  ipBox: {
    backgroundColor: '#0E1217',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#232A33',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    gap: 6,
  },
  ipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ipBtns: { flexDirection: 'row', gap: 6 },
  ipBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  ipBtnText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  ipValue: { fontSize: 17, fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  demoAmountRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  demoAmountInput: { flex: 1, height: 46, paddingVertical: 8 },
  targetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    backgroundColor: '#0E1217',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#232A33',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  targetToggleTexts: { flex: 1 },
  inputDisabled: { opacity: 0.45 },
  scriptInput: {
    minHeight: 148,
    fontSize: 12.5,
    lineHeight: 18,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  scriptBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  scriptBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scriptBtnText: { fontSize: 12.5, fontWeight: '700' },
  strategyHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldWrap: { flex: 1 },
  fieldLabel: { fontSize: 11.5, marginBottom: 6 },
  autoFeeBtn: {
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  autoFeeText: { fontSize: 13, fontWeight: '700' },
  resetBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  resetText: { fontSize: 13, fontWeight: '700' },
});
