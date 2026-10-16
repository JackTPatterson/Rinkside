import * as Haptics from 'expo-haptics';
import React, {memo, useCallback, useMemo, useState} from 'react';
import {View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Svg, {Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop} from 'react-native-svg';
import {useAppTheme} from '../theme';
import {T} from './ui';

/* ---------------------------------------------------------------- curves */
// monotone-curve:begin (pure helpers, no imports; exercised by a standalone Node check)
const fmt2 = (v) => (Math.round(v * 100) / 100).toString();

// Fritsch–Carlson tangent at an interior point (same rule as d3.curveMonotoneX).
// Works for decreasing x as well, so a path can be traced right-to-left.
function slope3(x0, y0, x1, y1, x2, y2) {
    const h0 = x1 - x0;
    const h1 = x2 - x1;
    const s0 = h0 ? (y1 - y0) / h0 : 0;
    const s1 = h1 ? (y2 - y1) / h1 : 0;
    const p = h0 + h1 ? (s0 * h1 + s1 * h0) / (h0 + h1) : 0;
    return (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

// One-sided tangent for the end points.
function slope2(x0, y0, x1, y1, t) {
    const h = x1 - x0;
    return h ? (3 * (y1 - y0) / h - t) / 2 : t;
}

/**
 * SVG path through pts ([{x, y}], already in pixels) using monotone cubic interpolation:
 * it passes through every point and never overshoots between them. `cmd` is the command
 * used for the first point ('M' to start a path, 'L' to continue one).
 */
export function monotonePath(pts, cmd = 'M') {
    const n = pts.length;
    if (!n) return '';
    const head = `${cmd}${fmt2(pts[0].x)},${fmt2(pts[0].y)}`;
    if (n === 1) return head;
    if (n === 2) return `${head} L${fmt2(pts[1].x)},${fmt2(pts[1].y)}`;
    const t = new Array(n);
    for (let i = 1; i < n - 1; i++) t[i] = slope3(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    t[0] = slope2(pts[0].x, pts[0].y, pts[1].x, pts[1].y, t[1]);
    t[n - 1] = slope2(pts[n - 1].x, pts[n - 1].y, pts[n - 2].x, pts[n - 2].y, t[n - 2]);
    let d = head;
    for (let i = 0; i < n - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = (b.x - a.x) / 3;
        d += ` C${fmt2(a.x + dx)},${fmt2(a.y + dx * t[i])} ${fmt2(b.x - dx)},${fmt2(b.y - dx * t[i + 1])} ${fmt2(b.x)},${fmt2(b.y)}`;
    }
    return d;
}

/** Straight segments (used for curve="linear", e.g. step-like series). */
export function linearPath(pts, cmd = 'M') {
    return pts.map((p, k) => `${k ? 'L' : cmd}${fmt2(p.x)},${fmt2(p.y)}`).join(' ');
}
// monotone-curve:end

export const pathFor = (curve) => (curve === 'linear' ? linearPath : monotonePath);

/**
 * Builds the line / fill / band paths for a chart.
 * xy: [{x, y}] pixel points of the series; bandXY: optional [{x, hi, lo}] pixel points.
 */
export function chartPaths(xy, {baseY, height, bandXY, curve}) {
    const draw = pathFor(curve);
    const line = draw(xy);
    const x0 = fmt2(xy[0].x);
    const x1 = fmt2(xy[xy.length - 1].x);
    // Closed to the bottom edge (single-colour fill) …
    const area = `${line} L${x1},${height} L${x0},${height} Z`;
    // … or to the baseline (two-sided fill; the halves are separated with clip paths).
    const areaBase = baseY != null ? `${line} L${x1},${fmt2(baseY)} L${x0},${fmt2(baseY)} Z` : null;
    let bandPath = null;
    if (bandXY && bandXY.length > 1) {
        const up = draw(bandXY.map((b) => ({x: b.x, y: b.hi})));
        const down = draw([...bandXY].reverse().map((b) => ({x: b.x, y: b.lo})), 'L');
        bandPath = `${up} ${down} Z`;
    }
    const ys = xy.map((p) => p.y);
    return {line, area, areaBase, bandPath, yTop: Math.min(...ys), yBottom: Math.max(...ys)};
}

const FILL_OPACITY = 0.35;

/**
 * Gradient area fill under / around the line.
 *  - with a baseline and colorBelow: `color` fills between the line and the baseline where the
 *    line is above it (fading down to the baseline), `colorBelow` where it is below (fading up),
 *    split exactly at the crossing with clip paths;
 *  - otherwise a single `color` gradient fading toward the bottom.
 */
export function AreaFill({id, geom, width, height, color, colorBelow, baseY}) {
    const split = colorBelow && baseY != null && geom.areaBase;
    if (!split) {
        return (
            <>
                <Defs>
                    <LinearGradient id={`${id}f`} x1="0" y1={geom.yTop} x2="0" y2={height} gradientUnits="userSpaceOnUse">
                        <Stop offset="0" stopColor={color} stopOpacity={FILL_OPACITY}/>
                        <Stop offset="1" stopColor={color} stopOpacity={0}/>
                    </LinearGradient>
                </Defs>
                <Path d={geom.area} fill={`url(#${id}f)`}/>
            </>
        );
    }
    const by = Math.max(0, Math.min(height, baseY));
    const hasAbove = geom.yTop < by - 0.5;
    const hasBelow = geom.yBottom > by + 0.5;
    return (
        <>
            <Defs>
                {hasAbove ? (
                    <LinearGradient id={`${id}a`} x1="0" y1={geom.yTop} x2="0" y2={by} gradientUnits="userSpaceOnUse">
                        <Stop offset="0" stopColor={color} stopOpacity={FILL_OPACITY}/>
                        <Stop offset="1" stopColor={color} stopOpacity={0}/>
                    </LinearGradient>
                ) : null}
                {hasBelow ? (
                    <LinearGradient id={`${id}b`} x1="0" y1={geom.yBottom} x2="0" y2={by} gradientUnits="userSpaceOnUse">
                        <Stop offset="0" stopColor={colorBelow} stopOpacity={FILL_OPACITY}/>
                        <Stop offset="1" stopColor={colorBelow} stopOpacity={0}/>
                    </LinearGradient>
                ) : null}
                <ClipPath id={`${id}ca`}>
                    <Rect x={0} y={0} width={width} height={by}/>
                </ClipPath>
                <ClipPath id={`${id}cb`}>
                    <Rect x={0} y={by} width={width} height={height - by}/>
                </ClipPath>
            </Defs>
            {hasAbove ? (
                <G clipPath={`url(#${id}ca)`}>
                    <Path d={geom.areaBase} fill={`url(#${id}a)`}/>
                </G>
            ) : null}
            {hasBelow ? (
                <G clipPath={`url(#${id}cb)`}>
                    <Path d={geom.areaBase} fill={`url(#${id}b)`}/>
                </G>
            ) : null}
        </>
    );
}

/**
 * Lightweight SVG line chart with press-and-drag scrubbing.
 *
 * props:
 *  data:      [{y: number, label?: string}]  (non-finite y values are skipped)
 *  color:     line colour
 *  height:    px (default 180)
 *  title:     optional heading; the current / scrubbed value is shown on the right
 *  format:    (y) => string for the value readout
 *  baseline:  draw a dashed reference line at this y (e.g. 0 or 0.5)
 *  colorBelow: if set with `baseline`, the line and its gradient fill use this colour below
 *              the baseline (win-probability / differential charts: one team above, the other
 *              below). Without it the area under the line gets a single `color` gradient.
 *  band:      [{lo, hi}] same length as data — shaded interval (e.g. projection range)
 *  yDomain:   [min, max] to fix the scale
 *  markers:   [{index, color}] dots (e.g. goals)
 *  curve:     'monotone' (default, smooth without overshoot) or 'linear' (straight segments,
 *              for step-like series)
 */
function LineChart({
    data,
    color,
    height = 180,
    title,
    format = (v) => (Number.isFinite(v) ? v.toFixed(0) : '–'),
    baseline,
    colorBelow,
    band,
    yDomain,
    markers,
    style,
    width: fixedWidth,
    curve = 'monotone',
}) {
    const {colors, fonts} = useAppTheme();
    const [width, setWidth] = useState(fixedWidth ?? 0);
    const [active, setActive] = useState(null);
    const stroke = color ?? colors.text;
    const pad = {top: 8, bottom: 8, left: 2, right: 2};

    const points = useMemo(() => (data ?? []).map((d, i) => ({i, y: Number(d?.y), label: d?.label})).filter((p) => Number.isFinite(p.y)), [data]);

    const geom = useMemo(() => {
        if (!width || points.length < 2) return null;
        let min = yDomain?.[0];
        let max = yDomain?.[1];
        if (min == null || max == null) {
            const ys = points.map((p) => p.y);
            if (band) band.forEach((b) => b && ys.push(b.lo, b.hi));
            if (baseline != null) ys.push(baseline);
            min = min ?? Math.min(...ys);
            max = max ?? Math.max(...ys);
        }
        if (max === min) {
            max += 1;
            min -= 1;
        }
        const n = data.length;
        const x = (i) => pad.left + (i / Math.max(1, n - 1)) * (width - pad.left - pad.right);
        const y = (v) => pad.top + (1 - (v - min) / (max - min)) * (height - pad.top - pad.bottom);
        const baseY = baseline != null ? y(baseline) : null;
        const bandXY = band
            ? band.map((b, i) => (b && Number.isFinite(b.lo) && Number.isFinite(b.hi) ? {x: x(i), hi: y(b.hi), lo: y(b.lo)} : null)).filter(Boolean)
            : null;
        const paths = chartPaths(points.map((p) => ({x: x(p.i), y: y(p.y)})), {baseY, height, bandXY, curve});
        return {x, y, ...paths, baseY, min, max, n};
    }, [width, points, height, yDomain, band, baseline, data, curve]);

    const indexAt = useCallback((px) => {
        if (!geom || !points.length) return null;
        const raw = Math.round(((px - pad.left) / (width - pad.left - pad.right)) * (geom.n - 1));
        // snap to nearest defined point
        let best = points[0];
        for (const p of points) if (Math.abs(p.i - raw) < Math.abs(best.i - raw)) best = p;
        return best.i;
    }, [geom, points, width]);

    const update = useCallback((px) => {
        const i = indexAt(px);
        setActive((prev) => {
            if (prev !== i) Haptics.selectionAsync().catch(() => {});
            return i;
        });
    }, [indexAt]);

    // Horizontal drag scrubs; vertical drag is left to the parent ScrollView.
    const gesture = useMemo(() => Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onBegin((e) => update(e.x))
        .onUpdate((e) => update(e.x))
        .onFinalize(() => setActive(null)), [update]);

    const last = points[points.length - 1];
    const shown = active != null ? points.find((p) => p.i === active) : last;
    const gradId = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
    const splitId = `${gradId}s`;

    const lineStroke = baseline != null && colorBelow && geom ? `url(#${splitId})` : stroke;
    const splitOffset = geom && baseline != null ? Math.max(0, Math.min(1, (geom.y(baseline)) / height)) : 0.5;

    return (
        <View style={style}>
            {title || shown ? (
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8}}>
                    <View style={{flex: 1}}>
                        {title ? <T variant="label" muted>{title}</T> : null}
                        <T variant="caption" muted style={{opacity: shown?.label ? 1 : 0}}>{shown?.label ?? ' '}</T>
                    </View>
                    <T variant="stat">{shown ? format(shown.y) : '–'}</T>
                </View>
            ) : null}
            <GestureDetector gesture={gesture}>
                <View
                    style={{height}}
                    onLayout={fixedWidth ? undefined : (e) => setWidth(e.nativeEvent.layout.width)}
                    accessibilityRole="image"
                    accessibilityLabel={title ? `${title} chart, latest ${shown ? format(shown.y) : 'unavailable'}` : undefined}>
                    {geom ? (
                        <Svg width={width} height={height}>
                            <Defs>
                                {colorBelow ? (
                                    <LinearGradient id={splitId} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
                                        <Stop offset={splitOffset} stopColor={stroke}/>
                                        <Stop offset={splitOffset} stopColor={colorBelow}/>
                                    </LinearGradient>
                                ) : null}
                            </Defs>
                            {geom.bandPath ? <Path d={geom.bandPath} fill={stroke} opacity={0.15}/> : null}
                            <AreaFill id={gradId} geom={geom} width={width} height={height} color={stroke} colorBelow={colorBelow} baseY={geom.baseY}/>
                            {baseline != null ? (
                                <Line x1={0} x2={width} y1={geom.y(baseline)} y2={geom.y(baseline)} stroke={colors.textSecondary} strokeDasharray="4 4" strokeWidth={1} opacity={0.6}/>
                            ) : null}
                            <Path d={geom.line} stroke={lineStroke} strokeWidth={2.25} fill="none" strokeLinejoin="round" strokeLinecap="round"/>
                            {markers?.map((m, k) => {
                                const p = points.find((pp) => pp.i === m.index);
                                return p ? <Circle key={k} cx={geom.x(p.i)} cy={geom.y(p.y)} r={4} fill={m.color ?? stroke} stroke={colors.background} strokeWidth={1.5}/> : null;
                            })}
                            {active != null && shown ? (
                                <>
                                    <Line x1={geom.x(shown.i)} x2={geom.x(shown.i)} y1={0} y2={height} stroke={colors.textSecondary} strokeWidth={1}/>
                                    <Circle cx={geom.x(shown.i)} cy={geom.y(shown.y)} r={5} fill={stroke} stroke={colors.background} strokeWidth={2}/>
                                </>
                            ) : null}
                        </Svg>
                    ) : (
                        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                            <T variant="caption" muted>{points.length < 2 && width ? 'Not enough data yet' : ''}</T>
                        </View>
                    )}
                </View>
            </GestureDetector>
        </View>
    );
}

export default memo(LineChart);
