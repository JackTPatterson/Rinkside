import React, {memo, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, G, Line} from 'react-native-svg';
import RinkSvg from '../../components/RinkSvg';
import {ArrowLeft, ArrowRight} from '../../components/icons';
import {EmptyState, Row, Segmented, T, TeamLogo, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {loc, num, periodLabel} from '../../utils/format';
import {OptionSheet, SelectRow, type as typo} from './common';
import {MAP_EVENTS, mapEvents, mapXGShots, shotTypeLabel} from './model';

/** NHL rink coordinates (x −100…100, y −42.5…42.5) → pixels on a full horizontal rink. */
export function mapToPixel(x, y, width, height, elementSize = 0) {
    const half = elementSize / 2;
    return {
        x: ((x + 100) / 200) * width - half,
        y: (1 - (y + 42.5) / 85) * height - half, // flip y: positive y is "up" on the rink diagram
    };
}

/**
 * Attacking-zone coordinates → pixels on the vertical half rink drawn with the net at the top
 * (centre line at the bottom). (x, y) must already be normalised so the shooter attacks toward +x.
 */
export function placeDotCoords(x, y, width, height, dotSize = 0) {
    return {
        x: ((42.5 - y) / 85) * width - dotSize / 2,
        y: ((100 - Math.max(0, Math.min(100, x))) / 100) * height - dotSize / 2,
    };
}

/** Full rink (two mirrored halves) with SVG dots. points: [{x, y, isHome, r?, goal?}] */
export const FullRink = memo(function FullRink({points, home, away, centerLogo = true, selectedKey, onPointPress}) {
    const {teamColor} = useAppTheme();
    const [width, setWidth] = useState(0);
    const height = Math.round(width * (85 / 200));
    const hc = teamColor(home);
    const ac = teamColor(away);
    return (
        <View
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={[styles.full, {height: height || 1}]}>
            {width ? (
                <>
                    <RinkSvg view="full" width={width} height={height} style={StyleSheet.absoluteFill}/>
                    {centerLogo ? (
                        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centerLogo]}>
                            <TeamLogo abbrev={home} size={height * 0.2} style={{opacity: 0.85}}/>
                        </View>
                    ) : null}
                    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                        {points.map((p, i) => {
                            const {x, y} = mapToPixel(p.x, p.y, width, height);
                            const r = p.r ?? 4.5;
                            const c = p.isHome ? hc : ac;
                            const key = p.key ?? i;
                            const sel = selectedKey != null && key === selectedKey;
                            const dimmed = selectedKey != null && !sel;
                            const press = onPointPress ? () => onPointPress(key) : undefined;
                            return (
                                <G key={key} opacity={dimmed ? 0.35 : 1} onPress={press}>
                                    {/* invisible hit area so small dots are still easy to tap */}
                                    {press ? <Circle cx={x} cy={y} r={Math.max(r + 4, 12)} fill="#000" fillOpacity={0.001}/> : null}
                                    {p.goal || sel ? <Circle cx={x} cy={y} r={r + 3.5} fill="none" stroke={c} strokeWidth={2}/> : null}
                                    {/* white outline keeps overlapping dots distinct on the ice */}
                                    <Circle cx={x} cy={y} r={r} fill={c} fillOpacity={p.goal ? 1 : p.r ? 0.6 : 0.9} stroke="#FFFFFF" strokeWidth={1.25}/>
                                </G>
                            );
                        })}
                    </Svg>
                </>
            ) : null}
        </View>
    );
});

/** Vertical half rink (net at top) with a crosshair at the shot location. */
export const HalfRink = memo(function HalfRink({x, y, color, width = 240}) {
    const height = Math.round(width * (100 / 85));
    const ok = Number.isFinite(x) && Number.isFinite(y);
    // Normalise so the shooter attacks toward +x.
    const nx = ok && x < 0 ? -x : x;
    const ny = ok && x < 0 ? -y : y;
    const dot = ok ? placeDotCoords(nx, ny, width, height) : null;
    return (
        <View style={[styles.half, {width, height}]}>
            <RinkSvg view="half" width={width} height={height}/>
            {dot ? (
                <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                    <G x={dot.x} y={dot.y}>
                        <Circle r={11} fill="none" stroke={color} strokeWidth={3}/>
                        <Circle r={3} fill={color}/>
                        <Line x1={-17} x2={-12} y1={0} y2={0} stroke={color} strokeWidth={3} strokeLinecap="round"/>
                        <Line x1={12} x2={17} y1={0} y2={0} stroke={color} strokeWidth={3} strokeLinecap="round"/>
                        <Line x1={0} x2={0} y1={-17} y2={-12} stroke={color} strokeWidth={3} strokeLinecap="round"/>
                        <Line x1={0} x2={0} y1={12} y2={17} stroke={color} strokeWidth={3} strokeLinecap="round"/>
                    </G>
                </Svg>
            ) : null}
        </View>
    );
});

const xgRadius = (xg) => 3 + Math.sqrt(Math.max(0, xg)) * 14;

const PERIODS = [
    {key: 'all', label: 'All'},
    {key: '1', label: 'P1'},
    {key: '2', label: 'P2'},
    {key: '3', label: 'P3'},
    {key: 'ot', label: 'OT'},
];

const inPeriod = (p, key) => key === 'all' || (key === 'ot' ? p.period > 3 : String(p.period) === key);

/** One team's side of the legend, laid out toward its own end: logo, attack direction, count (and xG). */
function TeamLegend({abbrev, count, xg, align}) {
    const {colors, teamColor} = useAppTheme();
    const right = align === 'right';
    return (
        <View style={[styles.legend, right && styles.legendRight]}>
            <Row gap={6} style={right ? styles.rowReverse : null}>
                <TeamLogo abbrev={abbrev} size={22}/>
                <T variant="body" style={typo.name}>{abbrev}</T>
                <View style={[styles.legendDot, {backgroundColor: teamColor(abbrev)}]}/>
            </Row>
            <T variant="body" style={[styles.count, right && styles.textRight]}>{count}</T>
            <Row gap={4} style={right ? styles.alignEnd : null}>
                {right ? null : <ArrowLeft size={12} color={colors.textSecondary}/>}
                <T variant="caption" muted>attacks{xg != null ? ` · ${num(xg, 2)} xG` : ''}</T>
                {right ? <ArrowRight size={12} color={colors.textSecondary}/> : null}
            </Row>
        </View>
    );
}

/**
 * "Rink Map" tab: any play-by-play event on the rink; the xG view sizes shots by quality. The home
 * team attacks left and the away team right, matching the scoreboard columns. Filter by team or
 * period, and tap a dot for who / when / what.
 */
function RinkMapTab({pbp, xg, header}) {
    const {teamColor} = useAppTheme();
    const [type, setType] = useState('xg');
    const [team, setTeam] = useState('all');
    const [period, setPeriod] = useState('all');
    const [selected, setSelected] = useState(null);
    const {home, away} = header;

    const all = useMemo(() => {
        if (!pbp) return [];
        if (type === 'xg') {
            return mapXGShots(pbp, xg).map((s, i) => ({...s, key: s.eventId ?? i, goal: s.goal, r: xgRadius(s.xg), xg: s.xg}));
        }
        return mapEvents(pbp, header, type).map((p, i) => ({...p, key: p.eventId ?? i, goal: type === 'goal'}));
    }, [pbp, xg, header, type]);

    const points = useMemo(
        () => all.filter((p) => (team === 'all' || (team === 'home') === p.isHome) && inPeriod(p, period)),
        [all, team, period],
    );
    const periods = useMemo(() => PERIODS.filter((o) => o.key === 'all' || all.some((p) => inPeriod(p, o.key))), [all]);

    const stats = useMemo(() => {
        const out = {h: 0, a: 0, hx: 0, ax: 0};
        for (const p of points) {
            if (p.isHome) {
                out.h++;
                out.hx += p.xg ?? 0;
            } else {
                out.a++;
                out.ax += p.xg ?? 0;
            }
        }
        return out;
    }, [points]);

    const names = useMemo(() => {
        const m = new Map();
        for (const r of pbp?.rosterSpots ?? []) m.set(r.playerId, `${String(loc(r.firstName)).charAt(0)}. ${loc(r.lastName)}`);
        return m;
    }, [pbp]);

    const sel = selected != null ? points.find((p) => p.key === selected) : null;
    const reset = () => setSelected(null);

    const [picker, setPicker] = useState(false);
    const options = useMemo(() => MAP_EVENTS.map((e) => ({key: e.key, label: e.label})), []);
    const selectedLabel = options.find((o) => o.key === type)?.label;

    return (
        <View>
            <SelectRow label="Select Stat" value={selectedLabel} onPress={() => setPicker(true)}/>
            <OptionSheet visible={picker} options={options} onSelect={(k) => {
                setType(k);
                reset();
            }} onClose={() => setPicker(false)}/>
            <Segmented
                style={styles.filter}
                value={team}
                onChange={(k) => {
                    setTeam(k);
                    reset();
                }}
                options={[
                    {key: 'all', label: 'Both'},
                    {key: 'home', label: home.abbrev, color: teamColor(home.abbrev)},
                    {key: 'away', label: away.abbrev, color: teamColor(away.abbrev)},
                ]}
            />
            {periods.length > 2 ? (
                <Segmented style={styles.filterSmall} value={period} onChange={(k) => {
                    setPeriod(k);
                    reset();
                }} options={periods}/>
            ) : null}
            <View style={{marginTop: 16}}>
                {pbp ? (
                    all.length ? (
                        <FullRink
                            points={points}
                            home={home.abbrev}
                            away={away.abbrev}
                            selectedKey={sel ? sel.key : null}
                            onPointPress={(k) => {
                                tap();
                                setSelected((cur) => (cur === k ? null : k));
                            }}
                        />
                    ) : (
                        <EmptyState message="Nothing to plot yet."/>
                    )
                ) : (
                    <EmptyState message="Play-by-play isn’t available for this game yet."/>
                )}
            </View>
            {/* Tapped dot: who, when, what. Tap again (or change a filter) to clear. */}
            <View style={styles.detail}>
                {sel ? (
                    <Row gap={8}>
                        <View style={[styles.legendDot, {backgroundColor: teamColor(sel.isHome ? home.abbrev : away.abbrev)}]}/>
                        <T variant="body" numberOfLines={1} style={[typo.name, styles.flex]}>
                            {names.get(sel.playerId) ?? (sel.isHome ? home.abbrev : away.abbrev)}
                        </T>
                        <T variant="body" numberOfLines={1} style={typo.sub}>
                            {[sel.goal && type !== 'goal' ? 'Goal' : null, sel.shotType ? shotTypeLabel(sel.shotType) : null, sel.period ? `${periodLabel(sel.period, sel.periodType)} ${sel.time ?? ''}`.trim() : null, sel.xg != null ? `${num(sel.xg, 2)} xG` : null]
                                .filter(Boolean)
                                .join(' • ')}
                        </T>
                    </Row>
                ) : all.length ? (
                    <T variant="caption" muted style={styles.center}>Tap a dot for details</T>
                ) : null}
            </View>
            <Row style={styles.legends}>
                <TeamLegend abbrev={home.abbrev} count={stats.h} xg={type === 'xg' ? stats.hx : null} align="left"/>
                <TeamLegend abbrev={away.abbrev} count={stats.a} xg={type === 'xg' ? stats.ax : null} align="right"/>
            </Row>
            {type === 'xg' ? (
                <Row gap={4} style={{justifyContent: 'center', marginTop: 16}}>
                    <T variant="caption" muted>Bigger dots are better chances · ringed dots are goals</T>
                </Row>
            ) : null}
        </View>
    );
}

export default memo(RinkMapTab);

const styles = StyleSheet.create({
    full: {width: '100%'},
    half: {alignSelf: 'center'},
    count: {fontFamily: 'Sora_600SemiBold', fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums']},
    flex: {flex: 1},
    center: {textAlign: 'center'},
    filter: {marginTop: 12},
    filterSmall: {marginTop: 8},
    detail: {minHeight: 32, justifyContent: 'center', marginTop: 8},
    legends: {justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8},
    legend: {gap: 2},
    legendRight: {alignItems: 'flex-end'},
    rowReverse: {flexDirection: 'row-reverse'},
    alignEnd: {justifyContent: 'flex-end'},
    textRight: {textAlign: 'right'},
    centerLogo: {alignItems: 'center', justifyContent: 'center'},
    legendDot: {width: 10, height: 10, borderRadius: 5},
});
