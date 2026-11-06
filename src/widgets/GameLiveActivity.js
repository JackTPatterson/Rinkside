// Live Activity for the favourite team's game: Lock Screen banner + Dynamic Island.
// Props come from liveActivityProps() in snapshot.js. Same isolated-runtime rules as the widgets:
// no module-scope references inside the 'widget' function.
//
// Dark layout on purpose: team `bgDark` colours are chosen to stay readable on near-black.
import {HStack, Spacer, Text, VStack} from '@expo/ui/swift-ui';
import {
    activityBackgroundTint,
    font,
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
    const status = over
        ? props.finalLabel || 'Final'
        : props.intermission
            ? `${props.period || ''} Intermission`.trim()
            : props.shootout
                ? 'Shootout'
                : props.clock
                    ? `${props.period} · ${props.clock}`
                    : props.period || 'Live';
    const shortStatus = over ? 'Final' : props.intermission ? 'INT' : props.shootout ? 'SO' : props.clock ? `${props.period} ${props.clock}` : props.period || 'Live';
    const leading = props.us >= props.them;
    const sog = props.usSog != null && props.themSog != null ? `SOG ${props.usSog}–${props.themSog}` : '';
    const resultText = over && props.result ? (props.result === 'W' ? 'Win' : props.result === 'OTL' ? 'OT loss' : 'Loss') : '';

    const score = (abbrev, value, color, align) => (
        <VStack alignment={align} spacing={0}>
            <Text modifiers={[font({size: 13, weight: 'bold'}), foregroundStyle(color)]}>{abbrev}</Text>
            <Text modifiers={[font({size: 40, weight: 'heavy', design: 'rounded'}), monospacedDigit(), foregroundStyle('#FFFFFF')]}>{String(value)}</Text>
        </VStack>
    );

    return {
        banner: (
            <VStack spacing={6} modifiers={[padding({all: 14}), activityBackgroundTint('#0E1013')]}>
                <HStack>
                    {score(us.abbrev, props.us, usColor, 'leading')}
                    <Spacer/>
                    <VStack spacing={2}>
                        <Text modifiers={[font({size: 15, weight: 'bold'}), foregroundStyle('#FFFFFF'), monospacedDigit(), lineLimit(1)]}>{status}</Text>
                        <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle('#FFFFFF'), opacity(0.7), lineLimit(1)]}>
                            {over ? resultText : props.playoff ? 'Playoffs' : props.isHome ? `${us.name} home` : `${us.name} away`}
                        </Text>
                    </VStack>
                    <Spacer/>
                    {score(them.abbrev, props.them, themColor, 'trailing')}
                </HStack>
                <Text modifiers={[font({size: 12, weight: 'medium'}), foregroundStyle('#FFFFFF'), opacity(0.6), lineLimit(1)]}>{sog}</Text>
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
            <VStack alignment="leading" spacing={0} modifiers={[padding({leading: 6})]}>
                {score(us.abbrev, props.us, usColor, 'leading')}
            </VStack>
        ),
        expandedTrailing: (
            <VStack alignment="trailing" spacing={0} modifiers={[padding({trailing: 6})]}>
                {score(them.abbrev, props.them, themColor, 'trailing')}
            </VStack>
        ),
        expandedCenter: (
            <VStack spacing={2} modifiers={[frame({maxWidth: 9999})]}>
                <Text modifiers={[font({size: 14, weight: 'bold'}), monospacedDigit(), lineLimit(1)]}>{shortStatus}</Text>
            </VStack>
        ),
        expandedBottom: (
            <Text modifiers={[font({size: 12, weight: 'medium'}), opacity(0.7), lineLimit(1)]}>{over ? `${status} · ${sog}` : sog || status}</Text>
        ),
    };
};

export default createLiveActivity(GAME_ACTIVITY, GameActivity);
