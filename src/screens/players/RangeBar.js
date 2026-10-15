import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {T} from '../../components/ui';
import {useAppTheme, withAlpha} from '../../theme';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Horizontal interval bar: shaded [lo, hi] band, a dot at the estimate, a solid tick for the
 * observed value and a dashed tick for the league average. Scale is [min, max].
 */
function RangeBar({min, max, lo, hi, estimate, observed, average, color, format = (v) => String(v), observedLabel = 'Observed'}) {
    const {colors} = useAppTheme();
    const span = max - min || 1;
    const x = (v) => `${clamp01((v - min) / span) * 100}%`;
    const has = (v) => v != null && Number.isFinite(v);
    return (
        <View>
            <View style={styles.track}>
                <View style={[styles.line, {backgroundColor: colors.cardAlt}]}/>
                {has(lo) && has(hi) ? (
                    <View
                        style={[styles.band, {
                            left: x(lo),
                            width: `${clamp01((hi - lo) / span) * 100}%`,
                            backgroundColor: withAlpha(color, 0.3),
                            borderColor: color,
                        }]}
                    />
                ) : null}
                {has(average) ? <View style={[styles.avg, {left: x(average), borderColor: colors.textSecondary}]}/> : null}
                {has(observed) ? <View style={[styles.obs, {left: x(observed), backgroundColor: colors.text}]}/> : null}
                {has(estimate) ? <View style={[styles.dot, {left: x(estimate), backgroundColor: color, borderColor: colors.card}]}/> : null}
            </View>
            <View style={styles.scale}>
                <T variant="caption" muted>{format(min)}</T>
                <T variant="caption" muted>{format(max)}</T>
            </View>
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: color}]}/>
                    <T variant="caption" muted>Estimate</T>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendBand, {backgroundColor: withAlpha(color, 0.3), borderColor: color}]}/>
                    <T variant="caption" muted>80% range</T>
                </View>
                {has(observed) ? (
                    <View style={styles.legendItem}>
                        <View style={[styles.legendTick, {backgroundColor: colors.text}]}/>
                        <T variant="caption" muted>{observedLabel}</T>
                    </View>
                ) : null}
                {has(average) ? (
                    <View style={styles.legendItem}>
                        <View style={[styles.legendAvg, {borderColor: colors.textSecondary}]}/>
                        <T variant="caption" muted>League avg</T>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

export default memo(RangeBar);

const H = 28;
const styles = StyleSheet.create({
    track: {height: H, justifyContent: 'center', marginHorizontal: 6},
    line: {position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3},
    band: {position: 'absolute', height: 14, borderRadius: 7, borderWidth: 1},
    avg: {position: 'absolute', top: 2, bottom: 2, width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', marginLeft: -0.75},
    obs: {position: 'absolute', top: 3, bottom: 3, width: 3, borderRadius: 2, marginLeft: -1.5},
    dot: {position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 2, marginLeft: -8},
    scale: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 2},
    legend: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8},
    legendItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
    legendDot: {width: 10, height: 10, borderRadius: 5},
    legendBand: {width: 16, height: 8, borderRadius: 4, borderWidth: 1},
    legendTick: {width: 3, height: 12, borderRadius: 2},
    legendAvg: {width: 0, height: 12, borderLeftWidth: 1.5, borderStyle: 'dashed'},
});
