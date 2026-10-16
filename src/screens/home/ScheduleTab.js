import React, {memo, useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {isFinal, isLive} from '../../api/nhl';
import {Badge, EmptyState, ErrorState, FadeInView, LiveDot, Row, Section, Skeleton, SkeletonList, SplitBar, T, TeamLogo} from '../../components/ui';
import {useNow} from '../../hooks/useQuery';
import {GUTTER, useAppTheme} from '../../theme';
import {countdown, formatTime, isSameDay, loc, pct, periodLabel, relativeDayLabel} from '../../utils/format';
import {useMoneyPuckProb} from '../scores/GameCard';
import {finalSuffix, gamePrediction, gameTime, resultFor, sides} from './data';

function teamWinProb(pred, isHome) {
    if (!pred) return null;
    return isHome ? pred.homeWin : pred.awayWin;
}

/* ------------------------------------------------------------ shared bits */

// Old Match-card building blocks: logo (70x50 at .7 scale) over the abbrev.
function Side({abbrev}) {
    return (
        <View style={styles.side}>
            <TeamLogo abbrev={abbrev} size={35}/>
            <T variant="body" numberOfLines={1}>{abbrev ?? '–'}</T>
        </View>
    );
}

function Prob({value, align}) {
    return (
        <T variant="body" numberOfLines={1} style={[styles.prob, {textAlign: align}]}>
            {value != null ? pct(value) : ''}
        </T>
    );
}

function Divider() {
    const {colors} = useAppTheme();
    return <View style={[styles.divider, {backgroundColor: colors.text}]}/>;
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
            // Plain text, no pills (same treatment as the date/time): score, then period · clock.
            <View style={styles.center}>
                <T variant="body" numberOfLines={1} style={styles.rowScore}>
                    {game?.awayTeam?.score ?? 0}–{game?.homeTeam?.score ?? 0}
                </T>
                <T variant="caption" muted numberOfLines={1} style={styles.tabular}>
                    {pd?.number ? periodLabel(pd.number, pd.periodType) : 'Live'}{clock ? ` · ${clock}` : ''}
                </T>
            </View>
        );
    }
    const today = start && isSameDay(start, new Date());
    return (
        <View style={styles.center}>
            {today ? (
                <>
                    {/* Kept as designed at HEAD: "Puck drop in" countdown block. */}
                    <T variant="caption" muted>Puck drop in</T>
                    <Countdown start={start}/>
                    <T variant="caption" muted>{formatTime(start)}</T>
                </>
            ) : (
                <>
                    <T variant="caption" muted numberOfLines={1} style={styles.rowDay}>{start ? relativeDayLabel(start) : 'TBD'}</T>
                    <T variant="body" numberOfLines={1} adjustsFontSizeToFit style={styles.rowTime}>{start ? formatTime(start) : '–'}</T>
                </>
            )}
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
    const showProb = !live && homeP != null;

    return (
        <View>
            {live ? (
                // Compact live marker instead of a big red title.
                <Row gap={6} style={styles.liveHead}>
                    <LiveDot size={8}/>
                    <T variant="label" color={colors.live} style={styles.liveText}>Live now</T>
                </Row>
            ) : (
                <T variant="title" style={styles.heroTitle}>{title}</T>
            )}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${title}: ${away?.abbrev ?? 'TBD'} at ${home?.abbrev ?? 'TBD'}`}
                onPress={onPress}
                style={({pressed}) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.match}>
                    <Side abbrev={away?.abbrev}/>
                    <Prob value={showProb ? 1 - homeP : null} align="right"/>
                    <HeroCenter game={game} start={start}/>
                    <Prob value={showProb ? homeP : null} align="left"/>
                    <Side abbrev={home?.abbrev}/>
                </View>
                {venue ? <T variant="caption" muted numberOfLines={1} style={styles.venue}>{venue}</T> : null}
                {showProb ? (
                    <View style={styles.probBlock}>
                        <SplitBar left={1 - homeP} leftColor={teamColor(away?.abbrev)} rightColor={teamColor(home?.abbrev)} height={8}/>
                        <Row style={styles.probCaption}>
                            <T variant="caption" muted style={styles.flex}>{abbrev} win chance {pct(ourP)}</T>
                        </Row>
                    </View>
                ) : null}
            </Pressable>
        </View>
    );
});

/* ------------------------------------------------------------ week rows */

const GameRow = memo(function GameRow({game, abbrev, winProb, onOpenGame}) {
    const {colors} = useAppTheme();
    const onPress = useCallback(() => onOpenGame(game), [onOpenGame, game]);
    const start = gameTime(game);
    const {isHome, opp, us, them} = sides(game, abbrev);
    const result = resultFor(game, abbrev);
    const live = isLive(game);
    const final = isFinal(game);
    const resultColor = result === 'W' ? colors.positive : result === 'OTL' ? colors.warning : colors.negative;
    const away = game?.awayTeam;
    const home = game?.homeTeam;
    // Home win chance: MoneyPuck first (backtested better), our model only when MoneyPuck has none.
    const mp = useMoneyPuckProb(game);
    const ours = winProb == null ? null : isHome ? winProb : 1 - winProb;
    const homeP = mp ?? ours;
    const showProb = homeP != null && !final && !live;
    const status = final ? `Final${finalSuffix(game)}` : live ? 'Live' : start ? formatTime(start) : '–';
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({pressed}) => [styles.card, pressed && styles.pressed]}
            accessibilityLabel={`${start ? relativeDayLabel(start) : 'TBD'}, ${isHome ? 'versus' : 'at'} ${opp ?? 'TBD'}${result ? `, ${result} ${us?.score ?? ''}–${them?.score ?? ''}` : ''}`}>
            <View style={styles.match}>
                <Side abbrev={away?.abbrev}/>
                <Prob value={showProb ? 1 - homeP : null} align="right"/>
                <View style={styles.rowCenter}>
                    <T variant="caption" muted numberOfLines={1} style={styles.rowDay}>{start ? relativeDayLabel(start) : 'TBD'}</T>
                    {final || live ? (
                        <>
                            {/* Fixed size (no shrink-to-fit: with a lineHeight iOS can collapse it to the minimum scale). */}
                            <T variant="body" numberOfLines={1} style={styles.rowScore}>
                                {`${away?.score ?? 0}–${home?.score ?? 0}`}
                            </T>
                            {/* Result pill / live dot sit centred with the status, not pinned to a corner. */}
                            <Row gap={6} style={styles.rowStatus}>
                                {live ? <LiveDot size={6}/> : null}
                                {/* One pill: "Win" / "Loss" (with OT / SO when it went past regulation), or the live status. */}
                                {final && result ? (
                                    <Badge label={`${result === 'W' ? 'Win' : 'Loss'}${finalSuffix(game) ? ` ·${finalSuffix(game)}` : ''}`} color={resultColor}/>
                                ) : (
                                    <Badge label={status} color={colors.card} textColor={colors.textSecondary}/>
                                )}
                            </Row>
                        </>
                    ) : (
                        <T variant="body" numberOfLines={1} adjustsFontSizeToFit style={styles.rowTime}>{status}</T>
                    )}
                </View>
                <Prob value={showProb ? homeP : null} align="left"/>
                <Side abbrev={home?.abbrev}/>
            </View>
        </Pressable>
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
                <Skeleton height={30} width={180} radius={15}/>
                <Skeleton height={140} radius={15} style={styles.mt10}/>
                <Skeleton height={30} width={160} radius={15} style={styles.mt24}/>
                <SkeletonList count={3} height={64} gap={22} style={styles.mt12}/>
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
            <Section title="This week">
                {rest.length ? (
                    <View style={styles.list}>
                        {rest.map((g, i) => (
                            <React.Fragment key={g.id ?? `idx-${i}`}>
                                {i > 0 ? <Divider/> : null}
                                <GameRow
                                    game={g}
                                    abbrev={abbrev}
                                    winProb={teamWinProb(preds[g.id], sides(g, abbrev).isHome)}
                                    onOpenGame={onOpenGame}
                                />
                            </React.Fragment>
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
    pad: {paddingHorizontal: GUTTER},
    mt10: {marginTop: 10},
    mt12: {marginTop: 12},
    mt24: {marginTop: 24},
    tabular: {fontVariant: ['tabular-nums']},
    semi: {fontFamily: 'Sora_600SemiBold'},
    flex: {flex: 1},
    heroTitle: {marginBottom: 10},
    liveHead: {marginBottom: 8},
    liveText: {fontFamily: 'Sora_600SemiBold', fontSize: 14, lineHeight: 18},
    card: {paddingVertical: 10},
    pressed: {opacity: 0.6},
    divider: {height: 2, opacity: 0.2, marginVertical: 10},
    match: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center'},
    side: {alignItems: 'center', width: 52},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2},
    prob: {width: 52, paddingHorizontal: 4, fontFamily: 'Sora_600SemiBold', fontVariant: ['tabular-nums']},
    rowCenter: {width: 110, alignItems: 'center', justifyContent: 'center'},
    rowDay: {textAlign: 'center'},
    rowTime: {fontFamily: 'Sora_600SemiBold', fontSize: 18, lineHeight: 24, textAlign: 'center', fontVariant: ['tabular-nums']},
    rowScore: {fontFamily: 'Sora_600SemiBold', fontSize: 26, lineHeight: 32, textAlign: 'center', fontVariant: ['tabular-nums']},
    rowStatus: {justifyContent: 'center', marginTop: 2},
    venue: {textAlign: 'center', marginTop: 10},
    probBlock: {marginTop: 10, gap: 6},
    probCaption: {justifyContent: 'space-between'},
    list: {},
});
