import {XMLParser} from 'fast-xml-parser';
import {sources, tradeWords, validateReport, hash, DAY} from './model.mjs';
import fs from 'node:fs';

// Reuse the app's team names without adding React Native to the server dependency graph.
const teamText = fs.readFileSync(new URL('../../src/data/teams.js', import.meta.url), 'utf8');
const teams = [...teamText.matchAll(/abbrev: '([A-Z]{3})', name: '([^']+)'/g)].filter(m => m[1] !== 'ARI');
const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function detectTeams(text) {
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return teams.filter(([, code, name]) => {
        const words = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ');
        const nickname = words.slice(-1)[0];
        const city = words.join(' ').replace(/ (?:Maple Leafs|Red Wings|Blue Jackets|Golden Knights|[^ ]+)$/, '');
        const cityPattern = city === 'New York' ? '' : `|${city}`;
        return new RegExp(`\\b(${code}|${words.join(' ')}|${nickname}${cityPattern})\\b`, 'i').test(normalized);
    }).map(m => m[1]);
}
async function fetchOK(url, options = {}) {
    const res = await fetch(url, {...options, signal: AbortSignal.timeout(20000)});
    if (!res.ok) throw new Error(`Source returned HTTP ${res.status}`);
    return res;
}
export async function collectRSS(source) {
    const res = await fetchOK(source.url);
    const xml = await res.text();
    if (xml.length > 5_000_000) throw new Error('Feed exceeds size limit');
    const parsed = new XMLParser({ignoreAttributes: false, processEntities: false}).parse(xml);
    const raw = parsed.rss?.channel?.item;
    if (!raw) throw new Error('Source did not return an RSS feed');
    const items = Array.isArray(raw) ? raw : [raw];
    return items.slice(0, 100).flatMap(item => {
        const title = plain(item.title).slice(0, 600);
        if (!tradeWords.test(title)) return [];
        try {
            const references = [...String(item['content:encoded'] ?? item.description ?? '').matchAll(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/FriedgeHNIC\/status\/(\d+)/gi)];
            const ids = [...new Set(references.map(match => match[1]))];
            // Only group explicit single-report attribution; multi-claim roundups stay separate.
            const claimId = ids.length === 1 ? hash(`https://x.com/FriedgeHNIC/status/${ids[0]}`) : undefined;
            return [validateReport({sourceId: source.id, url: item.link, title, publishedAt: item.pubDate, claimId,
                originId: claimId ? 'friedman' : source.id, teams: detectTeams(`${title} ${plain(item.description)}`), independent: false})];
        } catch { return []; }
    });
}
export async function collectX(source, store, token) {
    if (!token) throw new Error('X API access is not configured');
    const headers = {Authorization: `Bearer ${token}`};
    const old = store.get('cursors', source.id) ?? {};
    let userId = old.userId;
    if (!userId) {
        const lookup = await (await fetchOK(`https://api.x.com/2/users/by/username/${source.handle}`, {headers})).json();
        userId = lookup.data?.id;
        if (!userId) throw new Error('X account lookup failed');
    }
    let next;
    let newest = old.sinceId;
    const reports = [];
    // Advance the cursor only after every page succeeds, so outages never skip unseen reports.
    do {
        const url = new URL(`https://api.x.com/2/users/${userId}/tweets`);
        url.searchParams.set('max_results', '100');
        url.searchParams.set('exclude', 'retweets');
        url.searchParams.set('tweet.fields', 'created_at,referenced_tweets,entities');
        if (old.sinceId) url.searchParams.set('since_id', old.sinceId);
        else url.searchParams.set('start_time', new Date(Date.now() - DAY).toISOString());
        if (next) url.searchParams.set('pagination_token', next);
        const page = await (await fetchOK(url, {headers})).json();
        if (page.errors?.length) throw new Error('X returned incomplete timeline data');
        for (const post of page.data ?? []) {
            if (!newest || BigInt(post.id) > BigInt(newest)) newest = post.id;
            if (!tradeWords.test(post.text)) continue;
            // Quotes/replies, links, and attributed claims cannot qualify as original reporting automatically.
            const independent = !(post.referenced_tweets?.length || post.entities?.urls?.length || /according|\bvia\b|reports?\b|@/i.test(post.text));
            reports.push(validateReport({sourceId: source.id, url: `https://x.com/${source.handle}/status/${post.id}`,
                title: plain(post.text).slice(0, 600), publishedAt: post.created_at, teams: detectTeams(post.text), independent}));
        }
        next = page.meta?.next_token;
    } while (next);
    return {reports, cursor: {userId, sinceId: newest}};
}
export async function collectSources(store, token, kind) {
    await Promise.all(sources.filter(s => s.kind !== 'editorial' && (!kind || s.kind === kind)).map(async source => {
        const old = store.get('sources', source.id);
        if (old?.nextCheck > Date.now()) return;
        const nextCheck = Date.now() + source.interval;
        try {
            const result = source.kind === 'x' ? await collectX(source, store, token) : {reports: await collectRSS(source)};
            for (const report of result.reports) {
                // Never overwrite an editor's provenance review on a subsequent feed poll.
                if (!store.get('reports', report.id)) store.put('reports', report.id, report);
            }
            if (result.cursor) store.put('cursors', source.id, result.cursor);
            store.put('sources', source.id, {id: source.id, name: source.name, status: 'ok', nextCheck, lastSuccess: new Date().toISOString()});
        } catch (error) {
            store.put('sources', source.id, {id: source.id, name: source.name, status: 'unavailable', nextCheck, lastSuccess: old?.lastSuccess ?? null, message: error.message});
        }
    }));
}
