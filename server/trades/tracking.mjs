// Assist positions from the NHL's goal tracking replays.
//
// The play-by-play lists a goal's assisters by player id only. Each goal also links a tracking clip
// (`pptReplayUrl`: ~14 s of puck and player positions at 10 Hz, in inches on a 2400 x 1020 rink). We read the
// clip and report where each assister last had the puck, i.e. roughly where the pass was made.
//
// This is NOT an official API. wsr.nhle.com answers only browser-looking requests, so the headers below
// imitate a browser on nhl.com. It can stop working without notice; every caller must treat "no data" as normal.
// Set NHL_TRACKING=off to disable it entirely.

const API = 'https://api-web.nhle.com/v1/gamecenter';
const CLIP_HOST = 'wsr.nhle.com';
const BROWSER = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    Referer: 'https://www.nhl.com/',
    Origin: 'https://www.nhl.com',
};
const TOUCH_INCHES = 60; // within 5 ft of the puck counts as having it
const FOUND_TTL = 7 * 24 * 3600 * 1000; // a goal's clip never changes once it exists
const MISS_TTL = 60 * 1000; // clip not published yet, or the request failed: try again soon
const MAX_GAMES = 200;

/** Tracking inches (origin: top-left corner) to the play-by-play's feet (origin: centre ice), rounded to 0.1 ft. */
const toFeet = (x, y) => ({x: Math.round((x / 12 - 100) * 10) / 10, y: Math.round((42.5 - y / 12) * 10) / 10});
const point = v => Number.isFinite(v?.x) && Number.isFinite(v?.y) ? v : null;
const playerAt = (frame, id) => point(Object.values(frame.onIce ?? {}).find(v => v.playerId === id));
const puckAt = frame => point(Object.values(frame.onIce ?? {}).find(v => !v.playerId));

/** Last frame (at or before `limit`) in which `playerId` was within reach of the puck, or -1. */
function lastTouch(frames, playerId, limit = frames.length - 1) {
    for (let i = Math.min(limit, frames.length - 1); i >= 0; i--) {
        const p = playerAt(frames[i], playerId);
        const puck = puckAt(frames[i]);
        if (p && puck && Math.hypot(p.x - puck.x, p.y - puck.y) < TOUCH_INCHES) return i;
    }
    return -1;
}

/**
 * Where each assister last had the puck before the scorer's final touch.
 * Returns {a1, a2}: {x, y} in feet (raw play-by-play orientation) or null when that player can't be placed.
 */
export function assistPositions(frames, {scorer, assist1, assist2}) {
    if (!Array.isArray(frames) || !frames.length) return {a1: null, a2: null};
    const scorerTouch = lastTouch(frames, scorer);
    const limit = scorerTouch >= 0 ? scorerTouch : frames.length - 1;
    const place = id => {
        if (!id) return null;
        const i = lastTouch(frames, id, limit);
        const p = i >= 0 ? playerAt(frames[i], id) : null;
        return p && p.x >= 0 && p.x <= 2400 && p.y >= 0 && p.y <= 1020 ? toFeet(p.x, p.y) : null;
    };
    return {a1: place(assist1), a2: place(assist2)};
}

export function createTracking({fetchImpl = fetch, now = () => Date.now(), enabled = process.env.NHL_TRACKING !== 'off'} = {}) {
    const games = new Map(); // gameId -> Map(eventId -> {at, ttl, value})
    const inflight = new Map(); // gameId -> Promise
    let running = 0;
    const waiting = [];
    const slot = async fn => { // at most two upstream requests at once
        if (running >= 2) await new Promise(resolve => waiting.push(resolve));
        running++;
        try { return await fn(); } finally { running--; waiting.shift()?.(); }
    };
    const getJson = (url, headers) => slot(async () => {
        const response = await fetchImpl(url, {headers, signal: AbortSignal.timeout(10000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    });

    async function compute(gameId) {
        const cache = games.get(gameId) ?? new Map();
        games.set(gameId, cache);
        if (games.size > MAX_GAMES) games.delete(games.keys().next().value);
        const pbp = await getJson(`${API}/${gameId}/play-by-play`, {Accept: 'application/json'});
        const goals = (pbp.plays ?? []).filter(p => p.typeDescKey === 'goal' && p.details?.scoringPlayerId);
        await Promise.all(goals.map(async play => {
            const id = String(play.eventId);
            const hit = cache.get(id);
            if (hit && now() - hit.at < hit.ttl) return;
            const d = play.details;
            let value = null;
            try {
                const clip = new URL(play.pptReplayUrl);
                if (clip.protocol === 'https:' && clip.hostname === CLIP_HOST) {
                    value = assistPositions(await getJson(clip.href, BROWSER), {scorer: d.scoringPlayerId, assist1: d.assist1PlayerId, assist2: d.assist2PlayerId});
                }
            } catch { /* leave null: no data is a normal answer */ }
            cache.set(id, {at: now(), ttl: value ? FOUND_TTL : MISS_TTL, value});
        }));
    }

    /** {eventId: {a1, a2}} for every goal of a game we could place. */
    return async function goalAssists(gameId) {
        if (!enabled) return {};
        if (!/^\d{10}$/.test(String(gameId))) throw Object.assign(new Error('Invalid game id'), {status: 400});
        const key = String(gameId);
        if (!inflight.has(key)) inflight.set(key, compute(key).finally(() => inflight.delete(key)));
        await inflight.get(key);
        const out = {};
        for (const [id, hit] of games.get(key) ?? []) if (hit.value) out[id] = hit.value;
        return out;
    };
}
