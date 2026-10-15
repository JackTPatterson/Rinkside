// Pure helpers for the Scores tab: status labels, model win probabilities (cached), sectioning and
// the "Game of the night" pick. No React in here.
import {liveWinProbability, predictGame} from '../../analytics';
import {isFinal, isLive, isUpcoming} from '../../api/nhl';
import {formatTime, mmssToSeconds, periodLabel} from '../../utils/format';

export const isPostponed = (g) => g?.gameScheduleState === 'PPD' || g?.gameScheduleState === 'CNCL' || g?.gameScheduleState === 'SUSP';

/** 'live' | 'upcoming' | 'final' — postponed / unknown states fall in with upcoming. */
export function gameBucket(g) {
    if (isLive(g)) return 'live';
    if (isFinal(g)) return 'final';
    return 'upcoming';
}

export const gamePeriod = (g) => Number(g?.periodDescriptor?.number ?? g?.period) || 0;

/** Short status text for the centre of a card. */
export function statusLabel(g) {
    if (!g) return '';
    if (isPostponed(g)) return g.gameScheduleState === 'CNCL' ? 'Cancelled' : 'Postponed';
    if (isFinal(g)) {
        const t = g.gameOutcome?.lastPeriodType ?? g.periodDescriptor?.periodType;
        if (t === 'OT') return 'Final · OT';
        if (t === 'SO') return 'Final · SO';
        return 'Final';
    }
    if (isLive(g)) {
        const period = gamePeriod(g);
        if (!period) return 'Live';
        const p = periodLabel(period, g.periodDescriptor?.periodType);
        if (g.clock?.inIntermission) return `${p} INT`;
        if (g.periodDescriptor?.periodType === 'SO') return 'Shootout';
        const clock = g.clock?.timeRemaining;
        return clock ? `${p} · ${clock}` : p;
    }
    if (g.gameState === 'PRE') return 'Pregame';
    if (g.gameScheduleState === 'TBD') return 'TBD';
    const start = g.startTimeUTC ? new Date(g.startTimeUTC) : null;
    return start && !Number.isNaN(start.getTime()) ? formatTime(start) : 'TBD';
}

/* ---------------------------------------------------------- model cache */

// predictGame / liveWinProbability run an exact Markov chain; cache per ratings object so
// re-renders and 15 s polls only recompute games whose state actually changed.
const modelCache = new WeakMap();
// Live keys change every poll (clock); keep the per-ratings map from growing all night.
const MAX_LIVE_ENTRIES = 300;
function cacheFor(ratings) {
    let m = modelCache.get(ratings);
    if (!m) {
        m = {pre: new Map(), live: new Map()};
        modelCache.set(ratings, m);
    }
    return m;
}

function pregame(ratings, home, away, playoff) {
    const cache = cacheFor(ratings).pre;
    const key = `${home}:${away}:${playoff ? 'p' : 'r'}`;
    if (!cache.has(key)) {
        try {
            const p = predictGame(ratings, home, away, {playoff});
            cache.set(key, Number.isFinite(p.homeWin) && Number.isFinite(p.awayWin) ? {home: p.homeWin, away: p.awayWin, kind: 'pregame'} : null);
        } catch {
            cache.set(key, null);
        }
    }
    return cache.get(key);
}

function live(ratings, g) {
    const home = g.homeTeam?.abbrev;
    const away = g.awayTeam?.abbrev;
    const period = gamePeriod(g) || 1;
    // secondsRemaining is per period; during intermission the clock counts the break, not play.
    const secondsRemaining = g.clock?.inIntermission ? 0 : Number(g.clock?.secondsRemaining);
    const hs = Number(g.homeTeam?.score) || 0;
    const as = Number(g.awayTeam?.score) || 0;
    // The score feed carries the manpower situation during power plays / pulled goalies.
    const situationCode = g.situation?.situationCode ?? g.situationCode;
    const ppLeft = g.situation?.timeRemaining != null ? mmssToSeconds(g.situation.timeRemaining) : undefined;
    const ppSeconds = Number.isFinite(ppLeft) && ppLeft > 0 ? ppLeft : undefined;
    const cache = cacheFor(ratings).live;
    const key = `${home}:${away}:${hs}:${as}:${period}:${secondsRemaining}:${situationCode ?? ''}:${ppSeconds ?? ''}`;
    if (!cache.has(key)) {
        if (cache.size >= MAX_LIVE_ENTRIES) cache.clear();
        try {
            const p = liveWinProbability(ratings, {
                home, away, homeScore: hs, awayScore: as, period,
                secondsRemaining: Number.isFinite(secondsRemaining) ? secondsRemaining : undefined,
                situationCode,
                ppSeconds,
                playoff: g.gameType === 3,
            });
            cache.set(key, Number.isFinite(p.home) && Number.isFinite(p.away) ? {home: p.home, away: p.away, kind: 'live'} : null);
        } catch {
            cache.set(key, null);
        }
    }
    return cache.get(key);
}

/**
 * Rinkside model win probability for a game: {home, away, kind: 'live' | 'pregame'} or null.
 * Finished games return the pre-game number (useful as "the model had X%").
 */
export function modelProbability(ratings, g) {
    if (!ratings || !g?.homeTeam?.abbrev || !g?.awayTeam?.abbrev) return null;
    // Cached objects keep their identity across polls, so memoised cards can skip re-rendering.
    return isLive(g) ? live(ratings, g) : pregame(ratings, g.homeTeam.abbrev, g.awayTeam.abbrev, g.gameType === 3);
}

/* ------------------------------------------------------- game of night */

function strength(ratings, abbrev) {
    const t = ratings?.teams?.[abbrev];
    if (!t || !t.defense) return 1;
    return t.attack / t.defense;
}

/**
 * Upcoming game that is both closest to a coin flip and played between the strongest pair of
 * teams. score = closeness (1 at 50/50, 0 at 100/0) × geometric mean of both teams' strength
 * (attack ÷ defence rating). Needs at least two upcoming games to be meaningful.
 */
export function gameOfTheNight(games, ratings, probs) {
    if (!ratings) return null;
    const candidates = games.filter((g) => isUpcoming(g) && !isPostponed(g) && probs[g.id]);
    if (candidates.length < 2) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const g of candidates) {
        const p = probs[g.id].home;
        const closeness = 1 - Math.abs(p - 0.5) * 2;
        const s = Math.sqrt(strength(ratings, g.homeTeam?.abbrev) * strength(ratings, g.awayTeam?.abbrev));
        const score = closeness * s;
        if (score > bestScore) {
            bestScore = score;
            best = g.id;
        }
    }
    return best;
}

/* ------------------------------------------------------------ sections */

const byStart = (a, b) => String(a.startTimeUTC ?? '').localeCompare(String(b.startTimeUTC ?? '')) || (a.id ?? 0) - (b.id ?? 0);

export const SECTION_TITLES = {favorite: 'Your team', live: 'Live', upcoming: 'Upcoming', final: 'Final'};

/** SectionList sections: favourite's game pinned first, then Live → Upcoming → Final. */
export function buildSections(games, favorite) {
    const sorted = [...games].sort(byStart);
    const fav = favorite
        ? sorted.find((g) => g.homeTeam?.abbrev === favorite || g.awayTeam?.abbrev === favorite)
        : null;
    const buckets = {live: [], upcoming: [], final: []};
    for (const g of sorted) {
        if (fav && g.id === fav.id) continue;
        buckets[gameBucket(g)].push(g);
    }
    const sections = [];
    if (fav) sections.push({key: 'favorite', title: SECTION_TITLES.favorite, data: [fav]});
    for (const k of ['live', 'upcoming', 'final']) {
        if (buckets[k].length) sections.push({key: k, title: SECTION_TITLES[k], data: buckets[k]});
    }
    return sections;
}

/** Everything a game card displays; used to skip re-renders when a poll returns an unchanged game. */
export function gameSignature(g) {
    if (!g) return '';
    const t = (x) => `${x?.abbrev}|${x?.score}|${x?.sog}|${x?.record}`;
    return [
        g.id, g.gameState, g.gameScheduleState, g.startTimeUTC, g.period, g.periodDescriptor?.number,
        g.periodDescriptor?.periodType, g.clock?.timeRemaining, g.clock?.inIntermission, g.gameOutcome?.lastPeriodType,
        g.season, g.gameType, t(g.homeTeam), t(g.awayTeam),
    ].join('~');
}

/**
 * Polling interval for a day's scores: fast while anything is live, slow while a game is about to
 * start (so it flips to live without a manual refresh), otherwise none.
 */
export function pollInterval(games, now = new Date(), {live = 15000, soon = 60000} = {}) {
    if (games.some(isLive)) return live;
    const t = now.getTime();
    const starting = games.some((g) => {
        if (isFinal(g) || isPostponed(g)) return false;
        if (g.gameState === 'PRE') return true;
        const start = g.startTimeUTC ? new Date(g.startTimeUTC).getTime() : NaN;
        // From 10 minutes before puck drop until a few hours after (delays, stuck FUT states).
        return Number.isFinite(start) && start - t < 10 * 60000 && t - start < 4 * 3600000;
    });
    return starting ? soon : 0;
}
