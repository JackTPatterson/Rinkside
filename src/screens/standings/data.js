// Data helpers for the Standings tab. Everything here is defensive: MoneyPuck files 404
// often and every NHL field may be missing.
import {moneypuck} from '../../api/moneypuck';
import {getTeam} from '../../data/teams';
import {loc, pad2} from '../../utils/format';
import {abbrevOf, normalizeMpCode, toNum} from './shared';

/* --------------------------------------------------- MoneyPuck simulations */

const ODDS_FIELDS = [
    'madePlayoffs', 'round2', 'round3', 'round4', 'wonCup', 'draftLottery',
    ...[1, 2, 3, 4].flatMap((r) => [4, 5, 6, 7].map((g) => `round${r}Winin${g}`)),
];

const prob = (v) => {
    const x = toNum(v);
    if (x == null) return null;
    // MoneyPuck publishes fractions; tolerate a percent-formatted file.
    return Math.max(0, Math.min(1, x > 1 ? x / 100 : x));
};

/** simulations_recent.csv → [{abbrev, madePlayoffs, round2, …}] (scenario "ALL" only), or []. */
export function parseSimulations(rows) {
    if (!Array.isArray(rows)) return [];
    const seen = new Map();
    for (const r of rows) {
        const scen = r?.scenerio ?? r?.scenario; // sic: MoneyPuck's column is "scenerio"
        if (scen != null && String(scen).toUpperCase() !== 'ALL') continue;
        const abbrev = normalizeMpCode(r?.teamCode);
        if (!abbrev || seen.has(abbrev) || !getTeam(abbrev)) continue;
        const o = {abbrev};
        for (const f of ODDS_FIELDS) o[f] = prob(r[f]);
        seen.set(abbrev, o);
    }
    return [...seen.values()];
}

export async function fetchSimulations({force}) {
    const rows = await moneypuck.simulations({force}).catch(() => null);
    return parseSimulations(rows);
}

/* ------------------------------------------------- MoneyPuck power rankings */

function cleanPower(rows) {
    if (!Array.isArray(rows)) return [];
    const out = [];
    const seen = new Set();
    rows.forEach((r, i) => {
        const abbrev = normalizeMpCode(r?.teamCode);
        if (!abbrev || seen.has(abbrev) || !getTeam(abbrev)) return;
        seen.add(abbrev);
        out.push({abbrev, rank: toNum(r?.rank) ?? i + 1});
    });
    return out.sort((a, b) => a.rank - b.rank);
}

// MoneyPuck names snapshots rankings_YYYY_MM_DD.csv (underscores; the format the old app used
// in production). Snapshots aren't published every day, so look around "a week ago".
const mpDate = (d) => `${d.getFullYear()}_${pad2(d.getMonth() + 1)}_${pad2(d.getDate())}`;
const OFFSET_BATCHES = [[7], [6, 8], [5, 9], [4, 10], [11, 12, 13, 14]];
let previousDateCache = null; // date string that worked last time (survives refreshes)

async function tryPrevious(date, force) {
    const rows = cleanPower(await moneypuck.powerRankings(date, {force}).catch(() => null));
    return rows.length >= 16 ? rows : null;
}

async function findPrevious(force) {
    if (previousDateCache) {
        const rows = await tryPrevious(previousDateCache, force);
        if (rows) return {date: previousDateCache, rows};
        previousDateCache = null;
    }
    const today = new Date();
    for (const batch of OFFSET_BATCHES) {
        const dates = batch.map((o) => {
            const d = new Date(today);
            d.setDate(d.getDate() - o);
            return mpDate(d);
        });
        const results = await Promise.all(dates.map((d) => tryPrevious(d, false)));
        const idx = results.findIndex(Boolean);
        if (idx >= 0) {
            previousDateCache = dates[idx];
            return {date: dates[idx], rows: results[idx]};
        }
    }
    return null;
}

/** {rows: [{abbrev, rank, prevRank, movement}], previousDate} or null when MoneyPuck has nothing. */
export async function fetchPowerRankings({force}) {
    const current = cleanPower(await moneypuck.powerRankings(undefined, {force}).catch(() => null));
    if (!current.length) return null;
    const prev = await findPrevious(force).catch(() => null);
    const prevRank = new Map((prev?.rows ?? []).map((r) => [r.abbrev, r.rank]));
    return {
        previousDate: prev?.date?.replace(/_/g, '-') ?? null,
        rows: current.map((r) => {
            const p = prevRank.get(r.abbrev);
            return {...r, prevRank: p ?? null, movement: p == null ? null : p - r.rank};
        }),
    };
}

/* ---------------------------------------------------------- PDO matching */

const norm = (s) => String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/**
 * Matches stats-API team summary rows (teamFullName) to standings abbrevs. Tolerates accents
 * (Montréal), "St." vs "St", and renames (Utah) by falling back to the place name when unique.
 * @returns Map<abbrev, statsRow>
 */
export function matchTeamSummaries(standingsRows, statsRows) {
    const out = new Map();
    if (!Array.isArray(standingsRows) || !Array.isArray(statsRows)) return out;
    const stats = statsRows.filter((s) => s && s.teamFullName).map((s) => ({row: s, key: norm(s.teamFullName)}));
    const used = new Set();
    const take = (abbrev, hit) => {
        if (!hit || used.has(hit)) return false;
        used.add(hit);
        out.set(abbrev, hit.row);
        return true;
    };
    const pending = [];
    for (const r of standingsRows) {
        const abbrev = abbrevOf(r);
        if (!abbrev) continue;
        const place = loc(r.placeName);
        const common = loc(r.teamCommonName);
        const candidates = [loc(r.teamName), `${place} ${common}`, getTeam(abbrev)?.name].map(norm).filter(Boolean);
        const hit = stats.find((s) => !used.has(s) && candidates.includes(s.key));
        if (!take(abbrev, hit)) pending.push({abbrev, place: norm(place), common: norm(common)});
    }
    // Second pass: unique nickname, then unique place name (e.g. "Utah Hockey Club" ↔ "Utah Mammoth").
    for (const p of pending) {
        const free = stats.filter((s) => !used.has(s));
        const byCommon = p.common ? free.filter((s) => s.key.endsWith(p.common)) : [];
        if (byCommon.length === 1 && take(p.abbrev, byCommon[0])) continue;
        const byPlace = p.place ? free.filter((s) => s.key.startsWith(p.place)) : [];
        if (byPlace.length === 1) take(p.abbrev, byPlace[0]);
    }
    return out;
}
