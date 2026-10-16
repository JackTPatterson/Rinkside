// Polite, disk-cached fetch. Installed as globalThis.fetch so the app's own api/client.js
// request() layer (and therefore nhl.* / moneypuck.* / preGameHomeWinProb) goes through it.
//  - raw response bodies are gzipped under scripts/.cache/<host>/...; 404s are cached as markers
//  - per-host concurrency limit + minimum gap between request starts
//  - retries 5xx / network errors with backoff
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const realFetch = globalThis.fetch;
const UA = 'RinksideBacktest/1.0 (personal model evaluation; cached, throttled)';

export function createCachedFetch({cacheDir, perHost = 3, gapMs = 150, offline = false, log = () => {}}) {
    const hosts = new Map(); // host -> {active, queue: [], lastStart}
    const stats = {hits: 0, fetched: 0, notFound: 0, errors: 0};

    function fileFor(url) {
        const u = new URL(url);
        const safe = (u.pathname + u.search).replace(/^\//, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 200);
        return path.join(cacheDir, u.host, safe);
    }

    function slot(host) {
        let h = hosts.get(host);
        if (!h) {
            h = {active: 0, queue: [], lastStart: 0};
            hosts.set(host, h);
        }
        return new Promise((resolve) => {
            h.queue.push(resolve);
            pump(h);
        });
    }
    function pump(h) {
        if (h.active >= perHost || !h.queue.length) return;
        const wait = Math.max(0, h.lastStart + gapMs - Date.now());
        if (wait > 0) {
            if (!h.timer) h.timer = setTimeout(() => {
                h.timer = null;
                pump(h);
            }, wait);
            return;
        }
        h.active++;
        h.lastStart = Date.now();
        const next = h.queue.shift();
        next(() => {
            h.active--;
            pump(h);
        });
        pump(h);
    }

    const respond = (status, body) => ({ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body)});

    async function cachedFetch(input, init = {}) {
        const url = typeof input === 'string' ? input : input.url;
        const file = fileFor(url);
        if (fs.existsSync(`${file}.404`)) {
            stats.hits++;
            stats.notFound++;
            return respond(404, '');
        }
        if (fs.existsSync(`${file}.gz`)) {
            stats.hits++;
            return respond(200, zlib.gunzipSync(fs.readFileSync(`${file}.gz`)).toString('utf8'));
        }
        if (offline) {
            stats.notFound++;
            return respond(404, '');
        }
        const host = new URL(url).host;
        for (let attempt = 0; ; attempt++) {
            const release = await slot(host);
            let res;
            let body;
            try {
                res = await realFetch(url, {headers: {'user-agent': UA, ...(init.headers ?? {})}, signal: AbortSignal.timeout(30000)});
                body = await res.text();
            } catch (e) {
                res = null;
                body = String(e?.message ?? e);
            } finally {
                release();
            }
            // Only 200 and 404 are cached; 403 / 429 / 5xx (rate limits, outages) are retried.
            if (res && (res.ok || res.status === 404)) {
                fs.mkdirSync(path.dirname(file), {recursive: true});
                if (res.ok) {
                    fs.writeFileSync(`${file}.gz`, zlib.gzipSync(body));
                    stats.fetched++;
                    return respond(200, body);
                }
                // MoneyPuck answers missing files with 404: a real "no file" answer.
                fs.writeFileSync(`${file}.404`, String(res.status));
                stats.notFound++;
                return respond(404, '');
            }
            if (attempt >= 5) {
                stats.errors++;
                log(`  ! giving up on ${url}: ${res ? `HTTP ${res.status}` : body}`);
                return respond(res?.status ?? 599, '');
            }
            log(`  … retry ${attempt + 1} for ${url} (${res ? `HTTP ${res.status}` : body})`);
            await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
        }
    }
    cachedFetch.stats = stats;
    return cachedFetch;
}
