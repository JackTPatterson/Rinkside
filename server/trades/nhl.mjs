// Read-only NHL data for the team alerts: standings, schedule, rosters, career totals and starting goalies.
// Every lookup is cached, and callers treat any failure as "no data this time".

const API = 'https://api-web.nhle.com/v1';
const DFO = 'https://www.dailyfaceoff.com/starting-goalies';
const MIN = 60000;
const text = value => (value && typeof value === 'object' ? value.default : value) ?? '';

async function fetchJson(url) {
    const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`NHL returned HTTP ${response.status}`);
    return response.json();
}
async function fetchPage(url) {
    const response = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0 (compatible; Rinkside)'}, signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Page returned HTTP ${response.status}`);
    return response.text();
}

/** DailyFaceoff's starting goalies for one date, keyed "AWAY@HOME" by team abbreviation: {home, away} = {name, strength}. */
export function parseGoalies(html) {
    const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (!match) throw new Error('No page data');
    const out = {};
    for (const g of JSON.parse(match[1])?.props?.pageProps?.data ?? []) {
        const side = k => ({name: g[`${k}GoalieName`] ?? null, strength: g[`${k}NewsStrengthName`] ?? null});
        if (g.awayTeamAbbreviation && g.homeTeamAbbreviation) out[`${g.awayTeamAbbreviation}@${g.homeTeamAbbreviation}`] = {home: side('home'), away: side('away')};
    }
    return out;
}

export function createNhl({getJson = fetchJson, getPage = fetchPage, now = () => Date.now()} = {}) {
    const cache = new Map();
    async function cached(key, ttl, load, force = false) {
        const hit = cache.get(key);
        if (!force && hit && now() - hit.at < ttl) return hit.value;
        const value = await load();
        cache.set(key, {at: now(), value});
        return value;
    }
    const nhl = {
        standings: ({force} = {}) => cached('standings', 5 * MIN, async () => (await getJson(`${API}/standings/now`)).standings ?? [], force),
        /** This week's games, flattened: {id, date, startsAt (ms), state, home, away}. */
        schedule: ({force} = {}) => cached('schedule', 5 * MIN, async () => {
            const week = (await getJson(`${API}/schedule/now`)).gameWeek ?? [];
            return week.flatMap(day => (day.games ?? []).map(g => ({
                id: g.id, date: day.date, startsAt: Date.parse(g.startTimeUTC), state: g.gameState,
                home: text(g.homeTeam?.abbrev), away: text(g.awayTeam?.abbrev),
            })));
        }, force),
        roster: team => cached(`roster:${team}`, 12 * 60 * MIN, async () => {
            const r = await getJson(`${API}/roster/${team}/current`);
            return [...(r.forwards ?? []), ...(r.defensemen ?? []), ...(r.goalies ?? [])].map(p => ({
                id: p.id, name: `${text(p.firstName)} ${text(p.lastName)}`.trim(), goalie: p.positionCode === 'G',
            }));
        }),
        /** Career regular-season totals for one player: {id, name, goalie, gp, g, a, p, w, so}. */
        career: async (player, {force} = {}) => cached(`career:${player.id}`, 6 * 60 * MIN, async () => {
            const t = (await getJson(`${API}/player/${player.id}/landing`)).careerTotals?.regularSeason ?? {};
            return {id: player.id, name: player.name, goalie: player.goalie, gp: t.gamesPlayed ?? 0, g: t.goals ?? 0, a: t.assists ?? 0,
                p: t.points ?? 0, w: t.wins ?? 0, so: t.shutouts ?? 0};
        }, force),
        /** Everyone on a team's roster with career totals (a few requests at a time). Players that fail to load are skipped. */
        async teamCareers(team, {force} = {}) {
            const roster = await nhl.roster(team);
            const out = [];
            for (let i = 0; i < roster.length; i += 4) {
                const batch = await Promise.allSettled(roster.slice(i, i + 4).map(p => nhl.career(p, {force})));
                for (const r of batch) if (r.status === 'fulfilled') out.push(r.value);
            }
            return out;
        },
        goalies: date => cached(`goalies:${date}`, 10 * MIN, async () => parseGoalies(await getPage(`${DFO}/${date}`))),
    };
    return nhl;
}
