// NHL Edge tracking data → the metrics shown on the player radial chart, each with a league percentile.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const loc = (rows, code) => (rows ?? []).find((r) => r?.locationCode === code);
const pct1 = (v) => (v == null ? '–' : `${(v * 100).toFixed(1)}%`);
const sv = (v) => (v == null ? '–' : v.toFixed(3).replace(/^0/, ''));

/** "92nd", "1st", "13th". */
export function ordinal(n) {
    const v = Math.round(n);
    const t = v % 100;
    const suffix = t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][v % 10] ?? 'th';
    return `${v}${suffix}`;
}

/**
 * Skater metrics: [{key, short, label, value, avg, percentile (0..1)}]; metric units when `metric`.
 * Metrics with no percentile are dropped.
 */
export function skaterEdge(d, metric = false) {
    if (!d) return [];
    const u = metric ? 'metric' : 'imperial';
    const speed = metric ? 'km/h' : 'mph';
    const dist = metric ? 'km' : 'mi';
    const fmt = (v, unit, dp = 1) => (v == null ? '–' : `${v.toFixed(dp)} ${unit}`);
    const all = loc(d.sogSummary, 'all');
    const high = loc(d.sogSummary, 'high');
    const z = d.zoneTimeDetails;
    const list = [
        {key: 'shot', short: 'Shot speed', label: 'Hardest shot', value: fmt(num(d.topShotSpeed?.[u]), speed), avg: fmt(num(d.topShotSpeed?.leagueAvg?.[u]), speed), percentile: num(d.topShotSpeed?.percentile)},
        {key: 'speed', short: 'Top speed', label: 'Top skating speed', value: fmt(num(d.skatingSpeed?.speedMax?.[u]), speed), avg: fmt(num(d.skatingSpeed?.speedMax?.leagueAvg?.[u]), speed), percentile: num(d.skatingSpeed?.speedMax?.percentile)},
        {key: 'bursts', short: 'Bursts', label: metric ? 'Bursts over 32 km/h' : 'Bursts over 20 mph', value: String(num(d.skatingSpeed?.burstsOver20?.value) ?? '–'), avg: num(d.skatingSpeed?.burstsOver20?.leagueAvg?.value)?.toFixed(1) ?? '–', percentile: num(d.skatingSpeed?.burstsOver20?.percentile)},
        {key: 'distance', short: 'Distance', label: 'Distance skated', value: fmt(num(d.totalDistanceSkated?.[u]), dist), avg: fmt(num(d.totalDistanceSkated?.leagueAvg?.[u]), dist), percentile: num(d.totalDistanceSkated?.percentile)},
        {key: 'oz', short: 'O-zone', label: 'Offensive zone time', value: pct1(num(z?.offensiveZonePctg)), avg: pct1(num(z?.offensiveZoneLeagueAvg)), percentile: num(z?.offensiveZonePercentile)},
        {key: 'shots', short: 'Shots', label: 'Shots on goal', value: String(num(all?.shots) ?? '–'), avg: num(all?.shotsLeagueAvg)?.toFixed(1) ?? '–', percentile: num(all?.shotsPercentile)},
        {key: 'hd', short: 'HD shots', label: 'High-danger shots', value: String(num(high?.shots) ?? '–'), avg: num(high?.shotsLeagueAvg)?.toFixed(1) ?? '–', percentile: num(high?.shotsPercentile)},
        {key: 'goals', short: 'Goals', label: 'Goals', value: String(num(all?.goals) ?? '–'), avg: num(all?.goalsLeagueAvg)?.toFixed(1) ?? '–', percentile: num(all?.goalsPercentile)},
    ];
    return list.filter((m) => m.percentile != null);
}

/** Goalie metrics, same shape as skaterEdge(). */
export function goalieEdge(d) {
    if (!d) return [];
    const s = d.stats ?? {};
    const all = loc(d.shotLocationSummary, 'all');
    const high = loc(d.shotLocationSummary, 'high');
    const mid = loc(d.shotLocationSummary, 'mid');
    const list = [
        {key: 'sv', short: 'SV%', label: 'Save %', value: sv(num(all?.savePctg)), avg: sv(num(all?.savePctgLeagueAvg)), percentile: num(all?.savePctgPercentile)},
        {key: 'hd', short: 'HD SV%', label: 'High-danger save %', value: sv(num(high?.savePctg)), avg: sv(num(high?.savePctgLeagueAvg)), percentile: num(high?.savePctgPercentile)},
        {key: 'mid', short: 'Mid SV%', label: 'Mid-range save %', value: sv(num(mid?.savePctg)), avg: sv(num(mid?.savePctgLeagueAvg)), percentile: num(mid?.savePctgPercentile)},
        {key: 'gaa', short: 'GAA', label: 'Goals against avg.', value: num(s.goalsAgainstAvg?.value)?.toFixed(2) ?? '–', avg: num(s.goalsAgainstAvg?.leagueAvg)?.toFixed(2) ?? '–', percentile: num(s.goalsAgainstAvg?.percentile)},
        {key: 'g900', short: '.900 GP', label: 'Games at .900 or better', value: pct1(num(s.gamesAbove900?.value)), avg: pct1(num(s.gamesAbove900?.leagueAvg)), percentile: num(s.gamesAbove900?.percentile)},
        {key: 'gd', short: 'GD / 60', label: 'Goal differential per 60', value: num(s.goalDifferentialPer60?.value)?.toFixed(2) ?? '–', avg: num(s.goalDifferentialPer60?.leagueAvg)?.toFixed(2) ?? '–', percentile: num(s.goalDifferentialPer60?.percentile)},
    ];
    return list.filter((m) => m.percentile != null);
}

/**
 * The extra Edge numbers that have no league percentile, as six plain tiles ({label, value}) for
 * a stat grid. d: skater-comparison / goalie-comparison payload.
 */
export function edgeTiles(d, goalie, metric = false) {
    if (!d) return [];
    if (goalie) {
        const five = d.savePctg5v5Details ?? {};
        const all = d.savePctgDetails ?? {};
        const games = (d.savePctgLast10 ?? []).map((g) => num(g.savePctg)).filter((v) => v != null);
        const started = all.pctgGamesAbove900 > 0 ? Math.round(num(all.gamesAbove900) / num(all.pctgGamesAbove900)) : null;
        return [
            {label: '5v5 save %', value: sv(num(five.savePctg))},
            {label: 'Close save %', value: sv(num(five.savePctgClose))},
            {label: 'Shots / 60', value: num(five.shotsPer60)?.toFixed(1) ?? '–'},
            {label: '.900+ games', value: num(all.gamesAbove900) != null ? `${all.gamesAbove900}${started ? ` of ${started}` : ''}` : '–'},
            {label: 'Point %', value: pct1(num(all.pointPctg))},
            {label: 'Best game', value: games.length ? sv(Math.max(...games)) : '–'},
        ].filter((t) => t.value !== '–');
    }
    const u = metric ? 'metric' : 'imperial';
    const speed = metric ? 'km/h' : 'mph';
    const dist = metric ? 'km' : 'mi';
    const shot = d.shotSpeedDetails ?? {};
    const skate = d.skatingSpeedDetails ?? {};
    const distance = d.skatingDistanceDetails ?? {};
    const hard = ['shotAttemptsOver100', 'shotAttempts90To100', 'shotAttempts80To90'].reduce((s, k) => s + (num(shot[k]) ?? 0), 0);
    const f1 = (v, unit) => (v == null ? '–' : `${v.toFixed(1)} ${unit}`);
    return [
        {label: 'Avg shot', value: f1(num(shot.avgShotSpeed?.[u]), speed)},
        {label: metric ? 'Shots 129+ km/h' : 'Shots 80+ mph', value: String(hard)},
        {label: metric ? 'Bursts 35+ km/h' : 'Bursts 22+ mph', value: String(num(skate.burstsOver22) ?? '–')},
        {label: 'Distance / 60', value: f1(num(distance.distancePer60?.[u]), dist)},
        {label: 'Max game dist.', value: f1(num(distance.distanceMaxGame?.[u]), dist)},
        {label: 'O-zone starts', value: pct1(num(d.zoneStarts?.offensiveZoneStarts))},
    ].filter((t) => !t.value.startsWith('–'));
}
