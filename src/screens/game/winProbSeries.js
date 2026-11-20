import {buildWpSeries, wpSeriesFromRows} from './liveRink';
import {rinksideAt} from './model';

/**
 * Home win-probability series [{t, p}] for a game: MoneyPuck's when it has one (the header and the
 * Win Prob tab use the same rule, so every view agrees), otherwise Rinkside's model replayed over
 * the goals. [] when neither is available.
 */
export function winProbSeries({mp, ratings, header, events, endT}) {
    const rows = mp?.series ? wpSeriesFromRows(mp.series) : [];
    if (rows.length > 2) return rows;
    if (!ratings) return [];
    const at = (t, hs, as) => {
        try {
            return rinksideAt(ratings, header, t, hs, as);
        } catch {
            return 0.5;
        }
    };
    return buildWpSeries(events, endT, at);
}
