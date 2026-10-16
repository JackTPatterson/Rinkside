import React, {memo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Close, Pause, Play} from '../components/icons';
import {LiveDot, T, TeamLogo, tap} from '../components/ui';
import {useAppTheme} from '../theme';
import {useRadio, WAVE_BARS} from './RadioProvider';

const BAR_W = 3;
const BAR_GAP = 2;
const WAVE_H = 26;

const WaveBar = memo(function WaveBar({index, levels, color}) {
    const style = useAnimatedStyle(() => {
        const v = levels.value[index] ?? 0;
        return {height: withTiming(Math.max(3, v * WAVE_H), {duration: 110})};
    });
    return <Animated.View style={[styles.bar, {backgroundColor: color}, style]}/>;
});

/** Live waveform: WAVE_BARS bars driven by the radio's shared `levels`. */
export const Waveform = memo(function Waveform({levels, color}) {
    return (
        <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({length: WAVE_BARS}).map((_, i) => <WaveBar key={i} index={i} levels={levels} color={color}/>)}
        </View>
    );
});

/**
 * Floating mini player shown while a radio broadcast is on: team logo, station, live waveform,
 * play/pause and stop. `bottomOffset` is the tab bar height when it's showing (sit just above it);
 * null on stack screens, where it sits just above the home indicator.
 */
export default function RadioBar({bottomOffset = null}) {
    const {colors, teamColor} = useAppTheme();
    const insets = useSafeAreaInsets();
    const {station, playing, buffering, error, levels, toggle, stop} = useRadio();
    if (!station) return null;
    const color = teamColor(station.team);
    const PlayPause = playing ? Pause : Play;
    return (
        <View pointerEvents="box-none" style={[styles.wrap, {bottom: bottomOffset != null ? bottomOffset + 8 : insets.bottom + 8}]}>
            <View style={[styles.bar_, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <TeamLogo abbrev={station.team} size={26}/>
                <View style={styles.meta}>
                    <T variant="label" numberOfLines={1}>{station.title}</T>
                    <View style={styles.sub}>
                        {error ? (
                            <T variant="caption" color={colors.negative} numberOfLines={1}>Stream unavailable</T>
                        ) : (
                            <>
                                {playing ? <LiveDot size={6}/> : null}
                                <T variant="caption" muted numberOfLines={1}>{buffering ? 'Connecting…' : playing ? 'Live' : 'Paused'}</T>
                            </>
                        )}
                    </View>
                </View>
                <Waveform levels={levels} color={color}/>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={playing ? 'Pause radio' : 'Play radio'}
                    hitSlop={8}
                    onPress={() => {
                        tap();
                        toggle();
                    }}
                    style={({pressed}) => [styles.btn, {backgroundColor: colors.text}, pressed && styles.pressed]}>
                    {buffering ? <ActivityIndicator size="small" color={colors.background}/> : <PlayPause size={18} color={colors.background} variant="Bold"/>}
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Stop radio"
                    hitSlop={8}
                    onPress={() => {
                        tap();
                        stop();
                    }}
                    style={({pressed}) => pressed && styles.pressed}>
                    <Close size={24} color={colors.textSecondary}/>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {position: 'absolute', left: 10, right: 10},
    bar_: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 15,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: {width: 0, height: 4},
        elevation: 6,
    },
    meta: {flex: 1, minWidth: 0},
    sub: {flexDirection: 'row', alignItems: 'center', gap: 5},
    wave: {flexDirection: 'row', alignItems: 'center', gap: BAR_GAP, height: WAVE_H, width: WAVE_BARS * (BAR_W + BAR_GAP) - BAR_GAP},
    bar: {width: BAR_W, borderRadius: BAR_W / 2},
    btn: {width: 36, height: 36, borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    pressed: {opacity: 0.6},
});
