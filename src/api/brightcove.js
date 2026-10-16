// NHL videos (recaps, condensed games, goal clips) are hosted on Brightcove. The public Playback API
// returns clear (non-DRM) HLS and MP4 renditions, so they can play natively instead of in a web page.
const ACCOUNT = '6415718365001';
const PLAYER_JS = `https://players.brightcove.net/${ACCOUNT}/EXtG1xJ7H_default/index.min.js`;
// The policy key the NHL web player ships with. Re-read from the player script if it's ever rotated.
const FALLBACK_KEY =
    'BCpkADawqM3l37Vq8trLJ95vVwxubXYZXYglAopEZXQTHTWX3YdalyF9xmkuknxjBgiMYwt8VZ_OZ1jAjYxz_yzuNh_cjC3uOaMspVTD-hZfNUHtNnBnhVD0Gmsih8TBF8QlQFXiCQM3W_u4ydJ1qK2Rx8ZutCUg3PHb7Q';

let policyKey = FALLBACK_KEY;
const cache = new Map(); // videoId → {at, promise}
const TTL_MS = 20 * 60 * 1000; // stream URLs are CDN-signed and expire

/**
 * Brightcove video id from a number, a numeric string, or an nhl.com video URL/path
 * ("/video/col-uta-recap-6383501558112"). Null when there isn't one.
 */
export function videoIdOf(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return String(v);
    const s = String(v);
    if (/^\d+$/.test(s)) return s;
    const m = s.match(/videoId=(\d{8,})/) ?? s.match(/(\d{10,})\/?(?:[?#].*)?$/);
    return m ? m[1] : null;
}

async function refreshKey() {
    const js = await fetch(PLAYER_JS).then((r) => r.text());
    const m = js.match(/policyKey:"([^"]+)"/);
    if (m) policyKey = m[1];
    return !!m;
}

async function fetchPlayback(id) {
    return fetch(`https://edge.api.brightcove.com/playback/v1/accounts/${ACCOUNT}/videos/${id}`, {
        headers: {Accept: `application/json;pk=${policyKey}`},
    });
}

/** Prefer https HLS (adaptive), then the highest https MP4. */
function pickSource(sources = []) {
    const https = sources.filter((s) => s?.src?.startsWith('https://'));
    const hls = https.find((s) => s.type === 'application/x-mpegURL' && !s.key_systems);
    if (hls) return {uri: hls.src, contentType: 'hls'};
    const mp4 = https.filter((s) => s.container === 'MP4').sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
    return mp4 ? {uri: mp4.src, contentType: 'progressive'} : null;
}

async function load(id) {
    let res = await fetchPlayback(id);
    if ((res.status === 401 || res.status === 403) && (await refreshKey().catch(() => false))) res = await fetchPlayback(id);
    if (!res.ok) throw new Error(`Video unavailable (${res.status})`);
    const data = await res.json();
    const source = pickSource(data.sources);
    if (!source) throw new Error('No playable stream');
    return {...source, title: data.name ?? null, poster: data.poster ?? null, duration: data.duration ?? null};
}

/** {uri, contentType, title, poster, duration} for a Brightcove video id. Cached briefly per id; failures aren't. */
export function videoSource(id) {
    const key = String(id);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
    const promise = load(key).catch((e) => {
        cache.delete(key);
        throw e;
    });
    cache.set(key, {at: Date.now(), promise});
    return promise;
}
