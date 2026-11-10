import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {openStore} from './store.mjs';
import {createAPI} from './http.mjs';
import {collectSources} from './collect.mjs';
import {dispatchAlerts, checkReceipts} from './push.mjs';
import {DAY} from './model.mjs';

const dbPath = process.env.TRADE_DB_PATH || './data/trades.sqlite';
mkdirSync(dirname(dbPath), {recursive: true});
const store = openStore(dbPath);
const server = createAPI(store, {adminToken: process.env.TRADE_ADMIN_TOKEN, trustedProxy: process.env.TRUSTED_PROXY});
const port = Number(process.env.PORT || 8787);
server.listen(port, '0.0.0.0', () => console.log(`Trade Radar listening on ${port}`));
let timer;
let stopping = false;
async function tick() {
    const started = Date.now();
    try {
        await collectSources(store, process.env.X_BEARER_TOKEN, 'x');
        await dispatchAlerts(store, {accessToken: process.env.EXPO_ACCESS_TOKEN});
        await collectSources(store, process.env.X_BEARER_TOKEN, 'rss');
        await checkReceipts(store, {accessToken: process.env.EXPO_ACCESS_TOKEN});
        await dispatchAlerts(store, {accessToken: process.env.EXPO_ACCESS_TOKEN});
        for (const report of store.list('reports')) if (Date.now() - Date.parse(report.publishedAt) > 30 * DAY) store.delete('reports', report.id);
        for (const row of store.list('deliveries')) if (Date.now() - (row.sentAt ?? row.retryAt) > 30 * DAY) store.delete('deliveries', row.id);
        for (const row of store.list('pushErrors')) if (Date.now() - row.at > 30 * DAY) store.delete('pushErrors', row.id);
    } catch (error) { console.error('Trade worker:', error.message); }
    if (!stopping) timer = setTimeout(tick, Math.max(1000, Math.max(60000, Number(process.env.POLL_INTERVAL_MS) || 60000) - (Date.now() - started)));
    else store.close();
}
tick();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; clearTimeout(timer); server.close(); });
