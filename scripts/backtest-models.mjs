#!/usr/bin/env node
// Backtest Rinkside's own models against MoneyPuck's on a completed NHL regular season.
//
//   node scripts/backtest-models.mjs [--season 20252026] [--limit 400] [--concurrency 4]
//                                    [--offline] [--json out.json]
//
// What it compares (all on the same games, paired):
//   1. Pregame home win probability: Rinkside predictGame(buildRatings(standings as of the day
//      before), home, away).homeWin  vs  MoneyPuck preGameHomeWinProb(gameId).
//   2. Live win probability at fixed game-clock checkpoints and time-weighted every 2 minutes:
//      Rinkside liveWinProbability / buildRinksideSeries  vs  MoneyPuck gameData homeWinProbability.
//   3. Expected goals: Rinkside gameXG(pbp)  vs  MoneyPuck gameData team xG, against actual goals,
//      per team-game and per shot (shots matched across the two feeds).
//
// The app's own modules are imported unchanged (src/analytics, src/api/nhl, src/api/moneypuck,
// src/screens/game/model.js). scripts/backtest/hooks.mjs resolves Metro-style extensionless imports
// and shims AsyncStorage; scripts/backtest/http.mjs replaces global fetch with a throttled,
// gzip-on-disk cache under scripts/.cache/, so the app's request() layer hits the cache.
//
// No look-ahead: Rinkside ratings for a game on date D are built from every regular-season result
// with gameDate < D, fed to the app's buildRatings in the same shape as the api-web standings rows
// the app uses (standings/now). A sample of dates is cross-checked against the NHL's historical
// standings/{D-1} snapshots.

import './backtest/hooks.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCachedFetch} from './backtest/http.mjs';
import {auc, binaryMetrics, bootstrapMean, calibration, logLoss, brier, mean, pearson} from './backtest/stats.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return dflt;
    const v = argv[i + 1];
    return v === undefined || v.startsWith('--') ? true : v;
};
const LIMIT = Number(arg('limit', 0)) || Infinity;
const CONCURRENCY = Number(arg('concurrency', 4));
const OFFLINE = !!arg('offline', false);
const CHECKPOINTS = [
    {t: 600, label: '10:00 into 1st'},
    {t: 1200, label: 'Start of 2nd'},
    {t: 2400, label: 'Start of 3rd'},
    {t: 3000, label: '10:00 left in 3rd'},
    {t: 3300, label: '5:00 left'},
    {t: 3480, label: '2:00 left'},
];
const GRID_STEP = 120; // matches buildRinksideSeries sampling

const log = (...a) => console.error(...a);

const cachedFetch = createCachedFetch({cacheDir: path.join(here, '.cache'), perHost: 2, gapMs: 200, offline: OFFLINE, log});
globalThis.fetch = cachedFetch;

/* ------------------------------------------------------- app modules */

const {buildRatings, predictGame, liveWinProbability, gameXG} = await import(path.join(root, 'src/analytics/index.js'));
const {nhl} = await import(path.join(root, 'src/api/nhl.js'));
const {moneypuck, preGameHomeWinProb} = await import(path.join(root, 'src/api/moneypuck.js'));
const {clearCache} = await import(path.join(root, 'src/api/client.js'));
const {buildRinksideSeries, parseMoneyPuckGame, timeLabel} = await import(path.join(root, 'src/screens/game/model.js'));
const {currentSeasonId, previousSeasonId} = await import(path.join(root, 'src/utils/season.js'));

const SEASON = String(arg('season', previousSeasonId(currentSeasonId())));
const JSON_OUT = arg('json', path.join(here, '.cache', `results-${SEASON}.json`));

const getJSON = async (url) => {
    const r = await cachedFetch(url);
    return r.ok ? JSON.parse(await r.text()) : null;
};

/* ---------------------------------------------------------- schedule */

const seasons = await getJSON('https://api-web.nhle.com/v1/standings-season');
const meta = seasons?.seasons?.find((s) => String(s.id) === SEASON);
if (!meta) throw new Error(`Unknown season ${SEASON}`);
const dates = [];
for (let d = new Date(`${meta.standingsStart}T12:00:00Z`); d <= new Date(`${meta.standingsEnd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
}
log(`Season ${SEASON}: scanning ${dates.length} dates (${meta.standingsStart} .. ${meta.standingsEnd})`);

const allGames = [];
const seen = new Set();
for (const date of dates) {
    const day = await nhl.score(date).catch(() => null);
    for (const g of day?.games ?? []) {
        if (String(g.season) !== SEASON || g.gameType !== 2 || seen.has(g.id)) continue;
        if (!['OFF', 'FINAL'].includes(g.gameState)) continue;
        seen.add(g.id);
        allGames.push({
            id: g.id,
            date: g.gameDate,
            home: g.homeTeam.abbrev,
            away: g.awayTeam.abbrev,
            hs: g.homeTeam.score,
            as: g.awayTeam.score,
            lastPeriodType: g.gameOutcome?.lastPeriodType ?? 'REG',
        });
    }
}
allGames.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
log(`Found ${allGames.length} completed regular-season games`);

/* ----------------------------------------- ratings as of each date */

// Standings rows (api-web field names) from every result strictly before `date`.
function standingsBefore(date) {
    const rows = new Map();
    const row = (abbrev) => {
        if (!rows.has(abbrev)) {
            rows.set(abbrev, {teamAbbrev: {default: abbrev}, gamesPlayed: 0, goalFor: 0, goalAgainst: 0, homeGoalsFor: 0, homeGamesPlayed: 0, roadGoalsFor: 0, roadGamesPlayed: 0, otLosses: 0});
        }
        return rows.get(abbrev);
    };
    for (const g of allGames) {
        if (g.date >= date) break;
        const h = row(g.home);
        const a = row(g.away);
        h.gamesPlayed++;
        a.gamesPlayed++;
        // Score-feed finals include the shootout-winner goal, as NHL standings GF/GA do.
        h.goalFor += g.hs;
        h.goalAgainst += g.as;
        a.goalFor += g.as;
        a.goalAgainst += g.hs;
        h.homeGoalsFor += g.hs;
        h.homeGamesPlayed++;
        a.roadGoalsFor += g.as;
        a.roadGamesPlayed++;
        if (g.lastPeriodType !== 'REG') (g.hs < g.as ? h : a).otLosses++;
    }
    return {standings: [...rows.values()]};
}

const ratingsCache = new Map();
function ratingsFor(date) {
    if (!ratingsCache.has(date)) ratingsCache.set(date, buildRatings(standingsBefore(date)));
    return ratingsCache.get(date);
}

// Cross-check the reconstruction against the NHL's own historical standings snapshots.
const gameDates = [...new Set(allGames.map((g) => g.date))];
const validation = {datesChecked: 0, maxAbsRatingDiff: 0, maxAbsWinProbDiff: 0, gpMismatches: 0};
for (let i = 7; i < gameDates.length; i += 14) {
    const d = gameDates[i];
    const prev = new Date(`${d}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const snap = await getJSON(`https://api-web.nhle.com/v1/standings/${prev.toISOString().slice(0, 10)}`);
    if (!snap?.standings?.length) continue;
    const official = buildRatings(snap);
    const mine = ratingsFor(d);
    validation.datesChecked++;
    for (const [abbrev, t] of Object.entries(official.teams)) {
        const m = mine.teams[abbrev];
        if (!m) continue;
        if (m.gp !== t.gp) validation.gpMismatches++;
        validation.maxAbsRatingDiff = Math.max(validation.maxAbsRatingDiff, Math.abs(m.attack - t.attack), Math.abs(m.defense - t.defense));
    }
    for (const g of allGames.filter((x) => x.date === d)) {
        const a = predictGame(official, g.home, g.away).homeWin;
        const b = predictGame(mine, g.home, g.away).homeWin;
        validation.maxAbsWinProbDiff = Math.max(validation.maxAbsWinProbDiff, Math.abs(a - b));
    }
}
log(`Ratings reconstruction vs NHL standings/{D-1}: ${JSON.stringify(validation)}`);

/* ---------------------------------------------------- per-game work */

const toSec = (mmss) => {
    const [m, s] = String(mmss ?? '0:00').split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
};
const elapsed = (p) => ((p.periodDescriptor?.number ?? 1) - 1) * 1200 + toSec(p.timeInPeriod);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function mpAt(series, t) {
    // Last MoneyPuck row with time <= t (rows are in event order, time non-decreasing).
    let lo = 0;
    let hi = series.length - 1;
    let ans = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if ((series[mid].time ?? 0) <= t) {
            ans = mid;
            lo = mid + 1;
        } else hi = mid - 1;
    }
    return ans >= 0 ? series[ans].p : null;
}

async function processGame(g) {
    const ratings = ratingsFor(g.date);
    const homeWin = g.hs > g.as ? 1 : 0;
    const rec = {id: g.id, date: g.date, home: g.home, away: g.away, homeWin, lastPeriodType: g.lastPeriodType};

    // 1. Pregame.
    rec.rsPre = predictGame(ratings, g.home, g.away).homeWin;
    rec.mpPre = await preGameHomeWinProb(g.id); // app function: null when MoneyPuck has no number
    const predRows = await moneypuck.prediction(g.id).catch(() => null);
    const lastPred = predRows?.filter((r) => r.preGameHomeTeamWinOverallScore != null).slice(-1)[0];
    rec.mpPureModel = num(lastPred?.preGameMoneyPuckHomeWinPrediction);
    // Early-season files carry 0 here when no betting line was available; treat as missing.
    const odds = num(lastPred?.preGameBettingOddsHomeWinPrediction);
    rec.mpBettingOdds = odds > 0 && odds < 1 ? odds : null;

    // 2 + 3 need play-by-play and MoneyPuck gameData.
    const pbp = await nhl.playByPlay(g.id).catch(() => null);
    const mpRows = await moneypuck.gameData(SEASON, g.id).catch(() => null);
    const mp = parseMoneyPuckGame(mpRows);
    rec.mpHasGameData = !!mp;
    const plays = (pbp?.plays ?? []).filter((p) => p.periodDescriptor?.periodType !== 'SO');
    if (!plays.length) return rec;
    rec.hasPbp = true;
    const homeId = pbp.homeTeam?.id;

    // Goals (score after each goal) from the play-by-play, in the shape buildRinksideSeries takes.
    const goals = plays.filter((p) => p.typeDescKey === 'goal').map((p) => {
        const sit = String(p.situationCode ?? '1551');
        const isHome = p.details?.eventOwnerTeamId === homeId;
        return {
            period: p.periodDescriptor.number,
            timeInPeriod: p.timeInPeriod,
            t: elapsed(p),
            homeScore: p.details.homeScore,
            awayScore: p.details.awayScore,
            isHome,
            emptyNet: (isHome ? sit[0] : sit[3]) === '0',
        };
    });
    const scoreAt = (t) => {
        let hs = 0;
        let as = 0;
        for (const x of goals) if (x.t <= t) {
            hs = x.homeScore;
            as = x.awayScore;
        }
        return {hs, as};
    };
    const situationAt = (t) => {
        let code;
        for (const p of plays) {
            if (elapsed(p) > t) break;
            if (p.situationCode) code = String(p.situationCode);
        }
        return code;
    };

    // Live at checkpoints. Two Rinkside variants: score + clock only (as the app's chart series),
    // and with the manpower situation code (as the app's live header, rinksideLive).
    rec.live = [];
    for (const cp of CHECKPOINTS) {
        const {hs, as} = scoreAt(cp.t);
        const period = Math.floor(cp.t / 1200) + 1;
        const base = {home: g.home, away: g.away, homeScore: hs, awayScore: as, period, secondsRemaining: 1200 - (cp.t - (period - 1) * 1200)};
        rec.live.push({
            t: cp.t,
            rs: liveWinProbability(ratings, base).home,
            rsSit: liveWinProbability(ratings, {...base, situationCode: situationAt(cp.t)}).home,
            mp: mp ? mpAt(mp.series, cp.t) : null,
        });
    }

    // Time-weighted: the app's own chart series (buildRinksideSeries) at every 2-minute grid point
    // of regulation, looked up by its point label, vs MoneyPuck at the same game time.
    const header = {home: {abbrev: g.home, score: g.hs}, away: {abbrev: g.away, score: g.as}, final: true, playoff: false};
    const endT = Math.max(...plays.map(elapsed));
    const series = buildRinksideSeries(ratings, header, goals, endT);
    const byLabel = new Map(series.data.map((d) => [d.label, d.y]));
    rec.grid = [];
    for (let t = 0; t < 3600; t += GRID_STEP) {
        const {hs, as} = scoreAt(t);
        const rs = byLabel.get(`${timeLabel(t)} · ${g.away} ${as}–${hs} ${g.home}`);
        rec.grid.push({t, rs: rs ?? null, mp: mp ? mpAt(mp.series, t) : null});
    }

    // xG.
    const xg = gameXG(pbp);
    const goalsH = goals.filter((x) => x.isHome).length;
    const goalsA = goals.length - goalsH;
    const enH = goals.filter((x) => x.isHome && x.emptyNet).length;
    const enA = goals.filter((x) => !x.isHome && x.emptyNet).length;
    const nonEN = (shots) => shots.filter((s) => !s.emptyNet).reduce((s, x) => s + x.xg, 0);
    rec.xg = {
        goals: {home: goalsH, away: goalsA},
        goalsNonEN: {home: goalsH - enH, away: goalsA - enA},
        rs: {home: xg.home.xg, away: xg.away.xg},
        rsNonEN: {home: nonEN(xg.home.shots), away: nonEN(xg.away.shots)},
        mp: null,
        mpNonEN: null,
    };
    const last = mp?.last ?? mpRows?.[mpRows.length - 1];
    if (last && num(last.homeTeamExpectedGoals) != null) {
        rec.xg.mp = {home: num(last.homeTeamExpectedGoalsIncludingEmptyNet), away: num(last.awayTeamExpectedGoalsIncludingEmptyNet)};
        rec.xg.mpNonEN = {home: num(last.homeTeamExpectedGoals), away: num(last.awayTeamExpectedGoals)};
    }

    // Shot level: match unblocked attempts across feeds by (game second, side, event type).
    rec.shots = [];
    if (Array.isArray(mpRows)) {
        const TYPE = {SHOT: 'shot-on-goal', MISS: 'missed-shot', GOAL: 'goal'};
        const mpShots = new Map();
        const dup = new Set();
        for (const r of mpRows) {
            const type = TYPE[r.event];
            const p = num(r.shotGoalProbability);
            if (!type || p == null) continue;
            const key = `${r.time}|${r.team === 'HOME' ? 'H' : 'A'}|${type}`;
            if (mpShots.has(key)) dup.add(key);
            mpShots.set(key, {p, en: Number(r.shotOnEmptyNet) === 1});
        }
        const rsShots = [...xg.home.shots.map((s) => ({...s, side: 'H'})), ...xg.away.shots.map((s) => ({...s, side: 'A'}))];
        const rsKeys = new Map();
        for (const s of rsShots) {
            const key = `${s.t}|${s.side}|${s.type}`;
            if (rsKeys.has(key)) dup.add(key);
            rsKeys.set(key, s);
        }
        rec.rsShotCount = rsShots.length;
        for (const [key, s] of rsKeys) {
            if (dup.has(key) || !mpShots.has(key)) continue;
            const m = mpShots.get(key);
            rec.shots.push([s.xg, m.p, s.goal ? 1 : 0, s.emptyNet || m.en ? 1 : 0]);
        }
    }
    return rec;
}

/* --------------------------------------------------------------- run */

const games = allGames.slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);
const results = new Array(games.length);
let done = 0;
let next = 0;
const t0 = Date.now();
async function worker() {
    while (next < games.length) {
        const i = next++;
        try {
            results[i] = await processGame(games[i]);
        } catch (e) {
            log(`  ! game ${games[i].id}: ${e?.stack ?? e}`);
            results[i] = null;
        }
        done++;
        if (done % 50 === 0 || done === games.length) {
            clearCache(); // the app's in-memory request cache would otherwise hold every CSV
            const s = cachedFetch.stats;
            log(`  ${done}/${games.length} games  (${((Date.now() - t0) / 1000).toFixed(0)}s; cache hits ${s.hits}, fetched ${s.fetched}, 404 ${s.notFound}, errors ${s.errors})`);
        }
    }
}
await Promise.all(Array.from({length: CONCURRENCY}, worker));
const recs = results.filter(Boolean);

/* ----------------------------------------------------------- report */

const out = {season: SEASON, generatedAt: new Date().toISOString(), games: recs.length, ratingsValidation: validation};
const lines = [];
const say = (s = '') => lines.push(s);
const f3 = (x) => (x == null || Number.isNaN(x) ? '  -  ' : x.toFixed(4));
const pct = (x) => (x == null || Number.isNaN(x) ? '  -  ' : `${(100 * x).toFixed(1)}%`);
const signed = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(4)}`;

function compareBinary(name, rows, {calib = true} = {}) {
    // rows: [{rs, mp, y}] with both present.
    const ps = rows.map((r) => r.rs);
    const pm = rows.map((r) => r.mp);
    const ys = rows.map((r) => r.y);
    const R = binaryMetrics(ps, ys);
    const M = binaryMetrics(pm, ys);
    const ll = bootstrapMean(rows.map((r) => logLoss(r.rs, r.y) - logLoss(r.mp, r.y)));
    const br = bootstrapMean(rows.map((r) => brier(r.rs, r.y) - brier(r.mp, r.y)));
    say(`  ${name}  (n = ${rows.length} paired)`);
    say(`    ${'model'.padEnd(10)} ${'logloss'.padStart(8)} ${'brier'.padStart(8)} ${'acc'.padStart(7)} ${'AUC'.padStart(7)}`);
    say(`    ${'Rinkside'.padEnd(10)} ${f3(R.logLoss).padStart(8)} ${f3(R.brier).padStart(8)} ${pct(R.accuracy).padStart(7)} ${f3(auc(ps, ys)).padStart(7)}`);
    say(`    ${'MoneyPuck'.padEnd(10)} ${f3(M.logLoss).padStart(8)} ${f3(M.brier).padStart(8)} ${pct(M.accuracy).padStart(7)} ${f3(auc(pm, ys)).padStart(7)}`);
    say(`    Δ logloss (Rinkside − MoneyPuck) = ${signed(ll.mean)}  95% CI [${signed(ll.lo)}, ${signed(ll.hi)}]  P(Rinkside better) = ${pct(ll.pBelowZero)}`);
    say(`    Δ brier                          = ${signed(br.mean)}  95% CI [${signed(br.lo)}, ${signed(br.hi)}]`);
    const res = {n: rows.length, rinkside: R, moneypuck: M, dLogLoss: ll, dBrier: br};
    if (calib) {
        const cr = calibration(ps, ys);
        const cm = calibration(pm, ys);
        say(`    calibration     Rinkside: n  pred   obs   |  MoneyPuck: n  pred   obs`);
        for (let i = 0; i < cr.length; i++) {
            say(`      ${cr[i].bin.padEnd(8)}  ${String(cr[i].n).padStart(13)} ${pct(cr[i].meanPred).padStart(6)} ${pct(cr[i].observed).padStart(6)}  |  ${String(cm[i].n).padStart(11)} ${pct(cm[i].meanPred).padStart(6)} ${pct(cm[i].observed).padStart(6)}`);
        }
        res.calibration = {rinkside: cr, moneypuck: cm};
    }
    return res;
}

say(`Rinkside vs MoneyPuck backtest — ${SEASON} regular season, ${recs.length} completed games`);
say(`Ratings: rebuilt from results before each game date; cross-check vs NHL standings/{D-1} on ${validation.datesChecked} dates: max |rating diff| ${validation.maxAbsRatingDiff.toFixed(5)}, max |win-prob diff| ${validation.maxAbsWinProbDiff.toFixed(5)}`);
say(`Home team won ${pct(mean(recs.map((r) => r.homeWin)))} of games. Coin-flip log loss = 0.6931.`);
say();

// 1. Pregame
say('1. PREGAME WIN PROBABILITY');
const preMissing = recs.filter((r) => r.mpPre == null);
say(`  coverage: Rinkside ${recs.length}/${recs.length}; MoneyPuck ${recs.length - preMissing.length}/${recs.length} (${preMissing.length} with no number)`);
const rsAll = binaryMetrics(recs.map((r) => r.rsPre), recs.map((r) => r.homeWin));
say(`  Rinkside on all games: logloss ${f3(rsAll.logLoss)}, brier ${f3(rsAll.brier)}, acc ${pct(rsAll.accuracy)}`);
if (preMissing.length) {
    const m = binaryMetrics(preMissing.map((r) => r.rsPre), preMissing.map((r) => r.homeWin));
    say(`  Rinkside on the ${preMissing.length} games MoneyPuck missed: logloss ${f3(m.logLoss)}, acc ${pct(m.accuracy)}`);
}
const preRows = recs.filter((r) => r.mpPre != null).map((r) => ({rs: r.rsPre, mp: r.mpPre, y: r.homeWin, date: r.date}));
out.pregame = compareBinary('Pregame (MoneyPuck = preGameHomeWinProb, as the app uses)', preRows);
out.pregame.coverage = {total: recs.length, moneypuckMissing: preMissing.length};
// By month, to see whether early-season shrinkage matters.
say('    by month           n   Δlogloss (R − MP)');
const months = [...new Set(preRows.map((r) => r.date.slice(0, 7)))];
out.pregame.byMonth = {};
for (const mo of months) {
    const rows = preRows.filter((r) => r.date.startsWith(mo));
    const d = mean(rows.map((r) => logLoss(r.rs, r.y) - logLoss(r.mp, r.y)));
    out.pregame.byMonth[mo] = {n: rows.length, dLogLoss: d};
    say(`      ${mo}   ${String(rows.length).padStart(6)}   ${signed(d)}`);
}
// References: MoneyPuck's pure model and the betting-odds column from the same prediction file.
for (const [key, label] of [['mpPureModel', 'MoneyPuck pure model (preGameMoneyPuckHomeWinPrediction)'], ['mpBettingOdds', 'Betting-odds implied (preGameBettingOddsHomeWinPrediction)']]) {
    const rows = recs.filter((r) => r[key] != null && r.mpPre != null);
    if (!rows.length) continue;
    const m = binaryMetrics(rows.map((r) => r[key]), rows.map((r) => r.homeWin));
    const o = binaryMetrics(rows.map((r) => r.mpPre), rows.map((r) => r.homeWin));
    const rr = binaryMetrics(rows.map((r) => r.rsPre), rows.map((r) => r.homeWin));
    say(`  reference: ${label}: logloss ${f3(m.logLoss)} (n=${rows.length}; same games: MP overall ${f3(o.logLoss)}, Rinkside ${f3(rr.logLoss)})`);
    out.pregame[key] = {...m, sameGamesMoneyPuckOverall: o.logLoss, sameGamesRinkside: rr.logLoss};
}
say();

// 2. Live
say('2. LIVE WIN PROBABILITY');
const withPbp = recs.filter((r) => r.hasPbp);
const withMP = withPbp.filter((r) => r.mpHasGameData);
say(`  coverage: play-by-play ${withPbp.length}/${recs.length}; MoneyPuck gameData ${withMP.length}/${withPbp.length} (${withPbp.length - withMP.length} with no file)`);
out.live = {coverage: {pbp: withPbp.length, moneypuckGameData: withMP.length}, checkpoints: {}};
for (const cp of CHECKPOINTS) {
    const rows = withPbp.map((r) => ({...r.live.find((x) => x.t === cp.t), y: r.homeWin})).filter((x) => x.mp != null && x.rs != null);
    say();
    const res = compareBinary(`${cp.label} (score + clock; Rinkside as in the chart series)`, rows, {calib: cp.t === 2400});
    const sit = rows.map((x) => ({rs: x.rsSit, mp: x.mp, y: x.y}));
    const s = binaryMetrics(sit.map((x) => x.rs), sit.map((x) => x.y));
    const d = bootstrapMean(sit.map((x) => logLoss(x.rs, x.y) - logLoss(x.mp, x.y)));
    say(`    Rinkside with situation code (as the live header): logloss ${f3(s.logLoss)}; Δ vs MP ${signed(d.mean)} [${signed(d.lo)}, ${signed(d.hi)}]`);
    out.live.checkpoints[cp.label] = {...res, withSituation: {...s, dLogLoss: d}};
}
// Time-weighted over the 2-minute grid of regulation; unit = game (mean over its grid points).
const perGame = [];
let gridPoints = 0;
let gridMissingRs = 0;
const flat = [];
for (const r of withPbp) {
    const pts = r.grid.filter((x) => x.mp != null && x.rs != null);
    gridMissingRs += r.grid.filter((x) => x.rs == null).length;
    if (!pts.length) continue;
    gridPoints += pts.length;
    perGame.push({
        rs: mean(pts.map((x) => logLoss(x.rs, r.homeWin))),
        mp: mean(pts.map((x) => logLoss(x.mp, r.homeWin))),
        rsB: mean(pts.map((x) => brier(x.rs, r.homeWin))),
        mpB: mean(pts.map((x) => brier(x.mp, r.homeWin))),
    });
    for (const x of pts) flat.push({rs: x.rs, mp: x.mp, y: r.homeWin});
}
const tw = bootstrapMean(perGame.map((g) => g.rs - g.mp));
const twB = bootstrapMean(perGame.map((g) => g.rsB - g.mpB));
say();
say(`  Time-weighted, every ${GRID_STEP / 60} min of regulation (app's buildRinksideSeries vs MoneyPuck), ${perGame.length} games / ${gridPoints} states${gridMissingRs ? ` (${gridMissingRs} grid points not found in the series)` : ''}`);
say(`    logloss  Rinkside ${f3(mean(perGame.map((g) => g.rs)))}  MoneyPuck ${f3(mean(perGame.map((g) => g.mp)))}   Δ ${signed(tw.mean)}  95% CI [${signed(tw.lo)}, ${signed(tw.hi)}]  P(Rinkside better) ${pct(tw.pBelowZero)}`);
say(`    brier    Rinkside ${f3(mean(perGame.map((g) => g.rsB)))}  MoneyPuck ${f3(mean(perGame.map((g) => g.mpB)))}   Δ ${signed(twB.mean)}  95% CI [${signed(twB.lo)}, ${signed(twB.hi)}]`);
const fr = binaryMetrics(flat.map((x) => x.rs), flat.map((x) => x.y));
const fm = binaryMetrics(flat.map((x) => x.mp), flat.map((x) => x.y));
say(`    accuracy Rinkside ${pct(fr.accuracy)}  MoneyPuck ${pct(fm.accuracy)}`);
out.live.timeWeighted = {games: perGame.length, states: gridPoints, rinksideLogLoss: mean(perGame.map((g) => g.rs)), moneypuckLogLoss: mean(perGame.map((g) => g.mp)), dLogLoss: tw, dBrier: twB, accuracy: {rinkside: fr.accuracy, moneypuck: fm.accuracy}};
say();

// 3. xG
say('3. EXPECTED GOALS');
const xgGames = withPbp.filter((r) => r.xg?.mp && r.xg.mp.home != null);
say(`  coverage: Rinkside xG ${withPbp.length}/${recs.length}; MoneyPuck team xG ${xgGames.length}/${withPbp.length}`);
out.xg = {coverage: {rinkside: withPbp.length, moneypuck: xgGames.length}};
for (const [variant, rk, mk, gk, desc] of [
    ['all', 'rs', 'mp', 'goals', 'all situations incl. empty net (MP ...IncludingEmptyNet)'],
    ['nonEN', 'rsNonEN', 'mpNonEN', 'goalsNonEN', 'excluding empty-net shots/goals (MP homeTeamExpectedGoals, the app\'s fallback field)'],
]) {
    const R = [];
    const M = [];
    const G = [];
    const perGameSq = [];
    const perGameAbs = [];
    for (const r of xgGames) {
        let sq = 0;
        let ab = 0;
        for (const s of ['home', 'away']) {
            const rv = r.xg[rk][s];
            const mv = r.xg[mk][s];
            const gv = r.xg[gk][s];
            R.push(rv);
            M.push(mv);
            G.push(gv);
            sq += (rv - gv) ** 2 - (mv - gv) ** 2;
            ab += Math.abs(rv - gv) - Math.abs(mv - gv);
        }
        perGameSq.push(sq / 2);
        perGameAbs.push(ab / 2);
    }
    const rmse = (xs) => Math.sqrt(mean(xs.map((x, i) => (x - G[i]) ** 2)));
    const mae = (xs) => mean(xs.map((x, i) => Math.abs(x - G[i])));
    const dSq = bootstrapMean(perGameSq);
    const dAbs = bootstrapMean(perGameAbs);
    say(`  Team-game, ${desc}; n = ${G.length} team-games`);
    say(`    ${'model'.padEnd(10)} ${'mean xG'.padStart(8)} ${'r(goals)'.padStart(9)} ${'MAE'.padStart(7)} ${'RMSE'.padStart(7)}   (mean actual goals ${mean(G).toFixed(3)})`);
    say(`    ${'Rinkside'.padEnd(10)} ${mean(R).toFixed(3).padStart(8)} ${pearson(R, G).toFixed(4).padStart(9)} ${mae(R).toFixed(4).padStart(7)} ${rmse(R).toFixed(4).padStart(7)}`);
    say(`    ${'MoneyPuck'.padEnd(10)} ${mean(M).toFixed(3).padStart(8)} ${pearson(M, G).toFixed(4).padStart(9)} ${mae(M).toFixed(4).padStart(7)} ${rmse(M).toFixed(4).padStart(7)}`);
    say(`    Δ squared error (R − MP) per team-game ${signed(dSq.mean)} [${signed(dSq.lo)}, ${signed(dSq.hi)}];  Δ abs error ${signed(dAbs.mean)} [${signed(dAbs.lo)}, ${signed(dAbs.hi)}]`);
    say(`    r(Rinkside, MoneyPuck) = ${pearson(R, M).toFixed(4)}`);
    out.xg[variant] = {
        n: G.length,
        rinkside: {mean: mean(R), r: pearson(R, G), mae: mae(R), rmse: rmse(R)},
        moneypuck: {mean: mean(M), r: pearson(M, G), mae: mae(M), rmse: rmse(M)},
        actualMean: mean(G),
        dSquaredError: dSq,
        dAbsError: dAbs,
        rBetweenModels: pearson(R, M),
    };
}
// Shot level: the proper scoring-rule test of an xG model.
const shotGames = withPbp.filter((r) => r.shots?.length);
const allShots = shotGames.flatMap((r) => r.shots);
const rsShotTotal = withPbp.reduce((s, r) => s + (r.rsShotCount ?? 0), 0);
say();
say(`  Shot level: ${allShots.length} unblocked attempts matched across feeds (of ${rsShotTotal} Rinkside attempts in games with MoneyPuck data)`);
out.xg.shots = {matched: allShots.length, rinksideAttempts: rsShotTotal};
for (const [label, filter] of [['all matched shots', () => true], ['non-empty-net', (s) => !s[3]]]) {
    const ss = allShots.filter(filter);
    const R = binaryMetrics(ss.map((s) => s[0]), ss.map((s) => s[2]));
    const M = binaryMetrics(ss.map((s) => s[1]), ss.map((s) => s[2]));
    // Bootstrap by game: per-game sum of log-loss differences / per-game shot count weights.
    const perG = shotGames.map((r) => {
        const xs = r.shots.filter(filter);
        return xs.length ? xs.reduce((a, s) => a + logLoss(s[0], s[2]) - logLoss(s[1], s[2]), 0) : 0;
    });
    const nPerGame = ss.length / shotGames.length;
    const d = bootstrapMean(perG.map((x) => x / nPerGame));
    say(`    ${label} (n = ${ss.length}, goal rate ${pct(mean(ss.map((s) => s[2])))})`);
    say(`      Rinkside  logloss ${f3(R.logLoss)}  brier ${f3(R.brier)}  AUC ${f3(auc(ss.map((s) => s[0]), ss.map((s) => s[2])))}  mean xG ${mean(ss.map((s) => s[0])).toFixed(4)}`);
    say(`      MoneyPuck logloss ${f3(M.logLoss)}  brier ${f3(M.brier)}  AUC ${f3(auc(ss.map((s) => s[1]), ss.map((s) => s[2])))}  mean xG ${mean(ss.map((s) => s[1])).toFixed(4)}`);
    say(`      Δ logloss per shot (R − MP) ${signed(d.mean)}  95% CI [${signed(d.lo)}, ${signed(d.hi)}]`);
    out.xg.shots[label] = {n: ss.length, rinkside: R, moneypuck: M, dLogLoss: d};
}

const s = cachedFetch.stats;
say();
say(`HTTP: ${s.hits} cache hits, ${s.fetched} fetched, ${s.notFound} 404s, ${s.errors} errors. Raw responses cached under scripts/.cache/.`);
console.log(lines.join('\n'));
fs.mkdirSync(path.dirname(JSON_OUT), {recursive: true});
fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));
log(`Wrote ${JSON_OUT}`);
