import {LinearGradient} from 'expo-linear-gradient';
import React, {memo, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import {TeamLogo} from '../../components/ui';
import {getTeam} from '../../data/teams';
import {goalLines, resultLabel, statTiles} from './shareFormat';
import {wpAtTime} from './liveRink';

// The poster is a fixed 4:5 canvas drawn in a dark palette whatever the app theme is, so a shared
// image always looks the same. It is captured at 3× (1080 × 1350) by the share modal.
export const CARD_W = 360;
export const CARD_H = 450;
const INK = '#F4F4F6';
const MUTED = 'rgba(244,244,246,0.62)';
const BG = '#0B0B0D';

const brand = (abbrev) => getTeam(abbrev)?.dark ?? '#8A90F6';

/** Static win-probability chart: filled toward whoever was ahead, goals as dots. */
function PosterChart({series, goals, endT, hc, ac, width, height}) {
    const cy = height / 2;
    const geo = useMemo(() => {
        if (series.length < 2) return null;
        const span = Math.max(1, endT);
        const X = (s) => (Math.min(s, span) / span) * width;
        const Y = (p) => (1 - p) * height;
        const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p.p).toFixed(1)}`).join('');
        const area = (pick) => `M${X(series[0].t).toFixed(1)} ${cy}` + series.map((p) => `L${X(p.t).toFixed(1)} ${pick(Y(p.p)).toFixed(1)}`).join('') + `L${X(series[series.length - 1].t).toFixed(1)} ${cy}Z`;
        const marks = goals.map((g) => ({id: g.id, x: X(g.t), y: Y(wpAtTime(series, g.t)), isHome: g.isHome}));
        return {line, home: area((y) => Math.min(y, cy)), away: area((y) => Math.max(y, cy)), marks};
    }, [series, goals, endT, width, height, cy]);
    if (!geo) return <View style={{width, height}}/>;
    return (
        <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={cy} y2={cy} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="3 4"/>
            <Path d={geo.home} fill={hc} fillOpacity={0.4}/>
            <Path d={geo.away} fill={ac} fillOpacity={0.4}/>
            <Path d={geo.line} stroke={INK} strokeWidth={2.25} fill="none" strokeLinejoin="round" strokeLinecap="round"/>
            {geo.marks.map((m) => (
                <Circle key={m.id} cx={m.x} cy={m.y} r={5} fill={m.isHome ? hc : ac} stroke={INK} strokeWidth={1.75}/>
            ))}
        </Svg>
    );
}

function LogoBadge({abbrev}) {
    // The bundled logos are drawn for light backgrounds, so each sits on a soft white disc.
    return (
        <View style={styles.logoDisc}>
            <TeamLogo abbrev={abbrev} size={40}/>
        </View>
    );
}

/**
 * The shareable poster. `cardRef` is the capture target.
 *   data: {header, series, events, goals, endT, xg, dtw, excitement, headline, dateText}
 */
function ShareCard({cardRef, data}) {
    const {header, series, goals, endT, xg, dtw, excitement, headline, dateText} = data;
    const {home, away} = header;
    const hc = brand(home.abbrev);
    const ac = brand(away.abbrev);
    const tiles = statTiles({header, xg, dtw});
    const homeGoals = goalLines(goals, true, 3);
    const awayGoals = goalLines(goals, false, 3);
    // The excitement label is only meaningful once the game is over, and the headline shouldn't repeat it.
    const mood = header.final ? excitement?.label : null;
    const hook = headline && headline !== excitement?.label ? headline : null;
    const lostHome = header.final && (home.score ?? 0) < (away.score ?? 0);
    const lostAway = header.final && (away.score ?? 0) < (home.score ?? 0);
    return (
        <View ref={cardRef} collapsable={false} style={styles.card}>
            <LinearGradient colors={[hc + '8C', BG, ac + '8C']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill}/>
            <View style={styles.top}>
                <View style={styles.badge}><Text style={styles.badgeText}>{resultLabel(header)}</Text></View>
                {mood ? <Text style={styles.excite}>{mood.toUpperCase()}</Text> : null}
            </View>

            <View style={styles.scoreRow}>
                <View style={[styles.side, lostHome && styles.dim]}>
                    <LogoBadge abbrev={home.abbrev}/>
                    <Text style={styles.abbr}>{home.abbrev}</Text>
                </View>
                <Text style={styles.score} numberOfLines={1} adjustsFontSizeToFit>{`${home.score ?? 0}–${away.score ?? 0}`}</Text>
                <View style={[styles.side, lostAway && styles.dim]}>
                    <LogoBadge abbrev={away.abbrev}/>
                    <Text style={styles.abbr}>{away.abbrev}</Text>
                </View>
            </View>
            <Text style={styles.date}>{dateText}</Text>
            {hook ? <Text style={styles.headline} numberOfLines={2}>{hook}</Text> : <View style={{height: 6}}/>}

            <Text style={styles.label}>WIN PROBABILITY</Text>
            <View style={styles.chart}>
                <PosterChart series={series} goals={goals} endT={endT} hc={hc} ac={ac} width={CARD_W - 40} height={80}/>
            </View>

            <View style={styles.goalCols}>
                <View style={styles.goalCol}>{homeGoals.map((l) => <Text key={l} style={styles.goal} numberOfLines={1}>{l}</Text>)}</View>
                <View style={[styles.goalCol, {alignItems: 'flex-end'}]}>{awayGoals.map((l) => <Text key={l} style={[styles.goal, {textAlign: 'right'}]} numberOfLines={1}>{l}</Text>)}</View>
            </View>

            {tiles.length ? (
                <View style={styles.tiles}>
                    {tiles.map((t) => (
                        <View key={t.label} style={styles.tile}>
                            <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
                            <Text style={styles.tileVal} numberOfLines={1} adjustsFontSizeToFit>
                                <Text style={{color: hc}}>{t.home}</Text><Text style={{color: MUTED}}> · </Text><Text style={{color: ac}}>{t.away}</Text>
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}

            <View style={styles.footer}>
                <Text style={styles.brandMark}>RINKSIDE</Text>
                <Text style={styles.footNote}>win probability · expected goals</Text>
            </View>
        </View>
    );
}

export default memo(ShareCard);

const styles = StyleSheet.create({
    card: {width: CARD_W, height: CARD_H, backgroundColor: BG, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, overflow: 'hidden', borderRadius: 22},
    top: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    badge: {backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 100},
    badgeText: {fontFamily: 'Sora_700Bold', fontSize: 11, color: INK, letterSpacing: 0.8},
    excite: {fontFamily: 'Sora_700Bold', fontSize: 11, color: INK, letterSpacing: 1.2},
    scoreRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10},
    side: {alignItems: 'center', gap: 6, width: 84},
    dim: {opacity: 0.55},
    logoDisc: {width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center'},
    abbr: {fontFamily: 'Sora_700Bold', fontSize: 14, color: INK, letterSpacing: 0.5},
    score: {fontFamily: 'Sora_800ExtraBold', fontSize: 62, lineHeight: 70, color: INK, flexShrink: 1, textAlign: 'center', fontVariant: ['tabular-nums']},
    date: {fontFamily: 'Sora_500Medium', fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 8},
    headline: {fontFamily: 'Sora_600SemiBold', fontSize: 13, color: INK, textAlign: 'center', marginTop: 8, marginBottom: 2, lineHeight: 18},
    label: {fontFamily: 'Sora_700Bold', fontSize: 10, color: MUTED, letterSpacing: 1.4, marginTop: 10, marginBottom: 6},
    chart: {height: 80},
    goalCols: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, minHeight: 46},
    goalCol: {flex: 1, gap: 2},
    goal: {fontFamily: 'Sora_500Medium', fontSize: 11, color: INK, lineHeight: 15},
    tiles: {flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 10},
    tile: {flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center'},
    tileLabel: {fontFamily: 'Sora_700Bold', fontSize: 8.5, color: MUTED, letterSpacing: 0.8},
    tileVal: {fontFamily: 'Sora_700Bold', fontSize: 15, marginTop: 3, fontVariant: ['tabular-nums']},
    footer: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto'},
    brandMark: {fontFamily: 'Sora_800ExtraBold', fontSize: 12, color: INK, letterSpacing: 2.4},
    footNote: {fontFamily: 'Sora_500Medium', fontSize: 10, color: MUTED},
});
