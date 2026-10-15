import {useMemo} from 'react';
import {buildRatings} from '../analytics';
import {nhl} from '../api/nhl';
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
