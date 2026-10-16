// Rinkside expected-goals (xG) model built directly on the NHL play-by-play feed.
//
// Logistic regression on unblocked shot attempts (Fenwick) with the standard public-model
// features: distance, angle, shot type, rebounds, rush shots, manpower and empty nets. The
// coefficients follow the shape of published public xG models and are scaled so an average
// unblocked attempt is worth ≈ 0.065 goals. It's a lightweight model, not a fitted one, and the UI
// labels it as such.
//
// On top of shot xG:
//   - deserveToWin: exact Poisson-binomial distribution of goals from each team's shot xG values,
//     i.e. "if these exact chances were replayed, how often would each team win?"

import {clamp, logistic, poissonBinomial} from './math.js';

const NET_X = 89;
const COEF = {
    intercept: -1.08, // recalibrated on 2025-26 (scripts/backtest-models.mjs): mean ≈ actual goal rate
    distance: -0.058, // per foot
    angle: -0.011, // per degree off the centre line
    rebound: 0.95,
    rush: 0.35,
    powerPlay: 0.3,
    shortHanded: -0.15,
};
const SHOT_TYPE = {
    wrist: 0,
    snap: 0.08,
    slap: 0.05,
    backhand: -0.12,
    'tip-in': 0.25,
    deflected: 0.2,
    'wrap-around': -0.55,
    poke: -0.2,
    bat: -0.2,
    'between-legs': 0.1,
    cradle: 0.1,
};

const UNBLOCKED = new Set(['shot-on-goal', 'missed-shot', 'goal']);

function toSec(mmss) {
    const [m, s] = String(mmss ?? '0:00').split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
}

/** Distance (ft) and angle (deg) to the nearer net from NHL rink coordinates. */
export function shotGeometry(x, y) {
    const dx = NET_X - Math.abs(Number(x) || 0);
    const dy = Math.abs(Number(y) || 0);
    const distance = Math.hypot(dx, dy);
    // Behind the goal line → angle beyond 90°.
    const angle = dx > 0 ? (Math.atan(dy / dx) * 180) / Math.PI : 90 + (Math.atan(-dx / Math.max(dy, 0.1)) * 180) / Math.PI;
    return {distance, angle};
}

/** xG of a single unblocked attempt. */
export function shotXG({x, y, shotType, rebound = false, rush = false, emptyNet = false, manpower = 0}) {
    if (emptyNet) {
        const {distance} = shotGeometry(x, y);
        return clamp(0.95 - distance * 0.004, 0.5, 0.95);
    }
    const {distance, angle} = shotGeometry(x, y);
    const z = COEF.intercept +
        COEF.distance * distance +
        COEF.angle * angle +
        (SHOT_TYPE[shotType] ?? 0) +
        (rebound ? COEF.rebound : 0) +
        (rush ? COEF.rush : 0) +
        (manpower > 0 ? COEF.powerPlay : manpower < 0 ? COEF.shortHanded : 0);
    return clamp(logistic(z), 0.005, 0.85);
}

// zoneCode is relative to the event's owner: 'O' offensive, 'D' defensive, 'N' neutral.
function outsideOffensiveZone(ev, shootingTeam) {
    if (ev.zone === 'N') return true;
    return ev.team === shootingTeam ? ev.zone === 'D' : ev.zone === 'O';
}

/**
 * xG for every unblocked attempt in a game.
 * @param {object} pbp api-web gamecenter/{id}/play-by-play payload
 * @returns {{
 *   home: {xg, shots: Shot[], goals}, away: {xg, shots: Shot[], goals},
 *   timeline: [{t, home, away}]  // cumulative xG by game second (regulation + OT)
 * }}
 */
export function gameXG(pbp) {
    const homeId = pbp?.homeTeam?.id;
    const plays = pbp?.plays ?? [];
    const out = {home: {xg: 0, shots: [], goals: 0}, away: {xg: 0, shots: [], goals: 0}, timeline: []};
    let prev = null; // last unblocked attempt or other event, for rebound / rush detection
    let lastEvent = null;

    for (const p of plays) {
        const period = p.periodDescriptor?.number ?? 1;
        if (p.periodDescriptor?.periodType === 'SO') continue;
        const t = (period - 1) * 1200 + toSec(p.timeInPeriod);
        const d = p.details ?? {};
        const type = p.typeDescKey;

        if (UNBLOCKED.has(type) && d.xCoord != null && d.yCoord != null) {
            const isHome = d.eventOwnerTeamId === homeId;
            const sit = String(p.situationCode ?? '1551');
            const homeSk = Number(sit[2]);
            const awaySk = Number(sit[1]);
            const ownSk = isHome ? homeSk : awaySk;
            const oppSk = isHome ? awaySk : homeSk;
            // Opponent's net is empty if their goalie digit is 0.
            const oppGoalie = isHome ? sit[0] : sit[3];
            const emptyNet = oppGoalie === '0';
            const rebound = !!prev && prev.team === d.eventOwnerTeamId && prev.period === period && t - prev.t <= 3;
            // Rush: within 4s of an event that happened outside the shooting team's offensive zone.
            const rush = !rebound && !!lastEvent && lastEvent.period === period && t - lastEvent.t <= 4 &&
                outsideOffensiveZone(lastEvent, d.eventOwnerTeamId);
            const manpower = Math.sign(ownSk - oppSk); // +1 power play, 0 even, −1 shorthanded
            const xg = shotXG({x: d.xCoord, y: d.yCoord, shotType: d.shotType, rebound, rush, emptyNet, manpower});
            const side = isHome ? out.home : out.away;
            const shot = {t, period, x: d.xCoord, y: d.yCoord, xg, goal: type === 'goal', type, shotType: d.shotType, rebound, rush, emptyNet, manpower,
                playerId: d.shootingPlayerId ?? d.scoringPlayerId, eventId: p.eventId};
            side.shots.push(shot);
            side.xg += xg;
            if (shot.goal) side.goals += 1;
            prev = {team: d.eventOwnerTeamId, t, period};
            out.timeline.push({t, home: out.home.xg, away: out.away.xg});
        }
        if (d.zoneCode && d.eventOwnerTeamId) {
            lastEvent = {t, period, zone: d.zoneCode, team: d.eventOwnerTeamId};
        }
    }
    return out;
}

const MP_TYPE = {SHOT: 'shot-on-goal', MISS: 'missed-shot', GOAL: 'goal'};

/**
 * Swap our per-shot xG for MoneyPuck's (backtested clearly better) on a gameXG result.
 * Shots are matched by (game second, side, event type), which lines up ~99% of attempts; keys that
 * appear more than once in either feed are left unmatched. If fewer than `minMatch` of our shots
 * match, the game keeps our numbers entirely so a game is never shown from a mix of sources.
 * Returns {…xg, source: 'moneypuck' | 'rinkside'} with totals and the timeline recomputed.
 */
export function applyExternalXG(xg, mpRows, {minMatch = 0.95} = {}) {
    if (!xg) return xg;
    const ours = {...xg, source: 'rinkside'};
    if (!Array.isArray(mpRows) || !mpRows.length) return ours;
    const theirs = new Map();
    const dup = new Set();
    for (const r of mpRows) {
        const type = MP_TYPE[r?.event];
        const p = Number(r?.shotGoalProbability);
        if (!type || r?.shotGoalProbability === '' || r?.shotGoalProbability == null || !Number.isFinite(p)) continue;
        const key = `${Number(r.time)}|${r.team === 'HOME' ? 'H' : 'A'}|${type}`;
        if (theirs.has(key)) dup.add(key);
        theirs.set(key, p);
    }
    const keyOf = (s, side) => `${s.t}|${side}|${s.type}`;
    const all = [...xg.home.shots.map((s) => keyOf(s, 'H')), ...xg.away.shots.map((s) => keyOf(s, 'A'))];
    const seen = new Map();
    for (const k of all) seen.set(k, (seen.get(k) ?? 0) + 1);
    const usable = (k) => theirs.has(k) && !dup.has(k) && seen.get(k) === 1;
    const matched = all.filter(usable).length;
    if (!all.length || matched / all.length < minMatch) return ours;

    const remap = (team, side) => {
        const shots = team.shots.map((s) => {
            const k = keyOf(s, side);
            return usable(k) ? {...s, xg: theirs.get(k)} : s;
        });
        return {...team, shots, xg: shots.reduce((sum, s) => sum + s.xg, 0)};
    };
    const home = remap(xg.home, 'H');
    const away = remap(xg.away, 'A');
    // Rebuild the running-total timeline in game order.
    const events = [...home.shots.map((s) => ({t: s.t, h: s.xg, a: 0})), ...away.shots.map((s) => ({t: s.t, h: 0, a: s.xg}))]
        .sort((x, y) => x.t - y.t);
    let h = 0;
    let a = 0;
    const timeline = events.map((e) => {
        h += e.h;
        a += e.a;
        return {t: e.t, home: h, away: a};
    });
    return {...xg, home, away, timeline, source: 'moneypuck'};
}

/**
 * "Deserve to win": probability each team wins if every chance in the game were replayed,
 * using the exact Poisson-binomial distribution of goals from per-shot xG. Ties are split by
 * each side's share of total xG (overtime proxy). Empty-net attempts are excluded because they
 * are a consequence of the score, not of play.
 */
export function deserveToWin(homeShots, awayShots) {
    const h = homeShots.filter((s) => !s.emptyNet).map((s) => s.xg);
    const a = awayShots.filter((s) => !s.emptyNet).map((s) => s.xg);
    const dh = poissonBinomial(h);
    const da = poissonBinomial(a);
    let home = 0;
    let away = 0;
    let tie = 0;
    // Prefix sums of away for P(away < k).
    const cumA = [];
    let acc = 0;
    for (let k = 0; k < da.length; k++) {
        acc += da[k];
        cumA.push(acc);
    }
    for (let k = 0; k < dh.length; k++) {
        const below = k > 0 ? cumA[Math.min(k - 1, cumA.length - 1)] : 0;
        const equal = k < da.length ? da[k] : 0;
        home += dh[k] * below;
        tie += dh[k] * equal;
    }
    away = Math.max(0, 1 - home - tie);
    const xh = h.reduce((s, v) => s + v, 0);
    const xa = a.reduce((s, v) => s + v, 0);
    const share = xh + xa > 0 ? xh / (xh + xa) : 0.5;
    return {home: home + tie * share, away: away + tie * (1 - share), tie, xgHome: xh, xgAway: xa};
}

/** Per-player xG totals for one side: [{playerId, xg, goals, attempts}] sorted by xg desc. */
export function playerXG(shots) {
    const by = new Map();
    for (const s of shots) {
        if (!s.playerId) continue;
        const r = by.get(s.playerId) ?? {playerId: s.playerId, xg: 0, goals: 0, attempts: 0};
        r.xg += s.xg;
        r.goals += s.goal ? 1 : 0;
        r.attempts += 1;
        by.set(s.playerId, r);
    }
    return [...by.values()].sort((a, b) => b.xg - a.xg);
}
