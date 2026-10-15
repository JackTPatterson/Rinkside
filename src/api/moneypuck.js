import {moneyPuckYear} from '../utils/season';
import {request} from './client';

// MoneyPuck publishes CSVs. These are best-effort: early-season or brand-new games often 404,
// so callers should treat errors as "no data" rather than fatal.
const MP = 'https://moneypuck.com/moneypuck';
const MIN = 60 * 1000;

export const mpUrls = {
    prediction: (gameId) => `${MP}/predictions/${gameId}.csv`,
    gameData: (seasonId, gameId) => `${MP}/gameData/${seasonId}/${gameId}.csv`,
    startingGoalie: (gameId, side /* 'H' | 'A' */) => `${MP}/tweets/starting_goalies/${gameId}${side}.csv`,
    goalieSeason: (seasonId) => `${MP}/playerData/seasonSummary/${moneyPuckYear(seasonId)}_goalies.csv`,
    teamGameByGame: (team, seasonId) => `${MP}/playerData/teamGameByGame/${moneyPuckYear(seasonId)}/regular/${team}.csv`,
    simulations: () => `${MP}/simulations/simulations_recent.csv`,
    powerRankings: (date /* YYYY-MM-DD or undefined */) =>
        date ? `${MP}/powerRankings/rankings_${date}.csv` : `${MP}/powerRankings/rankings.csv`,
};

const csv = (url, ttl, extra) => request(url, {type: 'csv', ttl, ...extra});

export const moneypuck = {
    prediction: (gameId, o) => csv(mpUrls.prediction(gameId), 10 * MIN, o),
    gameData: (seasonId, gameId, o) => csv(mpUrls.gameData(seasonId, gameId), 20 * 1000, o),
    startingGoalie: (gameId, side, o) => csv(mpUrls.startingGoalie(gameId, side), 10 * MIN, o),
    goalieSeason: (seasonId, o) => csv(mpUrls.goalieSeason(seasonId), 60 * MIN, {persist: true, ...o}),
    teamGameByGame: (team, seasonId, o) => csv(mpUrls.teamGameByGame(team, seasonId), 30 * MIN, {persist: true, ...o}),
    simulations: (o) => csv(mpUrls.simulations(), 30 * MIN, {persist: true, ...o}),
    powerRankings: (date, o) => csv(mpUrls.powerRankings(date), 60 * MIN, {persist: true, ...o}),
};

const safe = (p) => p.catch(() => null);

/** Pre-game win probability for the home team (0..1), or null. */
export async function preGameHomeWinProb(gameId) {
    const rows = await safe(moneypuck.prediction(gameId));
    const last = rows?.filter((r) => r.preGameHomeTeamWinOverallScore != null).slice(-1)[0];
    const v = Number(last?.preGameHomeTeamWinOverallScore);
    return Number.isFinite(v) ? v : null;
}

/** Starting goalie for one side plus MoneyPuck season stats, or null. */
export async function startingGoalieWithStats(gameId, side, seasonId) {
    const rows = await safe(moneypuck.startingGoalie(gameId, side));
    const g = rows?.[0];
    if (!g?.goalie_id) return null;
    const all = await safe(moneypuck.goalieSeason(seasonId));
    const s = all?.find((r) => String(r.playerId) === String(g.goalie_id) && r.situation === 'all');
    const goalie = {id: g.goalie_id, name: g.goalie_name, confirmedBy: g.handle ?? null, stats: null};
    if (s) {
        const minutes = Number(s.icetime) / 60;
        goalie.stats = {
            gamesPlayed: Number(s.games_played),
            goalsAgainst: Number(s.goals),
            shotsAgainst: Number(s.ongoal),
            xGoalsAgainst: Number(s.xGoals),
            gaa: minutes > 0 ? (Number(s.goals) * 60) / minutes : null,
            savePct: s.ongoal > 0 ? (Number(s.ongoal) - Number(s.goals)) / Number(s.ongoal) : null,
            gsax: Number(s.xGoals) - Number(s.goals),
        };
    }
    return goalie;
}
