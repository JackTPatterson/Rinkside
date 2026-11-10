import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {PanResponder, Pressable, StyleSheet, Switch, View} from 'react-native';
import Animated, {
    Easing,
    FadeInDown,
    FadeOut,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import RinkSvg from '../../components/RinkSvg';
import {Activity, Pause, Play} from '../../components/icons';
import {EmptyState, LiveDot, ProgressBar, T, TeamLogo, tap} from '../../components/ui';
import {useFavoriteTeam} from '../../hooks/useFavoriteTeam';
import {useAppTheme} from '../../theme';
import {periodLabel} from '../../utils/format';
import {SectionTitle} from './common';
import {
    buildEvents,
    clockLabel,
    gameEnd,
    passedEvents,
    scoreAt,
    tally,
    visibleEvents,
    wpAtTime,
} from './liveRink';
import {currentElapsed} from './model';
import {cheerFor, plan, tension as tensionOf} from './pulse';
import {mapToPixel} from './Rink';
import {resultLabel} from './shareFormat';
import {runPlan, useLivePulse, usePulsePreference} from './usePulse';
import {winProbSeries} from './winProbSeries';

const SPEEDS = [30, 90, 240];
const RECENT = 120; // seconds a shot stays at full strength on the ice
const HALF_NET = 89;

const xgRadius = (xg) => 3 + Math.sqrt(Math.max(0, xg ?? 0.04)) * 14;
const pctText = (p) => `${Math.round(p * 100)}%`;

/* --------------------------------------------------------------- rink dots */

/** A ring that expands and fades once or twice: the "goal!" shockwave. */
const Shockwave = memo(function Shockwave({color, size}) {
    const k = useSharedValue(0);
    useEffect(() => {
        k.value = withRepeat(withTiming(1, {duration: 1300, easing: Easing.out(Easing.cubic)}), 2, false);
        return () => cancelAnimation(k);
    }, [k]);
    const style = useAnimatedStyle(() => ({opacity: 0.75 * (1 - k.value), transform: [{scale: 1 + k.value * 4.5}]}));
    return (
        <Animated.View
            pointerEvents="none"
            style={[{position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color}, style]}
        />
    );
});

/** One shot / goal on the ice. Springs in when it appears; goals send out a shockwave. */
const ShotDot = memo(function ShotDot({x, y, r, color, kind, recent, animate, delay}) {
    const s = useSharedValue(animate ? 0 : 1);
    useEffect(() => {
        if (animate) s.value = withDelay(delay, withSpring(1, {damping: 8, stiffness: 170, mass: 0.7}));
    }, [animate, delay, s]);
    const grow = useAnimatedStyle(() => ({transform: [{scale: s.value}]}));
    const goal = kind === 'goal';
    const hollow = kind === 'miss' || kind === 'block';
    const size = (goal ? r + 3 : r) * 2;
    return (
        <View pointerEvents="none" style={[styles.dotBox, {left: x, top: y}]}>
            {goal && animate && recent ? <Shockwave color={color} size={size}/> : null}
            <Animated.View
                style={[
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: hollow ? 'transparent' : color,
                        borderWidth: goal ? 2.5 : hollow ? 1.5 : 1.25,
                        borderColor: hollow ? color : '#FFFFFF',
                        opacity: recent ? (hollow ? 0.8 : 1) : hollow ? 0.35 : 0.5,
                    },
                    goal && styles.goalGlow,
                    goal && {shadowColor: color},
                    grow,
                ]}
            />
        </View>
    );
});

/** The rink with every shot up to now. Home attacks the left net, away the right. */
const RinkLayer = memo(function RinkLayer({events, t, hc, ac, animate, width}) {
    const height = Math.round(width * (85 / 200));
    const k = width / 360;
    const shown = useMemo(() => events.filter((e) => e.x != null), [events]);
    const lastGoals = shown.filter((e) => e.kind === 'goal').slice(-3);
    const netY = height / 2;
    return (
        <View style={{width, height}}>
            <RinkSvg view="full" width={width} height={height} style={StyleSheet.absoluteFill}/>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Streaks from the last few goals into the net */}
                {lastGoals.map((g) => {
                    const p = mapToPixel(g.x, g.y, width, height);
                    const n = mapToPixel(g.isHome ? -HALF_NET : HALF_NET, 0, width, height);
                    return <Line key={g.id} x1={p.x} y1={p.y} x2={n.x} y2={netY} stroke={g.isHome ? hc : ac} strokeWidth={2} strokeOpacity={0.55} strokeLinecap="round" strokeDasharray="1 5"/>;
                })}
            </Svg>
            {shown.map((e, i) => {
                const p = mapToPixel(e.x, e.y, width, height);
                const r = e.kind === 'goal' ? Math.max(6, xgRadius(e.xg) * k) : xgRadius(e.kind === 'block' ? 0.02 : e.xg) * k;
                return (
                    <ShotDot
                        key={e.id}
                        x={p.x}
                        y={p.y}
                        r={r}
                        color={e.isHome ? hc : ac}
                        kind={e.kind}
                        recent={t - e.t < RECENT}
                        animate={animate}
                        delay={animate ? Math.min(i * 12, 600) : 0}
                    />
                );
            })}
        </View>
    );
});

/* ----------------------------------------------------------- goal banner */

function GoalBanner({banner}) {
    if (!banner) return null;
    return (
        <Animated.View
            key={banner.key}
            entering={FadeInDown.springify().damping(14)}
            exiting={FadeOut.duration(400)}
            pointerEvents="none"
            style={[styles.banner, {backgroundColor: banner.color}]}>
            <T variant="label" color={banner.fg} style={styles.bannerText} numberOfLines={1}>{banner.text}</T>
        </Animated.View>
    );
}

/* ------------------------------------------------------ win-probability */

/** Home win probability over the game with the cursor on it: filled toward whoever is ahead. */
const WinProbStrip = memo(function WinProbStrip({series, goals, t, endT, live, hc, ac}) {
    const {colors} = useAppTheme();
    const [w, setW] = useState(0);
    const h = 84;
    const cy = h / 2;
    const span = Math.max(live ? 3600 : 1, endT);
    const X = (s) => (Math.min(s, span) / span) * w;
    const Y = (p) => (1 - p) * h;
    const geo = useMemo(() => {
        if (!w || !series.length) return null;
        const pts = [...series.filter((p) => p.t <= t), {t, p: wpAtTime(series, t)}];
        const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p.p).toFixed(1)}`).join('');
        const area = (pick) => `M${X(pts[0].t).toFixed(1)} ${cy}` + pts.map((p) => `L${X(p.t).toFixed(1)} ${pick(Y(p.p)).toFixed(1)}`).join('') + `L${X(pts[pts.length - 1].t).toFixed(1)} ${cy}Z`;
        const future = series.filter((p) => p.t > t);
        const ahead = future.length ? `M${X(t).toFixed(1)} ${Y(wpAtTime(series, t)).toFixed(1)}` + future.map((p) => `L${X(p.t).toFixed(1)} ${Y(p.p).toFixed(1)}`).join('') : null;
        return {line, home: area((y) => Math.min(y, cy)), away: area((y) => Math.max(y, cy)), ahead};
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [series, t, w, span]);
    const now = wpAtTime(series, t);
    return (
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{height: h}}>
            {geo ? (
                <Svg width={w} height={h}>
                    <Line x1={0} x2={w} y1={cy} y2={cy} stroke={colors.border} strokeWidth={1} strokeDasharray="3 4"/>
                    {geo.ahead ? <Path d={geo.ahead} stroke={colors.textSecondary} strokeOpacity={0.35} strokeWidth={1.5} fill="none" strokeDasharray="2 4"/> : null}
                    <Path d={geo.home} fill={hc} fillOpacity={0.3}/>
                    <Path d={geo.away} fill={ac} fillOpacity={0.3}/>
                    <Path d={geo.line} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round"/>
                    {goals.map((g) => {
                        const done = g.t <= t;
                        return <Circle key={g.id} cx={X(g.t)} cy={Y(wpAtTime(series, g.t))} r={4.5} fill={done ? (g.isHome ? hc : ac) : 'none'} stroke={g.isHome ? hc : ac} strokeWidth={done ? 1.5 : 1} strokeOpacity={done ? 1 : 0.4} />;
                    })}
                    <Line x1={X(t)} x2={X(t)} y1={0} y2={h} stroke={colors.text} strokeOpacity={0.5} strokeWidth={1}/>
                    <Circle cx={X(t)} cy={Y(now)} r={5} fill={now >= 0.5 ? hc : ac} stroke="#FFFFFF" strokeWidth={2}/>
                </Svg>
            ) : null}
        </View>
    );
});

/* --------------------------------------------------------------- scrubber */

function Scrubber({endT, t, goals, hc, ac, onScrub, onStart, onEnd}) {
    const {colors} = useAppTheme();
    const ref = useRef(null);
    const geo = useRef({x: 0, w: 1});
    const cb = useRef({onScrub, onStart, onEnd, endT});
    cb.current = {onScrub, onStart, onEnd, endT};
    const at = (pageX) => Math.max(0, Math.min(1, (pageX - geo.current.x) / geo.current.w)) * cb.current.endT;
    const pan = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
            cb.current.onStart();
            cb.current.onScrub(at(e.nativeEvent.pageX));
        },
        onPanResponderMove: (e) => cb.current.onScrub(at(e.nativeEvent.pageX)),
        onPanResponderRelease: () => cb.current.onEnd(),
        onPanResponderTerminate: () => cb.current.onEnd(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const frac = endT > 0 ? Math.min(1, t / endT) : 1;
    return (
        <View
            ref={ref}
            onLayout={() => ref.current?.measureInWindow((x, _y, w) => {
                geo.current = {x, w: Math.max(1, w)};
            })}
            style={styles.scrub}
            accessibilityRole="adjustable"
            accessibilityLabel="Game timeline"
            {...pan.panHandlers}>
            <View style={[styles.track, {backgroundColor: colors.cardAlt}]}>
                <View style={[styles.fill, {width: `${frac * 100}%`, backgroundColor: colors.text}]}/>
                {[1200, 2400, 3600].filter((s) => s < endT).map((s) => (
                    <View key={s} style={[styles.periodTick, {left: `${(s / endT) * 100}%`, backgroundColor: colors.background}]}/>
                ))}
            </View>
            {goals.map((g) => (
                <View key={g.id} style={[styles.goalTick, {left: `${endT > 0 ? (g.t / endT) * 100 : 0}%`, backgroundColor: g.isHome ? hc : ac, opacity: g.t <= t ? 1 : 0.4}]}/>
            ))}
            <View style={[styles.thumb, {left: `${frac * 100}%`, backgroundColor: colors.text, borderColor: colors.background}]}/>
        </View>
    );
}

/* ----------------------------------------------------------------- bits */

function ScoreStrip({header, score, label, live}) {
    const {home, away} = header;
    return (
        <View style={styles.scoreStrip}>
            <View style={styles.scoreSide}>
                <TeamLogo abbrev={home.abbrev} size={30}/>
                <T style={styles.score}>{score.home}</T>
            </View>
            <View style={styles.scoreMid}>
                <View style={styles.liveRow}>
                    {live ? <LiveDot size={7}/> : null}
                    <T variant="label" muted style={styles.liveText}>{live ? 'LIVE' : 'REPLAY'}</T>
                </View>
                <T variant="caption" muted>{label}</T>
            </View>
            <View style={[styles.scoreSide, styles.scoreSideRight]}>
                <T style={styles.score}>{score.away}</T>
                <TeamLogo abbrev={away.abbrev} size={30}/>
            </View>
        </View>
    );
}

function TallyRow({label, home, away, hc, ac}) {
    return (
        <View style={styles.tallyRow}>
            <T variant="body" color={hc} style={styles.tallyVal}>{home}</T>
            <T variant="caption" muted style={styles.tallyLabel}>{label}</T>
            <T variant="body" color={ac} style={[styles.tallyVal, {textAlign: 'right'}]}>{away}</T>
        </View>
    );
}

function eventLine(e, roster, header) {
    const name = e.playerId ? roster?.get?.(e.playerId)?.last : null;
    const team = e.isHome ? header.home.abbrev : header.away.abbrev;
    if (e.kind === 'goal') return `GOAL · ${team}${name ? ` · ${name}` : ''}${e.xg != null ? ` (${e.xg.toFixed(2)} xG)` : ''}`;
    if (e.kind === 'penalty') return `Penalty · ${team}${e.penalty?.minutes ? ` · ${e.penalty.minutes} min` : ''}${e.penalty?.name ? ` · ${String(e.penalty.name).replace(/-/g, ' ')}` : ''}`;
    const word = e.kind === 'shot' ? 'Shot on goal' : e.kind === 'miss' ? 'Missed shot' : 'Blocked shot';
    return `${word} · ${team}${name ? ` · ${name}` : ''}${e.xg != null && e.kind !== 'block' ? ` (${e.xg.toFixed(2)})` : ''}`;
}

/* ------------------------------------------------------------------ tab */

/**
 * Live Rink: every shot appears on the ice as it happens, goals send out a shockwave, and the win-probability
 * line moves with them. For a finished game (or a live one you scrub back in) it's a replay: press play and watch
 * the whole game back in about a minute.
 */
function LiveRinkTab({header, pbp, xg, roster, ratings, mp}) {
    const {colors, teamColor} = useAppTheme();
    const {team: favorite} = useFavoriteTeam();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    const liveGame = header.live;
    const favoriteIsHome = favorite === home.abbrev ? true : favorite === away.abbrev ? false : null;

    const homeId = home.id ?? pbp?.homeTeam?.id;
    const shots = useMemo(() => (xg ? [...xg.home.shots, ...xg.away.shots] : []), [xg]);
    const events = useMemo(() => buildEvents(pbp, homeId, shots), [pbp, homeId, shots]);
    const nowT = liveGame ? currentElapsed(header) : 0;
    const endT = gameEnd(events, {nowT, final: header.final});
    const goals = useMemo(() => events.filter((e) => e.kind === 'goal'), [events]);

    // Win-probability series: MoneyPuck's when it has one (same rule as the header), else our model.
    const bucket = Math.floor(endT / 120);
    const series = useMemo(
        () => winProbSeries({mp, ratings, header, events, endT}),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mp, ratings, events, bucket, header.final],
    );

    /* ----- time & playback ----- */
    const [mode, setMode] = useState(liveGame ? 'live' : 'replay'); // 'live' follows the game, 'replay' is yours
    const [cursor, setCursor] = useState(null); // null = the end
    const [playing, setPlaying] = useState(false);
    const [speedIx, setSpeedIx] = useState(1);
    const [scrubbing, setScrubbing] = useState(false);
    const cursorRef = useRef(0);
    const live = liveGame && mode === 'live';
    const t = live ? endT : Math.min(cursor ?? endT, endT);
    cursorRef.current = t;

    // The game going final (or live starting) while the tab is open.
    useEffect(() => {
        if (!liveGame && mode === 'live') setMode('replay');
    }, [liveGame, mode]);

    /* ----- pulse (haptics) ----- */
    const [pulseOn, setPulseOn] = usePulsePreference();
    // At the very end of a finished game the result is known, including a shootout the event feed leaves out.
    const atEnd = header.final && t >= endT - 0.5;
    const decided = (home.score ?? 0) !== (away.score ?? 0);
    const wpNow = atEnd && decided ? ((home.score ?? 0) > (away.score ?? 0) ? 1 : 0) : wpAtTime(series, t);
    const secondsLeft = header.clock.inIntermission ? 1200 : header.clock.secondsRemaining ?? 1200;
    const tense = live && !header.clock.inIntermission
        ? tensionOf({wpHome: Number.isFinite(wpNow) ? wpNow : 0.5, period: header.period, secondsLeft, playoff: header.playoff})
        : 0;
    useLivePulse({
        enabled: pulseOn && live,
        reading: live ? {hs: home.score ?? 0, as: away.score ?? 0, wp: wpNow, tension: tense} : null,
        favoriteIsHome,
    });

    /* ----- goal banner ----- */
    const [banner, setBanner] = useState(null);
    const bannerTimer = useRef(null);
    const showGoal = useCallback((e) => {
        const abbrev = e.isHome ? home.abbrev : away.abbrev;
        const color = e.isHome ? hc : ac;
        const name = e.playerId ? roster?.get?.(e.playerId)?.name : null;
        setBanner({key: e.id, color, fg: readable(color), text: `GOAL  ${abbrev}${name ? `  ·  ${name}` : ''}`});
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 3200);
    }, [home.abbrev, away.abbrev, hc, ac, roster]);
    useEffect(() => () => clearTimeout(bannerTimer.current), []);

    // Live: announce a new goal when one arrives (not the goals already there when the tab opened).
    const lastGoalId = useRef(goals.length ? goals[goals.length - 1].id : null);
    useEffect(() => {
        const latest = goals.length ? goals[goals.length - 1] : null;
        if (live && latest && latest.id !== lastGoalId.current) showGoal(latest);
        lastGoalId.current = latest ? latest.id : null;
    }, [goals, live, showGoal]);

    // Replay: advance the cursor; goals we pass raise the banner and buzz.
    const goalMoment = useCallback((e) => {
        const swing = Math.abs(wpAtTime(series, e.t) - wpAtTime(series, e.t - 1));
        return {kind: 'goal', home: e.isHome, big: swing >= 0.2};
    }, [series]);
    useEffect(() => {
        if (!playing) return undefined;
        const speed = SPEEDS[speedIx];
        const id = setInterval(() => {
            const from = cursorRef.current;
            const to = Math.min(endT, from + speed * 0.1);
            cursorRef.current = to;
            setCursor(to);
            for (const e of passedEvents(events, from, to)) {
                if (e.kind !== 'goal') continue;
                showGoal(e);
                if (pulseOn) runPlan(plan(goalMoment(e), cheerFor(goalMoment(e), favoriteIsHome)));
            }
            if (to >= endT) {
                setPlaying(false);
                if (liveGame) {
                    setMode('live');
                    setCursor(null);
                }
            }
        }, 100);
        return () => clearInterval(id);
    }, [playing, speedIx, endT, events, showGoal, pulseOn, favoriteIsHome, goalMoment, liveGame]);

    const play = useCallback(() => {
        tap();
        if (playing) {
            setPlaying(false);
            return;
        }
        const from = cursorRef.current >= endT - 1 ? 0 : cursorRef.current;
        cursorRef.current = from;
        setCursor(from);
        setMode('replay');
        setPlaying(true);
    }, [playing, endT]);
    const goLive = useCallback(() => {
        tap();
        setPlaying(false);
        setMode('live');
        setCursor(null);
    }, []);
    const scrub = useCallback((s) => {
        cursorRef.current = s;
        setCursor(s);
    }, []);
    const onScrubStart = useCallback(() => {
        setPlaying(false);
        setMode('replay');
        setScrubbing(true);
    }, []);
    const onScrubEnd = useCallback(() => setScrubbing(false), []);

    /* ----- derived for render ----- */
    const [width, setWidth] = useState(0);
    const seen = useMemo(() => visibleEvents(events, t), [events, t]);
    const shotsSeen = useMemo(() => seen.filter((e) => e.kind !== 'penalty'), [seen]);
    const counts = useMemo(() => tally(events, t), [events, t]);
    const eventScore = useMemo(() => scoreAt(events, t), [events, t]);
    const score = atEnd ? {home: home.score ?? eventScore.home, away: away.score ?? eventScore.away} : eventScore;
    const recent = useMemo(() => [...seen].reverse().filter((e) => e.kind !== 'block').slice(0, 5), [seen]);
    const swing5 = wpNow - wpAtTime(series, Math.max(0, t - 300));
    const timeText = atEnd ? resultLabel(header) : clockLabel(t, (n) => periodLabel(n));
    const animateDots = (live || playing) && !scrubbing;
    const speedLabel = `${SPEEDS[speedIx]}×`;

    if (!events.length && !live) {
        return <EmptyState title="No play-by-play yet" message="The Live Rink fills in once the game starts."/>;
    }

    return (
        <View style={styles.wrap}>
            <ScoreStrip header={header} score={score} label={timeText} live={live}/>

            <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.rinkWrap}>
                {width ? <RinkLayer events={shotsSeen} t={t} hc={hc} ac={ac} animate={animateDots} width={width}/> : null}
                <View style={styles.bannerSlot} pointerEvents="none"><GoalBanner banner={banner}/></View>
            </View>
            <View style={styles.attack}>
                <T variant="caption" muted>{home.abbrev} attacks ←</T>
                <T variant="caption" muted>→ {away.abbrev} attacks</T>
            </View>

            {/* Win probability */}
            <View style={styles.wpHead}>
                <T style={styles.wpNum} color={hc}>{pctText(wpNow)}</T>
                <View style={styles.wpMid}>
                    <T variant="caption" muted>Win probability</T>
                    <T variant="caption" color={Math.abs(swing5) < 0.02 ? colors.textSecondary : swing5 > 0 ? hc : ac}>
                        {Math.abs(swing5) < 0.02 ? 'steady' : `${swing5 > 0 ? home.abbrev : away.abbrev} +${Math.round(Math.abs(swing5) * 100)} pts in 5 min`}
                    </T>
                </View>
                <T style={styles.wpNum} color={ac}>{pctText(1 - wpNow)}</T>
            </View>
            <WinProbStrip series={series} goals={goals} t={t} endT={endT} live={liveGame} hc={hc} ac={ac}/>

            {/* Transport */}
            <View style={styles.transport}>
                <Pressable
                    onPress={play}
                    accessibilityRole="button"
                    accessibilityLabel={playing ? 'Pause replay' : 'Play replay'}
                    style={[styles.playBtn, {backgroundColor: colors.text}]}>
                    {playing ? <Pause size={22} color={colors.background} variant="Bold"/> : <Play size={22} color={colors.background} variant="Bold"/>}
                </Pressable>
                <Scrubber endT={endT} t={t} goals={goals} hc={hc} ac={ac} onScrub={scrub} onStart={onScrubStart} onEnd={onScrubEnd}/>
                <Pressable
                    onPress={() => {
                        tap();
                        setSpeedIx((i) => (i + 1) % SPEEDS.length);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Replay speed ${speedLabel}`}
                    style={[styles.pill, {backgroundColor: colors.card}]}>
                    <T variant="label">{speedLabel}</T>
                </Pressable>
            </View>
            {liveGame && !live ? (
                <Pressable onPress={goLive} accessibilityRole="button" style={[styles.liveBtn, {backgroundColor: colors.live}]}>
                    <LiveDot size={7}/>
                    <T variant="label" color="#FFFFFF">Jump to live</T>
                </Pressable>
            ) : null}

            {/* Pulse */}
            <View style={[styles.pulse, {backgroundColor: colors.card}]}>
                <Activity size={22} color={tense >= 0.35 ? colors.live : colors.textSecondary}/>
                <View style={styles.pulseText}>
                    <T variant="label">Game Pulse</T>
                    <T variant="caption" muted>
                        {pulseOn ? 'Haptics on: goals, big swings and a heartbeat when it gets tense.' : 'Feel the game: haptics for goals, swings and tense finishes.'}
                    </T>
                    {live ? <ProgressBar value={tense} color={tense >= 0.7 ? colors.live : tense >= 0.35 ? colors.warning : colors.textSecondary} height={5} style={{marginTop: 8}}/> : null}
                </View>
                <Switch value={pulseOn} onValueChange={(v) => { tap(); setPulseOn(v); }} trackColor={{true: colors.accent}} accessibilityLabel="Game Pulse haptics"/>
            </View>

            <SectionTitle title={live ? 'Right now' : 'At this point'}/>
            <TallyRow label="Goals" home={counts.home.goals} away={counts.away.goals} hc={hc} ac={ac}/>
            <TallyRow label="Shots on goal" home={counts.home.sog} away={counts.away.sog} hc={hc} ac={ac}/>
            <TallyRow label="Expected goals" home={counts.home.xg.toFixed(2)} away={counts.away.xg.toFixed(2)} hc={hc} ac={ac}/>

            {recent.length ? (
                <>
                    <SectionTitle title="Latest"/>
                    {recent.map((e) => (
                        <View key={e.id} style={styles.feedRow}>
                            <View style={[styles.feedDot, {backgroundColor: e.isHome ? hc : ac}]}/>
                            <T variant="caption" muted style={styles.feedTime}>{clockLabel(e.t, (n) => periodLabel(n))}</T>
                            <T variant="caption" style={styles.feedText} numberOfLines={1}>{eventLine(e, roster, header)}</T>
                        </View>
                    ))}
                </>
            ) : null}
        </View>
    );
}

// Local copy so this file doesn't depend on ui's helper names: black or white text for a colour.
function readable(hex) {
    const h = hex.replace('#', '');
    if (h.length < 6) return '#FFFFFF';
    const [r, g, b] = [0, 2, 4].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? '#FFFFFF' : '#111111';
}

export default memo(LiveRinkTab);

const styles = StyleSheet.create({
    wrap: {gap: 14},
    scoreStrip: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    scoreSide: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
    scoreSideRight: {justifyContent: 'flex-end'},
    score: {fontFamily: 'Sora_800ExtraBold', fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums']},
    scoreMid: {alignItems: 'center', gap: 2, minWidth: 96},
    liveRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
    liveText: {letterSpacing: 1},
    rinkWrap: {borderRadius: 14, overflow: 'hidden'},
    dotBox: {position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center'},
    goalGlow: {shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: {width: 0, height: 0}},
    banner: {alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 100, maxWidth: '92%'},
    bannerText: {fontFamily: 'Sora_800ExtraBold', fontSize: 15, letterSpacing: 0.5},
    bannerSlot: {position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center'},
    attack: {flexDirection: 'row', justifyContent: 'space-between', marginTop: -6},
    wpHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4},
    wpNum: {fontFamily: 'Sora_800ExtraBold', fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums']},
    wpMid: {alignItems: 'center', flex: 1},
    transport: {flexDirection: 'row', alignItems: 'center', gap: 12},
    playBtn: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
    pill: {height: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center', minWidth: 54},
    liveBtn: {alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 34, borderRadius: 17},
    scrub: {flex: 1, height: 44, justifyContent: 'center'},
    track: {height: 6, borderRadius: 3, overflow: 'hidden'},
    fill: {height: 6},
    periodTick: {position: 'absolute', top: 0, bottom: 0, width: 2},
    goalTick: {position: 'absolute', top: 10, width: 4, height: 24, borderRadius: 2, marginLeft: -2},
    thumb: {position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3, marginLeft: -9, top: 13},
    pulse: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 15},
    pulseText: {flex: 1},
    tallyRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 4},
    tallyVal: {flex: 1, fontFamily: 'Sora_700Bold', fontVariant: ['tabular-nums']},
    tallyLabel: {flex: 2, textAlign: 'center'},
    feedRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5},
    feedDot: {width: 8, height: 8, borderRadius: 4},
    feedTime: {width: 66, fontVariant: ['tabular-nums']},
    feedText: {flex: 1},
});
