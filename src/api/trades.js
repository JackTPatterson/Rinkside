import {request} from './client';

const BASE = (process.env.EXPO_PUBLIC_TRADE_API_URL || '').replace(/\/$/, '');
export const tradeRadarConfigured = !!BASE;

export function fetchTrades({force} = {}) {
    if (!BASE) throw new Error('Trade Radar is not connected yet.');
    return request(`${BASE}/trades`, {ttl: 30000, force});
}

export async function saveTradeSubscription(identity, preferences) {
    if (!BASE) throw new Error('Trade Radar is not connected yet.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(`${BASE}/subscriptions/${identity.id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${identity.secret}`},
            body: JSON.stringify(preferences), signal: controller.signal,
        });
        if (!response.ok) throw new Error('Could not save your alerts. Please try again.');
    } finally { clearTimeout(timer); }
}
