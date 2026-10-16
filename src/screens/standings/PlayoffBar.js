import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {T} from '../../components/ui';
import {useAppTheme, withAlpha} from '../../theme';
import {pct} from '../../utils/format';

// Ported from the App Store build's Rankings "Sim" view (_archive/projects/Rinkside,
// app/(tabs)/rankings/index.tsx: SIM_STOPS / buildSimIncrements / SimLegendItem).
export const STOPS = [
    {key: 'madePlayoffs', label: 'Playoffs', color: '#3b82f6'},
    {key: 'round2', label: 'Rd 2', color: '#0ea5e9'},
    {key: 'round3', label: 'Rd 3', color: '#14b8a6'},
    {key: 'round4', label: 'Final', color: '#f59e0b'},
    {key: 'wonCup', label: 'Cup', color: '#f97316'},
];

/**
 * Each stage is a subset of the one before, so a segment is the extra probability that round
 * adds: "makes the playoffs but goes no further" on the left through "wins the Cup" on the right.
 */
function increments(odds) {
    const vals = STOPS.map((s) => Math.max(0, Number(odds?.[s.key]) || 0));
    return STOPS.map((s, i) => ({key: s.key, color: s.color, width: Math.max(0, vals[i] - (vals[i + 1] ?? 0))}))
        .filter((seg) => seg.width > 0);
}

/**
 * The stacked playoff bar: total length = playoff odds, split by how far the team goes.
 * `focus` (a stage key) mutes every other stage so that one reads first (the Cup view).
 */
export const PlayoffBar = memo(function PlayoffBar({odds, height = 8, focus, style}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.bar, {height, borderRadius: height / 2, backgroundColor: withAlpha(colors.text, 0.06)}, style]}>
            {increments(odds).map((seg) => (
                <View
                    key={seg.key}
                    style={{width: `${seg.width * 100}%`, height: '100%', backgroundColor: focus && seg.key !== focus ? withAlpha(seg.color, 0.35) : seg.color}}
                />
            ))}
        </View>
    );
});

/** Colour key for the stages (dot + label), for the top of a list. */
export const StopKey = memo(function StopKey({style}) {
    return (
        <View style={[styles.key, style]}>
            {STOPS.map((s) => (
                <View key={s.key} style={styles.keyItem}>
                    <View style={[styles.keyDot, {backgroundColor: s.color}]}/>
                    <T variant="caption" muted style={styles.keyLabel}>{s.label.toUpperCase()}</T>
                </View>
            ))}
        </View>
    );
});

/** Each stage's cumulative odds under the bar: dot + label, then the percentage. */
export const StopValues = memo(function StopValues({odds, stops = STOPS.slice(1), style}) {
    return (
        <View style={[styles.values, style]}>
            {stops.map((s) => {
                const v = Number(odds?.[s.key]) || 0;
                return (
                    <View key={s.key} style={styles.value}>
                        <View style={styles.keyItem}>
                            <View style={[styles.valueDot, {backgroundColor: s.color}]}/>
                            <T variant="caption" muted style={styles.keyLabel}>{s.label}</T>
                        </View>
                        <T variant="body" style={styles.valueText}>{pct(v, v > 0 && v < 0.01 ? 1 : 0)}</T>
                    </View>
                );
            })}
        </View>
    );
});

const styles = StyleSheet.create({
    bar: {flexDirection: 'row', overflow: 'hidden'},
    key: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    keyItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
    keyDot: {width: 7, height: 7, borderRadius: 4},
    keyLabel: {fontFamily: 'Sora_700Bold', letterSpacing: 0.4},
    values: {flexDirection: 'row', gap: 8, marginTop: 10},
    value: {flex: 1},
    valueDot: {width: 6, height: 6, borderRadius: 3},
    valueText: {fontFamily: 'Sora_700Bold', fontVariant: ['tabular-nums'], marginTop: 2},
});
