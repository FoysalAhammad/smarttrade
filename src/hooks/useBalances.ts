import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { Credentials, loadCredentials } from '../services/credentials';
import { AccountBalances, getBalances } from '../services/binance';

const POLL_MS = 15000;

export interface BalancesState {
  balances: AccountBalances | null;
  credentials: Credentials | null;
  checking: boolean;
  error: string | null;
  updatedAt: number | null;
}

export const useBalances = (): BalancesState & { refresh: () => Promise<void> } => {
  const [state, setState] = useState<BalancesState>({
    balances: null,
    credentials: null,
    checking: true,
    error: null,
    updatedAt: null,
  });
  const mounted = useRef(true);
  const credsRef = useRef<Credentials | null>(null);
  const inFlight = useRef(false);

  const pendingRefresh = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      pendingRefresh.current = true;
      return;
    }
    inFlight.current = true;
    try {
      // Always re-read SecureStore (its own module cache is cheap) so a
      // just-removed key is never served from a stale hook ref.
      const creds = await loadCredentials();
      credsRef.current = creds;
      if (!mounted.current) return;
      if (!creds) {
        setState((prev) => ({
          ...prev,
          credentials: null,
          balances: null,
          checking: false,
          error: null,
        }));
        return;
      }
      const balances = await getBalances(creds);
      if (!mounted.current) return;
      setState({
        balances,
        credentials: creds,
        checking: false,
        error: null,
        updatedAt: Date.now(),
      });
    } catch (e) {
      if (!mounted.current) return;
      setState((prev) => ({
        ...prev,
        credentials: credsRef.current,
        checking: false,
        error: e instanceof Error ? e.message : 'Balance fetch failed',
      }));
    } finally {
      inFlight.current = false;
      if (pendingRefresh.current) {
        pendingRefresh.current = false;
        void refreshRef.current();
      }
    }
  }, []);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      credsRef.current = await loadCredentials();
      await refresh();
      timer = setInterval(refresh, POLL_MS);
    })();

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') refresh();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      mounted.current = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  return { ...state, refresh };
};
