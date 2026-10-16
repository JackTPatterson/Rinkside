import {getTeam} from '../data/teams';
import {request} from './client';
import {nhl} from './nhl';

// DailyFaceoff has no public API, but its pages are Next.js and carry their data as JSON
// (__NEXT_DATA__). Best-effort: callers treat any failure as "no lines / no starters yet".
const DFO = 'https://www.dailyfaceoff.com';
const MIN = 60 * 1000;

// Case-, accent- and punctuation-insensitive name key ("Stützle" = "Stutzle", "J.J. Moser" = "JJ Moser").
export const foldName = (s) => String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "St. Louis Blues" → "st-louis-blues", "Montréal Canadiens" → "montreal-canadiens" (DailyFaceoff's team slugs). */
export const teamSlug = (abbrev) => foldName(getTeam(abbrev)?.name).replace(/ /g, '-');

export const dfoUrls = {
    lines: (abbrev) => `${DFO}/teams/${teamSlug(abbrev)}/line-combinations`,
    startingGoalies: (date /* YYYY-MM-DD */) => `${DFO}/starting-goalies/${date}`,
};

const STATUS = {ir: 'IR', ltir: 'LTIR', dtd: 'Day-to-day', out: 'Out', susp: 'Suspended'};

// "Zachary Dean" vs "Zack Dean": fall back to the surname when only one roster player has it.
function findNhl(name, byName, bySurname) {
    const key = foldName(name);
    const exact = byName.get(key);
    if (exact) return exact;
    const list = bySurname.get(key.split(' ').slice(1).join(' '));
    return list?.length === 1 ? list[0] : null;
}

function toPlayer(p, byName, bySurname) {
    const nhlPlayer = findNhl(p?.name, byName, bySurname);
    return {
        key: `${p?.groupIdentifier}-${p?.positionIdentifier}-${p?.playerId}`,
        name: p?.name ?? '',
        number: p?.jerseyNumber ?? nhlPlayer?.sweaterNumber ?? null,
        status: p?.gameTimeDecision ? 'Game-time decision' : STATUS[p?.injuryStatus] ?? (p?.injuryStatus ? String(p.injuryStatus).toUpperCase() : null),
        nhlId: nhlPlayer?.id ?? null,
        headshot: nhlPlayer?.headshot ?? null,
    };
}

const ORDER = {lw: 0, c: 1, rw: 2, ld: 0, rd: 1, g1: 0, g2: 1};
const posRank = (id) => ORDER[id] ?? Number(String(id).replace(/\D/g, '')) ?? 9;

/**
 * Projected line combinations for a team, matched to the NHL roster for ids and headshots:
 * {updatedAt, forwards, defense, goalies, powerPlay, penaltyKill, out}, where each unit is
 * {key, label, players: [{key, name, number, status, nhlId, headshot}]}.
 */
export async function fetchLines(abbrev, {force} = {}) {
    const [page, roster] = await Promise.all([
        request(dfoUrls.lines(abbrev), {type: 'nextData', ttl: 30 * MIN, force}),
        nhl.roster(abbrev).catch(() => null),
    ]);
    const c = page?.combinations;
    if (!c?.players?.length) return null;
    const byName = new Map();
    const bySurname = new Map();
    for (const p of [...(roster?.forwards ?? []), ...(roster?.defensemen ?? []), ...(roster?.goalies ?? [])]) {
        byName.set(foldName(`${p?.firstName?.default ?? ''} ${p?.lastName?.default ?? ''}`), p);
        const last = foldName(p?.lastName?.default);
        bySurname.set(last, [...(bySurname.get(last) ?? []), p]);
    }
    const units = (category, prefix, label) => {
        const groups = new Map();
        for (const p of c.players) {
            if (p?.categoryIdentifier !== category || !String(p?.groupIdentifier).startsWith(prefix)) continue;
            if (!groups.has(p.groupIdentifier)) groups.set(p.groupIdentifier, []);
            groups.get(p.groupIdentifier).push(p);
        }
        return [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, list], i) => ({
                key,
                label: label(i + 1),
                players: list.sort((a, b) => posRank(a.positionIdentifier) - posRank(b.positionIdentifier)).map((p) => toPlayer(p, byName, bySurname)),
            }));
    };
    const goalies = units('ev', 'g', () => 'Goalies')[0]?.players ?? [];
    return {
        updatedAt: c.updatedAt ?? null,
        forwards: units('ev', 'f', (n) => `Line ${n}`),
        defense: units('ev', 'd', (n) => `Pair ${n}`),
        goalies,
        powerPlay: units('pp', 'pp', (n) => `PP${n}`),
        penaltyKill: units('pk', 'pk', (n) => `PK${n}`),
        out: c.players.filter((p) => p?.categoryIdentifier === 'oi').map((p) => toPlayer(p, byName, bySurname)),
    };
}

/**
 * DailyFaceoff's starting goalies for one date (YYYY-MM-DD, Eastern), keyed by "<away slug>@<home slug>":
 * {home: {name, strength, details}, away: {...}}. strength: 'Confirmed' | 'Likely' | 'Unconfirmed' | null.
 */
export async function fetchStartingGoalies(date, {force} = {}) {
    const page = await request(dfoUrls.startingGoalies(date), {type: 'nextData', ttl: 10 * MIN, force});
    const out = {};
    for (const g of page?.data ?? []) {
        const side = (k) => ({
            name: g?.[`${k}GoalieName`] ?? null,
            strength: g?.[`${k}NewsStrengthName`] ?? null,
            details: g?.[`${k}NewsDetails`] ?? null,
        });
        out[`${g?.awayTeamSlug}@${g?.homeTeamSlug}`] = {home: side('home'), away: side('away')};
    }
    return out;
}
