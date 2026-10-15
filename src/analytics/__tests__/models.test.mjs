import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
    buildRatings,
    calibrateTiedLate,
    excitementIndex,
    goalWPA,
    liveWinProbability,
    predictGame,
    winProbability,
} from '../gameModel.js';
import {betaInc, betaQuantile, lgamma, negBinPmf, poissonBinomial, poissonPmf, poissonVector} from '../math.js';
import {detectStreak, formLine, goalieTalent, projectCount, shootingTalent, shrinkRate} from '../playerModel.js';
import {pdo, playoffLine, pythagorean, teamProfile} from '../teamMetrics.js';
import {deserveToWin, gameXG, shotGeometry, shotXG} from '../xg.js';

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

test('league-average shot mix is ~6-7% xG', () => {
    // A crude mix of locations roughly matching NHL unblocked attempts.
    const shots = [];
    for (let x = 30; x <= 87; x += 3) for (let y = -30; y <= 30; y += 6) shots.push(shotXG({x, y, shotType: 'wrist'}));
    const mean = shots.reduce((a, b) => a + b, 0) / shots.length;
    assert.ok(mean > 0.04 && mean < 0.1, `mean ${mean}`);
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
