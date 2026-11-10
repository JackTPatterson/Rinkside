import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {buildStories, hash, LEVELS, sources, validateReport} from './model.mjs';

const same = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
async function body(req) {
    let data = '';
    for await (const chunk of req) {
        data += chunk;
        if (Buffer.byteLength(data) > 131072) throw Object.assign(new Error('Request too large'), {status: 413});
    }
    try { return JSON.parse(data); } catch { throw Object.assign(new Error('Invalid JSON'), {status: 400}); }
}
export function createAPI(store, {adminToken, trustedProxy} = {}) {
    const limits = new Map();
    return createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
        try {
            // Behind a reverse proxy (TRUSTED_PROXY = its peer address), key on the client it forwards for.
            const peer = req.socket.remoteAddress;
            const forwarded = trustedProxy && peer?.replace(/^::ffff:/, '') === trustedProxy && String(req.headers['x-forwarded-for'] ?? '').split(',').pop().trim();
            const ip = forwarded || peer;
            const minute = Math.floor(Date.now() / 60000);
            if (limits.size > 10000) limits.clear();
            const rate = limits.get(ip);
            const count = rate?.minute === minute ? rate.count + 1 : 1;
            limits.set(ip, {minute, count});
            if (count > 120) return send(429, {error: 'Too many requests'});
            const url = new URL(req.url, 'http://localhost');
            if (req.method === 'GET' && url.pathname === '/health') return send(200, {ok: true});
            if (req.method === 'GET' && url.pathname === '/trades') {
                const team = url.searchParams.get('team');
                return send(200, {stories: buildStories(store.list('reports')).filter(s => !team || s.teams.includes(team)).slice(0, 100),
                    sources: sources.filter(s => s.kind !== 'editorial').map(s => store.get('sources', s.id) ?? {id: s.id, name: s.name, status: 'pending'}),
                    fetchedAt: new Date().toISOString()});
            }
            const subscription = /^\/subscriptions\/([a-f0-9-]{36})$/.exec(url.pathname);
            const secret = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
            if (subscription && req.method === 'PUT') {
                if (!/^[a-f0-9-]{72}$/.test(secret)) return send(401, {error: 'Invalid device credential'});
                const data = await body(req);
                if (typeof data.enabled !== 'boolean' || !Object.hasOwn(LEVELS, data.minimum) ||
                    (data.team !== null && !/^[A-Z]{3}$/.test(data.team)) ||
                    typeof data.token !== 'string' || !/^(Expo|Exponent)PushToken\[[\w-]+\]$/.test(data.token)) return send(400, {error: 'Invalid subscription'});
                store.subscribe(subscription[1], secret, {enabled: data.enabled, minimum: data.minimum, team: data.team, token: data.token});
                return send(200, {ok: true});
            }
            if (req.method === 'POST' && url.pathname === '/reports') {
                if (!adminToken || !same(secret, adminToken)) return send(401, {error: 'Unauthorized'});
                const input = await body(req);
                if (!Array.isArray(input) || input.length > 100) return send(400, {error: 'Expected at most 100 reports'});
                let reports;
                try { reports = input.map(r => validateReport({...r, reviewed: true})); }
                catch (error) { return send(400, {error: error.message}); }
                for (const report of reports) store.put('reports', report.id, report);
                return send(200, {accepted: reports.length});
            }
            return send(404, {error: 'Not found'});
        } catch (error) { send(error.status ?? 500, {error: error.status ? error.message : 'Request failed'}); }
    });
}
