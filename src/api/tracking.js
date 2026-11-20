import {request} from './client';

const BASE = (process.env.EXPO_PUBLIC_TRADE_API_URL || '').replace(/\/$/, '');
export const trackingConfigured = !!BASE;

/**
 * Where each assister last had the puck, per goal: {[eventId]: {a1: {x, y}|null, a2: {x, y}|null}}, in the
 * play-by-play's feet. It comes from the NHL's (unofficial) goal tracking clips via our server, which can be
 * missing or empty at any time, so callers must work without it.
 */
export async function fetchGoalAssists(gameId, {force} = {}) {
    if (!BASE) return {};
    const data = await request(`${BASE}/games/${gameId}/assists`, {ttl: 60000, force});
    return data?.goals ?? {};
}
