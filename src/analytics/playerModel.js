// Player-level models: Bayesian "true talent" estimates, season projections with uncertainty,
// and a streak detector that tells you whether a hot/cold run is likely signal or noise.

import {betaQuantile, negBinQuantile, poissonCdf, poissonSf} from './math.js';

/**
 * Beta priors for rates, from the spread of *true talent* across the league.
 * A Beta(α, β) prior with mean m and talent SD s has α + β = m(1 − m)/s² − 1, which is how many
 * "phantom" shots the prior is worth. E.g. goalie save% talent SD ≈ .006 → ~2400 shots, which is
 * why a goalie's save% needs most of a season to mean much.
 */
export const PRIORS = {
    shootingF: {mean: 0.105, sd: 0.032},
    shootingD: {mean: 0.05, sd: 0.017},
    savePct: {mean: 0.902, sd: 0.006},
};

export function betaPrior({mean, sd}) {
    const strength = (mean * (1 - mean)) / (sd * sd) - 1;
    return {alpha: mean * strength, beta: (1 - mean) * strength, strength};
}

/**
 * Empirical-Bayes shrinkage of a success rate (shooting %, save %).
 * @returns {{observed, estimate, lo, hi, weight}} estimate = posterior mean; [lo, hi] = 80% credible
 *   interval; weight = share of the estimate driven by the player's own data (0..1).
 */
export function shrinkRate(successes, trials, prior) {
    const {alpha, beta, strength} = betaPrior(prior);
    const s = Math.max(0, Number(successes) || 0);
    const t = Math.max(s, Number(trials) || 0);
    const a = alpha + s;
    const b = beta + (t - s);
    return {
        observed: t > 0 ? s / t : null,
        estimate: a / (a + b),
        lo: betaQuantile(0.1, a, b),
        hi: betaQuantile(0.9, a, b),
        weight: t / (t + strength),
    };
}

/**
 * Goalie save% → "true talent" and goals saved vs. an average goalie on the same shots.
 */
export function goalieTalent({saves, shotsAgainst}) {
    const sa = Number(shotsAgainst) || 0;
    const sv = Number(saves) || 0;
    const r = shrinkRate(sv, sa, PRIORS.savePct);
    return {...r, goalsSavedAboveAvg: sv - sa * PRIORS.savePct.mean};
}

/**
 * Player shooting % → regressed estimate and the goals the player "should" have on their shots.
 * `luck` > 0 means they've scored more than their estimated talent implies (expect regression).
 */
export function shootingTalent({goals, shots, position}) {
    const prior = position === 'D' ? PRIORS.shootingD : PRIORS.shootingF;
    const r = shrinkRate(goals, shots, prior);
    const expectedGoals = (Number(shots) || 0) * r.estimate;
    return {...r, expectedGoals, luck: (Number(goals) || 0) - expectedGoals};
}

/**
 * Season projection for a counting stat (goals, points, …) with a Gamma–Poisson model.
 *   rate ~ Gamma(priorRate·priorGames, priorGames)   (prior worth `priorGames` games)
 *   posterior after `gp` games with `count` events: Gamma(α + count, β + gp)
 *   remaining-games total ~ NegBin(r = α', p = β' / (β' + remaining))
 * @returns {{projected, lo, hi, rate}} final-season totals with an 80% interval.
 */
export function projectCount({count, gp, remaining, priorRate, priorGames = 20}) {
    const c = Math.max(0, Number(count) || 0);
    const g = Math.max(0, Number(gp) || 0);
    const rem = Math.max(0, Math.round(Number(remaining) || 0));
    const pr = Number.isFinite(Number(priorRate)) && Number(priorRate) > 0 ? Number(priorRate) : (g > 0 ? c / g : 0.3);
    const alpha = pr * priorGames + c;
    const beta = priorGames + g;
    const rate = alpha / beta;
    if (rem === 0) return {projected: c, lo: c, hi: c, rate};
    const p = beta / (beta + rem);
    return {
        projected: c + rate * rem,
        lo: c + negBinQuantile(0.1, alpha, p),
        hi: c + negBinQuantile(0.9, alpha, p),
        rate,
    };
}

/**
 * Is a recent run a real streak? Compares the last `window` games against the player's
 * rate in the *other* games, treating the window as Poisson.
 *
 * @param {number[]} perGame  counts per game in chronological order (e.g. points per game)
 * @returns {{status: 'hot'|'cold'|'normal', actual, expected, pValue, window}}
 *   pValue is P(a run at least this extreme | the player's normal rate).
 */
export function detectStreak(perGame, {window = 10, threshold = 0.1, minBaseline = 5} = {}) {
    const xs = (perGame ?? []).map((v) => Number(v) || 0);
    const w = Math.min(window, xs.length);
    const recent = xs.slice(-w);
    const before = xs.slice(0, xs.length - w);
    const actual = recent.reduce((a, b) => a + b, 0);
    if (w < 3) return {status: 'normal', actual, expected: null, pValue: null, window: w};
    const base = before.length >= minBaseline ? before : xs;
    const rate = base.reduce((a, b) => a + b, 0) / base.length;
    const expected = rate * w;
    if (expected <= 0) {
        return {status: actual > 0 ? 'hot' : 'normal', actual, expected, pValue: actual > 0 ? 0 : 1, window: w};
    }
    const pHigh = poissonSf(actual, expected);
    const pLow = poissonCdf(actual, expected);
    if (actual > expected && pHigh < threshold) return {status: 'hot', actual, expected, pValue: pHigh, window: w};
    if (actual < expected && pLow < threshold) return {status: 'cold', actual, expected, pValue: pLow, window: w};
    return {status: 'normal', actual, expected, pValue: Math.min(pHigh, pLow), window: w};
}

/**
 * Exponentially-weighted "form" line (recent games count more). halfLife in games.
 * Returns an array the same length as perGame.
 */
export function formLine(perGame, halfLife = 5) {
    const k = Math.pow(0.5, 1 / halfLife);
    let num = 0;
    let den = 0;
    return (perGame ?? []).map((v) => {
        num = num * k + (Number(v) || 0);
        den = den * k + 1;
        return num / den;
    });
}
