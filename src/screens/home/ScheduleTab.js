import React, {memo, useCallback, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {isFinal, isLive} from '../../api/nhl';
import {Badge, Card, EmptyState, ErrorState, FadeInView, InfoTip, LiveDot, Row, Section, Skeleton, SkeletonList, SplitBar, T, TeamLogo} from '../../components/ui';
import {useNow} from '../../hooks/useQuery';
import {useAppTheme} from '../../theme';
import {countdown, formatTime, isSameDay, loc, pct, periodLabel, relativeDayLabel} from '../../utils/format';
import {finalSuffix, gamePrediction, gameTime, resultFor, sides} from './data';

const WIN_INFO = 'Chance to win from the Rinkside game model: a model estimate built from each team’s goals for and against this season (pulled toward league average early on) plus home ice. MoneyPuck’s number, when shown, comes from their own shot-quality model.';

function teamWinProb(pred, isHome) {
    if (!pred) return null;
    return isHome ? pred.homeWin : pred.awayWin;
}

/* ------------------------------------------------------------ hero card */

const Countdown = memo(function Countdown({start}) {
    const left = start ? start.getTime() - Date.now() : 0;
    const now = useNow(left < 3600000 ? 1000 : 30000, left > 0);
    if (!start) return null;
    if (start - now <= 0) return <T variant="label">Starting soon</T>;
    return <T variant="stat">{countdown(start, now)}</T>; // `stat` is tabular, so the clock doesn't jitter
});

function HeroCenter({game, start}) {
    if (isLive(game)) {
        const pd = game?.periodDescriptor;
        const clock = game?.clock?.inIntermission ? 'INT' : game?.clock?.timeRemaining;
        return (
            <View style={styles.center}>
                <T variant="display" style={styles.tabular}>{game?.awayTeam?.score ?? 0} – {game?.homeTeam?.score ?? 0}</T>
                <Row gap={6}>
                    <LiveDot/>
                    <T variant="caption" muted style={styles.tabular}>
                        {pd?.number ? periodLabel(pd.number, pd.periodType) : 'Live'}{clock ? ` · ${clock}` : ''}
                    </T>
                </Row>
            </View>
        );
    }
    const today = start && isSameDay(start, new Date());
    return (
        <View style={styles.center}>
            {today ? (
                <>
                    <T variant="caption" muted>Puck drop in</T>
                    <Countdown start={start}/>
                    <T variant="caption" muted>{formatTime(start)}</T>
                </>
            ) : (
                <>
                    <T variant="label">{start ? relativeDayLabel(start) : 'TBD'}</T>
                    <T variant="stat">{start ? formatTime(start) : '–'}</T>
                </>
            )}
        </View>
    );
}

function HeroSide({team, prob}) {
    return (
        <View style={styles.side}>
            <TeamLogo abbrev={team?.abbrev} size={44}/>
            <T variant="label" numberOfLines={1} style={styles.sideAbbrev}>{team?.abbrev ?? '–'}</T>
            {prob != null ? <T variant="caption" muted style={styles.tabular}>{pct(prob)}</T> : <View style={styles.probSpacer}/>}
        </View>
    );
}

export const NextGameCard = memo(function NextGameCard({game, abbrev, mpHomeProb, pred, onOpenGame}) {
    const {colors, teamColor} = useAppTheme();
    const start = gameTime(game);
    const live = isLive(game);
    const today = start && isSameDay(start, new Date());
    const {isHome} = sides(game, abbrev);
    const away = game?.awayTeam;
    const home = game?.homeTeam;
    const hasMP = mpHomeProb != null;
    const homeP = hasMP ? mpHomeProb : pred?.homeWin;
    const ourP = homeP == null ? null : isHome ? homeP : 1 - homeP;
    const title = live ? 'Live now' : today ? 'Today’s game' : 'Next game';
    const venue = loc(game?.venue);
    const onPress = useCallback(() => onOpenGame(game), [onOpenGame, game]);

    return (
        <Card onPress={onPress} accessibilityLabel={`${title}: ${away?.abbrev ?? 'TBD'} at ${home?.abbrev ?? 'TBD'}`} style={styles.hero}>
            <Row style={styles.heroTop}>
                <T variant="label" color={live ? colors.live : undefined}>{title.toUpperCase()}</T>
                {venue ? <T variant="caption" muted numberOfLines={1} style={styles.venue}>{venue}</T> : null}
            </Row>
            <Row style={styles.heroMain}>
                <HeroSide team={away} prob={homeP != null && !live ? 1 - homeP : null}/>
                <HeroCenter game={game} start={start}/>
                <HeroSide team={home} prob={homeP != null && !live ? homeP : null}/>
            </Row>
            {!live && homeP != null ? (
                <View style={styles.probBlock}>
                    <SplitBar left={1 - homeP} leftColor={teamColor(away?.abbrev)} rightColor={teamColor(home?.abbrev)} height={8}/>
                    <Row style={styles.probCaption}>
                        <T variant="caption" muted style={styles.flex}>
                            {abbrev} win chance {pct(ourP)}{hasMP && pred ? ` · Rinkside model ${pct(teamWinProb(pred, isHome))}` : ''}
                        </T>
                        <InfoTip title={hasMP ? 'MoneyPuck win probability' : 'Win probability'} body={WIN_INFO} size={14}/>
                    </Row>
                    <T variant="caption" muted>{hasMP ? 'Source: MoneyPuck pregame model' : 'Source: Rinkside model estimate'}</T>
                </View>
            ) : null}
        </Card>
    );
});

/* ------------------------------------------------------------ week rows */

const GameRow = memo(function GameRow({game, abbrev, winProb, onOpenGame}) {
    const {colors, teamColor} = useAppTheme();
    const onPress = useCallback(() => onOpenGame(game), [onOpenGame, game]);
    const start = gameTime(game);
    const {isHome, opp, us, them} = sides(game, abbrev);
    const result = resultFor(game, abbrev);
    const live = isLive(game);
    const resultColor = result === 'W' ? colors.positive : result === 'OTL' ? colors.warning : colors.negative;
    return (
        <Card
            onPress={onPress}
            style={styles.row}
            accessibilityLabel={`${start ? relativeDayLabel(start) : 'TBD'}, ${isHome ? 'versus' : 'at'} ${opp ?? 'TBD'}${result ? `, ${result} ${us?.score ?? ''}–${them?.score ?? ''}` : ''}`}>
            <View style={[styles.rowStripe, {backgroundColor: teamColor(opp)}]}/>
            <View style={styles.rowDate}>
                <T variant="label" numberOfLines={1}>{start ? relativeDayLabel(start) : 'TBD'}</T>
                <T variant="caption" muted numberOfLines={1}>{isFinal(game) ? `Final${finalSuffix(game)}` : live ? 'Live' : start ? formatTime(start) : ''}</T>
            </View>
            <Row gap={6} style={styles.flex}>
                <T variant="caption" muted>{isHome ? 'vs' : '@'}</T>
                <TeamLogo abbrev={opp} size={26}/>
                <T variant="label" numberOfLines={1}>{opp ?? 'TBD'}</T>
            </Row>
            {result ? (
                <Row gap={8}>
                    <T variant="label" style={styles.tabular}>{us?.score ?? '–'}–{them?.score ?? '–'}</T>
                    <Badge label={result} color={resultColor}/>
                </Row>
            ) : live ? (
                <Row gap={6}>
                    <LiveDot/>
                    <T variant="label" style={styles.tabular}>{us?.score ?? 0}–{them?.score ?? 0}</T>
                </Row>
            ) : winProb != null ? (
                <View style={styles.rowProb}>
                    <T variant="label" style={styles.tabular}>{pct(winProb)}</T>
                    <T variant="caption" muted>win</T>
                </View>
            ) : null}
        </Card>
    );
});

/* --------------------------------------------------------------- tab */

function ScheduleTab({abbrev, games, loading, error, onRetry, hero, heroFromSeason, mpHomeProb, ratings, onOpenGame}) {
    const sorted = useMemo(
        () => [...(games ?? [])].sort((a, b) => (gameTime(a)?.getTime() ?? 0) - (gameTime(b)?.getTime() ?? 0)),
        [games],
    );
    const rest = useMemo(() => sorted.filter((g) => g?.id !== hero?.id), [sorted, hero]);

    // Model win chance for every upcoming game (exact chain, cached per ratings + matchup so the
    // 30 s live poll doesn't recompute anything).
    const preds = useMemo(() => {
        const out = {};
        if (!ratings) return out;
        for (const g of sorted) {
            if (isFinal(g) || isLive(g)) continue;
            const p = gamePrediction(ratings, g);
            if (p) out[g.id] = p;
        }
        if (hero && !out[hero.id]) {
            const p = gamePrediction(ratings, hero);
            if (p) out[hero.id] = p;
        }
        return out;
    }, [ratings, sorted, hero]);

    if (loading && !games) {
        return (
            <View style={styles.pad}>
                <Skeleton height={210} radius={16}/>
                <Skeleton height={24} width={120} style={styles.mt24}/>
                <SkeletonList count={3} height={58} style={styles.mt12}/>
            </View>
        );
    }
    if (error && !games) return <ErrorState message="Couldn’t load the schedule." onRetry={onRetry}/>;

    return (
        <View style={styles.pad}>
            {hero ? (
                <FadeInView>
                    <NextGameCard
                        game={hero}
                        abbrev={abbrev}
                        mpHomeProb={mpHomeProb}
                        pred={preds[hero.id]}
                        onOpenGame={onOpenGame}
                    />
                </FadeInView>
            ) : (
                <EmptyState title="No upcoming games" message="Nothing on the schedule right now."/>
            )}
            <Section title="This week" info={rest.some((g) => preds[g.id]) ? WIN_INFO : undefined}>
                {rest.length ? (
                    <View style={styles.list}>
                        {rest.map((g, i) => (
                            <GameRow
                                key={g.id ?? `idx-${i}`}
                                game={g}
                                abbrev={abbrev}
                                winProb={teamWinProb(preds[g.id], sides(g, abbrev).isHome)}
                                onOpenGame={onOpenGame}
                            />
                        ))}
                    </View>
                ) : (
                    <T variant="body" muted>{heroFromSeason ? 'No games this week.' : 'No other games this week.'}</T>
                )}
            </Section>
        </View>
    );
}

export default memo(ScheduleTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: 16},
    mt12: {marginTop: 12},
    mt24: {marginTop: 24},
    tabular: {fontVariant: ['tabular-nums']},
    probSpacer: {height: 16},
    flex: {flex: 1},
    hero: {padding: 16},
    heroTop: {justifyContent: 'space-between', marginBottom: 12},
    venue: {flexShrink: 1, marginLeft: 12, textAlign: 'right'},
    heroMain: {justifyContent: 'space-between'},
    side: {alignItems: 'center', width: 84, gap: 2},
    sideAbbrev: {marginTop: 4},
    center: {flex: 1, alignItems: 'center', gap: 2},
    probBlock: {marginTop: 16, gap: 6},
    probCaption: {justifyContent: 'space-between'},
    list: {gap: 8},
    row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 0, overflow: 'hidden'},
    rowStripe: {width: 4, alignSelf: 'stretch', borderRadius: 2},
    rowDate: {width: 104},
    rowProb: {alignItems: 'flex-end'},
});
