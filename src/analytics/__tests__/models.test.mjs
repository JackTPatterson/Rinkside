import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
    alignPrediction,
    buildRatings,
    calibrateTiedLate,
    excitementIndex,
    goalWPA,
    liveWinProbability,
    predictGame,
    winProbability,
} from '../gameModel.js';
import {gameScores, goalieGameScore, onIceCounts, parseShifts, skaterGameScore} from '../gameScore.js';
import {betaInc, betaQuantile, lgamma, negBinPmf, poissonBinomial, poissonPmf, poissonVector} from '../math.js';
import {detectStreak, formLine, goalieTalent, projectCount, shootingTalent, shrinkRate} from '../playerModel.js';
import {pdo, playoffLine, pythagorean, teamProfile} from '../teamMetrics.js';
import {applyExternalXG, deserveToWin, gameXG, shotGeometry, shotXG} from '../xg.js';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b} (±${eps})`);

/* ---------------------------------------------------------------- math */

test('lgamma matches factorials', () => {
    close(lgamma(5), Math.log(24), 1e-10);
    close(lgamma(1), 0, 1e-10);
    close(lgamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-10);
});

test('poisson pmf sums to 1', () => {
    close(poissonVector(3.1, 40).reduce((a, b) => a + b, 0), 1, 1e-9);
    close(poissonPmf(0, 2), Math.exp(-2), 1e-12);
});

test('regularised incomplete beta + quantile round-trip', () => {
    close(betaInc(0.5, 2, 2), 0.5, 1e-10);
    close(betaInc(0.3, 1, 1), 0.3, 1e-10);
    const q = betaQuantile(0.9, 30, 270);
    close(betaInc(q, 30, 270), 0.9, 1e-8);
});

test('negative binomial pmf sums to 1', () => {
    let s = 0;
    for (let k = 0; k < 500; k++) s += negBinPmf(k, 12.5, 0.4);
    close(s, 1, 1e-8);
});

test('poisson-binomial matches binomial', () => {
    const d = poissonBinomial([0.5, 0.5, 0.5]);
    assert.deepEqual(d.map((v) => +v.toFixed(3)), [0.125, 0.375, 0.375, 0.125]);
});

/* ----------------------------------------------------------- game model */

const team = (abbrev, gp, gf, ga, extra = {}) => ({
    teamAbbrev: {default: abbrev}, gamesPlayed: gp, goalFor: gf, goalAgainst: ga,
    homeGoalsFor: gf / 2 + 3, homeGamesPlayed: gp / 2, roadGoalsFor: gf / 2 - 3, roadGamesPlayed: gp / 2,
    otLosses: Math.round(gp * 0.12), points: extra.points ?? gp, ...extra,
});
const league = {standings: [team('AAA', 82, 300, 220), team('BBB', 82, 250, 250), team('CCC', 82, 220, 290), team('DDD', 82, 250, 250)]};

test('tied-late calibration hits the target overtime rate', () => {
    const lam = 2.97;
    const m = calibrateTiedLate(lam, 0.23);
    const {ot} = winProbability({lambdaHome: lam, lambdaAway: lam, tiedLate: m});
    close(ot, 0.23, 2e-3);
    assert.ok(m > 0.5 && m < 1, `multiplier ${m}`);
});

test('equal teams on neutral ice are a coin flip', () => {
    const wp = winProbability({lambdaHome: 2, lambdaAway: 2});
    close(wp.home, 0.5, 1e-9);
    close(wp.home + wp.away, 1, 1e-9);
    assert.ok(wp.ot > 0.15 && wp.ot < 0.35, `ot ${wp.ot}`);
});

test('alignPrediction re-centres on another home win probability', () => {
    const r = buildRatings([], {});
    const p = predictGame(r, 'AAA', 'CCC');
    const q = alignPrediction(p, 0.62);
    close(q.homeWin, 0.62);
    close(q.homeWin + q.awayWin, 1);
    close(q.overtime, p.overtime);
    close(q.homeRegWin + q.awayRegWin + q.overtime, 1, 1e-9);
    const otHome = (p.homeWin - p.homeRegWin) / p.overtime;
    close(q.homeRegWin, 0.62 - p.overtime * otHome, 1e-9);
    assert.equal(alignPrediction(p, NaN), p);
});

test('pregame prediction is coherent', () => {
    const r = buildRatings(league);
    const p = predictGame(r, 'AAA', 'CCC');
    close(p.homeWin + p.awayWin, 1, 1e-9);
    assert.ok(p.homeWin > 0.6 && p.homeWin < 0.85, `strong home favourite ${p.homeWin}`);
    const even = predictGame(r, 'BBB', 'DDD');
    assert.ok(even.homeWin > 0.5 && even.homeWin < 0.56, `home ice edge only ${even.homeWin}`);
    close(even.homeRegWin + even.awayRegWin + even.overtime, 1, 1e-3);
    assert.equal(p.scorelines.length, 6);
    assert.ok(p.expectedTotal > 5 && p.expectedTotal < 7.5);
});

test('live win probability matches NHL base rates', () => {
    const lam = 2.97;
    const avg = {lambdaHome: lam, lambdaAway: lam, tiedLate: calibrateTiedLate(lam, 0.225)};
    // Scoring first (early): historically ~66-70%.
    const first = winProbability({...avg, diff: 1, secondsLeft: 3480});
    assert.ok(first.home > 0.62 && first.home < 0.71, `first goal: ${first.home}`);
    // Leading by 1 after two periods: historically ~73-78% (incl. OT/SO).
    const up1 = winProbability({...avg, diff: 1, secondsLeft: 1200});
    assert.ok(up1.home > 0.7 && up1.home < 0.82, `+1 after 2: ${up1.home}`);
    // Leading by 2 after two periods: historically ~90-94%.
    const up2 = winProbability({...avg, diff: 2, secondsLeft: 1200});
    assert.ok(up2.home > 0.88 && up2.home < 0.96, `+2 after 2: ${up2.home}`);
    // Leading by 1 with a minute left: ~90%+ even with the goalie pulled.
    const late = winProbability({...avg, diff: 1, secondsLeft: 60});
    assert.ok(late.home > 0.88 && late.home < 0.97, `+1 with 60s: ${late.home}`);
    // Power play helps.
    const pp = winProbability({...avg, diff: 0, secondsLeft: 600, ppTeam: 1, ppSeconds: 120});
    assert.ok(pp.home > 0.52, `pp ${pp.home}`);
});

test('final / overtime edge cases', () => {
    const r = buildRatings(league);
    const ot = liveWinProbability(r, {home: 'BBB', away: 'DDD', homeScore: 2, awayScore: 1, period: 4, secondsRemaining: 100});
    assert.equal(ot.home, 1);
    const tied = liveWinProbability(r, {home: 'BBB', away: 'DDD', homeScore: 2, awayScore: 2, period: 4, secondsRemaining: 100});
    assert.ok(tied.home > 0.45 && tied.home < 0.6);
    const live = liveWinProbability(r, {home: 'BBB', away: 'DDD', homeScore: 1, awayScore: 0, period: 2, secondsRemaining: 600, situationCode: '1451'});
    assert.ok(live.projected.home > 1 && live.projected.away > 0, JSON.stringify(live.projected));
});

test('goal WPA is positive for the scoring team and largest late', () => {
    const r = buildRatings(league);
    const [early, late] = goalWPA(r, 'BBB', 'DDD', [
        {period: 1, timeInPeriod: '02:00', homeScore: 1, awayScore: 0, isHome: true},
        {period: 3, timeInPeriod: '19:00', homeScore: 2, awayScore: 1, isHome: true},
    ]);
    assert.ok(early.wpa > 0.1 && early.wpa < 0.2, `early ${early.wpa}`);
    assert.ok(late.wpa > early.wpa, `late ${late.wpa}`);
});

test('excitement index', () => {
    const flat = excitementIndex([0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    const wild = excitementIndex([0.5, 0.8, 0.3, 0.7, 0.2, 0.6, 0.1, 0.9, 1]);
    assert.ok(wild.index > flat.index);
    assert.ok(wild.swings >= 4);
    close(flat.comeback, 0.5, 1e-9);
});

/* ----------------------------------------------------------- player model */

test('shrinkage pulls small samples to the prior', () => {
    const r = shrinkRate(5, 10, {mean: 0.1, sd: 0.03});
    assert.ok(r.estimate < 0.15 && r.estimate > 0.1, `estimate ${r.estimate}`);
    assert.ok(r.lo < r.estimate && r.estimate < r.hi);
    const none = shrinkRate(0, 0, {mean: 0.1, sd: 0.03});
    close(none.estimate, 0.1, 1e-9);
    assert.equal(none.observed, null);
});

test('goalie talent needs many shots', () => {
    const hot = goalieTalent({saves: 290, shotsAgainst: 300}); // .967 over 300 shots
    assert.ok(hot.estimate < 0.915, `regressed ${hot.estimate}`);
    assert.ok(hot.weight < 0.2);
});

test('shooting luck', () => {
    const s = shootingTalent({goals: 15, shots: 60, position: 'C'});
    assert.ok(s.luck > 5, `luck ${s.luck}`);
});

test('projection interval brackets the mean', () => {
    const p = projectCount({count: 20, gp: 20, remaining: 62, priorRate: 0.8, priorGames: 20});
    assert.ok(p.lo < p.projected && p.projected < p.hi, JSON.stringify(p));
    close(p.rate, 0.9, 1e-9);
    const done = projectCount({count: 50, gp: 82, remaining: 0, priorRate: 0.5});
    assert.equal(done.projected, 50);
});

test('streak detection', () => {
    const hot = detectStreak([...Array(30).fill(0.5).map((_, i) => i % 2), 2, 2, 1, 2, 3, 1, 2, 2, 1, 2]);
    assert.equal(hot.status, 'hot');
    const cold = detectStreak([...Array(30).fill(1), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(cold.status, 'cold');
    const normal = detectStreak(Array(40).fill(0).map((_, i) => (i % 3 === 0 ? 1 : 0)));
    assert.equal(normal.status, 'normal');
    assert.equal(formLine([1, 1, 1]).length, 3);
});

/* -------------------------------------------------------------- team */

test('pythagorean + profile', () => {
    close(pythagorean(250, 250), 0.5, 1e-12);
    assert.ok(pythagorean(300, 220) > 0.6);
    const prof = teamProfile(team('AAA', 41, 150, 110, {points: 50}));
    assert.ok(prof.expectedPoints > 50, `expected ${prof.expectedPoints}`);
    assert.ok(prof.projectedLo <= prof.projected && prof.projected <= prof.projectedHi);
});

test('pdo', () => {
    const r = pdo({goalsForPerGame: 3, shotsForPerGame: 30, goalsAgainstPerGame: 2.7, shotsAgainstPerGame: 30});
    close(r.pdo, 1010, 1e-9);
});

test('playoff line', () => {
    const rows = Array.from({length: 16}, (_, i) => team(`T${i}`, 40, 120 + i * 3, 130, {points: 35 + i}));
    const pl = playoffLine(rows);
    assert.ok(pl.line > 0);
    assert.equal(pl.teams.length, 16);
    assert.ok(pl.teams.every((t) => t.neededPerGame >= 0));
});

/* ------------------------------------------------------------------ xG */

test('xg geometry and monotonicity', () => {
    close(shotGeometry(79, 0).distance, 10, 1e-9);
    close(shotGeometry(-79, 0).distance, 10, 1e-9);
    const slot = shotXG({x: 80, y: 0, shotType: 'wrist'});
    const point = shotXG({x: 30, y: 20, shotType: 'slap'});
    const reb = shotXG({x: 80, y: 0, shotType: 'wrist', rebound: true});
    assert.ok(slot > 0.15 && slot < 0.35, `slot ${slot}`);
    assert.ok(point < 0.04, `point ${point}`);
    assert.ok(reb > slot);
});

test('a uniform grid of wrist-shot locations averages a few percent xG', () => {
    // Sanity range only. This grid over-weights long-range shots, so it sits below the real-shot mean;
    // the actual calibration (mean xG ≈ goals on real 2025-26 attempts) is checked by
    // scripts/backtest-models.mjs.
    const shots = [];
    for (let x = 30; x <= 87; x += 3) for (let y = -30; y <= 30; y += 6) shots.push(shotXG({x, y, shotType: 'wrist'}));
    const mean = shots.reduce((a, b) => a + b, 0) / shots.length;
    assert.ok(mean > 0.025 && mean < 0.1, `mean ${mean}`);
});

test('gameXG parses play-by-play and deserveToWin is a distribution', () => {
    const pbp = {
        homeTeam: {id: 1},
        awayTeam: {id: 2},
        plays: [
            {eventId: 1, periodDescriptor: {number: 1}, timeInPeriod: '01:00', situationCode: '1551', typeDescKey: 'faceoff', details: {eventOwnerTeamId: 1, zoneCode: 'N'}},
            {eventId: 2, periodDescriptor: {number: 1}, timeInPeriod: '01:03', situationCode: '1551', typeDescKey: 'shot-on-goal', details: {eventOwnerTeamId: 1, xCoord: 75, yCoord: 5, shotType: 'wrist', zoneCode: 'O', shootingPlayerId: 9}},
            {eventId: 3, periodDescriptor: {number: 1}, timeInPeriod: '01:05', situationCode: '1551', typeDescKey: 'goal', details: {eventOwnerTeamId: 1, xCoord: 84, yCoord: 2, shotType: 'tip-in', zoneCode: 'O', scoringPlayerId: 10}},
            {eventId: 4, periodDescriptor: {number: 2}, timeInPeriod: '05:00', situationCode: '1451', typeDescKey: 'missed-shot', details: {eventOwnerTeamId: 2, xCoord: -60, yCoord: -20, shotType: 'slap', zoneCode: 'O', shootingPlayerId: 20}},
            {eventId: 5, periodDescriptor: {number: 3}, timeInPeriod: '19:30', situationCode: '0651', typeDescKey: 'goal', details: {eventOwnerTeamId: 1, xCoord: -20, yCoord: 0, shotType: 'wrist', zoneCode: 'D', scoringPlayerId: 9}},
        ],
    };
    const g = gameXG(pbp);
    assert.equal(g.home.shots.length, 3);
    assert.equal(g.away.shots.length, 1);
    assert.equal(g.home.goals, 2);
    assert.ok(g.home.shots[0].rush, 'shot right after neutral-zone faceoff is a rush');
    assert.ok(g.home.shots[1].rebound, 'second shot within 3s is a rebound');
    assert.ok(g.home.shots[2].emptyNet, 'away goalie digit 0 means empty net');
    const d = deserveToWin(g.home.shots, g.away.shots);
    close(d.home + d.away, 1, 1e-9);
    assert.ok(d.home > d.away);
});

test('applyExternalXG swaps in matched per-shot values, or keeps ours for the whole game', () => {
    const shot = (t, type, xg) => ({t, type, xg, goal: type === 'goal', emptyNet: false});
    const xg = {
        home: {xg: 0.3, goals: 1, shots: [shot(10, 'goal', 0.2), shot(50, 'shot-on-goal', 0.1)]},
        away: {xg: 0.05, goals: 0, shots: [shot(30, 'missed-shot', 0.05)]},
        timeline: [],
    };
    const rows = [
        {time: '10', team: 'HOME', event: 'GOAL', shotGoalProbability: '0.4'},
        {time: '30', team: 'AWAY', event: 'MISS', shotGoalProbability: '0.02'},
        {time: '50', team: 'HOME', event: 'SHOT', shotGoalProbability: '0.06'},
        {time: '55', team: 'HOME', event: 'FAC', shotGoalProbability: ''},
    ];
    const out = applyExternalXG(xg, rows);
    assert.equal(out.source, 'moneypuck');
    close(out.home.xg, 0.46);
    close(out.away.xg, 0.02);
    assert.equal(out.timeline.length, 3);
    close(out.timeline[2].home, 0.46);
    // Too few matches → our numbers for the whole game.
    const partial = applyExternalXG(xg, rows.slice(0, 1));
    assert.equal(partial.source, 'rinkside');
    close(partial.home.xg, 0.3);
    assert.equal(applyExternalXG(xg, null).source, 'rinkside');
});

/* ---------------------------------------------------------- game score */

test('game score from a tiny synthetic box score + play-by-play', () => {
    const sk = (playerId, sweaterNumber, name, extra) => ({playerId, sweaterNumber, name: {default: name}, goals: 0, sog: 0, blockedShots: 0, plusMinus: 0, toi: '15:00', ...extra});
    const box = {
        playerByGameStats: {
            homeTeam: {
                forwards: [
                    sk(10, 9, 'A. Scorer', {goals: 1, sog: 2, plusMinus: 1}),
                    sk(11, 19, 'B. Setup', {plusMinus: 1}),
                ],
                defense: [sk(13, 4, 'C. Dman', {blockedShots: 2, plusMinus: 1})],
                goalies: [
                    {playerId: 30, sweaterNumber: 30, name: {default: 'H. Goalie'}, goalsAgainst: 0, saves: 10, toi: '60:00'},
                    {playerId: 31, sweaterNumber: 31, name: {default: 'H. Backup'}, goalsAgainst: 0, saves: 0, toi: '00:00'},
                ],
            },
            awayTeam: {
                forwards: [sk(20, 91, 'X. Center', {sog: 2, plusMinus: -1})],
                defense: [],
                goalies: [{playerId: 40, sweaterNumber: 1, name: {default: 'A. Goalie'}, goalsAgainst: 1, saves: 20, toi: '60:00'}],
            },
        },
    };
    const REG = {periodType: 'REG'};
    const pbp = {
        plays: [
            {typeDescKey: 'goal', periodDescriptor: REG, details: {scoringPlayerId: 10, assist1PlayerId: 11, assist2PlayerId: 13, goalieInNetId: 40}},
            {typeDescKey: 'faceoff', periodDescriptor: REG, details: {winningPlayerId: 11, losingPlayerId: 20}},
            {typeDescKey: 'faceoff', periodDescriptor: REG, details: {winningPlayerId: 11, losingPlayerId: 20}},
            {typeDescKey: 'faceoff', periodDescriptor: REG, details: {winningPlayerId: 20, losingPlayerId: 11}},
            {typeDescKey: 'penalty', periodDescriptor: REG, details: {typeCode: 'MIN', committedByPlayerId: 20, drawnByPlayerId: 10}},
            // Misconducts and shootout goals don't count.
            {typeDescKey: 'penalty', periodDescriptor: REG, details: {typeCode: 'MIS', committedByPlayerId: 20, drawnByPlayerId: 10}},
            {typeDescKey: 'goal', periodDescriptor: {periodType: 'SO'}, details: {scoringPlayerId: 20, goalieInNetId: 30}},
        ],
    };
    const {home, away} = gameScores(box, pbp);
    const by = (rows) => Object.fromEntries(rows.map((r) => [r.playerId, r]));
    const h = by(home);
    const a = by(away);
    // A: 0.75·1 G + 0.075·2 SOG + 0.15·1 PD + 0.15·(+1) = 1.20
    close(h[10].gs, 1.2, 1e-9);
    close(h[10].parts.production, 0.75, 1e-9);
    // B: 0.7·1 A1 + 0.01·2 FOW − 0.01·1 FOL + 0.15·(+1) = 0.86
    close(h[11].gs, 0.86, 1e-9);
    // C (D): 0.55·1 A2 + 0.05·2 BLK + 0.15·(+1) = 0.80
    close(h[13].gs, 0.8, 1e-9);
    assert.equal(h[13].position, 'D');
    // Home goalie: −0.75·0 + 0.1·10 = 1.00; backup who didn't play is left out.
    close(h[30].gs, 1.0, 1e-9);
    assert.equal(h[31], undefined);
    // X: −0.15·1 PT + 0.01·1 FOW − 0.01·2 FOL + 0.075·2 SOG + 0.15·(−1) = −0.16
    close(a[20].gs, -0.16, 1e-9);
    assert.equal(a[20].stats.pt, 1);
    // Away goalie: −0.75·1 + 0.1·20 = 1.25
    close(a[40].gs, 1.25, 1e-9);
    assert.equal(a[40].position, 'G');
    // Sorted high to low.
    assert.deepEqual(home.map((r) => r.playerId), [10, 30, 11, 13]);
    // No shifts → plus/minus fallback.
    assert.equal(gameScores(box, pbp).onIceSource, 'plusMinus');
    assert.equal(h[10].onIceSource, 'plusMinus');
});

test('game score component helpers', () => {
    close(skaterGameScore({}).gs, 0, 1e-12);
    close(skaterGameScore({g: 2, a1: 1, pt: 2}).gs, 1.5 + 0.7 - 0.3, 1e-12);
    close(goalieGameScore({ga: 4, sv: 22}).gs, -3 + 2.2, 1e-12);
});

test('game score on-ice terms from shift charts (5v5 Corsi and goals)', () => {
    const sk = (playerId, extra) => ({playerId, sweaterNumber: playerId, name: {default: `P${playerId}`}, goals: 0, sog: 0, blockedShots: 0, plusMinus: 0, toi: '10:00', ...extra});
    const box = {
        homeTeam: {id: 1},
        awayTeam: {id: 2},
        playerByGameStats: {
            homeTeam: {forwards: [sk(10, {goals: 1, sog: 2, plusMinus: 1}), sk(11)], defense: [], goalies: []},
            awayTeam: {forwards: [sk(20, {plusMinus: -1})], defense: [], goalies: []},
        },
    };
    const P1 = {number: 1, periodType: 'REG'};
    const ev = (typeDescKey, timeInPeriod, owner, situationCode = '1551', periodDescriptor = P1) =>
        ({typeDescKey, timeInPeriod, situationCode, periodDescriptor, details: {eventOwnerTeamId: owner}});
    const pbp = {
        plays: [
            ev('shot-on-goal', '00:20', 1), // A on, X not yet
            ev('missed-shot', '00:30', 2), // X's shift starts at 0:30 → not on (start < t)
            ev('goal', '01:00', 1), // A's shift ends at 1:00 → on (t ≤ end); X on
            ev('blocked-shot', '01:30', 2, '1451'), // power play → not 5v5
            ev('faceoff', '01:40', 2), // not a shot attempt
            ev('goal', '00:00', 2, '1010', {number: 5, periodType: 'SO'}), // shootout ignored
        ],
    };
    const shifts = {data: [
        {playerId: 10, period: 1, startTime: '00:00', endTime: '01:00', typeCode: 517},
        {playerId: 20, period: 1, startTime: '00:30', endTime: '02:00', typeCode: 517},
        {playerId: 20, period: 1, startTime: '00:00', endTime: '00:00', typeCode: 505}, // goal marker row
    ]};
    const map = parseShifts(shifts);
    assert.equal(map.get(20).length, 1);
    const oi = onIceCounts(pbp, map, new Map([[10, 1], [11, 1], [20, 2]]));
    assert.deepEqual(oi.get(10), {cf: 2, ca: 1, gf: 1, ga: 0, cf5: 2, ca5: 1, gf5: 1, ga5: 0});
    assert.deepEqual(oi.get(20), {cf: 1, ca: 1, gf: 0, ga: 1, cf5: 0, ca5: 1, gf5: 0, ga5: 1});

    const r = gameScores(box, pbp, shifts);
    assert.equal(r.onIceSource, 'shifts');
    const a = r.home.find((x) => x.playerId === 10);
    // 0.75 G + 0.075·2 SOG + 0.05·2 CF − 0.05·1 CA + 0.15·1 GF − 0.15·0 GA = 1.10
    close(a.gs, 1.1, 1e-9);
    close(a.parts.corsi, 0.05, 1e-9);
    assert.equal(a.onIceSource, 'shifts');
    // X: −0.05·1 CA − 0.15·1 GA = −0.20 (plus/minus not used once shifts exist)
    close(r.away[0].gs, -0.2, 1e-9);
    // A skater missing from the shift feed falls back to plus/minus.
    assert.equal(r.home.find((x) => x.playerId === 11).onIceSource, 'plusMinus');
});
