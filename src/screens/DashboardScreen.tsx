import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initAds } from '../services/ads';
import { AlertBanner, BannerMessage } from '../components/AlertBanner';
import { loadCredentials } from '../services/credentials';
import { getTradeFee } from '../services/binance';
import { CandleChart } from '../components/CandleChart';
import { PairPickerModal } from '../components/PairPickerModal';
import { ActionButtons } from '../components/ActionButtons';
import { Card } from '../components/Card';
import { EntryModal } from '../components/EntryModal';
import { Header } from '../components/Header';
import { PortfolioCard } from '../components/PortfolioCard';
import { PositionCard } from '../components/PositionCard';
import { PriceTicker } from '../components/PriceTicker';
import { ReentryPanel } from '../components/ReentryPanel';
import { SettingsModal } from '../components/SettingsModal';
import { TradeModal, TradeMode } from '../components/TradeModal';
import { useAssetPrices } from '../hooks/useAssetPrices';
import { useBalances } from '../hooks/useBalances';
import { useTicker } from '../hooks/useTicker';
import { useTradeStore } from '../hooks/useTradeStore';
import { useTheme } from '../theme';
import {
  baseOf,
  calcReentryPrice,
  calcTargetSellPrice,
  CycleStatus,
  demoAsset,
  getCycleStatus,
} from '../services/trading';
import { formatPrice, formatSui, formatUsdt, timeLabel } from '../utils/format';

export const DashboardScreen: React.FC = () => {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const balances = useBalances();
  const store = useTradeStore();
  const navigation = useNavigation();
  const { position, cycle, lastResult, settings, hydrated } = store;
  const activeSymbol = settings.activeSymbol;
  const base = baseOf(activeSymbol);
  const ticker = useTicker(activeSymbol);
  // Everything the account/wallet actually holds (drives Portfolio + picker).
  const heldAssets = useMemo(() => {
    const out: Record<string, number> = {};
    if (settings.mode === 'demo') {
      for (const [k, v] of Object.entries(settings.demoWallet)) {
        if (typeof v === 'number' && v !== 0) out[k.toUpperCase()] = v;
      }
    } else if (balances.balances?.assets) {
      Object.assign(out, balances.balances.assets);
    }
    return out;
  }, [settings.mode, settings.demoWallet, balances.balances]);
  const assetPrices = useAssetPrices(
    Object.keys(heldAssets).filter((b) => b !== 'USDT'),
  );
  const allPrices = useMemo(() => ({ ...assetPrices, USDT: 1 }), [assetPrices]);

  const openDrawer = () => {
    (navigation as unknown as { openDrawer?: () => void }).openDrawer?.();
  };

  const price = ticker.ticker?.lastPrice ?? null;
  const demoMode = settings.mode === 'demo';
  // Only the active market's position / journal pair are live on this screen.
  const activePosition = position && position.symbol === activeSymbol ? position : null;
  const activeCycle = cycle && cycle.symbol === activeSymbol ? cycle : null;

  // Live exchange snapshot handed to the store for history entry/exit balances.
  const externalBalance = useMemo(
    () =>
      !demoMode && balances.balances
        ? {
            sui: balances.balances.assets?.[base] ?? 0,
            usdt: balances.balances.assets?.USDT ?? balances.balances.usdtFree,
          }
        : undefined,
    [demoMode, balances.balances, base],
  );

  const [chartTouching, setChartTouching] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tradeMode, setTradeMode] = useState<TradeMode | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [banner, setBanner] = useState<BannerMessage | null>(null);

  // Ads SDK boots only on the post-consent dashboard.
  useEffect(() => {
    initAds();
  }, []);

  const bannerId = useRef(0);
  const showBanner = (title: string, body: string, tone: BannerMessage['tone']) => {
    bannerId.current += 1;
    setBanner({ id: bannerId.current, title, body, tone });
  };

  const prevStatus = useRef<CycleStatus | null>(null);

  // Visual + haptic alerts when price walks into the zone / hits the target.
  useEffect(() => {
    if (!activeCycle || !price || !settings.targetEnabled) {
      prevStatus.current = null;
      return;
    }
    const next = getCycleStatus(price, activeCycle.targetPrice, activeCycle.method);
    const prev = prevStatus.current;
    if (prev !== next) {
      const comparison = activeCycle.method === 'sell_first' ? '≤' : '≥';
      if (next === 'zone' && prev === 'waiting') {
        showBanner(
          'TARGET ZONE',
          `Price approaching target ${comparison} ${formatPrice(activeCycle.targetPrice)} — get ready.`,
          'warning',
        );
      } else if (next === 'hit' && prev !== 'hit' && prev !== null) {
        showBanner(
          'TARGET REACHED',
          `${comparison} ${formatPrice(activeCycle.targetPrice)} — secure +${formatSui(
            activeCycle.targetGain,
            1,
          )} ${base} net now.`,
          'success',
        );
      }
      prevStatus.current = next;
    }
  }, [price, activeCycle, settings.targetEnabled, base]);

  // Balances: demo wallet wins in demo mode; exchange balance in live mode.
  const apiSui = balances.balances?.assets?.[base] ?? 0;
  const apiUsdt = balances.balances?.assets?.USDT ?? balances.balances?.usdtFree ?? 0;
  const walletSui = demoMode ? demoAsset(settings.demoWallet, base) : 0;
  const walletUsdt = demoMode ? demoAsset(settings.demoWallet, 'USDT') : 0;
  // Only enforce limits when a balance is actually loaded — a failed live
  // fetch must fall back to journal mode instead of fake zeros.
  const budgetKnown = demoMode || (!!balances.credentials && !!balances.balances);

  // Real holdings only — the tracked position is a P&L hint and must never
  // cap the popup (it drifts from the wallet after fees/manual moves).
  const sellableSui = useMemo(
    () => (demoMode ? walletSui : apiSui),
    [demoMode, walletSui, apiSui],
  );

  const buyBudgetUsdt = demoMode ? walletUsdt : apiUsdt;

  const feedError = ticker.error ?? balances.error ?? null;
  const live = !!ticker.ticker && !ticker.error;

  const hasCreds = !!balances.credentials;
  const updateSettings = store.updateSettings;

  // Auto-load the exact fee from Binance whenever keys are connected and the
  // user hasn't manually overridden the rate.
  useEffect(() => {
    if (!hasCreds || settings.feeSource === 'manual') return;
    let alive = true;
    loadCredentials()
      .then((creds) => (creds ? getTradeFee(creds) : null))
      .then((fees) => {
        if (alive && fees && Number.isFinite(fees.taker) && fees.taker > 0) {
          updateSettings({ feeRate: fees.taker, feeSource: 'auto' });
        }
      })
      .catch(() => {
        /* keep current fee on failure */
      });
    return () => {
      alive = false;
    };
  }, [hasCreds, settings.feeSource, updateSettings]);

  const onSubmitTrade = (amount: number) => {
    if (!price || !tradeMode) return;
    if (tradeMode === 'sell') {
      const result = store.sell(amount, price, externalBalance);
      if (result) {
        // Method 2 take-profit complete.
        showBanner(
          'CYCLE COMPLETE',
          `Sold ${formatSui(result.exitAmount, 1)} ${base} @ ${formatPrice(result.exitPrice)} · net ${
            result.securedUsdt >= 0 ? '+' : ''
          }${formatUsdt(result.securedUsdt)} USDT (${formatSui(result.securedSui, 3)} ${base}) secured.`,
          result.securedUsdt >= 0 ? 'success' : 'danger',
        );
      } else if (settings.method === 'sell_first') {
        showBanner(
          'SELL LOGGED',
          settings.targetEnabled
            ? `${formatSui(amount, 1)} ${base} @ ${formatPrice(price)} — re-entry target ${formatPrice(
                calcReentryPrice(amount, price, settings.targetGain, settings.feeRate),
              )} armed.`
            : `${formatSui(amount, 1)} ${base} @ ${formatPrice(price)} — target OFF, buy back manually.`,
          'info',
        );
      } else {
        showBanner(
          'SELL LOGGED',
          `${formatSui(amount, 1)} ${base} @ ${formatPrice(price)} — fee ${formatUsdt(
            amount * price * settings.feeRate,
          )} deducted from proceeds.`,
          'info',
        );
      }
    } else {
      const result = store.buy(amount, price, externalBalance);
      if (result) {
        // Method 1 re-entry complete.
        showBanner(
          'CYCLE COMPLETE',
          `Re-entered ${formatSui(result.exitAmount, 1)} ${base} @ ${formatPrice(
            result.exitPrice,
          )} · net ${result.securedSui >= 0 ? '+' : ''}${formatSui(
            result.securedSui,
            3,
          )} ${base} secured.`,
          result.securedSui >= 0 ? 'success' : 'danger',
        );
      } else if (settings.method === 'buy_first') {
        showBanner(
          'BUY LOGGED',
          settings.targetEnabled
            ? `${formatSui(amount, 1)} ${base} @ ${formatPrice(price)} — target sell ${formatPrice(
                calcTargetSellPrice(amount, price, settings.targetGain, settings.feeRate),
              )} armed.`
            : `${formatSui(amount, 1)} ${base} @ ${formatPrice(price)} — target OFF, sell manually.`,
          'info',
        );
      } else {
        showBanner(
          'POSITION OPENED',
          `${formatSui(amount, 1)} ${base} @ ${formatPrice(price)} — fee ${(
            settings.feeRate * 100
          ).toFixed(3)}% per leg factored.`,
          'info',
        );
      }
    }
    setTradeMode(null);
    balances.refresh();
  };

  const connect = () => setSettingsOpen(true);

  if (!hydrated) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.bg.screen }]}>
        <Header live={false} error={null} demo={demoMode} onMenu={openDrawer} onSettings={() => setSettingsOpen(true)} />
        <View style={styles.loading}>
          <Text style={{ color: t.colors.text.tertiary }}>Loading trade state…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.colors.bg.screen }]}>
      <Header live={live} error={feedError} demo={demoMode} onMenu={openDrawer} onSettings={() => setSettingsOpen(true)} />

      <AlertBanner message={banner} onDismiss={() => setBanner(null)} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!chartTouching}
      >
        <PriceTicker
          ticker={ticker.ticker}
          updatedAt={ticker.updatedAt}
          loading={ticker.loading}
          base={base}
          onPairPress={() => setPairOpen(true)}
        />

        {activeCycle && settings.targetEnabled && (
          <ReentryPanel
            cycle={activeCycle}
            base={base}
            price={price}
            feeRate={settings.feeRate}
            onCancel={() => {
              store.cancelCycle();
              showBanner('CYCLE CANCELLED', 'Target disarmed.', 'info');
            }}
            onPrimaryAction={() =>
              setTradeMode(activeCycle.method === 'sell_first' ? 'buy' : 'sell')
            }
          />
        )}

        <CandleChart
          key={activeSymbol}
          strategyScript={settings.strategyScript}
          symbol={activeSymbol}
          onChartTouchChange={setChartTouching}
          onPairPress={() => setPairOpen(true)}
        />

        <PositionCard
          position={activePosition}
          base={base}
          price={price}
          feeRate={settings.feeRate}
          hasBalance={sellableSui > 0}
          onEditEntry={() => setEntryOpen(true)}
          onTrackFromBalance={() => setEntryOpen(true)}
        />

        <PortfolioCard
          assets={heldAssets}
          prices={allPrices}
          activeBase={base}
          demoMode={demoMode}
          demoWallet={settings.demoWallet}
          connected={!!balances.credentials}
          error={balances.error}
          onConnect={connect}
        />

        {lastResult && !cycle && (
          <Card title="Last Cycle">
            <View style={styles.resultRow}>
              <View>
                <Text style={[styles.resultLabel, { color: t.colors.text.tertiary }]}>
                  Net secured
                </Text>
                <Text
                  style={[
                    styles.resultValue,
                    {
                      color:
                        (lastResult.method === 'buy_first' ? lastResult.securedUsdt : lastResult.securedSui) >= 0
                          ? t.colors.feedback.success
                          : t.colors.feedback.danger,
                    },
                  ]}
                >
                  {lastResult.method === 'buy_first' ? (
                    <>
                      {lastResult.securedUsdt >= 0 ? '+' : ''}
                      {formatUsdt(lastResult.securedUsdt)} USDT
                    </>
                  ) : (
                    <>
                      {lastResult.securedSui >= 0 ? '+' : ''}
                      {formatSui(lastResult.securedSui, 3)} ${base}
                    </>
                  )}
                </Text>
              </View>
              <View style={styles.resultMeta}>
                <Text style={[styles.resultMetaText, { color: t.colors.text.secondary }]}>
                  {lastResult.method === 'buy_first'
                    ? `Bought ${formatPrice(lastResult.baselinePrice)} → Sold ${formatPrice(lastResult.exitPrice)}`
                    : `Sold ${formatPrice(lastResult.baselinePrice)} → Re-bought ${formatPrice(lastResult.exitPrice)}`}
                </Text>
                <Text style={[styles.resultMetaText, { color: t.colors.text.tertiary }]}>
                  {formatSui(lastResult.baselineAmount, 1)} → {formatSui(lastResult.exitAmount, 1)} {base} ·{' '}
                  {timeLabel(lastResult.completedAt)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <Text style={[styles.disclaimer, { color: t.colors.text.tertiary }]}>
          {settings.method === 'sell_first'
            ? 'Method 1 · sell first → buy back the dip'
            : 'Method 2 · buy first → sell the rise'}{' '}
          · {base}/USDT spot · live prices from Binance (3s poll) · fee{' '}
          {(settings.feeRate * 100).toFixed(3)}% per leg (0.15% round trip) deducted from every
          profit figure {demoMode ? '· DEMO paper wallet' : ''} · not financial advice.
        </Text>
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: t.colors.bg.card,
            borderColor: t.colors.border.subtle,
            paddingBottom: insets.bottom + 14,
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(76,141,255,0.55)', 'rgba(76,141,255,0)']}
          style={styles.actionBarGlow}
          pointerEvents="none"
        />
        <ActionButtons
          onBuy={() => setTradeMode('buy')}
          onSell={() => setTradeMode('sell')}
          disabled={!price}
          buyBadge={
            activeCycle?.method === 'sell_first'
              ? 'Lock in profit'
              : settings.method === 'buy_first' && !cycle
                ? settings.targetEnabled
                  ? 'Log & arm target'
                  : 'Manual trade'
                : undefined
          }
          sellBadge={
            activeCycle?.method === 'buy_first'
              ? 'Take profit'
              : activePosition
                ? `Log ${formatSui(activePosition.amount, 1)} ${base}`
                : settings.method === 'sell_first'
                  ? settings.targetEnabled
                    ? 'Log & arm target'
                    : 'Manual trade'
                  : undefined
          }
        />
      </View>

      <PairPickerModal
        visible={pairOpen}
        onClose={() => setPairOpen(false)}
        activeSymbol={activeSymbol}
        mode={settings.mode}
        demoWallet={settings.demoWallet}
        liveAssets={balances.balances?.assets ?? null}
        onSelect={(sym) => {
          if (sym !== activeSymbol) {
            store.updateSettings({ activeSymbol: sym });
            showBanner('MARKET SWITCHED', `${baseOf(sym)} / USDT — chart & trading updated.`, 'info');
          }
        }}
      />

      {tradeMode && (
        <TradeModal
          visible
          mode={tradeMode}
          price={price}
          feeRate={settings.feeRate}
          method={settings.method}
          base={base}
          symbol={activeSymbol}
          sellableSui={sellableSui}
          buyBudgetUsdt={buyBudgetUsdt}
          budgetKnown={budgetKnown}
          cycle={activeCycle}
          onSubmit={onSubmitTrade}
          onClose={() => setTradeMode(null)}
        />
      )}

      {entryOpen && (
        <EntryModal
          base={base}
          visible
          initialAmount={activePosition?.amount ?? sellableSui}
          initialEntry={activePosition?.entryPrice ?? price ?? 0}
          currentPrice={price}
          amountEditable={!activePosition}
          onSave={(amount, entry) => {
            store.setPosition(amount, entry);
            setEntryOpen(false);
            showBanner('POSITION SAVED', `${formatSui(amount, 1)} ${base} @ ${formatPrice(entry)}`, 'info');
          }}
          onClear={
            activePosition
              ? () => {
                  store.clearPosition();
                  setEntryOpen(false);
                  showBanner('POSITION CLEARED', 'Tracked position removed.', 'info');
                }
              : undefined
          }
          onClose={() => setEntryOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          visible
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={store.updateSettings}
          onCredentialsChanged={() => balances.refresh()}
          hasCredentials={!!balances.credentials}
          onResetAll={() => {
            store.resetAll();
            showBanner('DATA RESET', 'Positions and cycles cleared.', 'info');
          }}
          onResetDemo={() => {
            store.resetDemoWallet();
            showBanner('DEMO WALLET RESET', 'Paper balances restored.', 'info');
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 14, paddingTop: 4, gap: 14 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  resultLabel: { fontSize: 11, marginBottom: 4 },
  resultValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  resultMeta: { flex: 1 },
  resultMetaText: { fontSize: 12, lineHeight: 17 },
  disclaimer: { fontSize: 10.5, lineHeight: 15, textAlign: 'center', marginTop: 4 },
  actionBarGlow: {
    position: 'absolute',
    top: -1,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 2,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
