import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { ChartInterval, fetchKlines, KlineStream } from '../services/klines';
import { CandleLike, runStrategy, StrategyOutput } from '../strategy/engine';

const MAX_CANDLES = 400;

export interface CandlesState {
  candles: CandleLike[];
  error: string | null;
  wsLive: boolean;
  /** Interval+symbol the current candle batch belongs to (drives loading). */
  loadedFor: string | null;
}

export interface CandlesView extends CandlesState {
  loading: boolean;
}

export const useCandles = (
  interval: ChartInterval,
  script: string,
  symbol: string,
): CandlesView & { strategy: StrategyOutput } => {
  const [state, setState] = useState<CandlesState>({
    candles: [],
    error: null,
    wsLive: false,
    loadedFor: null,
  });
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const rows = await fetchKlines(symbol, interval, 200);
      if (!mounted.current) return;
      setState((prev) => ({
        ...prev,
        candles: rows,
        error: null,
        loadedFor: `${interval}|${symbol}`,
      }));
    } catch (e) {
      if (!mounted.current) return;
      setState((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : 'Candle fetch failed',
        loadedFor: `${interval}|${symbol}`,
      }));
    }
  }, [interval, symbol]);

  useEffect(() => {
    mounted.current = true;
    load();

    const stream = new KlineStream(
      symbol,
      interval,
      (ev) => {
        if (!mounted.current) return;
        setState((prev) => {
          if (prev.loadedFor !== `${interval}|${symbol}`) return prev;
          const next = [...prev.candles];
          if (!next.length) return prev;
          const last = next[next.length - 1];
          if (ev.t === last.t) {
            next[next.length - 1] = { t: ev.t, o: ev.o, h: ev.h, l: ev.l, c: ev.c, v: ev.v };
            return { ...prev, candles: next };
          }
          if (ev.t > last.t) {
            next.push({ t: ev.t, o: ev.o, h: ev.h, l: ev.l, c: ev.c, v: ev.v });
            if (next.length > MAX_CANDLES) next.splice(0, next.length - MAX_CANDLES);
            return { ...prev, candles: next };
          }
          return prev;
        });
      },
      (connected) => {
        if (mounted.current) setState((prev) => ({ ...prev, wsLive: connected }));
      },
    );
    stream.start();

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        stream.stop();
        stream.start();
        load();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      mounted.current = false;
      stream.stop();
      sub.remove();
    };
  }, [interval, symbol, load]);

  const tag = `${interval}|${symbol}`;
  const loading = state.loadedFor !== tag;
  const candles = useMemo(
    () => (state.loadedFor === tag ? state.candles : []),
    [state.loadedFor, tag, state.candles],
  );

  const strategy = useMemo(() => runStrategy(script, candles), [script, candles]);

  return { candles, loading, error: state.error, wsLive: state.wsLive, loadedFor: state.loadedFor, strategy };
};
