// Pure builders for everything the iOS widgets and Live Activity display. No React, no native modules,
// no network: the app fetches, these functions turn the NHL API objects into small JSON-safe props.
//
// Widgets run in an isolated runtime and can't fetch or share code with the app, so all of
// the "thinking" (which game to show, labels, colours, timeline entries) happens here.
import {getTeam} from '../data/teams.js';
import {formatTime, ordinal, periodLabel} from '../utils/format.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
export const SNAPSHOT_VERSION = 1;
// A finished game stays on the widget this long after puck drop, then the next game takes over.
const RECENT_FINAL_MS = 8 * HOUR;
// Past this after puck drop with no fresh data we stop claiming the game is still on.
const GAME_MAX_MS = 4 * HOUR;
// A live score older than this is shown as "as of ..." rather than as current.
export const LIVE_STALE_MS = 20 * MIN;

const num = (v) => {
    if (v == null || v === '') return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
};
const loc = (v) => (v && typeof v === 'object' ? v.default ?? '' : v ?? '');

const isLive = (g) => g?.gameState === 'LIVE' || g?.gameState === 'CRIT';
const isFinal = (g) => g?.gameState === 'FINAL' || g?.gameState === 'OFF' || g?.gameState === 'OVER';
const isPostponed = (g) => g?.gameScheduleState === 'PPD' || g?.gameScheduleState === 'CNCL' || g?.gameScheduleState === 'SUSP';
const startMs = (g) => {
    const t = g?.startTimeUTC ? Date.parse(g.startTimeUTC) : NaN;
    return Number.isFinite(t) ? t : null;
};

/* ----------------------------------------------------------------- colours */

function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
    if (!m) return 0;
    const v = parseInt(m[1], 16);
    const lin = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
}

/** Readable text colour (near-white or near-black) for a solid background. */
export function readableOn(bg) {
    // Contrast against white vs black; pick whichever is higher.
    const L = luminance(bg);
    return (1.05) / (L + 0.05) >= (L + 0.05) / 0.05 ? '#FFFFFF' : '#0B0B0C';
}

/** Light/dark background + readable foreground for a team. Widgets pick by colour scheme. */
export function teamPalette(abbrev) {
    const t = getTeam(abbrev);
    const bgLight = t?.primary ?? '#2A2D34';
    const bgDark = t?.dark ?? '#2A2D34';
    return {bgLight, fgLight: readableOn(bgLight), bgDark, fgDark: readableOn(bgDark)};
}

/* ---------------------------------------------------------------- standing */

/** The standings row for one team (api-web standings/now), or null. */
export function standingsRow(standings, abbrev) {
    return standings?.standings?.find((r) => (r?.teamAbbrev?.default ?? r?.teamAbbrev) === abbrev) ?? null;
}

export function standingSnapshot(row) {
    if (!row) return null;
    const gp = num(row.gamesPlayed) ?? 0;
    const points = num(row.points) ?? 0;
    const wc = num(row.wildcardSequence);
    const div = num(row.divisionSequence);
    let rank = null;
    let rankSmall = null;
    if (wc === 1 || wc === 2) {
        rank = `WC${wc}`;
        rankSmall = `${row.conferenceName ?? ''} wild card`.trim();
    } else if (div) {
        rank = ordinal(div);
        rankSmall = row.divisionName ?? '';
    }
    const l10 = [row.l10Wins, row.l10Losses, row.l10OtLosses].map(num);
    const diff = num(row.goalDifferential);
    return {
        record: `${row.wins ?? 0}-${row.losses ?? 0}-${row.otLosses ?? 0}`,
        points,
        gp,
        rank,
        rankSmall,
        l10: l10.every((x) => x != null) ? l10.join('-') : null,
        streak: row.streakCode && row.streakCount ? `${row.streakCode}${row.streakCount}` : null,
        pace: gp > 0 ? Math.round((points / gp) * 82) : null,
        diff: diff == null ? null : diff,
    };
}

/* -------------------------------------------------------------------- game */

/**
 * Pick the game a widget should feature: a live game, else a game that finished recently (so
 * the result stays up for a while), else the next game that hasn't been played.
 */
export function pickGame(games, now = Date.now()) {
    const list = (games ?? []).filter((g) => g && startMs(g) != null).sort((a, b) => startMs(a) - startMs(b));
    const live = list.find(isLive);
    if (live) return live;
    const recent = [...list].reverse().find((g) => isFinal(g) && now - startMs(g) < RECENT_FINAL_MS && startMs(g) <= now);
    if (recent) return recent;
    return list.find((g) => !isFinal(g) && startMs(g) > now - GAME_MAX_MS) ?? null;
}

/** Same game from another feed (e.g. the richer score feed), preferred when it has live detail. */
export function mergeGame(base, richer) {
    if (!richer || richer.id !== base?.id) return base;
    return {...base, ...richer, homeTeam: {...base.homeTeam, ...richer.homeTeam}, awayTeam: {...base.awayTeam, ...richer.awayTeam}};
}

function finalLabel(g) {
    const t = g?.gameOutcome?.lastPeriodType ?? g?.periodDescriptor?.periodType;
    return t === 'OT' ? 'Final · OT' : t === 'SO' ? 'Final · SO' : 'Final';
}

/** Game as seen from `abbrev`'s side. Returns null if the game doesn't involve that team. */
export function gameSnapshot(g, abbrev, now = Date.now()) {
    if (!g?.homeTeam?.abbrev || !g?.awayTeam?.abbrev) return null;
    const isHome = g.homeTeam.abbrev === abbrev;
    if (!isHome && g.awayTeam.abbrev !== abbrev) return null;
    const us = isHome ? g.homeTeam : g.awayTeam;
    const them = isHome ? g.awayTeam : g.homeTeam;
    const live = isLive(g);
    const fin = isFinal(g);
    const state = live ? 'live' : fin ? 'final' : 'upcoming';
    const usScore = num(us.score);
    const themScore = num(them.score);
    const period = Number(g.periodDescriptor?.number ?? g.period) || 0;

    let result = null;
    if (fin && usScore != null && themScore != null) {
        result = usScore > themScore ? 'W' : (g.gameOutcome?.lastPeriodType ?? 'REG') !== 'REG' ? 'OTL' : 'L';
    }
    return {
        id: g.id ?? null,
        state,
        postponed: isPostponed(g),
        isHome,
        opp: {
            abbrev: them.abbrev,
            name: loc(them.commonName) || getTeam(them.abbrev)?.name?.split(' ').slice(-1)[0] || them.abbrev,
            ...teamPalette(them.abbrev),
        },
        startMs: startMs(g),
        startLabel: startMs(g) != null ? formatTime(new Date(startMs(g))) : null,
        us: live || fin ? usScore : null,
        them: live || fin ? themScore : null,
        usSog: live || fin ? num(us.sog) : null,
        themSog: live || fin ? num(them.sog) : null,
        period: live && period ? periodLabel(period, g.periodDescriptor?.periodType) : null,
        clock: live && !g.clock?.inIntermission ? g.clock?.timeRemaining ?? null : null,
        intermission: live && !!g.clock?.inIntermission,
        shootout: live && g.periodDescriptor?.periodType === 'SO',
        finalLabel: fin ? finalLabel(g) : null,
        result,
        playoff: g.gameType === 3,
        url: g.id ? `rinkside://game/${g.id}` : 'rinkside://',
    };
}

/* ---------------------------------------------------------------- snapshot */

/**
 * Everything the widgets show, as plain JSON.
 *   team      favourite team abbrev
 *   standings api-web standings/now (or null)
 *   games     the games to choose from (this week, or the rest of the season)
 *   liveGame  optional richer copy of a game from the score feed
 */
export function buildSnapshot({team, standings, games, liveGame, now = Date.now()}) {
    const t = getTeam(team);
    if (!t) return null;
    const picked = pickGame(games, now);
    const merged = picked ? mergeGame(picked, liveGame) : null;
    return {
        v: SNAPSHOT_VERSION,
        updatedAt: now,
        team: {abbrev: t.abbrev, name: t.name, short: t.name.split(' ').slice(-1)[0], ...teamPalette(t.abbrev)},
        standing: standingSnapshot(standingsRow(standings, team)),
        game: merged ? gameSnapshot(merged, team, now) : null,
    };
}

/**
 * Timeline entries ({date: ms, props}) for a snapshot. The app only refreshes the widget while it's
 * open, so each entry carries its own expiry: a countdown flips to "puck drop" at start time, and a
 * live score downgrades to "as of ..." if the app hasn't refreshed it.
 */
export function buildTimeline(snapshot, now = Date.now()) {
    const entries = [{date: now, props: snapshot}];
    const g = snapshot?.game;
    if (!g) return entries;
    const withGame = (patch) => ({...snapshot, game: {...g, ...patch}});
    if (g.state === 'upcoming' && !g.postponed && g.startMs != null) {
        if (g.startMs > now) entries.push({date: g.startMs, props: withGame({state: 'started'})});
        entries.push({date: Math.max(g.startMs, now) + GAME_MAX_MS, props: withGame({state: 'stale'})});
    } else if (g.state === 'live') {
        entries.push({date: now + LIVE_STALE_MS, props: withGame({state: 'liveStale'})});
    }
    return entries;
}

/** Props for the Live Activity: a game, from the favourite team's side. Null unless a game is on. */
export function liveActivityProps(snapshot) {
    const g = snapshot?.game;
    if (!g || !snapshot.team) return null;
    return {
        gameId: g.id,
        state: g.state,
        team: {abbrev: snapshot.team.abbrev, name: snapshot.team.short, bgLight: snapshot.team.bgLight, bgDark: snapshot.team.bgDark},
        opp: {abbrev: g.opp.abbrev, name: g.opp.name, bgLight: g.opp.bgLight, bgDark: g.opp.bgDark},
        us: g.us ?? 0,
        them: g.them ?? 0,
        usSog: g.usSog,
        themSog: g.themSog,
        period: g.period,
        clock: g.clock,
        intermission: g.intermission,
        shootout: g.shootout,
        finalLabel: g.finalLabel,
        result: g.result,
        isHome: g.isHome,
        playoff: g.playoff,
        updatedAt: snapshot.updatedAt,
    };
}
