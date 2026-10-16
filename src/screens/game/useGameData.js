import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {isLive, nhl} from '../../api/nhl';
import {moneypuck, preGameHomeWinProb, startingGoalieWithStats} from '../../api/moneypuck';
import {fetchStartingGoalies, teamSlug} from '../../api/dailyfaceoff';
import {fetchTeamMilestones} from '../../api/fan';
import {useQuery} from '../../hooks/useQuery';
import {buildHeader, parseMoneyPuckGame} from './model';

const LIVE_POLL = 15 * 1000;
const SOON_POLL = 60 * 1000;
const none = () => null;

/**
 * Every request the game screen needs, with polling while the game is live.
 * `game` is the optional score-feed object passed in route params for an instant first paint.
 */
export function useGameData(gameId, game) {
    const [poll, setPoll] = useState(() => (isLive(game) ? LIVE_POLL : 0));
    const landingQ = useQuery(({force}) => nhl.landing(gameId, {force}), [gameId], {refetchInterval: poll});
    const landing = landingQ.data;
    const header = useMemo(() => buildHeader(game, landing, undefined), [game, landing]);
    const live = header.live;
    const startsSoon = !!(header.upcoming && header.startTimeUTC && new Date(header.startTimeUTC) - Date.now() < 30 * 60 * 1000);
    const nextPoll = live ? LIVE_POLL : startsSoon ? SOON_POLL : 0;
    useEffect(() => setPoll(nextPoll), [nextPoll]);

    const started = header.started;
    const box = useQuery(({force}) => nhl.boxscore(gameId, {force}), [gameId], {
        enabled: started,
        refetchInterval: live ? LIVE_POLL : 0,
    });
    const pbp = useQuery(({force}) => nhl.playByPlay(gameId, {force}), [gameId], {
        enabled: started,
        refetchInterval: live ? LIVE_POLL : 0,
    });
    // Shift charts give who was on the ice (for on-ice Game Score terms). Optional: null on failure.
    const shifts = useQuery(({force}) => nhl.shiftCharts(gameId, {force, live}).catch(none), [gameId], {
        enabled: started,
        refetchInterval: live ? LIVE_POLL : 0,
    });
    const rail = useQuery(({force}) => nhl.rightRail(gameId, {force}).catch(none), [gameId], {
        refetchInterval: live ? 2 * LIVE_POLL : 0,
    });

    const season = header.season;
    const mpGame = useQuery(
        ({force}) => (season ? moneypuck.gameData(season, gameId, {force}).catch(none) : Promise.resolve(null)),
        [season, gameId],
        {enabled: started && !!season, refetchInterval: live ? 4 * LIVE_POLL : 0},
    );
    const mpPregame = useQuery(() => preGameHomeWinProb(gameId).catch(none), [gameId]);

    // When a game we were polling goes final, fetch the box score / play-by-play once more so the
    // last seconds aren't missing (polling stops as soon as landing reports FINAL/OFF).
    const wasLive = useRef(live);
    const refreshBox = box.refresh;
    const refreshPbp = pbp.refresh;
    const refreshShifts = shifts.refresh;
    useEffect(() => {
        if (wasLive.current && header.final) {
            refreshBox();
            refreshPbp();
            refreshShifts();
        }
        wasLive.current = live;
    }, [live, header.final, refreshBox, refreshPbp, refreshShifts]);

    const upcoming = header.upcoming && !started;
    const homeAbbrev = header.home.abbrev;
    const awayAbbrev = header.away.abbrev;
    const gameDate = header.gameDate;
    const goalies = useQuery(
        async ({force}) => {
            // DailyFaceoff's report (Confirmed / Likely) sharpens MoneyPuck's projected starters.
            const reports = gameDate ? await fetchStartingGoalies(gameDate, {force}).catch(none) : null;
            const report = reports?.[`${teamSlug(awayAbbrev)}@${teamSlug(homeAbbrev)}`];
            const [home, away] = await Promise.all([
                startingGoalieWithStats(gameId, 'H', season, report?.home).catch(none),
                startingGoalieWithStats(gameId, 'A', season, report?.away).catch(none),
            ]);
            return {home, away};
        },
        [gameId, season, gameDate, homeAbbrev, awayAbbrev],
        {enabled: upcoming && !!season},
    );
    // Milestone watch and hot streaks for both teams (null for a team whose data failed).
    const milestones = useQuery(
        ({force}) => Promise.all([homeAbbrev, awayAbbrev].map((t) => fetchTeamMilestones(t, {force}).catch(none))),
        [homeAbbrev, awayAbbrev],
        {enabled: upcoming && !!homeAbbrev && !!awayAbbrev},
    );
    const teams = useQuery(({force}) => nhl.teams({}, {force}).catch(none), [], {enabled: upcoming});
    const sims = useQuery(({force}) => moneypuck.simulations({force}).catch(none), [], {enabled: !header.final});

    const fullHeader = useMemo(() => buildHeader(game, landing, box.data), [game, landing, box.data]);
    const mp = useMemo(() => parseMoneyPuckGame(mpGame.data), [mpGame.data]);

    const r = {
        landing: landingQ.refresh, box: box.refresh, pbp: pbp.refresh, shifts: shifts.refresh, mp: mpGame.refresh, rail: rail.refresh,
        goalies: goalies.refresh, teams: teams.refresh, mpPregame: mpPregame.refresh, milestones: milestones.refresh,
    };
    const refresh = useCallback(() => {
        r.landing();
        r.rail();
        if (started) {
            r.box();
            r.pbp();
            r.shifts();
            r.mp();
        }
        if (upcoming) {
            r.goalies();
            r.milestones();
            r.teams();
            r.mpPregame();
        }
        // All refresh functions are stable (useCallback inside useQuery).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [started, upcoming]);

    return {
        header: fullHeader,
        landing,
        box: box.data,
        pbp: pbp.data,
        shifts: shifts.data, // raw shift-chart payload ({data: [...]}) or null
        rail: rail.data,
        mp,
        mpRows: mpGame.data, // raw MoneyPuck gameData rows (per-shot xG), or null
        mpPregame: mpPregame.data,
        goalies: goalies.data,
        goaliesLoading: goalies.loading,
        milestones: milestones.data,
        teams: teams.data,
        sims: sims.data,
        loading: landingQ.loading && !game,
        error: landingQ.error && !landing && !game ? landingQ.error : null,
        refreshing: landingQ.refreshing,
        refresh,
    };
}
