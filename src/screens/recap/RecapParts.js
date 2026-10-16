import React, {memo, useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming} from 'react-native-reanimated';
import Svg, {Circle, Line} from 'react-native-svg';
import TickGauge from '../../components/TickGauge';
import {Star1} from '../../components/icons';
import {Headshot, Row, T, TeamLogo, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {loc, num, pct, savePct} from '../../utils/format';

const ease = {duration: 900, easing: Easing.out(Easing.cubic)};

/* ------------------------------------------------------------ final score */

/** Final score: each team's logo, big score and abbrev side by side; the loser's side is dimmed. */
export const FinalSplit = memo(function FinalSplit({header, onPress, note}) {
    const {home, away} = header;
    const suffix = header.lastPeriodType && header.lastPeriodType !== 'REG' ? ` · ${header.lastPeriodType}` : '';
    const side = (team, lost) => (
        <View style={[styles.scoreBlock, lost && styles.lost]}>
            <TeamLogo abbrev={team.abbrev} size={34}/>
            <T variant="body" style={styles.bigScore}>{team.score ?? 0}</T>
            <T variant="caption" style={styles.semi}>{team.abbrev}</T>
        </View>
    );
    return (
        <Pressable accessibilityRole="button" accessibilityLabel="Open game" onPress={onPress} style={({pressed}) => [styles.block, pressed && styles.pressed]}>
            <Row gap={3} style={styles.fullRow}>
                {side(home, home.score < away.score)}
                {side(away, away.score < home.score)}
            </Row>
            <T variant="caption" muted style={styles.center}>Final{suffix} · tap for the full game</T>
            {note ? <T variant="body" style={[styles.center, styles.note]}>{note}</T> : null}
        </Pressable>
    );
});

/* ------------------------------------------------------------ excitement */

const GAUGE_MAX = 5; // "Instant classic" starts at 4

/** Excitement Index on the tick dial: ticks light up to the score, number and label underneath. */
export const ExcitementGauge = memo(function ExcitementGauge({excitement, width, active = true}) {
    const {colors} = useAppTheme();
    const level = Math.max(0, Math.min(1, excitement.index / GAUGE_MAX));
    const tone = excitement.index >= 2.5 ? colors.live : excitement.index >= 1.3 ? colors.warning : colors.textSecondary;
    return (
        <View style={styles.gauge}>
            <TickGauge value={level} start={0} leftColor={tone} rightColor={colors.cardAlt} width={Math.min(width, 360)} active={active} delay={150}/>
            <View style={styles.gaugeText}>
                <T variant="body" style={styles.gaugeValue}>{num(excitement.index, 1)}</T>
                <T variant="body" color={tone} style={styles.semi}>{excitement.label}</T>
            </View>
            <Row gap={0} style={styles.figures}>
                <Figure label="Lead swings" value={String(excitement.swings)}/>
                <Figure label="Winner’s low point" value={pct(excitement.comeback)}/>
            </Row>
        </View>
    );
});

function Figure({label, value, color}) {
    return (
        <View style={styles.figure}>
            <T variant="body" color={color} style={styles.figureValue}>{value}</T>
            <T variant="caption" muted>{label}</T>
        </View>
    );
}

/* -------------------------------------------------------- deserve to win */

/**
 * Deserve to Win: each team's share and xG on its own side, with the two-colour split bar (sized by
 * the shares) underneath, so the numbers never have to squeeze inside a narrow block.
 */
export const DeserveBlocks = memo(function DeserveBlocks({dtw, home, away}) {
    const {teamColor} = useAppTheme();
    const hc = teamColor(home);
    const ac = teamColor(away);
    const share = useSharedValue(0.5);
    const target = Math.min(0.97, Math.max(0.03, dtw.home));
    useEffect(() => {
        share.value = withDelay(300, withTiming(target, ease));
    }, [target, share]);
    const left = useAnimatedStyle(() => ({flex: share.value}));
    const right = useAnimatedStyle(() => ({flex: 1 - share.value}));
    const side = (abbrev, p, xg, c, end) => (
        <View style={end && styles.alignEnd}>
            <T variant="caption" muted style={styles.semi}>{abbrev}</T>
            <T variant="body" color={c} style={styles.blockPct}>{pct(p)}</T>
            <T variant="caption" muted>{num(xg, 2)} expected goals</T>
        </View>
    );
    return (
        <View>
            <Row style={styles.dtwText}>
                {side(home, dtw.home, dtw.xgHome, hc, false)}
                {side(away, dtw.away, dtw.xgAway, ac, true)}
            </Row>
            <Row gap={3} style={styles.dtw}>
                <Animated.View style={[styles.leftBlock, {backgroundColor: hc}, left]}/>
                <Animated.View style={[styles.rightBlock, {backgroundColor: ac}, right]}/>
            </Row>
        </View>
    );
});

/* ---------------------------------------------------------- goal timeline */

const toMin = (period, time) => {
    const [m, s] = String(time ?? '0:0').split(':').map(Number);
    return (Math.max(1, period) - 1) * 20 + (m || 0) + (s || 0) / 60;
};

/**
 * Every goal on one line across the game: home goals above, away below, in team colours, with
 * period marks. Tap a goal to see who scored and the score after it.
 */
export const GoalTimeline = memo(function GoalTimeline({goals, home, away, width}) {
    const {colors, teamColor} = useAppTheme();
    const [picked, setPicked] = useState(null);
    if (!goals?.length) return null;
    const ot = goals.some((g) => g.period > 3);
    const span = ot ? 65 : 60;
    const h = 84;
    const mid = h / 2;
    const pad = 10;
    const x = (m) => pad + (Math.min(span, m) / span) * (width - pad * 2);
    const marks = ot ? [0, 20, 40, 60, 65] : [0, 20, 40, 60];
    const sel = goals.find((g) => g.key === picked);
    return (
        <View>
            <Svg width={width} height={h}>
                <Line x1={pad} y1={mid} x2={width - pad} y2={mid} stroke={colors.border} strokeWidth={2}/>
                {marks.map((m) => <Line key={m} x1={x(m)} y1={mid - 6} x2={x(m)} y2={mid + 6} stroke={colors.border} strokeWidth={2}/>)}
                {goals.map((g) => {
                    const gx = x(toMin(g.period, g.timeInPeriod));
                    const up = g.isHome;
                    const c = teamColor(up ? home : away);
                    const gy = up ? mid - 22 : mid + 22;
                    const active = picked === g.key;
                    return (
                        <React.Fragment key={g.key}>
                            <Line x1={gx} y1={mid} x2={gx} y2={gy} stroke={c} strokeWidth={2}/>
                            <Circle
                                cx={gx}
                                cy={gy}
                                r={active ? 10 : 8}
                                fill={c}
                                stroke={colors.background}
                                strokeWidth={2}
                                onPress={() => {
                                    tap();
                                    setPicked((k) => (k === g.key ? null : g.key));
                                }}
                            />
                        </React.Fragment>
                    );
                })}
            </Svg>
            <Row style={styles.periods}>
                {['1st', '2nd', '3rd', ...(ot ? ['OT'] : [])].map((p) => (
                    <T key={p} variant="caption" muted style={[styles.periodLabel, p === 'OT' && styles.otLabel]}>{p}</T>
                ))}
            </Row>
            <T variant="caption" muted style={[styles.center, styles.goalLine]}>
                {sel ? `${sel.name} (${sel.team}) · ${sel.timeInPeriod} ${['1st', '2nd', '3rd'][sel.period - 1] ?? 'OT'} · ${away} ${sel.awayScore}–${sel.homeScore} ${home}` : `${home} above · ${away} below · tap a goal`}
            </T>
        </View>
    );
});

/* ------------------------------------------------------------ three stars */

/** The three stars side by side: rank, ringed headshot, name and line. */
export const ThreeStars = memo(function ThreeStars({stars, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    if (!stars?.length) return null;
    return (
        <Row gap={0} style={styles.stars}>
            {stars.slice(0, 3).map((s, i) => {
                const team = loc(s?.teamAbbrev) || s?.teamAbbrev || '';
                const name = loc(s?.name) || [loc(s?.firstName), loc(s?.lastName)].filter(Boolean).join(' ');
                const line = s?.position === 'G'
                    ? `${savePct(s?.savePctg)} SV%`
                    : `${s?.goals ?? 0} G · ${s?.assists ?? 0} A`;
                return (
                    <Pressable
                        key={s?.playerId ?? i}
                        accessibilityRole="button"
                        accessibilityLabel={`Star ${i + 1}: ${name}`}
                        onPress={() => onPlayer?.(s?.playerId)}
                        style={({pressed}) => [styles.star, pressed && styles.pressed]}>
                        <Row gap={2}>
                            {Array.from({length: 3 - i}).map((_, k) => <Star1 key={k} size={12} color={colors.warning} variant="Bold"/>)}
                        </Row>
                        <Headshot uri={s?.headshot} size={i === 0 ? 76 : 64} borderColor={teamColor(team)}/>
                        <T variant="body" numberOfLines={1} adjustsFontSizeToFit style={[styles.semi, styles.center, styles.starName]}>{name}</T>
                        <T variant="caption" muted>{line}</T>
                    </Pressable>
                );
            })}
        </Row>
    );
});

const styles = StyleSheet.create({
    semi: {fontFamily: 'Sora_600SemiBold'},
    center: {textAlign: 'center'},
    pressed: {opacity: 0.7},
    block: {alignSelf: 'stretch', marginBottom: 20, gap: 8},
    note: {marginTop: 4},
    fullRow: {alignSelf: 'stretch', width: '100%'},
    leftBlock: {height: '100%', borderTopLeftRadius: 8, borderBottomLeftRadius: 8},
    rightBlock: {height: '100%', borderTopRightRadius: 8, borderBottomRightRadius: 8},
    scoreBlock: {flex: 1, alignItems: 'center', paddingVertical: 14, gap: 2},
    lost: {opacity: 0.45},
    bigScore: {fontFamily: 'Sora_800ExtraBold', fontSize: 52, lineHeight: 60, fontVariant: ['tabular-nums']},
    gauge: {alignItems: 'center'},
    gaugeText: {alignItems: 'center', marginTop: 6},
    gaugeValue: {fontFamily: 'Sora_700Bold', fontSize: 36, lineHeight: 44, fontVariant: ['tabular-nums']},
    figures: {alignSelf: 'stretch', marginTop: 16},
    figure: {flex: 1, alignItems: 'center', gap: 2},
    figureValue: {fontFamily: 'Sora_600SemiBold', fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums']},
    dtwText: {justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12},
    dtw: {height: 16},
    alignEnd: {alignItems: 'flex-end'},
    blockPct: {fontFamily: 'Sora_700Bold', fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums']},
    periods: {paddingHorizontal: 10},
    periodLabel: {flex: 20, textAlign: 'center'},
    otLabel: {flex: 5},
    goalLine: {marginTop: 8},
    stars: {alignItems: 'flex-end'},
    star: {flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4},
    starName: {alignSelf: 'stretch'},
});
