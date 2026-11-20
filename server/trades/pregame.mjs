import {playoffLine} from './standings.mjs';

export const PREGAME_LEAD = 90 * 60000; // send this long before puck drop
const surname = name => String(name ?? '').split(' ').slice(1).join(' ') || name;

/** How a goalie reads in the blurb. strength: DailyFaceoff's 'Confirmed' | 'Likely' | ... */
export function goalieText(goalie) {
    if (!goalie?.name) return 'TBD';
    return `${surname(goalie.name)} (${goalie.strength === 'Confirmed' ? 'confirmed' : 'expected'})`;
}
export const goalieConfirmed = goalie => !!goalie?.name && goalie.strength === 'Confirmed';

function timeText(startsAt, tz) {
    try { return new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short'}).format(startsAt); }
    catch { return new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short'}).format(startsAt); }
}

/**
 * The pregame push for one team's game.
 *   game: {startsAt, home, away}; rows: standings rows; goalies: {mine, opp} (or null); near: nearMilestones() texts; tz: IANA zone.
 */
export function pregameMessage({game, team, rows, goalies, near = [], tz}) {
    const home = game.home === team;
    const opponent = home ? game.away : game.home;
    const lines = [];
    const race = playoffLine(rows, team, opponent);
    if (race) lines.push(race);
    if (goalies) lines.push(`Goalies: ${team} ${goalieText(goalies.mine)}, ${opponent} ${goalieText(goalies.opp)}.`);
    const mine = rows.find(r => (r.teamAbbrev?.default ?? r.teamAbbrev) === team);
    if (near[0]) lines.push(near[0].text);
    else if (mine?.l10Wins != null) lines.push(`${mine.l10Wins}-${mine.l10Losses}-${mine.l10OtLosses} in the last 10.`);
    return {title: `${team} ${home ? 'host' : 'visit'} ${opponent} at ${timeText(game.startsAt, tz)}`, body: lines.join('\n')};
}

/** The goalie rows for one game out of DailyFaceoff's day map, from `team`'s point of view; null when the game isn't listed. */
export function goaliesFor(map, game, team) {
    const entry = map?.[`${game.away}@${game.home}`];
    if (!entry) return null;
    return team === game.home ? {mine: entry.home, opp: entry.away} : {mine: entry.away, opp: entry.home};
}
