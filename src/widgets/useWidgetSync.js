import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import {isLive, nhl} from '../api/nhl';
import {toISODate} from '../utils/format';
import {getLiveActivityEnabled, syncLiveActivity} from './liveActivity';
import {widgetModules} from './index';
import {buildSnapshot, buildTimeline, pickGame} from './snapshot';

const LIVE_EVERY = 30 * 1000;
const IDLE_EVERY = 5 * 60 * 1000;
// Don't re-push an unchanged snapshot more often than this (widget reloads are budgeted by iOS).
const REPUSH_MS = 15 * 60 * 1000;

const sigOf = (snap) => JSON.stringify({...snap, updatedAt: 0});

/** Fetch what the widgets show for `team` and build a snapshot. Throws on network failure. */
export async function loadSnapshot(team, {force = false} = {}) {
    // `force` is for the week only: it carries the live score. Standings move slowly, so use the cache.
    const [week, standings] = await Promise.all([
        nhl.clubWeek(team, {force}),
        nhl.standings().catch(() => null),
    ]);
    let games = week?.games ?? [];
    // Nothing this week (a break, or the week's games are all long done): look further ahead.
    if (!pickGame(games)) {
        const season = await nhl.clubSeason(team).catch(() => null);
        games = season?.games ?? games;
    }
    // The score feed has the live clock and shots on goal that the schedule feed lacks.
    let liveGame = null;
    const picked = pickGame(games);
    if (picked && isLive(picked)) {
        const day = picked.gameDate ?? toISODate(new Date(Date.now() - 4 * 3600 * 1000));
        const scores = await nhl.score(day, {force: true}).catch(() => null);
        liveGame = scores?.games?.find((g) => g.id === picked.id) ?? null;
    }
    return buildSnapshot({team, standings, games, liveGame});
}

/**
 * Keeps the home/lock screen widgets and the Live Activity in step with the app. Runs while the app
 * is running: on launch, on returning to the foreground, then every 30 s during a live game and every
 * 5 min otherwise. Does nothing without a native build that includes expo-widgets.
 */
export function useWidgetSync(team) {
    const last = useRef({sig: null, at: 0});

    useEffect(() => {
        const modules = widgetModules();
        if (!modules || !team) return undefined;
        let cancelled = false;
        let timer = null;
        let generation = 0; // a restart (foreground, team change) supersedes any tick still in flight

        const tick = async () => {
            const mine = ++generation;
            let next = IDLE_EVERY;
            try {
                const snap = await loadSnapshot(team, {force: true});
                if (cancelled || mine !== generation || !snap) return;
                if (snap.game?.state === 'live') next = LIVE_EVERY;

                const sig = sigOf(snap);
                const now = Date.now();
                if (sig !== last.current.sig || now - last.current.at > REPUSH_MS) {
                    const entries = buildTimeline(snap, now).map((e) => ({date: new Date(e.date), props: e.props}));
                    modules.nextGame.updateTimeline(entries);
                    modules.teamForm.updateTimeline(entries);
                    last.current = {sig, at: now};
                }
                await syncLiveActivity(modules.gameActivity, snap, await getLiveActivityEnabled());
            } catch {
                // Offline or a bad payload: keep whatever the widgets already show.
            } finally {
                if (!cancelled && mine === generation) timer = setTimeout(tick, next);
            }
        };

        const restart = () => {
            clearTimeout(timer);
            tick();
        };
        restart();
        const sub = AppState.addEventListener('change', (s) => s === 'active' && restart());
        return () => {
            cancelled = true;
            clearTimeout(timer);
            sub.remove();
        };
    }, [team]);
}
