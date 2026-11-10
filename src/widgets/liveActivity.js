// Starts, updates and ends the Live Activity for the favourite team's game.
//
// Updates come from the app (the sync loop in useWidgetSync): they flow while Rinkside is running,
// including in the background while team radio keeps the app alive, but a suspended app can't
// update it. Remote updates would need an APNs server (see ARCHITECTURE.md).
import AsyncStorage from '@react-native-async-storage/async-storage';
import {liveActivityProps} from './snapshot';

const PREF_KEY = 'widgets:liveActivity';
const STARTED_KEY = 'widgets:liveActivity:started';
const FINAL_LINGER_MS = 15 * 60 * 1000;
const STALE_AFTER_MS = 20 * 60 * 1000;

export async function getLiveActivityEnabled() {
    try {
        return (await AsyncStorage.getItem(PREF_KEY)) !== 'off';
    } catch {
        return true;
    }
}

export function setLiveActivityEnabled(enabled) {
    return AsyncStorage.setItem(PREF_KEY, enabled ? 'on' : 'off').catch(() => {});
}

// {gameId, activityId}[]: games we already started an activity for. A game is only started once, so an
// activity the user swiped away doesn't come back on the next poll.
async function readStarted() {
    try {
        const v = JSON.parse((await AsyncStorage.getItem(STARTED_KEY)) ?? '[]');
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}
const writeStarted = (list) => AsyncStorage.setItem(STARTED_KEY, JSON.stringify(list.slice(-5))).catch(() => {});

const lastSent = new Map(); // activityId → JSON of the last props pushed to it
let busy = null;

// updatedAt changes every poll; ignore it so identical scores don't re-push.
const sig = (p) => JSON.stringify({...p, updatedAt: 0});

async function run(activity, snapshot, enabled) {
    const props = enabled ? liveActivityProps(snapshot) : null;
    const instances = activity.getInstances();
    const started = await readStarted();
    const mine = props ? started.find((s) => s.gameId === props.gameId) : null;
    const current = (mine && instances.find((i) => i.getId() === mine.activityId)) || null;

    // Anything that isn't this game's activity (an old game, or the feature switched off) is ended.
    for (const i of instances) {
        if (i === current) continue;
        try {
            await i.end('immediate');
        } catch {}
        lastSent.delete(i.getId());
    }
    if (!props) return;

    if (props.state === 'live') {
        if (current) {
            const key = sig(props);
            if (lastSent.get(current.getId()) !== key) {
                await current.update(props, new Date(Date.now() + STALE_AFTER_MS));
                lastSent.set(current.getId(), key);
            }
            return;
        }
        if (mine) return; // started before and since dismissed: respect that
        const instance = activity.start(props, `rinkside://game/${props.gameId}`, new Date(Date.now() + STALE_AFTER_MS));
        await writeStarted([...started, {gameId: props.gameId, activityId: instance.getId()}]);
        lastSent.set(instance.getId(), sig(props));
    } else if (props.state === 'final' && current) {
        // Leave the final score on the Lock Screen for a while, then let it go.
        await current.end(afterPolicy(FINAL_LINGER_MS), props, new Date());
        lastSent.delete(current.getId());
    }
    // Upcoming games never start an activity: it begins at puck drop, when the game goes live.
}

// `after(date)` comes from expo-widgets; load it lazily so this file imports fine without the native module.
function afterPolicy(ms) {
    try {
        return require('expo-widgets').after(new Date(Date.now() + ms));
    } catch {
        return 'default';
    }
}

/**
 * Reconcile the Live Activity with the latest snapshot. Safe to call often; calls are serialised and
 * never throw (starting an activity can fail in the background or when the user turned them off in iOS).
 */
export function syncLiveActivity(activity, snapshot, enabled) {
    if (!activity) return Promise.resolve();
    busy = (busy ?? Promise.resolve())
        .then(() => run(activity, snapshot, enabled))
        .catch(() => {});
    return busy;
}
