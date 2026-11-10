import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createAPI} from './http.mjs';
import {validateReport} from './model.mjs';
import {dispatchAlerts, checkReceipts} from './push.mjs';
import {collectX, collectRSS, detectTeams} from './collect.mjs';
import {sources} from './model.mjs';

const identity = {id: '12345678-1234-1234-1234-123456789abc', secret: 'a'.repeat(72)};
const prefs = {enabled: true, minimum: 'Medium', team: 'TOR', token: 'ExpoPushToken[test123]'};
function setup() {
    const store = openStore(':memory:');
    store.subscribe(identity.id, identity.secret, prefs);
    const report = validateReport({sourceId: 'friedman', title: 'Toronto Maple Leafs trade talks', url: 'https://x.com/FriedgeHNIC/status/123',
        publishedAt: new Date(Date.now() + 1000).toISOString(), teams: ['TOR'], independent: true});
    store.put('reports', report.id, report);
    return store;
}
test('HTTP API rejects unauthorized ingestion and subscription takeover', async () => {
    const store = setup();
    const server = createAPI(store, {adminToken: 'admin-test'});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const feed = await (await fetch(`${base}/trades?team=TOR`)).json();
        assert.equal(feed.stories.length, 1);
        assert.equal(feed.stories[0].confidence, 'Medium');
        assert.equal((await fetch(`${base}/reports`, {method: 'POST', body: '[]'})).status, 401);
        const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${'b'.repeat(72)}`};
        assert.equal((await fetch(`${base}/subscriptions/${identity.id}`, {method: 'PUT', headers, body: JSON.stringify(prefs)})).status, 401);
        assert.equal((await fetch(`${base}/subscriptions/22345678-1234-1234-1234-123456789abc`, {method: 'PUT', headers, body: JSON.stringify(prefs)})).status, 409);
        headers.Authorization = `Bearer ${identity.secret}`;
        assert.equal((await fetch(`${base}/subscriptions/${identity.id}`, {method: 'PUT', headers, body: JSON.stringify({...prefs, enabled: false})})).status, 200);
        assert.equal(store.get('subscriptions', identity.id).enabled, false);
    } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});
test('accepted alerts are durable and sent once; invalid tokens disabled from receipts', async () => {
    const store = setup();
    try {
        let sends = 0;
        const send = async () => { sends++; return {status: 'ok', id: 'receipt1'}; };
        await dispatchAlerts(store, {send});
        await dispatchAlerts(store, {send});
        assert.equal(sends, 1);
        await checkReceipts(store, {now: Date.now() + 16 * 60000, read: async () => ({receipt1: {status: 'error', details: {error: 'DeviceNotRegistered'}}})});
        assert.equal(store.get('subscriptions', identity.id).enabled, false);
    } finally { store.close(); }
});
test('failed push is retried with backoff without being marked delivered', async () => {
    const store = setup();
    try {
        let sends = 0;
        const send = async () => { sends++; throw new Error('offline'); };
        const now = Date.now();
        await dispatchAlerts(store, {send, now});
        await dispatchAlerts(store, {send, now: now + 1000});
        assert.equal(sends, 1);
        await dispatchAlerts(store, {send: async () => { sends++; return {status: 'ok', id: 'ok'}; }, now: now + 200000});
        assert.equal(sends, 2);
    } finally { store.close(); }
});
test('X pagination preserves cursor and treats quotes as uncorroborated', async () => {
    const store = openStore(':memory:');
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async url => {
        calls.push(String(url));
        if (String(url).includes('/by/username')) return Response.json({data: {id: '42'}});
        if (!String(url).includes('pagination_token')) return Response.json({data: [{id: '200', text: 'TOR trade talks', created_at: new Date().toISOString()}], meta: {next_token: 'next'}});
        return Response.json({data: [{id: '199', text: 'TOR trade report', created_at: new Date().toISOString(), referenced_tweets: [{type: 'quoted', id: '1'}]}], meta: {}});
    };
    try {
        const result = await collectX(sources[0], store, 'test');
        assert.equal(result.cursor.sinceId, '200');
        assert.equal(result.reports.length, 2);
        assert.equal(result.reports[0].independent, true);
        assert.equal(result.reports[1].independent, false);
        assert.equal(store.get('cursors', 'friedman'), null, 'collector does not commit partial pagination');
        assert.ok(calls[2].includes('pagination_token=next'));
    } finally { globalThis.fetch = originalFetch; store.close(); }
});
test('RSS tracks explicit Friedman attribution without counting it as independent', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(`<rss><channel><item><title>Leafs trade talks</title><link>https://sportsnet.ca/example</link><pubDate>${new Date().toUTCString()}</pubDate><description><![CDATA[<a href="https://x.com/FriedgeHNIC/status/123">Friedman</a> reports Toronto Maple Leafs talks]]></description></item></channel></rss>`);
    try {
        const result = await collectRSS(sources[1]);
        assert.equal(result.length, 1);
        assert.equal(result[0].independent, false);
        assert.equal(result[0].originId, 'friedman');
        assert.deepEqual(result[0].teams, ['TOR']);
    } finally { globalThis.fetch = originalFetch; }
    assert.deepEqual(detectTeams('Canadiens and TOR trade talks'), ['MTL', 'TOR']);
    assert.deepEqual(detectTeams('Toronto and Calgary are talking'), ['CGY', 'TOR']);
    assert.deepEqual(detectTeams('New York is interested'), [], 'ambiguous city must not select both teams');
});
