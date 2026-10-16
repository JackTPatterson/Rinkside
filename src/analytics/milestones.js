// Milestone watch and hot streaks from NHL stats rows (regular season, as the NHL counts milestones).
//  careerSkaters / careerGoalies: aggregate career rows ({playerId, goals, assists, points, gamesPlayed,
//  wins, shutouts}). skaterGames / goalieGames: this season's game-by-game rows for the team
//  ({playerId, gameId, gameDate, goals, assists, points, wins, gamesStarted}).

const hundreds = () => 100;
const SKATER = [
    {key: 'goals', label: 'career goals', unit: ['goal', 'goals'], step: (v) => (v < 100 ? 50 : 100), within: 4},
    {key: 'assists', label: 'career assists', unit: ['assist', 'assists'], step: hundreds, within: 5},
    {key: 'points', label: 'career points', unit: ['point', 'points'], step: hundreds, within: 6},
    {key: 'gamesPlayed', label: 'career games', unit: ['game', 'games'], step: hundreds, within: 5, from: 500},
];
const GOALIE = [
    {key: 'wins', label: 'career wins', unit: ['win', 'wins'], step: (v) => (v < 200 ? 50 : 100), within: 3},
    {key: 'shutouts', label: 'career shutouts', unit: ['shutout', 'shutouts'], step: () => 10, within: 1, from: 10},
    {key: 'gamesPlayed', label: 'career games', unit: ['game', 'games'], step: hundreds, within: 5, from: 300},
];

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const nameOf = (r) => r?.skaterFullName ?? r?.goalieFullName ?? '';

/** Each player's game rows, newest first. */
function byPlayer(rows) {
    const map = new Map();
    for (const r of rows ?? []) {
        if (!map.has(r.playerId)) map.set(r.playerId, []);
        map.get(r.playerId).push(r);
    }
    for (const list of map.values()) list.sort((a, b) => String(b.gameDate).localeCompare(String(a.gameDate)) || n(b.gameId) - n(a.gameId));
    return map;
}

const latestGameId = (rows) => (rows ?? []).reduce((best, r) => (String(r.gameDate) > String(best?.gameDate ?? '') ? r : best), null)?.gameId ?? null;

function milestonesOf(career, defs, lastGame) {
    const out = [];
    for (const r of career ?? []) {
        const last = lastGame.get(r.playerId);
        for (const d of defs) {
            const v = n(r[d.key]);
            const step = d.step(v);
            const next = Math.floor(v / step) * step + step;
            const prev = next - step;
            const lastAdd = d.key === 'gamesPlayed' ? 1 : n(last?.[d.key]);
            // Reached in the team's most recent game: the stat crossed a mark in that game.
            if (last && prev >= (d.from ?? step) && v - lastAdd < prev && v >= prev) {
                out.push({key: `${r.playerId}-${d.key}-done`, playerId: r.playerId, name: nameOf(r), type: 'milestone', reached: true, target: prev, label: d.label, remaining: 0, window: d.within});
                continue;
            }
            const remaining = next - v;
            if (next >= (d.from ?? step) && remaining > 0 && remaining <= d.within) {
                out.push({
                    key: `${r.playerId}-${d.key}`, playerId: r.playerId, name: nameOf(r), type: 'milestone', reached: false,
                    target: next, label: d.label, remaining, unit: d.unit[remaining === 1 ? 0 : 1], window: d.within, closeness: remaining / d.within,
                });
            }
        }
    }
    return out;
}

/**
 * Milestones a team's players just reached or are close to: [{key, playerId, name, reached, target,
 * label, remaining, unit}], reached first, then the closest.
 */
export function milestoneWatch({careerSkaters, careerGoalies, skaterGames, goalieGames}) {
    const lastId = latestGameId([...(skaterGames ?? []), ...(goalieGames ?? [])]);
    const lastGame = new Map();
    for (const r of [...(skaterGames ?? []), ...(goalieGames ?? [])]) if (r.gameId === lastId) lastGame.set(r.playerId, r);
    const list = [...milestonesOf(careerSkaters, SKATER, lastGame), ...milestonesOf(careerGoalies, GOALIE, lastGame)];
    return list.sort((a, b) => (b.reached - a.reached) || ((a.closeness ?? 0) - (b.closeness ?? 0)) || b.target - a.target);
}

const MIN_STREAK = 3;

function run(games, test) {
    let len = 0;
    for (const g of games) {
        if (!test(g)) break;
        len++;
    }
    return len;
}

/**
 * Active streaks (still alive through the team's latest game): point and goal streaks for skaters,
 * win streaks for goalies (starts only). [{key, playerId, name, label, length, detail}], longest first.
 */
export function activeStreaks({skaterGames, goalieGames}) {
    const lastId = latestGameId([...(skaterGames ?? []), ...(goalieGames ?? [])]);
    const out = [];
    for (const [id, games] of byPlayer(skaterGames)) {
        if (games[0]?.gameId !== lastId) continue; // didn't play the latest game
        const pts = run(games, (g) => n(g.points) > 0);
        const gls = run(games, (g) => n(g.goals) > 0);
        const sum = (len, k) => games.slice(0, len).reduce((s, g) => s + n(g[k]), 0);
        // One row per player: the longer streak, with a shorter goal streak noted in its detail.
        if (pts >= MIN_STREAK && pts > gls) {
            const goalNote = gls >= MIN_STREAK ? ` · goal in ${gls} straight` : '';
            out.push({
                key: `${id}-p`, playerId: id, name: nameOf(games[0]), label: 'Point streak', length: pts,
                detail: `${sum(pts, 'goals')} G, ${sum(pts, 'assists')} A${goalNote}`,
            });
        } else if (gls >= MIN_STREAK) {
            out.push({key: `${id}-g`, playerId: id, name: nameOf(games[0]), label: 'Goal streak', length: gls, detail: `${sum(gls, 'goals')} goals`});
        }
    }
    for (const [id, games] of byPlayer(goalieGames)) {
        const starts = games.filter((g) => n(g.gamesStarted) > 0);
        if (!starts.length) continue;
        const wins = run(starts, (g) => n(g.wins) > 0);
        if (wins >= MIN_STREAK) {
            const sa = starts.slice(0, wins).reduce((s, g) => s + n(g.shotsAgainst), 0);
            const ga = starts.slice(0, wins).reduce((s, g) => s + n(g.goalsAgainst), 0);
            const sv = sa > 0 ? `${((sa - ga) / sa).toFixed(3).replace(/^0/, '')} save %` : '';
            out.push({key: `${id}-w`, playerId: id, name: nameOf(games[0]), label: 'Win streak', length: wins, detail: sv});
        }
    }
    return out.sort((a, b) => b.length - a.length);
}
