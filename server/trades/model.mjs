import {createHash} from 'node:crypto';

export const LEVELS = {Low: 0, Medium: 1, High: 2, Confirmed: 3};
export const hash = value => createHash('sha256').update(value).digest('hex');
export const DAY = 86400000;
export const tradeWords = /\b(trad(?:e|es|ed|ing)|acquir(?:e|es|ed|ing)|deal|rumou?r|shopping|available|interest|talks|heading to)\b/i;
export const sources = [
    {id: 'friedman', name: 'Elliotte Friedman', kind: 'x', interval: 60000, handle: 'FriedgeHNIC', host: 'x.com', trusted: true},
    {id: 'sportsnet', name: 'Sportsnet NHL', kind: 'rss', interval: 300000, url: 'https://www.sportsnet.ca/hockey/nhl/feed/', host: 'sportsnet.ca'},
    {id: 'phr', name: 'Pro Hockey Rumors', kind: 'rss', interval: 300000, url: 'https://www.prohockeyrumors.com/feed', host: 'prohockeyrumors.com'},
    {id: 'nhl', name: 'NHL official', kind: 'editorial', host: 'nhl.com', official: true},
];

export function canonicalURL(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Expected a public HTTPS source URL');
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
}

export function validateReport(input, now = Date.now()) {
    const source = sources.find(s => s.id === input.sourceId);
    if (!source) throw new Error('Unknown sourceId');
    const url = canonicalURL(input.url);
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host !== source.host && !host.endsWith(`.${source.host}`)) throw new Error('URL does not belong to source');
    if (source.kind === 'x' && !new RegExp(`^/${source.handle}/status/\\d+$`, 'i').test(new URL(url).pathname)) throw new Error('Unexpected X account URL');
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 600) throw new Error('Invalid title');
    const at = Date.parse(input.publishedAt);
    if (!Number.isFinite(at) || at > now + 300000 || at < now - 30 * DAY) throw new Error('Invalid or expired publishedAt');
    if (!Array.isArray(input.teams) || input.teams.some(t => !/^[A-Z]{3}$/.test(t))) throw new Error('Invalid teams');
    for (const key of ['claimId', 'originId']) if (input[key] != null && (typeof input[key] !== 'string' || !/^[a-zA-Z0-9:_-]{1,150}$/.test(input[key]))) throw new Error(`Invalid ${key}`);
    const status = input.status ?? 'rumor';
    if (!['rumor', 'confirmed', 'denied'].includes(status)) throw new Error('Invalid status');
    if (status === 'confirmed' && !source.official) throw new Error('Only official sources can confirm a trade');
    return {
        id: hash(url), url, sourceId: source.id, title: input.title.trim(), publishedAt: new Date(at).toISOString(),
        teams: [...new Set(input.teams)], claimId: input.claimId || hash(url),
        // Attribution is deliberately not inferred from the number of outlets repeating a story.
        originId: input.originId || source.id, independent: input.independent === true,
        status, reviewed: input.reviewed === true,
    };
}

export function buildStories(reports, now = Date.now()) {
    const groups = new Map();
    for (const report of reports) {
        if (Date.parse(report.publishedAt) < now - 7 * DAY) continue;
        const list = groups.get(report.claimId) ?? [];
        list.push(report);
        groups.set(report.claimId, list);
    }
    return [...groups].map(([id, items]) => {
        items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
        const fresh = items.filter(r => Date.parse(r.publishedAt) >= now - 2 * DAY);
        const confirmed = fresh.some(r => r.status === 'confirmed' && r.reviewed);
        const disputed = fresh.some(r => r.status === 'denied' && r.reviewed);
        const origins = new Set(fresh.filter(r => r.independent && r.reviewed && r.status === 'rumor').map(r => r.originId));
        const trusted = fresh.some(r => r.independent && sources.find(s => s.id === r.sourceId)?.trusted);
        let confidence = 'Low';
        let reason = 'Attribution has not been independently verified. Repeated coverage is not corroboration.';
        if (trusted || origins.size === 1) { confidence = 'Medium'; reason = 'One original report. Independent corroboration is still needed.'; }
        if (origins.size >= 2) { confidence = 'High'; reason = `${origins.size} independently verified reporting origins support this specific claim.`; }
        if (confirmed) { confidence = 'Confirmed'; reason = 'An official announcement has been verified.'; }
        if (disputed) { confidence = 'Low'; reason = 'This claim has a verified denial or conflicting report. Read the sources before relying on it.'; }
        if (!fresh.length) reason = 'No fresh reporting in 48 hours. Confidence has been reduced.';
        const primary = items.find(r => r.id === id) ?? items.find(r => r.reviewed && r.independent) ?? items[0];
        return {id, title: primary.title, updatedAt: items[0].publishedAt, teams: primary.teams,
            confidence, reason, disputed, stale: !fresh.length,
            reports: items.map(r => ({...r, sourceName: sources.find(s => s.id === r.sourceId).name})),
        };
    }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function shouldAlert(story, subscription, previous, now = Date.now()) {
    if (!subscription.enabled || story.stale || Date.parse(story.updatedAt) < subscription.startedAt || now - Date.parse(story.updatedAt) > DAY) return false;
    if (subscription.team && !story.teams.includes(subscription.team)) return false;
    // A verified denial gets through even when the subscriber normally only wants strong reports.
    if (story.disputed) return previous != null && previous.level >= 0 && !previous.disputed;
    if (LEVELS[story.confidence] < LEVELS[subscription.minimum]) return false;
    return previous == null || LEVELS[story.confidence] > previous.level || previous.disputed === true;
}
