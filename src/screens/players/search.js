// Server-side name search against the NHL stats API (cayenneExp `likeIgnoreCase`). Built here
// rather than in src/api/nhl.js; goes through the shared cached request() layer.
import {request} from '../../api/client';
import {currentSeasonId} from '../../utils/season';

const STATS = 'https://api.nhle.com/stats/rest/en';

export function nameSearchUrl(kind /* 'skaters' | 'goalies' */, query, {seasonId = currentSeasonId(), limit = 50} = {}) {
    const entity = kind === 'goalies' ? 'goalie' : 'skater';
    const field = kind === 'goalies' ? 'goalieFullName' : 'skaterFullName';
    const primary = kind === 'goalies' ? 'wins' : 'points';
    // Strip characters that would break the expression; keep letters (incl. accents), spaces, - and '.
    const clean = String(query ?? '').replace(/["%\\]/g, '').trim();
    const sort = encodeURIComponent(JSON.stringify([
        {property: primary, direction: 'DESC'},
        {property: 'playerId', direction: 'ASC'},
    ]));
    const cayenne = encodeURIComponent(
        `gameTypeId=2 and seasonId<=${seasonId} and seasonId>=${seasonId} and ${field} likeIgnoreCase "%${clean}%"`,
    );
    return `${STATS}/${entity}/summary?isAggregate=false&isGame=false&sort=${sort}` +
        `&start=0&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=${cayenne}`;
}

/** Rows matching `query` for the season, or throws (callers fall back to client filtering). */
export async function searchPlayers(kind, query, {seasonId, force} = {}) {
    const res = await request(nameSearchUrl(kind, query, {seasonId}), {ttl: 10 * 60 * 1000, force});
    return Array.isArray(res?.data) ? res.data : [];
}
