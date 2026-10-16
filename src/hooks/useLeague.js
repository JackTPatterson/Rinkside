import {useMemo} from 'react';
import {buildRatings} from '../analytics';
import {nhl} from '../api/nhl';
import {addDays, parseISODate, toISODate} from '../utils/format';
import {useQuery} from './useQuery';

// Ratings are derived from the standings object; memoise across screens so the model is
// calibrated once per standings refresh, not once per mount.
let lastStandings = null;
let lastRatings = null;
function ratingsFor(standings) {
    if (!standings) return null;
    if (standings !== lastStandings) {
        lastStandings = standings;
        lastRatings = buildRatings(standings);
    }
    return lastRatings;
}

/** League standings + calibrated game-model ratings. {standings, ratings, loading, error, refresh} */
export function useLeague() {
    const q = useQuery(({force}) => nhl.standings({force}), []);
    const ratings = useMemo(() => ratingsFor(q.data), [q.data]);
    return {...q, standings: q.data, ratings};
}

const pastRatings = new Map(); // standings snapshot date → ratings (bounded below)

/**
 * Ratings as they stood before a game on `gameDate` (YYYY-MM-DD), so a past game's pregame model
 * number only uses results from before that game. Today and later games use the current ratings.
 * {ratings, loading}
 */
export function useRatingsBefore(gameDate) {
    const league = useLeague();
    const today = toISODate();
    const past = !!gameDate && gameDate < today;
    const snapshotDate = past ? toISODate(addDays(parseISODate(gameDate), -1)) : null;
    const q = useQuery(({force}) => nhl.standingsAt(snapshotDate, {force}), [snapshotDate], {enabled: past});
    const ratings = useMemo(() => {
        if (!past) return league.ratings;
        if (!q.data) return null;
        if (!pastRatings.has(snapshotDate)) {
            if (pastRatings.size > 20) pastRatings.delete(pastRatings.keys().next().value);
            pastRatings.set(snapshotDate, buildRatings(q.data));
        }
        return pastRatings.get(snapshotDate);
    }, [past, league.ratings, q.data, snapshotDate]);
    return {ratings, loading: past ? q.loading : league.loading};
}
