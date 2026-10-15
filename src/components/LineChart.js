import * as Haptics from 'expo-haptics';
import React, {memo, useCallback, useMemo, useState} from 'react';
import {View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Svg, {Circle, Defs, Line, LinearGradient, Path, Stop} from 'react-native-svg';
import {useAppTheme} from '../theme';
import {T} from './ui';

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
 *  colorBelow: if set with `baseline`, the line is coloured differently below it
 *              (used for win-probability charts: one team's colour above, the other's below)
 *  band:      [{lo, hi}] same length as data — shaded interval (e.g. projection range)
 *  yDomain:   [min, max] to fix the scale
 *  markers:   [{index, color}] dots (e.g. goals)
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
        const line = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
        const area = `${line} L${x(points[points.length - 1].i).toFixed(1)},${height} L${x(points[0].i).toFixed(1)},${height} Z`;
        let bandPath = null;
        if (band) {
            const idx = band.map((b, i) => (b && Number.isFinite(b.lo) && Number.isFinite(b.hi) ? i : -1)).filter((i) => i >= 0);
            if (idx.length > 1) {
                const up = idx.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(band[i].hi).toFixed(1)}`).join(' ');
                const down = [...idx].reverse().map((i) => `L${x(i).toFixed(1)},${y(band[i].lo).toFixed(1)}`).join(' ');
                bandPath = `${up} ${down} Z`;
            }
        }
        return {x, y, line, area, bandPath, min, max, n};
    }, [width, points, height, yDomain, band, baseline, data]);

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
                                <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={stroke} stopOpacity={0.28}/>
                                    <Stop offset="1" stopColor={stroke} stopOpacity={0}/>
                                </LinearGradient>
                                {colorBelow ? (
                                    <LinearGradient id={splitId} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
                                        <Stop offset={splitOffset} stopColor={stroke}/>
                                        <Stop offset={splitOffset} stopColor={colorBelow}/>
                                    </LinearGradient>
                                ) : null}
                            </Defs>
                            {geom.bandPath ? <Path d={geom.bandPath} fill={stroke} opacity={0.15}/> : null}
                            {!colorBelow ? <Path d={geom.area} fill={`url(#${gradId})`}/> : null}
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
