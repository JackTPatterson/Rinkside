import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {AppState, Platform} from 'react-native';
import {saveTradeSubscription, tradeRadarConfigured} from '../api/trades';
import {ROUTES} from '../navigation/routes';

const KEY = 'rinkside-trade-alerts-v1';
const DEFAULTS = {enabled: false, minimum: 'Medium', team: null, token: null};
const Context = createContext(null);
Notifications.setNotificationHandler({handleNotification: async () => ({shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false})});

async function pushToken(ask) {
    if (Platform.OS === 'web') throw new Error('Push alerts are available in the iOS and Android app.');
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('trades', {name: 'Trade Radar', importance: Notifications.AndroidImportance.DEFAULT});
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && ask) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) throw new Error('Allow notifications in your device settings to receive trade alerts.');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('Push notifications are not configured for this build.');
    return (await Notifications.getExpoPushTokenAsync({projectId})).data;
}

export function TradeAlertsProvider({children}) {
    const [prefs, setPrefs] = useState(DEFAULTS);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const record = useRef(null);
    const locked = useRef(false);
    useEffect(() => {
        if (Platform.OS === 'web') { setReady(true); return; }
        SecureStore.getItemAsync(KEY).then(raw => {
            if (raw) { record.current = JSON.parse(raw); setPrefs(record.current.prefs); }
        }).catch(() => setError('Could not read saved alert settings.')).finally(() => setReady(true));
    }, []);
    const save = useCallback(async (changes, ask = true) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError(null);
        try {
            if (!tradeRadarConfigured) throw new Error('Trade Radar is not connected yet.');
            if (Platform.OS === 'web') throw new Error('Use the iOS or Android app to configure push alerts.');
            if (!record.current) {
                record.current = {identity: {id: Crypto.randomUUID(), secret: Crypto.randomUUID() + Crypto.randomUUID()}, prefs: DEFAULTS};
                // Persist the credential before registering so retries always use the same device identity.
                await SecureStore.setItemAsync(KEY, JSON.stringify(record.current));
            }
            const next = {...record.current.prefs, ...changes};
            if (next.enabled) next.token = await pushToken(ask);
            if (next.token) await saveTradeSubscription(record.current.identity, next);
            const updated = {...record.current, prefs: next};
            await SecureStore.setItemAsync(KEY, JSON.stringify(updated));
            record.current = updated;
            setPrefs(next);
        } catch (e) { setError(e.message || 'Could not save your alerts.'); }
        finally { locked.current = false; setBusy(false); }
    }, []);
    useEffect(() => {
        if (!ready || !tradeRadarConfigured || Platform.OS === 'web') return;
        const sync = () => { if (record.current?.prefs.enabled) save({}, false); };
        sync();
        const active = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
        const token = Notifications.addPushTokenListener(sync);
        return () => { active.remove(); token.remove(); };
    }, [ready, save]);
    return <Context.Provider value={{prefs, ready, busy, error, save}}>{children}</Context.Provider>;
}
export const useTradeAlerts = () => useContext(Context);

export function useTradeNotificationNavigation(navigationRef, ready) {
    const seen = useRef(null);
    useEffect(() => {
        if (!ready || Platform.OS === 'web') return;
        const open = response => {
            const notification = response?.notification;
            const data = notification?.request.content.data;
            if (data?.type !== 'trade' || typeof data.storyId !== 'string' || seen.current === notification.request.identifier) return;
            if (!navigationRef.isReady()) return;
            seen.current = notification.request.identifier;
            navigationRef.navigate(ROUTES.tabs, {screen: ROUTES.trades, params: {storyId: data.storyId}});
            Notifications.clearLastNotificationResponseAsync().catch(() => {});
        };
        const listener = Notifications.addNotificationResponseReceivedListener(open);
        Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
        return () => listener.remove();
    }, [navigationRef, ready]);
}
