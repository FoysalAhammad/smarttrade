export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const groupInteger = (intPart: string): string =>
  intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const formatNumber = (value: number, decimals: number): string => {
  if (!Number.isFinite(value)) return '—';
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const sign = value < 0 ? '-' : '';
  return decPart ? `${sign}${groupInteger(intPart)}.${decPart}` : `${sign}${groupInteger(intPart)}`;
};

/** Market price display — SUIUSDT tick size is 0.0001 (4 decimals). */
export const formatPrice = (value: number): string => formatNumber(value, 4);

/** Coin amounts — SUIUSDT step size is 0.1. */
export const formatSui = (value: number, decimals = 2): string => formatNumber(value, decimals);

/** USDT money values. */
export const formatUsdt = (value: number, decimals = 2): string => formatNumber(value, decimals);

export const formatPct = (value: number, decimals = 2): string =>
  `${value > 0 ? '+' : ''}${formatNumber(value, decimals)}%`;

export const signedClass = (value: number): 'up' | 'down' | 'flat' =>
  value > 0 ? 'up' : value < 0 ? 'down' : 'flat';

export const roundToStep = (value: number, step: number): number => {
  if (step <= 0) return value;
  return Math.floor(value / step + 1e-9) * step;
};

export const roundToTick = (value: number, tick = 0.0001): number =>
  Math.round(value / tick) * tick;

export const timeLabel = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Stable calendar-day key (device local time) for grouping history by date. */
export const dayKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

/** "Today" / "Yesterday" / "12 Oct 2026" label for a timestamp. */
export const dayLabel = (ts: number): string => {
  const now = new Date();
  const d = new Date(ts);
  const today = dayKey(now.getTime());
  const yesterday = dayKey(now.getTime() - 86400000);
  const key = dayKey(ts);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "12 Oct 2026, 14:32" style stamp for history rows. */
export const dateTimeLabel = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
};
