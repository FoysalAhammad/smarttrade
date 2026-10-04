import { CandleLike } from '../strategy/engine';

export type ChartInterval = '1m' | '5m' | '15m' | '1h' | '4h';

export const INTERVAL_OPTIONS: { id: ChartInterval; label: string }[] = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
];

export interface KlineEvent {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  closed: boolean;
}

const WS_HOSTS = [
  'wss://stream.binance.com:9443',
  'wss://stream.binance.us:9443',
];

const REST_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
];

export const fetchKlines = async (
  symbol = 'SUIUSDT',
  interval: ChartInterval = '1m',
  limit = 150,
): Promise<CandleLike[]> => {
  const query = `symbol=${symbol}&interval=${interval}&limit=${limit}`;
  let lastError: unknown;
  for (const host of REST_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/klines?${query}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as (string | number)[][];
      return rows.map((r) => ({
        t: Number(r[0]),
        o: Number(r[1]),
        h: Number(r[2]),
        l: Number(r[3]),
        c: Number(r[4]),
        v: Number(r[5]),
      }));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Klines fetch failed');
};

interface KlineStreamMsg {
  e: string;
  k: {
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
    x: boolean;
  };
}

/**
 * Live kline WebSocket with auto-reconnect. Calls onKline for every tick of
 * the forming candle (~250ms–1s cadence) and when a candle closes.
 */
export class KlineStream {
  private ws: WebSocket | null = null;

  private stopped = false;

  private hostIndex = 0;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private retryDelay = 1000;

  constructor(
    private readonly symbol: string,
    private readonly interval: ChartInterval,
    private readonly onKline: (ev: KlineEvent) => void,
    private readonly onStatus?: (connected: boolean) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.onStatus?.(false);
  }

  private open(): void {
    if (this.stopped) return;
    const host = WS_HOSTS[this.hostIndex % WS_HOSTS.length];
    const stream = `${this.symbol.toLowerCase()}@kline_${this.interval}`;
    try {
      const ws = new WebSocket(`${host}/ws/${stream}`);
      this.ws = ws;
      ws.onopen = () => {
        if (this.stopped) return;
        this.retryDelay = 1000;
        this.onStatus?.(true);
      };
      ws.onmessage = (evt) => {
        if (this.stopped) return;
        try {
          const msg = JSON.parse(String(evt.data)) as KlineStreamMsg;
          if (msg.e !== 'kline' || !msg.k) return;
          this.onKline({
            t: msg.k.t,
            o: Number(msg.k.o),
            h: Number(msg.k.h),
            l: Number(msg.k.l),
            c: Number(msg.k.c),
            v: Number(msg.k.v),
            closed: msg.k.x,
          });
        } catch {
          /* partial frame — ignore */
        }
      };
      ws.onerror = () => {
        /* handled by onclose */
      };
      ws.onclose = () => {
        if (this.stopped) return;
        this.onStatus?.(false);
        this.hostIndex += 1;
        this.retryTimer = setTimeout(() => this.open(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 1.8, 15000);
      };
    } catch {
      this.retryTimer = setTimeout(() => this.open(), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 1.8, 15000);
    }
  }
}
