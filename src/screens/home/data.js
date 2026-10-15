// Pure helpers + fetchers for the My Team / Team screen. No React in here.
import {request} from '../../api/client';
import {moneypuck} from '../../api/moneypuck';
import {isFinal, isLive, isUpcoming, nhl} from '../../api/nhl';
import {formLine} from '../../analytics';
import {getTeam} from '../../data/teams';
import {loc, ordinal, parseISODate, shortDate} from '../../utils/format';
import {currentSeasonId, previousSeasonId} from '../../utils/season';

const num = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
};

export const rowAbbrev = (r) => r?.teamAbbrev?.default ?? r?.teamAbbrev ?? null;

/** The standings row for one team (api-web standings/now), or null. */
export function findStandingsRow(standings, abbrev) {
    return standings?.standings?.find((r) => rowAbbrev(r) === abbrev) ?? null;
}

/**
 * Header rank: division place for top-3 teams, "WC1"/"WC2" for wild cards, division place
 * otherwise (same rule as the old page, with correct ordinals).
 */
export function rankLabel(row) {
    if (!row) return null;
    const wc = num(row.wildcardSequence);
    const div = num(row.divisionSequence);
    if (wc === 1 || wc === 2) {
        return {big: `WC${wc}`, small: `${row.conferenceName ?? ''} wild card`.trim()};
    }
    if (div) return {big: ordinal(div), small: row.divisionName ?? ''};
    return null;
}

export function recordLabel(row) {
    if (!row) return null;
    return `${row.wins ?? 0}-${row.losses ?? 0}-${row.otLosses ?? 0}`;
}

/* --------------------------------------------------------------- schedule */

export const gameTime = (g) => (g?.startTimeUTC ? new Date(g.startTimeUTC) : g?.gameDate ? parseISODate(g.gameDate) : null);

const byStart = (a, b) => (gameTime(a)?.getTime() ?? 0) - (gameTime(b)?.getTime() ?? 0);

/** Hero game: a live game first, otherwise the next game that hasn't finished. */
export function pickHeroGame(games) {
    const list = [...(games ?? [])].sort(byStart);
    return list.find(isLive) ?? list.find((g) => !isFinal(g) && (isUpcoming(g) || !g?.gameState)) ?? null;
}

/** Perspective helpers for a schedule game. */
export function sides(game, abbrev) {
    const home = game?.homeTeam?.abbrev;
    const away = game?.awayTeam?.abbrev;
    const isHome = home === abbrev;
    return {
        isHome,
        home,
        away,
        us: isHome ? game?.homeTeam : game?.awayTeam,
        them: isHome ? game?.awayTeam : game?.homeTeam,
        opp: isHome ? away : home,
    };
}

/** 'W' | 'L' | 'OTL' | null for a finished game from `abbrev`'s point of view. */
export function resultFor(game, abbrev) {
    if (!isFinal(game)) return null;
    const {us, them} = sides(game, abbrev);
    const a = num(us?.score);
    const b = num(them?.score);
    if (a == null || b == null) return null;
    if (a > b) return 'W';
    const pt = game?.gameOutcome?.lastPeriodType;
    return pt && pt !== 'REG' ? 'OTL' : 'L';
}

export function finalSuffix(game) {
    const pt = game?.gameOutcome?.lastPeriodType;
    return pt === 'OT' ? ' OT' : pt === 'SO' ? ' SO' : '';
}

/** First not-yet-finished game in a full-season schedule (used when this week has none). */
export function nextFromSeason(season) {
    const now = Date.now();
    return [...(season?.games ?? [])]
        .sort(byStart)
        .find((g) => !isFinal(g) && (gameTime(g)?.getTime() ?? 0) > now - 4 * 3600 * 1000) ?? null;
}

export const fetchWeek = (abbrev, force) => nhl.clubWeek(abbrev, {force});

/* --------------------------------------------------------------- injuries */

export const injuriesUrl = (abbrev) =>
    `https://www.rotowire.com/hockey/tables/injury-report.php?team=${abbrev}&pos=ALL`;

export async function fetchInjuries(abbrev, force) {
    const data = await request(injuriesUrl(abbrev), {type: 'json', ttl: 30 * 60 * 1000, force});
    return Array.isArray(data) ? data.filter(Boolean) : [];
}

/* ----------------------------------------------------------------- roster */

export function rosterGroups(roster) {
    const sort = (a) => [...(Array.isArray(a) ? a : [])].sort((x, y) => (num(x?.sweaterNumber) ?? 999) - (num(y?.sweaterNumber) ?? 999));
    return [
        {key: 'forwards', title: 'Forwards', players: sort(roster?.forwards)},
        {key: 'defensemen', title: 'Defense', players: sort(roster?.defensemen)},
        {key: 'goalies', title: 'Goalies', players: sort(roster?.goalies)},
    ];
}

export const playerName = (p) => `${loc(p?.firstName)} ${loc(p?.lastName)}`.trim();

/* ------------------------------------------------------------------ PDO */

const normName = (s) => String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();

/** The stats-API team-summary row for a team (matched on full name), or null. */
export function findTeamSummary(summary, abbrev, standingsRow) {
    const rows = summary?.data ?? [];
    const names = new Set([
        normName(getTeam(abbrev)?.name),
        normName(loc(standingsRow?.teamName)),
        normName(`${loc(standingsRow?.placeName)} ${loc(standingsRow?.teamCommonName)}`),
    ].filter(Boolean));
    return rows.find((r) => names.has(normName(r?.teamFullName))) ?? null;
}

/* ------------------------------------------------------------ MoneyPuck */

const cleanGames = (rows) => (Array.isArray(rows) ? rows : [])
    .filter((r) => r?.situation === 'all' && r?.gameDate != null)
    .sort((a, b) => Number(a.gameDate) - Number(b.gameDate));

/**
 * MoneyPuck game-by-game rows for a team. Early in a season the current file is missing or
 * nearly empty, so fall back to last season (flagged) rather than show nothing.
 */
export async function fetchTeamGames(abbrev, force) {
    const seasonId = currentSeasonId();
    const cur = cleanGames(await moneypuck.teamGameByGame(abbrev, seasonId, {force}).catch(() => null));
    if (cur.length >= 2) return {games: cur, seasonId, fallback: false};
    const prevId = previousSeasonId(seasonId);
    const prev = cleanGames(await moneypuck.teamGameByGame(abbrev, prevId, {force}).catch(() => null));
    if (prev.length >= 2) return {games: prev, seasonId: prevId, fallback: true};
    return {games: cur, seasonId, fallback: false};
}

/** gameDate 20261014 → "Oct 14" (local date, no off-by-one). */
export function mpDateLabel(gameDate) {
    const s = String(gameDate ?? '');
    if (s.length < 8) return '';
    return shortDate(new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
}

const f = (r, k) => num(r?.[k]) ?? 0;

/**
 * Chartable metrics. `diff(row)` is the per-game differential (positive = good for the team);
 * charts show the running total. `pct` metrics are ratios instead.
 */
export const METRICS = [
    {
        key: 'xg', label: 'xGoals %', kind: 'xg',
        info: 'Share of the expected goals in a game that belonged to this team, based on the quality of every shot (MoneyPuck model estimate). The line is a form average with a 5-game half-life, so recent games count most. Over 50% means they are out-chancing opponents; it predicts future results better than goals do.',
    },
    {
        key: 'goals', label: 'Goals', kind: 'diff', diff: (r) => f(r, 'goalsFor') - f(r, 'goalsAgainst'),
        info: 'Running total of goals scored minus goals allowed this season. Above zero means they have outscored opponents overall.',
    },
    {
        key: 'attempts', label: 'Shot attempts', kind: 'diff', diff: (r) => f(r, 'shotAttemptsFor') - f(r, 'shotAttemptsAgainst'),
        info: 'Running total of shot attempts (on goal, missed and blocked) for minus against, also called Corsi. A rising line means the team is controlling the puck and play.',
    },
    {
        key: 'hd', label: 'High-danger shots', kind: 'diff', diff: (r) => f(r, 'highDangerShotsFor') - f(r, 'highDangerShotsAgainst'),
        info: 'Running total of high-danger shots for minus against. High-danger shots come from the slot and crease area, where most goals are scored (MoneyPuck classification).',
    },
    {
        key: 'ld', label: 'Low-danger shots', kind: 'diff', diff: (r) => f(r, 'lowDangerShotsFor') - f(r, 'lowDangerShotsAgainst'),
        info: 'Running total of low-danger shots for minus against: long-range or bad-angle shots that rarely go in (MoneyPuck classification).',
    },
    {
        key: 'missed', label: 'Missed shots', kind: 'diff', diff: (r) => f(r, 'missedShotsFor') - f(r, 'missedShotsAgainst'),
        info: 'Running total of shots that missed the net, for minus against. Mostly a sign of volume: teams that shoot a lot also miss a lot.',
    },
    {
        key: 'pim', label: 'Penalties', kind: 'diff', diff: (r) => f(r, 'penalityMinutesAgainst') - f(r, 'penalityMinutesFor'),
        info: 'Running total of penalty minutes drawn minus penalty minutes taken. Above zero means the team gets more power plays than it gives up.',
    },
    {
        key: 'give', label: 'Giveaways', kind: 'diff', diff: (r) => f(r, 'giveawaysAgainst') - f(r, 'giveawaysFor'),
        info: 'Running total of opponent giveaways minus this team\'s giveaways. Above zero means they cough up the puck less than their opponents. Arena scorekeepers record these inconsistently.',
    },
    {
        key: 'take', label: 'Takeaways', kind: 'diff', diff: (r) => f(r, 'takeawaysFor') - f(r, 'takeawaysAgainst'),
        info: 'Running total of takeaways (stealing the puck) minus opponents\' takeaways. Above zero means they win more loose-puck battles. Recorded inconsistently between arenas.',
    },
    {
        key: 'hits', label: 'Hits', kind: 'diff', diff: (r) => f(r, 'hitsFor') - f(r, 'hitsAgainst'),
        info: 'Running total of hits delivered minus hits taken. Teams without the puck tend to hit more, so a high number is not necessarily good.',
    },
    {
        key: 'fo', label: 'Faceoffs', kind: 'fo',
        info: 'Season-to-date share of faceoffs won, updated after every game. 50% is average; the best teams sit around 53-55%.',
    },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]));

function xgShare(r) {
    const p = num(r?.xGoalsPercentage);
    if (p != null && p > 0 && p < 1) return p;
    const a = f(r, 'xGoalsFor');
    const b = f(r, 'xGoalsAgainst');
    return a + b > 0 ? a / (a + b) : null;
}

/**
 * Series + summary numbers for one metric.
 * @returns {{data: [{y, label}], baseline, isPct, tiles: [{label, value, sub?}]}}
 */
export function buildMetric(games, key) {
    const m = METRIC_BY_KEY[key] ?? METRICS[0];
    const labels = games.map((g) => mpDateLabel(g.gameDate));
    const last10 = games.slice(-10);
    const pct1 = (x) => (x == null || !Number.isFinite(x) ? '–' : `${(x * 100).toFixed(1)}%`);
    const sgn = (x, d = 0) => (Number.isFinite(x) ? `${x > 0 ? '+' : ''}${x.toFixed(d)}` : '–');

    if (m.kind === 'xg') {
        const per = games.map(xgShare);
        const filled = per.map((v) => (v == null ? 0.5 : v));
        const form = formLine(filled, 5);
        const share = (rows) => {
            let a = 0;
            let b = 0;
            rows.forEach((r) => {
                a += f(r, 'xGoalsFor');
                b += f(r, 'xGoalsAgainst');
            });
            return a + b > 0 ? a / (a + b) : null;
        };
        return {
            data: form.map((y, i) => ({y, label: labels[i]})),
            baseline: 0.5,
            isPct: true,
            tiles: [
                {label: 'Season', value: pct1(share(games))},
                {label: 'Current form', value: pct1(form[form.length - 1])},
                {label: 'Last 10', value: pct1(share(last10))},
            ],
        };
    }

    if (m.kind === 'fo') {
        let won = 0;
        let total = 0;
        const data = games.map((g, i) => {
            won += f(g, 'faceOffsWonFor');
            total += f(g, 'faceOffsWonFor') + f(g, 'faceOffsWonAgainst');
            return {y: total ? won / total : NaN, label: labels[i]};
        });
        let w10 = 0;
        let t10 = 0;
        last10.forEach((g) => {
            w10 += f(g, 'faceOffsWonFor');
            t10 += f(g, 'faceOffsWonFor') + f(g, 'faceOffsWonAgainst');
        });
        return {
            data,
            baseline: 0.5,
            isPct: true,
            tiles: [
                {label: 'Season', value: pct1(total ? won / total : null)},
                {label: 'Last 10', value: pct1(t10 ? w10 / t10 : null)},
                {label: 'Faceoffs won', value: String(won)},
            ],
        };
    }

    let run = 0;
    const per = games.map((g) => m.diff(g));
    const data = per.map((v, i) => {
        run += v;
        return {y: run, label: labels[i]};
    });
    const l10 = per.slice(-10).reduce((s, v) => s + v, 0);
    return {
        data,
        baseline: 0,
        isPct: false,
        tiles: [
            {label: 'Season', value: sgn(run)},
            {label: 'Per game', value: sgn(per.length ? run / per.length : NaN, 1)},
            {label: 'Last 10', value: sgn(l10)},
        ],
    };
}
