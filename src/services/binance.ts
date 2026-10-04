import CryptoJS from 'crypto-js';

import { Credentials } from './credentials';

/** Public market-data hosts, tried in order (handles geo blocks / outages). */
const PUBLIC_HOSTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://data-api.binance.vision',
];

/** Signed REST hosts. */
const PRIVATE_HOSTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

const REQUEST_TIMEOUT_MS = 8000;
const RECV_WINDOW = 5000;

export class BinanceApiError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'BinanceApiError';
    this.code = code;
  }
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

export interface AccountBalances {
  /** Every asset's FREE balance (uppercase code → amount). */
  assets: Record<string, number>;
  suiFree: number;
  suiLocked: number;
  usdtFree: number;
  usdtLocked: number;
  updateTime: number;
}

/** ms drift between local clock and Binance server clock. */
let serverTimeOffset = 0;

const buildQuery = (params: Record<string, string | number | boolean>): string =>
  Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .map((k) => `${k}=${encodeURIComponent(String(params[k]))}`)
    .join('&');

const fetchWithTimeout = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const isHostFailure = (res: Response): boolean =>
  res.status === 451 || res.status === 403 || res.status === 520 || res.status === 521 ||
  res.status === 522 || res.status === 523 || res.status === 524 || res.status >= 500;

const parseError = async (res: Response): Promise<BinanceApiError> => {
  let code: number | undefined;
  let msg = `HTTP ${res.status}`;
  try {
    const data = (await res.json()) as { code?: number; msg?: string };
    if (data && typeof data.msg === 'string') {
      code = data.code;
      msg = `${data.msg}${code !== undefined ? ` (${code})` : ''}`;
    }
  } catch {
    /* keep default message */
  }
  return new BinanceApiError(msg, code);
};

/** GET a public endpoint with host failover. */
export const publicRequest = async <T>(
  path: string,
  params: Record<string, string | number | boolean> = {},
): Promise<T> => {
  const query = buildQuery(params);
  const url = (host: string) => `${host}${path}${query ? `?${query}` : ''}`;

  let lastError: unknown;
  for (const host of PUBLIC_HOSTS) {
    try {
      const res = await fetchWithTimeout(url(host));
      if (res.ok) return (await res.json()) as T;
      const err = await parseError(res);
      if (!isHostFailure(res)) throw err;
      lastError = err;
    } catch (e) {
      if (e instanceof BinanceApiError && !isHostFailureLike(e)) throw e;
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new BinanceApiError('Binance API unreachable');
};

const isHostFailureLike = (e: BinanceApiError): boolean =>
  e.code === undefined && e.message.includes('HTTP');

const syncServerTime = async (): Promise<void> => {
  const data = await publicRequest<{ serverTime: number }>('/api/v3/time');
  serverTimeOffset = data.serverTime - Date.now();
};

const signedRequest = async <T>(
  credentials: Credentials,
  path: string,
  params: Record<string, string | number | boolean> = {},
  isRetry = false,
): Promise<T> => {
  const query = buildQuery({
    ...params,
    recvWindow: RECV_WINDOW,
    timestamp: Date.now() + serverTimeOffset,
  });
  const signature = CryptoJS.HmacSHA256(query, credentials.apiSecret).toString(
    CryptoJS.enc.Hex,
  );
  const signedQuery = `${query}&signature=${signature}`;
  const headers = { 'X-MBX-APIKEY': credentials.apiKey };

  let lastError: unknown;
  for (const host of PRIVATE_HOSTS) {
    try {
      const res = await fetchWithTimeout(`${host}${path}?${signedQuery}`, { headers });
      if (res.ok) return (await res.json()) as T;
      const err = await parseError(res);
      // -1021 = timestamp outside recvWindow → resync clock and retry once
      if (err.code === -1021 && !isRetry) {
        await syncServerTime();
        return signedRequest<T>(credentials, path, params, true);
      }
      if (!isHostFailure(res)) throw err;
      lastError = err;
    } catch (e) {
      if (e instanceof BinanceApiError && !isHostFailureLike(e)) throw e;
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new BinanceApiError('Binance API unreachable');
};

export const getTicker24h = async (symbol = 'SUIUSDT'): Promise<Ticker24h> => {
  const raw = await publicRequest<{
    symbol: string;
    lastPrice: string;
    priceChange: string;
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
  }>('/api/v3/ticker/24hr', { symbol });

  return {
    symbol: raw.symbol,
    lastPrice: Number(raw.lastPrice),
    priceChange: Number(raw.priceChange),
    priceChangePercent: Number(raw.priceChangePercent),
    highPrice: Number(raw.highPrice),
    lowPrice: Number(raw.lowPrice),
    volume: Number(raw.volume),
    quoteVolume: Number(raw.quoteVolume),
  };
};

/** Prices for many markets in one call (symbols up to ~40 per request). */
export const getPrices = async (symbols: string[]): Promise<Record<string, number>> => {
  if (!symbols.length) return {};
  const out: Record<string, number> = {};
  for (let i = 0; i < symbols.length; i += 40) {
    const chunk = symbols.slice(i, i + 40);
    // publicRequest's buildQuery URL-encodes values — pass raw JSON.
    const rows = await publicRequest<{ symbol: string; price: string }[]>(
      '/api/v3/ticker/price',
      { symbols: JSON.stringify(chunk) },
    );
    for (const r of rows) out[r.symbol] = Number(r.price);
  }
  return out;
};

export const getPrice = async (symbol = 'SUIUSDT'): Promise<number> => {
  const raw = await publicRequest<{ price: string }>('/api/v3/ticker/price', { symbol });
  return Number(raw.price);
};

export const getBalances = async (credentials: Credentials): Promise<AccountBalances> => {
  const raw = await signedRequest<{
    balances: { asset: string; free: string; locked: string }[];
    updateTime: number;
  }>(credentials, '/api/v3/account');

  const find = (asset: string) => {
    const row = raw.balances.find((b) => b.asset === asset);
    return row ? { free: Number(row.free), locked: Number(row.locked) } : { free: 0, locked: 0 };
  };
  const sui = find('SUI');
  const usdt = find('USDT');
  const assets: Record<string, number> = {};
  for (const b of raw.balances) {
    const free = Number(b.free);
    if (Number.isFinite(free) && free > 0) assets[b.asset] = free;
  }

  return {
    assets,
    suiFree: sui.free,
    suiLocked: sui.locked,
    usdtFree: usdt.free,
    usdtLocked: usdt.locked,
    updateTime: raw.updateTime || Date.now(),
  };
};

/** Validates key/secret by calling /api/v3/account. */
export const testCredentials = async (
  credentials: Credentials,
): Promise<{ ok: boolean; message: string }> => {
  try {
    const acc = await getBalances(credentials);
    return { ok: true, message: `Connected · SUI ${acc.suiFree.toFixed(2)}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Connection failed';
    return { ok: false, message };
  }
};

export interface TradeFees {
  maker: number;
  taker: number;
}

/**
 * Exact spot trading fees for the account (VIP tier aware), e.g. 0.00075 = 0.075%.
 * Requires API key reading permission — GET /sapi/v1/asset/tradeFee.
 */
export const getTradeFee = async (
  credentials: Credentials,
  symbol = 'SUIUSDT',
): Promise<TradeFees> => {
  const rows = await signedRequest<
    { symbol: string; makerCommission: string; takerCommission: string }[]
  >(credentials, '/sapi/v1/asset/tradeFee', { symbol });

  const row = Array.isArray(rows)
    ? rows.find((r) => r.symbol === symbol) ?? rows[0]
    : undefined;
  if (!row) throw new BinanceApiError('No trade fee returned for symbol');

  const maker = Number(row.makerCommission);
  const taker = Number(row.takerCommission);
  if (!Number.isFinite(maker) || !Number.isFinite(taker)) {
    throw new BinanceApiError('Invalid trade fee payload');
  }
  return { maker, taker };
};
