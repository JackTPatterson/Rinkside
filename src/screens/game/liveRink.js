// Pure helpers for the Live Rink / replay view: turn a game's play-by-play into an ordered event
// list, a win-probability series, and "state at time t" lookups. No React, no network.
// Times are game seconds elapsed (period 1 = 0…1200, period 2 = 1200…2400, …).

const mmss = (s) => {
    const [m, sec] = String(s ?? '0:00').split(':').map(Number);
    return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(sec) ? sec : 0);
};
const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export const elapsedOf = (period, timeInPeriod) => (Math.max(1, period) - 1) * 1200 + mmss(timeInPeriod);

const KIND = {goal: 'goal', 'shot-on-goal': 'shot', 'missed-shot': 'miss', 'blocked-shot': 'block', penalty: 'penalty'};

/**
 * Events in game order. Shots carry rink coordinates normalised so the home team attacks LEFT
 * (same rule as the Rink Map tab), plus xG when the matching shot is in `xgShots`.
 * Event: {id, t, kind, isHome, x, y, xg, playerId, period, clock, shotType, hs, as}
 *   hs/as = score AFTER the event.
 */
export function buildEvents(pbp, homeId, xgShots = []) {
    const xgById = new Map(xgShots.map((s) => [s.eventId, s.xg]));
    const out = [];
    let hs = 0;
    let as = 0;
    for (const p of pbp?.plays ?? []) {
        const kind = KIND[p?.typeDescKey];
        if (!kind) continue;
        const pd = p.periodDescriptor ?? {};
        if (pd.periodType === 'SO') continue;
        const d = p.details ?? {};
        const isHome = d.eventOwnerTeamId === homeId;
        const period = num(pd.number) ?? 1;
        if (kind === 'goal') {
            hs = num(d.homeScore) ?? hs + (isHome ? 1 : 0);
            as = num(d.awayScore) ?? as + (isHome ? 0 : 1);
        }
        const rx = num(d.xCoord);
        const ry = num(d.yCoord);
        const hasXY = kind !== 'penalty' && rx != null && ry != null;
        const flip = p.homeTeamDefendingSide === 'left';
        out.push({
            id: String(p.eventId ?? `${period}-${p.timeInPeriod}-${out.length}`),
            t: elapsedOf(period, p.timeInPeriod),
            kind,
            isHome,
            x: hasXY ? (flip ? -rx : rx) : null,
            y: hasXY ? (flip ? -ry : ry) : null,
            xg: xgById.get(p.eventId) ?? null,
            playerId: d.shootingPlayerId ?? d.scoringPlayerId ?? d.committedByPlayerId ?? null,
            period,
            clock: p.timeInPeriod ?? null,
            shotType: d.shotType ?? null,
            penalty: kind === 'penalty' ? {name: d.descKey ?? null, minutes: num(d.duration)} : null,
            hs,
            as,
        });
    }
    return out.sort((a, b) => a.t - b.t);
}

/** Last second of the game: the final event, the live clock, or the end of regulation. */
export function gameEnd(events, {nowT = 0, final = false} = {}) {
    const last = events.length ? events[events.length - 1].t : 0;
    return Math.max(final ? last : nowT, last, 0);
}

/** Events that have happened by game second `t`. */
export const visibleEvents = (events, t) => events.filter((e) => e.t <= t);

/** Running totals at `t`: goals, shots on goal (incl. goals), attempts and xG per side. */
export function tally(events, t) {
    const side = () => ({goals: 0, sog: 0, attempts: 0, xg: 0});
    const out = {home: side(), away: side()};
    for (const e of events) {
        if (e.t > t) break;
        if (e.kind === 'penalty') continue;
        const s = e.isHome ? out.home : out.away;
        s.attempts += 1;
        if (e.kind === 'goal') s.goals += 1;
        if (e.kind === 'goal' || e.kind === 'shot') s.sog += 1;
        if (e.xg != null && e.kind !== 'block') s.xg += e.xg;
    }
    return out;
}

/** Score at game second `t` ({home, away}). */
export function scoreAt(events, t) {
    let home = 0;
    let away = 0;
    for (const e of events) {
        if (e.t > t) break;
        if (e.kind === 'goal') {
            home = e.hs;
            away = e.as;
        }
    }
    return {home, away};
}

/**
 * Home win-probability series [{t, p}] from `wpAt(t, homeScore, awayScore)`: a point every `step`
 * seconds plus a before/after pair at every goal (so the line steps at goals).
 */
export function buildWpSeries(events, endT, wpAt, step = 120) {
    const goals = events.filter((e) => e.kind === 'goal');
    const series = [];
    let hs = 0;
    let as = 0;
    let gi = 0;
    for (let t = 0; t <= endT; t += step) {
        while (gi < goals.length && goals[gi].t <= t) {
            const g = goals[gi++];
            series.push({t: g.t, p: wpAt(g.t, hs, as)});
            hs = g.hs;
            as = g.as;
            series.push({t: g.t, p: wpAt(g.t, hs, as)});
        }
        series.push({t, p: wpAt(t, hs, as)});
    }
    while (gi < goals.length) {
        const g = goals[gi++];
        series.push({t: g.t, p: wpAt(g.t, hs, as)});
        hs = g.hs;
        as = g.as;
        series.push({t: g.t, p: wpAt(g.t, hs, as)});
    }
    return series.sort((a, b) => a.t - b.t);
}

/** MoneyPuck rows [{p, time}] → the same shape (rows without a time are dropped). */
export const wpSeriesFromRows = (rows) =>
    (rows ?? []).filter((r) => r.time != null && Number.isFinite(r.p)).map((r) => ({t: r.time, p: r.p}));

/** Home win probability at `t`: linear between samples; at a goal's exact second, the after value. */
export function wpAtTime(series, t) {
    if (!series?.length) return 0.5;
    if (t <= series[0].t) return series[0].p;
    let lo = 0;
    let hi = series.length - 1;
    if (t >= series[hi].t) return series[hi].p;
    // Last index with series[i].t <= t.
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (series[mid].t <= t) lo = mid;
        else hi = mid - 1;
    }
    const a = series[lo];
    const b = series[lo + 1];
    if (!b || b.t === a.t) return a.p;
    return a.p + ((t - a.t) / (b.t - a.t)) * (b.p - a.p);
}

/** Event ids that fall in (from, to]: what a playback tick just passed. */
export const passedEvents = (events, from, to) => events.filter((e) => e.t > from && e.t <= to);

/** Short label like "2nd 12:34" for a game second. */
export function clockLabel(t, periodName) {
    const period = Math.floor(t / 1200) + 1;
    const into = t - (period - 1) * 1200;
    const m = Math.floor(into / 60);
    const s = String(Math.floor(into % 60)).padStart(2, '0');
    return `${periodName(period)} ${m}:${s}`;
}
