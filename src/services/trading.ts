import { DEFAULT_STRATEGY } from '../strategy/engine';

/**
 * SUI/USDT spot swing trading math.
 *
 * Two switchable strategies (Settings → Trading method):
 *
 *  Method 1 — SELL FIRST (spot swing down):
 *    User already holds SUI → sells at market → waits for a dip → buys back
 *    lower. Profit shows in extra coins:  reentryPrice < sellPrice
 *
 *  Method 2 — BUY FIRST (spot long):
 *    User buys at market → waits for a rise → sells higher. Profit shows in
 *    USDT (expressed in SUI at the entry price):  targetSellPrice > buyPrice
 *
 * Binance VIP maker/taker fee: 0.075% per trade leg (0.15% round trip),
 * auto-fetchable from /sapi/v1/asset/tradeFee when API keys are connected.
 *
 * Fee mechanics (Binance spot default):
 *  - BUY  → commission taken from received asset (SUI): netSui  = gross * (1 - fee)
 *  - SELL → commission taken from received asset (USDT): netUsdt = gross * (1 - fee)
 */

export const DEFAULT_FEE_RATE = 0.00075; // 0.075% per leg
export const ROUND_TRIP_FEE_RATE = DEFAULT_FEE_RATE * 2; // 0.15%

/** SUIUSDT exchange rules */
export const PRICE_TICK = 0.0001;
export const AMOUNT_STEP = 0.1;
export const MIN_NOTIONAL_USDT = 5;

/** Buffer around the exact target price that counts as "target zone". */
export const ZONE_BUFFER = 0.002; // 0.2%

/** Base asset of a USDT-quoted market ('BTCUSDT' → 'BTC'). */
export const baseOf = (symbol: string): string => symbol.replace(/USDT$/, '');

/** Lot size for a market — SUI keeps its 0.1 step, others scale with price. */
export const amountStep = (symbol: string, price: number): number => {
  if (symbol === 'SUIUSDT') return AMOUNT_STEP;
  if (!Number.isFinite(price) || price <= 0) return 0.00001;
  if (price >= 10000) return 0.0001;
  if (price >= 100) return 0.001;
  if (price >= 1) return 0.01;
  return 0.00001;
};

/** Safe reader for demo balances (uppercase keys, tolerates legacy lowercase). */
export const demoAsset = (wallet: DemoWallet, asset: string): number => {
  const key = asset.toUpperCase();
  const v = wallet[key];
  if (typeof v === 'number') return v;
  const legacy = wallet[key.toLowerCase()];
  return typeof legacy === 'number' ? legacy : 0;
};

export type TradingMethod = 'sell_first' | 'buy_first';
export type FeeSource = 'default' | 'manual' | 'auto';
export type AppMode = 'live' | 'demo';

/** Wallet/exchange balance at a moment in time (entry/exit snapshots). */
export interface BalanceSnapshot {
  sui: number;
  usdt: number;
}

/** Tracked open position — one per market. */
export interface Position {
  symbol: string;
  amount: number;
  entryPrice: number;
  updatedAt: number;
}

/** An armed swing cycle. `baselinePrice` is the logged sell (method 1) or buy (method 2). */
/** Open journal pair (entry → pending exit) for one market. */
export interface SwingCycle {
  symbol: string;
  method: TradingMethod;
  baselinePrice: number;
  baselineAmount: number;
  targetGain: number;
  /** Lower re-entry price (method 1) or higher target sell price (method 2). */
  targetPrice: number;
  startedAt: number;
  /** Account balance captured when the cycle was armed (for history rows). */
  entryBalance?: BalanceSnapshot;
}

export interface CycleResult {
  method: TradingMethod;
  baselinePrice: number;
  baselineAmount: number;
  exitPrice: number;
  exitAmount: number;
  /** Net profit in SUI terms after fees (coins for method 1, SUI-equivalent for method 2). */
  securedSui: number;
  /** Net USDT profit after fees (method 2 primary metric). */
  securedUsdt: number;
  completedAt: number;
}

/**
 * A completed swing trade (one row in History).
 * Method 1: entry = the logged SELL, exit = the re-buy.
 * Method 2: entry = the logged BUY,   exit = the take-profit SELL.
 */
/** Completed cycle row (History + P&L). */
export interface TradeRecord {
  symbol: string;
  id: string;
  method: TradingMethod;
  completedAt: number;
  /** SUI amount traded on both legs. */
  amount: number;
  entryPrice: number;
  exitPrice: number;
  feeRate: number;
  /** Combined fee of both legs, in USDT (≈ amount × (entry + exit) × feeRate). */
  feeUsdt: number;
  /** Net profit after all fees. */
  profitSui: number;
  profitUsdt: number;
  /** Account balance snapshots before entry / after exit (absent if unknown). */
  entryBalance?: BalanceSnapshot;
  exitBalance?: BalanceSnapshot;
}

/** Multi-asset paper wallet: uppercase asset codes → amount (e.g. { SUI, USDT, BTC }). */
export interface DemoWallet {
  [asset: string]: number;
}

export interface Settings {
  /** Active market, e.g. SUIUSDT — only *USDT pairs are tradable. */
  activeSymbol: string;
  feeRate: number;
  feeSource: FeeSource;
  targetGain: number;
  method: TradingMethod;
  mode: AppMode;
  demoWallet: DemoWallet;
  /** Pine-style signal script rendered live on the chart. */
  strategyScript: string;
  /** When false no target cycles arm — journal-only manual buy/sell. */
  targetEnabled: boolean;
  /** First-launch privacy policy consent — must be accepted before use. */
  privacyAccepted: boolean;
}

export const DEMO_START_SUI = 1000;
export const DEMO_START_USDT = 10000;

export const DEFAULT_SETTINGS: Settings = {
  feeRate: DEFAULT_FEE_RATE,
  feeSource: 'default',
  targetGain: 5,
  method: 'sell_first',
  mode: 'live',
  activeSymbol: 'SUIUSDT',
  demoWallet: { SUI: DEMO_START_SUI, USDT: DEMO_START_USDT },
  strategyScript: DEFAULT_STRATEGY,
  targetEnabled: true,
  privacyAccepted: false,
};

export type CycleStatus = 'waiting' | 'zone' | 'hit';

/** USDT remaining after selling `amount` SUI at `price` (fee on proceeds). */
export const sellProceeds = (amount: number, price: number, fee: number): number =>
  amount * price * (1 - fee);

/** Net SUI received when spending `usdt` at `price` (fee on received coin). */
export const buyNetSui = (usdt: number, price: number, fee: number): number =>
  price > 0 ? (usdt / price) * (1 - fee) : 0;

/** USDT required to end up with exactly `amount` SUI after the buy fee. */
export const buyCostUsdt = (amount: number, price: number, fee: number): number =>
  (amount * price) / (1 - fee);

/**
 * METHOD 1 — exact LOWER re-entry price that nets `targetGain` extra SUI after
 * the full round trip (sell fee + buy fee):
 *
 *   netSui = baselineAmount * baselinePrice * (1 - fee)^2 / reentryPrice
 *   netSui = baselineAmount + targetGain
 *   ⇒ reentryPrice = baselineAmount * baselinePrice * (1 - fee)^2 / (baselineAmount + targetGain)
 */
export const calcReentryPrice = (
  sellAmount: number,
  sellPrice: number,
  targetGain: number,
  fee: number = DEFAULT_FEE_RATE,
): number => {
  if (sellAmount <= 0 || sellPrice <= 0) return 0;
  const denominator = sellAmount + targetGain;
  if (denominator <= 0) return 0;
  return (sellAmount * sellPrice * Math.pow(1 - fee, 2)) / denominator;
};

/**
 * METHOD 2 — exact HIGHER target sell price that nets `targetGain` SUI-equivalent
 * profit after the full round trip, given a baseline buy of `amount` @ `buyPrice`:
 *
 *   costUsdt       = amount * buyPrice / (1 - fee)          (buy fee paid in SUI)
 *   exitUsdt       = amount * targetPrice * (1 - fee)       (sell fee paid in USDT)
 *   netUsdt        = exitUsdt - costUsdt
 *   netUsdt        = targetGain * buyPrice                  (target expressed in SUI)
 *   ⇒ targetPrice  = buyPrice * (amount + targetGain * (1 - fee)) / (amount * (1 - fee)^2)
 */
export const calcTargetSellPrice = (
  buyAmount: number,
  buyPrice: number,
  targetGain: number,
  fee: number = DEFAULT_FEE_RATE,
): number => {
  if (buyAmount <= 0 || buyPrice <= 0) return 0;
  const oneMinus = 1 - fee;
  return (buyPrice * (buyAmount + targetGain * oneMinus)) / (buyAmount * oneMinus * oneMinus);
};

/** Net profit (fee-adjusted) of an armed cycle if exited at `price`, in SUI terms. */
export const projectNetGain = (
  cycle: Pick<SwingCycle, 'method' | 'baselineAmount' | 'baselinePrice'>,
  price: number,
  fee: number = DEFAULT_FEE_RATE,
): number => {
  if (price <= 0) return 0;
  if (cycle.method === 'sell_first') {
    // Sell high, rebuy lower → profit in coins.
    const proceeds = sellProceeds(cycle.baselineAmount, cycle.baselinePrice, fee);
    const rebought = (proceeds / price) * (1 - fee);
    return rebought - cycle.baselineAmount;
  }
  // Buy low, sell higher → profit in USDT, shown in SUI at the entry price.
  const costUsdt = buyCostUsdt(cycle.baselineAmount, cycle.baselinePrice, fee);
  const exitUsdt = sellProceeds(cycle.baselineAmount, price, fee);
  return (exitUsdt - costUsdt) / cycle.baselinePrice;
};

export interface PositionPnl {
  grossValue: number;
  grossPnlUsdt: number;
  costUsdt: number;
  exitProceedsUsdt: number;
  netPnlUsdt: number;
  netPnlSui: number;
  netPnlPct: number;
  estFeesUsdt: number;
}

/**
 * Open position P&L with the full round trip deducted:
 *  - cost basis carries the entry fee (0.075% paid in SUI → more USDT spent)
 *  - exit proceeds carry the sell fee (0.075% paid in USDT)
 * Net result is expressed in USDT and converted to SUI at the live price.
 */
export const calcPositionPnl = (
  position: Pick<Position, 'amount' | 'entryPrice'>,
  marketPrice: number,
  fee: number = DEFAULT_FEE_RATE,
): PositionPnl => {
  const { amount, entryPrice } = position;
  const grossValue = amount * marketPrice;
  const grossPnlUsdt = amount * (marketPrice - entryPrice);
  const costUsdt = buyCostUsdt(amount, entryPrice, fee);
  const exitProceedsUsdt = sellProceeds(amount, marketPrice, fee);
  const netPnlUsdt = exitProceedsUsdt - costUsdt;
  const netPnlSui = marketPrice > 0 ? netPnlUsdt / marketPrice : 0;
  const netPnlPct = costUsdt > 0 ? (netPnlUsdt / costUsdt) * 100 : 0;
  const estFeesUsdt = grossPnlUsdt - netPnlUsdt;

  return {
    grossValue,
    grossPnlUsdt,
    costUsdt,
    exitProceedsUsdt,
    netPnlUsdt,
    netPnlSui,
    netPnlPct,
    estFeesUsdt,
  };
};

/** Status of an armed cycle vs the live price (direction-aware). */
export const getCycleStatus = (
  price: number,
  targetPrice: number,
  method: TradingMethod = 'sell_first',
): CycleStatus => {
  if (targetPrice <= 0 || price <= 0) return 'waiting';
  if (method === 'sell_first') {
    if (price <= targetPrice) return 'hit';
    if (price <= targetPrice * (1 + ZONE_BUFFER)) return 'zone';
    return 'waiting';
  }
  if (price >= targetPrice) return 'hit';
  if (price >= targetPrice * (1 - ZONE_BUFFER)) return 'zone';
  return 'waiting';
};

/** Progress toward the net coin-gain target, 0..1 (clamped). */
export const getTargetProgress = (
  cycle: Pick<SwingCycle, 'method' | 'baselineAmount' | 'baselinePrice' | 'targetGain'>,
  price: number,
  fee: number = DEFAULT_FEE_RATE,
): number => {
  if (cycle.targetGain <= 0) return 1;
  const projected = projectNetGain(cycle, price, fee);
  return clampNumber(projected / cycle.targetGain, 0, 1);
};

/** Demo (paper) wallet mutations — fees applied exactly like Binance spot. */
export const applyDemoBuy = (
  wallet: DemoWallet,
  base: string,
  grossAmount: number,
  price: number,
  fee: number,
): DemoWallet => ({
  ...wallet,
  USDT: demoAsset(wallet, 'USDT') - grossAmount * price,
  [base.toUpperCase()]: demoAsset(wallet, base) + grossAmount * (1 - fee),
});

export const applyDemoSell = (
  wallet: DemoWallet,
  base: string,
  amount: number,
  price: number,
  fee: number,
): DemoWallet => ({
  ...wallet,
  USDT: demoAsset(wallet, 'USDT') + amount * price * (1 - fee),
  [base.toUpperCase()]: demoAsset(wallet, base) - amount,
});

const clampNumber = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
