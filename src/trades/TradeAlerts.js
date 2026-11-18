import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {AppState, Platform} from 'react-native';
import {saveTradeSubscription, tradeRadarConfigured} from '../api/trades';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {ROUTES} from '../navigation/routes';

const KEY = 'rinkside-trade-alerts-v1';
// Push topics. `trades` follows the Trade Radar settings; the rest follow the favourite team.
export const TOPICS = ['trades', 'pregame', 'milestones', 'standings'];
const NO_TOPICS = {trades: false, pregame: false, milestones: false, standings: false};
const DEFAULTS = {minimum: 'Medium', team: null, token: null, topics: NO_TOPICS};
const CHANNELS = {trades: 'Trade Radar', pregame: 'Game day preview', milestones: 'Milestones', standings: 'Playoff position'};
const Context = createContext(null);
Notifications.setNotificationHandler({handleNotification: async () => ({shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false})});

// Settings saved before topics existed only ever meant trade alerts.
const normalize = (prefs) => ({...DEFAULTS, ...prefs, topics: {...NO_TOPICS, ...(prefs.topics ?? {trades: !!prefs.enabled})}});
const anyOn = (topics) => TOPICS.some((t) => topics[t]);
const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };

async function pushToken(ask) {
    if (Platform.OS === 'web') throw new Error('Push alerts are available in the iOS and Android app.');
    if (Platform.OS === 'android') {
        await Promise.all(Object.entries(CHANNELS).map(([id, name]) => Notifications.setNotificationChannelAsync(id, {name, importance: Notifications.AndroidImportance.DEFAULT})));
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && ask) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) throw new Error('Allow notifications in your device settings to receive alerts.');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('Push notifications are not configured for this build.');
    return (await Notifications.getExpoPushTokenAsync({projectId})).data;
}

export function TradeAlertsProvider({children}) {
    const {team: favorite} = useFavoriteTeam();
    const favoriteRef = useRef(favorite);
    favoriteRef.current = favorite;
    const [prefs, setPrefs] = useState(normalize({}));
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const record = useRef(null);
    const locked = useRef(false);
    useEffect(() => {
        if (Platform.OS === 'web') { setReady(true); return; }
        SecureStore.getItemAsync(KEY).then(raw => {
            if (raw) { record.current = JSON.parse(raw); record.current.prefs = normalize(record.current.prefs); setPrefs(record.current.prefs); }
        }).catch(() => setError('Could not read saved alert settings.')).finally(() => setReady(true));
    }, []);
    /** `changes` may carry a partial `topics`, e.g. save({topics: {pregame: true}}). */
    const save = useCallback(async (changes, ask = true) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError(null);
        try {
            if (!tradeRadarConfigured) throw new Error('Alerts are not connected yet.');
            if (Platform.OS === 'web') throw new Error('Use the iOS or Android app to configure push alerts.');
            if (!record.current) {
                record.current = {identity: {id: Crypto.randomUUID(), secret: Crypto.randomUUID() + Crypto.randomUUID()}, prefs: normalize({})};
                // Persist the credential before registering so retries always use the same device identity.
                await SecureStore.setItemAsync(KEY, JSON.stringify(record.current));
            }
            const old = record.current.prefs;
            const next = {...old, ...changes, topics: {...old.topics, ...(changes.topics ?? {})}};
            const enabled = anyOn(next.topics);
            if (enabled) next.token = await pushToken(ask);
            if (next.token) await saveTradeSubscription(record.current.identity, {enabled, minimum: next.minimum, team: next.team, token: next.token,
                topics: next.topics, fanTeam: favoriteRef.current ?? null, tz: timeZone() ?? undefined});
            const updated = {...record.current, prefs: next};
            await SecureStore.setItemAsync(KEY, JSON.stringify(updated));
            record.current = updated;
            setPrefs(next);
        } catch (e) { setError(e.message || 'Could not save your alerts.'); }
        finally { locked.current = false; setBusy(false); }
    }, []);
    useEffect(() => {
        if (!ready || !tradeRadarConfigured || Platform.OS === 'web') return;
        const sync = () => { if (record.current && anyOn(record.current.prefs.topics)) save({}, false); };
        sync();
        const active = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
        const token = Notifications.addPushTokenListener(sync);
        return () => { active.remove(); token.remove(); };
    }, [ready, favorite, save]); // a new favourite team re-registers, so team alerts follow it
    return <Context.Provider value={{prefs, ready, busy, error, save}}>{children}</Context.Provider>;
}
export const useTradeAlerts = () => useContext(Context);

/** Where a tapped notification goes. */
function destination(data) {
    switch (data?.type) {
        case 'trade': return typeof data.storyId === 'string' ? [ROUTES.trades, {storyId: data.storyId}] : null;
        case 'pregame': return Number.isFinite(Number(data.gameId)) ? [ROUTES.game, {gameId: Number(data.gameId)}] : null;
        case 'milestone': return Number.isFinite(Number(data.playerId)) ? [ROUTES.player, {playerId: Number(data.playerId)}] : null;
        case 'standings': return [ROUTES.tabs, {screen: ROUTES.standings}];
        default: return null;
    }
}

export function useTradeNotificationNavigation(navigationRef, ready) {
    const seen = useRef(null);
    useEffect(() => {
        if (!ready || Platform.OS === 'web') return;
        const open = response => {
            const notification = response?.notification;
            const target = destination(notification?.request.content.data);
            if (!target || seen.current === notification.request.identifier || !navigationRef.isReady()) return;
            seen.current = notification.request.identifier;
            navigationRef.navigate(target[0], target[1]);
            Notifications.clearLastNotificationResponseAsync().catch(() => {});
        };
        const listener = Notifications.addNotificationResponseReceivedListener(open);
        Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
        return () => listener.remove();
    }, [navigationRef, ready]);
}
