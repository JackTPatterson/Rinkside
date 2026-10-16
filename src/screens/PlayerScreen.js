import React, {useCallback, useMemo, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {detectStreak, goalieTalent, projectCount, shootingTalent} from '../analytics';
import {HttpError} from '../api/client';
import {nhl} from '../api/nhl';
import {BackButton, EmptyState, ErrorState, FadeInView, Header, Screen, Section, Skeleton} from '../components/ui';
import SeasonPicker from './players/SeasonPicker';
import BioSheet from './players/BioSheet';
import {useLeague} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {viewerCountry} from '../utils/broadcasts';
import EdgeRadial from './players/EdgeRadial';
import ShotMap from './players/ShotMap';
import {edgeTiles, goalieEdge, skaterEdge} from './players/edge';
import {GUTTER, useAppTheme} from '../theme';
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
    CareerTable,
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
    StatGridSkeleton,
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

// Mirrors the loaded layout (hero, bio card, season grid, chart) so nothing jumps when data lands.
function LoadingBody() {
    return (
        <View style={styles.content}>
            <View style={styles.skHero}>
                <Skeleton width={80} height={80} radius={40}/>
                <View style={styles.skHeroText}>
                    <Skeleton width="70%" height={24} radius={15}/>
                    <Skeleton width="50%" height={16} radius={15}/>
                </View>
            </View>
            <View style={styles.firstSection}>
                <Skeleton width={56} height={24} radius={15} style={styles.skTitle}/>
                <View style={styles.skLines}>
                    {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} width={i % 2 ? '55%' : '70%'} height={20} radius={10}/>)}
                </View>
            </View>
            <View style={styles.section}>
                <Skeleton width={80} height={24} radius={15} style={styles.skTitle}/>
                <Skeleton height={44} radius={100} style={styles.segmented}/>
                <StatGridSkeleton count={12}/>
            </View>
            <Skeleton height={220} radius={15} style={styles.section}/>
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
    const seasonIds = useMemo(() => seasons.map((o) => o.key), [seasons]);
    const [pickedSeason, setPickedSeason] = useState(null);
    const seasonId = pickedSeason && seasons.some((s) => s.key === pickedSeason) ? pickedSeason : seasons[0]?.key;
    const isCurrent = seasonId === currentSeasonId();

    const logQ = useQuery(
        ({force}) => fetchGameLog(playerId, seasonId, force),
        [playerId, seasonId],
        {enabled: playerId != null && !!seasonId, keepPreviousData: false},
    );
    const log = useMemo(() => sortedGameLog(logQ.data), [logQ.data]);
    // NHL Edge tracking (2021-22 on). A season it doesn't cover just yields no chart.
    const edgeQ = useQuery(
        ({force}) => Promise.all(goalie
            ? [nhl.edgeGoalie(playerId, seasonId, {force}), nhl.edgeGoalieMore(playerId, seasonId, {force})]
            : [nhl.edgeSkater(playerId, seasonId, {force}), nhl.edgeSkaterMore(playerId, seasonId, {force})],
        ).then(([detail, more]) => ({detail, more}), () => null),
        [playerId, seasonId, goalie],
        {enabled: playerId != null && !!seasonId && Number(String(seasonId).slice(0, 4)) >= 2021 && !!p, keepPreviousData: false},
    );
    const edge = useMemo(() => {
        const metric = viewerCountry() === 'CA';
        const d = edgeQ.data;
        return {
            radar: goalie ? goalieEdge(d?.detail) : skaterEdge(d?.detail, metric),
            tiles: edgeTiles(d?.more, goalie, metric),
        };
    }, [edgeQ.data, goalie]);

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
        edgeQ.refresh();
    }, [landing.refresh, logQ.refresh, edgeQ.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ------------------------------------------------------------ render */

    let body;
    if (playerId == null) {
        body = <EmptyState title="Player not found" message="This link doesn’t point to a player."/>;
    } else if (!p && landing.error) {
        body = <ErrorState message="Couldn’t load this player." onRetry={landing.refresh}/>;
    } else if (!p) {
        body = <LoadingBody/>;
    } else {
        const noGames = !logQ.loading && !logQ.error && !log.length;
        body = (
            <FadeInView style={styles.content}>
                <Hero p={p} name={name} color={color}/>
                {seasons.length ? (
                    <Section
                        title="Season"
                        style={styles.firstSection}
                        right={seasons.length > 1 ? (
                            <SeasonPicker seasons={seasonIds} value={seasonId} onChange={setPickedSeason}/>
                        ) : null}>
                        {tiles.length && toNum(totals?.gamesPlayed) ? (
                            <StatGrid tiles={tiles} color={color}/>
                        ) : logQ.loading ? (
                            <StatGridSkeleton count={goalie ? 6 : 12}/>
                        ) : (
                            <EmptyState
                                title="No games yet"
                                message={`No regular-season NHL games in ${seasonLabel(seasonId)}.`}
                            />
                        )}
                    </Section>
                ) : null}

                {edge.radar.length >= 3 ? (
                    <EdgeRadial metrics={edge.radar} color={color} subtitle={`${seasonLabel(seasonId)} · league percentile, 100 = best`}/>
                ) : null}
                {edge.tiles.length ? (
                    <Section title="Tracking">
                        <StatGrid tiles={edge.tiles} color={color}/>
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

                {logQ.loading && !log.length ? <Skeleton height={220} radius={15} style={styles.section}/> : null}

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
                        right={<ShotMap data={edgeQ.data?.more} color={color} seasonLabel={seasonLabel(seasonId)}/>}
                    />
                ) : null}

                <RecentGames log={log} goalie={goalie}/>


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
                right={p ? <BioSheet rows={bio} name={name}/> : null}
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
    content: {paddingHorizontal: GUTTER},
    firstSection: {marginTop: 10},
    section: {marginTop: 20},
    skTitle: {marginBottom: 12},
    skLines: {gap: 18, paddingVertical: 6},
    segmented: {marginBottom: 10},
    skHero: {flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 10},
    skHeroText: {flex: 1, gap: 8},
});
