import React, {useCallback, useMemo, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {detectStreak, goalieTalent, projectCount, shootingTalent} from '../analytics';
import {HttpError} from '../api/client';
import {nhl} from '../api/nhl';
import {BackButton, EmptyState, ErrorState, FadeInView, Header, Screen, Section, Segmented, Skeleton, SkeletonList} from '../components/ui';
import {useLeague} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {useAppTheme} from '../theme';
import {loc} from '../utils/format';
import {currentSeasonId, seasonLabel} from '../utils/season';
import {
    bioRows,
    careerRows,
    fullName,
    goalieStreak,
    isGoaliePayload,
    mergeTotals,
    pointsPerGame,
    priorRates,
    remainingGames,
    seasonOptions,
    seasonTotalsFor,
    sortedGameLog,
    toNum,
    totalsFromLog,
} from './players/helpers';
import {
    BioCard,
    CareerTable,
    careerTiles,
    FormChart,
    GoalieTalentCard,
    goalieTiles,
    Hero,
    ProjectionCard,
    RecentGames,
    SeasonChart,
    ShootingTalentCard,
    skaterTiles,
    StatGrid,
    StreakCard,
} from './players/PlayerSections';

// A season with no games yet 404s or returns an empty log: treat both as "no games".
async function fetchGameLog(playerId, seasonId, force) {
    try {
        return await nhl.playerGameLog(playerId, seasonId, 2, {force});
    } catch (e) {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
    }
}

function LoadingBody() {
    return (
        <View style={styles.content}>
            <Skeleton height={124} radius={24}/>
            <Skeleton height={36} radius={12} style={{marginTop: 24}}/>
            <SkeletonList count={3} height={64} style={{marginTop: 12}}/>
            <Skeleton height={200} radius={16} style={{marginTop: 24}}/>
        </View>
    );
}

export default function PlayerScreen({navigation, route}) {
    const {colors, teamColor} = useAppTheme();
    const playerId = route.params?.playerId;
    const paramName = route.params?.name;

    const landing = useQuery(({force}) => nhl.player(playerId, {force}), [playerId], {enabled: playerId != null});
    const p = landing.data;
    const goalie = isGoaliePayload(p);
    const name = p ? fullName(p, paramName) : paramName ?? 'Player';
    const color = teamColor(p?.currentTeamAbbrev);

    const seasons = useMemo(() => (p ? seasonOptions(p) : []), [p]);
    const [pickedSeason, setPickedSeason] = useState(null);
    const seasonId = pickedSeason && seasons.some((s) => s.key === pickedSeason) ? pickedSeason : seasons[0]?.key;
    const isCurrent = seasonId === currentSeasonId();

    const logQ = useQuery(
        ({force}) => fetchGameLog(playerId, seasonId, force),
        [playerId, seasonId],
        {enabled: playerId != null && !!seasonId, keepPreviousData: false},
    );
    const log = useMemo(() => sortedGameLog(logQ.data), [logQ.data]);

    const {standings} = useLeague();
    const teamGp = useMemo(() => {
        const abbrev = p?.currentTeamAbbrev;
        const t = (standings?.standings ?? []).find((s) => loc(s?.teamAbbrev) === abbrev);
        return toNum(t?.gamesPlayed);
    }, [standings, p?.currentTeamAbbrev]);

    /* ----------------------------------------------------- derived data */

    const totals = useMemo(
        () => (p && seasonId ? mergeTotals(seasonTotalsFor(p, seasonId), totalsFromLog(log, goalie)) : null),
        [p, seasonId, log, goalie],
    );
    const bio = useMemo(() => bioRows(p), [p]);
    const career = useMemo(() => careerRows(p), [p]);
    const tiles = useMemo(() => (goalie ? goalieTiles(totals) : skaterTiles(totals)), [goalie, totals]);
    const lifetime = p?.careerTotals?.regularSeason;
    const lifetimeTiles = useMemo(() => careerTiles(lifetime, goalie), [lifetime, goalie]);

    const shooting = useMemo(() => {
        if (goalie || !totals) return null;
        return shootingTalent({goals: toNum(totals.goals) ?? 0, shots: toNum(totals.shots) ?? 0, position: p?.position});
    }, [goalie, totals, p?.position]);

    const saveTalent = useMemo(() => {
        const sa = toNum(totals?.shotsAgainst);
        if (!goalie || !sa) return null;
        return goalieTalent({saves: sa - (toNum(totals.goalsAgainst) ?? 0), shotsAgainst: sa});
    }, [goalie, totals]);

    const projection = useMemo(() => {
        if (goalie || !isCurrent || !p || p.isActive === false || !totals) return null;
        const gp = toNum(totals.gamesPlayed) ?? 0;
        const remaining = remainingGames(teamGp, gp);
        if (remaining <= 0) return null;
        const prior = priorRates(p, seasonId);
        return {
            remaining,
            priorSource: prior.source,
            goals: projectCount({count: totals.goals, gp, remaining, priorRate: prior.goals}),
            points: projectCount({count: totals.points, gp, remaining, priorRate: prior.points}),
        };
    }, [goalie, isCurrent, p, totals, teamGp, seasonId]);

    const streak = useMemo(() => {
        if (!isCurrent || log.length < 5) return null;
        return goalie ? goalieStreak(log) : detectStreak(pointsPerGame(log));
    }, [isCurrent, log, goalie]);

    const refreshing = landing.refreshing || logQ.refreshing;
    const onRefresh = useCallback(() => {
        landing.refresh();
        logQ.refresh();
    }, [landing.refresh, logQ.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ------------------------------------------------------------ render */

    let body;
    if (!p && landing.error) {
        body = <ErrorState message="Couldn’t load this player." onRetry={landing.refresh}/>;
    } else if (!p) {
        body = <LoadingBody/>;
    } else {
        const noGames = !logQ.loading && !logQ.error && !log.length;
        body = (
            <FadeInView style={styles.content}>
                <Hero p={p} name={name} color={color}/>
                <Section title="Bio" style={styles.firstSection}>
                    <BioCard rows={bio}/>
                </Section>

                {seasons.length ? (
                    <Section title="Season">
                        {seasons.length > 1 ? (
                            <Segmented options={seasons} value={seasonId} onChange={setPickedSeason} style={styles.segmented}/>
                        ) : null}
                        {tiles.length && toNum(totals?.gamesPlayed) ? (
                            <StatGrid tiles={tiles} color={color}/>
                        ) : logQ.loading ? (
                            <SkeletonList count={2} height={60}/>
                        ) : (
                            <EmptyState
                                title="No games yet"
                                message={`No regular-season NHL games in ${seasonLabel(seasonId)}.`}
                            />
                        )}
                    </Section>
                ) : null}

                {logQ.error && !logQ.data ? (
                    <ErrorState message="Couldn’t load the game log." onRetry={logQ.refresh}/>
                ) : null}

                {projection ? (
                    <ProjectionCard
                        goals={projection.goals}
                        points={projection.points}
                        priorSource={projection.priorSource}
                        remaining={projection.remaining}
                        color={color}
                    />
                ) : null}

                {streak ? <StreakCard streak={streak} goalie={goalie}/> : null}

                {!noGames && log.length ? (
                    <>
                        <FormChart log={log} goalie={goalie} color={color}/>
                        <SeasonChart key={`${seasonId}-${goalie}`} log={log} goalie={goalie} color={color}/>
                    </>
                ) : null}

                {goalie ? (
                    <GoalieTalentCard talent={saveTalent} shotsAgainst={totals?.shotsAgainst} color={color}/>
                ) : toNum(totals?.gamesPlayed) ? (
                    <ShootingTalentCard
                        talent={shooting}
                        goals={totals?.goals}
                        shots={totals?.shots}
                        position={p.position}
                        color={color}
                    />
                ) : null}

                <RecentGames log={log} goalie={goalie}/>

                {lifetimeTiles.length ? (
                    <Section title="Career totals">
                        <StatGrid tiles={lifetimeTiles} color={color}/>
                    </Section>
                ) : null}

                <CareerTable rows={career} career={lifetime} goalie={goalie} highlightSeason={seasonId}/>
            </FadeInView>
        );
    }

    return (
        <Screen>
            <Header
                title={name}
                subtitle={p ? [p.currentTeamAbbrev, p.position].filter(Boolean).join(' · ') : undefined}
                left={<BackButton onPress={() => navigation.goBack()}/>}
            />
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={p ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary}/> : undefined}>
                {body}
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    scroll: {paddingBottom: 48},
    content: {paddingHorizontal: 16},
    firstSection: {marginTop: 20},
    segmented: {marginBottom: 12},
});
