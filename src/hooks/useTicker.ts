import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { getTicker24h, Ticker24h } from '../services/binance';

const POLL_MS = 3000;

export interface TickerState {
  ticker: Ticker24h | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
}

export const useTicker = (symbol = 'SUIUSDT'): TickerState & { refresh: () => void } => {
  const [state, setState] = useState<TickerState>({
    ticker: null,
    loading: true,
    error: null,
    updatedAt: null,
  });
  const mounted = useRef(true);
  const inFlight = useRef(false);

  const fetchTick = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const ticker = await getTicker24h(symbol);
      if (!mounted.current) return;
      setState({ ticker, loading: false, error: null, updatedAt: Date.now() });
    } catch (e) {
      if (!mounted.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Price feed error',
      }));
    } finally {
      inFlight.current = false;
    }
  }, [symbol]);

  useEffect(() => {
    mounted.current = true;
    // Flip to loading for a new symbol so the previous market's price
    // never shows under the new pair label (deferred past the effect body).
    queueMicrotask(() => {
      if (mounted.current) setState((prev) => ({ ...prev, loading: true }));
    });
    fetchTick();
    const timer = setInterval(fetchTick, POLL_MS);

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') fetchTick();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      mounted.current = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [fetchTick]);

  return { ...state, refresh: fetchTick };
};
