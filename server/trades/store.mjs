import {DatabaseSync} from 'node:sqlite';
import {hash} from './model.mjs';

export function openStore(path) {
    const db = new DatabaseSync(path);
    db.exec(`PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS documents (bucket TEXT, id TEXT, value TEXT NOT NULL, PRIMARY KEY(bucket,id));
        CREATE TABLE IF NOT EXISTS token_owners (token TEXT PRIMARY KEY, owner TEXT NOT NULL);`);
    const get = db.prepare('SELECT value FROM documents WHERE bucket=? AND id=?');
    const list = db.prepare('SELECT value FROM documents WHERE bucket=?');
    const put = db.prepare('INSERT INTO documents VALUES (?,?,?) ON CONFLICT(bucket,id) DO UPDATE SET value=excluded.value');
    const del = db.prepare('DELETE FROM documents WHERE bucket=? AND id=?');
    const store = {
        get: (bucket, id) => { const row = get.get(bucket, id); return row ? JSON.parse(row.value) : null; },
        list: bucket => list.all(bucket).map(r => JSON.parse(r.value)),
        put: (bucket, id, value) => put.run(bucket, id, JSON.stringify(value)),
        delete: (bucket, id) => del.run(bucket, id),
        close: () => db.close(),
        subscribe(id, secret, prefs) {
            const old = store.get('subscriptions', id);
            if (old && old.secret !== hash(secret)) throw Object.assign(new Error('Unauthorized'), {status: 401});
            const owner = db.prepare('SELECT owner FROM token_owners WHERE token=?').get(prefs.token);
            if (owner && owner.owner !== id) throw Object.assign(new Error('Token already registered'), {status: 409});
            const value = {...prefs, id, secret: hash(secret), startedAt: old?.enabled ? old.startedAt : Date.now(), updatedAt: Date.now()};
            db.exec('BEGIN IMMEDIATE');
            try {
                db.prepare('DELETE FROM token_owners WHERE owner=?').run(id);
                db.prepare('INSERT INTO token_owners VALUES (?,?)').run(prefs.token, id);
                store.put('subscriptions', id, value);
                db.exec('COMMIT');
            } catch (error) { db.exec('ROLLBACK'); throw error; }
            return value;
        },
    };
    return store;
}
