// Pure text/number formatting for the shareable game card. No React.
const ORD = ['', '1st', '2nd', '3rd'];

/** "1st", "2nd", "3rd", "OT", "2OT" … for a period number. */
export function periodName(n) {
    if (n <= 3) return ORD[n] ?? `${n}th`;
    return n === 4 ? 'OT' : `${n - 3}OT`;
}

/** "FINAL", "FINAL · OT", "FINAL · SO", or "LIVE · 2nd 12:34" for the card's badge. */
export function resultLabel(header) {
    if (header.final) {
        const t = header.lastPeriodType;
        return t === 'OT' ? 'FINAL · OT' : t === 'SO' ? 'FINAL · SO' : 'FINAL';
    }
    if (header.live) {
        const p = periodName(header.period || 1);
        return header.clock?.inIntermission ? `LIVE · ${p} INT` : `LIVE · ${p} ${header.clock?.timeRemaining ?? ''}`.trim();
    }
    return 'GAME';
}

/**
 * One line per goal for a team: "Barzal · 1st 5:00". At most `max`, with the rest summarised as "+N more".
 * goals: [{isHome, lastName, name, period, timeInPeriod}] in game order.
 */
export function goalLines(goals, isHome, max = 4) {
    const mine = (goals ?? []).filter((g) => g.isHome === isHome);
    const lines = mine.slice(0, max).map((g) => {
        const who = g.lastName || (g.name ? g.name.split(' ').slice(-1)[0] : 'Goal');
        const m = String(g.timeInPeriod ?? '').replace(/^0/, '');
        return `${who} · ${periodName(g.period)} ${m}`.trim();
    });
    if (mine.length > max) lines.push(`+${mine.length - max} more`);
    return lines;
}

/** Whole-percent split that always sums to 100 (so "57% / 43%", never "57% / 44%"). */
export function percentPair(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a + b <= 0) return null;
    const x = Math.round((a / (a + b)) * 100);
    return [x, 100 - x];
}

/** Which tiles the card shows, skipping any we have no data for. [{label, home, away}] */
export function statTiles({header, xg, dtw}) {
    const tiles = [];
    const hs = header.home.sog;
    const as = header.away.sog;
    if (hs != null && as != null) tiles.push({label: 'SHOTS', home: String(hs), away: String(as)});
    if (xg && Number.isFinite(xg.home?.xg) && Number.isFinite(xg.away?.xg) && (xg.home.shots.length || xg.away.shots.length)) {
        tiles.push({label: 'xG', home: xg.home.xg.toFixed(2), away: xg.away.xg.toFixed(2)});
    }
    const split = dtw ? percentPair(dtw.home, dtw.away) : null;
    if (split) tiles.push({label: 'DESERVED', home: `${split[0]}%`, away: `${split[1]}%`});
    return tiles;
}

/** A hook line for the card: the most interesting true thing about the game. */
export function headline({header, excitement, dtw}) {
    const h = header.home.score ?? 0;
    const a = header.away.score ?? 0;
    const winnerIsHome = h > a;
    const winner = winnerIsHome ? header.home.abbrev : header.away.abbrev;
    const loser = winnerIsHome ? header.away.abbrev : header.home.abbrev;
    if (header.final && h !== a) {
        const comeback = excitement?.comeback;
        if (Number.isFinite(comeback) && comeback < 0.12) return `${winner} won from ${Math.round(comeback * 100)}% win probability`;
        if (dtw) {
            const winnerDtw = winnerIsHome ? dtw.home : dtw.away;
            if (Number.isFinite(winnerDtw) && winnerDtw < 0.3) return `${winner} won with only a ${Math.round(winnerDtw * 100)}% chance to deserve it`;
            if (Number.isFinite(winnerDtw) && winnerDtw > 0.85) return `${winner} dominated ${loser}`;
        }
    }
    return excitement?.label ?? null;
}
