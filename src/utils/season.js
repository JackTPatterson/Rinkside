// NHL seasons are identified as e.g. 20262027. A new season "starts" in September (preseason);
// during the summer we keep showing the season that just finished.
export function seasonStartYear(date = new Date()) {
    const y = date.getFullYear();
    return date.getMonth() >= 8 ? y : y - 1;
}

export function currentSeasonId(date = new Date()) {
    const y = seasonStartYear(date);
    return `${y}${y + 1}`;
}

export function previousSeasonId(seasonId = currentSeasonId()) {
    const y = parseInt(String(seasonId).slice(0, 4), 10) - 1;
    return `${y}${y + 1}`;
}

// MoneyPuck keys seasons by their starting year (2026 => 2026-27).
export function moneyPuckYear(seasonId = currentSeasonId()) {
    return String(seasonId).slice(0, 4);
}

export function seasonLabel(seasonId = currentSeasonId()) {
    const s = String(seasonId);
    return `${s.slice(0, 4)}-${s.slice(6, 8)}`;
}

export const REGULAR_SEASON_GAMES = 82;
