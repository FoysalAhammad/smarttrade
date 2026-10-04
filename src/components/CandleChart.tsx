import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { useCandles } from '../hooks/useCandles';
import { ChartInterval, INTERVAL_OPTIONS } from '../services/klines';
import { CandleLike } from '../strategy/engine';
import { useTheme } from '../theme';
import { formatPrice } from '../utils/format';

const PAD_TOP = 10;
const PAD_BOTTOM = 18;
const PAD_RIGHT = 58;
const AXIS_GAP = 4;

interface Geom {
  w: number;
  h: number;
  plotW: number;
  priceH: number;
  volTop: number;
  volH: number;
  slot: number;
  bodyW: number;
  /** Candle slots that fit the width at zoom 1. */
  baseCount: number;
  /** Slots currently visible (baseCount / zoom). */
  count: number;
  /** Global index of the first visible candle. */
  start: number;
  /** Candles between the live edge and the window end (0 = live). */
  effOffset: number;
  len: number;
  zoom: number;
  minP: number;
  maxP: number;
}

interface Visible {
  list: CandleLike[];
  offset: number;
}

const priceToY = (p: number, g: Geom): number => {
  const span = g.maxP - g.minP || 1;
  return PAD_TOP + ((g.maxP - p) / span) * g.priceH;
};

const yToPrice = (y: number, g: Geom): number => {
  const span = g.maxP - g.minP || 1;
  return g.maxP - ((y - PAD_TOP) / g.priceH) * span;
};

interface CandleChartProps {
  strategyScript: string;
  /** Active market, e.g. SUIUSDT (only *USDT pairs). */
  symbol: string;
  style?: ViewStyle;
  /** Fires true while a finger is on the chart — parent disables page scroll. */
  onChartTouchChange?: (touching: boolean) => void;
  /** Opens the coin picker — tapped from the pair title. */
  onPairPress?: () => void;
}

const CandleChartInner: React.FC<CandleChartProps> = ({ strategyScript, symbol, style, onChartTouchChange, onPairPress }) => {
  const t = useTheme();
  const [interval, setIntervalId] = useState<ChartInterval>('1m');
  const { candles, loading, error, wsLive, strategy } = useCandles(interval, strategyScript, symbol);
  const base = symbol.replace(/USDT$/, '');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cross, setCross] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetFromEnd, setOffsetFromEnd] = useState(0);
  const [chartTopY, setChartTopY] = useState(56);

  const geom = useMemo<Geom | null>(() => {
    const { w, h } = size;
    const len = candles.length;
    if (w < 40 || h < 40 || len < 2) return null;
    const plotW = Math.max(40, w - PAD_RIGHT);
    const totalH = h - PAD_TOP - PAD_BOTTOM;
    const volH = Math.round(totalH * 0.16);
    const priceH = totalH - volH - AXIS_GAP;
    const baseCount = Math.max(30, Math.min(96, Math.floor(plotW / 7.2)));
    const count = Math.max(10, Math.min(baseCount, Math.round(baseCount / zoom)));
    const maxOffset = Math.max(0, len - count);
    const effOffset = Math.max(0, Math.min(offsetFromEnd, maxOffset));
    const start = Math.max(0, len - count - effOffset);
    const slot = plotW / count;
    const bodyW = Math.max(3, Math.min(9, slot * 0.62));
    const visible = candles.slice(start, start + count);
    if (visible.length < 2) return null;
    let minP = Math.min(...visible.map((c) => c.l));
    let maxP = Math.max(...visible.map((c) => c.h));
    for (const plot of strategy.plots) {
      for (let i = start; i < start + visible.length; i += 1) {
        const v = plot.data[i];
        if (Number.isFinite(v) && v >= minP * 0.97 && v <= maxP * 1.03) {
          if (v < minP) minP = v;
          if (v > maxP) maxP = v;
        }
      }
    }
    const pad = (maxP - minP) * 0.07 || 0.01;
    return {
      w,
      h,
      plotW,
      priceH,
      volTop: PAD_TOP + priceH + AXIS_GAP,
      volH,
      slot,
      bodyW,
      baseCount,
      count,
      start,
      effOffset,
      len,
      zoom,
      minP: minP - pad,
      maxP: maxP + pad,
    };
  }, [size, candles, strategy.plots, zoom, offsetFromEnd]);

  const visible = useMemo<Visible>(() => {
    if (!geom) return { list: [], offset: 0 };
    return { list: candles.slice(geom.start, geom.start + geom.count), offset: geom.start };
  }, [candles, geom]);

  const lastPrice = candles.length ? candles[candles.length - 1].c : null;
  const priceUp = visible.list.length >= 2
    ? visible.list[visible.list.length - 1].c >= visible.list[0].o
    : true;

  const targetY = geom && lastPrice !== null ? priceToY(lastPrice, geom) : 0;
  const lineY = useSharedValue(0);
  const lineInit = useRef(false);
  useEffect(() => {
    if (targetY <= 0) return;
    if (!lineInit.current) {
      lineInit.current = true;
      lineY.value = targetY;
    } else {
      lineY.value = withTiming(targetY, { duration: 220 });
    }
  }, [targetY, lineY]);
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineY.value }],
  }));

  const pinch = useRef({
    active: false,
    zoom0: 1,
    lastZoom: 1,
    pan2Active: false,
    slot0: 1,
    off0: 0,
  });

  // Latest render state for the (created-once) gesture callbacks.
  const liveRef = useRef<{ geom: Geom | null; zoom: number; chartTop: number }>({
    geom: null,
    zoom: 1,
    chartTop: 56,
  });
  useEffect(() => {
    liveRef.current = { geom, zoom, chartTop: chartTopY };
  }, [geom, zoom, chartTopY]);

  const touchCbRef = useRef(onChartTouchChange);
  useEffect(() => {
    touchCbRef.current = onChartTouchChange;
  }, [onChartTouchChange]);

  const crossStart = (x: number, y: number) => {
    pinch.current.active = false;
    touchCbRef.current?.(true);
    // Only the plot area drives the crosshair — header taps just lock scroll.
    if (y < liveRef.current.chartTop) {
      setCross(null);
      return;
    }
    setCross({ x, y });
  };

  const crossMove = (x: number, y: number) => {
    if (pinch.current.active) return;
    if (y < liveRef.current.chartTop) return;
    setCross({ x, y });
  };

  const crossEnd = () => {
    setCross(null);
    touchCbRef.current?.(false);
  };

  const pinchStart = (focalX: number, focalY: number) => {
    void focalX;
    touchCbRef.current?.(true);
    const g = liveRef.current.geom;
    if (!g || focalY < liveRef.current.chartTop) return;
    const p = pinch.current;
    p.active = true;
    p.zoom0 = liveRef.current.zoom;
    p.lastZoom = p.zoom0;
    setCross(null);
  };

  // Pinch = pure zoom (anchored at the live/panned edge). Lateral moves are
  // handled by the dedicated two-finger Pan gesture so both never fight.
  const pinchUpdate = (scale: number) => {
    const p = pinch.current;
    if (!p.active) return;
    const newZoom = Math.max(1, Math.min(16, p.zoom0 * scale));
    p.lastZoom = newZoom;
    setZoom(newZoom);
  };

  // Two-finger pan (age/piche) — translation → candles from the live edge.
  const pan2Start = () => {
    const g = liveRef.current.geom;
    if (!g) return;
    const p = pinch.current;
    p.pan2Active = true;
    p.slot0 = g.slot;
    p.off0 = g.effOffset;
    touchCbRef.current?.(true);
  };

  const pan2Move = (translationX: number) => {
    const p = pinch.current;
    if (!p.pan2Active) return;
    const g = liveRef.current.geom;
    if (!g) return;
    const delta = Math.round(translationX / p.slot0);
    const maxOffset = Math.max(0, g.len - g.count);
    setOffsetFromEnd(Math.max(0, Math.min(p.off0 + delta, maxOffset)));
  };

  const pan2End = () => {
    pinch.current.pan2Active = false;
  };

  const pinchEnd = () => {
    touchCbRef.current?.(false);
    const p = pinch.current;
    if (p.active && p.lastZoom < 1.06) {
      setZoom(1);
      setOffsetFromEnd((o) => (o < 1 ? 0 : o));
    }
    p.active = false;
    setCross(null);
  };

  /* eslint-disable react-hooks/refs -- gesture callbacks run on events (not render); they read pinch/live refs at event time by design. */
  const gestures = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .activeOffsetX([-9999, 9999])
      .activeOffsetY([-9999, 9999])
      .onTouchesDown((e) => { const t = e.allTouches[0]; if (t) runOnJS(crossStart)(t.x, t.y); })
      .onTouchesMove((e) => { const t = e.allTouches[0]; if (t) runOnJS(crossMove)(t.x, t.y); })
      .onTouchesUp(() => runOnJS(crossEnd)())
      .onTouchesCancelled(() => runOnJS(crossEnd)());
    const pinchGesture = Gesture.Pinch()
      .onStart((e) => runOnJS(pinchStart)(e.focalX, e.focalY))
      .onUpdate((e) => runOnJS(pinchUpdate)(e.scale))
      .onEnd(() => runOnJS(pinchEnd)())
      .onFinalize(() => runOnJS(pinchEnd)());
    const pan2 = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onStart(() => runOnJS(pan2Start)())
      .onUpdate((e) => runOnJS(pan2Move)(e.translationX))
      .onEnd(() => runOnJS(pan2End)())
      .onFinalize(() => runOnJS(pan2End)());
    return Gesture.Simultaneous(pinchGesture, pan2, pan);
  }, []);
  /* eslint-enable react-hooks/refs */

  const g = geom;
  const crossIdx = useMemo(() => {
    if (!g || !cross) return null;
    if (!Number.isFinite(cross.x) || !Number.isFinite(cross.y)) return null;
    const raw = Math.max(0, Math.min(g.count - 1, Math.floor(cross.x / g.slot)));
    const rel = raw - (g.count - visible.list.length);
    if (rel < 0 || rel >= visible.list.length) return null;
    return { candle: visible.list[rel], idx: visible.offset + rel };
  }, [g, cross, visible]);

  const candleShapes = useMemo(() => {
    if (!g || !visible.list.length) return null;
    const maxVol = Math.max(...visible.list.map((c) => c.v), 1);
    const bodyW = g.bodyW;
    const candlesSvg: React.ReactNode[] = [];
    const vols: React.ReactNode[] = [];
    visible.list.forEach((c, i) => {
      const x = i * g.slot + g.slot / 2;
      const up = c.c >= c.o;
      const color = up ? t.colors.feedback.success : t.colors.feedback.danger;
      const yH = priceToY(c.h, g);
      const yL = priceToY(c.l, g);
      const yO = priceToY(c.o, g);
      const yC = priceToY(c.c, g);
      const bodyTop = Math.min(yO, yC);
      const bodyH = Math.max(1.2, Math.abs(yO - yC));
      candlesSvg.push(
        <Line
          key={`w${i}`}
          x1={x}
          y1={yH}
          x2={x}
          y2={yL}
          stroke={color}
          strokeWidth={1.1}
        />,
      );
      candlesSvg.push(
        <Rect
          key={`b${i}`}
          x={x - bodyW / 2}
          y={bodyTop}
          width={bodyW}
          height={bodyH}
          fill={color}
          rx={1}
        />,
      );
      const vH = Math.max(1, (c.v / maxVol) * g.volH);
      vols.push(
        <Rect
          key={`v${i}`}
          x={x - bodyW / 2}
          y={g.volTop + g.volH - vH}
          width={bodyW}
          height={vH}
          fill={color}
          opacity={0.32}
          rx={1}
        />,
      );
    });
    return (
      <>
        {vols}
        {candlesSvg}
      </>
    );
  }, [g, visible, t.colors.feedback.success, t.colors.feedback.danger]);

  const plotPaths = useMemo(() => {
    if (!g || !visible.list.length) return null;
    const nodes: React.ReactNode[] = [];
    strategy.plots.forEach((plot, pi) => {
      let d = '';
      let pen = false;
      for (let i = 0; i < visible.list.length; i += 1) {
        const v = plot.data[visible.offset + i];
        if (!Number.isFinite(v)) {
          pen = false;
          continue;
        }
        const x = i * g.slot + g.slot / 2;
        const y = priceToY(v, g);
        if (!pen) {
          d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
          pen = true;
        } else {
          d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }
      if (d) {
        nodes.push(<Path key={`p${pi}`} d={d} stroke={plot.color} strokeWidth={1.6} fill="none" />);
      }
    });
    const marks: React.ReactNode[] = [];
    const markSeries: { data: number[] | null; up: boolean; color: string }[] = [
      { data: strategy.buy, up: true, color: t.colors.feedback.success },
      { data: strategy.sell, up: false, color: t.colors.feedback.danger },
      ...strategy.signals.map((sg) => ({ data: sg.data as number[] | null, up: true, color: sg.color })),
    ];
    for (const s of markSeries) {
      if (!s.data) continue;
      for (let i = 0; i < visible.list.length; i += 1) {
        const gi = visible.offset + i;
        if (!s.data[gi]) continue;
        const c = visible.list[i];
        const x = i * g.slot + g.slot / 2;
        if (s.up) {
          const y = priceToY(c.l, g) + 3;
          marks.push(
            <Path
              key={`m${s.up ? 'b' : 's'}${gi}`}
              d={`M${x - 4.5} ${y + 8} L${x + 4.5} ${y + 8} L${x} ${y} Z`}
              fill={s.color}
            />,
          );
        } else {
          const y = priceToY(c.h, g) - 3;
          marks.push(
            <Path
              key={`m${s.up ? 'b' : 's'}${gi}`}
              d={`M${x - 4.5} ${y - 8} L${x + 4.5} ${y - 8} L${x} ${y} Z`}
              fill={s.color}
            />,
          );
        }
      }
    }
    return (
      <>
        {nodes}
        {marks}
      </>
    );
  }, [g, visible, strategy, t.colors.feedback.success, t.colors.feedback.danger]);

  const grid = useMemo(() => {
    if (!g) return null;
    const lines: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i += 1) {
      const p = g.minP + ((g.maxP - g.minP) * i) / steps;
      const y = priceToY(p, g);
      lines.push(
        <Line
          key={`g${i}`}
          x1={0}
          y1={y}
          x2={g.plotW}
          y2={y}
          stroke={t.colors.border.subtle}
          strokeWidth={0.6}
          strokeDasharray="3 4"
        />,
      );
      labels.push(
        <Text
          key={`gl${i}`}
          style={[styles.axisText, { color: t.colors.text.tertiary, top: y - 7 }]}
          numberOfLines={1}
        >
          {formatPrice(p)}
        </Text>,
      );
    }
    const times: React.ReactNode[] = [];
    const every = Math.max(1, Math.floor(visible.list.length / 4));
    visible.list.forEach((c, i) => {
      if (i % every !== 0 && i !== visible.list.length - 1) return;
      const d = new Date(c.t);
      const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const x = i * g.slot + g.slot / 2;
      times.push(
        <Text
          key={`t${i}`}
          style={[
            styles.axisTime,
            {
              color: t.colors.text.tertiary,
              left: Math.max(0, Math.min(x - 18, g.plotW - 40)),
            },
          ]}
        >
          {label}
        </Text>,
      );
    });
    return (
      <>
        {lines}
        {labels}
        {times}
      </>
    );
  }, [g, visible, t.colors.border.subtle, t.colors.text.tertiary]);

  const priceColor = priceUp ? t.colors.feedback.success : t.colors.feedback.danger;
  const showCross = cross !== null && crossIdx !== null && g !== null;

  return (
    <GestureDetector gesture={gestures}>
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: t.colors.bg.card,
          borderColor: t.colors.border.subtle,
        },
        t.shadows.card,
        style,
      ]}
    >
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text onPress={onPairPress} style={[styles.pair, { color: t.colors.text.primary }]}>
          {base}/USDT
        </Text>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: wsLive ? t.colors.feedback.success : t.colors.feedback.warning },
            ]}
          />
          <Text
            style={[
              styles.liveText,
              { color: wsLive ? t.colors.feedback.success : t.colors.feedback.warning },
            ]}
          >
            {wsLive ? 'LIVE' : loading ? 'LOADING' : 'REST'}
          </Text>
        </View>
        <View style={styles.intervals}>
          {(zoom > 1.03 || (geom?.effOffset ?? 0) > 0) && (
            <Text
              onPress={() => {
                setZoom(1);
                setOffsetFromEnd(0);
              }}
              style={[styles.intervalChip, styles.resetChip, { backgroundColor: t.colors.feedback.warningDim, color: t.colors.feedback.warning }]}
            >
              ⟲ {zoom >= 10 ? zoom.toFixed(0) : zoom.toFixed(1)}×
            </Text>
          )}
          <Text
            onPress={() => setZoom((z) => Math.max(1, Math.min(16, z / 1.5)))}
            style={[styles.intervalChip, styles.zoomStepBtn, { color: t.colors.text.secondary }]}
          >
            −50
          </Text>
          <Text
            onPress={() => setZoom((z) => Math.max(1, Math.min(16, z * 1.5)))}
            style={[styles.intervalChip, styles.zoomStepBtn, { color: t.colors.text.secondary }]}
          >
            +50
          </Text>
          {INTERVAL_OPTIONS.map((opt) => {
            const active = interval === opt.id;
            return (
              <Text
                key={opt.id}
                onPress={() => {
                  setCross(null);
                  setIntervalId(opt.id);
                }}
                style={[
                  styles.intervalChip,
                  {
                    backgroundColor: active ? t.colors.brand.primary : t.colors.bg.elevated,
                    color: active ? t.colors.text.onAccent : t.colors.text.secondary,
                  },
                ]}
              >
                {opt.label}
              </Text>
            );
          })}
        </View>
      </View>

        <View
          style={styles.chartBox}
          onLayout={(e) => {
            setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
            setChartTopY(e.nativeEvent.layout.y);
          }}
        >
        {g && (
          <>
            <Svg width={g.w} height={g.h} style={StyleSheet.absoluteFill}>
              {grid}
              {candleShapes}
              {plotPaths}
              {showCross && (
                <>
                  <Line
                    x1={Math.floor((cross as { x: number }).x / g.slot) * g.slot + g.slot / 2}
                    y1={PAD_TOP}
                    x2={Math.floor((cross as { x: number }).x / g.slot) * g.slot + g.slot / 2}
                    y2={g.h - PAD_BOTTOM}
                    stroke={t.colors.text.tertiary}
                    strokeWidth={0.7}
                    strokeDasharray="3 3"
                  />
                  <Line
                    x1={0}
                    y1={(cross as { y: number }).y}
                    x2={g.plotW}
                    y2={(cross as { y: number }).y}
                    stroke={t.colors.text.tertiary}
                    strokeWidth={0.7}
                    strokeDasharray="3 3"
                  />
                </>
              )}
            </Svg>

            {lastPrice !== null && targetY > 0 && (
              <Animated.View
                style={[styles.priceLine, { borderTopColor: priceColor }, lineStyle]}
                pointerEvents="none"
              >
                <View
                  style={[
                    styles.priceTag,
                    { backgroundColor: priceColor, right: 0, width: PAD_RIGHT - 6 },
                  ]}
                >
                  <Text style={styles.priceTagText} numberOfLines={1}>
                    {formatPrice(lastPrice)}
                  </Text>
                </View>
              </Animated.View>
            )}

            {showCross && crossIdx && (
              <View
                style={[
                  styles.tooltip,
                  {
                    backgroundColor: t.colors.bg.elevated,
                    borderColor: t.colors.border.strong,
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={[styles.tooltipTime, { color: t.colors.text.tertiary }]}>
                  {new Date(crossIdx.candle.t).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <View style={styles.tooltipRow}>
                  <Text style={[styles.tooltipLabel, { color: t.colors.text.tertiary }]}>O</Text>
                  <Text style={[styles.tooltipVal, { color: t.colors.text.primary }]}>
                    {formatPrice(crossIdx.candle.o)}
                  </Text>
                  <Text style={[styles.tooltipLabel, { color: t.colors.text.tertiary }]}>H</Text>
                  <Text style={[styles.tooltipVal, { color: t.colors.text.primary }]}>
                    {formatPrice(crossIdx.candle.h)}
                  </Text>
                </View>
                <View style={styles.tooltipRow}>
                  <Text style={[styles.tooltipLabel, { color: t.colors.text.tertiary }]}>L</Text>
                  <Text style={[styles.tooltipVal, { color: t.colors.text.primary }]}>
                    {formatPrice(crossIdx.candle.l)}
                  </Text>
                  <Text style={[styles.tooltipLabel, { color: t.colors.text.tertiary }]}>C</Text>
                  <Text
                    style={[
                      styles.tooltipVal,
                      {
                        color:
                          crossIdx.candle.c >= crossIdx.candle.o
                            ? t.colors.feedback.success
                            : t.colors.feedback.danger,
                      },
                    ]}
                  >
                    {formatPrice(crossIdx.candle.c)}
                  </Text>
                </View>
                <Text style={[styles.tooltipCross, { color: t.colors.text.tertiary }]}>
                  {formatPrice(yToPrice((cross as { y: number }).y, g))}
                </Text>
              </View>
            )}

            {cross !== null && g && (
              <View
                style={[
                  styles.crossPrice,
                  {
                    top: (cross as { y: number }).y - 9,
                    backgroundColor: t.colors.bg.elevated,
                    borderColor: t.colors.border.strong,
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={[styles.crossPriceText, { color: t.colors.text.primary }]}>
                  {formatPrice(yToPrice((cross as { y: number }).y, g))}
                </Text>
              </View>
            )}
          </>
        )}

        {!g && (
          <View style={styles.empty}>
            <Text style={{ color: t.colors.text.tertiary }}>
              {loading ? 'Loading candles…' : error ? `Chart error: ${error}` : 'No chart data'}
            </Text>
            </View>
          )}
        </View>

      <View style={styles.legend}>
        <View style={styles.legendLeft}>
          {strategy.plots.map((p, i) => (
            <View key={`lg${i}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: p.color }]} />
              <Text style={[styles.legendText, { color: t.colors.text.secondary }]}>
                {p.label} {formatPrice(p.data[p.data.length - 1])}
              </Text>
            </View>
          ))}
          {strategy.buy && (
            <View style={styles.legendItem}>
              <Text style={[styles.legendText, { color: t.colors.feedback.success }]}>
                ▲ {strategy.buy.reduce((a, b) => a + b, 0)}
              </Text>
            </View>
          )}
          {strategy.sell && (
            <View style={styles.legendItem}>
              <Text style={[styles.legendText, { color: t.colors.feedback.danger }]}>
                ▼ {strategy.sell.reduce((a, b) => a + b, 0)}
              </Text>
            </View>
          )}
          {!strategy.plots.length && !strategy.buy && !strategy.sell && (
            <Text style={[styles.legendMuted, { color: t.colors.text.tertiary }]}>
              Add a signal in Settings → Strategy script
            </Text>
          )}
        </View>
        <Text style={[styles.legendMuted, { color: t.colors.text.tertiary }]}>
          {interval} · {visible.list.length} candles{" "}
          {zoom > 1.03 ? `· ${zoom.toFixed(1)}× zoom` : ''}
        </Text>
      </View>

      {strategy.error && (
        <Text style={[styles.scriptError, { color: t.colors.feedback.danger }]}>
          {strategy.error}
        </Text>
      )}
    </View>
    </GestureDetector>
  );
};

export const CandleChart = React.memo(CandleChartInner);

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pair: { fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
  liveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  intervals: { flexDirection: 'row', gap: 5 },
  intervalChip: {
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: 'hidden',
  },
  zoomStepBtn: { backgroundColor: '#151A21', borderColor: '#2E3742', borderWidth: StyleSheet.hairlineWidth },
  resetChip: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(240,185,11,0.6)' },
  chartBox: { height: 264, width: '100%' },
  axisText: {
    position: 'absolute',
    right: 0,
    width: PAD_RIGHT - 4,
    fontSize: 9.5,
    fontWeight: '600',
    textAlign: 'right',
  },
  axisTime: { position: 'absolute', bottom: 0, fontSize: 9, fontWeight: '600' },
  priceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  priceTag: {
    position: 'absolute',
    top: -8,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  priceTagText: { color: '#04111F', fontSize: 9.5, fontWeight: '800' },
  tooltip: {
    position: 'absolute',
    left: 6,
    top: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  tooltipTime: { fontSize: 9.5, fontWeight: '600' },
  tooltipRow: { flexDirection: 'row', gap: 6, alignItems: 'baseline' },
  tooltipLabel: { fontSize: 9.5, fontWeight: '700', width: 9 },
  tooltipVal: { fontSize: 10.5, fontWeight: '700', marginRight: 4 },
  tooltipCross: { fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  crossPrice: {
    position: 'absolute',
    right: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  crossPriceText: { fontSize: 9.5, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  legendLeft: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10.5, fontWeight: '600' },
  legendMuted: { fontSize: 10, fontWeight: '500' },
  scriptError: { fontSize: 10.5, fontWeight: '600' },
});
