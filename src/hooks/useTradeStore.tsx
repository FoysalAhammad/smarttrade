import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { saveDemoCredentials } from '../services/credentials';
import {
  amountStep,
  AppMode,
  applyDemoBuy,
  applyDemoSell,
  BalanceSnapshot,
  baseOf,
  buyCostUsdt,
  calcReentryPrice,
  calcTargetSellPrice,
  CycleResult,
  DEFAULT_SETTINGS,
  DemoWallet,
  demoAsset,
  Position,
  Settings,
  sellProceeds,
  SwingCycle,
  TradeRecord,
} from '../services/trading';
import { roundToStep } from '../utils/format';

const roundToStepSafe = (value: number, step: number): number =>
  Math.round(roundToStep(value, step) * 1e6) / 1e6;

const KEY_POSITION = '@sui-swing/position';
const KEY_CYCLE = '@sui-swing/cycle';
const KEY_SETTINGS = '@sui-swing/settings';
const KEY_RESULT = '@sui-swing/lastResult';
const KEY_HISTORY = '@sui-swing/history';

const HISTORY_LIMIT = 200;

// History snapshot — `sui` field carries the ACTIVE base amount (legacy name).
const snap = (
  mode: AppMode,
  wallet: DemoWallet,
  base: string,
  external?: BalanceSnapshot,
): BalanceSnapshot | undefined =>
  mode === 'demo'
    ? { sui: demoAsset(wallet, base), usdt: demoAsset(wallet, 'USDT') }
    : external;

const buildRecord = (
  cycle: SwingCycle,
  exitPrice: number,
  profitSui: number,
  profitUsdt: number,
  feeRate: number,
  exitBalance: BalanceSnapshot | undefined,
): TradeRecord => ({
  id: `${cycle.startedAt}-${exitPrice}-${Date.now()}`,
  symbol: cycle.symbol,
  method: cycle.method,
  completedAt: Date.now(),
  amount: cycle.baselineAmount,
  entryPrice: cycle.baselinePrice,
  exitPrice,
  feeRate,
  feeUsdt: cycle.baselineAmount * (cycle.baselinePrice + exitPrice) * feeRate,
  profitSui,
  profitUsdt,
  entryBalance: cycle.entryBalance,
  exitBalance,
});

export interface TradeState {
  position: Position | null;
  cycle: SwingCycle | null;
  lastResult: CycleResult | null;
  history: TradeRecord[];
  settings: Settings;
  hydrated: boolean;
}

const initialState: TradeState = {
  position: null,
  cycle: null,
  lastResult: null,
  history: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
};

const readJson = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = async (key: string, value: unknown): Promise<void> => {
  try {
    if (value === null || value === undefined) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* non-fatal persistence error */
  }
};

const recomputeTarget = (
  cycle: SwingCycle,
  targetGain: number,
  fee: number,
): SwingCycle => {
  const targetPrice =
    cycle.method === 'sell_first'
      ? calcReentryPrice(cycle.baselineAmount, cycle.baselinePrice, targetGain, fee)
      : calcTargetSellPrice(cycle.baselineAmount, cycle.baselinePrice, targetGain, fee);
  return { ...cycle, targetGain, targetPrice };
};

export interface TradeStore extends TradeState {
  /**
   * Method 1 (sell_first): opens/adds a position, or completes an armed
   * re-entry cycle (locks in the extra coins → history row).
   * Method 2 (buy_first): opens/adds a position and arms/rebases the
   * upward target-sell cycle.
   * `externalBalance` = live exchange balance snapshot (skipped in demo mode).
   */
  buy: (amount: number, price: number, externalBalance?: BalanceSnapshot) => CycleResult | null;
  /**
   * Method 1: logs the baseline sell and arms the lower re-entry target.
   * Method 2: with an armed cycle → takes profit (completes it → history row);
   * without → plain journal sell of the position.
   */
  sell: (amount: number, price: number, externalBalance?: BalanceSnapshot) => CycleResult | null;
  cancelCycle: () => void;
  setPosition: (amount: number, entryPrice: number) => void;
  clearPosition: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  resetDemoWallet: () => void;
}

const useTradeStoreState = (): TradeStore => {
  const [state, setState] = useState<TradeState>(initialState);
  const stateRef = useRef(state);

  // `commit` updates the ref SYNCHRONOUSLY so back-to-back mutations (e.g. the
  // settings sheet saving fee + target + demo keys in one close) each build on
  // the previous patch instead of a stale render snapshot.
  const commit = useCallback((next: TradeState) => {
    stateRef.current = next;
    setState(next);
    writeJson(KEY_POSITION, next.position);
    writeJson(KEY_CYCLE, next.cycle);
    writeJson(KEY_RESULT, next.lastResult);
    writeJson(KEY_SETTINGS, next.settings);
    writeJson(KEY_HISTORY, next.history);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [position, cycle, settings, lastResult, history] = await Promise.all([
        readJson<Position>(KEY_POSITION),
        readJson<SwingCycle>(KEY_CYCLE),
        readJson<Settings>(KEY_SETTINGS),
        readJson<CycleResult>(KEY_RESULT),
        readJson<TradeRecord[]>(KEY_HISTORY),
      ]);
      if (!alive) return;
      const merged: Settings = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
      merged.demoWallet = { ...DEFAULT_SETTINGS.demoWallet, ...(settings?.demoWallet ?? {}) };
      // Legacy wallet {sui,usdt} → multi-asset {SUI,USDT}.
      const dw = merged.demoWallet as Record<string, unknown>;
      if ('sui' in dw || 'usdt' in dw) {
        const migrated: DemoWallet = { ...merged.demoWallet };
        delete (migrated as Record<string, unknown>).sui;
        delete (migrated as Record<string, unknown>).usdt;
        if (typeof dw.sui === 'number') migrated.SUI = dw.sui;
        if (typeof dw.usdt === 'number') migrated.USDT = dw.usdt;
        merged.demoWallet = migrated;
      }
      // Legacy builds persisted demo API keys in plain AsyncStorage settings —
      // migrate them into Keystore-encrypted SecureStore and purge the plaintext.
      const legacy = (settings as unknown as { demoCreds?: { apiKey: string; apiSecret: string } | null } | null)?.demoCreds;
      if (legacy && (legacy.apiKey || legacy.apiSecret)) {
        saveDemoCredentials(legacy.apiKey, legacy.apiSecret).catch(() => {});
      }
      if (settings && 'demoCreds' in settings) {
        delete (merged as Settings & { demoCreds?: unknown }).demoCreds;
        void writeJson(KEY_SETTINGS, merged);
      }
      if (position && !position.symbol) position.symbol = 'SUIUSDT';
      if (cycle && !cycle.symbol) cycle.symbol = 'SUIUSDT';
      const hydratedState: TradeState = {
        position: position && position.amount > 0 ? position : null,
        cycle: cycle && cycle.baselineAmount > 0 ? cycle : null,
        settings: merged,
        lastResult: lastResult ?? null,
        history: history ?? [],
        hydrated: true,
      };
      stateRef.current = hydratedState;
      setState(hydratedState);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const buy = useCallback(
    (amount: number, price: number, externalBalance?: BalanceSnapshot): CycleResult | null => {
      const prev = stateRef.current;
      const sym = prev.settings.activeSymbol;
      const base = baseOf(sym);
      const step = amountStep(sym, price);
      let cleanAmount = roundToStepSafe(amount, step);
      if (cleanAmount <= 0 || price <= 0) return null;
      if (prev.settings.mode === 'demo') {
        // Never spend more USDT than the paper wallet holds.
        const maxAffordable = roundToStepSafe(demoAsset(prev.settings.demoWallet, 'USDT') / price, step);
        cleanAmount = Math.min(cleanAmount, maxAffordable);
        if (cleanAmount <= 0) return null;
      }

      const fee = prev.settings.feeRate;
      // Balance BEFORE this trade — stored on the armed cycle as history entry snapshot.
      const entrySnap = snap(prev.settings.mode, prev.settings.demoWallet, base, externalBalance);

      let result: CycleResult | null = null;
      // Only the active market's position/pair participate in this trade.
      const heldPos = prev.position && prev.position.symbol === sym ? prev.position : null;
      let position: Position | null = heldPos;
      const openPair = prev.cycle && prev.cycle.symbol === sym ? prev.cycle : null;
      let cycle: SwingCycle | null = prev.cycle;

      if (openPair && openPair.method === 'sell_first') {
        // Method 1 re-entry → swing cycle complete, extra coins locked.
        const securedSui = cleanAmount - openPair.baselineAmount;
        result = {
          method: 'sell_first',
          baselinePrice: openPair.baselinePrice,
          baselineAmount: openPair.baselineAmount,
          exitPrice: price,
          exitAmount: cleanAmount,
          securedSui,
          securedUsdt: securedSui * price,
          completedAt: Date.now(),
        };
        position = { symbol: sym, amount: cleanAmount, entryPrice: price, updatedAt: Date.now() };
        cycle = null;
      } else {
        if (position) {
          position = {
            ...position,
            amount: roundToStepSafe(position.amount + cleanAmount, step),
            entryPrice:
              (position.entryPrice * position.amount + price * cleanAmount) /
              (position.amount + cleanAmount),
            updatedAt: Date.now(),
          };
        } else {
          position = { symbol: sym, amount: cleanAmount, entryPrice: price, updatedAt: Date.now() };
        }

        if (prev.settings.method === 'buy_first') {
          // Method 2: every logged buy opens (or rebases) the journal pair —
          // targetEnabled only gates the target UI/alerts, never the record.
          cycle = {
            symbol: sym,
            method: 'buy_first',
            baselinePrice: price,
            baselineAmount: cleanAmount,
            targetGain: prev.settings.targetGain,
            targetPrice: calcTargetSellPrice(
              cleanAmount,
              price,
              prev.settings.targetGain,
              fee,
            ),
            startedAt: Date.now(),
            entryBalance: entrySnap,
          };
        } else {
          cycle = null;
        }
      }

      let wallet = prev.settings.demoWallet;
      if (prev.settings.mode === 'demo') {
        wallet = applyDemoBuy(wallet, base, cleanAmount, price, fee);
      }

      // Balance AFTER the completed cycle (demo: mutated wallet; live: current exchange).
      const exitSnap = snap(prev.settings.mode, wallet, base, externalBalance);
      const record =
        result && openPair
          ? buildRecord(
              openPair,
              result.exitPrice,
              result.securedSui,
              result.securedUsdt,
              fee,
              exitSnap,
            )
          : null;
      const history = record ? [record, ...prev.history].slice(0, HISTORY_LIMIT) : prev.history;

      const next: TradeState = {
        ...prev,
        position,
        cycle,
        lastResult: result ?? prev.lastResult,
        history,
        settings: { ...prev.settings, demoWallet: wallet },
      };
      commit(next);
      return result;
    },
    [commit],
  );

  const sell = useCallback(
    (amount: number, price: number, externalBalance?: BalanceSnapshot): CycleResult | null => {
      const prev = stateRef.current;
      const sym = prev.settings.activeSymbol;
      const base = baseOf(sym);
      const step = amountStep(sym, price);
      let cleanAmount = roundToStepSafe(amount, step);
      if (cleanAmount <= 0 || price <= 0) return null;
      if (prev.settings.mode === 'demo') {
        // Never sell more of the base than the paper wallet holds.
        const maxSellable = roundToStepSafe(demoAsset(prev.settings.demoWallet, base), step);
        cleanAmount = Math.min(cleanAmount, maxSellable);
        if (cleanAmount <= 0) return null;
      }

      const fee = prev.settings.feeRate;
      // Balance BEFORE this trade — history entry snapshot for method 1.
      const entrySnap = snap(prev.settings.mode, prev.settings.demoWallet, base, externalBalance);
      const heldPos = prev.position && prev.position.symbol === sym ? prev.position : null;
      const remaining = heldPos
        ? roundToStepSafe(heldPos.amount - cleanAmount, step)
        : 0;
      const position: Position | null =
        remaining > 0 ? { ...heldPos!, amount: remaining, updatedAt: Date.now() } : null;

      let result: CycleResult | null = null;
      const openPair = prev.cycle && prev.cycle.symbol === sym ? prev.cycle : null;
      let cycle: SwingCycle | null = prev.cycle;

      if (openPair && openPair.method === 'buy_first') {
        // Method 2 take-profit: sell into the rise → cycle complete.
        const exitUsdt = sellProceeds(cleanAmount, price, fee);
        const costUsdt = buyCostUsdt(openPair.baselineAmount, openPair.baselinePrice, fee);
        const securedUsdt = exitUsdt - costUsdt;
        result = {
          method: 'buy_first',
          baselinePrice: openPair.baselinePrice,
          baselineAmount: openPair.baselineAmount,
          exitPrice: price,
          exitAmount: cleanAmount,
          securedUsdt,
          securedSui: securedUsdt / openPair.baselinePrice,
          completedAt: Date.now(),
        };
        cycle = null;
      } else if (prev.settings.method === 'sell_first') {
        // Method 1: this sell opens the journal pair (re-entry target shown
        // only while targetEnabled).
        cycle = {
          symbol: sym,
          method: 'sell_first',
          baselinePrice: price,
          baselineAmount: cleanAmount,
          targetGain: prev.settings.targetGain,
          targetPrice: calcReentryPrice(
            cleanAmount,
            price,
            prev.settings.targetGain,
            fee,
          ),
          startedAt: Date.now(),
          entryBalance: entrySnap,
        };
      }

      let wallet = prev.settings.demoWallet;
      if (prev.settings.mode === 'demo') {
        wallet = applyDemoSell(wallet, base, cleanAmount, price, fee);
      }

      // Balance AFTER the completed cycle (demo: mutated wallet; live: current exchange).
      const exitSnap = snap(prev.settings.mode, wallet, base, externalBalance);
      const record =
        result && openPair
          ? buildRecord(
              openPair,
              result.exitPrice,
              result.securedSui,
              result.securedUsdt,
              fee,
              exitSnap,
            )
          : null;
      const history = record ? [record, ...prev.history].slice(0, HISTORY_LIMIT) : prev.history;

      const next: TradeState = {
        ...prev,
        position,
        cycle,
        lastResult: result ?? prev.lastResult,
        history,
        settings: { ...prev.settings, demoWallet: wallet },
      };
      commit(next);
      return result;
    },
    [commit],
  );

  const cancelCycle = useCallback(() => {
    const prev = stateRef.current;
    commit({ ...prev, cycle: null });
  }, [commit]);

  const setPosition = useCallback(
    (amount: number, entryPrice: number) => {
      const st = stateRef.current;
      const cleanAmount = roundToStepSafe(amount, amountStep(st.settings.activeSymbol, entryPrice));
      const position: Position | null =
        cleanAmount > 0 && entryPrice > 0
          ? { symbol: st.settings.activeSymbol, amount: cleanAmount, entryPrice, updatedAt: Date.now() }
          : null;
      commit({ ...st, position });
    },
    [commit],
  );

  const clearPosition = useCallback(() => {
    commit({ ...stateRef.current, position: null });
  }, [commit]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const prev = stateRef.current;
      const settings: Settings = { ...prev.settings, ...patch };
      let cycle = prev.cycle;

      if (cycle && patch.activeSymbol !== undefined && patch.activeSymbol !== cycle.symbol) {
        // Switching market drops the previous market's open pair.
        cycle = null;
      } else if (cycle && patch.method !== undefined && patch.method !== cycle.method) {
        // Switching strategy disarms a cycle armed by the other strategy.
        cycle = null;
      } else if (cycle && (patch.targetGain !== undefined || patch.feeRate !== undefined)) {
        cycle = recomputeTarget(cycle, settings.targetGain, settings.feeRate);
      }

      commit({ ...prev, settings, cycle });
    },
    [commit],
  );

  const resetAll = useCallback(() => {
    commit({
      position: null,
      cycle: null,
      lastResult: null,
      history: [],
      settings: DEFAULT_SETTINGS,
      hydrated: true,
    });
  }, [commit]);

  const resetDemoWallet = useCallback(() => {
    const prev = stateRef.current;
    commit({
      ...prev,
      settings: {
        ...prev.settings,
        demoWallet: { ...DEFAULT_SETTINGS.demoWallet },
      },
    });
  }, [commit]);

  return {
    ...state,
    buy,
    sell,
    cancelCycle,
    setPosition,
    clearPosition,
    updateSettings,
    resetAll,
    resetDemoWallet,
  };
};

/**
 * Single store instance shared by every route (Dashboard / Account / History)
 * so a trade logged on one screen is instantly visible on the others.
 */
const TradeStoreContext = createContext<TradeStore | null>(null);

export const TradeStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useTradeStoreState();
  return <TradeStoreContext.Provider value={store}>{children}</TradeStoreContext.Provider>;
};

export const useTradeStore = (): TradeStore => {
  const ctx = useContext(TradeStoreContext);
  if (!ctx) throw new Error('useTradeStore must be used within TradeStoreProvider');
  return ctx;
};
