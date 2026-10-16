import {currentSeasonId} from '../utils/season';
import {readPersisted, request} from './client';

const WEB = 'https://api-web.nhle.com/v1';
const STATS = 'https://api.nhle.com/stats/rest/en';

const MIN = 60 * 1000;
const LIVE_TTL = 10 * 1000;

export const urls = {
    standings: () => `${WEB}/standings/now`,
    // Standings as they stood at the end of `date` (YYYY-MM-DD).
    standingsAt: (date) => `${WEB}/standings/${date}`,
    score: (date) => `${WEB}/score/${date ?? 'now'}`,
    landing: (gameId) => `${WEB}/gamecenter/${gameId}/landing`,
    boxscore: (gameId) => `${WEB}/gamecenter/${gameId}/boxscore`,
    playByPlay: (gameId) => `${WEB}/gamecenter/${gameId}/play-by-play`,
    rightRail: (gameId) => `${WEB}/gamecenter/${gameId}/right-rail`,
    // Every shift in a game (typeCode 517 = shift; 505 rows are goal markers).
    shiftCharts: (gameId) => `${STATS}/shiftcharts?cayenneExp=gameId=${gameId}`,
    player: (playerId) => `${WEB}/player/${playerId}/landing`,
    playerGameLog: (playerId, seasonId = currentSeasonId(), gameType = 2) =>
        `${WEB}/player/${playerId}/game-log/${seasonId}/${gameType}`,
    roster: (team) => `${WEB}/roster/${team}/current`,
    clubWeek: (team) => `${WEB}/club-schedule/${team}/week/now`,
    clubSeason: (team) => `${WEB}/club-schedule-season/${team}/now`,
    clubStats: (team) => `${WEB}/club-stats/${team}/now`,
    // NHL Edge puck/player tracking with league percentiles (2021-22 onward).
    edgeSkater: (playerId, seasonId, gameType = 2) => `${WEB}/edge/skater-detail/${playerId}/${seasonId}/${gameType}`,
    edgeGoalie: (playerId, seasonId, gameType = 2) => `${WEB}/edge/goalie-detail/${playerId}/${seasonId}/${gameType}`,
    // Same data plus the details that have no percentile (shot-speed bands, distance per 60, 5v5 save %...).
    edgeSkaterMore: (playerId, seasonId, gameType = 2) => `${WEB}/edge/skater-comparison/${playerId}/${seasonId}/${gameType}`,
    edgeGoalieMore: (playerId, seasonId, gameType = 2) => `${WEB}/edge/goalie-comparison/${playerId}/${seasonId}/${gameType}`,
};

const sortParam = (pairs) =>
    encodeURIComponent(JSON.stringify(pairs.map(([property, direction]) => ({property, direction}))));

function statsUrl(kind, {seasonId = currentSeasonId(), sort, start = 0, limit = 50, gameTypeId = 2, minGames = 1} = {}) {
    return `${STATS}/${kind}/summary?isAggregate=false&isGame=false&sort=${sortParam(sort)}` +
        `&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=${minGames}` +
        `&cayenneExp=gameTypeId=${gameTypeId}%20and%20seasonId%3C=${seasonId}%20and%20seasonId%3E=${seasonId}`;
}

// opts: {seasonId, sortBy, direction: 'DESC' | 'ASC', start, limit, minGames, gameTypeId}
export const statsUrls = {
    skaters: (opts = {}) => statsUrl('skater', {
        sort: [[opts.sortBy ?? 'points', opts.direction ?? 'DESC'], ['gamesPlayed', 'ASC'], ['playerId', 'ASC']], ...opts,
    }),
    goalies: (opts = {}) => statsUrl('goalie', {
        sort: [[opts.sortBy ?? 'wins', opts.direction ?? 'DESC'], ['savePct', 'DESC'], ['playerId', 'ASC']], ...opts,
    }),
    // Every team's season summary in one call; index it by teamId / teamFullName.
    teams: (opts = {}) => statsUrl('team', {sort: [['points', 'DESC'], ['wins', 'DESC']], limit: 50, ...opts}),
};

const q = (s) => encodeURIComponent(s);
const ids = (list) => list.map(Number).filter(Number.isFinite).join(',');

// Career regular-season totals for a set of players, and one season's game-by-game rows for a team.
export const careerUrls = {
    skaters: (playerIds) => `${STATS}/skater/summary?isAggregate=true&isGame=false&limit=-1` +
        `&cayenneExp=${q(`gameTypeId=2 and playerId in (${ids(playerIds)})`)}`,
    goalies: (playerIds) => `${STATS}/goalie/summary?isAggregate=true&isGame=false&limit=-1` +
        `&cayenneExp=${q(`gameTypeId=2 and playerId in (${ids(playerIds)})`)}`,
    teamGames: (kind /* 'skater' | 'goalie' */, team, seasonId = currentSeasonId()) =>
        `${STATS}/${kind}/summary?isAggregate=false&isGame=true&limit=-1` +
        `&cayenneExp=${q(`gameTypeId=2 and seasonId=${seasonId} and teamAbbrevs="${team}"`)}`,
};

export const nhl = {
    standings: (o) => request(urls.standings(), {ttl: 5 * MIN, persist: true, ...o}),
    // Past snapshots never change, so cache them for a day.
    standingsAt: (date, o) => request(urls.standingsAt(date), {ttl: 24 * 60 * MIN, persist: true, ...o}),
    score: (date, o) => request(urls.score(date), {ttl: LIVE_TTL, persist: true, ...o}),
    landing: (id, o) => request(urls.landing(id), {ttl: LIVE_TTL, ...o}),
    boxscore: (id, o) => request(urls.boxscore(id), {ttl: LIVE_TTL, ...o}),
    playByPlay: (id, o) => request(urls.playByPlay(id), {ttl: LIVE_TTL, ...o}),
    rightRail: (id, o) => request(urls.rightRail(id), {ttl: MIN, ...o}),
    // `live`: short TTL while the game is on; a finished game's shifts don't change.
    shiftCharts: (id, {live = false, ...o} = {}) => request(urls.shiftCharts(id), {ttl: live ? LIVE_TTL : 24 * 60 * MIN, ...o}),
    player: (id, o) => request(urls.player(id), {ttl: 10 * MIN, persist: true, ...o}),
    playerGameLog: (id, seasonId, gameType, o) =>
        request(urls.playerGameLog(id, seasonId, gameType), {ttl: 10 * MIN, ...o}),
    roster: (team, o) => request(urls.roster(team), {ttl: 30 * MIN, persist: true, ...o}),
    clubWeek: (team, o) => request(urls.clubWeek(team), {ttl: MIN, persist: true, ...o}),
    clubSeason: (team, o) => request(urls.clubSeason(team), {ttl: 5 * MIN, persist: true, ...o}),
    clubStats: (team, o) => request(urls.clubStats(team), {ttl: 10 * MIN, ...o}),
    skaters: (opts, o) => request(statsUrls.skaters(opts), {ttl: 10 * MIN, persist: true, ...o}),
    goalies: (opts, o) => request(statsUrls.goalies(opts), {ttl: 10 * MIN, persist: true, ...o}),
    teams: (opts, o) => request(statsUrls.teams(opts), {ttl: 10 * MIN, persist: true, ...o}),
    edgeSkater: (id, seasonId, o) => request(urls.edgeSkater(id, seasonId), {ttl: 30 * MIN, persist: true, ...o}),
    edgeGoalie: (id, seasonId, o) => request(urls.edgeGoalie(id, seasonId), {ttl: 30 * MIN, persist: true, ...o}),
    edgeSkaterMore: (id, seasonId, o) => request(urls.edgeSkaterMore(id, seasonId), {ttl: 30 * MIN, persist: true, ...o}),
    edgeGoalieMore: (id, seasonId, o) => request(urls.edgeGoalieMore(id, seasonId), {ttl: 30 * MIN, persist: true, ...o}),
    careerSkaters: (playerIds, o) => request(careerUrls.skaters(playerIds), {ttl: 30 * MIN, ...o}),
    careerGoalies: (playerIds, o) => request(careerUrls.goalies(playerIds), {ttl: 30 * MIN, ...o}),
    teamGames: (kind, team, seasonId, o) => request(careerUrls.teamGames(kind, team, seasonId), {ttl: 10 * MIN, ...o}),
};

export const nhlPersisted = {
    standings: () => readPersisted(urls.standings()),
    score: (date) => readPersisted(urls.score(date)),
    clubWeek: (team) => readPersisted(urls.clubWeek(team)),
};

export const headshotUrl = (playerId, team, seasonId = currentSeasonId()) =>
    `https://assets.nhle.com/mugs/nhl/${seasonId}/${team}/${playerId}.png`;

// Game states from the NHL API.
export const isLive = (g) => g?.gameState === 'LIVE' || g?.gameState === 'CRIT';
export const isFinal = (g) => g?.gameState === 'FINAL' || g?.gameState === 'OFF' || g?.gameState === 'OVER';
export const isUpcoming = (g) => g?.gameState === 'FUT' || g?.gameState === 'PRE';
