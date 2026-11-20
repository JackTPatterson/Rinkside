import React, {memo, useEffect} from 'react';
import Animated, {Easing, useAnimatedProps, useSharedValue, withDelay, withTiming} from 'react-native-reanimated';
import {Circle, Line, Text as SvgText} from 'react-native-svg';
import {readableOn} from '../../theme';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const PASS_MS = 300; // each pass starts this long after the one before

/** One straight segment that can draw itself in from its start. */
const Segment = memo(function Segment({from, to, color, strong, animate, delay, dashed, width}) {
    const k = useSharedValue(animate ? 0 : 1);
    useEffect(() => {
        if (animate) k.value = withDelay(delay, withTiming(1, {duration: 380, easing: Easing.out(Easing.cubic)}));
    }, [animate, delay, k]);
    const props = useAnimatedProps(() => ({x2: from.x + (to.x - from.x) * k.value, y2: from.y + (to.y - from.y) * k.value}));
    return (
        <AnimatedLine
            x1={from.x}
            y1={from.y}
            animatedProps={props}
            stroke={color}
            strokeWidth={strong ? width : width * 0.7}
            strokeOpacity={strong ? (dashed ? 0.8 : 0.9) : dashed ? 0.35 : 0.45}
            strokeLinecap="round"
            strokeDasharray={dashed ? '5 5' : undefined}
        />
    );
});

/** A numbered node where an assister last had the puck. */
const Node = memo(function Node({x, y, n, color, strong}) {
    return (
        <>
            <Circle cx={x} cy={y} r={7} fill={color} fillOpacity={strong ? 1 : 0.6} stroke="#FFFFFF" strokeWidth={1.25}/>
            <SvgText x={x} y={y + 3.5} fontSize={10} fontWeight="700" fill={readableOn(color)} textAnchor="middle">{n}</SvgText>
        </>
    );
});

/**
 * How a goal got into the net, drawn the same way on every rink: dashed passes from the second assist through the
 * first to the shooter, a solid shot into the net, and a numbered node at each assister.
 * Everything is in pixels of the surrounding <Svg>. `shotNode` also draws the shooter's own node (the Live Rink
 * has a dot there already). `animate` draws the lines in, shooter last.
 */
export const GoalPath = memo(function GoalPath({shot, net, assists = [], color, strong = true, animate = false, shotNode = false}) {
    const spots = [...assists].sort((a, b) => b.n - a.n);
    const route = [...spots, shot];
    return (
        <>
            {route.slice(0, -1).map((from, i) => (
                <Segment key={`pass-${from.n}`} from={from} to={route[i + 1]} color={color} strong={strong} animate={animate} delay={i * PASS_MS} dashed width={2}/>
            ))}
            <Segment from={shot} to={net} color={color} strong={strong} animate={animate} delay={spots.length * PASS_MS} width={2.5}/>
            {spots.map((a) => <Node key={`node-${a.n}`} x={a.x} y={a.y} n={a.n} color={color} strong={strong}/>)}
            {shotNode ? <Circle cx={shot.x} cy={shot.y} r={7} fill={color} stroke="#FFFFFF" strokeWidth={2.5}/> : null}
        </>
    );
});
