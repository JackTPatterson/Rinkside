import {createAudioPlayer, setAudioModeAsync} from 'expo-audio';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useSharedValue} from 'react-native-reanimated';

export const WAVE_BARS = 28;
const SAMPLE_TIMEOUT_MS = 1500; // no PCM by then → stream can't be tapped, animate instead
const SYNTH_MS = 90;

const RadioContext = createContext(null);

/** RMS of `frames` split into `n` buckets, scaled to 0..1. */
function bucketLevels(frames, n) {
    const out = new Array(n).fill(0);
    if (!frames?.length) return out;
    const size = Math.max(1, Math.floor(frames.length / n));
    for (let b = 0; b < n; b++) {
        let sum = 0;
        const start = b * size;
        const end = Math.min(frames.length, start + size);
        for (let i = start; i < end; i++) sum += frames[i] * frames[i];
        const rms = Math.sqrt(sum / Math.max(1, end - start));
        out[b] = Math.min(1, rms * 3.2);
    }
    return out;
}

/**
 * One app-wide radio player, so a broadcast keeps playing while you move between screens.
 * station: {key, team, title, url} | null. `levels` is a shared value (WAVE_BARS numbers, 0..1)
 * for the waveform: real PCM levels when the platform can tap the stream, otherwise a smooth
 * synthetic wave that only moves while audio is actually playing.
 */
export function RadioProvider({children}) {
    const playerRef = useRef(null);
    const subs = useRef([]);
    const [station, setStation] = useState(null);
    const [status, setStatus] = useState({playing: false, buffering: false, error: null});
    const levels = useSharedValue(new Array(WAVE_BARS).fill(0));
    const lastSample = useRef(0);
    const synth = useRef(null);

    useEffect(() => {
        setAudioModeAsync({playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix'}).catch(() => {});
    }, []);

    const stopSynth = () => {
        clearInterval(synth.current);
        synth.current = null;
    };

    const teardown = useCallback(() => {
        stopSynth();
        subs.current.forEach((s) => s?.remove?.());
        subs.current = [];
        const p = playerRef.current;
        playerRef.current = null;
        if (p) {
            try {
                p.setActiveForLockScreen?.(false);
                p.pause();
                p.remove();
            } catch {
                // already released
            }
        }
        levels.value = new Array(WAVE_BARS).fill(0);
    }, [levels]);

    useEffect(() => teardown, [teardown]);

    const play = useCallback((next) => {
        if (!next?.url) return;
        teardown();
        const p = createAudioPlayer({uri: next.url}, {updateInterval: 500});
        playerRef.current = p;
        setStation(next);
        setStatus({playing: false, buffering: true, error: null});
        lastSample.current = 0;

        subs.current.push(p.addListener('playbackStatusUpdate', (st) => {
            setStatus({playing: !!st.playing, buffering: !!st.isBuffering && !st.playing, error: st.error ?? null});
        }));
        try {
            p.setAudioSamplingEnabled?.(true);
            subs.current.push(p.addListener('audioSampleUpdate', (sample) => {
                lastSample.current = Date.now();
                levels.value = bucketLevels(sample?.channels?.[0]?.frames, WAVE_BARS);
            }));
        } catch {
            // sampling unsupported for this source/platform; the synthetic wave covers it
        }
        // Synthetic fallback: a travelling wave with jitter, only while playing and only when no real
        // samples are arriving (HLS streams often can't be tapped on iOS).
        let phase = 0;
        synth.current = setInterval(() => {
            const pl = playerRef.current;
            if (!pl) return;
            if (Date.now() - lastSample.current < SAMPLE_TIMEOUT_MS) return;
            if (!pl.playing) {
                levels.value = levels.value.map((v) => v * 0.6);
                return;
            }
            phase += 0.35;
            levels.value = levels.value.map((v, i) => {
                const target = 0.25 + 0.35 * Math.abs(Math.sin(phase + i * 0.45)) + Math.random() * 0.35;
                return v + (Math.min(1, target) - v) * 0.5;
            });
        }, SYNTH_MS);

        try {
            p.setActiveForLockScreen?.(true, {title: next.title, artist: 'Rinkside', albumTitle: 'Live radio'});
        } catch {
            // lock-screen controls unavailable
        }
        p.play();
    }, [levels, teardown]);

    const toggle = useCallback(() => {
        const p = playerRef.current;
        if (!p) return;
        if (p.playing) p.pause();
        else p.play();
    }, []);

    const stop = useCallback(() => {
        teardown();
        setStation(null);
        setStatus({playing: false, buffering: false, error: null});
    }, [teardown]);

    const value = useMemo(() => ({station, ...status, levels, play, toggle, stop}), [station, status, levels, play, toggle, stop]);
    return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

/** {station, playing, buffering, error, levels, play(station), toggle(), stop()} */
export function useRadio() {
    const ctx = useContext(RadioContext);
    if (!ctx) throw new Error('useRadio must be used inside RadioProvider');
    return ctx;
}
