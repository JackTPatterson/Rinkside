import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {useCallback, useEffect, useRef, useState} from 'react';
import {cheerFor, heartbeatInterval, heartbeatPlan, moments, plan} from './pulse';

const KEY = 'game:pulse';

const IMPACT = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
    soft: Haptics.ImpactFeedbackStyle.Soft,
    rigid: Haptics.ImpactFeedbackStyle.Rigid,
};
const NOTIFY = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
};

/** Play a list of {type, style, at} steps. Returns a cancel function. */
export function runPlan(steps) {
    const timers = steps.map((s) => setTimeout(() => {
        const p = s.type === 'notify' ? Haptics.notificationAsync(NOTIFY[s.style]) : Haptics.impactAsync(IMPACT[s.style]);
        p?.catch?.(() => {});
    }, s.at));
    return () => timers.forEach(clearTimeout);
}

/** Persisted on/off for Game Pulse. Off by default: buzzing should be something you chose. */
export function usePulsePreference() {
    const [on, setOn] = useState(false);
    useEffect(() => {
        let alive = true;
        AsyncStorage.getItem(KEY).then((v) => alive && setOn(v === 'on')).catch(() => {});
        return () => {
            alive = false;
        };
    }, []);
    const set = useCallback((next) => {
        setOn(next);
        AsyncStorage.setItem(KEY, next ? 'on' : 'off').catch(() => {});
    }, []);
    return [on, set];
}

/**
 * Game Pulse for a *live* game: buzz on goals and big swings, and a quickening heartbeat when the
 * game is tense. `reading` = {hs, as, wp, tension}; `favoriteIsHome` is true/false/null.
 * Does nothing when `enabled` is false.
 */
export function useLivePulse({enabled, reading, favoriteIsHome}) {
    const prev = useRef(null);
    const cancel = useRef(null);

    // Goals and swings: compare each new reading with the last one.
    const {hs, as, wp} = reading ?? {};
    useEffect(() => {
        if (!enabled || !reading) {
            prev.current = null;
            return;
        }
        const before = prev.current;
        prev.current = {hs, as, wp};
        for (const m of moments(before, {hs, as, wp})) {
            cancel.current?.();
            cancel.current = runPlan(plan(m, cheerFor(m, favoriteIsHome)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, hs, as, wp, favoriteIsHome]);

    // Heartbeat: a lub-dub every `interval` ms while the game is tense.
    const level = reading?.tension ?? 0;
    const interval = enabled ? heartbeatInterval(level) : null;
    useEffect(() => {
        if (!interval) return undefined;
        const beat = setInterval(() => runPlan(heartbeatPlan(level)), interval);
        return () => clearInterval(beat);
    }, [interval, level]);

    useEffect(() => () => cancel.current?.(), []);
}
