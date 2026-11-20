// Live Activity for the favourite team's game: Lock Screen banner + Dynamic Island.
// Props come from liveActivityProps() in snapshot.js. Same isolated-runtime rules as the widgets:
// no module-scope references inside the 'widget' function.
//
// Layout: a gradient from our team's colour to theirs, big scores either side of the clock, and a win-probability
// bar underneath (MoneyPuck, when it has the game). Team `bgDark` colours are chosen to stay readable on near-black.
import {Capsule, Circle, HStack, Spacer, Text, VStack, ZStack} from '@expo/ui/swift-ui';
import {
    activityBackgroundTint,
    background,
    font,
    fixedSize,
    foregroundStyle,
    frame,
    lineLimit,
    minimumScaleFactor,
    monospacedDigit,
    opacity,
    padding,
} from '@expo/ui/swift-ui/modifiers';
import {createLiveActivity} from 'expo-widgets';

export const GAME_ACTIVITY = 'GameActivity';

const GameActivity = (props, environment) => {
    'widget';
    const dim = environment.isLuminanceReduced;
    const us = props.team;
    const them = props.opp;
    const usColor = dim ? '#FFFFFF' : us.bgDark;
    const themColor = dim ? '#FFFFFF' : them.bgDark;
    const over = props.state === 'final';
    const live = !over;
    const clockStatus = over
        ? props.finalLabel || 'Final'
        : props.intermission
            ? `${props.period || ''} INT`.trim()
            : props.shootout
                ? 'Shootout'
                : props.clock
                    ? `${props.period} · ${props.clock}`
                    : props.period || '';
    const headline = over ? (props.result ? (props.result === 'W' ? 'Win' : props.result === 'OTL' ? 'OT loss' : 'Loss') : 'Final') : 'Live';
    const subline = over ? (props.finalLabel || 'Final') : clockStatus;
    const leading = props.us >= props.them;

    // Blend a hex colour toward the dark base so the gradient stays calm behind white text.
    const mix = (hex, amount) => {
        const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16);
        const base = [14, 16, 19];
        const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c, i) => Math.round(c * (1 - amount) + base[i] * amount));
        return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
    };
    const gradient = {
        type: 'linearGradient',
        colors: [mix(us.bgDark, 0.6), '#0E1013', mix(them.bgDark, 0.6)],
        startPoint: {x: 0, y: 0.5},
        endPoint: {x: 1, y: 0.5},
    };

    const hasWin = typeof props.usWin === 'number' && props.usWin >= 0 && props.usWin <= 1;
    const usPct = hasWin ? Math.round(props.usWin * 100) : 0;
    const themPct = hasWin ? 100 - usPct : 0;
    const BAR = 104;
    const usW = hasWin ? Math.max(8, Math.round(BAR * props.usWin)) : 0;
    const themW = hasWin ? Math.max(8, BAR - usW) : 0;

    const badge = (color, size) => (
        <ZStack>
            <Circle modifiers={[foregroundStyle(color), frame({width: size, height: size})]}/>
            <Circle modifiers={[foregroundStyle('#FFFFFF'), opacity(0.18), frame({width: size * 0.5, height: size * 0.5})]}/>
        </ZStack>
    );
    const bigScore = (value) => (
        <Text modifiers={[font({size: 54, weight: 'heavy', design: 'rounded'}), monospacedDigit(), foregroundStyle('#FFFFFF'), minimumScaleFactor(0.7), lineLimit(1)]}>{String(value)}</Text>
    );
    const abbrev = (text) => (
        <Text modifiers={[font({size: 14, weight: 'heavy'}), foregroundStyle('#FFFFFF'), opacity(0.85), lineLimit(1), fixedSize()]}>{text}</Text>
    );
    const pct = (value) => (
        <Text modifiers={[font({size: 14, weight: 'bold'}), monospacedDigit(), foregroundStyle('#FFFFFF'), lineLimit(1), fixedSize()]}>{`${value}%`}</Text>
    );
    const bar = () => (
        <HStack spacing={3}>
            <Capsule modifiers={[foregroundStyle(usColor), frame({width: usW, height: 6})]}/>
            <Capsule modifiers={[foregroundStyle(themColor), opacity(0.75), frame({width: themW, height: 6})]}/>
        </HStack>
    );
    const winRow = () => (
        <HStack spacing={6}>
            {abbrev(us.abbrev)}
            {pct(usPct)}
            <Spacer/>
            {bar()}
            <Spacer/>
            {pct(themPct)}
            {abbrev(them.abbrev)}
        </HStack>
    );
    const sog = props.usSog != null && props.themSog != null ? `SOG ${props.usSog}–${props.themSog}` : '';
    const centre = (
        <VStack spacing={2}>
            <Text modifiers={[font({size: 20, weight: 'bold'}), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{headline}</Text>
            <Text modifiers={[font({size: 15, weight: 'semibold'}), foregroundStyle('#FFFFFF'), opacity(0.7), monospacedDigit(), lineLimit(1), fixedSize()]}>{subline}</Text>
        </VStack>
    );

    return {
        banner: (
            <VStack spacing={8} modifiers={[padding({horizontal: 16, vertical: 12}), background(gradient), activityBackgroundTint('#0E1013')]}>
                <Text modifiers={[font({size: 12, weight: 'semibold'}), foregroundStyle('#FFFFFF'), opacity(0.6)]}>{props.playoff ? 'Rinkside · Playoffs' : 'Rinkside · NHL'}</Text>
                <HStack spacing={10}>
                    {badge(usColor, 34)}
                    {bigScore(props.us)}
                    <Spacer/>
                    {centre}
                    <Spacer/>
                    {bigScore(props.them)}
                    {badge(themColor, 34)}
                </HStack>
                {hasWin && live ? winRow() : (
                    <HStack>
                        {abbrev(us.abbrev)}
                        <Spacer/>
                        <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle('#FFFFFF'), opacity(0.6), lineLimit(1)]}>{sog}</Text>
                        <Spacer/>
                        {abbrev(them.abbrev)}
                    </HStack>
                )}
            </VStack>
        ),
        compactLeading: (
            <Text modifiers={[font({size: 14, weight: 'bold'}), monospacedDigit(), foregroundStyle(usColor)]}>{`${us.abbrev} ${props.us}`}</Text>
        ),
        compactTrailing: (
            <Text modifiers={[font({size: 14, weight: 'bold'}), monospacedDigit(), foregroundStyle(themColor)]}>{`${props.them} ${them.abbrev}`}</Text>
        ),
        minimal: (
            <Text modifiers={[font({size: 12, weight: 'bold'}), monospacedDigit(), minimumScaleFactor(0.6), foregroundStyle(leading ? usColor : themColor)]}>{`${props.us}-${props.them}`}</Text>
        ),
        expandedLeading: (
            <VStack alignment="leading" spacing={2} modifiers={[padding({leading: 6})]}>
                <HStack spacing={8}>
                    {badge(usColor, 28)}
                    {bigScore(props.us)}
                </HStack>
                {abbrev(us.abbrev)}
            </VStack>
        ),
        expandedTrailing: (
            <VStack alignment="trailing" spacing={2} modifiers={[padding({trailing: 6})]}>
                <HStack spacing={8}>
                    {bigScore(props.them)}
                    {badge(themColor, 28)}
                </HStack>
                {abbrev(them.abbrev)}
            </VStack>
        ),
        expandedCenter: (
            <VStack spacing={2} modifiers={[frame({maxWidth: 9999})]}>
                <Text modifiers={[font({size: 17, weight: 'bold'}), foregroundStyle('#FFFFFF')]}>{headline}</Text>
                <Text modifiers={[font({size: 13, weight: 'semibold'}), foregroundStyle('#FFFFFF'), opacity(0.7), monospacedDigit(), lineLimit(1)]}>{subline}</Text>
            </VStack>
        ),
        expandedBottom: hasWin && live ? (
            <HStack spacing={8} modifiers={[padding({horizontal: 6})]}>
                {pct(usPct)}
                <Spacer/>
                {bar()}
                <Spacer/>
                {pct(themPct)}
            </HStack>
        ) : (
            <Text modifiers={[font({size: 12, weight: 'medium'}), opacity(0.7), lineLimit(1)]}>{sog || clockStatus}</Text>
        ),
    };
};

export default createLiveActivity(GAME_ACTIVITY, GameActivity);
