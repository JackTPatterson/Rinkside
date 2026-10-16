import {moneyPuckYear} from '../utils/season';
import {request} from './client';

// MoneyPuck publishes CSVs. These are best-effort: early-season or brand-new games often 404,
// so callers should treat errors as "no data" rather than fatal.
const MP = 'https://moneypuck.com/moneypuck';
const MIN = 60 * 1000;
const MP_TEAM_CODES = {LAK: 'L.A', NJD: 'N.J', SJS: 'S.J', TBL: 'T.B'};

export const mpUrls = {
    prediction: (gameId) => `${MP}/predictions/${gameId}.csv`,
    gameData: (seasonId, gameId) => `${MP}/gameData/${seasonId}/${gameId}.csv`,
    startingGoalie: (gameId, side /* 'H' | 'A' */) => `${MP}/tweets/starting_goalies/${gameId}${side}.csv`,
    goalieSeason: (seasonId) => `${MP}/playerData/seasonSummary/${moneyPuckYear(seasonId)}/regular/goalies.csv`,
    teamGameByGame: (team, seasonId) => `${MP}/playerData/teamGameByGame/${moneyPuckYear(seasonId)}/regular/${team}.csv`,
    simulations: () => `${MP}/simulations/simulations_recent.csv`,
    powerRankings: (date /* YYYY_MM_DD (underscores, as MoneyPuck names snapshots) or undefined */) =>
        date ? `${MP}/powerRankings/rankings_${date}.csv` : `${MP}/powerRankings/rankings.csv`,
};

const csv = (url, ttl, extra) => request(url, {type: 'csv', ttl, ...extra});

export const moneypuck = {
    prediction: (gameId, o) => csv(mpUrls.prediction(gameId), 10 * MIN, o),
    gameData: (seasonId, gameId, o) => csv(mpUrls.gameData(seasonId, gameId), 20 * 1000, o),
    startingGoalie: (gameId, side, o) => csv(mpUrls.startingGoalie(gameId, side), 10 * MIN, o),
    goalieSeason: (seasonId, o) => csv(mpUrls.goalieSeason(seasonId), 60 * MIN, {persist: true, ...o}),
    // MoneyPuck spells four teams with dots (L.A, N.J, S.J, T.B); try the NHL code first, then theirs.
    teamGameByGame: async (team, seasonId, o) => {
        try {
            return await csv(mpUrls.teamGameByGame(team, seasonId), 30 * MIN, {persist: true, ...o});
        } catch (e) {
            const alt = MP_TEAM_CODES[team];
            if (!alt) throw e;
            return csv(mpUrls.teamGameByGame(alt, seasonId), 30 * MIN, {persist: true, ...o});
        }
    },
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

function goalieStats(s) {
    if (!s) return null;
    const minutes = Number(s.icetime) / 60;
    return {
        gamesPlayed: Number(s.games_played),
        goalsAgainst: Number(s.goals),
        shotsAgainst: Number(s.ongoal),
        xGoalsAgainst: Number(s.xGoals),
        gaa: minutes > 0 ? (Number(s.goals) * 60) / minutes : null,
        savePct: s.ongoal > 0 ? (Number(s.ongoal) - Number(s.goals)) / Number(s.ongoal) : null,
        gsax: Number(s.xGoals) - Number(s.goals),
    };
}

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Starting goalie for one side plus MoneyPuck season stats, or null. `report` (DailyFaceoff's
 * {name, strength} for this side) adds how sure the start is, and wins when it names someone else
 * and is confirmed (MoneyPuck's file can lag a late change).
 * Result: {id, name, status: 'Confirmed' | 'Likely' | 'Projected', stats}.
 */
export async function startingGoalieWithStats(gameId, side, seasonId, report) {
    const [rows, all] = await Promise.all([safe(moneypuck.startingGoalie(gameId, side)), safe(moneypuck.goalieSeason(seasonId))]);
    const season = (all ?? []).filter((r) => r.situation === 'all');
    const g = rows?.[0];
    let goalie = g?.goalie_id ? {id: g.goalie_id, name: g.goalie_name, status: g.handle ? 'Confirmed' : 'Projected'} : null;
    const reported = report?.name ? fold(report.name) : null;
    if (reported && (!goalie || (fold(goalie.name) !== reported && report.strength === 'Confirmed'))) {
        const match = season.find((r) => fold(r.name) === reported);
        goalie = {id: match?.playerId ?? null, name: report.name, status: 'Projected'};
    }
    if (!goalie) return null;
    if (reported && fold(goalie.name) === reported && goalie.status !== 'Confirmed') {
        goalie.status = report.strength === 'Confirmed' ? 'Confirmed' : report.strength === 'Likely' ? 'Likely' : 'Projected';
    }
    goalie.stats = goalieStats(season.find((r) => String(r.playerId) === String(goalie.id)));
    return goalie;
}
