import {buildStories, LEVELS, shouldAlert, hash, DAY} from './model.mjs';

async function expo(path, body, accessToken) {
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
        method: 'POST', headers: {'Content-Type': 'application/json', ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {})},
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Expo returned HTTP ${response.status}`);
    const result = await response.json();
    if (result.errors?.length) throw new Error('Expo rejected the request');
    return result.data;
}
export async function dispatchAlerts(store, {accessToken, send = body => expo('send', body, accessToken), now = Date.now()} = {}) {
    const stories = buildStories(store.list('reports'), now);
    for (const subscription of store.list('subscriptions').filter(s => s.enabled)) {
        for (const story of stories) {
            const key = hash(`${subscription.id}:${story.id}`);
            const previous = store.get('deliveries', key);
            if (!shouldAlert(story, subscription, previous, now)) continue;
            if (previous?.retryAt > now) continue;
            // Re-read just before sending in case the user opted out during another network request.
            const current = store.get('subscriptions', subscription.id);
            if (!current?.enabled || current.updatedAt !== subscription.updatedAt) break;
            try {
                const result = await send({to: subscription.token, title: story.disputed ? 'Trade Radar · Report disputed' : `Trade Radar · ${story.confidence}`,
                    body: story.title.slice(0, 180), data: {type: 'trade', storyId: story.id}, sound: 'default', channelId: 'trades', ttl: 3600});
                const ticket = Array.isArray(result) ? result[0] : result;
                if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                    store.put('subscriptions', subscription.id, {...current, enabled: false});
                    break;
                }
                if (ticket?.status !== 'ok' || !ticket.id) throw new Error('Push ticket rejected');
                store.put('deliveries', key, {id: key, level: LEVELS[story.confidence], disputed: story.disputed, sentAt: now});
                store.put('receipts', ticket.id, {id: ticket.id, subscriptionId: subscription.id, token: subscription.token, deliveryKey: key, createdAt: now});
            } catch {
                const failures = (previous?.failures ?? 0) + 1;
                store.put('deliveries', key, {...(previous ?? {level: -1, disputed: false}), id: key, failures,
                    retryAt: now + Math.min(3600000, 60000 * 2 ** Math.min(failures, 6))});
            }
        }
    }
}
export async function checkReceipts(store, {accessToken, read = ids => expo('getReceipts', {ids}, accessToken), now = Date.now()} = {}) {
    const pending = store.list('receipts');
    for (let i = 0; i < pending.length; i += 100) {
        const chunk = pending.slice(i, i + 100).filter(r => now - r.createdAt > 15 * 60000);
        if (!chunk.length) continue;
        const results = await read(chunk.map(r => r.id));
        for (const row of chunk) {
            const receipt = results?.[row.id];
            if (!receipt && now - row.createdAt < DAY) continue;
            if (receipt?.status === 'error') {
                const sub = store.get('subscriptions', row.subscriptionId);
                if (receipt.details?.error === 'DeviceNotRegistered' && sub?.token === row.token) store.put('subscriptions', sub.id, {...sub, enabled: false});
                // Preserve a visible service error; retrying a sent notification can duplicate delivery.
                store.put('pushErrors', row.id, {id: row.id, error: receipt.details?.error ?? 'Delivery failed', at: now});
            }
            store.delete('receipts', row.id);
        }
    }
}
