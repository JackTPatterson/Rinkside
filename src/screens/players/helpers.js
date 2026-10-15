// Pure data helpers for the Players tab and the Player screen. No React in here.
import {goalieTalent, poissonCdf, poissonSf, PRIORS} from '../../analytics';
import {loc, mmssToSeconds, num, pct, savePct, secondsToMMSS, signed} from '../../utils/format';
import {currentSeasonId, previousSeasonId, REGULAR_SEASON_GAMES, seasonLabel} from '../../utils/season';

export const toNum = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const n0 = (v) => toNum(v) ?? 0;
const int = (v) => (toNum(v) == null ? '–' : String(Math.round(Number(v))));

/* ---------------------------------------------------------- leaderboards */

/** Last team for traded players ("TOR,NYR" → "NYR"). */
export const lastTeam = (teamAbbrevs) => String(teamAbbrevs ?? '').split(',').filter(Boolean).pop() ?? '';

// Goals saved vs. a league-average goalie on the same shots (cheap: no quantiles, safe in sorts).
const gsaa = (r) => {
    const sa = toNum(r?.shotsAgainst);
    if (!sa) return null;
    const saves = toNum(r?.saves) ?? sa - n0(r?.goalsAgainst);
    return saves - sa * PRIORS.savePct.mean;
};

/** Every leaderboard column. `value` is used for client-side sorting; `text` for display. */
export const SKATER_COLUMNS = [
    {key: 'gamesPlayed', title: 'GP', width: 40, value: (r) => toNum(r.gamesPlayed), text: (r) => int(r.gamesPlayed)},
    {key: 'goals', title: 'G', width: 40, value: (r) => toNum(r.goals), text: (r) => int(r.goals)},
    {key: 'assists', title: 'A', width: 40, value: (r) => toNum(r.assists), text: (r) => int(r.assists)},
    {key: 'points', title: 'PTS', width: 44, value: (r) => toNum(r.points), text: (r) => int(r.points)},
    {key: 'plusMinus', title: '+/-', width: 44, value: (r) => toNum(r.plusMinus), text: (r) => signed(r.plusMinus)},
    {key: 'pointsPerGame', title: 'P/GP', width: 50, value: (r) => toNum(r.pointsPerGame), text: (r) => num(r.pointsPerGame, 2)},
    {key: 'shots', title: 'SOG', width: 46, value: (r) => toNum(r.shots), text: (r) => int(r.shots)},
    {key: 'shootingPct', title: 'S%', width: 52, value: (r) => toNum(r.shootingPct), text: (r) => pct(r.shootingPct, 1)},
    {
        key: 'shotsPerGame', title: 'S/GP', width: 46,
        value: (r) => (n0(r.gamesPlayed) ? n0(r.shots) / n0(r.gamesPlayed) : null),
        text: (r) => (n0(r.gamesPlayed) ? num(n0(r.shots) / n0(r.gamesPlayed), 1) : '–'),
    },
    {key: 'ppGoals', title: 'PPG', width: 44, value: (r) => toNum(r.ppGoals), text: (r) => int(r.ppGoals)},
    {key: 'ppPoints', title: 'PPP', width: 44, value: (r) => toNum(r.ppPoints), text: (r) => int(r.ppPoints)},
    {key: 'shGoals', title: 'SHG', width: 44, value: (r) => toNum(r.shGoals), text: (r) => int(r.shGoals)},
    {key: 'penaltyMinutes', title: 'PIM', width: 44, value: (r) => toNum(r.penaltyMinutes), text: (r) => int(r.penaltyMinutes)},
    {
        key: 'timeOnIcePerGame', title: 'TOI', width: 56, value: (r) => toNum(r.timeOnIcePerGame),
        text: (r) => (toNum(r.timeOnIcePerGame) == null ? '–' : secondsToMMSS(r.timeOnIcePerGame)),
    },
];

export const GOALIE_COLUMNS = [
    {key: 'gamesPlayed', title: 'GP', width: 40, value: (r) => toNum(r.gamesPlayed), text: (r) => int(r.gamesPlayed)},
    {key: 'wins', title: 'W', width: 40, value: (r) => toNum(r.wins), text: (r) => int(r.wins)},
    {key: 'losses', title: 'L', width: 40, value: (r) => toNum(r.losses), text: (r) => int(r.losses)},
    {key: 'otLosses', title: 'OTL', width: 44, value: (r) => toNum(r.otLosses), text: (r) => int(r.otLosses)},
    {key: 'savePct', title: 'SV%', width: 52, value: (r) => toNum(r.savePct), text: (r) => savePct(r.savePct)},
    {key: 'goalsAgainstAverage', title: 'GAA', width: 48, value: (r) => toNum(r.goalsAgainstAverage), text: (r) => num(r.goalsAgainstAverage, 2), ascending: true},
    {key: 'shutouts', title: 'SO', width: 40, value: (r) => toNum(r.shutouts), text: (r) => int(r.shutouts)},
    {key: 'gsaa', title: 'GSAA', width: 56, value: gsaa, text: (r) => signed(gsaa(r), 1)},
    {key: 'shotsAgainst', title: 'SA', width: 48, value: (r) => toNum(r.shotsAgainst), text: (r) => int(r.shotsAgainst)},
    {key: 'points', title: 'PTS', width: 40, value: (r) => toNum(r.points), text: (r) => int(r.points)},
];

export const COLUMN_BY_KEY = {
    skaters: Object.fromEntries(SKATER_COLUMNS.map((c) => [c.key, c])),
    goalies: Object.fromEntries(GOALIE_COLUMNS.map((c) => [c.key, c])),
};

/**
 * Sort options. `server`/`direction` drive the stats-API sort (so paging is in true order);
 * GSAA has no API property, so it is sorted client-side over a list ordered by wins.
 * `rate` stats are restricted to qualified players.
 */
export const SORTS = {
    skaters: [
        {key: 'points', label: 'Points', server: 'points'},
        {key: 'goals', label: 'Goals', server: 'goals'},
        {key: 'assists', label: 'Assists', server: 'assists'},
        {key: 'plusMinus', label: '+/-', server: 'plusMinus'},
        {key: 'pointsPerGame', label: 'Pts/GP', server: 'pointsPerGame', rate: true},
        {key: 'timeOnIcePerGame', label: 'TOI/GP', server: 'timeOnIcePerGame', rate: true},
    ],
    goalies: [
        {key: 'wins', label: 'Wins', server: 'wins'},
        {key: 'savePct', label: 'Save %', server: 'savePct', rate: true},
        {key: 'goalsAgainstAverage', label: 'GAA', server: 'goalsAgainstAverage', direction: 'ASC', rate: true},
        {key: 'shutouts', label: 'Shutouts', server: 'shutouts'},
        {key: 'gsaa', label: 'GSAA', server: 'wins'},
    ],
};

/** Three columns for the compact row, always including the active sort column. */
export function compactColumns(kind, sortKey) {
    const by = COLUMN_BY_KEY[kind];
    if (kind === 'skaters') {
        const base = ['goals', 'assists', 'points'];
        return (base.includes(sortKey) ? base : ['gamesPlayed', sortKey, 'points']).map((k) => by[k]).filter(Boolean);
    }
    if (sortKey === 'wins') return ['gamesPlayed', 'wins', 'savePct'].map((k) => by[k]);
    return ['gamesPlayed', sortKey, 'wins'].map((k) => by[k]).filter(Boolean);
}

/** Merge pages, dropping rows without an id and duplicate players (first occurrence wins). */
export function dedupeRows(...lists) {
    const seen = new Set();
    const out = [];
    for (const list of lists) {
        for (const r of list ?? []) {
            const id = r?.playerId;
            if (id == null || seen.has(id)) continue;
            seen.add(id);
            out.push(r);
        }
    }
    return out;
}

const nameKeyOf = (kind) => (kind === 'skaters' ? 'skaterFullName' : 'goalieFullName');

/** Lower-case, accent-free text for matching ("Stützle" ↔ "stutzle"). */
export function normalizeName(s) {
    const lower = String(s ?? '').toLowerCase();
    try {
        return lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch {
        return lower;
    }
}

function sortByColumn(list, col) {
    if (!col) return list;
    const dir = col.ascending ? 1 : -1;
    // Decorate once so expensive columns aren't recomputed per comparison.
    return list
        .map((r) => ({r, v: col.value(r), gp: n0(r.gamesPlayed)}))
        .sort((a, b) => {
            if (a.v == null && b.v == null) return 0;
            if (a.v == null) return 1;
            if (b.v == null) return -1;
            return a.v === b.v ? a.gp - b.gp : (a.v - b.v) * dir;
        })
        .map((x) => x.r);
}

/** Leaderboard items [{row, rank, name}] — deduped, qualified (rate stats), sorted, ranked. */
export function rankRows(rows, kind, sortKey, minGames = 1) {
    const col = COLUMN_BY_KEY[kind][sortKey];
    const sort = SORTS[kind].find((s) => s.key === sortKey);
    let list = dedupeRows(rows);
    if (sort?.rate) list = list.filter((r) => n0(r.gamesPlayed) >= minGames);
    const nk = nameKeyOf(kind);
    return sortByColumn(list, col).map((r, i) => ({row: r, rank: i + 1, name: r[nk] || 'Unknown'}));
}

/**
 * Search results: loaded-leaderboard matches (keep their rank) plus server matches that aren't
 * loaded (rank null), sorted by the active column. `serverRows` null → client-side only.
 */
export function searchItems(ranked, serverRows, kind, sortKey, query) {
    const q = normalizeName(query).trim();
    if (!q) return ranked;
    const nk = nameKeyOf(kind);
    const local = ranked.filter((x) => normalizeName(x.name).includes(q));
    if (!serverRows?.length) return local;
    const byId = new Map(ranked.map((x) => [x.row.playerId, x]));
    const extra = dedupeRows(serverRows)
        .filter((r) => !byId.has(r.playerId))
        .map((r) => ({row: r, rank: null, name: r[nk] || 'Unknown'}));
    const all = [...local, ...extra];
    const order = sortByColumn(all.map((x) => x.row), COLUMN_BY_KEY[kind][sortKey]);
    const itemById = new Map(all.map((x) => [x.row.playerId, x]));
    return order.map((r) => itemById.get(r.playerId));
}

/** Games played by the league leader (≈ team games so far) from the standings payload. */
export function leagueGamesPlayed(standings) {
    const gps = (standings?.standings ?? []).map((t) => n0(t?.gamesPlayed));
    return gps.length ? Math.max(...gps) : 0;
}

/* -------------------------------------------------------------- player */

export const isGoaliePayload = (p) => p?.position === 'G';

export function fullName(p, fallback) {
    const name = `${loc(p?.firstName)} ${loc(p?.lastName)}`.trim();
    return name || fallback || 'Player';
}

export function heightText(inches) {
    const i = toNum(inches);
    if (!i) return null;
    return `${Math.floor(i / 12)}′${Math.round(i % 12)}″`;
}

export function ageFrom(birthDate, now = new Date()) {
    if (!birthDate) return null;
    const [y, m, d] = String(birthDate).split('-').map(Number);
    if (!y) return null;
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
}

export function bioRows(p) {
    if (!p) return [];
    const rows = [];
    const place = [loc(p.birthCity), loc(p.birthStateProvince), p.birthCountry].filter(Boolean).join(', ');
    const age = ageFrom(p.birthDate);
    if (p.birthDate || place) {
        rows.push({label: 'Born', value: [p.birthDate, age != null ? `(age ${age})` : null].filter(Boolean).join(' '), sub: place || null});
    }
    const h = heightText(p.heightInInches);
    if (h) rows.push({label: 'Height', value: h, sub: p.heightInCentimeters ? `${p.heightInCentimeters} cm` : null});
    if (toNum(p.weightInPounds)) rows.push({label: 'Weight', value: `${p.weightInPounds} lb`, sub: p.weightInKilograms ? `${p.weightInKilograms} kg` : null});
    if (p.shootsCatches) rows.push({label: p.position === 'G' ? 'Catches' : 'Shoots', value: p.shootsCatches === 'L' ? 'Left' : p.shootsCatches === 'R' ? 'Right' : p.shootsCatches});
    const d = p.draftDetails;
    if (d?.year) {
        rows.push({
            label: 'Draft',
            value: `${d.year} · ${d.teamAbbrev ?? ''}`.trim(),
            sub: [d.round ? `Round ${d.round}` : null, d.pickInRound ? `pick ${d.pickInRound}` : null, d.overallPick ? `#${d.overallPick} overall` : null].filter(Boolean).join(', ') || null,
        });
    } else if (p.birthDate) {
        rows.push({label: 'Draft', value: 'Undrafted'});
    }
    return rows;
}

const POSITION = {C: 'Center', L: 'Left wing', R: 'Right wing', D: 'Defense', G: 'Goalie'};
export const positionName = (code) => POSITION[code] ?? code ?? '';

/** NHL regular-season rows from landing.seasonTotals. */
export function nhlRegularSeasons(p) {
    return (p?.seasonTotals ?? []).filter((s) => s?.leagueAbbrev === 'NHL' && Number(s?.gameTypeId) === 2);
}

const SUM_KEYS = ['gamesPlayed', 'goals', 'assists', 'points', 'plusMinus', 'pim', 'shots', 'powerPlayGoals', 'powerPlayPoints',
    'shorthandedGoals', 'gameWinningGoals', 'wins', 'losses', 'otLosses', 'shutouts', 'shotsAgainst', 'goalsAgainst', 'gamesStarted'];

/** Combine seasonTotals rows for one season (a traded player has one row per team). */
export function seasonTotalsFor(p, seasonId) {
    const rows = nhlRegularSeasons(p).filter((s) => String(s.season) === String(seasonId));
    if (!rows.length) return null;
    const out = {teams: rows.map((r) => loc(r.teamName) || loc(r.teamCommonName)).filter(Boolean)};
    for (const k of SUM_KEYS) {
        const vals = rows.map((r) => toNum(r[k])).filter((v) => v != null);
        out[k] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    }
    // Rates: recompute when possible, else GP-weighted.
    const weighted = (key) => {
        const pairs = rows.map((r) => [toNum(r[key]), n0(r.gamesPlayed)]).filter(([v]) => v != null);
        const w = pairs.reduce((a, [, g]) => a + g, 0);
        return w ? pairs.reduce((a, [v, g]) => a + v * g, 0) / w : (pairs[0]?.[0] ?? null);
    };
    out.savePctg = out.shotsAgainst ? (out.shotsAgainst - n0(out.goalsAgainst)) / out.shotsAgainst : weighted('savePctg');
    out.goalsAgainstAvg = weighted('goalsAgainstAvg');
    out.shootingPctg = out.shots ? n0(out.goals) / out.shots : weighted('shootingPctg');
    const toiPerGame = rows.map((r) => [r.avgToi, n0(r.gamesPlayed)]).filter(([v]) => v);
    const toiGp = toiPerGame.reduce((a, [, g]) => a + g, 0);
    if (toiGp) out.avgToiSeconds = toiPerGame.reduce((a, [v, g]) => a + mmssToSeconds(v) * g, 0) / toiGp;
    return out;
}

/** Game log sorted oldest → newest. */
export function sortedGameLog(payload) {
    return [...(payload?.gameLog ?? [])].filter(Boolean).sort((a, b) => String(a.gameDate).localeCompare(String(b.gameDate)));
}

/** Season totals computed from a game log (fills in when landing totals lag). */
export function totalsFromLog(log, goalie) {
    if (!log?.length) return null;
    const s = (k) => log.reduce((a, g) => a + n0(g?.[k]), 0);
    const gp = log.length;
    const timed = log.filter((g) => g?.toi);
    const toi = timed.reduce((a, g) => a + mmssToSeconds(g.toi), 0);
    if (goalie) {
        const sa = s('shotsAgainst');
        const ga = s('goalsAgainst');
        return {
            gamesPlayed: gp,
            gamesStarted: s('gamesStarted') || null,
            wins: log.filter((g) => g?.decision === 'W').length,
            losses: log.filter((g) => g?.decision === 'L').length,
            otLosses: log.filter((g) => g?.decision === 'O' || g?.decision === 'OT').length,
            shotsAgainst: sa,
            goalsAgainst: ga,
            savePctg: sa ? (sa - ga) / sa : null,
            goalsAgainstAvg: toi ? (ga * 3600) / toi : null,
            shutouts: log.filter((g) => n0(g?.goalsAgainst) === 0 && g?.decision === 'W' && n0(g?.shotsAgainst) > 0).length,
            pim: s('pim'),
        };
    }
    const shots = s('shots');
    const goals = s('goals');
    return {
        gamesPlayed: gp,
        goals,
        assists: s('assists'),
        points: s('points'),
        plusMinus: s('plusMinus'),
        pim: s('pim'),
        shots,
        powerPlayGoals: s('powerPlayGoals'),
        powerPlayPoints: s('powerPlayPoints'),
        shorthandedGoals: s('shorthandedGoals'),
        gameWinningGoals: s('gameWinningGoals'),
        shootingPctg: shots ? goals / shots : null,
        avgToiSeconds: timed.length ? toi / timed.length : null,
    };
}

/** Prefer whichever source covers more games; fill gaps from the other. */
export function mergeTotals(fromLanding, fromLog) {
    if (!fromLanding) return fromLog;
    if (!fromLog) return fromLanding;
    const primary = n0(fromLog.gamesPlayed) > n0(fromLanding.gamesPlayed) ? fromLog : fromLanding;
    const secondary = primary === fromLog ? fromLanding : fromLog;
    const out = {...secondary};
    for (const [k, v] of Object.entries(primary)) if (v != null) out[k] = v;
    return out;
}

/** Seasons offered in the season toggle: current (if active) + the player's latest NHL seasons. */
export function seasonOptions(p) {
    const ids = [...new Set(nhlRegularSeasons(p).map((s) => String(s.season)))].sort().reverse();
    const cur = currentSeasonId();
    const list = p?.isActive !== false ? [cur, ...ids.filter((id) => id !== cur)] : ids;
    return (list.length ? list : [cur]).slice(0, 2).map((id) => ({key: id, label: seasonLabel(id)}));
}

/** Career table rows (newest first, traded seasons kept per team). */
export function careerRows(p) {
    return nhlRegularSeasons(p)
        .map((s, i) => ({...s, _key: `${s.season}-${i}`}))
        .sort((a, b) => Number(b.season) - Number(a.season));
}

/* ------------------------------------------------------------- charts */

/** Stats the cumulative chart can show. `kind: 'ratio'` charts a running rate instead of a sum. */
export const SKATER_CHART_STATS = [
    {key: 'points', label: 'Points'},
    {key: 'goals', label: 'Goals'},
    {key: 'assists', label: 'Assists'},
    {key: 'shots', label: 'Shots'},
    {key: 'plusMinus', label: '+/-'},
    {key: 'powerPlayGoals', label: 'PPG'},
    {key: 'shorthandedGoals', label: 'SHG'},
    {key: 'pim', label: 'PIM'},
    {key: 'shifts', label: 'Shifts'},
];

export const GOALIE_CHART_STATS = [
    {key: 'savePctg', label: 'Save %', kind: 'ratio'},
    {key: 'goalsAgainst', label: 'Goals against'},
    {key: 'shotsAgainst', label: 'Shots against'},
    {key: 'wins', label: 'Wins'},
];

const gameLabel = (g) => {
    const date = String(g?.gameDate ?? '').slice(5).replace('-', '/');
    const opp = g?.opponentAbbrev ? `${g?.homeRoadFlag === 'R' ? '@' : 'vs'} ${g.opponentAbbrev}` : '';
    return [date, opp].filter(Boolean).join(' ');
};

/** Cumulative series over the season for the chosen stat. */
export function cumulativeSeries(log, statKey) {
    let sum = 0;
    let sa = 0;
    let ga = 0;
    return (log ?? []).map((g) => {
        if (statKey === 'savePctg') {
            sa += n0(g?.shotsAgainst);
            ga += n0(g?.goalsAgainst);
            return {y: sa ? (sa - ga) / sa : NaN, label: gameLabel(g)};
        }
        if (statKey === 'wins') sum += g?.decision === 'W' ? 1 : 0;
        else sum += n0(g?.[statKey]);
        return {y: sum, label: gameLabel(g)};
    });
}

export const pointsPerGame = (log) => (log ?? []).map((g) => n0(g?.points));

/* ----------------------------------------------------------- projection */

/** Last full NHL season before `seasonId` with ≥ 20 GP → per-game goal / point rates, else position defaults. */
export function priorRates(p, seasonId = currentSeasonId()) {
    const d = p?.position === 'D';
    const fallback = {goals: d ? 0.08 : 0.25, points: d ? 0.35 : 0.55, source: 'position'};
    const prev = previousSeasonId(seasonId);
    const t = seasonTotalsFor(p, prev);
    if (t && n0(t.gamesPlayed) >= 20) {
        return {goals: n0(t.goals) / t.gamesPlayed, points: n0(t.points) / t.gamesPlayed, source: seasonLabel(prev)};
    }
    return fallback;
}

export function remainingGames(teamGp, playerGp) {
    const played = toNum(teamGp) ?? toNum(playerGp) ?? 0;
    return Math.max(0, REGULAR_SEASON_GAMES - played);
}

/* ------------------------------------------------------------- streaks */

/**
 * Goalie streak: goals allowed over his last `window` games vs. what his season save% (outside
 * the window, shrunk to league average) predicts on the shots he actually faced. Poisson tails.
 * 'hot' = allowing fewer than expected.
 */
export function goalieStreak(log, window = 8, threshold = 0.1) {
    const games = (log ?? []).filter((g) => n0(g?.shotsAgainst) > 0);
    const w = Math.min(window, games.length);
    if (w < 3) return null;
    const recent = games.slice(-w);
    const before = games.slice(0, games.length - w);
    const base = before.length >= 5 ? before : games;
    const bSa = base.reduce((a, g) => a + n0(g.shotsAgainst), 0);
    const bGa = base.reduce((a, g) => a + n0(g.goalsAgainst), 0);
    const talent = goalieTalent({saves: bSa - bGa, shotsAgainst: bSa}).estimate ?? PRIORS.savePct.mean;
    const actual = recent.reduce((a, g) => a + n0(g.goalsAgainst), 0);
    const expected = recent.reduce((a, g) => a + n0(g.shotsAgainst), 0) * (1 - talent);
    if (expected <= 0) return null;
    const pLow = poissonCdf(actual, expected); // few goals allowed → good
    const pHigh = poissonSf(actual, expected);
    if (actual < expected && pLow < threshold) return {status: 'hot', actual, expected, pValue: pLow, window: w};
    if (actual > expected && pHigh < threshold) return {status: 'cold', actual, expected, pValue: pHigh, window: w};
    return {status: 'normal', actual, expected, pValue: Math.min(pLow, pHigh), window: w};
}

export {gameLabel};
