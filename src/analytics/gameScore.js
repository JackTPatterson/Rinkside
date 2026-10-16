// Per-player Game Score: one signed number summarising a player's single game.
//
// Dom Luszczyszyn's public Game Score weights:
//   Skaters: 0.75·G + 0.7·A1 + 0.55·A2 + 0.075·SOG + 0.05·BLK + 0.15·PD − 0.15·PT
//            + 0.01·FOW − 0.01·FOL + 0.05·CF − 0.05·CA + 0.15·GF − 0.15·GA
//   Goalies: −0.75·GA + 0.1·SV
//
// Inputs are the two NHL feeds the game screen already loads:
//   box = /gamecenter/{id}/boxscore    → goals, SOG, blocks, plus/minus, saves, goals against, TOI
//   pbp = /gamecenter/{id}/play-by-play → A1 vs A2, penalties drawn/taken, faceoff wins/losses
//         (the boxscore only gives a faceoff percentage), plus fallbacks for any missing box count.
//
// On-ice terms (CF/CA, GF/GA) come from the NHL shift charts (stats API `shiftcharts`, typeCode 517):
// an event at elapsed time t in a period counts for every player whose shift in that period has
// start < t ≤ end, and goes to the event's owning team (for blocked shots the owner is the shooting
// team). Corsi = shot-on-goal + missed-shot + blocked-shot + goal. Which situations each term uses
// (all vs 5v5) is set by ON_ICE below, calibrated against MoneyPuck's published per-game Game Score.
//
// Fallback when shifts are missing (feed down, game just started): GF−GA → the player's plus/minus
// (even-strength + short-handed goals), and the Corsi term is dropped rather than guessed. Each row
// says which was used (`onIceSource: 'shifts' | 'plusMinus'`).
//
// Penalties: minors (incl. double minors, counted once), majors and match penalties count as one
// penalty taken / drawn. Misconducts and game misconducts (no power play), penalty shots (scored as
// their own shot) and bench minors (no individual offender) are excluded.
//
// Shootout events never count: shootout goals aren't goals in the box score, and saves/attempts
// there aren't part of the game record.

const W = {
    g: 0.75, a1: 0.7, a2: 0.55, sog: 0.075, blk: 0.05, pd: 0.15, pt: 0.15, fow: 0.01, fol: 0.01,
    cf: 0.05, ca: 0.05, gf: 0.15, ga: 0.15,
    gGA: 0.75, gSV: 0.1,
};

/**
 * Situations used for each on-ice term: 'all' or '5v5' (situationCode 1551). Calibrated against
 * MoneyPuck's published per-game `gameScore` for every skater in three Oct 2026 games (107 skater-
 * games): mean absolute error 0.012 with 5v5 for both terms, vs 0.066 (all-situation goals),
 * 0.144 (all-situation Corsi) and 0.167 (all situations for both).
 */
export const ON_ICE = {corsi: '5v5', goals: '5v5'};

const CORSI_EVENTS = new Set(['shot-on-goal', 'missed-shot', 'blocked-shot', 'goal']);

const PENALTY_TYPES = new Set(['MIN', 'MAJ', 'MAT', 'MATCH']);

const loc = (v) => (v && typeof v === 'object' ? v.default ?? '' : v ?? '');
const n = (v) => {
    const x = Number(v);
    return v === null || v === undefined || v === '' || !Number.isFinite(x) ? null : x;
};
const toiSeconds = (s) => {
    if (s == null) return null;
    const [m, sec] = String(s).split(':').map(Number);
    return Number.isFinite(m) ? m * 60 + (Number.isFinite(sec) ? sec : 0) : null;
};
const round2 = (x) => Math.round(x * 100) / 100;

/** Count per-player events from the play-by-play (shootout excluded). */
function pbpCounts(pbp) {
    const c = new Map();
    const get = (id) => {
        if (id == null) return null;
        let r = c.get(id);
        if (!r) {
            r = {g: 0, a1: 0, a2: 0, sog: 0, blk: 0, pd: 0, pt: 0, fow: 0, fol: 0, ga: 0, sv: 0};
            c.set(id, r);
        }
        return r;
    };
    for (const p of pbp?.plays ?? []) {
        if (p?.periodDescriptor?.periodType === 'SO') continue;
        const d = p?.details ?? {};
        switch (p?.typeDescKey) {
            case 'goal':
                if (get(d.scoringPlayerId)) get(d.scoringPlayerId).g++;
                if (get(d.assist1PlayerId)) get(d.assist1PlayerId).a1++;
                if (get(d.assist2PlayerId)) get(d.assist2PlayerId).a2++;
                if (get(d.goalieInNetId)) get(d.goalieInNetId).ga++;
                if (get(d.scoringPlayerId)) get(d.scoringPlayerId).sog++;
                break;
            case 'shot-on-goal':
                if (get(d.shootingPlayerId)) get(d.shootingPlayerId).sog++;
                if (get(d.goalieInNetId)) get(d.goalieInNetId).sv++;
                break;
            case 'blocked-shot':
                // Blocks by teammates on their own attempts are logged as 'teammate-blocked'.
                if (d.reason !== 'teammate-blocked' && get(d.blockingPlayerId)) get(d.blockingPlayerId).blk++;
                break;
            case 'faceoff':
                if (get(d.winningPlayerId)) get(d.winningPlayerId).fow++;
                if (get(d.losingPlayerId)) get(d.losingPlayerId).fol++;
                break;
            case 'penalty':
                if (!PENALTY_TYPES.has(String(d.typeCode ?? '').toUpperCase())) break;
                if (get(d.committedByPlayerId)) get(d.committedByPlayerId).pt++;
                if (get(d.drawnByPlayerId)) get(d.drawnByPlayerId).pd++;
                break;
            default:
                break;
        }
    }
    return c;
}

function rosterHeadshots(pbp) {
    const m = new Map();
    for (const r of pbp?.rosterSpots ?? []) {
        if (r?.playerId != null) m.set(r.playerId, {headshot: r.headshot, name: [loc(r.firstName), loc(r.lastName)].filter(Boolean).join(' ')});
    }
    return m;
}

const mmss = (s) => {
    const [m, sec] = String(s ?? '').split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(sec) ? m * 60 + sec : null;
};

/** playerId → [{period, start, end}] from a shift-chart payload ({data: [...]}) or a bare row array. */
export function parseShifts(shifts) {
    const rows = Array.isArray(shifts) ? shifts : shifts?.data;
    if (!Array.isArray(rows) || !rows.length) return null;
    const out = new Map();
    for (const r of rows) {
        if (Number(r?.typeCode) !== 517) continue;
        const start = mmss(r.startTime);
        const end = mmss(r.endTime);
        const period = Number(r.period);
        if (r.playerId == null || start == null || end == null || !(end > start) || !Number.isFinite(period)) continue;
        if (!out.has(r.playerId)) out.set(r.playerId, []);
        out.get(r.playerId).push({period, start, end});
    }
    return out.size ? out : null;
}

/**
 * On-ice counts per player from shifts + play-by-play:
 * playerId → {cf, ca, gf, ga} (all situations) and {cf5, ca5, gf5, ga5} (5v5 only, situationCode 1551).
 */
export function onIceCounts(pbp, shiftMap, teamOf) {
    const out = new Map();
    if (!shiftMap) return out;
    const events = [];
    for (const p of pbp?.plays ?? []) {
        if (!CORSI_EVENTS.has(p?.typeDescKey)) continue;
        const pd = p.periodDescriptor ?? {};
        if (pd.periodType === 'SO') continue;
        const t = mmss(p.timeInPeriod);
        const owner = p.details?.eventOwnerTeamId;
        if (t == null || owner == null) continue;
        events.push({period: Number(pd.number), t, owner, goal: p.typeDescKey === 'goal', ev5: String(p.situationCode) === '1551'});
    }
    for (const [id, list] of shiftMap) {
        const team = teamOf.get(id);
        if (team == null) continue;
        const c = {cf: 0, ca: 0, gf: 0, ga: 0, cf5: 0, ca5: 0, gf5: 0, ga5: 0};
        for (const e of events) {
            if (!list.some((s) => s.period === e.period && s.start < e.t && e.t <= s.end)) continue;
            const f = e.owner === team;
            c[f ? 'cf' : 'ca']++;
            if (e.ev5) c[f ? 'cf5' : 'ca5']++;
            if (e.goal) {
                c[f ? 'gf' : 'ga']++;
                if (e.ev5) c[f ? 'gf5' : 'ga5']++;
            }
        }
        out.set(id, c);
    }
    return out;
}

/**
 * Game Score for one skater from count inputs. Exported for tests and reuse.
 * On-ice: pass cf/ca/gf/ga (from shifts), or only `pm` (plus/minus fallback, no Corsi term).
 */
export function skaterGameScore({g = 0, a1 = 0, a2 = 0, sog = 0, blk = 0, pd = 0, pt = 0, fow = 0, fol = 0, cf, ca, gf, ga, pm = 0}) {
    const shifts = gf != null && ga != null;
    const parts = {
        production: W.g * g + W.a1 * a1 + W.a2 * a2,
        shots: W.sog * sog,
        blocks: W.blk * blk,
        penalties: W.pd * pd - W.pt * pt,
        faceoffs: W.fow * fow - W.fol * fol,
        corsi: shifts ? W.cf * (cf ?? 0) - W.ca * (ca ?? 0) : 0,
        onIceGoals: shifts ? W.gf * gf - W.ga * ga : W.gf * pm,
    };
    const gs = Object.values(parts).reduce((a, b) => a + b, 0);
    return {gs, parts};
}

/** Game Score for one goalie. */
export function goalieGameScore({ga = 0, sv = 0}) {
    const parts = {goalsAgainst: -W.gGA * ga, saves: W.gSV * sv};
    return {gs: parts.goalsAgainst + parts.saves, parts};
}

const POS = {forwards: 'F', defense: 'D', goalies: 'G'};

function teamRows(box, key, counts, roster, onIce, variant) {
    const t = box?.playerByGameStats?.[key];
    if (!t) return [];
    const out = [];
    for (const group of ['forwards', 'defense', 'goalies']) {
        for (const p of t[group] ?? []) {
            const id = p?.playerId;
            const toi = toiSeconds(p?.toi);
            if (id == null || toi === 0) continue; // dressed but didn't play (e.g. backup goalie)
            const c = counts.get(id) ?? {};
            const r = roster.get(id);
            const position = POS[group];
            const row = {
                playerId: id,
                name: r?.name || loc(p?.name),
                shortName: loc(p?.name),
                position,
                sweater: p?.sweaterNumber ?? null,
                headshot: r?.headshot ?? null,
            };
            let res;
            if (position === 'G') {
                const stats = {ga: n(p?.goalsAgainst) ?? c.ga ?? 0, sv: n(p?.saves) ?? c.sv ?? 0};
                res = goalieGameScore(stats);
                row.stats = stats;
            } else {
                const stats = {
                    g: n(p?.goals) ?? c.g ?? 0,
                    a1: c.a1 ?? 0,
                    a2: c.a2 ?? 0,
                    sog: n(p?.sog) ?? c.sog ?? 0,
                    blk: n(p?.blockedShots) ?? c.blk ?? 0,
                    pd: c.pd ?? 0,
                    pt: c.pt ?? 0,
                    fow: c.fow ?? 0,
                    fol: c.fol ?? 0,
                    pm: n(p?.plusMinus) ?? 0,
                };
                const oi = onIce?.get(id);
                if (oi) {
                    const c5 = variant.corsi === '5v5';
                    const g5 = variant.goals === '5v5';
                    stats.cf = c5 ? oi.cf5 : oi.cf;
                    stats.ca = c5 ? oi.ca5 : oi.ca;
                    stats.gf = g5 ? oi.gf5 : oi.gf;
                    stats.ga = g5 ? oi.ga5 : oi.ga;
                }
                row.onIceSource = oi ? 'shifts' : 'plusMinus';
                res = skaterGameScore(stats);
                row.stats = stats;
            }
            row.gs = round2(res.gs);
            row.parts = Object.fromEntries(Object.entries(res.parts).map(([k, v]) => [k, round2(v)]));
            out.push(row);
        }
    }
    return out.sort((a, b) => b.gs - a.gs);
}

function teamIndex(box) {
    const m = new Map();
    for (const key of ['homeTeam', 'awayTeam']) {
        const teamId = box?.[key]?.id;
        const t = box?.playerByGameStats?.[key];
        for (const group of ['forwards', 'defense']) for (const p of t?.[group] ?? []) m.set(p?.playerId, teamId);
    }
    return m;
}

/**
 * Game Score for every player who played: {home: rows, away: rows, onIceSource}, each sorted high to low.
 * Row: {playerId, name, shortName, position: 'F'|'D'|'G', sweater, headshot, gs, parts, stats, onIceSource}.
 * `shifts` (shift-chart payload) is optional; without it on-ice goals fall back to plus/minus.
 * `variant` overrides ON_ICE (used for calibration).
 */
export function gameScores(box, pbp, shifts, variant = ON_ICE) {
    const counts = pbpCounts(pbp);
    const roster = rosterHeadshots(pbp);
    const shiftMap = parseShifts(shifts);
    const onIce = shiftMap ? onIceCounts(pbp, shiftMap, teamIndex(box)) : null;
    return {
        home: teamRows(box, 'homeTeam', counts, roster, onIce, variant),
        away: teamRows(box, 'awayTeam', counts, roster, onIce, variant),
        onIceSource: onIce?.size ? 'shifts' : 'plusMinus',
    };
}
