'use strict';
// Deterministic fixture server for the render smoke test.
//
// Everything is derived from one generated league: a season schedule (with hand-scripted games
// "today"), per-game play-by-play simulations, and per-player game logs. Standings, score feeds,
// club schedules, box scores, stats-API summaries and MoneyPuck CSVs are all computed from that,
// so the numbers agree across screens the way the real APIs do.
//
//   const fx = require('./fixtures');
//   fx.resolve(url, {scenario: 'full' | 'degraded'}) -> {status, contentType, body} | null
//
// `null` means "not a host we fixture" (the runner decides what to do with it).
// Run `node scripts/smoke/fixtures.js` to self-check (prints a summary of every endpoint).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/* ------------------------------------------------------------------ clock */

// Browser clock is frozen here (runner uses page.clock.setFixedTime + America/New_York).
// 8:15 pm ET on Wed Nov 11 2026 -> hockey "today" is 2026-11-11.
const NOW = new Date('2026-11-12T01:15:00Z');
const TODAY = '2026-11-11';
const SEASON = '20262027';
const PREV_SEASON = '20252026';
const MP_YEAR = '2026';
const MP_PREV_YEAR = '2025';
const SEASON_START = '2026-10-07';
const SEASON_END = '2027-04-15';
const FAV_TEAM = 'TOR';

/* ------------------------------------------------------------------ rng */

function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function rng(seed) {
    let a = hash(String(seed));
    const next = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.poisson = (lambda) => {
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
            k++;
            p *= next();
        } while (p > L && k < 20);
        return k - 1;
    };
    next.shuffle = (arr) => {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    };
    return next;
}

const memo = (fn) => {
    const cache = new Map();
    return (...args) => {
        const k = args.join('|');
        if (!cache.has(k)) cache.set(k, fn(...args));
        return cache.get(k);
    };
};

const pad2 = (n) => String(n).padStart(2, '0');
const mmss = (s) => `${pad2(Math.floor(s / 60))}:${pad2(Math.floor(s % 60))}`;
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const d = (s) => ({default: s});
const addDaysISO = (iso, n) => {
    const t = new Date(`${iso}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
};
const dayDiff = (a, b) => Math.round((new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 86400000);

/* ------------------------------------------------------------------ teams */

function loadTeams() {
    const src = fs.readFileSync(path.join(ROOT, 'src/data/teams.js'), 'utf8');
    const block = src.slice(src.indexOf('const TEAMS = ['), src.indexOf('];'));
    const re = /\{abbrev: '([A-Z]{3})', name: '([^']+)', primary: '[^']*', dark: '[^']*', conference: '(\w+)', division: '(\w+)'\}/g;
    const out = [];
    let m;
    while ((m = re.exec(block))) out.push({abbrev: m[1], name: m[2], conference: m[3], division: m[4]});
    if (out.length !== 32) throw new Error(`fixtures: expected 32 teams in src/data/teams.js, parsed ${out.length}`);
    return out;
}

const TEAM_IDS = {
    NJD: 1, NYI: 2, NYR: 3, PHI: 4, PIT: 5, BOS: 6, BUF: 7, MTL: 8, OTT: 9, TOR: 10, CAR: 12, FLA: 13, TBL: 14,
    WSH: 15, CHI: 16, DET: 17, NSH: 18, STL: 19, CGY: 20, COL: 21, EDM: 22, VAN: 23, ANA: 24, DAL: 25, LAK: 26,
    SJS: 28, CBJ: 29, MIN: 30, WPG: 52, VGK: 54, SEA: 55, UTA: 68,
};
const MULTI_WORD = ['Maple Leafs', 'Red Wings', 'Blue Jackets', 'Golden Knights'];
const VENUES = {
    TOR: 'Scotiabank Arena', BOS: 'TD Garden', WSH: 'Capital One Arena', COL: 'Ball Arena', VGK: 'T-Mobile Arena',
    LAK: 'Crypto.com Arena', DAL: 'American Airlines Center', SJS: 'SAP Center', VAN: 'Rogers Arena', DET: 'Little Caesars Arena',
    MTL: 'Centre Bell', UTA: 'Delta Center',
};
const MP_CODES = {LAK: 'L.A', NJD: 'N.J', SJS: 'S.J', TBL: 'T.B'};
const DIV_ABBREV = {Atlantic: 'A', Metropolitan: 'M', Central: 'C', Pacific: 'P'};

const TEAMS = loadTeams().map((t, i) => {
    const common = MULTI_WORD.find((w) => t.name.endsWith(w)) ?? t.name.split(' ').slice(-1)[0];
    const place = t.name.slice(0, t.name.length - common.length).trim();
    return {
        ...t,
        index: i,
        id: TEAM_IDS[t.abbrev],
        common,
        place,
        venue: VENUES[t.abbrev] ?? `${place} Arena`,
        // Hidden strength used by the schedule simulation (goals per game for / against).
        gf: 2.6 + rng(`str-f-${t.abbrev}`)() * 1.0,
        ga: 2.6 + rng(`str-a-${t.abbrev}`)() * 1.0,
    };
});
const TEAM = Object.fromEntries(TEAMS.map((t) => [t.abbrev, t]));
const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
const logo = (abbrev, dark = false) => `https://assets.nhle.com/logos/nhl/svg/${abbrev}_${dark ? 'dark' : 'light'}.svg`;
const mug = (abbrev, id, season = SEASON) => `https://assets.nhle.com/mugs/nhl/${season}/${abbrev}/${id}.png`;

/* ---------------------------------------------------------------- players */

const FIRST = ['Auston', 'William', 'Mitch', 'John', 'Morgan', 'Matthew', 'Joseph', 'Bobby', 'Nick', 'Max', 'Connor', 'Jake',
    'Ryan', 'Tyler', 'Brady', 'Quinn', 'Mikko', 'Aleksander', 'Jérémie', 'Šimon', 'Lukáš', 'Tim', 'Filip', 'Elias', 'Mathew',
    'Cale', 'Nathan', 'Sidney', 'Evgeni', 'Kirill', 'Artemi', 'Jack', 'Leon', 'Dylan', 'Logan', 'Trevor', 'Adam', 'Owen',
    'Brock', 'Juuse', 'Ilya', 'Igor', 'Linus', 'Jesper', 'Rasmus', 'Moritz', 'Nico', 'Kevin', 'Jordan', 'Thatcher'];
const LAST = ['Matthews', 'Nylander', 'Marner', 'Tavares', 'Rielly', 'Knies', 'Woll', 'Stolarz', 'McMann', 'Domi', 'Robertson',
    'Laughton', 'Pacioretty', 'Ekman-Larsson', 'Tanev', 'Benoit', 'Carlo', 'Hakanpää', 'Stützle', 'Nečas', 'Pastrňák',
    'Lafrenière', 'Bergeron', 'Larkin', 'Raymond', 'Seider', 'Dahlin', 'Thompson', 'Tuch', 'Kaprizov', 'Boldy', 'Hughes',
    'Bratt', 'Mercer', 'Hischier', 'Svechnikov', 'Aho', 'Slavin', 'Barkov', 'Reinhart', 'Tkachuk', 'Ekblad', 'Kucherov',
    'Point', 'Hedman', 'Vasilevskiy', 'Shesterkin', 'Panarin', 'Fox', 'Zibanejad', 'Sorokin', 'Barzal', 'Horvat', 'Dobson',
    'Konecny', 'Michkov', 'Sanheim', 'Malkin', 'Letang', 'Karlsson', 'Ovechkin', 'Strome', 'Wilson', 'Werenski', 'Marchenko',
    'Fantilli', 'Bedard', 'Connor', 'Scheifele', 'Hellebuyck', 'MacKinnon', 'Makar', 'Rantanen', 'Robertson', 'Heiskanen',
    'Oettinger', 'Josi', 'Forsberg', 'Saros', 'Kyrou', 'Thomas', 'Binnington', 'Keller', 'Cooley', 'Guenther', 'Sergachev'];
const COUNTRIES = [['Toronto', 'ON', 'CAN'], ['Boston', 'MA', 'USA'], ['Stockholm', null, 'SWE'], ['Helsinki', null, 'FIN'],
    ['Prague', null, 'CZE'], ['Moscow', null, 'RUS'], ['Calgary', 'AB', 'CAN'], ['Minneapolis', 'MN', 'USA'], ['Montréal', 'QC', 'CAN'],
    ['Bratislava', null, 'SVK'], ['Cologne', null, 'DEU'], ['Riga', null, 'LVA']];

const ROSTER_SIZE = 25; // 14 F, 8 D, 3 G
const FWD_POS = ['C', 'L', 'R'];
const playerIdFor = (team, slot) => 8478000 + team.index * 40 + slot;

function makePlayer(team, slot) {
    const r = rng(`player-${team.abbrev}-${slot}`);
    const id = playerIdFor(team, slot);
    const pos = slot < 14 ? FWD_POS[slot % 3] : slot < 22 ? 'D' : 'G';
    const [city, prov, country] = r.pick(COUNTRIES);
    const age = r.int(19, 36);
    const birthYear = 2026 - age;
    const heightIn = pos === 'G' ? r.int(73, 78) : pos === 'D' ? r.int(72, 77) : r.int(69, 75);
    const weightLb = r.int(175, 225);
    const draftYear = birthYear + 18;
    const drafted = r() > 0.15 && draftYear <= 2025;
    return {
        id,
        slot,
        team: team.abbrev,
        firstName: r.pick(FIRST),
        lastName: r.pick(LAST),
        pos,
        number: slot === 0 ? 34 : ((slot * 7 + team.index * 3) % 97) + 2,
        shoots: r() > 0.4 ? 'L' : 'R',
        heightIn,
        weightLb,
        birthDate: `${birthYear}-${pad2(r.int(1, 12))}-${pad2(r.int(1, 28))}`,
        city, prov, country,
        drafted: drafted ? {year: draftYear, teamAbbrev: r.pick(TEAMS).abbrev, round: r.int(1, 7), pickInRound: r.int(1, 32)} : null,
        // talent
        gRate: pos === 'G' ? 0 : pos === 'D' ? 0.04 + r() * 0.1 : Math.max(0.05, 0.5 - slot * 0.03 + r() * 0.08),
        aRate: pos === 'G' ? 0.02 : pos === 'D' ? 0.2 + r() * 0.3 : Math.max(0.1, 0.7 - slot * 0.04 + r() * 0.1),
        svTalent: 0.895 + r() * 0.025,
        seasonsBack: Math.min(age - 19, r.int(1, 8)),
    };
}

const ROSTERS = Object.fromEntries(TEAMS.map((t) => [t.abbrev, Array.from({length: ROSTER_SIZE}, (_, s) => makePlayer(t, s))]));
const PLAYER_BY_ID = new Map(Object.values(ROSTERS).flat().map((p) => [p.id, p]));
const fullName = (p) => `${p.firstName} ${p.lastName}`;
const skatersOf = (abbrev) => ROSTERS[abbrev].filter((p) => p.pos !== 'G');
const goaliesOf = (abbrev) => ROSTERS[abbrev].filter((p) => p.pos === 'G');

const SKATER_ID = playerIdFor(TEAM[FAV_TEAM], 0);
const GOALIE_ID = playerIdFor(TEAM[FAV_TEAM], 22);

/* --------------------------------------------------------------- schedule */

// Hand-scripted games today (Nov 11). Times are UTC. Everything else is random but seeded.
const TODAY_GAMES = [
    {away: 'NYR', home: 'BOS', start: '2026-11-11T18:00:00Z', state: 'OFF', script: 'enFinal'},
    {away: 'PIT', home: 'WSH', start: '2026-11-11T22:00:00Z', state: 'FINAL', script: 'shootout'},
    {away: 'MTL', home: 'TOR', start: '2026-11-12T00:00:00Z', state: 'LIVE', script: 'livePP'},
    {away: 'UTA', home: 'COL', start: '2026-11-12T00:30:00Z', state: 'LIVE', script: 'intermission'},
    {away: 'EDM', home: 'VGK', start: '2026-11-11T23:30:00Z', state: 'CRIT', script: 'pulledGoalie'},
    {away: 'SEA', home: 'LAK', start: '2026-11-12T01:30:00Z', state: 'PRE'},
    {away: 'CHI', home: 'DAL', start: '2026-11-12T02:00:00Z', state: 'FUT'},
    {away: 'ANA', home: 'VAN', start: '2026-11-12T03:00:00Z', state: 'FUT'},
    {away: 'NSH', home: 'SJS', start: '2026-11-12T03:30:00Z', state: 'FUT'},
    {away: 'CBJ', home: 'DET', start: '2026-11-12T00:00:00Z', state: 'FUT', scheduleState: 'PPD'},
];

function buildSchedule() {
    const games = [];
    const span = dayDiff(SEASON_END, SEASON_START);
    for (let i = 0; i <= span; i++) {
        const date = addDaysISO(SEASON_START, i);
        if (date === TODAY) {
            TODAY_GAMES.forEach((g) => games.push({...g, date}));
            continue;
        }
        const r = rng(`day-${date}`);
        const n = r.int(3, 9);
        const order = r.shuffle(TEAMS.map((t) => t.abbrev));
        const hours = ['23:00', '23:30', '00:00', '00:30', '01:00', '02:00', '02:30', '03:00'];
        for (let k = 0; k < n; k++) {
            const hm = r.pick(hours);
            const startDate = hm < '12' ? addDaysISO(date, 1) : date;
            games.push({away: order[2 * k], home: order[2 * k + 1], date, start: `${startDate}T${hm}:00Z`});
        }
    }
    games.forEach((g, i) => {
        g.id = 2026020001 + i;
        g.season = Number(SEASON);
        g.gameType = 2;
        if (!g.state) {
            g.state = g.date < TODAY ? 'OFF' : 'FUT';
        }
        g.scheduleState = g.scheduleState ?? 'OK';
    });
    return games;
}

const GAMES = buildSchedule();
const GAME_BY_ID = new Map(GAMES.map((g) => [g.id, g]));
const gamesOn = (date) => GAMES.filter((g) => g.date === date);
const teamGames = (abbrev) => GAMES.filter((g) => g.home === abbrev || g.away === abbrev);
const isStarted = (g) => ['LIVE', 'CRIT', 'FINAL', 'OFF'].includes(g.state);
const isDone = (g) => g.state === 'FINAL' || g.state === 'OFF';

const findToday = (away, home) => GAMES.find((g) => g.date === TODAY && g.away === away && g.home === home);
const GAME_IDS = {
    finalEN: findToday('NYR', 'BOS').id,
    finalSO: findToday('PIT', 'WSH').id,
    livePP: findToday('MTL', 'TOR').id,
    intermission: findToday('UTA', 'COL').id,
    crit: findToday('EDM', 'VGK').id,
    pre: findToday('SEA', 'LAK').id,
    fut: findToday('CHI', 'DAL').id,
    ppd: findToday('CBJ', 'DET').id,
};

/* ------------------------------------------------------- game simulation */

// Elapsed-second helpers (regular season: OT = 5 min, then shootout as period 5).
const periodOf = (t) => (t < 3600 ? Math.floor(t / 1200) + 1 : 4);
const inPeriod = (t) => (t < 3600 ? t - (periodOf(t) - 1) * 1200 : t - 3600);
const periodLen = (p) => (p <= 3 ? 1200 : 300);
const ptype = (p) => (p <= 3 ? 'REG' : p === 4 ? 'OT' : 'SO');
const pdesc = (p) => ({number: p, periodType: ptype(p), maxRegulationPeriods: 3});

/**
 * Scripted outline of a game: goals [{t, team, en?}], penalties [{t, team}], pulls [{t, team}],
 * end (elapsed seconds simulated), shootout [{team, goal}] and final clock.
 */
function outline(g) {
    const r = rng(`outline-${g.id}`);
    const H = g.home;
    const A = g.away;
    switch (g.script) {
        case 'enFinal': // BOS 4-2 NYR, NYR pulls goalie at 18:00 P3, BOS empty-netter 18:40
            return {
                goals: [{t: 312, team: H}, {t: 1405, team: A}, {t: 1980, team: H, ppFrom: 1890}, {t: 2950, team: A}, {t: 3150, team: H}, {t: 3520, team: H, en: true}],
                penalties: [{t: 1890, team: A}, {t: 2400, team: H}, {t: 900, team: H}],
                pulls: [{t: 3480, team: A}],
                end: 3600, lastPeriodType: 'REG',
            };
        case 'shootout': // PIT 3-2 WSH (SO)
            return {
                goals: [{t: 640, team: A}, {t: 1500, team: H}, {t: 2300, team: H}, {t: 3300, team: A}],
                penalties: [{t: 1100, team: H}, {t: 2700, team: A}],
                pulls: [],
                end: 3900, lastPeriodType: 'SO',
                shootout: [{team: A, goal: true}, {team: H, goal: false}, {team: A, goal: false}, {team: H, goal: true}, {team: A, goal: true}, {team: H, goal: false}],
            };
        case 'livePP': // TOR 2-1 MTL, P2 08:34 left, MTL penalty at P2 10:30 (TOR on the PP, 1:04 left)
            return {
                goals: [{t: 420, team: H}, {t: 1010, team: A}, {t: 1500, team: H}],
                penalties: [{t: 700, team: H}, {t: 1200 + 630, team: A}],
                pulls: [],
                end: 1200 + 686,
                clock: {period: 2, remaining: 514, intermission: false},
            };
        case 'intermission': // COL 1-0 UTA after one
            return {goals: [{t: 845, team: H}], penalties: [{t: 300, team: A}], pulls: [], end: 1200, clock: {period: 1, remaining: 0, intermission: true}};
        case 'pulledGoalie': // VGK 3-2 EDM, P3 01:47 left, EDM net empty since 17:30
            return {
                goals: [{t: 200, team: A}, {t: 980, team: H}, {t: 1650, team: H}, {t: 2420, team: A}, {t: 2900, team: H}],
                penalties: [{t: 1300, team: A}, {t: 2200, team: H}],
                pulls: [{t: 3450, team: A}],
                end: 3600 - 107,
                clock: {period: 3, remaining: 107, intermission: false},
            };
        default: {
            // Random completed game.
            const hg = r.poisson(TEAM[H].gf * 1.03 * (TEAM[A].ga / 3) );
            const ag = r.poisson(TEAM[A].gf * (TEAM[H].ga / 3));
            const goals = [];
            const tied = hg === ag;
            const reg = (n, team) => {
                for (let i = 0; i < n; i++) goals.push({t: r.int(20, 3590), team});
            };
            reg(hg, H);
            reg(ag, A);
            const penalties = Array.from({length: r.int(2, 6)}, () => ({t: r.int(60, 3500), team: r() < 0.5 ? H : A}));
            let lastPeriodType = 'REG';
            let end = 3600;
            let shootout;
            if (tied) {
                const winner = r() < 0.5 ? H : A;
                if (r() < 0.65) {
                    const t = 3600 + r.int(15, 290);
                    goals.push({t, team: winner});
                    lastPeriodType = 'OT';
                    end = t;
                } else {
                    lastPeriodType = 'SO';
                    end = 3900;
                    const loser = winner === H ? A : H;
                    shootout = [{team: A, goal: winner === A}, {team: H, goal: winner === H}, {team: A, goal: false}, {team: H, goal: false},
                        {team: winner === A ? A : loser, goal: winner === A}, {team: winner === H ? H : loser, goal: false}];
                }
            }
            goals.sort((a, b) => a.t - b.t);
            return {goals, penalties, pulls: [], end, lastPeriodType, shootout};
        }
    }
}

const SHOT_TYPES = ['wrist', 'wrist', 'wrist', 'wrist', 'snap', 'snap', 'slap', 'backhand', 'backhand', 'tip-in', 'deflected', 'wrap-around'];
const PENALTIES = ['tripping', 'hooking', 'slashing', 'holding', 'interference', 'roughing', 'high-sticking', 'cross-checking', 'delay-of-game-puck-over-glass'];

/** Full simulation for a started game: plays, goals, penalties, box score lines. */
const simulate = memo((gameId) => {
    const g = GAME_BY_ID.get(Number(gameId));
    const o = outline(g);
    const r = rng(`sim-${g.id}`);
    const H = g.home;
    const A = g.away;
    const homeId = TEAM[H].id;
    const awayId = TEAM[A].id;
    const roster = {[H]: ROSTERS[H], [A]: ROSTERS[A]};
    const skaters = {[H]: skatersOf(H), [A]: skatersOf(A)};
    const goalie = {[H]: goaliesOf(H)[0], [A]: goaliesOf(A)[r() < 0.25 ? 1 : 0]};
    const opp = (team) => (team === H ? A : H);
    const plays = [];
    let eventId = 50;
    let sortOrder = 10;
    const score = {[H]: 0, [A]: 0};
    const sog = {[H]: 0, [A]: 0};
    const stat = new Map(); // playerId -> line
    const line = (id) => {
        if (!stat.has(id)) stat.set(id, {goals: 0, assists: 0, sog: 0, hits: 0, blockedShots: 0, pim: 0, plusMinus: 0, giveaways: 0, takeaways: 0, ppg: 0, fow: 0, fol: 0, sa: 0, ga: 0});
        return stat.get(id);
    };
    const teamStat = {[H]: {hits: 0, blocks: 0, give: 0, take: 0, pim: 0, fow: 0, ppOpp: 0, ppGoals: 0}, [A]: {hits: 0, blocks: 0, give: 0, take: 0, pim: 0, fow: 0, ppOpp: 0, ppGoals: 0}};
    const goals = [];
    const penalties = [];
    const activePens = []; // {team, until}
    const pulled = {[H]: null, [A]: null};
    const goalsTodate = new Map();
    const assistsTodate = new Map();

    const defSide = (p) => (p % 2 === 1 ? 'left' : 'right'); // home defends left in odd periods
    const situation = (t) => {
        const pens = activePens.filter((x) => x.from <= t && x.until > t);
        const ot = t >= 3600;
        let hs = ot ? 3 : 5;
        let as = ot ? 3 : 5;
        for (const p of pens) {
            if (p.team === H) hs = ot ? hs + 0 : hs - 1;
            else as = ot ? as : as - 1;
            if (ot) {
                if (p.team === H) as += 1;
                else hs += 1;
            }
        }
        let hg = 1;
        let ag = 1;
        if (pulled[H] != null && t >= pulled[H]) {
            hg = 0;
            hs += 1;
        }
        if (pulled[A] != null && t >= pulled[A]) {
            ag = 0;
            as += 1;
        }
        return `${ag}${as}${hs}${hg}`;
    };
    const coords = (team, t, near) => {
        const p = periodOf(t);
        const attackRight = (team === H) === (defSide(p) === 'left');
        const x = near ? r.int(62, 84) : r.int(30, 88);
        const y = near ? r.int(-12, 12) : r.int(-38, 38);
        return {xCoord: attackRight ? x : -x, yCoord: y};
    };
    const add = (t, typeDescKey, typeCode, details, extra = {}) => {
        const p = extra.period ?? periodOf(t);
        const ip = extra.inPeriod ?? inPeriod(t);
        plays.push({
            eventId: eventId++,
            periodDescriptor: pdesc(p),
            timeInPeriod: mmss(ip),
            timeRemaining: mmss(Math.max(0, periodLen(p) - ip)),
            situationCode: extra.situationCode ?? situation(t),
            homeTeamDefendingSide: defSide(p),
            typeCode,
            typeDescKey,
            sortOrder: sortOrder++,
            ...(details ? {details} : {}),
        });
        return plays[plays.length - 1];
    };

    o.pulls.forEach((x) => {
        pulled[x.team] = x.t;
    });
    o.penalties.forEach((x) => activePens.push({team: x.team, from: x.t, until: x.t + 120, t: x.t}));

    // Build a time-ordered event list: scripted goals + penalties + filler.
    const scripted = [
        ...o.goals.filter((x) => x.t <= o.end).map((x) => ({...x, kind: 'goal'})),
        ...o.penalties.filter((x) => x.t <= o.end).map((x) => ({...x, kind: 'penalty'})),
    ].sort((a, b) => a.t - b.t);
    const lastP = Math.min(4, periodOf(Math.max(0, Math.min(o.end, 3899) - 1)));
    const periods = [];
    for (let p = 1; p <= lastP; p++) periods.push(p);

    for (const p of periods) {
        const start = p <= 3 ? (p - 1) * 1200 : 3600;
        const stop = Math.min(o.end, start + periodLen(p));
        add(start, 'period-start', 520, null);
        const fo = (t) => {
            const team = r() < 0.5 ? H : A;
            const w = skaters[team][r.int(0, 3) * 3];
            const l = skaters[opp(team)][r.int(0, 3) * 3];
            line(w.id).fow++;
            line(l.id).fol++;
            teamStat[team].fow++;
            add(t, 'faceoff', 502, {eventOwnerTeamId: TEAM[team].id, losingPlayerId: l.id, winningPlayerId: w.id, ...coords(team, t, false), xCoord: 0, yCoord: 0, zoneCode: 'N'});
        };
        fo(start);
        let t = start + r.int(8, 25);
        const queue = scripted.filter((x) => x.t >= start && x.t < start + periodLen(p));
        while (t < stop || queue.length) {
            const nextScripted = queue[0];
            if (nextScripted && nextScripted.t <= t) {
                queue.shift();
                if (nextScripted.t > stop) continue;
                const tt = nextScripted.t;
                const team = nextScripted.team;
                if (nextScripted.kind === 'goal') {
                    const sit = situation(tt);
                    const shooter = skaters[team][r.int(0, 8)];
                    const helpers = r.shuffle(skaters[team].filter((s) => s.id !== shooter.id)).slice(0, r() < 0.15 ? 0 : r() < 0.4 ? 1 : 2);
                    score[team]++;
                    sog[team]++;
                    goalsTodate.set(shooter.id, (goalsTodate.get(shooter.id) ?? 0) + 1);
                    helpers.forEach((h) => assistsTodate.set(h.id, (assistsTodate.get(h.id) ?? 0) + 1));
                    line(shooter.id).goals++;
                    line(shooter.id).sog++;
                    helpers.forEach((h) => line(h.id).assists++);
                    line(goalie[opp(team)].id).sa++;
                    line(goalie[opp(team)].id).ga++;
                    const isHome = team === H;
                    const ownSk = Number(isHome ? sit[2] : sit[1]);
                    const oppSk = Number(isHome ? sit[1] : sit[2]);
                    const oppGoalieIn = (isHome ? sit[0] : sit[3]) === '1';
                    const strength = ownSk > oppSk && !nextScripted.en ? 'pp' : ownSk < oppSk ? 'sh' : 'ev';
                    if (strength === 'pp') {
                        teamStat[team].ppGoals++;
                        line(shooter.id).ppg++;
                        // A power-play goal ends the minor.
                        const pen = activePens.find((x) => x.team !== team && x.from <= tt && x.until > tt);
                        if (pen) pen.until = tt;
                    }
                    const shotType = r.pick(SHOT_TYPES);
                    const play = add(tt, 'goal', 505, {
                        ...coords(team, tt, true),
                        zoneCode: 'O',
                        shotType,
                        scoringPlayerId: shooter.id,
                        scoringPlayerTotal: goalsTodate.get(shooter.id),
                        ...(helpers[0] ? {assist1PlayerId: helpers[0].id, assist1PlayerTotal: assistsTodate.get(helpers[0].id)} : {}),
                        ...(helpers[1] ? {assist2PlayerId: helpers[1].id, assist2PlayerTotal: assistsTodate.get(helpers[1].id)} : {}),
                        eventOwnerTeamId: TEAM[team].id,
                        ...(oppGoalieIn ? {goalieInNetId: goalie[opp(team)].id} : {}),
                        awayScore: score[A],
                        homeScore: score[H],
                        awaySOG: sog[A],
                        homeSOG: sog[H],
                        highlightClipSharingUrl: `https://nhl.com/video/goal-${g.id}-${eventId}`,
                        highlightClip: 6362000000000 + eventId,
                        discreteClipId: 6362000000100 + eventId,
                    }, {situationCode: sit});
                    goals.push({t: tt, team, isHome, shooter, helpers, strength, en: !oppGoalieIn, shotType, eventId: play.eventId, homeScore: score[H], awayScore: score[A], situationCode: sit});
                    // Clear the pulled goalie after a goal against the pulling team's opponent? keep it simple.
                    fo(tt);
                } else {
                    const offender = r.pick(skaters[team]);
                    const drawn = r.pick(skaters[opp(team)]);
                    const desc = r.pick(PENALTIES);
                    line(offender.id).pim += 2;
                    teamStat[team].pim += 2;
                    teamStat[opp(team)].ppOpp++;
                    add(tt, 'penalty', 509, {
                        ...coords(team, tt, false), zoneCode: r.pick(['O', 'D', 'N']), typeCode: 'MIN', descKey: desc, duration: 2,
                        committedByPlayerId: offender.id, drawnByPlayerId: drawn.id, eventOwnerTeamId: TEAM[team].id,
                    });
                    penalties.push({t: tt, team, offender, drawn, desc});
                    fo(tt);
                }
                continue;
            }
            if (t >= stop) break;
            // Filler event.
            const team = (r() < 0.5 + (score[A] - score[H]) * 0.03) ? H : A;
            const u = r();
            const shooter = skaters[team][r.int(0, skaters[team].length - 1)];
            if (u < 0.32) {
                sog[team]++;
                line(shooter.id).sog++;
                line(goalie[opp(team)].id).sa++;
                const sit = situation(t);
                const oppGoalieIn = (team === H ? sit[0] : sit[3]) === '1';
                add(t, 'shot-on-goal', 506, {
                    ...coords(team, t, r() < 0.3), zoneCode: 'O', shotType: r.pick(SHOT_TYPES), shootingPlayerId: shooter.id,
                    ...(oppGoalieIn ? {goalieInNetId: goalie[opp(team)].id} : {}), eventOwnerTeamId: TEAM[team].id, awaySOG: sog[A], homeSOG: sog[H],
                });
            } else if (u < 0.47) {
                add(t, 'missed-shot', 507, {...coords(team, t, false), zoneCode: 'O', shotType: r.pick(SHOT_TYPES), shootingPlayerId: shooter.id, reason: r.pick(['wide-of-net', 'high-and-wide', 'hit-crossbar', 'wide-left']), eventOwnerTeamId: TEAM[team].id});
            } else if (u < 0.6) {
                const blocker = r.pick(skaters[opp(team)].filter((s) => s.pos === 'D'));
                line(blocker.id).blockedShots++;
                teamStat[opp(team)].blocks++;
                add(t, 'blocked-shot', 508, {...coords(team, t, false), zoneCode: 'D', blockingPlayerId: blocker.id, shootingPlayerId: shooter.id, eventOwnerTeamId: TEAM[opp(team)].id, reason: 'blocked'});
            } else if (u < 0.78) {
                const hittee = r.pick(skaters[opp(team)]);
                line(shooter.id).hits++;
                teamStat[team].hits++;
                add(t, 'hit', 503, {...coords(team, t, false), zoneCode: r.pick(['O', 'D', 'N']), hittingPlayerId: shooter.id, hitteePlayerId: hittee.id, eventOwnerTeamId: TEAM[team].id});
            } else if (u < 0.84) {
                line(shooter.id).giveaways++;
                teamStat[team].give++;
                add(t, 'giveaway', 504, {...coords(team, t, false), zoneCode: 'D', playerId: shooter.id, eventOwnerTeamId: TEAM[team].id});
            } else if (u < 0.89) {
                line(shooter.id).takeaways++;
                teamStat[team].take++;
                add(t, 'takeaway', 525, {...coords(team, t, false), zoneCode: 'N', playerId: shooter.id, eventOwnerTeamId: TEAM[team].id});
            } else {
                add(t, 'stoppage', 516, {reason: r.pick(['icing', 'offside', 'puck-frozen', 'tv-timeout', 'goalie-stopped-after-sog'])});
                fo(t + 1);
            }
            t += r.int(14, 34);
        }
        if (stop >= start + periodLen(p) || (p === 4 && o.lastPeriodType === 'OT')) {
            add(Math.min(stop, start + periodLen(p)), 'period-end', 521, null, {period: p, inPeriod: p === 4 && o.lastPeriodType === 'OT' ? inPeriod(stop) : periodLen(p), situationCode: situation(Math.min(stop, start + periodLen(p)) - 1)});
        }
    }

    const shootout = [];
    if (o.shootout) {
        let so = {[H]: 0, [A]: 0};
        add(3900, 'period-start', 520, null, {period: 5, inPeriod: 0, situationCode: '1010'});
        o.shootout.forEach((s, i) => {
            const shooter = skaters[s.team][i % 6];
            if (s.goal) so[s.team]++;
            add(3900, s.goal ? 'goal' : 'shot-on-goal', s.goal ? 505 : 506, {
                xCoord: s.team === H ? 74 : -74, yCoord: 0, zoneCode: 'O', shotType: r.pick(SHOT_TYPES),
                [s.goal ? 'scoringPlayerId' : 'shootingPlayerId']: shooter.id, goalieInNetId: goalie[opp(s.team)].id, eventOwnerTeamId: TEAM[s.team].id,
                awayScore: score[A], homeScore: score[H],
            }, {period: 5, inPeriod: 0, situationCode: '1010'});
            shootout.push({sequence: i + 1, player: shooter, team: s.team, goal: s.goal});
        });
        add(3900, 'shootout-complete', 523, null, {period: 5, inPeriod: 0, situationCode: '1010'});
        add(3900, 'period-end', 521, null, {period: 5, inPeriod: 0, situationCode: '1010'});
        const winner = so[H] > so[A] ? H : A;
        score[winner]++;
    }
    if (isDone(g)) {
        const ep = periodOf(o.end - 1);
        add(o.end, 'game-end', 524, null, o.shootout ? {period: 5, inPeriod: 0, situationCode: '1010'} : {period: ep, inPeriod: o.end - (ep <= 3 ? (ep - 1) * 1200 : 3600), situationCode: situation(o.end - 1)});
    }

    const clock = o.clock
        ? {timeRemaining: mmss(o.clock.remaining), secondsRemaining: o.clock.remaining, running: !o.clock.intermission, inIntermission: o.clock.intermission}
        : {timeRemaining: '00:00', secondsRemaining: 0, running: false, inIntermission: false};
    const period = o.clock ? o.clock.period : o.shootout ? 5 : o.lastPeriodType === 'OT' ? 4 : 3;
    return {
        g, o, plays, goals, penalties, shootout, score, sog, stat, teamStat, goalie, clock, period, homeId, awayId, roster,
        lastPeriodType: o.lastPeriodType ?? null, line,
    };
});

/** Final score / outcome for any game (cheap path for score feeds + standings). */
const result = memo((gameId) => {
    const g = GAME_BY_ID.get(Number(gameId));
    if (!isStarted(g)) return null;
    const s = simulate(gameId);
    return {home: s.score[g.home], away: s.score[g.away], homeSog: s.sog[g.home], awaySog: s.sog[g.away], lastPeriodType: s.lastPeriodType, period: s.period, clock: s.clock};
});

/* -------------------------------------------------------------- standings */

const STREAK_CODE = {W: 'W', L: 'L', OTL: 'OT'};

const standingsRows = memo(() => {
    const rows = TEAMS.map((t) => ({t, games: []}));
    const by = Object.fromEntries(rows.map((r) => [r.t.abbrev, r]));
    for (const g of GAMES) {
        if (!isDone(g)) continue;
        const res = result(g.id);
        for (const [abbrev, home] of [[g.home, true], [g.away, false]]) {
            const gf = home ? res.home : res.away;
            const ga = home ? res.away : res.home;
            const outcome = gf > ga ? 'W' : res.lastPeriodType === 'REG' ? 'L' : 'OTL';
            by[abbrev].games.push({home, gf, ga, outcome, type: res.lastPeriodType, date: g.date});
        }
    }
    const out = rows.map(({t, games}) => {
        const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
        const split = (list) => ({
            gp: list.length,
            w: sum(list, (x) => +(x.outcome === 'W')),
            l: sum(list, (x) => +(x.outcome === 'L')),
            otl: sum(list, (x) => +(x.outcome === 'OTL')),
            gf: sum(list, (x) => x.gf),
            ga: sum(list, (x) => x.ga),
            rw: sum(list, (x) => +(x.outcome === 'W' && x.type === 'REG')),
            row: sum(list, (x) => +(x.outcome === 'W' && x.type !== 'SO')),
        });
        const all = split(games);
        const home = split(games.filter((x) => x.home));
        const road = split(games.filter((x) => !x.home));
        const l10 = split(games.slice(-10));
        const pts = (s) => s.w * 2 + s.otl;
        let streakCount = 0;
        const last = games[games.length - 1]?.outcome;
        for (let i = games.length - 1; i >= 0 && games[i].outcome === last; i--) streakCount++;
        const sow = sum(games, (x) => +(x.outcome === 'W' && x.type === 'SO'));
        const sol = sum(games, (x) => +(x.outcome === 'OTL' && x.type === 'SO'));
        return {
            clinchIndicator: undefined,
            conferenceAbbrev: t.conference[0],
            conferenceHomeSequence: 0,
            conferenceL10Sequence: 0,
            conferenceName: t.conference,
            conferenceRoadSequence: 0,
            conferenceSequence: 0,
            date: TODAY,
            divisionAbbrev: DIV_ABBREV[t.division],
            divisionHomeSequence: 0,
            divisionL10Sequence: 0,
            divisionName: t.division,
            divisionRoadSequence: 0,
            divisionSequence: 0,
            gameTypeId: 2,
            gamesPlayed: all.gp,
            goalDifferential: all.gf - all.ga,
            goalDifferentialPctg: all.gp ? round((all.gf - all.ga) / all.gp, 6) : 0,
            goalAgainst: all.ga,
            goalFor: all.gf,
            goalsForPctg: all.gp ? round(all.gf / all.gp, 6) : 0,
            homeDivisionSequence: 0,
            homeGamesPlayed: home.gp,
            homeGoalDifferential: home.gf - home.ga,
            homeGoalsAgainst: home.ga,
            homeGoalsFor: home.gf,
            homeLosses: home.l,
            homeOtLosses: home.otl,
            homePoints: pts(home),
            homeRegulationPlusOtWins: home.row,
            homeRegulationWins: home.rw,
            homeTies: 0,
            homeWins: home.w,
            l10GamesPlayed: l10.gp,
            l10GoalDifferential: l10.gf - l10.ga,
            l10GoalsAgainst: l10.ga,
            l10GoalsFor: l10.gf,
            l10Losses: l10.l,
            l10OtLosses: l10.otl,
            l10Points: pts(l10),
            l10RegulationPlusOtWins: l10.row,
            l10RegulationWins: l10.rw,
            l10Ties: 0,
            l10Wins: l10.w,
            leagueHomeSequence: 0,
            leagueL10Sequence: 0,
            leagueRoadSequence: 0,
            leagueSequence: 0,
            losses: all.l,
            otLosses: all.otl,
            placeName: {default: t.place, ...(t.abbrev === 'MTL' ? {fr: 'Montréal'} : {})},
            pointPctg: all.gp ? round(pts(all) / (2 * all.gp), 6) : 0,
            points: pts(all),
            regulationPlusOtWinPctg: all.gp ? round(all.row / all.gp, 6) : 0,
            regulationPlusOtWins: all.row,
            regulationWinPctg: all.gp ? round(all.rw / all.gp, 6) : 0,
            regulationWins: all.rw,
            roadDivisionSequence: 0,
            roadGamesPlayed: road.gp,
            roadGoalDifferential: road.gf - road.ga,
            roadGoalsAgainst: road.ga,
            roadGoalsFor: road.gf,
            roadLosses: road.l,
            roadOtLosses: road.otl,
            roadPoints: pts(road),
            roadRegulationPlusOtWins: road.row,
            roadRegulationWins: road.rw,
            roadTies: 0,
            roadWins: road.w,
            seasonId: Number(SEASON),
            shootoutLosses: sol,
            shootoutWins: sow,
            streakCode: last ? STREAK_CODE[last] : undefined,
            streakCount: last ? streakCount : 0,
            teamName: {default: t.name, ...(t.abbrev === 'MTL' ? {fr: 'Canadiens de Montréal'} : {})},
            teamCommonName: {default: t.common},
            teamAbbrev: {default: t.abbrev},
            teamLogo: logo(t.abbrev),
            ties: 0,
            waiversSequence: 0,
            wildcardSequence: 0,
            winPctg: all.gp ? round(all.w / all.gp, 6) : 0,
            wins: all.w,
        };
    });
    // Sequences (NHL tie-breaks: points, then fewer GP, then RW, then ROW).
    const cmp = (a, b) => b.points - a.points || a.gamesPlayed - b.gamesPlayed || b.regulationWins - a.regulationWins || b.regulationPlusOtWins - a.regulationPlusOtWins || b.goalDifferential - a.goalDifferential;
    [...out].sort(cmp).forEach((r, i) => {
        r.leagueSequence = i + 1;
    });
    [...out].sort((a, b) => b.l10Points - a.l10Points).forEach((r, i) => {
        r.leagueL10Sequence = i + 1;
    });
    [...out].sort((a, b) => b.homePoints - a.homePoints).forEach((r, i) => {
        r.leagueHomeSequence = i + 1;
    });
    [...out].sort((a, b) => b.roadPoints - a.roadPoints).forEach((r, i) => {
        r.leagueRoadSequence = i + 1;
    });
    for (const conf of ['Eastern', 'Western']) {
        const cRows = out.filter((r) => r.conferenceName === conf).sort(cmp);
        cRows.forEach((r, i) => {
            r.conferenceSequence = i + 1;
        });
        const top3 = new Set();
        for (const div of new Set(cRows.map((r) => r.divisionName))) {
            const dRows = cRows.filter((r) => r.divisionName === div);
            dRows.forEach((r, i) => {
                r.divisionSequence = i + 1;
                if (i < 3) top3.add(r);
            });
        }
        cRows.filter((r) => !top3.has(r)).forEach((r, i) => {
            r.wildcardSequence = i + 1;
        });
    }
    return out.sort(cmp);
});

const recordOf = (abbrev) => {
    const r = standingsRows().find((x) => x.teamAbbrev.default === abbrev);
    return `${r.wins}-${r.losses}-${r.otLosses}`;
};

/* ----------------------------------------------------------- game objects */

function teamRef(abbrev, g, kind, isHome) {
    const t = TEAM[abbrev];
    const res = result(g.id);
    const base = {id: t.id, abbrev, logo: logo(abbrev), darkLogo: logo(abbrev, true)};
    const score = res ? (isHome ? res.home : res.away) : undefined;
    const sog = res ? (isHome ? res.homeSog : res.awaySog) : undefined;
    if (kind === 'score') {
        return {...base, name: d(t.common === 'Mammoth' ? 'Utah' : t.common), commonName: d(t.common), placeName: d(t.place),
            ...(res ? {score, sog} : {record: recordOf(abbrev)})};
    }
    return {
        ...base, commonName: d(t.common), placeName: d(t.place), placeNameWithPreposition: d(`${t.place}`),
        ...(kind === 'landing' ? {name: d(t.name)} : {}),
        radioLink: `https://d2igy0yla8zi0u.cloudfront.net/${abbrev}/20262027/${abbrev}-radio.m3u8`,
        ...(res ? {score, sog} : {}),
        ...(kind === 'schedule' ? {awaySplitSquad: false, homeSplitSquad: false, hotelLink: '', hotelDesc: ''} : {}),
    };
}

function periodDescriptorFor(g) {
    const res = result(g.id);
    if (!res) return {number: 1, periodType: 'REG', maxRegulationPeriods: 3};
    return pdesc(res.period);
}

function gameBase(g, kind) {
    const res = result(g.id);
    const t = TEAM[g.home];
    const out = {
        id: g.id,
        season: g.season,
        gameType: g.gameType,
        gameDate: g.date,
        venue: d(t.venue),
        neutralSite: false,
        startTimeUTC: g.start,
        easternUTCOffset: '-05:00',
        venueUTCOffset: '-05:00',
        venueTimezone: 'America/Toronto',
        gameState: g.state,
        gameScheduleState: g.scheduleState,
        tvBroadcasts: [{id: 281, market: 'N', countryCode: 'CA', network: 'SN', sequenceNumber: 1}, {id: 519, market: 'N', countryCode: 'US', network: 'TNT', sequenceNumber: 2}],
        awayTeam: teamRef(g.away, g, kind, false),
        homeTeam: teamRef(g.home, g, kind, true),
        gameCenterLink: `/gamecenter/${g.away.toLowerCase()}-vs-${g.home.toLowerCase()}/${g.date.replace(/-/g, '/')}/${g.id}`,
    };
    if (res) {
        out.periodDescriptor = periodDescriptorFor(g);
        out.clock = res.clock;
        if (isDone(g)) {
            out.gameOutcome = {lastPeriodType: res.lastPeriodType};
            out.threeMinRecap = `/video/recap-${g.away.toLowerCase()}-at-${g.home.toLowerCase()}-${g.id}`;
            out.condensedGame = `/video/condensed-${g.id}`;
        }
    }
    return out;
}

/* ------------------------------------------------------------------ score */

function scoreGame(g) {
    const out = gameBase(g, 'score');
    const res = result(g.id);
    if (res) {
        out.period = res.period;
        const s = simulate(g.id);
        out.goals = s.goals.map((x) => ({
            period: periodOf(x.t), periodDescriptor: pdesc(periodOf(x.t)), timeInPeriod: mmss(inPeriod(x.t)),
            playerId: x.shooter.id, name: d(`${x.shooter.firstName[0]}. ${x.shooter.lastName}`), firstName: d(x.shooter.firstName), lastName: d(x.shooter.lastName),
            goalModifier: x.en ? 'empty-net' : 'none', assists: x.helpers.map((h) => ({playerId: h.id, name: d(`${h.firstName[0]}. ${h.lastName}`), assistsToDate: 1})),
            mugshot: mug(x.team, x.shooter.id), teamAbbrev: x.team, goalsToDate: 1, awayScore: x.awayScore, homeScore: x.homeScore, strength: x.strength,
        }));
        if (g.state === 'LIVE' || g.state === 'CRIT') {
            const sc = s.plays[s.plays.length - 1]?.situationCode;
            out.situation = situationBlock(s, sc);
        }
    }
    return out;
}

function situationBlock(s, code) {
    if (!code || code === '1551' || s.clock.inIntermission) return undefined;
    const H = s.g.home;
    const A = s.g.away;
    const as = Number(code[1]);
    const hs = Number(code[2]);
    const evenGoalies = code[0] === code[3];
    const desc = (own, other, goalieOut) => [own > other && evenGoalies ? 'PP' : null, goalieOut ? 'EN' : null].filter(Boolean);
    const pen = s.o.penalties.filter((p) => p.t <= s.o.end && p.t + 120 > s.o.end)[0];
    const left = pen ? pen.t + 120 - s.o.end : 0;
    return {
        homeTeam: {abbrev: H, situationDescriptions: desc(hs, as, code[3] === '0'), strength: hs},
        awayTeam: {abbrev: A, situationDescriptions: desc(as, hs, code[0] === '0'), strength: as},
        situationCode: code,
        timeRemaining: mmss(left),
        secondsRemaining: left,
    };
}

function scorePayload(date) {
    const games = gamesOn(date).map(scoreGame);
    const week = [];
    for (let i = -3; i <= 3; i++) {
        const dd = addDaysISO(date, i);
        week.push({date: dd, dayAbbrev: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(`${dd}T12:00:00Z`).getUTCDay()], numberOfGames: gamesOn(dd).length});
    }
    return {prevDate: addDaysISO(date, -1), currentDate: date, nextDate: addDaysISO(date, 1), gameWeek: week, oddsPartners: [], games};
}

/* -------------------------------------------------------------- gamecenter */

function playerName(p) {
    return {firstName: d(p.firstName), lastName: d(p.lastName), name: d(`${p.firstName[0]}. ${p.lastName}`)};
}

function landingPayload(gameId) {
    const g = GAME_BY_ID.get(Number(gameId));
    const out = {...gameBase(g, 'landing'), limitedScoring: false, shootoutInUse: true, maxPeriods: 5, regPeriods: 3, otInUse: true, tiesInUse: false,
        venueLocation: d(TEAM[g.home].place)};
    if (!isStarted(g)) {
        out.periodDescriptor = {number: 1, periodType: 'REG', maxRegulationPeriods: 3};
        out.clock = {timeRemaining: '20:00', secondsRemaining: 1200, running: false, inIntermission: false};
        out.matchup = {
            season: g.season, gameType: 2,
            skaterComparison: {contextLabel: 'last-5-games', contextSeason: g.season, leaders: []},
            goalieComparison: {homeTeam: {leaders: []}, awayTeam: {leaders: []}},
        };
        return out;
    }
    const s = simulate(gameId);
    const byPeriod = new Map();
    s.goals.forEach((x) => {
        const p = periodOf(x.t);
        if (!byPeriod.has(p)) byPeriod.set(p, []);
        byPeriod.get(p).push({
            situationCode: x.situationCode,
            eventId: x.eventId,
            strength: x.strength,
            playerId: x.shooter.id,
            ...playerName(x.shooter),
            teamAbbrev: d(x.team),
            headshot: mug(x.team, x.shooter.id),
            highlightClipSharingUrl: `https://nhl.com/video/goal-${g.id}-${x.eventId}`,
            highlightClip: 6362000000000 + x.eventId,
            discreteClipId: 6362000000100 + x.eventId,
            goalsToDate: 1 + (x.shooter.id % 9),
            awayScore: x.awayScore,
            homeScore: x.homeScore,
            leadingTeamAbbrev: x.homeScore === x.awayScore ? undefined : d(x.homeScore > x.awayScore ? g.home : g.away),
            timeInPeriod: mmss(inPeriod(x.t)),
            shotType: x.shotType,
            goalModifier: x.en ? 'empty-net' : 'none',
            assists: x.helpers.map((h, i) => ({playerId: h.id, ...playerName(h), assistsToDate: 2 + ((h.id + i) % 11), sweaterNumber: h.number})),
            homeTeamDefendingSide: periodOf(x.t) % 2 === 1 ? 'left' : 'right',
            isHome: x.isHome,
        });
    });
    const lastP = s.period;
    const scoring = [];
    for (let p = 1; p <= Math.min(lastP, 4); p++) scoring.push({periodDescriptor: pdesc(p), goals: byPeriod.get(p) ?? []});
    const pens = [];
    for (let p = 1; p <= Math.min(lastP, 4); p++) {
        pens.push({
            periodDescriptor: pdesc(p),
            penalties: s.penalties.filter((x) => periodOf(x.t) === p).map((x) => ({
                timeInPeriod: mmss(inPeriod(x.t)), type: 'MIN', duration: 2,
                committedByPlayer: {firstName: d(x.offender.firstName), lastName: d(x.offender.lastName), sweaterNumber: x.offender.number},
                teamAbbrev: d(x.team), drawnBy: {firstName: d(x.drawn.firstName), lastName: d(x.drawn.lastName), sweaterNumber: x.drawn.number}, descKey: x.desc,
            })),
        });
    }
    // Real-API quirk: one bench minor with only a servedBy name.
    if (pens[0]) {
        pens[0].penalties.push({timeInPeriod: '19:59', type: 'BEN', duration: 2, committedByPlayer: undefined, servedBy: d(`${s.roster[g.away][13].firstName[0]}. ${s.roster[g.away][13].lastName}`), teamAbbrev: d(g.away), descKey: 'too-many-men-on-the-ice'});
    }
    out.summary = {
        scoring,
        shootout: s.shootout.map((x) => ({
            sequence: x.sequence, playerId: x.player.id, teamAbbrev: d(x.team), firstName: d(x.player.firstName), lastName: d(x.player.lastName),
            shotType: 'wrist', result: x.goal ? 'goal' : 'save', headshot: mug(x.team, x.player.id), gameWinner: false,
        })),
        threeStars: isDone(g) ? threeStars(s) : [],
        penalties: pens,
    };
    if (g.state === 'LIVE' || g.state === 'CRIT') {
        const sb = situationBlock(s, s.plays[s.plays.length - 1]?.situationCode);
        if (sb) out.situation = sb;
    }
    return out;
}

function threeStars(s) {
    const ranked = [...s.stat.entries()]
        .map(([id, l]) => ({p: PLAYER_BY_ID.get(id), l, v: l.goals * 3 + l.assists * 2 + l.sog * 0.2 + (l.sa ? (l.sa - l.ga) * 0.08 : 0)}))
        .filter((x) => x.p)
        .sort((a, b) => b.v - a.v)
        .slice(0, 3);
    return ranked.map(({p, l}, i) => ({
        star: i + 1, playerId: p.id, teamAbbrev: p.team, headshot: mug(p.team, p.id), name: d(`${p.firstName[0]}. ${p.lastName}`),
        sweaterNo: p.number, position: p.pos,
        ...(p.pos === 'G' ? {goalsAgainstAverage: round(l.ga, 2), savePctg: l.sa ? round((l.sa - l.ga) / l.sa, 3) : 1} : {goals: l.goals, assists: l.assists, points: l.goals + l.assists}),
    }));
}

function boxscorePayload(gameId) {
    const g = GAME_BY_ID.get(Number(gameId));
    const out = {...gameBase(g, 'box'), regPeriods: 3, limitedScoring: false};
    if (!isStarted(g)) return out;
    const s = simulate(gameId);
    const r = rng(`box-${g.id}`);
    const side = (abbrev) => {
        const sk = skatersOf(abbrev).slice(0, 18);
        const mk = (p) => {
            const l = s.line(p.id);
            const fo = l.fow + l.fol;
            return {
                playerId: p.id, sweaterNumber: p.number, name: d(`${p.firstName[0]}. ${p.lastName}`), position: p.pos,
                goals: l.goals, assists: l.assists, points: l.goals + l.assists, plusMinus: r.int(-2, 2), pim: l.pim, hits: l.hits,
                powerPlayGoals: l.ppg, sog: l.sog, faceoffWinningPctg: fo ? round(l.fow / fo, 6) : 0,
                toi: p.pos === 'D' ? mmss(r.int(15 * 60, 25 * 60)) : mmss(r.int(9 * 60, 21 * 60)),
                blockedShots: l.blockedShots, shifts: r.int(15, 28), giveaways: l.giveaways, takeaways: l.takeaways,
            };
        };
        const gs = goaliesOf(abbrev);
        const starter = s.goalie[abbrev];
        const goalieLine = (p) => {
            const l = s.line(p.id);
            const played = p.id === starter.id;
            const saves = l.sa - l.ga;
            return {
                playerId: p.id, sweaterNumber: p.number, name: d(`${p.firstName[0]}. ${p.lastName}`), position: 'G',
                evenStrengthShotsAgainst: played ? `${Math.max(0, saves - 3)}/${Math.max(0, l.sa - 3)}` : '0/0', powerPlayShotsAgainst: played ? '2/2' : '0/0',
                shorthandedShotsAgainst: played ? '1/1' : '0/0', saveShotsAgainst: `${saves}/${l.sa}`, savePctg: l.sa ? round(saves / l.sa, 6) : undefined,
                evenStrengthGoalsAgainst: l.ga, powerPlayGoalsAgainst: 0, shorthandedGoalsAgainst: 0, pim: 0, goalsAgainst: l.ga,
                toi: played ? mmss(Math.min(s.o.end, 3600) - (s.o.pulls.find((x) => x.team === abbrev) ? 3600 - s.o.pulls.find((x) => x.team === abbrev).t : 0)) : '00:00',
                starter: played, shotsAgainst: l.sa, saves,
                ...(played && isDone(g) ? {decision: (s.score[abbrev] > s.score[abbrev === g.home ? g.away : g.home]) ? 'W' : 'L'} : {}),
            };
        };
        return {
            forwards: sk.filter((p) => p.pos !== 'D').map(mk),
            defense: sk.filter((p) => p.pos === 'D').map(mk),
            goalies: gs.slice(0, 2).map(goalieLine),
        };
    };
    out.playerByGameStats = {awayTeam: side(g.away), homeTeam: side(g.home)};
    if (isDone(g)) out.gameOutcome = {lastPeriodType: s.lastPeriodType};
    return out;
}

function pbpPayload(gameId) {
    const g = GAME_BY_ID.get(Number(gameId));
    const out = {...gameBase(g, 'pbp'), shootoutInUse: true, otInUse: true, maxPeriods: 5, regPeriods: 3, displayPeriod: 1, plays: [], rosterSpots: [], summary: {}};
    if (!isStarted(g)) return out;
    const s = simulate(gameId);
    out.displayPeriod = s.period;
    out.plays = s.plays;
    out.rosterSpots = [g.home, g.away].flatMap((abbrev) => ROSTERS[abbrev].slice(0, 20).concat(goaliesOf(abbrev).slice(0, 2)).filter((p, i, a) => a.indexOf(p) === i).map((p) => ({
        teamId: TEAM[abbrev].id, playerId: p.id, firstName: d(p.firstName), lastName: d(p.lastName), sweaterNumber: p.number, positionCode: p.pos, headshot: mug(abbrev, p.id),
    })));
    return out;
}

function rightRailPayload(gameId) {
    const g = GAME_BY_ID.get(Number(gameId));
    const series = GAMES.filter((x) => ((x.home === g.home && x.away === g.away) || (x.home === g.away && x.away === g.home)));
    const H = g.home;
    const A = g.away;
    let hw = 0;
    let aw = 0;
    series.filter(isDone).forEach((x) => {
        const res = result(x.id);
        const winner = res.home > res.away ? x.home : x.away;
        if (winner === H) hw++;
        else aw++;
    });
    const coach = (abbrev) => d(`${rng(`coach-${abbrev}`).pick(['Craig', 'Jim', 'Rod', 'Paul', 'Spencer', 'Lindy'])} ${rng(`coach2-${abbrev}`).pick(['Berube', 'Montgomery', 'Brind’Amour', 'Maurice', 'Carbery', 'Ruff'])}`);
    const out = {
        seasonSeries: series.map((x) => ({...gameBase(x, 'score'), period: result(x.id)?.period})),
        seasonSeriesWins: {awayTeamWins: aw, homeTeamWins: hw, neededToWin: undefined},
        gameInfo: {
            referees: [d('Wes McCauley'), d('Chris Rooney')],
            linesmen: [d('Steve Barton'), d('Jonny Murray')],
            awayTeam: {headCoach: coach(A), scratches: ROSTERS[A].slice(19, 21).map((p) => ({id: p.id, firstName: d(p.firstName), lastName: d(p.lastName)}))},
            homeTeam: {headCoach: coach(H), scratches: ROSTERS[H].slice(20, 21).map((p) => ({id: p.id, firstName: d(p.firstName), lastName: d(p.lastName)}))},
        },
        gameVideo: isDone(g) ? {threeMinRecap: 6362000001000 + (g.id % 1000), condensedGame: 6362000002000 + (g.id % 1000)} : undefined,
    };
    if (!isStarted(g)) return out;
    const s = simulate(gameId);
    const per = [];
    for (let p = 1; p <= Math.min(s.period, 4); p++) {
        const shots = (team) => s.plays.filter((x) => x.periodDescriptor.number === p && (x.typeDescKey === 'shot-on-goal' || x.typeDescKey === 'goal') && x.details?.eventOwnerTeamId === TEAM[team].id).length;
        const goals = (team) => s.goals.filter((x) => periodOf(x.t) === p && x.team === team).length;
        per.push({p, sh: shots(H), sa: shots(A), gh: goals(H), ga: goals(A)});
    }
    out.linescore = {
        byPeriod: per.map((x) => ({periodDescriptor: pdesc(x.p), away: x.ga, home: x.gh})),
        totals: {away: s.score[A], home: s.score[H]},
    };
    out.shotsByPeriod = per.map((x) => ({periodDescriptor: pdesc(x.p), away: x.sa, home: x.sh}));
    const ts = s.teamStat;
    const totalFo = ts[H].fow + ts[A].fow || 1;
    out.teamGameStats = [
        {category: 'sog', awayValue: s.sog[A], homeValue: s.sog[H]},
        {category: 'faceoffWinningPctg', awayValue: round(ts[A].fow / totalFo, 6), homeValue: round(ts[H].fow / totalFo, 6)},
        {category: 'powerPlay', awayValue: `${ts[A].ppGoals}/${ts[A].ppOpp}`, homeValue: `${ts[H].ppGoals}/${ts[H].ppOpp}`},
        {category: 'powerPlayPctg', awayValue: ts[A].ppOpp ? round(ts[A].ppGoals / ts[A].ppOpp, 6) : 0, homeValue: ts[H].ppOpp ? round(ts[H].ppGoals / ts[H].ppOpp, 6) : 0},
        {category: 'pim', awayValue: ts[A].pim + 2, homeValue: ts[H].pim},
        {category: 'hits', awayValue: ts[A].hits, homeValue: ts[H].hits},
        {category: 'blockedShots', awayValue: ts[A].blocks, homeValue: ts[H].blocks},
        {category: 'giveaways', awayValue: ts[A].give, homeValue: ts[H].give},
        {category: 'takeaways', awayValue: ts[A].take, homeValue: ts[H].take},
    ];
    return out;
}

/* --------------------------------------------------------- club schedules */

function scheduleGame(g) {
    const out = gameBase(g, 'schedule');
    out.winningGoalie = undefined;
    if (isDone(g)) {
        const s = simulate(g.id);
        const winner = s.score[g.home] > s.score[g.away] ? g.home : g.away;
        const wg = s.goalie[winner];
        out.winningGoalie = {playerId: wg.id, firstInitial: d(`${wg.firstName[0]}.`), lastName: d(wg.lastName)};
        const gw = s.goals.filter((x) => x.team === winner)[Math.min(s.score[winner === g.home ? g.away : g.home], s.goals.filter((x) => x.team === winner).length - 1)];
        if (gw) out.winningGoalScorer = {playerId: gw.shooter.id, firstInitial: d(`${gw.shooter.firstName[0]}.`), lastName: d(gw.shooter.lastName)};
    }
    return out;
}

function weekStart(date) {
    const day = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    return addDaysISO(date, -((day + 6) % 7));
}

function clubWeekPayload(abbrev) {
    const start = weekStart(TODAY);
    const end = addDaysISO(start, 6);
    const games = teamGames(abbrev).filter((g) => g.date >= start && g.date <= end).map(scheduleGame);
    return {previousStartDate: addDaysISO(start, -7), nextStartDate: addDaysISO(start, 7), calendarUrl: `${abbrev.toLowerCase()}.ics`, clubTimezone: 'America/Toronto', clubUTCOffset: '-05:00', games};
}

function clubSeasonPayload(abbrev) {
    return {previousSeason: Number(PREV_SEASON), currentSeason: Number(SEASON), clubTimezone: 'America/Toronto', clubUTCOffset: '-05:00', games: teamGames(abbrev).map(scheduleGame)};
}

function rosterPayload(abbrev) {
    const mk = (p) => ({
        id: p.id, headshot: mug(abbrev, p.id), firstName: d(p.firstName), lastName: d(p.lastName), sweaterNumber: p.number, positionCode: p.pos,
        shootsCatches: p.shoots, heightInInches: p.heightIn, weightInPounds: p.weightLb, heightInCentimeters: Math.round(p.heightIn * 2.54),
        weightInKilograms: Math.round(p.weightLb * 0.4536), birthDate: p.birthDate, birthCity: d(p.city), birthCountry: p.country,
        ...(p.prov ? {birthStateProvince: d(p.prov)} : {}),
    });
    const list = ROSTERS[abbrev];
    return {forwards: list.filter((p) => p.slot < 14).map(mk), defensemen: list.filter((p) => p.pos === 'D').map(mk), goalies: list.filter((p) => p.pos === 'G').map(mk)};
}

/* -------------------------------------------------------------- game logs */

/** Current-season per-game lines for a player, newest first (real API order). */
const currentLog = memo((playerId) => {
    const p = PLAYER_BY_ID.get(Number(playerId));
    if (!p) return [];
    const out = [];
    for (const g of teamGames(p.team).filter(isDone)) {
        const s = simulate(g.id);
        const home = g.home === p.team;
        const oppAbbrev = home ? g.away : g.home;
        const base = {gameId: g.id, teamAbbrev: p.team, homeRoadFlag: home ? 'H' : 'R', gameDate: g.date, opponentAbbrev: oppAbbrev,
            commonName: d(TEAM[p.team].common), opponentCommonName: d(TEAM[oppAbbrev].common)};
        if (p.pos === 'G') {
            if (s.goalie[p.team].id !== p.id) continue;
            const l = s.line(p.id);
            const won = s.score[p.team] > s.score[oppAbbrev];
            out.push({...base, gamesStarted: 1, decision: won ? 'W' : s.lastPeriodType === 'REG' ? 'L' : 'O', shotsAgainst: l.sa, goalsAgainst: l.ga,
                savePctg: l.sa ? round((l.sa - l.ga) / l.sa, 6) : 0, shutouts: l.ga === 0 && won ? 1 : 0, goals: 0, assists: 0, pim: 0, toi: mmss(Math.min(s.o.end, 3900))});
        } else {
            if (p.slot > 19) continue; // healthy scratches
            const l = s.line(p.id);
            const r = rng(`log-${p.id}-${g.id}`);
            out.push({...base, goals: l.goals, assists: l.assists, points: l.goals + l.assists, plusMinus: r.int(-2, 2), powerPlayGoals: l.ppg, powerPlayPoints: l.ppg + (r() < 0.1 ? 1 : 0),
                gameWinningGoals: 0, otGoals: 0, shots: l.sog, shifts: r.int(15, 28), shorthandedGoals: 0, shorthandedPoints: 0, pim: l.pim,
                toi: p.pos === 'D' ? mmss(r.int(15 * 60, 25 * 60)) : mmss(r.int(9 * 60, 21 * 60))});
        }
    }
    return out.reverse();
});

/** A synthetic full previous-season log (82 GP-ish), newest first. */
const pastLog = memo((playerId, season) => {
    const p = PLAYER_BY_ID.get(Number(playerId));
    if (!p) return [];
    const r = rng(`past-${playerId}-${season}`);
    const y = Number(String(season).slice(0, 4));
    const n = p.pos === 'G' ? r.int(30, 58) : r.int(60, 82);
    const out = [];
    for (let i = 0; i < n; i++) {
        const date = addDaysISO(`${y}-10-08`, Math.floor(i * (185 / n)));
        const opp = r.pick(TEAMS.filter((t) => t.abbrev !== p.team)).abbrev;
        const base = {gameId: Number(`${y}02${String(i + 1).padStart(4, '0')}`), teamAbbrev: p.team, homeRoadFlag: r() < 0.5 ? 'H' : 'R', gameDate: date, opponentAbbrev: opp,
            commonName: d(TEAM[p.team].common), opponentCommonName: d(TEAM[opp].common)};
        if (p.pos === 'G') {
            const sa = r.int(20, 40);
            const ga = Math.min(sa, r.poisson(sa * (1 - p.svTalent)));
            const won = r() < 0.55 - ga * 0.06;
            out.push({...base, gamesStarted: 1, decision: won ? 'W' : r() < 0.75 ? 'L' : 'O', shotsAgainst: sa, goalsAgainst: ga, savePctg: round((sa - ga) / sa, 6), shutouts: ga === 0 ? 1 : 0, goals: 0, assists: 0, pim: 0, toi: '60:00'});
        } else {
            const goals = r.poisson(p.gRate);
            const assists = r.poisson(p.aRate);
            out.push({...base, goals, assists, points: goals + assists, plusMinus: r.int(-2, 2), powerPlayGoals: goals && r() < 0.3 ? 1 : 0, powerPlayPoints: r() < 0.2 ? 1 : 0,
                gameWinningGoals: goals && r() < 0.2 ? 1 : 0, otGoals: 0, shots: goals + r.poisson(2), shifts: r.int(15, 28), shorthandedGoals: 0, shorthandedPoints: 0,
                pim: r() < 0.15 ? 2 : 0, toi: p.pos === 'D' ? mmss(r.int(15 * 60, 25 * 60)) : mmss(r.int(10 * 60, 21 * 60))});
        }
    }
    return out.reverse();
});

const logFor = (playerId, season) => (String(season) === SEASON ? currentLog(playerId) : pastLog(playerId, season));

function totalsFromLog(p, log) {
    const s = (k) => log.reduce((a, x) => a + (x[k] ?? 0), 0);
    if (p.pos === 'G') {
        const sa = s('shotsAgainst');
        const ga = s('goalsAgainst');
        return {gamesPlayed: log.length, gamesStarted: log.length, wins: log.filter((x) => x.decision === 'W').length, losses: log.filter((x) => x.decision === 'L').length,
            otLosses: log.filter((x) => x.decision === 'O').length, shotsAgainst: sa, goalsAgainst: ga, savePctg: sa ? round((sa - ga) / sa, 6) : 0,
            goalsAgainstAvg: log.length ? round(ga / log.length, 6) : 0, shutouts: s('shutouts'), goals: 0, assists: s('assists'), pim: 0, timeOnIce: `${log.length * 60}:00`};
    }
    const shots = s('shots');
    const goals = s('goals');
    const toi = log.reduce((a, x) => a + Number(x.toi.split(':')[0]) * 60 + Number(x.toi.split(':')[1]), 0);
    return {gamesPlayed: log.length, goals, assists: s('assists'), points: s('points'), plusMinus: s('plusMinus'), pim: s('pim'), shots, powerPlayGoals: s('powerPlayGoals'),
        powerPlayPoints: s('powerPlayPoints'), shorthandedGoals: 0, shorthandedPoints: 0, gameWinningGoals: s('gameWinningGoals'), otGoals: 0,
        shootingPctg: shots ? round(goals / shots, 6) : 0, avgToi: log.length ? mmss(toi / log.length) : '00:00', faceoffWinningPctg: p.pos === 'C' ? 0.51 : 0};
}

function seasonList(p) {
    const out = [];
    for (let k = 1; k <= p.seasonsBack; k++) {
        const y = 2026 - k;
        out.push(`${y}${y + 1}`);
    }
    return out;
}

function landingTotals(p) {
    const rows = [];
    let seq = 1;
    const juniorYear = 2026 - p.seasonsBack - 1;
    rows.push({season: Number(`${juniorYear}${juniorYear + 1}`), gameTypeId: 2, leagueAbbrev: p.country === 'CAN' ? 'OHL' : p.country === 'USA' ? 'NCAA' : 'SHL',
        teamName: d(p.country === 'CAN' ? 'London Knights' : p.country === 'USA' ? 'Boston University' : 'Frölunda HC'), sequence: seq++, gamesPlayed: 60, goals: 28, assists: 35, points: 63, pim: 20});
    for (const season of seasonList(p).reverse()) {
        const log = pastLog(p.id, season);
        const tot = totalsFromLog(p, log);
        const team = TEAM[p.team];
        if (p.slot === 0 && season === PREV_SEASON) {
            // Traded mid-season: one row per team.
            const half = Math.floor(log.length / 2);
            const other = TEAMS[(team.index + 5) % 32];
            rows.push({season: Number(season), gameTypeId: 2, leagueAbbrev: 'NHL', teamName: d(other.name), teamCommonName: d(other.common), sequence: seq++, ...totalsFromLog(p, log.slice(half))});
            rows.push({season: Number(season), gameTypeId: 2, leagueAbbrev: 'NHL', teamName: d(team.name), teamCommonName: d(team.common), sequence: seq++, ...totalsFromLog(p, log.slice(0, half))});
        } else {
            rows.push({season: Number(season), gameTypeId: 2, leagueAbbrev: 'NHL', teamName: d(team.name), teamCommonName: d(team.common), sequence: seq++, ...tot});
        }
        if (p.slot % 4 === 0) {
            rows.push({season: Number(season), gameTypeId: 3, leagueAbbrev: 'NHL', teamName: d(team.name), teamCommonName: d(team.common), sequence: seq++, ...totalsFromLog(p, log.slice(0, 7))});
        }
    }
    const cur = currentLog(p.id);
    if (cur.length) {
        rows.push({season: Number(SEASON), gameTypeId: 2, leagueAbbrev: 'NHL', teamName: d(TEAM[p.team].name), teamCommonName: d(TEAM[p.team].common), sequence: seq++, ...totalsFromLog(p, cur)});
    }
    return rows;
}

function sumRows(p, rows) {
    const keys = ['gamesPlayed', 'goals', 'assists', 'points', 'plusMinus', 'pim', 'shots', 'powerPlayGoals', 'powerPlayPoints', 'shorthandedGoals', 'shorthandedPoints',
        'gameWinningGoals', 'otGoals', 'wins', 'losses', 'otLosses', 'shutouts', 'shotsAgainst', 'goalsAgainst', 'gamesStarted'];
    const out = {};
    for (const k of keys) {
        const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number');
        if (v.length) out[k] = v.reduce((a, b) => a + b, 0);
    }
    if (p.pos === 'G') {
        out.savePctg = out.shotsAgainst ? round((out.shotsAgainst - out.goalsAgainst) / out.shotsAgainst, 6) : 0;
        out.goalsAgainstAvg = out.gamesPlayed ? round(out.goalsAgainst / out.gamesPlayed, 6) : 0;
        out.timeOnIce = `${(out.gamesPlayed ?? 0) * 60}:00`;
    } else {
        out.shootingPctg = out.shots ? round(out.goals / out.shots, 6) : 0;
        out.avgToi = '17:42';
        out.faceoffWinningPctg = 0.5;
    }
    return out;
}

function playerLandingPayload(playerId) {
    const p = PLAYER_BY_ID.get(Number(playerId));
    if (!p) return null;
    const team = TEAM[p.team];
    const totals = landingTotals(p);
    const nhlReg = totals.filter((r) => r.leagueAbbrev === 'NHL' && r.gameTypeId === 2);
    const nhlPo = totals.filter((r) => r.leagueAbbrev === 'NHL' && r.gameTypeId === 3);
    const cur = totals.find((r) => String(r.season) === SEASON && r.gameTypeId === 2);
    const careerReg = sumRows(p, nhlReg);
    const draft = p.drafted ? {...p.drafted, overallPick: (p.drafted.round - 1) * 32 + p.drafted.pickInRound} : undefined;
    return {
        playerId: p.id, isActive: true, currentTeamId: team.id, currentTeamAbbrev: p.team, fullTeamName: d(team.name), teamCommonName: d(team.common),
        teamPlaceNameWithPreposition: d(team.place), firstName: d(p.firstName), lastName: d(p.lastName), teamLogo: logo(p.team), sweaterNumber: p.number,
        position: p.pos, headshot: mug(p.team, p.id), heroImage: `https://assets.nhle.com/mugs/actionshots/1296x729/${p.id}.jpg`,
        heightInInches: p.heightIn, heightInCentimeters: Math.round(p.heightIn * 2.54), weightInPounds: p.weightLb, weightInKilograms: Math.round(p.weightLb * 0.4536),
        birthDate: p.birthDate, birthCity: d(p.city), ...(p.prov ? {birthStateProvince: d(p.prov)} : {}), birthCountry: p.country, shootsCatches: p.shoots,
        ...(draft ? {draftDetails: draft} : {}),
        playerSlug: `${p.firstName}-${p.lastName}-${p.id}`.toLowerCase(), inTop100AllTime: 0, inHHOF: 0,
        featuredStats: {season: Number(SEASON), regularSeason: {subSeason: cur ? sumRows(p, [cur]) : undefined, career: careerReg}},
        careerTotals: {regularSeason: careerReg, playoffs: sumRows(p, nhlPo)},
        shopLink: '', twitterLink: '', watchLink: '',
        last5Games: currentLog(p.id).slice(0, 5).map((x) => ({...x, gameTypeId: 2})),
        seasonTotals: totals,
        awards: p.slot === 0 ? [{trophy: d('Rocket Richard Trophy'), seasons: [{seasonId: Number(PREV_SEASON), gamesPlayed: 82, goals: 52}]}] : undefined,
        currentTeamRoster: ROSTERS[p.team].slice(0, 6).map((x) => ({playerId: x.id, lastName: d(x.lastName), firstName: d(x.firstName), playerSlug: `${x.firstName}-${x.lastName}`.toLowerCase()})),
    };
}

function gameLogPayload(playerId, season, gameType) {
    const p = PLAYER_BY_ID.get(Number(playerId));
    if (!p) return null;
    if (String(gameType) !== '2') return {seasonId: Number(season), gameTypeId: Number(gameType), playerStatsSeasons: [], gameLog: []};
    const seasons = [SEASON, ...seasonList(p)];
    if (!seasons.includes(String(season))) return null; // 404 like the real API
    return {
        seasonId: Number(season), gameTypeId: 2,
        playerStatsSeasons: seasons.map((s) => ({season: Number(s), gameTypes: [2, 3]})),
        gameLog: logFor(playerId, season),
    };
}

function clubStatsPayload(abbrev) {
    const skaters = skatersOf(abbrev).map((p) => {
        const t = totalsFromLog(p, currentLog(p.id));
        return {playerId: p.id, headshot: mug(abbrev, p.id), firstName: d(p.firstName), lastName: d(p.lastName), positionCode: p.pos, gamesPlayed: t.gamesPlayed,
            goals: t.goals, assists: t.assists, points: t.points, plusMinus: t.plusMinus, penaltyMinutes: t.pim, powerPlayGoals: t.powerPlayGoals, shorthandedGoals: 0,
            gameWinningGoals: t.gameWinningGoals, overtimeGoals: 0, shots: t.shots, shootingPctg: t.shootingPctg, avgTimeOnIcePerGame: 1062.4, avgShiftsPerGame: 21.3,
            faceoffWinPctg: t.faceoffWinningPctg};
    }).filter((x) => x.gamesPlayed > 0);
    const goalies = goaliesOf(abbrev).map((p) => {
        const t = totalsFromLog(p, currentLog(p.id));
        return {playerId: p.id, headshot: mug(abbrev, p.id), firstName: d(p.firstName), lastName: d(p.lastName), gamesPlayed: t.gamesPlayed, gamesStarted: t.gamesStarted,
            wins: t.wins, losses: t.losses, overtimeLosses: t.otLosses, goalsAgainstAverage: t.goalsAgainstAvg, savePercentage: t.savePctg, shotsAgainst: t.shotsAgainst,
            saves: t.shotsAgainst - t.goalsAgainst, goalsAgainst: t.goalsAgainst, shutouts: t.shutouts, goals: 0, assists: 0, points: 0, penaltyMinutes: 0, timeOnIce: t.gamesPlayed * 3600};
    }).filter((x) => x.gamesPlayed > 0);
    return {season: SEASON, gameType: 2, skaters, goalies};
}

/* ------------------------------------------------------------ stats/rest */

const skaterSummary = memo((season) => Object.values(ROSTERS).flat().filter((p) => p.pos !== 'G').map((p) => {
    const t = totalsFromLog(p, logFor(p.id, season));
    if (!t.gamesPlayed) return null;
    const toiSec = Number(t.avgToi.split(':')[0]) * 60 + Number(t.avgToi.split(':')[1]);
    const teamAbbrevs = p.slot === 0 && season === PREV_SEASON ? `${TEAMS[(TEAM[p.team].index + 5) % 32].abbrev},${p.team}` : p.team;
    return {
        playerId: p.id, skaterFullName: fullName(p), lastName: p.lastName, teamAbbrevs, positionCode: p.pos, shootsCatches: p.shoots, seasonId: Number(season),
        gamesPlayed: t.gamesPlayed, goals: t.goals, assists: t.assists, points: t.points, plusMinus: t.plusMinus, pointsPerGame: round(t.points / t.gamesPlayed, 6),
        shots: t.shots, shootingPct: t.shots ? round(t.goals / t.shots, 6) : null, ppGoals: t.powerPlayGoals, ppPoints: t.powerPlayPoints, shGoals: 0, shPoints: 0,
        penaltyMinutes: t.pim, timeOnIcePerGame: round(toiSec, 4), faceoffWinPct: p.pos === 'C' ? 0.512 : null, gameWinningGoals: t.gameWinningGoals,
        otGoals: 0, evGoals: t.goals - t.powerPlayGoals, evPoints: t.points - t.powerPlayPoints,
    };
}).filter(Boolean));

const goalieSummary = memo((season) => Object.values(ROSTERS).flat().filter((p) => p.pos === 'G').map((p) => {
    const t = totalsFromLog(p, logFor(p.id, season));
    if (!t.gamesPlayed) return null;
    return {
        playerId: p.id, goalieFullName: fullName(p), lastName: p.lastName, teamAbbrevs: p.team, shootsCatches: p.shoots, seasonId: Number(season),
        gamesPlayed: t.gamesPlayed, gamesStarted: t.gamesStarted, wins: t.wins, losses: t.losses, otLosses: t.otLosses, ties: null,
        savePct: t.savePctg, goalsAgainstAverage: round(t.goalsAgainst / t.gamesPlayed, 6), shutouts: t.shutouts, shotsAgainst: t.shotsAgainst,
        saves: t.shotsAgainst - t.goalsAgainst, goalsAgainst: t.goalsAgainst, goals: 0, assists: p.slot === 22 ? 1 : 0, points: p.slot === 22 ? 1 : 0,
        penaltyMinutes: 0, timeOnIce: t.gamesPlayed * 3600,
    };
}).filter(Boolean));

const teamSummary = memo((season) => standingsRows().map((r) => {
    const t = TEAM[r.teamAbbrev.default];
    const rr = rng(`teamsum-${t.abbrev}-${season}`);
    const gp = season === SEASON ? r.gamesPlayed : 82;
    const gf = season === SEASON ? r.goalFor : Math.round(t.gf * 82);
    const ga = season === SEASON ? r.goalAgainst : Math.round(t.ga * 82);
    const sf = 26 + rr() * 8;
    const sa = 26 + rr() * 8;
    return {
        teamId: t.id, teamFullName: t.name, seasonId: Number(season), gamesPlayed: gp, wins: r.wins, losses: r.losses, otLosses: r.otLosses, ties: null,
        points: r.points, pointPct: r.pointPctg, regulationAndOtWins: r.regulationPlusOtWins, winsInRegulation: r.regulationWins, winsInShootout: r.shootoutWins,
        goalsFor: gf, goalsAgainst: ga, goalsForPerGame: gp ? round(gf / gp, 6) : 0, goalsAgainstPerGame: gp ? round(ga / gp, 6) : 0,
        shotsForPerGame: round(sf, 6), shotsAgainstPerGame: round(sa, 6), powerPlayPct: round(0.14 + rr() * 0.16, 6), penaltyKillPct: round(0.72 + rr() * 0.14, 6),
        powerPlayNetPct: round(0.12 + rr() * 0.16, 6), penaltyKillNetPct: round(0.76 + rr() * 0.14, 6), faceoffWinPct: round(0.46 + rr() * 0.08, 6),
    };
}));

function statsRest(url) {
    const u = new URL(url);
    const m = u.pathname.match(/\/stats\/rest\/en\/(skater|goalie|team)\/summary$/);
    if (!m) return null;
    const kind = m[1];
    const q = u.searchParams;
    const cay = q.get('cayenneExp') ?? '';
    const season = (cay.match(/seasonId<=(\d{8})/) ?? [])[1] ?? SEASON;
    const like = (cay.match(/likeIgnoreCase "%([^"]*)%"/) ?? [])[1];
    const minGp = Number((q.get('factCayenneExp') ?? '').match(/gamesPlayed>=(\d+)/)?.[1] ?? 1);
    let rows = kind === 'skater' ? skaterSummary(season) : kind === 'goalie' ? goalieSummary(season) : teamSummary(season);
    rows = rows.filter((r) => (r.gamesPlayed ?? 0) >= minGp);
    if (like) {
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const key = kind === 'skater' ? 'skaterFullName' : 'goalieFullName';
        rows = rows.filter((r) => norm(r[key]).includes(norm(like)));
    }
    let sort = [];
    try {
        sort = JSON.parse(q.get('sort') ?? '[]');
    } catch {
        sort = [];
    }
    rows = [...rows].sort((a, b) => {
        for (const s of sort) {
            const av = a[s.property] ?? -Infinity;
            const bv = b[s.property] ?? -Infinity;
            if (av !== bv) return (av < bv ? -1 : 1) * (s.direction === 'ASC' ? 1 : -1);
        }
        return 0;
    });
    const start = Number(q.get('start') ?? 0);
    const limit = Number(q.get('limit') ?? 50);
    return {data: limit < 0 ? rows : rows.slice(start, start + limit), total: rows.length};
}

/* --------------------------------------------------------------- moneypuck */

function toCSV(rows, columns) {
    const cols = columns ?? Object.keys(rows[0] ?? {});
    const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

const mpCode = (abbrev) => MP_CODES[abbrev] ?? abbrev;
const fromMpCode = (code) => Object.entries(MP_CODES).find(([, v]) => v === code)?.[0] ?? code;
const logistic = (x) => 1 / (1 + Math.exp(-x));

function preGameHomeProb(g) {
    const h = TEAM[g.home];
    const a = TEAM[g.away];
    return round(logistic(0.12 + (h.gf - h.ga - (a.gf - a.ga)) * 0.6), 4);
}

function mpPrediction(gameId) {
    const g = GAME_BY_ID.get(Number(gameId));
    if (!g) return null;
    const p = preGameHomeProb(g);
    return toCSV([
        {gameID: g.id, homeTeamCode: mpCode(g.home), roadTeamCode: mpCode(g.away), preGameHomeTeamWinOverallScore: round(p - 0.01, 4), preGameMoneyPuckHomeWinPrediction: round(p - 0.01, 4), preGameBettingOddsHomeWin: round(p + 0.02, 4), date: g.date.replace(/-/g, '')},
        {gameID: g.id, homeTeamCode: mpCode(g.home), roadTeamCode: mpCode(g.away), preGameHomeTeamWinOverallScore: p, preGameMoneyPuckHomeWinPrediction: p, preGameBettingOddsHomeWin: round(p + 0.01, 4), date: g.date.replace(/-/g, '')},
    ]);
}

const MP_EVENT = {'shot-on-goal': 'SHOT', 'missed-shot': 'MISS', 'blocked-shot': 'BLOCK', goal: 'GOAL', faceoff: 'FAC', hit: 'HIT', penalty: 'PENL', giveaway: 'GIVE', takeaway: 'TAKE', stoppage: 'STOP'};

function mpGameData(gameId) {
    const g = GAME_BY_ID.get(Number(gameId));
    if (!g || !isStarted(g)) return null;
    const s = simulate(gameId);
    const pre = preGameHomeProb(g);
    let hs = 0;
    let as = 0;
    const rows = [];
    for (const p of s.plays) {
        const ev = MP_EVENT[p.typeDescKey];
        if (!ev) continue;
        const per = p.periodDescriptor.number;
        if (per >= 5) continue;
        const [m, sec] = p.timeInPeriod.split(':').map(Number);
        const t = (per - 1) * 1200 + m * 60 + sec;
        if (ev === 'GOAL') {
            hs = p.details.homeScore;
            as = p.details.awayScore;
        }
        const left = Math.max(1, 3600 - t);
        const x = Math.log(pre / (1 - pre)) * (left / 3600) + (hs - as) * (1.1 + 2.2 * (1 - left / 3600));
        const owner = p.details?.eventOwnerTeamId === s.homeId ? 'HOME' : 'AWAY';
        rows.push({
            gameId: g.id, id: p.eventId, period: per, time: t, event: ev, team: owner, homeTeamCode: mpCode(g.home), awayTeamCode: mpCode(g.away),
            homeTeamGoals: hs, awayTeamGoals: as, homeSkatersOnIce: Number(p.situationCode[2]), awaySkatersOnIce: Number(p.situationCode[1]),
            xGoal: ev === 'SHOT' || ev === 'MISS' || ev === 'GOAL' ? round(0.02 + (rng(`xg-${p.eventId}-${g.id}`)() ** 2) * 0.3, 4) : '',
            homeWinProbability: per === 4 && t >= 3600 ? round(logistic((hs - as) * 3 + 0.05), 4) : round(logistic(x), 4),
        });
    }
    if (isDone(g)) {
        rows.push({...rows[rows.length - 1], event: 'GEND', time: Math.min(s.o.end, 3900), homeWinProbability: s.score[g.home] > s.score[g.away] ? 1 : 0, xGoal: ''});
    }
    return toCSV(rows);
}

function mpStartingGoalie(gameId, side) {
    const g = GAME_BY_ID.get(Number(gameId));
    if (!g || isStarted(g)) return null;
    // Confirmed for the home side of the PRE game, nothing announced for some others.
    if (g.id !== GAME_IDS.pre && side === 'A' && g.id % 2 === 0) return null;
    const abbrev = side === 'H' ? g.home : g.away;
    const gk = goaliesOf(abbrev)[0];
    return toCSV([{gameId: g.id, team: mpCode(abbrev), goalie_id: gk.id, goalie_name: fullName(gk), handle: side === 'H' ? '@DailyFaceoff' : '', confirmed: side === 'H' ? 1 : 0, date: g.date.replace(/-/g, '')}]);
}

const MP_SITUATIONS = ['other', 'all', '5on5', '4on5', '5on4'];

function mpGoalieSeason(year) {
    const season = year === MP_YEAR ? SEASON : `${year}${Number(year) + 1}`;
    const rows = [];
    for (const p of Object.values(ROSTERS).flat().filter((x) => x.pos === 'G')) {
        const t = totalsFromLog(p, logFor(p.id, season));
        if (!t.gamesPlayed) continue;
        const r = rng(`mpg-${p.id}-${year}`);
        for (const sit of MP_SITUATIONS) {
            const frac = sit === 'all' ? 1 : sit === '5on5' ? 0.78 : sit === 'other' ? 0.02 : 0.1;
            const ongoal = Math.round(t.shotsAgainst * frac);
            const goals = Math.round(t.goalsAgainst * frac);
            rows.push({playerId: p.id, season: Number(year), name: fullName(p), team: mpCode(p.team), position: 'G', situation: sit, games_played: t.gamesPlayed,
                icetime: Math.round(t.gamesPlayed * 3600 * frac), xGoals: round(goals * (0.9 + r() * 0.3), 2), goals, unblocked_shot_attempts: Math.round(ongoal * 1.35),
                xRebounds: round(ongoal * 0.06, 2), rebounds: Math.round(ongoal * 0.05), ongoal, xOnGoal: round(ongoal * 0.98, 2), lowDangerShots: Math.round(ongoal * 0.6),
                mediumDangerShots: Math.round(ongoal * 0.28), highDangerShots: Math.round(ongoal * 0.12), lowDangerGoals: Math.round(goals * 0.3),
                mediumDangerGoals: Math.round(goals * 0.35), highDangerGoals: goals - Math.round(goals * 0.3) - Math.round(goals * 0.35)});
        }
    }
    return toCSV(rows);
}

function mpTeamGameByGame(code, year) {
    const abbrev = fromMpCode(code);
    if (!TEAM[abbrev]) return null;
    const rows = [];
    let games;
    if (year === MP_YEAR) {
        games = teamGames(abbrev).filter(isDone).map((g) => {
            const s = simulate(g.id);
            const home = g.home === abbrev;
            const opp = home ? g.away : g.home;
            return {gameId: g.id, date: g.date.replace(/-/g, ''), home, opp, gf: s.score[abbrev] - (s.lastPeriodType === 'SO' && s.score[abbrev] > s.score[opp] ? 1 : 0),
                ga: s.score[opp] - (s.lastPeriodType === 'SO' && s.score[opp] > s.score[abbrev] ? 1 : 0), sf: s.sog[abbrev], sa: s.sog[opp], ts: s.teamStat};
        });
    } else {
        const r = rng(`mp-prev-${abbrev}-${year}`);
        games = Array.from({length: 82}, (_, i) => ({gameId: Number(`${year}02${String(i * 13 + TEAM[abbrev].index + 1).padStart(4, '0')}`), date: addDaysISO(`${year}-10-08`, Math.floor(i * 2.25)).replace(/-/g, ''),
            home: r() < 0.5, opp: r.pick(TEAMS.filter((t) => t.abbrev !== abbrev)).abbrev, gf: r.poisson(3), ga: r.poisson(3), sf: r.int(22, 38), sa: r.int(22, 38)}));
    }
    for (const g of games) {
        const r = rng(`mpgg-${abbrev}-${g.gameId}`);
        for (const sit of MP_SITUATIONS) {
            const f = sit === 'all' ? 1 : sit === '5on5' ? 0.8 : 0.1;
            const xgf = round((g.sf * 0.095 + r() * 0.6) * f, 3);
            const xga = round((g.sa * 0.095 + r() * 0.6) * f, 3);
            const saf = Math.round(g.sf * 1.9 * f);
            const saa = Math.round(g.sa * 1.9 * f);
            const fow = r.int(22, 36);
            rows.push({
                team: mpCode(abbrev), season: Number(year), name: mpCode(abbrev), gameId: g.gameId, playerTeam: mpCode(abbrev), opposingTeam: mpCode(g.opp),
                home_or_away: g.home ? 'HOME' : 'AWAY', gameDate: Number(g.date), position: 'Team Level', situation: sit,
                xGoalsPercentage: round(xgf / (xgf + xga || 1), 4), corsiPercentage: round(saf / (saf + saa || 1), 4), fenwickPercentage: round(saf / (saf + saa || 1), 4),
                iceTime: Math.round(3600 * f), xOnGoalFor: round(g.sf * f, 2), xGoalsFor: xgf, xReboundsFor: round(1.6 * f, 2), shotsOnGoalFor: Math.round(g.sf * f),
                missedShotsFor: Math.round(g.sf * 0.45 * f), blockedShotAttemptsFor: Math.round(g.sf * 0.45 * f), shotAttemptsFor: saf, goalsFor: Math.round(g.gf * f),
                penaltiesFor: r.int(1, 5), penalityMinutesFor: r.int(1, 5) * 2, faceOffsWonFor: Math.round(fow * f), hitsFor: Math.round(r.int(12, 32) * f),
                takeawaysFor: Math.round(r.int(3, 10) * f), giveawaysFor: Math.round(r.int(5, 14) * f), lowDangerShotsFor: Math.round(g.sf * 0.6 * f),
                mediumDangerShotsFor: Math.round(g.sf * 0.27 * f), highDangerShotsFor: Math.round(g.sf * 0.13 * f), lowDangerGoalsFor: 0, mediumDangerGoalsFor: 0, highDangerGoalsFor: 0,
                xOnGoalAgainst: round(g.sa * f, 2), xGoalsAgainst: xga, shotsOnGoalAgainst: Math.round(g.sa * f), missedShotsAgainst: Math.round(g.sa * 0.45 * f),
                blockedShotAttemptsAgainst: Math.round(g.sa * 0.45 * f), shotAttemptsAgainst: saa, goalsAgainst: Math.round(g.ga * f), penaltiesAgainst: r.int(1, 5),
                penalityMinutesAgainst: r.int(1, 5) * 2, faceOffsWonAgainst: Math.round((58 - fow) * f), hitsAgainst: Math.round(r.int(12, 32) * f),
                takeawaysAgainst: Math.round(r.int(3, 10) * f), giveawaysAgainst: Math.round(r.int(5, 14) * f), lowDangerShotsAgainst: Math.round(g.sa * 0.6 * f),
                mediumDangerShotsAgainst: Math.round(g.sa * 0.27 * f), highDangerShotsAgainst: Math.round(g.sa * 0.13 * f),
            });
        }
    }
    return toCSV(rows);
}

function mpSimulations() {
    const rows = [];
    const ordered = standingsRows();
    for (const r of ordered) {
        const abbrev = r.teamAbbrev.default;
        const strength = 1 - (r.leagueSequence - 1) / 31;
        const base = {
            madePlayoffs: round(0.08 + strength * 0.88, 4), round2: round(0.03 + strength * 0.55, 4), round3: round(0.01 + strength * 0.3, 4), round4: round(0.005 + strength * 0.17, 4),
            wonCup: round(0.002 + strength * 0.09, 4), draftLottery: round(Math.max(0, 0.6 - strength * 0.7), 4),
        };
        for (const [scen, delta] of [['ALL', 0], ['WINREG', 0.04], ['WINOT', 0.03], ['LOSSOT', -0.015], ['LOSSREG', -0.035]]) {
            const row = {scenerio: scen, teamCode: mpCode(abbrev)};
            for (const [k, v] of Object.entries(base)) row[k] = round(Math.min(1, Math.max(0, k === 'draftLottery' ? v - delta : v + delta * (k === 'madePlayoffs' ? 1 : 0.5))), 4);
            for (const rd of [1, 2, 3, 4]) {
                for (const gm of [4, 5, 6, 7]) row[`round${rd}Winin${gm}`] = round(row[`round${rd === 1 ? 'round2' : rd === 4 ? 'wonCup' : `round${rd + 1}`}`] / 4 || 0, 4);
            }
            rows.push(row);
        }
    }
    const cols = ['scenerio', 'teamCode', 'madePlayoffs', 'round2', 'round3', 'round4', 'wonCup', 'draftLottery',
        ...[1, 2, 3, 4].flatMap((rd) => [4, 5, 6, 7].map((gm) => `round${rd}Winin${gm}`))];
    // round<n>Winin<g> lookup above uses keys that may not exist; fill numerically.
    rows.forEach((r) => cols.forEach((c) => {
        if (r[c] == null || Number.isNaN(r[c])) r[c] = 0.01;
    }));
    return toCSV(rows, cols);
}

function mpPowerRankings(dateKey) {
    const rows = standingsRows();
    const r = rng(`power-${dateKey ?? 'now'}`);
    const list = rows.map((x) => ({abbrev: x.teamAbbrev.default, v: x.points + r() * (dateKey ? 8 : 3)})).sort((a, b) => b.v - a.v);
    return toCSV(list.map((x, i) => ({rank: i + 1, teamCode: mpCode(x.abbrev), teamName: TEAM[x.abbrev].name, rating: round(x.v, 2), playoffOdds: round(0.9 - i * 0.027, 3), cupOdds: round(0.12 - i * 0.0035, 4)})));
}

// Snapshots exist only for a single date a week ago (exercises the app's look-around search).
const POWER_SNAPSHOT = (() => {
    const t = new Date(`${TODAY}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() - 7);
    return `${t.getUTCFullYear()}_${pad2(t.getUTCMonth() + 1)}_${pad2(t.getUTCDate())}`;
})();

/* --------------------------------------------------------------- rotowire */

function injuries(abbrev) {
    const r = rng(`inj-${abbrev}`);
    const n = abbrev === 'SEA' ? 0 : r.int(1, 5);
    const statuses = ['Day-To-Day', 'Out', 'IR', 'IR-LT', 'Questionable'];
    const kinds = ['Upper Body', 'Lower Body', 'Knee', 'Concussion', 'Illness', 'Shoulder', 'Groin', 'Undisclosed'];
    return Array.from({length: n}, (_, i) => {
        const p = ROSTERS[abbrev][15 + i];
        return {ID: String(1000 + p.id % 10000), URL: `/hockey/player/${p.firstName.toLowerCase()}-${p.lastName.toLowerCase()}-${p.id}`, firstname: p.firstName, lastname: p.lastName,
            player: fullName(p), team: abbrev, position: p.pos, injury: i === 0 && abbrev === FAV_TEAM ? '' : r.pick(kinds), status: r.pick(statuses), rDate: 'Subject to change', date: TODAY};
    });
}

/* ----------------------------------------------------------------- images */

// 1x1 transparent PNG and a tiny SVG.
const PNG_1x1 = (() => {
    // 1x1 neutral grey RGBA PNG, built at load time (CRCs computed, no magic strings).
    const zlib = require('zlib');
    const crcTable = Array.from({length: 256}, (_, n) => {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        return c >>> 0;
    });
    const crc = (buf) => {
        let c = 0xFFFFFFFF;
        for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    };
    const chunk = (type, data) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type), data]);
        const c = Buffer.alloc(4);
        c.writeUInt32BE(crc(td));
        return Buffer.concat([len, td, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(Buffer.from([0, 0x9A, 0xA0, 0xA6, 0xFF]))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
})();
const svgFor = (label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#8a8f98"/><text x="32" y="38" font-size="16" text-anchor="middle" fill="#fff" font-family="sans-serif">${String(label).slice(0, 3)}</text></svg>`;

/* ---------------------------------------------------------------- routing */

const json = (body, status = 200) => ({status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body)});
const csv = (body) => (body == null ? notFound() : {status: 200, contentType: 'text/csv; charset=utf-8', body});
const notFound = (msg = 'Not Found') => ({status: 404, contentType: 'text/plain', body: msg});
const orNotFound = (x) => (x == null ? notFound() : json(x));

// MoneyPuck endpoints that 404 in the "degraded" scenario (teamGameByGame: current season only,
// so the app's last-season fallback is exercised).
const DEGRADED_MP = [/\/predictions\//, /\/gameData\//, /\/starting_goalies\//, /seasonSummary\//, /\/simulations\//, /\/powerRankings\//, new RegExp(`/teamGameByGame/${MP_YEAR}/`)];

const FIXTURE_HOSTS = ['api-web.nhle.com', 'api.nhle.com', 'moneypuck.com', 'www.moneypuck.com', 'rotowire.com', 'www.rotowire.com', 'assets.nhle.com'];

function resolve(rawUrl, {scenario = 'full'} = {}) {
    let u;
    try {
        u = new URL(rawUrl);
    } catch {
        return null;
    }
    const host = u.hostname;
    const p = decodeURIComponent(u.pathname);

    if (host === 'assets.nhle.com' || /\.(png|jpe?g|gif|webp)$/i.test(p)) {
        if (/\.svg$/i.test(p)) return {status: 200, contentType: 'image/svg+xml', body: svgFor(p.split('/').pop().split('_')[0])};
        return {status: 200, contentType: 'image/png', body: PNG_1x1};
    }
    if (/\.svg$/i.test(p)) return {status: 200, contentType: 'image/svg+xml', body: svgFor('?')};

    if (host === 'api-web.nhle.com') {
        let m;
        if (p === '/v1/standings/now') return json({wildCardIndicator: true, standingsDateTimeUtc: NOW.toISOString(), standings: standingsRows()});
        if ((m = p.match(/^\/v1\/score\/(now|\d{4}-\d{2}-\d{2})$/))) return json(scorePayload(m[1] === 'now' ? TODAY : m[1]));
        if ((m = p.match(/^\/v1\/gamecenter\/(\d+)\/(landing|boxscore|play-by-play|right-rail)$/))) {
            if (!GAME_BY_ID.has(Number(m[1]))) return notFound();
            const f = {landing: landingPayload, boxscore: boxscorePayload, 'play-by-play': pbpPayload, 'right-rail': rightRailPayload}[m[2]];
            return json(f(m[1]));
        }
        if ((m = p.match(/^\/v1\/player\/(\d+)\/landing$/))) return orNotFound(playerLandingPayload(m[1]));
        if ((m = p.match(/^\/v1\/player\/(\d+)\/game-log\/(\d{8})\/(\d)$/))) return orNotFound(gameLogPayload(m[1], m[2], m[3]));
        if ((m = p.match(/^\/v1\/roster\/([A-Z]{3})\/current$/))) return TEAM[m[1]] ? json(rosterPayload(m[1])) : notFound();
        if ((m = p.match(/^\/v1\/club-schedule\/([A-Z]{3})\/week\/now$/))) return TEAM[m[1]] ? json(clubWeekPayload(m[1])) : notFound();
        if ((m = p.match(/^\/v1\/club-schedule-season\/([A-Z]{3})\/now$/))) return TEAM[m[1]] ? json(clubSeasonPayload(m[1])) : notFound();
        if ((m = p.match(/^\/v1\/club-stats\/([A-Z]{3})\/now$/))) return TEAM[m[1]] ? json(clubStatsPayload(m[1])) : notFound();
        return null;
    }
    if (host === 'api.nhle.com') {
        const res = statsRest(rawUrl);
        return res ? json(res) : null;
    }
    if (host === 'moneypuck.com' || host === 'www.moneypuck.com') {
        if (scenario === 'degraded' && DEGRADED_MP.some((re) => re.test(p))) return notFound();
        let m;
        if ((m = p.match(/^\/moneypuck\/predictions\/(\d+)\.csv$/))) return csv(mpPrediction(m[1]));
        if ((m = p.match(/^\/moneypuck\/gameData\/(\d{8})\/(\d+)\.csv$/))) return csv(mpGameData(m[2]));
        if ((m = p.match(/^\/moneypuck\/tweets\/starting_goalies\/(\d+)([HA])\.csv$/))) return csv(mpStartingGoalie(m[1], m[2]));
        if ((m = p.match(/^\/moneypuck\/playerData\/seasonSummary\/(\d{4})_goalies\.csv$/))) return m[1] === MP_YEAR || m[1] === MP_PREV_YEAR ? csv(mpGoalieSeason(m[1])) : notFound();
        if ((m = p.match(/^\/moneypuck\/playerData\/teamGameByGame\/(\d{4})\/regular\/([A-Z.]{3})\.csv$/))) {
            // MoneyPuck spells four teams with dots; the NHL code 404s for those (exercises the fallback).
            if (MP_CODES[m[2]]) return notFound();
            return m[1] === MP_YEAR || m[1] === MP_PREV_YEAR ? csv(mpTeamGameByGame(m[2], m[1])) : notFound();
        }
        if (p === '/moneypuck/simulations/simulations_recent.csv') return csv(mpSimulations());
        if (p === '/moneypuck/powerRankings/rankings.csv') return csv(mpPowerRankings());
        if ((m = p.match(/^\/moneypuck\/powerRankings\/rankings_(\d{4}_\d{2}_\d{2})\.csv$/))) return m[1] === POWER_SNAPSHOT ? csv(mpPowerRankings(m[1])) : notFound();
        return notFound();
    }
    if (host === 'rotowire.com' || host === 'www.rotowire.com') {
        if (p === '/hockey/tables/injury-report.php') {
            if (scenario === 'degraded') return {status: 503, contentType: 'text/html', body: '<html><body>Service Unavailable</body></html>'};
            const team = u.searchParams.get('team');
            return TEAM[team] ? json(injuries(team)) : json([]);
        }
        return notFound();
    }
    return null;
}

module.exports = {
    NOW, TODAY, SEASON, PREV_SEASON, FAV_TEAM, GAME_IDS, SKATER_ID, GOALIE_ID, TEAMS, FIXTURE_HOSTS, POWER_SNAPSHOT,
    resolve,
    // exposed for the self-check
    _internal: {GAMES, simulate, standingsRows, ROSTERS},
};

/* -------------------------------------------------------------- self-check */

if (require.main === module) {
    const W = 'https://api-web.nhle.com/v1';
    const MP = 'https://moneypuck.com/moneypuck';
    const sortQ = encodeURIComponent(JSON.stringify([{property: 'points', direction: 'DESC'}, {property: 'gamesPlayed', direction: 'ASC'}]));
    const stats = (kind, season = SEASON, extra = '') => `https://api.nhle.com/stats/rest/en/${kind}/summary?isAggregate=false&isGame=false&sort=${sortQ}&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}${extra}`;
    const ids = GAME_IDS;
    const urls = [
        `${W}/standings/now`, `${W}/score/${TODAY}`, `${W}/score/2026-11-10`, `${W}/score/2026-11-12`, `${W}/score/now`,
        ...Object.values(ids).flatMap((id) => ['landing', 'boxscore', 'play-by-play', 'right-rail'].map((k) => `${W}/gamecenter/${id}/${k}`)),
        `${W}/player/${SKATER_ID}/landing`, `${W}/player/${GOALIE_ID}/landing`,
        `${W}/player/${SKATER_ID}/game-log/${SEASON}/2`, `${W}/player/${GOALIE_ID}/game-log/${SEASON}/2`, `${W}/player/${SKATER_ID}/game-log/${PREV_SEASON}/2`,
        `${W}/roster/TOR/current`, `${W}/club-schedule/TOR/week/now`, `${W}/club-schedule-season/UTA/now`, `${W}/club-stats/TOR/now`,
        stats('skater'), stats('goalie'), stats('team'), stats('skater', PREV_SEASON),
        stats('skater', SEASON, encodeURIComponent(' and skaterFullName likeIgnoreCase "%stutz%"')),
        `${MP}/predictions/${ids.pre}.csv`, `${MP}/gameData/${SEASON}/${ids.livePP}.csv`, `${MP}/gameData/${SEASON}/${ids.finalEN}.csv`,
        `${MP}/tweets/starting_goalies/${ids.pre}H.csv`, `${MP}/tweets/starting_goalies/${ids.pre}A.csv`, `${MP}/playerData/seasonSummary/${MP_YEAR}_goalies.csv`,
        `${MP}/playerData/teamGameByGame/${MP_YEAR}/regular/TOR.csv`, `${MP}/playerData/teamGameByGame/${MP_YEAR}/regular/LAK.csv`, `${MP}/playerData/teamGameByGame/${MP_YEAR}/regular/L.A.csv`,
        `${MP}/playerData/teamGameByGame/${MP_PREV_YEAR}/regular/TOR.csv`,
        `${MP}/simulations/simulations_recent.csv`, `${MP}/powerRankings/rankings.csv`, `${MP}/powerRankings/rankings_${POWER_SNAPSHOT}.csv`, `${MP}/powerRankings/rankings_2026_11_05.csv`,
        'https://www.rotowire.com/hockey/tables/injury-report.php?team=TOR&pos=ALL',
        `https://assets.nhle.com/mugs/nhl/${SEASON}/TOR/${SKATER_ID}.png`, 'https://assets.nhle.com/logos/nhl/svg/UTA_dark.svg',
    ];
    for (const scenario of ['full', 'degraded']) {
        console.log(`\n# scenario: ${scenario}`);
        for (const url of urls) {
            const t0 = Date.now();
            const r = resolve(url, {scenario});
            const size = r ? (Buffer.isBuffer(r.body) ? r.body.length : Buffer.byteLength(r.body)) : 0;
            let note = '';
            if (r && r.contentType.startsWith('application/json')) {
                const b = JSON.parse(r.body);
                note = Array.isArray(b) ? `${b.length} rows` : b.games ? `${b.games.length} games` : b.plays ? `${b.plays.length} plays, ${b.rosterSpots.length} rosterSpots`
                    : b.standings ? `${b.standings.length} teams` : b.data ? `${b.data.length}/${b.total} rows` : b.gameLog ? `${b.gameLog.length} games` : b.summary ? `${b.summary.scoring.reduce((a, p) => a + p.goals.length, 0)} goals` : '';
            } else if (r && r.contentType.startsWith('text/csv')) note = `${r.body.trim().split('\n').length - 1} csv rows`;
            console.log(`${r ? r.status : 'null'}  ${String(size).padStart(7)}B ${String(Date.now() - t0).padStart(4)}ms  ${note.padEnd(28)} ${url.replace(/\?.*/, '?…')}`);
        }
    }
    const today = gamesOn(TODAY).map((g) => {
        const res = result(g.id);
        return `${g.away}@${g.home} ${g.state}${g.scheduleState !== 'OK' ? `/${g.scheduleState}` : ''} ${res ? `${res.away}-${res.home} ${res.lastPeriodType ?? `P${res.period} ${res.clock.timeRemaining}${res.clock.inIntermission ? ' INT' : ''}`}` : ''}`;
    });
    console.log('\nToday:', today.join(' | '));
    console.log('GAME_IDS', GAME_IDS, 'SKATER_ID', SKATER_ID, 'GOALIE_ID', GOALIE_ID);
}
