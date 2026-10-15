import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {isLive, nhl} from '../../api/nhl';
import {moneypuck, preGameHomeWinProb, startingGoalieWithStats} from '../../api/moneypuck';
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
    useEffect(() => {
        if (wasLive.current && header.final) {
            refreshBox();
            refreshPbp();
        }
        wasLive.current = live;
    }, [live, header.final, refreshBox, refreshPbp]);

    const upcoming = header.upcoming && !started;
    const goalies = useQuery(
        () => Promise.all([
            startingGoalieWithStats(gameId, 'H', season).catch(none),
            startingGoalieWithStats(gameId, 'A', season).catch(none),
        ]).then(([home, away]) => ({home, away})),
        [gameId, season],
        {enabled: upcoming && !!season},
    );
    const teams = useQuery(({force}) => nhl.teams({}, {force}).catch(none), [], {enabled: upcoming});
    const sims = useQuery(({force}) => moneypuck.simulations({force}).catch(none), [], {enabled: !header.final});

    const fullHeader = useMemo(() => buildHeader(game, landing, box.data), [game, landing, box.data]);
    const mp = useMemo(() => parseMoneyPuckGame(mpGame.data), [mpGame.data]);

    const r = {
        landing: landingQ.refresh, box: box.refresh, pbp: pbp.refresh, mp: mpGame.refresh, rail: rail.refresh,
        goalies: goalies.refresh, teams: teams.refresh, mpPregame: mpPregame.refresh,
    };
    const refresh = useCallback(() => {
        r.landing();
        r.rail();
        if (started) {
            r.box();
            r.pbp();
            r.mp();
        }
        if (upcoming) {
            r.goalies();
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
        rail: rail.data,
        mp,
        mpPregame: mpPregame.data,
        goalies: goalies.data,
        goaliesLoading: goalies.loading,
        teams: teams.data,
        sims: sims.data,
        loading: landingQ.loading && !game,
        error: landingQ.error && !landing && !game ? landingQ.error : null,
        refreshing: landingQ.refreshing,
        refresh,
    };
}
