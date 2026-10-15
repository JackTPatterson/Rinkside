// Team-level metrics derived from standings and the stats API.

import {projectCount} from './playerModel.js';

const PYTHAG_EXPONENT = 2.05; // hockey's best-fit Pythagorean exponent is ~2.0–2.1

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Pythagorean expectation: share of games a team "should" win from its goal totals. */
export function pythagorean(gf, ga, exponent = PYTHAG_EXPONENT) {
    const f = Math.pow(Math.max(0, gf), exponent);
    const a = Math.pow(Math.max(0, ga), exponent);
    return f + a > 0 ? f / (f + a) : 0.5;
}

/**
 * Per-team derived numbers from a standings row (api-web standings/now).
 * leaguePointPct: average points% across the league (≈ .555 because of loser points).
 */
export function teamProfile(row, {leaguePointPct = 0.555, seasonGames = 82} = {}) {
    const gp = n(row.gamesPlayed);
    const gf = n(row.goalFor);
    const ga = n(row.goalAgainst);
    const points = n(row.points);
    const pyth = pythagorean(gf, ga);
    // Shift Pythag (which averages .500) by the league's loser-point inflation.
    const expectedPointPct = pyth + (leaguePointPct - 0.5);
    const expectedPoints = expectedPointPct * 2 * gp;
    const remaining = Math.max(0, seasonGames - gp);
    // Points projection: Gamma–Poisson on points per game, prior = league average over 15 games.
    const proj = projectCount({count: points, gp, remaining, priorRate: leaguePointPct * 2, priorGames: 15});
    return {
        gp,
        points,
        pointPct: gp ? points / (2 * gp) : 0,
        pyth,
        expectedPoints,
        luck: points - expectedPoints,
        goalDiffPerGame: gp ? (gf - ga) / gp : 0,
        pace: gp ? (points / gp) * seasonGames : 0,
        projected: proj.projected,
        projectedLo: proj.lo,
        projectedHi: proj.hi,
    };
}

export function leaguePointPct(rows) {
    let pts = 0;
    let gp = 0;
    for (const r of rows ?? []) {
        pts += n(r.points);
        gp += n(r.gamesPlayed);
    }
    return gp ? pts / (2 * gp) : 0.555;
}

/**
 * PDO = shooting% + save% (at all strengths here), ×1000. ~1000 is average; teams far from it
 * tend to regress. Inputs are the stats-API team summary per-game fields.
 */
export function pdo({goalsForPerGame, goalsAgainstPerGame, shotsForPerGame, shotsAgainstPerGame}) {
    const sh = n(shotsForPerGame) ? n(goalsForPerGame) / n(shotsForPerGame) : null;
    const sv = n(shotsAgainstPerGame) ? 1 - n(goalsAgainstPerGame) / n(shotsAgainstPerGame) : null;
    if (sh == null || sv == null) return null;
    return {shootingPct: sh, savePct: sv, pdo: (sh + sv) * 1000};
}

/**
 * Projected playoff picture for a conference: each team's projected points vs. the projected
 * 8th-place line, and the points-per-game a team needs from here to reach that line.
 * rows: standings rows for one conference.
 */
export function playoffLine(rows, opts = {}) {
    const lp = opts.leaguePointPct ?? 0.555;
    const seasonGames = opts.seasonGames ?? 82;
    const profiles = (rows ?? []).map((r) => ({abbrev: r.teamAbbrev?.default ?? r.teamAbbrev, row: r, ...teamProfile(r, {leaguePointPct: lp, seasonGames})}));
    const sorted = [...profiles].sort((a, b) => b.projected - a.projected);
    const line = sorted[7]?.projected ?? null;
    return {
        line,
        teams: profiles.map((p) => {
            const remaining = Math.max(0, seasonGames - p.gp);
            const needed = line == null ? null : Math.max(0, line - p.points);
            return {
                ...p,
                cushion: line == null ? null : p.projected - line,
                neededPerGame: remaining ? needed / remaining : null,
                neededPointPct: remaining && needed != null ? needed / (2 * remaining) : null,
            };
        }),
    };
}
