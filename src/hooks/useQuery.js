import {useIsFocused} from '@react-navigation/native';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

function useAppActive() {
    const [active, setActive] = useState(AppState.currentState === 'active');
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
        return () => sub.remove();
    }, []);
    return active;
}

// useIsFocused throws outside a navigator; screens are always inside one, but shared
// components may not be.
function useFocusedSafe() {
    try {
        return useIsFocused();
    } catch {
        return true;
    }
}

/**
 * Minimal data hook.
 *   const {data, error, loading, refreshing, refresh} = useQuery(fetcher, [deps], {refetchInterval, enabled, initialData})
 * - `fetcher({force})` must return a promise. It's re-run when deps change.
 * - `refetchInterval` polls only while the screen is focused and the app is foregrounded.
 * - Previous data is kept while refetching, so the UI never flashes back to a skeleton. Pass
 *   `keepPreviousData: false` when stale data for old deps would be misleading.
 * - `refresh()` is for pull-to-refresh: it bypasses caches (force) and sets `refreshing`.
 */
export function useQuery(fetcher, deps = [], {refetchInterval = 0, enabled = true, initialData, keepPreviousData = true} = {}) {
    const [data, setData] = useState(initialData);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(enabled && initialData === undefined);
    const [refreshing, setRefreshing] = useState(false);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const reqId = useRef(0);
    const focused = useFocusedSafe();
    const appActive = useAppActive();

    const run = useCallback(async ({force = false, manual = false} = {}) => {
        const id = ++reqId.current;
        if (manual) setRefreshing(true);
        try {
            const result = await fetcherRef.current({force});
            if (id === reqId.current) {
                setData(result);
                setError(null);
            }
        } catch (e) {
            if (id === reqId.current) setError(e);
        } finally {
            if (id === reqId.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        if (!keepPreviousData) {
            setData(initialData);
            setError(null);
            setLoading(initialData === undefined);
        } else {
            setLoading((prev) => prev || data === undefined);
        }
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps]);

    useEffect(() => {
        if (!enabled || !refetchInterval || !focused || !appActive) return;
        const t = setInterval(() => run({force: true}), refetchInterval);
        return () => clearInterval(t);
    }, [enabled, refetchInterval, focused, appActive, run]);

    const refresh = useCallback(() => run({force: true, manual: true}), [run]);
    return {data, error, loading, refreshing, refresh, setData};
}

/** Re-render every `ms` (for countdowns / clocks). */
export function useNow(ms = 1000, enabled = true) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        if (!enabled) return;
        const t = setInterval(() => setNow(new Date()), ms);
        return () => clearInterval(t);
    }, [ms, enabled]);
    return now;
}
