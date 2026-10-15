import React, {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {predictGame} from '../../analytics';
import {isFinal, isLive} from '../../api/nhl';
import {Badge, Card, EmptyState, ErrorState, FadeInView, InfoTip, LiveDot, Row, Section, Skeleton, SkeletonList, SplitBar, T, TeamLogo} from '../../components/ui';
import {useNow} from '../../hooks/useQuery';
import {useAppTheme} from '../../theme';
import {countdown, formatTime, isSameDay, pct, periodLabel, relativeDayLabel} from '../../utils/format';
import {finalSuffix, gameTime, resultFor, sides} from './data';

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
    return <T variant="stat">{countdown(start, now)}</T>;
});

function HeroCenter({game, start}) {
    if (isLive(game)) {
        const pd = game?.periodDescriptor;
        const clock = game?.clock?.inIntermission ? 'INT' : game?.clock?.timeRemaining;
        return (
            <View style={styles.center}>
                <T variant="display">{game?.awayTeam?.score ?? 0} – {game?.homeTeam?.score ?? 0}</T>
                <Row gap={6}>
                    <LiveDot/>
                    <T variant="caption" muted>
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
            <T variant="label" style={styles.sideAbbrev}>{team?.abbrev ?? '–'}</T>
            {prob != null ? <T variant="caption" muted>{pct(prob)}</T> : null}
        </View>
    );
}

export const NextGameCard = memo(function NextGameCard({game, abbrev, mpHomeProb, pred, onPress}) {
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

    return (
        <Card onPress={onPress} accessibilityLabel={`${title}: ${away?.abbrev} at ${home?.abbrev}`} style={styles.hero}>
            <Row style={styles.heroTop}>
                <T variant="label" color={live ? colors.live : undefined}>{title.toUpperCase()}</T>
                {game?.venue ? <T variant="caption" muted numberOfLines={1} style={styles.venue}>{game.venue?.default ?? game.venue}</T> : null}
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

const GameRow = memo(function GameRow({game, abbrev, winProb, onPress}) {
    const {colors, teamColor} = useAppTheme();
    const start = gameTime(game);
    const {isHome, opp, us, them} = sides(game, abbrev);
    const result = resultFor(game, abbrev);
    const live = isLive(game);
    const resultColor = result === 'W' ? colors.positive : result === 'OTL' ? colors.warning : colors.negative;
    return (
        <Card onPress={onPress} style={styles.row} accessibilityLabel={`${isHome ? 'vs' : 'at'} ${opp}`}>
            <View style={[styles.rowStripe, {backgroundColor: teamColor(opp)}]}/>
            <View style={styles.rowDate}>
                <T variant="label">{start ? relativeDayLabel(start) : 'TBD'}</T>
                <T variant="caption" muted>{isFinal(game) ? `Final${finalSuffix(game)}` : live ? 'Live' : start ? formatTime(start) : ''}</T>
            </View>
            <Row gap={6} style={styles.flex}>
                <T variant="caption" muted>{isHome ? 'vs' : '@'}</T>
                <TeamLogo abbrev={opp} size={26}/>
                <T variant="label">{opp}</T>
            </Row>
            {result ? (
                <Row gap={8}>
                    <T variant="label">{us?.score ?? '–'}–{them?.score ?? '–'}</T>
                    <Badge label={result} color={resultColor}/>
                </Row>
            ) : live ? (
                <Row gap={6}>
                    <LiveDot/>
                    <T variant="label">{us?.score ?? 0}–{them?.score ?? 0}</T>
                </Row>
            ) : winProb != null ? (
                <View style={styles.rowProb}>
                    <T variant="label">{pct(winProb)}</T>
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

    // Model win chance for every upcoming game (cheap, exact; memoised per ratings refresh).
    const preds = useMemo(() => {
        const out = {};
        if (!ratings) return out;
        for (const g of sorted) {
            if (isFinal(g) || isLive(g) || !g?.homeTeam?.abbrev || !g?.awayTeam?.abbrev) continue;
            out[g.id] = predictGame(ratings, g.homeTeam.abbrev, g.awayTeam.abbrev, {playoff: g.gameType === 3});
        }
        if (hero && !out[hero.id] && hero.homeTeam?.abbrev && hero.awayTeam?.abbrev) {
            out[hero.id] = predictGame(ratings, hero.homeTeam.abbrev, hero.awayTeam.abbrev, {playoff: hero.gameType === 3});
        }
        return out;
    }, [ratings, sorted, hero]);

    if (loading && !games) {
        return (
            <View style={styles.pad}>
                <Skeleton height={170} radius={16}/>
                <SkeletonList count={3} height={64} style={styles.mt24}/>
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
                        onPress={() => onOpenGame(hero)}
                    />
                </FadeInView>
            ) : (
                <EmptyState title="No upcoming games" message="Nothing on the schedule right now."/>
            )}
            <Section title="This week" info={rest.some((g) => preds[g.id]) ? WIN_INFO : undefined}>
                {rest.length ? (
                    <View style={styles.list}>
                        {rest.map((g) => (
                            <GameRow
                                key={g.id}
                                game={g}
                                abbrev={abbrev}
                                winProb={teamWinProb(preds[g.id], sides(g, abbrev).isHome)}
                                onPress={() => onOpenGame(g)}
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
    mt24: {marginTop: 24},
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
