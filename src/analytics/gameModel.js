// Rinkside game model.
//
// 1. Team strength: each team's goals-for / goals-against per game, shrunk toward the league
//    average with a Bayesian prior worth PRIOR_GAMES games (so a 3-0 start doesn't read as a
//    dynasty), expressed as multiplicative attack / defence ratings.
// 2. Expected goals for a matchup: λ = league rate × attack × opponent defence × home-ice factor.
// 3. The rest of regulation is simulated *exactly* (no random sampling) as a continuous-time
//    Markov chain over the score, stepped every 10 seconds. Scoring rates depend on the state:
//      - power plays (from the live situation code),
//      - the trailing team pulling its goalie in the last ~100 seconds (and empty-net goals),
//      - "tied-late" conservatism: tied teams protect the loser point in the 3rd period.
//    Independent Poisson scoring predicts ~17% of games reach overtime; the NHL's real rate is
//    ~22-24%. The tied-late factor is calibrated every season so the model's overtime rate for an
//    average matchup matches the league's actual rate in the standings.
// 4. One chain gives everything coherently: win / regulation / overtime probabilities, the most
//    likely final scores, totals, live win probability, and win probability added per goal.

import {clamp} from './math.js';

export const PRIOR_GAMES = 12;
const DEFAULT_LEAGUE_RATE = 3.05; // goals per team per game, recent-season norm
const DEFAULT_TIE_RATE = 0.225; // share of games reaching overtime, recent-season norm
const REGULATION_SHARE = 0.975; // share of a team's goals scored in regulation
const STEP = 10; // seconds per Markov step
const MAX_GOALS = 12; // per team, additional goals tracked by the chain

// State-dependent multipliers on all-strengths scoring rates (approximate NHL norms).
const PULL_TIME = 100; // seconds left when a trailing team typically pulls its goalie
const PULLED_TRAILING_MULT = 2.5; // 6v5 attack ≈ 7.5 GF/60
const PULLED_LEADING_MULT = 4.7; // empty-net goals ≈ 14 GF/60
const PP_MULT = 2.4; // 5v4 scoring vs all-strengths average
const SH_MULT = 0.3; // short-handed scoring vs all-strengths average
const DEFAULT_TIED_LATE = 0.8;

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Builds league context + per-team ratings from the api-web `standings/now` payload.
 * @returns {{leagueRate, homeEdge, tieRate, tiedLate, teams: Record<string, {attack, defense, gp}>}}
 */
export function buildRatings(standings) {
    const rows = standings?.standings ?? standings ?? [];
    let gp = 0;
    let gf = 0;
    let homeGF = 0;
    let homeGP = 0;
    let roadGF = 0;
    let roadGP = 0;
    let ot = 0;
    for (const r of rows) {
        gp += n(r.gamesPlayed);
        gf += n(r.goalFor);
        homeGF += n(r.homeGoalsFor);
        homeGP += n(r.homeGamesPlayed);
        roadGF += n(r.roadGoalsFor);
        roadGP += n(r.roadGamesPlayed);
        ot += n(r.otLosses);
    }
    // League scoring rate, shrunk toward the long-run norm early in the season (prior = 300 team-games).
    const leagueRate = (gf + DEFAULT_LEAGUE_RATE * 300) / (gp + 300);

    // Home-ice factor (multiplicative, split evenly between the two teams), shrunk toward ~4%.
    const homeRate = (homeGF + 3.12 * 300) / (homeGP + 300);
    const roadRate = (roadGF + 2.98 * 300) / (roadGP + 300);
    const homeEdge = Math.sqrt(homeRate / roadRate);

    // Overtime rate: every game reaching OT produces exactly one OT/SO loss.
    const games = gp / 2;
    const tieRate = (ot + DEFAULT_TIE_RATE * 200) / (games + 200);

    const teams = {};
    for (const r of rows) {
        const abbrev = r.teamAbbrev?.default ?? r.teamAbbrev;
        const g = n(r.gamesPlayed);
        const attack = (n(r.goalFor) + leagueRate * PRIOR_GAMES) / (g + PRIOR_GAMES) / leagueRate;
        const defense = (n(r.goalAgainst) + leagueRate * PRIOR_GAMES) / (g + PRIOR_GAMES) / leagueRate;
        teams[abbrev] = {attack, defense, gp: g};
    }

    const tiedLate = calibrateTiedLate(leagueRate * REGULATION_SHARE, tieRate);
    return {leagueRate, homeEdge, tieRate, tiedLate, teams};
}

/**
 * Finds the tied-in-the-3rd scoring multiplier that makes an average matchup reach overtime at
 * the observed league rate. Bisection over [0.3, 1.3].
 */
const calibrationCache = new Map();

export function calibrateTiedLate(lambda, targetTie) {
    // Standings refreshes barely move these inputs; reuse the answer (key ≈ 0.1% resolution).
    const key = `${lambda.toFixed(3)}:${targetTie.toFixed(4)}`;
    if (calibrationCache.has(key)) return calibrationCache.get(key);
    const m = bisectTiedLate(lambda, targetTie);
    calibrationCache.set(key, m);
    return m;
}

function bisectTiedLate(lambda, targetTie) {
    const tie = (m) => simulateRegulation({lambdaHome: lambda, lambdaAway: lambda, tiedLate: m}).ot;
    let lo = 0.3; // low multiplier → more ties
    let hi = 1.3;
    if (tie(lo) <= targetTie) return lo;
    if (tie(hi) >= targetTie) return hi;
    // 14 halvings of a width-1 interval → ±0.00006, far below what moves any probability.
    for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (tie(mid) > targetTie) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/** Expected regulation goals for each side of a matchup. */
export function matchupRates(ratings, home, away) {
    const h = ratings?.teams?.[home] ?? {attack: 1, defense: 1};
    const a = ratings?.teams?.[away] ?? {attack: 1, defense: 1};
    const base = (ratings?.leagueRate ?? DEFAULT_LEAGUE_RATE) * REGULATION_SHARE;
    const edge = ratings?.homeEdge ?? 1.02;
    return {
        home: base * h.attack * a.defense * edge,
        away: (base * a.attack * h.defense) / edge,
    };
}

/** Parses an NHL situationCode ("1551" = away goalie, away skaters, home skaters, home goalie). */
export function parseSituation(code) {
    const s = String(code ?? '');
    if (s.length !== 4) return null;
    return {
        awayGoalie: s[0] === '1',
        awaySkaters: Number(s[1]),
        homeSkaters: Number(s[2]),
        homeGoalie: s[3] === '1',
    };
}

/**
 * Exact distribution of the rest of regulation.
 *
 * @param {object} p
 * @param {number} p.lambdaHome   home goals per 60 (all strengths, regulation)
 * @param {number} p.lambdaAway
 * @param {number} [p.diff=0]     current home − away score
 * @param {number} [p.secondsLeft=3600] seconds left in regulation
 * @param {number} [p.ppTeam=0]   +1 home on the power play, −1 away, 0 none
 * @param {number} [p.ppSeconds=0] remaining power-play seconds
 * @param {number} [p.tiedLate]   scoring multiplier while tied in the 3rd (calibrated)
 * @param {boolean} [p.pulledGoalie=true]
 * @returns {{grid: Float64Array, size: number, home: number, away: number, ot: number}}
 *   grid[h * size + a] = P(home scores h more and away scores a more in regulation);
 *   home / away = P(regulation win); ot = P(tied after regulation).
 */
export function simulateRegulation({lambdaHome, lambdaAway, diff = 0, secondsLeft = 3600, ppTeam = 0, ppSeconds = 0, tiedLate = DEFAULT_TIED_LATE, pulledGoalie = true}) {
    const size = MAX_GOALS + 1;
    let grid = new Float64Array(size * size);
    grid[0] = 1;
    const rh = Math.max(0, lambdaHome) / 3600;
    const ra = Math.max(0, lambdaAway) / 3600;
    const total = Math.max(0, secondsLeft);
    const steps = Math.ceil(total / STEP);

    for (let s = 0; s < steps; s++) {
        const remaining = total - s * STEP;
        const dt = Math.min(STEP, remaining);
        const pp = ppTeam && s * STEP < ppSeconds ? ppTeam : 0;
        const next = new Float64Array(size * size);
        for (let h = 0; h < size; h++) {
            for (let a = 0; a < size; a++) {
                const pr = grid[h * size + a];
                if (pr < 1e-13) continue;
                const d = diff + h - a;
                let mh = 1;
                let ma = 1;
                if (pp === 1) {
                    mh = PP_MULT;
                    ma = SH_MULT;
                } else if (pp === -1) {
                    mh = SH_MULT;
                    ma = PP_MULT;
                }
                if (d === 0 && remaining <= 1200) {
                    mh *= tiedLate;
                    ma *= tiedLate;
                } else if (pulledGoalie && remaining <= PULL_TIME && (d === -1 || d === -2)) {
                    mh *= PULLED_TRAILING_MULT;
                    ma *= PULLED_LEADING_MULT;
                } else if (pulledGoalie && remaining <= PULL_TIME && (d === 1 || d === 2)) {
                    ma *= PULLED_TRAILING_MULT;
                    mh *= PULLED_LEADING_MULT;
                }
                // Competing exponential clocks; at most one goal per 10-second step.
                const ph = 1 - Math.exp(-rh * mh * dt);
                const pa = 1 - Math.exp(-ra * ma * dt);
                next[h * size + a] += pr * Math.max(0, 1 - ph - pa);
                next[Math.min(h + 1, MAX_GOALS) * size + a] += pr * ph;
                next[h * size + Math.min(a + 1, MAX_GOALS)] += pr * pa;
            }
        }
        grid = next;
    }

    let home = 0;
    let away = 0;
    let ot = 0;
    for (let h = 0; h < size; h++) {
        for (let a = 0; a < size; a++) {
            const pr = grid[h * size + a];
            const d = diff + h - a;
            if (d > 0) home += pr;
            else if (d < 0) away += pr;
            else ot += pr;
        }
    }
    return {grid, size, home, away, ot};
}

/**
 * P(home wins | tied after regulation).
 * Playoffs: sudden-death race between two Poisson clocks → λh / (λh + λa).
 * Regular season: 5-minute 3v3 (a goal in ~60% of OTs), then a near coin-flip shootout.
 */
export function overtimeHomeShare(lambdaHome, lambdaAway, playoff = false) {
    const race = lambdaHome / (lambdaHome + lambdaAway || 1);
    if (playoff) return race;
    return 0.6 * race + 0.4 * (0.5 + (race - 0.5) * 0.2);
}

/**
 * Win probability from a state (convenience wrapper around simulateRegulation).
 * @returns {{home, away, ot, regHome, regAway}}
 */
export function winProbability({playoff = false, ...p}) {
    const r = simulateRegulation(p);
    const share = overtimeHomeShare(p.lambdaHome, p.lambdaAway, playoff);
    return {home: r.home + r.ot * share, away: r.away + r.ot * (1 - share), ot: r.ot, regHome: r.home, regAway: r.away};
}

/**
 * Full pregame prediction for a matchup.
 * @returns {{
 *   lambdaHome, lambdaAway, homeWin, awayWin, overtime, homeRegWin, awayRegWin,
 *   expectedTotal, scorelines: [{home, away, p}] (regulation), totals: {over55, over65}
 * }}
 */
export function predictGame(ratings, home, away, {playoff = false} = {}) {
    const {home: lh, away: la} = matchupRates(ratings, home, away);
    const tiedLate = ratings?.tiedLate ?? DEFAULT_TIED_LATE;
    const r = simulateRegulation({lambdaHome: lh, lambdaAway: la, tiedLate});
    const share = overtimeHomeShare(lh, la, playoff);

    const scorelines = [];
    let over55 = 0;
    let over65 = 0;
    let expectedTotal = 0;
    for (let h = 0; h < r.size; h++) {
        for (let a = 0; a < r.size; a++) {
            const p = r.grid[h * r.size + a];
            scorelines.push({home: h, away: a, p});
            expectedTotal += p * (h + a);
            // Overtime adds exactly one goal in regular-season games decided in OT (not in SO);
            // ignored here: totals are regulation totals, as most books quote them.
            if (h + a > 5.5) over55 += p;
            if (h + a > 6.5) over65 += p;
        }
    }
    scorelines.sort((x, y) => y.p - x.p);
    return {
        lambdaHome: lh,
        lambdaAway: la,
        homeWin: r.home + r.ot * share,
        awayWin: r.away + r.ot * (1 - share),
        overtime: r.ot,
        homeRegWin: r.home,
        awayRegWin: r.away,
        expectedTotal,
        scorelines: scorelines.slice(0, 6),
        totals: {over55, over65},
    };
}

/**
 * Re-centre a predictGame result on another source's home win probability (MoneyPuck), so the app
 * shows one number everywhere. Keeps the overtime share and how overtime wins split, and moves the
 * regulation shares so homeRegWin + overtime·(home OT share) = homeWin. Scorelines/totals are left alone.
 * Returns `pred` unchanged when `homeWin` isn't a probability.
 */
export function alignPrediction(pred, homeWin) {
    if (!pred || !Number.isFinite(homeWin) || homeWin < 0 || homeWin > 1) return pred;
    const ot = pred.overtime ?? 0;
    const otHomeShare = ot > 0 ? Math.max(0, Math.min(1, (pred.homeWin - pred.homeRegWin) / ot)) : 0.5;
    const homeRegWin = Math.max(0, Math.min(1 - ot, homeWin - ot * otHomeShare));
    return {
        ...pred,
        homeWin,
        awayWin: 1 - homeWin,
        homeRegWin,
        awayRegWin: Math.max(0, 1 - ot - homeRegWin),
    };
}

/**
 * Live win probability for an in-progress game.
 * @param {object} ratings  from buildRatings (or null → league-average teams)
 * @param {object} g { home, away, homeScore, awayScore, period, secondsRemaining (in period),
 *                     situationCode?, playoff?, ppSeconds? }
 * @returns {{home, away, ot, regHome, regAway, projected: {home, away}}}  projected = expected final score
 */
export function liveWinProbability(ratings, g) {
    const {home: lh, away: la} = matchupRates(ratings, g.home, g.away);
    const period = Number(g.period) || 1;
    const inPeriod = Number(g.secondsRemaining);
    const secondsLeft = period <= 3 ? (3 - period) * 1200 + (Number.isFinite(inPeriod) ? clamp(inPeriod, 0, 1200) : 1200) : 0;
    const hs = Number(g.homeScore) || 0;
    const as = Number(g.awayScore) || 0;
    const diff = hs - as;

    if (period > 3 && diff !== 0) {
        const homeWon = diff > 0;
        return {home: homeWon ? 1 : 0, away: homeWon ? 0 : 1, ot: 0, regHome: 0, regAway: 0, projected: {home: hs, away: as}};
    }

    let ppTeam = 0;
    const sit = parseSituation(g.situationCode);
    if (sit && sit.homeGoalie && sit.awayGoalie) {
        if (sit.homeSkaters > sit.awaySkaters) ppTeam = 1;
        else if (sit.awaySkaters > sit.homeSkaters) ppTeam = -1;
    }
    const r = simulateRegulation({
        lambdaHome: lh,
        lambdaAway: la,
        diff,
        secondsLeft,
        ppTeam,
        ppSeconds: ppTeam ? (g.ppSeconds ?? 75) : 0,
        tiedLate: ratings?.tiedLate ?? DEFAULT_TIED_LATE,
    });
    let eh = 0;
    let ea = 0;
    for (let h = 0; h < r.size; h++) {
        for (let a = 0; a < r.size; a++) {
            const p = r.grid[h * r.size + a];
            eh += p * h;
            ea += p * a;
        }
    }
    const share = overtimeHomeShare(lh, la, !!g.playoff);
    return {
        home: r.home + r.ot * share,
        away: r.away + r.ot * (1 - share),
        ot: r.ot,
        regHome: r.home,
        regAway: r.away,
        projected: {home: hs + eh, away: as + ea},
    };
}

/**
 * Win Probability Added for each goal: the change in the scoring team's win probability.
 * goals: [{period, timeInPeriod: 'MM:SS' | seconds, homeScore, awayScore, isHome}] (scores *after* the goal)
 * Returns the same goals with {wpBefore, wpAfter, wpa} from the scoring team's perspective.
 */
export function goalWPA(ratings, home, away, goals, {playoff = false} = {}) {
    return goals.map((goal) => {
        const t = typeof goal.timeInPeriod === 'number' ? goal.timeInPeriod : toSeconds(goal.timeInPeriod);
        const period = Number(goal.period) || 1;
        const secondsRemaining = period <= 3 ? 1200 - t : 0;
        const after = liveWinProbability(ratings, {home, away, homeScore: goal.homeScore, awayScore: goal.awayScore, period, secondsRemaining, playoff});
        const before = liveWinProbability(ratings, {
            home,
            away,
            homeScore: goal.homeScore - (goal.isHome ? 1 : 0),
            awayScore: goal.awayScore - (goal.isHome ? 0 : 1),
            period,
            secondsRemaining,
            playoff,
        });
        const side = goal.isHome ? 'home' : 'away';
        return {...goal, wpBefore: before[side], wpAfter: after[side], wpa: after[side] - before[side]};
    });
}

function toSeconds(mmss) {
    const [m, s] = String(mmss ?? '0:00').split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
}

/**
 * Game Excitement Index: total absolute movement of the win-probability line.
 * series: home win probabilities in [0, 1] in time order.
 */
export function excitementIndex(series) {
    const xs = (series ?? []).map(Number).filter(Number.isFinite);
    let total = 0;
    for (let i = 1; i < xs.length; i++) total += Math.abs(xs[i] - xs[i - 1]);
    const finalHome = xs.length ? xs[xs.length - 1] : 0.5;
    const winnerIsHome = finalHome >= 0.5;
    const winnerMin = xs.length ? Math.min(...xs.map((v) => (winnerIsHome ? v : 1 - v))) : null;
    let label = 'Snoozer';
    if (total >= 4) label = 'Instant classic';
    else if (total >= 2.5) label = 'Thriller';
    else if (total >= 1.3) label = 'Competitive';
    else if (total >= 0.7) label = 'Steady';
    return {index: total, label, comeback: winnerMin, swings: crossings(xs)};
}

// Times the favourite flipped (win probability crossed 50%).
function crossings(xs) {
    let c = 0;
    for (let i = 1; i < xs.length; i++) {
        if ((xs[i - 1] - 0.5) * (xs[i] - 0.5) < 0) c++;
    }
    return c;
}
