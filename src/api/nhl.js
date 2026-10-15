import {currentSeasonId} from '../utils/season';
import {readPersisted, request} from './client';

const WEB = 'https://api-web.nhle.com/v1';
const STATS = 'https://api.nhle.com/stats/rest/en';

const MIN = 60 * 1000;
const LIVE_TTL = 10 * 1000;

export const urls = {
    standings: () => `${WEB}/standings/now`,
    score: (date) => `${WEB}/score/${date ?? 'now'}`,
    landing: (gameId) => `${WEB}/gamecenter/${gameId}/landing`,
    boxscore: (gameId) => `${WEB}/gamecenter/${gameId}/boxscore`,
    playByPlay: (gameId) => `${WEB}/gamecenter/${gameId}/play-by-play`,
    rightRail: (gameId) => `${WEB}/gamecenter/${gameId}/right-rail`,
    player: (playerId) => `${WEB}/player/${playerId}/landing`,
    playerGameLog: (playerId, seasonId = currentSeasonId(), gameType = 2) =>
        `${WEB}/player/${playerId}/game-log/${seasonId}/${gameType}`,
    roster: (team) => `${WEB}/roster/${team}/current`,
    clubWeek: (team) => `${WEB}/club-schedule/${team}/week/now`,
    clubSeason: (team) => `${WEB}/club-schedule-season/${team}/now`,
    clubStats: (team) => `${WEB}/club-stats/${team}/now`,
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

export const nhl = {
    standings: (o) => request(urls.standings(), {ttl: 5 * MIN, persist: true, ...o}),
    score: (date, o) => request(urls.score(date), {ttl: LIVE_TTL, persist: true, ...o}),
    landing: (id, o) => request(urls.landing(id), {ttl: LIVE_TTL, ...o}),
    boxscore: (id, o) => request(urls.boxscore(id), {ttl: LIVE_TTL, ...o}),
    playByPlay: (id, o) => request(urls.playByPlay(id), {ttl: LIVE_TTL, ...o}),
    rightRail: (id, o) => request(urls.rightRail(id), {ttl: MIN, ...o}),
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
