import React, {memo, useEffect, useMemo, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming} from 'react-native-reanimated';
import {deserveToWin, excitementIndex, gameXG, predictGame} from '../analytics';
import {moneypuck, preGameHomeWinProb} from '../api/moneypuck';
import {nhl} from '../api/nhl';
import {
    BackButton,
    Card,
    ErrorState,
    FadeInView,
    Header,
    InfoTip,
    Row,
    Screen,
    Section,
    Skeleton,
    SplitBar,
    StatTile,
    T,
    TeamLogo,
} from '../components/ui';
import {useLeague} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {ROUTES} from '../navigation/routes';
import {readableOn, useAppTheme} from '../theme';
import {num, pct} from '../utils/format';
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
const PregameSplit = memo(function PregameSplit({home, away, homeProb, source}) {
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
            <Animated.View style={[styles.half, {backgroundColor: hc}, topStyle]}>
                <TeamLogo abbrev={home} size={40}/>
                <View>
                    <T variant="display" color={readableOn(hc)} style={styles.big}>{Math.round(shownHome * 100)}%</T>
                    <T variant="label" color={readableOn(hc)}>{home} pregame win chance</T>
                </View>
            </Animated.View>
            <Animated.View style={[styles.half, {backgroundColor: ac}, bottomStyle]}>
                <TeamLogo abbrev={away} size={40}/>
                <View>
                    <T variant="display" color={readableOn(ac)} style={styles.big}>{Math.round((1 - shownHome) * 100)}%</T>
                    <T variant="label" color={readableOn(ac)}>{away} · {source}</T>
                </View>
            </Animated.View>
        </View>
    );
});

export default function RecapScreen({route, navigation}) {
    const {colors, teamColor} = useAppTheme();
    const {gameId, home: homeParam, away: awayParam} = route.params ?? {};
    const {ratings} = useLeague();

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

    const prediction = useMemo(() => {
        if (!home || !away) return null;
        try {
            return predictGame(ratings, home, away, {playoff: header.playoff});
        } catch {
            return null;
        }
    }, [ratings, home, away, header.playoff]);
    const mpPre = mpPreQ.data;
    const homeProb = Number.isFinite(mpPre) ? mpPre : prediction?.homeWin;
    const source = Number.isFinite(mpPre) ? 'MoneyPuck' : 'Rinkside model';

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
        const xg = gameXG(pbp);
        if (!xg.home.shots.length && !xg.away.shots.length) return null;
        return {...deserveToWin(xg.home.shots, xg.away.shots), xg};
    }, [pbpQ.data]);

    const refresh = () => {
        landingQ.refresh();
        pbpQ.refresh();
        mpPreQ.refresh();
        if (season) mpGameQ.refresh();
    };

    const hc = teamColor(home);
    const ac = teamColor(away);
    const winner = header.home.score > header.away.score ? header.home : header.away;
    const winnerPre = Number.isFinite(homeProb) ? (winner === header.home ? homeProb : 1 - homeProb) : null;

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
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={landingQ.refreshing} onRefresh={refresh} tintColor={colors.textSecondary}/>}>
                    {home && away && !mpPreQ.loading ? (
                        <PregameSplit home={home} away={away} homeProb={homeProb} source={source}/>
                    ) : (
                        <Skeleton height={380} radius={24}/>
                    )}

                    {header.final ? (
                        <FadeInView delay={300}>
                            <Card style={{marginTop: 16}} onPress={() => navigation.navigate(ROUTES.game, {gameId})} accessibilityLabel="Open game">
                                <Row style={{justifyContent: 'space-between'}}>
                                    <Row gap={10}>
                                        <TeamLogo abbrev={home} size={32}/>
                                        <T variant="display" style={{opacity: header.home.score < header.away.score ? 0.55 : 1}}>{header.home.score}</T>
                                    </Row>
                                    <View style={{alignItems: 'center'}}>
                                        <T variant="label">Final{header.lastPeriodType && header.lastPeriodType !== 'REG' ? ` · ${header.lastPeriodType}` : ''}</T>
                                        <T variant="caption" muted>Tap for the full game</T>
                                    </View>
                                    <Row gap={10}>
                                        <T variant="display" style={{opacity: header.away.score < header.home.score ? 0.55 : 1}}>{header.away.score}</T>
                                        <TeamLogo abbrev={away} size={32}/>
                                    </Row>
                                </Row>
                                {Number.isFinite(winnerPre) && header.home.score !== header.away.score ? (
                                    <T variant="body" muted style={{marginTop: 10, textAlign: 'center'}}>
                                        {winner.shortName} {winnerPre < 0.45
                                            ? `pulled off the upset as a ${pct(winnerPre)} underdog`
                                            : winnerPre < 0.55
                                                ? `won a near coin-flip (${pct(winnerPre)} pre-game)`
                                                : `won as the ${pct(winnerPre)} favourite`} per {source}.
                                    </T>
                                ) : null}
                            </Card>
                        </FadeInView>
                    ) : null}

                    {excitement ? (
                        <Section
                            title="Excitement Index"
                            info={`How much the win-probability line moved during the game: every swing counts, so tight games with late lead changes score highest. Uses ${excitement.source}’s win probability, a model estimate.`}>
                            <FadeInView delay={400}>
                                <Card style={{marginBottom: 10}}>
                                    <Row style={{justifyContent: 'space-between'}}>
                                        <T variant="title">{excitement.label}</T>
                                        <T variant="display">{num(excitement.index, 1)}</T>
                                    </Row>
                                </Card>
                                <View style={styles.tiles}>
                                    <StatTile label="Lead swings" value={String(excitement.swings)} info="Times the model’s favourite changed (win probability crossed 50%)."/>
                                    <StatTile
                                        label="Comeback"
                                        value={pct(excitement.comeback)}
                                        sub="Winner’s lowest win chance"
                                        info="The winning team’s lowest win probability during the game — a model estimate. Low numbers mean a real comeback."
                                    />
                                </View>
                            </FadeInView>
                        </Section>
                    ) : null}

                    {dtw ? (
                        <Section
                            title="Deserve to Win"
                            info="If every scoring chance in this game were replayed thousands of times, how often each team would come out ahead — calculated from Rinkside’s expected-goals model (empty-net shots excluded). A model estimate of who played better.">
                            <FadeInView delay={500}>
                                <Card>
                                    <Row style={{justifyContent: 'space-between', marginBottom: 8}}>
                                        <T variant="stat" color={hc}>{pct(dtw.home)}</T>
                                        <T variant="stat" color={ac}>{pct(dtw.away)}</T>
                                    </Row>
                                    <SplitBar left={dtw.home} leftColor={hc} rightColor={ac} height={12}/>
                                    <Row gap={4} style={{marginTop: 10}}>
                                        <T variant="caption" muted style={{flex: 1}}>
                                            Expected goals {home} {num(dtw.xg.home.xg, 2)} · {away} {num(dtw.xg.away.xg, 2)}
                                        </T>
                                        <InfoTip
                                            size={13}
                                            title="Expected goals (xG)"
                                            body="Rinkside’s model estimate of how many goals each team’s chances were worth, from shot distance, angle, type, rebounds, rushes and manpower."
                                        />
                                    </Row>
                                </Card>
                            </FadeInView>
                        </Section>
                    ) : null}
                </ScrollView>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: {paddingHorizontal: 16, paddingBottom: 48},
    split: {height: 420, borderRadius: 24, overflow: 'hidden'},
    half: {paddingHorizontal: 18, paddingVertical: 14, justifyContent: 'space-between', overflow: 'hidden'},
    big: {fontSize: 64, lineHeight: 72},
    tiles: {flexDirection: 'row', gap: 10},
});
