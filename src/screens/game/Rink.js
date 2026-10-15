import React, {memo, useMemo, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import Svg, {Circle, G, Line} from 'react-native-svg';
import {Card, EmptyState, InfoTip, PillTabs, Row, T, TeamLogo} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {num} from '../../utils/format';
import {MAP_EVENTS, mapEvents, mapXGShots} from './model';

const HORIZ = require('../../../assets/horiz_rink.png');
const HALF = require('../../../assets/half_rink.png');

// horiz_rink.png (438×397) is one half rink, net on the left. Its playing surface spans
// x 5…428 px (end boards → centre line, 100 ft) and y 17…376 px (85 ft).
const H_IMG = {w: 438, h: 397, left: 5, right: 428, top: 17, bottom: 376};
// half_rink.png (362×425) is a vertical half rink, net at the bottom: x 1…360 px (85 ft),
// y 1…424 px (centre line → end boards, 100 ft).
const V_IMG = {w: 362, h: 425, left: 1, right: 360, top: 1, bottom: 424};

/** NHL rink coordinates (x −100…100, y −42.5…42.5) → pixels on a full horizontal rink. */
export function mapToPixel(x, y, width, height, elementSize = 0) {
    const half = elementSize / 2;
    return {
        x: ((x + 100) / 200) * width - half,
        y: (1 - (y + 42.5) / 85) * height - half, // flip y: positive y is "up" on the rink diagram
    };
}

/**
 * Attacking-zone coordinates → pixels on the vertical half rink shown with the net at the top.
 * (x, y) must already be normalised so the shooter attacks toward +x.
 */
export function placeDotCoords(x, y, width, height, dotSize = 0) {
    const ftX = (V_IMG.right - V_IMG.left) / 85;
    const ftY = (V_IMG.bottom - V_IMG.top) / 100;
    const k = width / V_IMG.w;
    const col = V_IMG.left + (y + 42.5) * ftX; // unrotated image column
    const row = V_IMG.top + Math.max(0, Math.min(100, x)) * ftY; // unrotated image row
    // The image is shown rotated 180° (net at the top).
    return {x: (V_IMG.w - col) * k - dotSize / 2, y: (V_IMG.h - row) * k - dotSize / 2};
}

/** Full rink (two mirrored halves) with SVG dots. points: [{x, y, isHome, r?, goal?}] */
export const FullRink = memo(function FullRink({points, home, away, centerLogo = true}) {
    const {teamColor, colors} = useAppTheme();
    const [width, setWidth] = useState(0);
    const height = Math.round(width * (85 / 200));
    const s = width / 2 / (H_IMG.right - H_IMG.left);
    const hc = teamColor(home);
    const ac = teamColor(away);
    return (
        <View
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={[styles.full, {height: height || 1, borderRadius: height * 0.33 || 16, borderColor: colors.border}]}>
            {width ? (
                <>
                    <Image
                        source={HORIZ}
                        style={{position: 'absolute', width: H_IMG.w * s, height: H_IMG.h * s, left: -H_IMG.left * s, top: -H_IMG.top * s}}
                    />
                    <Image
                        source={HORIZ}
                        style={{
                            position: 'absolute',
                            width: H_IMG.w * s,
                            height: H_IMG.h * s,
                            left: width / 2 - (H_IMG.w - H_IMG.right) * s,
                            top: -H_IMG.top * s,
                            transform: [{scaleX: -1}],
                        }}
                    />
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
                            return p.goal ? (
                                <G key={p.key ?? i}>
                                    <Circle cx={x} cy={y} r={r + 3} fill="none" stroke={c} strokeWidth={2}/>
                                    <Circle cx={x} cy={y} r={r} fill={c} stroke="#FFFFFF" strokeWidth={1.5}/>
                                </G>
                            ) : (
                                <Circle key={p.key ?? i} cx={x} cy={y} r={r} fill={c} fillOpacity={p.r ? 0.55 : 0.85} stroke={c} strokeWidth={1}/>
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
    const {colors} = useAppTheme();
    const height = Math.round(width * (V_IMG.h / V_IMG.w));
    const ok = Number.isFinite(x) && Number.isFinite(y);
    // Normalise so the shooter attacks toward +x.
    const nx = ok && x < 0 ? -x : x;
    const ny = ok && x < 0 ? -y : y;
    const dot = ok ? placeDotCoords(nx, ny, width, height) : null;
    return (
        <View style={[styles.half, {width, height, borderColor: colors.border}]}>
            <Image source={HALF} style={{width, height, transform: [{rotate: '180deg'}]}}/>
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

/** "Rink Map" tab: any play-by-play event on the rink; the xG view sizes shots by quality. */
function RinkMapTab({pbp, xg, header}) {
    const {teamColor} = useAppTheme();
    const [type, setType] = useState('xg');
    const {home, away} = header;

    const points = useMemo(() => {
        if (!pbp) return [];
        if (type === 'xg') {
            return mapXGShots(pbp, xg).map((s, i) => ({key: s.eventId ?? i, x: s.x, y: s.y, isHome: s.isHome, goal: s.goal, r: xgRadius(s.xg)}));
        }
        return mapEvents(pbp, header, type).map((p, i) => ({key: p.eventId ?? i, x: p.x, y: p.y, isHome: p.isHome, goal: type === 'goal'}));
    }, [pbp, xg, header, type]);

    const counts = useMemo(() => {
        let h = 0;
        let a = 0;
        for (const p of points) (p.isHome ? h++ : a++);
        return {h, a};
    }, [points]);

    const tabs = useMemo(() => MAP_EVENTS.map((e) => ({key: e.key, label: e.label})), []);

    return (
        <View>
            <PillTabs tabs={tabs} value={type} onChange={setType} contentStyle={{paddingHorizontal: 0}} style={{marginBottom: 14}}/>
            <Card>
                {pbp ? (
                    points.length ? (
                        <FullRink points={points} home={home.abbrev} away={away.abbrev}/>
                    ) : (
                        <EmptyState message="Nothing to plot yet."/>
                    )
                ) : (
                    <EmptyState message="Play-by-play isn’t available for this game yet."/>
                )}
                <Row style={{justifyContent: 'space-between', marginTop: 12}}>
                    <Row gap={6}>
                        <View style={[styles.legendDot, {backgroundColor: teamColor(away.abbrev)}]}/>
                        <T variant="caption" muted>← {away.abbrev} attacks</T>
                        <T variant="label">{counts.a}</T>
                    </Row>
                    <Row gap={6}>
                        <T variant="label">{counts.h}</T>
                        <T variant="caption" muted>{home.abbrev} attacks →</T>
                        <View style={[styles.legendDot, {backgroundColor: teamColor(home.abbrev)}]}/>
                    </Row>
                </Row>
                {type === 'xg' ? (
                    <Row gap={4} style={{marginTop: 10}}>
                        <T variant="caption" muted style={{flex: 1}}>
                            Bigger dot = better scoring chance. Ringed dots are goals. xG for {home.abbrev} {num(xg?.home?.xg, 2)} · {away.abbrev} {num(xg?.away?.xg, 2)}
                        </T>
                        <InfoTip
                            size={14}
                            title="Expected goals (xG)"
                            body="Rinkside’s model estimate of how likely each unblocked shot was to become a goal, based on distance, angle, shot type, rebounds, rushes and manpower. A 0.25 xG shot scores about one time in four."
                        />
                    </Row>
                ) : (
                    <T variant="caption" muted style={{marginTop: 10}}>
                        Locations are flipped so each team always attacks the same end.
                    </T>
                )}
            </Card>
        </View>
    );
}

export default memo(RinkMapTab);

const styles = StyleSheet.create({
    full: {width: '100%', overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth},
    half: {overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, alignSelf: 'center'},
    centerLogo: {alignItems: 'center', justifyContent: 'center'},
    legendDot: {width: 10, height: 10, borderRadius: 5},
});
