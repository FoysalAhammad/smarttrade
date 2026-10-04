export interface CandleLike {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface StrategyPlot {
  data: number[];
  color: string;
  label: string;
}

export interface StrategySignal {
  data: number[];
  color: string;
}

export interface StrategyOutput {
  plots: StrategyPlot[];
  buy: number[] | null;
  sell: number[] | null;
  /** Extra markers from plotchar()/plotshape() — rendered as coloured triangles. */
  signals: StrategySignal[];
  error: string | null;
}

/** Common Pine-script colour names (plus our own aliases). */
const COLORS: Record<string, string> = {
  teal: '#00D9FF',
  cyan: '#00D9FF',
  aqua: '#00D9FF',
  green: '#0ECB81',
  lime: '#A3E635',
  red: '#F6465D',
  blue: '#4C8DFF',
  navy: '#1E3A8A',
  orange: '#F7B733',
  yellow: '#F0B90B',
  purple: '#AB47BC',
  violet: '#AB47BC',
  magenta: '#E040FB',
  pink: '#FF6B9D',
  white: '#EAECEF',
  black: '#0B0E11',
  gray: '#7A8390',
  grey: '#7A8390',
  silver: '#A7B0BA',
  maroon: '#8B1E2D',
  olive: '#6B8E23',
  brown: '#8B5A2B',
  gold: '#FFD700',
};

const PLOT_PALETTE = ['#00D9FF', '#F7B733', '#AB47BC', '#A3E635', '#4C8DFF', '#E040FB'];

export const DEFAULT_STRATEGY = [
  '// Your signal — runs live on the chart',
  'fast = ema(close, 9)',
  'slow = ema(close, 21)',
  'plot(fast, color=teal)',
  'plot(slow, color=orange)',
  'buy = crossover(fast, slow)',
  'sell = crossunder(fast, slow)',
].join('\n');

type Token =
  | { k: 'num'; v: number; line: number }
  | { k: 'ident'; v: string; line: number }
  | { k: 'color'; v: string; line: number }
  | { k: 'str'; v: string; line: number }
  | { k: 'op'; v: string; line: number };

class StrategyError extends Error {
  line: number;

  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

const tokenize = (src: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '#') {
      const m = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/.exec(src.slice(i));
      if (m) {
        let hex = m[1].toLowerCase();
        if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
        tokens.push({ k: 'color', v: `#${hex}`, line });
        i += m[0].length;
        continue;
      }
      throw new StrategyError('Expected a hex colour like #00D9FF', line);
    }
    if (ch === '"') {
      let j = i + 1;
      let out = '';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < n) {
          out += src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === '\n') line += 1;
        out += src[j];
        j += 1;
      }
      if (j >= n) throw new StrategyError('Unterminated string', line);
      tokens.push({ k: 'str', v: out, line });
      i = j + 1;
      continue;
    }
    if ((ch >= '0' && ch <= '9') || (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      const m = /^\d*\.?\d+/.exec(src.slice(i));
      if (m) {
        tokens.push({ k: 'num', v: Number.parseFloat(m[0]), line });
        i += m[0].length;
        continue;
      }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?/.exec(src.slice(i));
      if (m) {
        tokens.push({ k: 'ident', v: m[0], line });
        i += m[0].length;
        continue;
      }
    }
    const two = src.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '>=' || two === '<=') {
      tokens.push({ k: 'op', v: two, line });
      i += 2;
      continue;
    }
    if ('+-*/%=<>(),:?'.includes(ch)) {
      tokens.push({ k: 'op', v: ch, line });
      i += 1;
      continue;
    }
    throw new StrategyError(`Unexpected character '${ch}'`, line);
  }
  return tokens;
};

type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'color'; v: string; line: number }
  | { t: 'ref'; name: string; line: number }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'un'; op: string; x: Node }
  | { t: 'cond'; c: Node; a: Node; b: Node }
  | { t: 'call'; name: string; args: Node[]; named: Record<string, Node>; line: number };

interface AssignStmt {
  name: string;
  line: number;
  expr: Node;
}

interface PlotStmt {
  line: number;
  call: Node & { t: 'call' };
}

/** Header/one-shot calls that are parsed then ignored (indicator(), input.* …). */
const IGNORED_CALLS = new Set([
  'indicator', 'study', 'strategy', 'library', 'alertcondition', 'hline',
  'bgcolor', 'barcolor', 'vline', 'fill', 'plotchar', 'plotshape',
]);
const SIGNAL_CALLS = new Set(['plotchar', 'plotshape']);
const PLOT_CALLS = new Set(['plot']);

class Parser {
  private tokens: Token[];

  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private next(): Token {
    const tok = this.tokens[this.pos];
    if (!tok) throw new StrategyError('Unexpected end of script', 1);
    this.pos += 1;
    return tok;
  }

  private expectOp(op: string): void {
    const tok = this.next();
    if (tok.k !== 'op' || tok.v !== op) throw new StrategyError(`Expected '${op}'`, tok.line);
  }

  private parseCallBody(nameTok: Token): Node & { t: 'call' } {
    if (nameTok.k !== 'ident') throw new StrategyError('Expected a function name', nameTok.line);
    this.expectOp('(');
    const args: Node[] = [];
    const named: Record<string, Node> = {};
    if (!(this.peek()?.k === 'op' && (this.peek() as Token).v === ')')) {
      for (;;) {
        const a = this.peek();
        const aNext = this.peek(1);
        if (a && a.k === 'ident' && aNext && aNext.k === 'op' && aNext.v === '=') {
          this.next();
          this.next();
          named[a.v.toLowerCase()] = this.parseExpr();
        } else {
          args.push(this.parseExpr());
        }
        const sep = this.peek();
        if (sep && sep.k === 'op' && sep.v === ',') {
          this.next();
          continue;
        }
        break;
      }
    }
    this.expectOp(')');
    return { t: 'call', name: nameTok.v, args, named, line: nameTok.line };
  }

  parseProgram(): {
    assigns: AssignStmt[];
    plots: PlotStmt[];
    signals: PlotStmt[];
  } {
    const assigns: AssignStmt[] = [];
    const plots: PlotStmt[] = [];
    const signals: PlotStmt[] = [];
    while (this.peek()) {
      const tok = this.peek() as Token;
      if (tok.k !== 'ident') {
        throw new StrategyError('Expected a variable, plot(...) or indicator(...)', tok.line);
      }
      const isCall = (this.peek(1) as Token)?.k === 'op' && (this.peek(1) as Token).v === '(';
      if (isCall) {
        const call = this.parseCallBody(this.next());
        const base = call.name.toLowerCase();
        if (PLOT_CALLS.has(base)) {
          plots.push({ line: call.line, call });
        } else if (SIGNAL_CALLS.has(base)) {
          signals.push({ line: call.line, call });
        } else if (!IGNORED_CALLS.has(base)) {
          throw new StrategyError(
            `Unknown statement '${call.name}' — supported: plot, plotchar, plotshape, assignments`,
            call.line,
          );
        }
        continue;
      }
      this.next();
      if (tok.v.includes('.')) {
        throw new StrategyError(`'${tok.v}' cannot be assigned — use a plain name`, tok.line);
      }
      this.expectOp('=');
      const expr = this.parseExpr();
      assigns.push({ name: tok.v, line: tok.line, expr });
    }
    return { assigns, plots, signals };
  }

  private parseExpr(): Node {
    return this.parseTernary();
  }

  private parseTernary(): Node {
    const cond = this.parseOr();
    const q = this.peek();
    if (q && q.k === 'op' && q.v === '?') {
      this.next();
      const a = this.parseExpr();
      this.expectOp(':');
      const b = this.parseExpr();
      return { t: 'cond', c: cond, a, b };
    }
    return cond;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    for (;;) {
      const tok = this.peek();
      if (tok && tok.k === 'ident' && tok.v.toLowerCase() === 'or') {
        this.next();
        left = { t: 'bin', op: 'or', l: left, r: this.parseAnd() };
        continue;
      }
      return left;
    }
  }

  private parseAnd(): Node {
    let left = this.parseNot();
    for (;;) {
      const tok = this.peek();
      if (tok && tok.k === 'ident' && tok.v.toLowerCase() === 'and') {
        this.next();
        left = { t: 'bin', op: 'and', l: left, r: this.parseNot() };
        continue;
      }
      return left;
    }
  }

  private parseNot(): Node {
    const tok = this.peek();
    if (tok && tok.k === 'ident' && tok.v.toLowerCase() === 'not') {
      this.next();
      return { t: 'un', op: 'not', x: this.parseNot() };
    }
    return this.parseCompare();
  }

  private parseCompare(): Node {
    const left = this.parseAdd();
    const tok = this.peek();
    if (tok && tok.k === 'op' && ['>', '>=', '<', '<=', '==', '!='].includes(tok.v)) {
      this.next();
      return { t: 'bin', op: tok.v, l: left, r: this.parseAdd() };
    }
    return left;
  }

  private parseAdd(): Node {
    let left = this.parseMul();
    for (;;) {
      const tok = this.peek();
      if (tok && tok.k === 'op' && (tok.v === '+' || tok.v === '-')) {
        this.next();
        left = { t: 'bin', op: tok.v, l: left, r: this.parseMul() };
        continue;
      }
      return left;
    }
  }

  private parseMul(): Node {
    let left = this.parseUnary();
    for (;;) {
      const tok = this.peek();
      if (tok && tok.k === 'op' && (tok.v === '*' || tok.v === '/' || tok.v === '%')) {
        this.next();
        left = { t: 'bin', op: tok.v, l: left, r: this.parseUnary() };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): Node {
    const tok = this.peek();
    if (tok && tok.k === 'op' && tok.v === '-') {
      this.next();
      return { t: 'un', op: '-', x: this.parseUnary() };
    }
    if (tok && tok.k === 'ident' && tok.v.toLowerCase() === 'not') {
      this.next();
      return { t: 'un', op: 'not', x: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const tok = this.next();
    if (tok.k === 'num') return { t: 'num', v: tok.v };
    if (tok.k === 'str') return { t: 'str', v: tok.v };
    if (tok.k === 'color') return { t: 'color', v: tok.v, line: tok.line };
    if (tok.k === 'op' && tok.v === '(') {
      const expr = this.parseExpr();
      this.expectOp(')');
      return expr;
    }
    if (tok.k === 'ident') {
      const lower = tok.v.toLowerCase();
      if (lower === 'true') return { t: 'num', v: 1 };
      if (lower === 'false') return { t: 'num', v: 0 };
      const after = this.peek();
      const isCall = after && after.k === 'op' && after.v === '(';
      if (lower.startsWith('color.') && !isCall) {
        const named = COLORS[lower.slice(6)];
        if (!named) throw new StrategyError(`Unknown colour '${tok.v}'`, tok.line);
        return { t: 'color', v: named, line: tok.line };
      }
      if (isCall) {
        return this.parseCallBody(tok);
      }
      return { t: 'ref', name: tok.v, line: tok.line };
    }
    throw new StrategyError('Unexpected token', tok.line);
  }
}

type Value =
  | { scalar: number; series: null }
  | { scalar: null; series: number[] };

const S = (v: number): Value => ({ scalar: v, series: null });
const A = (v: number[]): Value => ({ scalar: null, series: v });

const toSeries = (v: Value, n: number): number[] => {
  if (v.series) return v.series;
  return new Array<number>(n).fill(v.scalar as number);
};

const bin = (op: string, l: Value, r: Value, n: number): Value => {
  if (l.scalar !== null && r.scalar !== null) {
    const a = l.scalar;
    const b = r.scalar;
    switch (op) {
      case '+': return S(a + b);
      case '-': return S(a - b);
      case '*': return S(a * b);
      case '/': return S(b === 0 ? NaN : a / b);
      case '%': return S(b === 0 ? NaN : a % b);
      case '>': return S(a > b ? 1 : 0);
      case '>=': return S(a >= b ? 1 : 0);
      case '<': return S(a < b ? 1 : 0);
      case '<=': return S(a <= b ? 1 : 0);
      case '==': return S(a === b ? 1 : 0);
      case '!=': return S(a !== b ? 1 : 0);
      case 'and': return S(a !== 0 && b !== 0 ? 1 : 0);
      case 'or': return S(a !== 0 || b !== 0 ? 1 : 0);
      default: throw new StrategyError(`Unknown operator '${op}'`, 1);
    }
  }
  const a = toSeries(l, n);
  const b = toSeries(r, n);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const x = a[i];
    const y = b[i];
    switch (op) {
      case '+': out[i] = x + y; break;
      case '-': out[i] = x - y; break;
      case '*': out[i] = x * y; break;
      case '/': out[i] = y === 0 ? NaN : x / y; break;
      case '%': out[i] = y === 0 ? NaN : x % y; break;
      case '>': out[i] = x > y ? 1 : 0; break;
      case '>=': out[i] = x >= y ? 1 : 0; break;
      case '<': out[i] = x < y ? 1 : 0; break;
      case '<=': out[i] = x <= y ? 1 : 0; break;
      case '==': out[i] = x === y ? 1 : 0; break;
      case '!=': out[i] = x !== y ? 1 : 0; break;
      case 'and': out[i] = x !== 0 && y !== 0 ? 1 : 0; break;
      case 'or': out[i] = x !== 0 || y !== 0 ? 1 : 0; break;
      default: out[i] = NaN;
    }
  }
  return A(out);
};

const rollSma = (src: number[], len: number, n: number): number[] => {
  const out = new Array<number>(n).fill(NaN);
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += src[i];
    if (i >= len) sum -= src[i - len];
    if (i >= len - 1) out[i] = sum / len;
  }
  return out;
};

const rollEma = (src: number[], len: number, n: number): number[] => {
  const out = new Array<number>(n).fill(NaN);
  if (n < len) return out;
  let seed = 0;
  for (let i = 0; i < len; i += 1) seed += src[i];
  out[len - 1] = seed / len;
  const alpha = 2 / (len + 1);
  for (let i = len; i < n; i += 1) out[i] = src[i] * alpha + out[i - 1] * (1 - alpha);
  return out;
};

const rollWma = (src: number[], len: number, n: number): number[] => {
  const out = new Array<number>(n).fill(NaN);
  const denom = (len * (len + 1)) / 2;
  for (let i = len - 1; i < n; i += 1) {
    let acc = 0;
    for (let j = 0; j < len; j += 1) acc += src[i - j] * (len - j);
    out[i] = acc / denom;
  }
  return out;
};

const rollExtreme = (src: number[], len: number, n: number, highest: boolean): number[] => {
  const out = new Array<number>(n).fill(NaN);
  for (let i = len - 1; i < n; i += 1) {
    let best = src[i - len + 1];
    for (let j = 1; j < len; j += 1) {
      const v = src[i - j];
      if (highest ? v > best : v < best) best = v;
    }
    out[i] = best;
  }
  return out;
};

const rollRsi = (src: number[], len: number, n: number): number[] => {
  const out = new Array<number>(n).fill(NaN);
  if (n <= len) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= len; i += 1) {
    const d = src[i] - src[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / len;
  let avgLoss = loss / len;
  out[len] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = len + 1; i < n; i += 1) {
    const d = src[i] - src[i - 1];
    avgGain = (avgGain * (len - 1) + Math.max(d, 0)) / len;
    avgLoss = (avgLoss * (len - 1) + Math.max(-d, 0)) / len;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
};

const rollRma = (src: number[], len: number, n: number): number[] => {
  const out = new Array<number>(n).fill(NaN);
  if (n < len) return out;
  let seed = 0;
  for (let i = 0; i < len; i += 1) seed += src[i];
  out[len - 1] = seed / len;
  for (let i = len; i < n; i += 1) out[i] = (out[i - 1] * (len - 1) + src[i]) / len;
  return out;
};

const hex2 = (v: number): string =>
  Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

export const runStrategy = (src: string, candles: CandleLike[]): StrategyOutput => {
  const empty: StrategyOutput = { plots: [], buy: null, sell: null, signals: [], error: null };
  const trimmed = src.trim();
  if (!trimmed) return empty;
  if (trimmed.length > 8000) return { ...empty, error: 'Script too long (max 8000 chars)' };

  const n = candles.length;
  if (n < 5) return empty;

  const env = new Map<string, Value>();

  const resolveColor = (node: Node): string => {
    if (node.t === 'color') return node.v;
    if (node.t === 'str') {
      const raw = node.v.trim();
      if (raw.startsWith('#')) {
        let hex = raw.slice(1).toLowerCase();
        if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
        if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
      }
      const named = COLORS[raw.toLowerCase()];
      if (named) return named;
      throw new StrategyError(`Unknown colour '${raw}'`, node.t === 'str' ? 1 : 1);
    }
    if (node.t === 'call') {
      const base = node.name.toLowerCase();
      if (base === 'color.new' || base === 'color.mix') {
        return resolveColor(node.args[0]);
      }
      if (base === 'color.rgb') {
        const comp = (i: number): number => {
          const a = node.args[i];
          if (!a) return 0;
          const v = a.t === 'num' ? a.v : 0;
          return v;
        };
        return `#${hex2(comp(0))}${hex2(comp(1))}${hex2(comp(2))}`;
      }
    }
    if (node.t === 'ref') {
      const named = COLORS[node.name.toLowerCase()];
      if (named) return named;
    }
    const ln = 'line' in node ? node.line : 1;
    throw new StrategyError('Expected a colour (e.g. color.teal, #00D9FF, teal)', ln);
  };

  const evalNode = (node: Node): Value => {
    switch (node.t) {
      case 'num':
        return S(node.v);
      case 'str':
        throw new StrategyError('Text values cannot be used in math', 1);
      case 'color':
        throw new StrategyError('Colours can only be used inside plot()/plotchar()', node.line);
      case 'ref': {
        const v = env.get(node.name);
        if (v) return v;
        throw new StrategyError(`Unknown variable '${node.name}' — assign it first`, node.line);
      }
      case 'un': {
        const x = evalNode(node.x);
        const arr = toSeries(x, n);
        if (node.op === 'not') return A(arr.map((v) => (v !== 0 && !Number.isNaN(v) ? 0 : 1)));
        return A(arr.map((v) => -v));
      }
      case 'cond': {
        const c = toSeries(evalNode(node.c), n);
        const a = evalNode(node.a);
        const b = evalNode(node.b);
        const av = toSeries(a, n);
        const bv = toSeries(b, n);
        return A(c.map((cv, i) => (cv !== 0 && !Number.isNaN(cv) ? av[i] : bv[i])));
      }
      case 'bin': {
        const l = evalNode(node.l);
        const r = evalNode(node.r);
        return bin(node.op, l, r, n);
      }
      case 'call':
        return evalCall(node);
    }
  };

  const evalCall = (node: Node & { t: 'call' }): Value => {
    const line = node.line;
    const rawName = node.name.toLowerCase();
    // Strip ta./math./input. namespaces (TradingView style).
    const name = rawName.startsWith('ta.')
      ? rawName.slice(3)
      : rawName.startsWith('math.')
        ? `math.${rawName.slice(5)}`
        : rawName.startsWith('input.')
          ? `input.${rawName.slice(6)}`
          : rawName;

    const argSeries = (idx: number): number[] => {
      const a = node.args[idx];
      if (!a) throw new StrategyError(`${node.name}() missing argument ${idx + 1}`, line);
      return toSeries(evalNode(a), n);
    };

    // Length args may be literals, plain vars or input.int(...) defaults.
    const evalLen = (idx: number, fn: string): number => {
      const a = node.args[idx];
      if (!a) throw new StrategyError(`${fn}() missing argument ${idx + 1}`, line);
      const v = evalNode(a);
      const raw = v.scalar !== null ? v.scalar : v.series[v.series.length - 1];
      const len = Math.round(raw);
      if (!Number.isFinite(raw) || len < 1 || len > 500) {
        throw new StrategyError(`${fn}(): length must be 1–500`, line);
      }
      return len;
    };

    if (name.startsWith('input.')) {
      // input.int(20, title=…) / input.float / input.bool → return the default value.
      const first = node.args[0];
      const defval = node.named.defval ?? node.named.value ?? first;
      if (!defval) return S(0);
      const v = evalNode(defval);
      return v;
    }

    switch (name) {
      case 'sma':
      case 'ema':
      case 'wma':
      case 'highest':
      case 'lowest':
      case 'rsi': {
        const srcSeries = argSeries(0);
        const len = evalLen(1, node.name);
        if (name === 'sma') return A(rollSma(srcSeries, len, n));
        if (name === 'ema') return A(rollEma(srcSeries, len, n));
        if (name === 'wma') return A(rollWma(srcSeries, len, n));
        if (name === 'rsi') return A(rollRsi(srcSeries, len, n));
        if (name === 'highest') return A(rollExtreme(srcSeries, len, n, true));
        return A(rollExtreme(srcSeries, len, n, false));
      }
      case 'atr': {
        const len = evalLen(0, 'atr');
        const tr = new Array<number>(n);
        for (let i = 0; i < n; i += 1) {
          const h = candles[i].h;
          const l = candles[i].l;
          if (i === 0) {
            tr[i] = h - l;
            continue;
          }
          const pc = candles[i - 1].c;
          tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        }
        return A(rollRma(tr, Math.max(1, Math.round(len)), n));
      }
      case 'crossover':
      case 'crossunder': {
        const a = argSeries(0);
        const b = argSeries(1);
        const out = new Array<number>(n).fill(0);
        for (let i = 1; i < n; i += 1) {
          if ([a[i], b[i], a[i - 1], b[i - 1]].some((v) => Number.isNaN(v))) continue;
          if (name === 'crossover') out[i] = a[i] > b[i] && a[i - 1] <= b[i - 1] ? 1 : 0;
          else out[i] = a[i] < b[i] && a[i - 1] >= b[i - 1] ? 1 : 0;
        }
        return A(out);
      }
      case 'math.abs':
        return A(argSeries(0).map((v) => Math.abs(v)));
      case 'math.sqrt':
        return A(argSeries(0).map((v) => (v < 0 ? NaN : Math.sqrt(v))));
      case 'math.round': {
        const a = argSeries(0);
        const dec = node.args[1] && node.args[1].t === 'num' ? node.args[1].v : 0;
        const f = Math.pow(10, dec);
        return A(a.map((v) => Math.round(v * f) / f));
      }
      case 'math.floor':
        return A(argSeries(0).map(Math.floor));
      case 'math.ceil':
        return A(argSeries(0).map(Math.ceil));
      case 'math.max': {
        const a = argSeries(0);
        const b = argSeries(1);
        return A(a.map((v, i) => Math.max(v, b[i])));
      }
      case 'math.min': {
        const a = argSeries(0);
        const b = argSeries(1);
        return A(a.map((v, i) => Math.min(v, b[i])));
      }
      case 'nz':
        return A(argSeries(0).map((v) => (Number.isNaN(v) ? 0 : v)));
      case 'abs':
        return A(argSeries(0).map((v) => Math.abs(v)));
      case 'sqrt':
        return A(argSeries(0).map((v) => (v < 0 ? NaN : Math.sqrt(v))));
      case 'max': {
        const a = argSeries(0);
        const b = argSeries(1);
        return A(a.map((v, i) => Math.max(v, b[i])));
      }
      case 'min': {
        const a = argSeries(0);
        const b = argSeries(1);
        return A(a.map((v, i) => Math.min(v, b[i])));
      }
      case 'fixnan':
        return A(argSeries(0).map((v) => (Number.isNaN(v) ? 0 : v)));
      default:
        throw new StrategyError(`Unknown function '${node.name}'`, line);
    }
  };

  try {
    const program = new Parser(tokenize(src)).parseProgram();

    env.set('close', A(candles.map((c) => c.c)));
    env.set('open', A(candles.map((c) => c.o)));
    env.set('high', A(candles.map((c) => c.h)));
    env.set('low', A(candles.map((c) => c.l)));
    env.set('volume', A(candles.map((c) => c.v)));
    env.set('hl2', A(candles.map((c) => (c.h + c.l) / 2)));
    env.set('hlc3', A(candles.map((c) => (c.h + c.l + c.c) / 3)));
    env.set('ohlc4', A(candles.map((c) => (c.o + c.h + c.l + c.c) / 4)));

    for (const a of program.assigns) {
      if (env.has(a.name)) throw new StrategyError(`'${a.name}' is a reserved name`, a.line);
      env.set(a.name, evalNode(a.expr));
    }

    const plots: StrategyPlot[] = program.plots.map((p, idx) => {
      const call = p.call;
      const seriesVal = call.args[0];
      if (!seriesVal) throw new StrategyError('plot() needs a series argument', p.line);
      const data = toSeries(evalNode(seriesVal), n);
      let color = PLOT_PALETTE[idx % PLOT_PALETTE.length];
      const colorNode = call.named.color ?? call.args[1];
      if (colorNode) color = resolveColor(colorNode);
      let label = `plot${idx + 1}`;
      if (call.named.title && call.named.title.t === 'str') label = call.named.title.v;
      else if (seriesVal.t === 'ref') label = seriesVal.name;
      return { data, color, label };
    });

    const signals: StrategySignal[] = program.signals.map((p) => {
      const call = p.call;
      const seriesVal = call.args[0];
      if (!seriesVal) throw new StrategyError(`${call.name}() needs a condition argument`, p.line);
      const data = toSeries(evalNode(seriesVal), n).map((v) =>
        Number.isNaN(v) ? 0 : v !== 0 ? 1 : 0,
      );
      const colorNode = call.named.color ?? call.args[2];
      const color = colorNode ? resolveColor(colorNode) : '#0ECB81';
      return { data, color };
    });

    const boolSeries = (name: string): number[] | null => {
      const v = env.get(name);
      if (!v) return null;
      return toSeries(v, n).map((x) => (Number.isNaN(x) ? 0 : x !== 0 ? 1 : 0));
    };

    return {
      plots,
      buy: boolSeries('buy'),
      sell: boolSeries('sell'),
      signals,
      error: null,
    };
  } catch (e) {
    if (e instanceof StrategyError) return { ...empty, error: `Line ${e.line}: ${e.message}` };
    return { ...empty, error: e instanceof Error ? e.message : 'Script failed' };
  }
};

const synthCandles = (count: number): CandleLike[] => {
  const out: CandleLike[] = [];
  let price = 1.2;
  for (let i = 0; i < count; i += 1) {
    const drift = Math.sin(i / 7) * 0.01 + Math.cos(i / 3) * 0.004;
    const o = price;
    const c = price + drift;
    const h = Math.max(o, c) + 0.004;
    const l = Math.min(o, c) - 0.004;
    out.push({ t: i * 60000, o, h, l, c, v: 1000 + (i % 9) * 100 });
    price = c;
  }
  return out;
};

export const validateStrategy = (src: string): { ok: true } | { ok: false; message: string } => {
  const result = runStrategy(src, synthCandles(80));
  if (result.error) return { ok: false, message: result.error };
  if (!result.plots.length && !result.buy && !result.sell && !result.signals.length) {
    return { ok: false, message: 'Nothing to draw — add plot(...), plotchar(...) or buy/sell lines.' };
  }
  return { ok: true };
};
