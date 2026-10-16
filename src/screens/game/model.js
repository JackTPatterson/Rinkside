// Pure data helpers for the game screen: normalise the score-feed / landing / boxscore /
// play-by-play / right-rail / MoneyPuck payloads into small, stable shapes the UI renders.
// Every field may be missing — the NHL API changes shape between seasons and game states.

import {goalWPA, liveWinProbability, parseSituation} from '../../analytics';
import {isFinal, isLive, isUpcoming} from '../../api/nhl';
import {getTeam} from '../../data/teams';
import {loc, mmssToSeconds, pad2, periodLabel} from '../../utils/format';

const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const first = (...xs) => xs.find((x) => x !== undefined && x !== null);

/* ------------------------------------------------------------- header */

function side(key, game, landing, box) {
    const g = game?.[key] ?? {};
    const l = landing?.[key] ?? {};
    const b = box?.[key] ?? {};
    const abbrev = first(l.abbrev, b.abbrev, g.abbrev) ?? '';
    const named = loc(l.name) || loc(b.name) || loc(g.name) ||
        [loc(l.placeName), loc(l.commonName)].filter(Boolean).join(' ');
    return {
        id: first(l.id, b.id, g.id),
        abbrev,
        name: named || getTeam(abbrev)?.name || abbrev,
        shortName: loc(l.commonName) || loc(g.commonName) || getTeam(abbrev)?.name?.split(' ').slice(-1)[0] || abbrev,
        score: num(first(l.score, b.score, g.score)),
        sog: num(first(l.sog, b.sog, g.sog)),
        radioLink: first(l.radioLink, g.radioLink),
    };
}

/** One header object from whatever we have (score-feed param first paint, then landing/boxscore). */
export function buildHeader(game, landing, box) {
    const state = first(landing?.gameState, box?.gameState, game?.gameState) ?? 'FUT';
    const pd = first(landing?.periodDescriptor, box?.periodDescriptor, game?.periodDescriptor) ?? {};
    const clock = first(landing?.clock, box?.clock, game?.clock) ?? {};
    const outcome = first(landing?.gameOutcome, box?.gameOutcome, game?.gameOutcome) ?? {};
    const period = num(first(pd.number, game?.period)) ?? 0;
    const h = {
        id: first(landing?.id, box?.id, game?.id),
        season: first(landing?.season, box?.season, game?.season),
        gameType: num(first(landing?.gameType, box?.gameType, game?.gameType)) ?? 2,
        gameDate: first(landing?.gameDate, game?.gameDate),
        startTimeUTC: first(landing?.startTimeUTC, box?.startTimeUTC, game?.startTimeUTC),
        venue: loc(first(landing?.venue, box?.venue, game?.venue)),
        state,
        home: side('homeTeam', game, landing, box),
        away: side('awayTeam', game, landing, box),
        period,
        periodType: pd.periodType ?? (period > 3 ? 'OT' : 'REG'),
        clock: {
            timeRemaining: clock.timeRemaining ?? '20:00',
            secondsRemaining: num(clock.secondsRemaining),
            inIntermission: !!clock.inIntermission,
            running: !!clock.running,
        },
        // The landing feed has no gameOutcome; once the game is over its last period tells OT / SO.
        lastPeriodType: outcome.lastPeriodType ?? (['OFF', 'FINAL'].includes(state) && pd.periodType ? pd.periodType : null),
        seriesStatus: first(game?.seriesStatus, landing?.seriesStatus),
        threeMinRecap: first(game?.threeMinRecap, landing?.threeMinRecap),
        situation: landing?.situation ?? null,
    };
    h.live = isLive({gameState: state});
    h.final = isFinal({gameState: state});
    h.upcoming = isUpcoming({gameState: state}) || (!h.live && !h.final);
    h.playoff = h.gameType === 3;
    h.started = h.live || h.final;
    return h;
}

/** Power-play / empty-net state from the landing `situation` block. */
export function powerPlayState(situation) {
    const sit = parseSituation(situation?.situationCode);
    if (!sit) return null;
    const out = {homePP: false, awayPP: false, homeEN: !sit.homeGoalie, awayEN: !sit.awayGoalie, even: null, time: situation?.timeRemaining ?? null};
    if (sit.homeSkaters > sit.awaySkaters) out.homePP = `${sit.homeSkaters} on ${sit.awaySkaters}`;
    else if (sit.awaySkaters > sit.homeSkaters) out.awayPP = `${sit.awaySkaters} on ${sit.homeSkaters}`;
    else if (sit.homeSkaters < 5) out.even = `${sit.homeSkaters} on ${sit.awaySkaters}`;
    return out;
}

/* ------------------------------------------------------------ goals */

export const SHOT_TYPES = {
    wrist: 'Wrist',
    snap: 'Snap',
    slap: 'Slapshot',
    backhand: 'Backhand',
    'tip-in': 'Tip-in',
    deflected: 'Deflected',
    'wrap-around': 'Wraparound',
    poke: 'Poke',
    bat: 'Batted',
    'between-legs': 'Between the legs',
    cradle: 'Lacrosse',
};

export const shotTypeLabel = (t) => SHOT_TYPES[t] ?? (t ? String(t).replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');

export const brightcoveUrl = (id) => `https://players.brightcove.net/6415718365001/EXtG1xJ7H_default/index.html?videoId=${id}`;

/** Flat list of goals from landing.summary.scoring (shootout excluded), in game order. */
export function extractGoals(landing, homeAbbrev) {
    const periods = landing?.summary?.scoring ?? [];
    const out = [];
    for (const p of periods) {
        const pd = p?.periodDescriptor ?? {};
        if (pd.periodType === 'SO') continue;
        for (const g of p?.goals ?? []) {
            const team = loc(g?.teamAbbrev) || g?.teamAbbrev || '';
            const isHome = typeof g?.isHome === 'boolean' ? g.isHome : team === homeAbbrev;
            out.push({
                key: String(g?.eventId ?? `${pd.number}-${g?.timeInPeriod}-${out.length}`),
                eventId: g?.eventId,
                period: num(pd.number) ?? 1,
                periodType: pd.periodType ?? 'REG',
                timeInPeriod: g?.timeInPeriod ?? '00:00',
                playerId: g?.playerId,
                name: loc(g?.name) || [loc(g?.firstName), loc(g?.lastName)].filter(Boolean).join(' '),
                firstName: loc(g?.firstName),
                lastName: loc(g?.lastName),
                headshot: g?.headshot,
                goalsToDate: g?.goalsToDate,
                team,
                isHome,
                homeScore: num(g?.homeScore) ?? 0,
                awayScore: num(g?.awayScore) ?? 0,
                strength: g?.strength ? String(g.strength).toUpperCase() : '',
                modifier: g?.goalModifier && g.goalModifier !== 'none' ? String(g.goalModifier).replace(/-/g, ' ') : '',
                shotType: g?.shotType,
                assists: (g?.assists ?? []).map((a) => ({
                    playerId: a?.playerId,
                    name: loc(a?.name) || [loc(a?.firstName), loc(a?.lastName)].filter(Boolean).join(' '),
                    toDate: a?.assistsToDate,
                })),
                clip: g?.highlightClipSharingUrl || (g?.highlightClip ? brightcoveUrl(g.highlightClip) : null),
                clipId: g?.highlightClip ?? null, // Brightcove id → plays in the in-app video player
            });
        }
    }
    return out;
}

/** Goals with Rinkside Win Probability Added (scoring team's perspective). */
export function goalsWithWPA(ratings, header, goals) {
    if (!goals.length) return goals;
    try {
        return goalWPA(ratings, header.home.abbrev, header.away.abbrev, goals, {playoff: header.playoff});
    } catch {
        return goals;
    }
}

/** Shootout attempts (landing.summary.shootout), if any. The feed sends {liveScore, events: [...]}. */
export function extractShootout(landing) {
    const so = landing?.summary?.shootout;
    const attempts = Array.isArray(so) ? so : Array.isArray(so?.events) ? so.events : [];
    return attempts.map((s, i) => ({
        key: String(s?.sequence ?? i),
        team: loc(s?.teamAbbrev) || s?.teamAbbrev || '',
        name: [loc(s?.firstName), loc(s?.lastName)].filter(Boolean).join(' ') || loc(s?.name),
        playerId: s?.playerId,
        result: s?.result,
        headshot: s?.headshot,
        shotType: s?.shotType ?? null,
        gameWinner: !!s?.gameWinner,
        homeScore: s?.homeScore ?? null,
        awayScore: s?.awayScore ?? null,
    }));
}

/* -------------------------------------------------------- penalties */

const titleCase = (s) => String(s ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function extractPenalties(landing) {
    const out = [];
    for (const p of landing?.summary?.penalties ?? []) {
        const pd = p?.periodDescriptor ?? {};
        for (const pen of p?.penalties ?? []) {
            const by = pen?.committedByPlayer;
            const byName = typeof by === 'string' ? by : [loc(by?.firstName), loc(by?.lastName)].filter(Boolean).join(' ') || loc(by?.default ?? by);
            const parts = String(byName ?? '').split(' ').filter(Boolean);
            out.push({
                key: `${pd.number}-${pen?.timeInPeriod}-${out.length}`,
                period: periodLabel(pd.number, pd.periodType),
                team: loc(pen?.teamAbbrev) || pen?.teamAbbrev || '',
                player: parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : byName || (pen?.servedBy ? `Served: ${loc(pen.servedBy)}` : 'Team'),
                type: titleCase(pen?.descKey),
                time: pen?.timeInPeriod ?? '',
                duration: pen?.duration != null ? `${pen.duration} min` : '',
            });
        }
    }
    return out;
}

/* ------------------------------------------------------- team stats */

/** {category: {home, away}} from landing.summary.teamGameStats or right-rail teamGameStats. */
export function teamGameStats(landing, rail) {
    const rows = landing?.summary?.teamGameStats ?? rail?.teamGameStats ?? [];
    const out = {};
    for (const r of rows) if (r?.category) out[r.category] = {home: r.homeValue, away: r.awayValue};
    return out;
}

/** Shots on goal per period, [{period, home, away}] (boxscore summary or right rail). */
export function shotsByPeriod(box, rail) {
    const rows = box?.summary?.shotsByPeriod ?? rail?.shotsByPeriod ?? [];
    return rows.map((s, i) => ({
        period: s?.periodDescriptor ? periodLabel(s.periodDescriptor.number, s.periodDescriptor.periodType) : periodLabel(i + 1),
        home: num(s?.home) ?? 0,
        away: num(s?.away) ?? 0,
    }));
}

/** "2/5" → {made: 2, opps: 5, pct} */
export function parseFraction(v) {
    const [a, b] = String(v ?? '').split('/').map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return {made: a, opps: b, pct: b > 0 ? a / b : 0};
}

/* ----------------------------------------------------- MoneyPuck */

/** MoneyPuck gameData rows → {series: [{p, time, event}], last: row} or null. */
export function parseMoneyPuckGame(rows) {
    if (!Array.isArray(rows) || !rows.length) return null;
    const series = [];
    let last = null;
    for (const r of rows) {
        const p = num(r?.homeWinProbability);
        if (p == null) continue;
        series.push({p, time: num(r?.time) ?? null, event: r?.event ?? ''});
        last = r;
    }
    if (series.length < 2) return null;
    return {series, last};
}

/**
 * Season simulations around tonight's game: each team's odds now and after a regulation / OT win
 * or loss, at the first stage still in doubt. {label, home: {now, winReg, winOT, lossOT, lossReg, swing}, away}.
 */
// MoneyPuck spells four teams with dots.
const MP_CODES = {'L.A': 'LAK', 'N.J': 'NJD', 'S.J': 'SJS', 'T.B': 'TBL'};
const mpCode = (c) => MP_CODES[c] ?? c;

export function playoffStakes(rows, home, away) {
    if (!Array.isArray(rows) || !rows.length) return null;
    const find = (team, sc) => rows.find((r) => mpCode(r?.teamCode) === team && (r?.scenerio ?? r?.scenario) === sc);
    const side = (team) => ({
        now: find(team, 'ALL'),
        winReg: find(team, 'WINREG'),
        winOT: find(team, 'WINOT'),
        lossOT: find(team, 'LOSSOT'),
        lossReg: find(team, 'LOSSREG'),
    });
    const h = side(home);
    const a = side(away);
    const all = [...Object.values(h), ...Object.values(a)];
    if (all.some((r) => !r)) return null;
    // The first stage still in doubt for either team (once both are in, talk about round 2, etc.).
    const stages = [['madePlayoffs', 'make the playoffs'], ['round2', 'reach round 2'], ['round3', 'reach the conference final'], ['round4', 'reach the Final'], ['wonCup', 'win the Cup']];
    for (const [col, label] of stages) {
        const vals = all.map((r) => num(r?.[col]));
        if (vals.some((v) => v == null)) continue;
        if (vals.every((v) => v >= 0.995)) continue;
        const pick = (s) => ({
            now: num(s.now[col]), winReg: num(s.winReg[col]), winOT: num(s.winOT[col]),
            lossOT: num(s.lossOT[col]), lossReg: num(s.lossReg[col]),
        });
        const hv = pick(h);
        const av = pick(a);
        return {label, home: {...hv, swing: hv.winReg - hv.lossReg}, away: {...av, swing: av.winReg - av.lossReg}};
    }
    return null;
}

/* ------------------------------------------------- win probability */

const elapsedOf = (period, timeInPeriod) => (Math.max(1, period) - 1) * 1200 + mmssToSeconds(timeInPeriod);

/** Seconds elapsed in the game right now (from the header clock). */
export function currentElapsed(header) {
    if (!header.started) return 0;
    const p = Math.max(1, header.period || 1);
    const left = header.clock.inIntermission ? 0 : header.clock.secondsRemaining ?? mmssToSeconds(header.clock.timeRemaining);
    const len = p > 3 && !header.playoff ? 300 : 1200;
    return (p - 1) * 1200 + Math.max(0, len - left);
}

export const timeLabel = (t) => {
    const p = Math.floor(t / 1200) + 1;
    const s = t - (p - 1) * 1200;
    return `${periodLabel(Math.min(p, 99))} ${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;
};

function rinksideAt(ratings, header, t, homeScore, awayScore, situationCode) {
    const period = Math.floor(Math.min(t, 1e9) / 1200) + 1;
    const inPeriod = t - (period - 1) * 1200;
    return liveWinProbability(ratings, {
        home: header.home.abbrev,
        away: header.away.abbrev,
        homeScore,
        awayScore,
        period: t >= 3600 ? 4 : period,
        secondsRemaining: t >= 3600 ? 0 : 1200 - inPeriod,
        situationCode,
        playoff: header.playoff,
    }).home;
}

/**
 * Rinkside win-probability timeline: samples every 2 minutes plus a before/after point for
 * every goal. Returns {data: [{y, label}], markers: [{index, isHome}], series: number[]}.
 */
export function buildRinksideSeries(ratings, header, goals, endT) {
    const data = [];
    const markers = [];
    const push = (t, hs, as, y) => data.push({y, label: `${timeLabel(t)} · ${header.away.abbrev} ${as}–${hs} ${header.home.abbrev}`});
    const sorted = goals
        .map((g) => ({...g, t: elapsedOf(g.period, g.timeInPeriod)}))
        .sort((a, b) => a.t - b.t);
    let hs = 0;
    let as = 0;
    let gi = 0;
    // A final decided in overtime ends at the winning goal, not at the end of the OT clock.
    const lastGoal = sorted[sorted.length - 1];
    const end = header.final && lastGoal && lastGoal.t >= 3600 ? lastGoal.t : Math.max(0, endT);
    for (let t = 0; t <= end; t += 120) {
        while (gi < sorted.length && sorted[gi].t <= t) {
            const g = sorted[gi];
            push(g.t, hs, as, rinksideAt(ratings, header, g.t, hs, as));
            hs = g.homeScore;
            as = g.awayScore;
            push(g.t, hs, as, rinksideAt(ratings, header, g.t, hs, as));
            markers.push({index: data.length - 1, isHome: g.isHome});
            gi++;
        }
        push(t, hs, as, rinksideAt(ratings, header, t, hs, as));
    }
    while (gi < sorted.length) {
        const g = sorted[gi];
        push(g.t, hs, as, rinksideAt(ratings, header, g.t, hs, as));
        hs = g.homeScore;
        as = g.awayScore;
        push(g.t, hs, as, rinksideAt(ratings, header, g.t, hs, as));
        markers.push({index: data.length - 1, isHome: g.isHome});
        gi++;
    }
    if (header.final) {
        const fh = header.home.score ?? hs;
        const fa = header.away.score ?? as;
        data.push({y: fh > fa ? 1 : fh < fa ? 0 : 0.5, label: `Final · ${header.away.abbrev} ${fa}–${fh} ${header.home.abbrev}`});
    } else if (end % 120 !== 0) {
        push(end, hs, as, rinksideAt(ratings, header, end, hs, as));
    }
    return {data, markers, series: data.map((d) => d.y)};
}

/** MoneyPuck series → chart data + goal/penalty markers. */
export function moneyPuckChart(mp, header, eventType = 'GOAL') {
    const data = mp.series.map((r) => ({y: r.p, label: r.time != null ? timeLabel(r.time) : r.event}));
    if (header.final && data.length) {
        const fh = header.home.score ?? 0;
        const fa = header.away.score ?? 0;
        if (fh !== fa) data.push({y: fh > fa ? 1 : 0, label: 'Final'});
    }
    const markers = [];
    mp.series.forEach((r, i) => {
        if (r.event !== eventType) return;
        const prev = mp.series[i - 1]?.p ?? r.p;
        const next = mp.series[i + 1]?.p ?? r.p;
        markers.push({index: i, isHome: eventType === 'GOAL' ? next >= prev : next < prev});
    });
    return {data, markers, series: data.map((d) => d.y)};
}

/** Current Rinkside live win probability for the header state. */
export function rinksideLive(ratings, header, situationCode) {
    try {
        const p = Math.max(1, header.period || 1);
        const left = header.clock.inIntermission ? 0 : header.clock.secondsRemaining ?? mmssToSeconds(header.clock.timeRemaining);
        return liveWinProbability(ratings, {
            home: header.home.abbrev,
            away: header.away.abbrev,
            homeScore: header.home.score ?? 0,
            awayScore: header.away.score ?? 0,
            period: p,
            secondsRemaining: p <= 3 ? left : 0,
            situationCode: header.clock.inIntermission ? undefined : situationCode,
            ppSeconds: header.situation?.secondsRemaining ?? (header.situation?.timeRemaining ? mmssToSeconds(header.situation.timeRemaining) : undefined),
            playoff: header.playoff,
        });
    } catch {
        return null;
    }
}

/* ----------------------------------------------------- players */

/** playerId → {name, first, last, team, number, position, headshot} from pbp roster spots + boxscore. */
export function rosterIndex(pbp, box, header) {
    const out = new Map();
    for (const r of pbp?.rosterSpots ?? []) {
        const isHome = r?.teamId === header.home.id;
        out.set(r?.playerId, {
            name: [loc(r?.firstName), loc(r?.lastName)].filter(Boolean).join(' '),
            last: loc(r?.lastName),
            number: r?.sweaterNumber,
            position: r?.positionCode,
            headshot: r?.headshot,
            team: isHome ? header.home.abbrev : header.away.abbrev,
        });
    }
    for (const key of ['homeTeam', 'awayTeam']) {
        const t = box?.playerByGameStats?.[key];
        for (const group of ['forwards', 'defense', 'goalies']) {
            for (const p of t?.[group] ?? []) {
                if (!out.has(p?.playerId)) {
                    const name = loc(p?.name);
                    out.set(p?.playerId, {name, last: name.split(' ').slice(-1)[0], number: p?.sweaterNumber, position: p?.position, team: key === 'homeTeam' ? header.home.abbrev : header.away.abbrev});
                }
            }
        }
    }
    return out;
}

/** Boxscore skaters / goalies for one side. */
export function boxPlayers(box, key) {
    const t = box?.playerByGameStats?.[key] ?? {};
    const skaters = [...(t.forwards ?? []), ...(t.defense ?? [])].map((p) => ({
        id: p?.playerId,
        number: p?.sweaterNumber,
        name: loc(p?.name),
        pos: p?.position ?? '',
        g: num(p?.goals) ?? 0,
        a: num(p?.assists) ?? 0,
        pts: num(first(p?.points, (num(p?.goals) ?? 0) + (num(p?.assists) ?? 0))) ?? 0,
        sog: num(first(p?.sog, p?.shots)) ?? 0,
        pm: num(p?.plusMinus) ?? 0,
        hits: num(p?.hits) ?? 0,
        blk: num(first(p?.blockedShots, p?.blocks)) ?? 0,
        pim: num(p?.pim) ?? 0,
        toi: p?.toi ?? '',
        toiSec: mmssToSeconds(p?.toi),
        fo: num(p?.faceoffWinningPctg),
    }));
    const goalies = (t.goalies ?? []).map((p) => ({
        id: p?.playerId,
        number: p?.sweaterNumber,
        name: loc(p?.name),
        pos: 'G',
        svPct: num(p?.savePctg),
        saves: p?.saveShotsAgainst ?? (p?.saves != null && p?.shotsAgainst != null ? `${p.saves}/${p.shotsAgainst}` : ''),
        ga: num(p?.goalsAgainst) ?? 0,
        toi: p?.toi ?? '',
        toiSec: mmssToSeconds(p?.toi),
        starter: !!p?.starter,
    }));
    return {skaters, goalies};
}

/* ------------------------------------------------------ rink map */

export const MAP_EVENTS = [
    {key: 'xg', label: 'Shots (xG)'},
    {key: 'goal', label: 'Goals'},
    {key: 'shot-on-goal', label: 'Shots on goal'},
    {key: 'missed-shot', label: 'Missed'},
    {key: 'blocked-shot', label: 'Blocked'},
    {key: 'hit', label: 'Hits'},
    {key: 'giveaway', label: 'Giveaways'},
    {key: 'takeaway', label: 'Takeaways'},
];

/**
 * Should coordinates be rotated 180° so the home team always attacks to the LEFT? The home team is
 * the left column everywhere on the game page, so its shots (and colour) belong on the left half.
 * Uses the play's homeTeamDefendingSide when present.
 */
const flipFor = (play) => play?.homeTeamDefendingSide === 'left';

/** Period / clock / shot type of a play, for filtering and the tapped-dot detail line. */
const playMeta = (p) => ({
    period: p?.periodDescriptor?.number ?? null,
    periodType: p?.periodDescriptor?.periodType ?? null,
    time: p?.timeInPeriod ?? null,
    shotType: p?.details?.shotType ?? null,
});

/** Plays of one type as rink points ({x, y, isHome, eventId}), normalised: home attacks left. */
export function mapEvents(pbp, header, type) {
    const homeId = header.home.id ?? pbp?.homeTeam?.id;
    const out = [];
    for (const p of pbp?.plays ?? []) {
        if (p?.typeDescKey !== type) continue;
        const d = p?.details ?? {};
        const x = num(d.xCoord);
        const y = num(d.yCoord);
        if (x == null || y == null) continue;
        const f = flipFor(p);
        out.push({
            x: f ? -x : x,
            y: f ? -y : y,
            isHome: d.eventOwnerTeamId === homeId,
            eventId: p?.eventId,
            playerId: d.shootingPlayerId ?? d.scoringPlayerId ?? d.hittingPlayerId ?? d.playerId,
            ...playMeta(p),
        });
    }
    return out;
}

/** gameXG shots normalised (home attacks left). */
export function mapXGShots(pbp, xg) {
    if (!xg) return [];
    const byId = new Map((pbp?.plays ?? []).map((p) => [p?.eventId, p]));
    const shots = [];
    for (const [isHome, list] of [[true, xg.home.shots], [false, xg.away.shots]]) {
        for (const s of list) {
            const play = byId.get(s.eventId);
            const f = flipFor(play);
            const d = play?.details ?? {};
            shots.push({...s, x: f ? -s.x : s.x, y: f ? -s.y : s.y, isHome, playerId: d.shootingPlayerId ?? d.scoringPlayerId, ...playMeta(play)});
        }
    }
    return shots;
}

/** The play-by-play goal event that matches a landing goal (by eventId, else by order). */
export function findGoalPlay(pbp, goal, index) {
    const plays = pbp?.plays ?? [];
    const byId = goal?.eventId != null ? plays.find((p) => p?.eventId === goal.eventId) : null;
    if (byId) return byId;
    return plays.filter((p) => p?.typeDescKey === 'goal' && p?.periodDescriptor?.periodType !== 'SO')[index] ?? null;
}

/** Latest situation code in the play-by-play (for power-play-aware live win probability). */
export function latestSituationCode(pbp, landing) {
    const plays = pbp?.plays;
    if (plays?.length) {
        for (let i = plays.length - 1; i >= 0; i--) if (plays[i]?.situationCode) return String(plays[i].situationCode);
    }
    return landing?.situation?.situationCode ? String(landing.situation.situationCode) : undefined;
}
