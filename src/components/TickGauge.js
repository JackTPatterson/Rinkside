import React, {memo, useCallback, useEffect, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
    interpolateColor,
    runOnJS,
    useAnimatedProps,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
} from 'react-native-reanimated';
import Svg, {Circle, Line} from 'react-native-svg';
import {useAppTheme} from '../theme';
import {tap} from './ui';

// Ported from the App Store build's Deserve-to-Win O-meter
// (_archive/projects/Rinkside, app/(tabs)/games/[id].tsx: DeserveToWinDrawer / GaugeTick).
const AnimatedLine = Animated.createAnimatedComponent(Line);
const TICK_COUNT = 29; // odd so the centre tick sits at 90°
const STROKE_W = 8;
const TICK_EXTEND = 22; // ticks run this far past the radius
const SPRING = {damping: 16, stiffness: 110, mass: 1, overshootClamping: false};

/** One tick; its colour flips softly as the animated boundary passes it. */
function GaugeTick({x1, y1, x2, y2, t, leftColor, rightColor, start, target, progress, window}) {
    const animProps = useAnimatedProps(() => {
        const boundary = start + (target - start) * progress.value;
        return {stroke: interpolateColor(t - boundary, [-window, window], [leftColor, rightColor])};
    }, [t, start, target, leftColor, rightColor, window]);
    return <AnimatedLine x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={STROKE_W} strokeLinecap="round" opacity={0.95} animatedProps={animProps}/>;
}

/**
 * Half-circle tick gauge with a needle. `value` (0..1, left → right) is where the colour boundary
 * and the needle land; they spring there from `start` together, with a light haptic per tick
 * crossed. Ticks left of the boundary are `leftColor`, right of it `rightColor`.
 * Deserve to Win uses start 0.5 with the two team colours; a single score uses start 0.
 * `active={false}` holds it at the start until the screen says it's in view.
 */
function TickGauge({value, start = 0, leftColor, rightColor, width, delay = 300, haptics = true, active = true}) {
    const {colors} = useAppTheme();
    const target = Math.max(0, Math.min(1, value ?? start));
    const progress = useSharedValue(0);

    const outer = TICK_EXTEND + STROKE_W / 2 + 4;
    const cx = width / 2;
    const radius = Math.min(width / 2 - outer, 150);
    const cy = radius + outer;
    const height = cy + 24;
    const needleLength = radius - 22;
    const tickInner = radius - 4;
    const tickOuter = radius + TICK_EXTEND;

    // `active` lets a screen hold the sweep until the gauge scrolls into view.
    useEffect(() => {
        progress.value = 0;
        if (active) progress.value = withDelay(delay, withSpring(1, SPRING));
    }, [target, start, delay, active, progress]);

    const ticks = useMemo(() => Array.from({length: TICK_COUNT}, (_, i) => {
        const t = i / (TICK_COUNT - 1);
        const rad = ((180 - t * 180) * Math.PI) / 180;
        return {
            key: i, t,
            x1: cx + tickInner * Math.cos(rad), y1: cy - tickInner * Math.sin(rad),
            x2: cx + tickOuter * Math.cos(rad), y2: cy - tickOuter * Math.sin(rad),
        };
    }), [cx, cy, tickInner, tickOuter]);

    // Needle: 0° points straight up; −90° is far left, +90° far right.
    const needleStyle = useAnimatedStyle(() => {
        const boundary = start + (target - start) * progress.value;
        return {transform: [{rotate: `${-90 + boundary * 180}deg`}]};
    }, [start, target]);

    // One haptic per tick the boundary crosses (several can pass in a single spring frame).
    const buzz = useCallback(() => tap(), []);
    const last = useSharedValue(0);
    useAnimatedReaction(
        () => Math.floor(Math.abs((target - start) * progress.value) * TICK_COUNT),
        (count, prev) => {
            if (!haptics) return;
            if (prev === null || count === 0) {
                last.value = count;
                return;
            }
            if (count > last.value) {
                const diff = count - last.value;
                last.value = count;
                for (let i = 0; i < diff; i += 1) runOnJS(buzz)();
            } else if (count < last.value) {
                last.value = count;
            }
        },
        [target, start, haptics],
    );

    return (
        <View style={{width, height, alignSelf: 'center'}}>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                {ticks.map((tk) => (
                    <GaugeTick
                        key={tk.key}
                        {...tk}
                        leftColor={leftColor}
                        rightColor={rightColor ?? colors.card}
                        start={start}
                        target={target}
                        progress={progress}
                        window={1 / TICK_COUNT}
                    />
                ))}
                <Circle cx={cx} cy={cy} r={10} fill={colors.text}/>
            </Svg>
            {/* Pivot box centred on the hub; the needle fills its top half, so rotating the box
                about its own centre pivots the needle at the hub. */}
            <Animated.View
                pointerEvents="none"
                style={[{position: 'absolute', left: cx - 2, top: cy - needleLength, width: 4, height: needleLength * 2}, needleStyle]}>
                <View style={{position: 'absolute', top: 0, left: 0, width: 4, height: needleLength, borderRadius: 2, backgroundColor: colors.text}}/>
            </Animated.View>
        </View>
    );
}

export default memo(TickGauge);
