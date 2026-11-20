// "Game Pulse": turn what's happening in a game into haptic patterns. Pure and unit-tested; the
// component maps each step onto expo-haptics. All times are milliseconds.

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * How tense the game is right now, 0…1. Combines how close win probability is to a coin flip with
 * how little time is left: a tied overtime is ~1, a 4–0 first period ~0.
 *   wpHome 0…1; period number; secondsLeft in the current period.
 */
export function tension({wpHome, period = 1, secondsLeft = 1200, playoff = false}) {
    if (!Number.isFinite(wpHome)) return 0;
    const closeness = 1 - Math.abs(2 * wpHome - 1); // 1 at 50%, 0 at 0%/100%
    let urgency;
    if (period > 3) urgency = 1;
    else {
        const left = (3 - period) * 1200 + clamp(secondsLeft, 0, 1200);
        urgency = 0.15 + 0.85 * (1 - clamp(left / 3600, 0, 1)) ** 1.5;
    }
    const t = clamp(closeness ** 1.5 * urgency * (playoff ? 1.1 : 1), 0, 1);
    return Math.round(t * 1000) / 1000;
}

/** Heartbeat spacing: null when calm, quickening from 2.4 s to 0.8 s as tension rises past 0.35. */
export function heartbeatInterval(t) {
    if (!(t >= 0.35)) return null;
    const k = clamp((t - 0.35) / 0.65, 0, 1);
    return Math.round(2400 - k * 1600);
}

/**
 * What just changed between two readings? Each reading: {hs, as, wp} (home perspective).
 * Returns moments: {kind: 'goal', home, big} for a goal (big = moved win probability ≥ 20 points)
 * or {kind: 'swing', home} when win probability jumped ≥ 12 points without a goal.
 */
export function moments(prev, next, {swing = 0.12, big = 0.2} = {}) {
    if (!prev || !next) return [];
    const out = [];
    const dh = next.hs - prev.hs;
    const da = next.as - prev.as;
    const dwp = Number.isFinite(next.wp) && Number.isFinite(prev.wp) ? next.wp - prev.wp : 0;
    if (dh > 0 || da > 0) {
        if (dh > 0) out.push({kind: 'goal', home: true, big: Math.abs(dwp) >= big});
        if (da > 0) out.push({kind: 'goal', home: false, big: Math.abs(dwp) >= big});
    } else if (Math.abs(dwp) >= swing) {
        out.push({kind: 'swing', home: dwp > 0});
    }
    return out;
}

/**
 * Haptic steps for a moment, from the point of view of whoever is watching.
 *   cheer: 'for' (your team's moment), 'against', or null (neutral, no favourite involved).
 * Step: {type: 'impact' | 'notify', style, at} where `at` is the delay in ms.
 */
export function plan(moment, cheer = null) {
    if (moment.kind === 'goal') {
        if (cheer === 'for') {
            // A rising crescendo ending in a success buzz.
            return [
                {type: 'impact', style: 'light', at: 0},
                {type: 'impact', style: 'medium', at: 110},
                {type: 'impact', style: 'heavy', at: 230},
                {type: 'notify', style: 'success', at: 380},
                ...(moment.big ? [{type: 'impact', style: 'heavy', at: 620}] : []),
            ];
        }
        if (cheer === 'against') {
            // A sinking thud.
            return [
                {type: 'impact', style: 'heavy', at: 0},
                {type: 'impact', style: 'light', at: 220},
                {type: 'notify', style: 'warning', at: 420},
            ];
        }
        return [
            {type: 'impact', style: 'medium', at: 0},
            {type: 'impact', style: 'heavy', at: 150},
        ];
    }
    // swing
    return cheer === 'against'
        ? [{type: 'impact', style: 'rigid', at: 0}, {type: 'impact', style: 'soft', at: 160}]
        : [{type: 'impact', style: 'soft', at: 0}, {type: 'impact', style: 'rigid', at: 160}];
}

/** Which side of the moment is the watcher on? */
export function cheerFor(moment, favoriteIsHome) {
    if (favoriteIsHome == null) return null;
    return moment.home === favoriteIsHome ? 'for' : 'against';
}

/** A heartbeat is a double tap ("lub-dub"); louder as tension rises. */
export function heartbeatPlan(t) {
    const strong = t >= 0.7;
    return [
        {type: 'impact', style: strong ? 'heavy' : 'medium', at: 0},
        {type: 'impact', style: strong ? 'medium' : 'light', at: 140},
    ];
}
