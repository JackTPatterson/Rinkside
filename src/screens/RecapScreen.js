import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming} from 'react-native-reanimated';
import {alignPrediction, applyExternalXG, deserveToWin, excitementIndex, gameXG, predictGame} from '../analytics';
import {moneypuck, preGameHomeWinProb} from '../api/moneypuck';
import {nhl} from '../api/nhl';
import {
    BackButton,
    ErrorState,
    FadeInView,
    Header,
    Screen,
    Section,
    Skeleton,
    T,
    TeamLogo,
} from '../components/ui';
import {useRatingsBefore} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {ROUTES} from '../navigation/routes';
import {GUTTER, readableOn, useAppTheme} from '../theme';
import {DeserveBlocks, ExcitementGauge, FinalSplit, GoalTimeline, ThreeStars} from './recap/RecapParts';
import {buildHeader, buildRinksideSeries, currentElapsed, extractGoals, moneyPuckChart, parseMoneyPuckGame} from './game/model';

const none = () => null;

/** Counts a percentage up from 50 to its target once (JS-driven; only two numbers on screen). */
function useCountUp(target, delay = 500, duration = 1000) {
    const [v, setV] = useState(0.5);
    useEffect(() => {
        if (!Number.isFinite(target)) return undefined;
        let raf;
        let start;
        const from = 0.5;
        const timer = setTimeout(() => {
            const step = (ts) => {
                start = start ?? ts;
                const k = Math.min(1, (ts - start) / duration);
                const eased = 1 - (1 - k) ** 3;
                setV(from + (target - from) * eased);
                if (k < 1) raf = requestAnimationFrame(step);
            };
            raf = requestAnimationFrame(step);
        }, delay);
        return () => {
            clearTimeout(timer);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [target, delay, duration]);
    return v;
}

/** The original recap: the screen split between the two teams by pregame win probability. */
const PregameSplit = memo(function PregameSplit({home, away, homeProb}) {
    const {teamColor} = useAppTheme();
    const hc = teamColor(home);
    const ac = teamColor(away);
    const share = useSharedValue(0.5);
    useEffect(() => {
        if (Number.isFinite(homeProb)) {
            share.value = withDelay(500, withTiming(Math.min(0.85, Math.max(0.15, homeProb)), {duration: 1000, easing: Easing.out(Easing.cubic)}));
        }
    }, [homeProb, share]);
    const topStyle = useAnimatedStyle(() => ({flex: share.value}));
    const bottomStyle = useAnimatedStyle(() => ({flex: 1 - share.value}));
    const shownHome = useCountUp(homeProb);
    return (
        <View style={styles.split}>
            <Animated.View style={[styles.half, styles.top, {backgroundColor: hc}, topStyle]}>
                <TeamLogo abbrev={home} size={40}/>
                <View>
                    <T variant="display" color={readableOn(hc)} style={styles.big}>{Math.round(shownHome * 100)}%</T>
                    <T variant="label" color={readableOn(hc)}>{home} pregame win chance</T>
                </View>
            </Animated.View>
            <Animated.View style={[styles.half, styles.bottom, {backgroundColor: ac}, bottomStyle]}>
                <TeamLogo abbrev={away} size={40}/>
                <View>
                    <T variant="display" color={readableOn(ac)} style={styles.big}>{Math.round((1 - shownHome) * 100)}%</T>
                    <T variant="label" color={readableOn(ac)}>{away} pregame win chance</T>
                </View>
            </Animated.View>
        </View>
    );
});

export default function RecapScreen({route, navigation}) {
    const {colors} = useAppTheme();
    const {gameId, home: homeParam, away: awayParam} = route.params ?? {};

    const landingQ = useQuery(({force}) => nhl.landing(gameId, {force}), [gameId]);
    const pbpQ = useQuery(({force}) => nhl.playByPlay(gameId, {force}).catch(none), [gameId]);
    const mpPreQ = useQuery(() => preGameHomeWinProb(gameId).catch(none), [gameId]);
    const season = landingQ.data?.season;
    const mpGameQ = useQuery(
        ({force}) => moneypuck.gameData(season, gameId, {force}).catch(none),
        [season, gameId],
        {enabled: !!season},
    );

    const header = useMemo(() => buildHeader(null, landingQ.data, undefined), [landingQ.data]);
    const home = header.home.abbrev || homeParam;
    const away = header.away.abbrev || awayParam;
    // Ratings as of the day before the game, so the pregame number never uses later results.
    const {ratings} = useRatingsBefore(header.gameDate);

    // One pregame number: MoneyPuck's when it has one (backtested better), otherwise our model's.
    const prediction = useMemo(() => {
        if (!home || !away || !ratings) return null;
        try {
            return alignPrediction(predictGame(ratings, home, away, {playoff: header.playoff}), mpPreQ.data);
        } catch {
            return null;
        }
    }, [ratings, home, away, header.playoff, mpPreQ.data]);
    const homeProb = prediction?.homeWin;

    // Excitement from MoneyPuck's series when it exists, else from Rinkside's replay of the goals.
    const excitement = useMemo(() => {
        if (!header.started) return null;
        const mp = parseMoneyPuckGame(mpGameQ.data);
        const series = mp
            ? moneyPuckChart(mp, header).series
            : buildRinksideSeries(ratings, header, extractGoals(landingQ.data, header.home.abbrev), currentElapsed(header)).series;
        return series.length > 2 ? {...excitementIndex(series), source: mp ? 'MoneyPuck' : 'Rinkside model'} : null;
    }, [header, ratings, mpGameQ.data, landingQ.data]);

    const dtw = useMemo(() => {
        const pbp = pbpQ.data;
        if (!pbp?.plays?.length) return null;
        const xg = applyExternalXG(gameXG(pbp), mpGameQ.data);
        if (!xg.home.shots.length && !xg.away.shots.length) return null;
        return {...deserveToWin(xg.home.shots, xg.away.shots), xg};
    }, [pbpQ.data, mpGameQ.data]);

    const refresh = () => {
        landingQ.refresh();
        pbpQ.refresh();
        mpPreQ.refresh();
        if (season) mpGameQ.refresh();
    };

    const goals = useMemo(() => extractGoals(landingQ.data, header.home.abbrev), [landingQ.data, header.home.abbrev]);
    const stars = landingQ.data?.summary?.threeStars ?? [];
    const {width} = useWindowDimensions();
    // The Excitement dial sweeps once it has scrolled into view, not on page load.
    const view = useRef({h: 0, y: null, scroll: 0});
    const [exciteSeen, setExciteSeen] = useState(false);
    const checkExcite = useCallback(() => {
        const v = view.current;
        if (v.y != null && v.h && v.scroll + v.h > v.y + 160) setExciteSeen(true);
    }, []);
    const onScroll = useCallback((e) => {
        view.current.scroll = e.nativeEvent.contentOffset.y;
        if (!exciteSeen) checkExcite();
    }, [exciteSeen, checkExcite]);
    const setViewportH = (h) => {
        view.current.h = h;
        checkExcite();
    };
    const setExciteY = (y) => {
        view.current.y = y;
        checkExcite();
    };
    const contentW = width - GUTTER * 2;
    const winner = header.home.score > header.away.score ? header.home : header.away;
    const winnerPre = prediction ? (winner === header.home ? prediction.homeWin : prediction.awayWin) : null;

    return (
        <Screen>
            <Header
                title="Recap"
                subtitle={home && away ? `${away} @ ${home}` : undefined}
                left={<BackButton onPress={() => navigation.goBack()}/>}
            />
            {landingQ.error && !landingQ.data && !home ? (
                <ErrorState onRetry={refresh}/>
            ) : (
                <ScrollView
                    onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
                    onScroll={onScroll}
                    scrollEventThrottle={32}
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={landingQ.refreshing} onRefresh={refresh} tintColor={colors.textSecondary}/>}>
                    {header.final ? (
                        <FadeInView delay={0}>
                            <FinalSplit
                                header={header}
                                onPress={() => navigation.navigate(ROUTES.game, {gameId})}
                                note={Number.isFinite(winnerPre) && header.home.score !== header.away.score
                                    ? `${winner.shortName} ${winnerPre < 0.45 ? 'pulled off the upset.' : winnerPre > 0.55 ? 'won as the favourite.' : 'won a near coin flip.'}`
                                    : null}
                            />
                        </FadeInView>
                    ) : null}

                    {home && away && !mpPreQ.loading ? (
                        <PregameSplit home={home} away={away} homeProb={homeProb}/>
                    ) : (
                        <Skeleton height={420} radius={15}/>
                    )}


                    {goals.length ? (
                        <Section title="How it unfolded">
                            <FadeInView delay={350}>
                                <GoalTimeline goals={goals} home={home} away={away} width={contentW}/>
                            </FadeInView>
                        </Section>
                    ) : null}

                    {excitement ? (
                        <View onLayout={(e) => setExciteY(e.nativeEvent.layout.y)}>
                        <Section
                            title="Excitement Index"
                            info="How much the win-probability line moved during the game: every swing counts, so tight games with late lead changes score highest. The winner’s low point is their lowest chance to win at any moment — low numbers mean a real comeback.">
                            <FadeInView delay={400}>
                                <ExcitementGauge excitement={excitement} width={contentW} active={exciteSeen}/>
                            </FadeInView>
                        </Section>
                        </View>
                    ) : null}

                    {dtw ? (
                        <Section
                            title="Deserve to Win"
                            info="If every scoring chance in this game were replayed thousands of times, how often each team would come out ahead — calculated from each shot’s expected goals (xG, empty-net shots excluded). An estimate of who played better.">
                            <FadeInView delay={500}>
                                <DeserveBlocks dtw={dtw} home={home} away={away}/>
                            </FadeInView>
                        </Section>
                    ) : null}

                    {stars.length ? (
                        <Section title="Three stars">
                            <FadeInView delay={600}>
                                <ThreeStars stars={stars} onPlayer={(id) => id && navigation.navigate(ROUTES.player, {playerId: id})}/>
                            </FadeInView>
                        </Section>
                    ) : null}
                </ScrollView>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: {paddingHorizontal: GUTTER, paddingBottom: 48, paddingTop: 10},
    // Two-team split block: outer corners rounded at 15, flat where the halves meet, 3pt gap between.
    split: {height: 420, borderRadius: 15, overflow: 'hidden', gap: 3},
    half: {paddingHorizontal: 15, paddingVertical: 15, justifyContent: 'space-between', overflow: 'hidden'},
    top: {borderTopLeftRadius: 15, borderTopRightRadius: 15, borderBottomLeftRadius: 0, borderBottomRightRadius: 0},
    bottom: {borderBottomLeftRadius: 15, borderBottomRightRadius: 15, borderTopLeftRadius: 0, borderTopRightRadius: 0},
    big: {fontFamily: 'Sora_600SemiBold', fontSize: 82, lineHeight: 96},
});
