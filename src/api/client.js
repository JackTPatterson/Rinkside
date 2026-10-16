import AsyncStorage from '@react-native-async-storage/async-storage';
import Papa from 'papaparse';

// Small fetch layer shared by every screen:
//  - in-memory TTL cache, so tab switches / re-mounts don't refetch
//  - in-flight de-duplication, so N cards asking for the same CSV make one request
//  - timeouts + one retry on network failure
//  - optional AsyncStorage persistence for stale-while-revalidate on cold start

const memory = new Map(); // key -> {value, at}
const inflight = new Map(); // key -> Promise
const PERSIST_PREFIX = 'rs-cache:v1:';

export class HttpError extends Error {
    constructor(status, url) {
        super(`HTTP ${status} for ${url}`);
        this.status = status;
        this.url = url;
    }
}

async function fetchWithTimeout(url, {timeout = 12000, headers} = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {headers, signal: controller.signal});
        if (!res.ok) throw new HttpError(res.status, url);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

async function fetchTextWithRetry(url, opts) {
    try {
        return await fetchWithTimeout(url, opts);
    } catch (e) {
        // 4xx won't change on retry (MoneyPuck 404s for games it has no file for yet).
        if (e instanceof HttpError && e.status >= 400 && e.status < 500) throw e;
        await new Promise((r) => setTimeout(r, 600));
        return fetchWithTimeout(url, opts);
    }
}

export function parseCSV(text) {
    const {data} = Papa.parse(text, {header: true, skipEmptyLines: true, dynamicTyping: true});
    return data;
}

const PARSERS = {
    json: (t) => JSON.parse(t),
    csv: parseCSV,
    text: (t) => t,
    // A Next.js page's server data (the JSON in <script id="__NEXT_DATA__">): its pageProps.
    nextData: (t) => {
        const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(t);
        if (!m) throw new Error('No page data');
        return JSON.parse(m[1])?.props?.pageProps ?? null;
    },
};

/**
 * Cached request.
 * @param {string} url
 * @param {{type?: 'json'|'csv'|'text'|'nextData', ttl?: number, persist?: boolean, force?: boolean}} opts
 *   ttl: ms a cached value is considered fresh (default 60s).
 */
export async function request(url, {type = 'json', ttl = 60000, persist = false, force = false} = {}) {
    const key = `${type}:${url}`;
    const hit = memory.get(key);
    if (!force && hit && Date.now() - hit.at < ttl) return hit.value;
    if (inflight.has(key)) return inflight.get(key);

    const p = (async () => {
        let text;
        try {
            text = await fetchTextWithRetry(url, {
                headers: type === 'json' ? {accept: 'application/json'} : undefined,
            });
        } catch (e) {
            // Offline / server down: serve the last copy we have rather than an error screen.
            // A 404 is a real answer ("no such file"), so don't mask it.
            const is404 = e instanceof HttpError && e.status === 404;
            if (!is404) {
                const stale = hit?.value ?? (persist ? await readPersisted(url, type) : undefined);
                if (stale !== undefined) return stale;
            }
            throw e;
        }
        const value = PARSERS[type](text);
        memory.set(key, {value, at: Date.now()});
        if (persist) {
            AsyncStorage.setItem(PERSIST_PREFIX + key, JSON.stringify({value, at: Date.now()})).catch(() => {});
        }
        return value;
    })();
    inflight.set(key, p);
    try {
        return await p;
    } finally {
        inflight.delete(key);
    }
}

/** Last persisted value for a request (any age), or undefined. Used to paint instantly on launch. */
export async function readPersisted(url, type = 'json') {
    const key = `${type}:${url}`;
    const hit = memory.get(key);
    if (hit) return hit.value;
    try {
        const raw = await AsyncStorage.getItem(PERSIST_PREFIX + key);
        if (!raw) return undefined;
        const {value, at} = JSON.parse(raw);
        // Seed memory as already-stale so the next request() still revalidates.
        memory.set(key, {value, at: 0});
        return value;
    } catch {
        return undefined;
    }
}

/** Synchronous peek at the in-memory cache (any age). */
export function peek(url, type = 'json') {
    return memory.get(`${type}:${url}`)?.value;
}

export function clearCache() {
    memory.clear();
    return AsyncStorage.getAllKeys()
        .then((keys) => AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PERSIST_PREFIX))))
        .catch(() => {});
}
