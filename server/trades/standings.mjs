// Playoff position from the standings: top three in a division, or one of the conference's two wild cards.
export const MIN_GAMES = 10; // before this, "out of a playoff spot" is mostly noise

const abbrev = row => row.teamAbbrev?.default ?? row.teamAbbrev;
const common = row => row.teamCommonName?.default ?? row.teamName?.default ?? abbrev(row);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const ordinal = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10 < 4 ? n % 10 : 0]}`;

/** 'division' | 'wildcard' | null (out). */
export function spotOf(row) {
    if (row.divisionSequence >= 1 && row.divisionSequence <= 3) return 'division';
    if (row.wildcardSequence === 1 || row.wildcardSequence === 2) return 'wildcard';
    return null;
}

/** Where a team sits against its conference's cut line (the second wild card). */
export function describeSpot(rows, team) {
    const row = rows.find(r => abbrev(r) === team);
    if (!row) return null;
    const conference = rows.filter(r => r.conferenceAbbrev === row.conferenceAbbrev);
    const wc2 = conference.find(r => r.wildcardSequence === 2);
    const firstOut = conference.find(r => r.wildcardSequence === 3);
    const spot = spotOf(row);
    // Points from the cut line: how far above the first team out, or (when out) how far behind the second wild card.
    const margin = spot ? row.points - (firstOut?.points ?? row.points) : row.points - (wc2?.points ?? row.points);
    return {row, abbrev: team, name: common(row), spot, points: row.points, gamesPlayed: row.gamesPlayed, margin, wc2, firstOut,
        rival: spot ? firstOut : wc2, gamesInHand: spot ? 0 : Math.max(0, (wc2?.gamesPlayed ?? row.gamesPlayed) - row.gamesPlayed)};
}

/**
 * Compare the standings with the last state and report teams that left or entered a playoff spot.
 * A change must show up in two consecutive reads before it counts, so one-night shuffles don't buzz anyone.
 * The first read only records a baseline.
 */
export function playoffChanges(state, rows, {minGames = MIN_GAMES} = {}) {
    const spots = {};
    for (const row of rows) spots[abbrev(row)] = spotOf(row) ?? 'out';
    if (!state?.spots) return {state: {spots, pending: {}}, events: []};
    const next = {spots: {...state.spots}, pending: {...state.pending}};
    const events = [];
    for (const row of rows) {
        const team = abbrev(row);
        const was = state.spots[team];
        if (!was || row.gamesPlayed < minGames) { next.spots[team] = spots[team]; continue; }
        const nowIn = spots[team] !== 'out';
        if (nowIn === (was !== 'out')) { next.spots[team] = spots[team]; delete next.pending[team]; continue; }
        if (state.pending?.[team] === nowIn) { // seen twice in a row
            next.spots[team] = spots[team];
            delete next.pending[team];
            events.push({team, kind: nowIn ? 'in' : 'out'});
        } else next.pending[team] = nowIn; // keep the old spot until it repeats
    }
    return {state: next, events};
}

export function standingsMessage(kind, rows, team) {
    const d = describeSpot(rows, team);
    if (!d) return null;
    const rival = d.rival ? common(d.rival) : null;
    if (kind === 'out') {
        const gap = d.wc2 ? d.wc2.points - d.points : null;
        const behind = gap == null || !rival ? 'The race is tight.'
            : gap === 0 ? `Level on points with ${rival} for the last wild card, but behind on tiebreakers.`
                : `${plural(gap, 'point')} behind ${rival} for the last wild card.`;
        return {title: `${d.name} are out of a playoff spot`, body: `${behind}${d.gamesInHand ? ` ${plural(d.gamesInHand, 'game')} in hand.` : ''}`};
    }
    const holding = d.spot === 'division' ? `a ${ordinal(d.row.divisionSequence)}-place division spot` : `${d.row.wildcardSequence === 1 ? 'the first' : 'the second'} wild card`;
    const lead = d.firstOut ? d.points - d.firstOut.points : null;
    return {title: `${d.name} are back in a playoff spot`,
        body: `Holding ${holding}${lead != null && rival ? `, ${lead === 0 ? 'level on points with' : `${plural(lead, 'point')} ahead of`} ${rival}` : ''}.`};
}

/** One line on what the game means for a team's playoff position, or null when there's nothing to say yet. */
export function playoffLine(rows, mine, opponent) {
    const a = describeSpot(rows, mine);
    if (!a) return null;
    if (a.gamesPlayed < MIN_GAMES) return `Early in the season: ${a.points} points through ${a.gamesPlayed} games.`;
    const b = describeSpot(rows, opponent);
    const close = d => d && Math.abs(d.margin) <= 4;
    const sameConference = b && a.row.conferenceAbbrev === b.row.conferenceAbbrev;
    if (close(a) && close(b) && sameConference) return `A direct playoff-race game: both teams are within ${Math.max(Math.abs(a.margin), Math.abs(b.margin)) || 1} points of the cut line.`;
    if (!a.spot && close(a)) return `${plural(-a.margin, 'point')} out of the last wild card${a.margin === 0 ? '' : '; a win closes the gap'}.`;
    if (a.spot === 'wildcard' && close(a)) return `Holding the ${a.row.wildcardSequence === 1 ? 'first' : 'second'} wild card by ${plural(a.margin, 'point')}.`;
    const conference = a.row.conferenceName ?? a.row.conferenceAbbrev;
    return `${ordinal(a.row.conferenceSequence)} in the ${conference} with ${a.points} points.`;
}
