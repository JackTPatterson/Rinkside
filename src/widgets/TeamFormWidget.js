// "Team Form" widget: record, points, rank and recent form for the favourite team.
// Small = rank + record + points. Medium adds a stat row (GP, L10, streak, point pace, goal diff).
// Same isolated-runtime rules as NextGameWidget: everything the function needs is declared inside it.
import {HStack, Spacer, Text, VStack} from '@expo/ui/swift-ui';
import {
    containerBackground,
    font,
    foregroundStyle,
    frame,
    lineLimit,
    minimumScaleFactor,
    monospacedDigit,
    opacity,
    widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import {createWidget} from 'expo-widgets';

export const TEAM_FORM_WIDGET = 'TeamForm';

const TeamFormWidget = (props, environment) => {
    'widget';
    const t = props.team;
    const s = props.standing;
    const g = props.game;
    const dark = environment.colorScheme === 'dark';
    const bg = t ? (dark ? t.bgDark : t.bgLight) : '#2A2D34';
    const fg = t ? (dark ? t.fgDark : t.fgLight) : '#FFFFFF';
    const shell = [widgetURL('rinkside://standings'), containerBackground(bg, 'widget'), foregroundStyle(fg)];

    if (!t || !s) {
        return (
            <VStack spacing={4} modifiers={shell}>
                <Text modifiers={[font({size: 17, weight: 'bold'})]}>Rinkside</Text>
                <Text modifiers={[font({size: 13}), opacity(0.85)]}>Open the app to load standings</Text>
            </VStack>
        );
    }

    const signed = (n) => (n == null ? '–' : n > 0 ? `+${n}` : String(n));
    const stat = (label, value) => (
        <VStack spacing={1} modifiers={[frame({maxWidth: 9999})]}>
            <Text modifiers={[font({size: 17, weight: 'heavy', design: 'rounded'}), monospacedDigit(), minimumScaleFactor(0.6), lineLimit(1)]}>{value}</Text>
            <Text modifiers={[font({size: 10, weight: 'semibold'}), opacity(0.75)]}>{label}</Text>
        </VStack>
    );

    // One line about the game the widget would otherwise show: a nudge, not a second widget.
    let gameLine = '';
    if (g && !g.postponed) {
        const vs = `${g.isHome ? 'vs' : '@'} ${g.opp.abbrev}`;
        if (g.state === 'live' || g.state === 'liveStale') gameLine = `Live ${vs}  ${g.us}–${g.them}`;
        else if (g.state === 'final') gameLine = `${g.result === 'W' ? 'W' : g.result === 'OTL' ? 'OTL' : 'L'} ${g.us}–${g.them} ${vs}`;
        else if (g.state === 'upcoming' && g.startLabel) gameLine = `Next ${vs} · ${g.startLabel}`;
    }

    if (environment.widgetFamily === 'systemSmall') {
        return (
            <VStack alignment="leading" spacing={2} modifiers={shell}>
                <HStack>
                    <Text modifiers={[font({size: 13, weight: 'bold'}), opacity(0.85)]}>{t.abbrev}</Text>
                    <Spacer/>
                    <Text modifiers={[font({size: 13, weight: 'bold'}), opacity(0.85)]}>{s.rank || ''}</Text>
                </HStack>
                <Spacer/>
                <Text modifiers={[font({size: 34, weight: 'heavy', design: 'rounded'}), monospacedDigit(), lineLimit(1)]}>{`${s.points} pts`}</Text>
                <Text modifiers={[font({size: 14, weight: 'semibold'}), monospacedDigit(), opacity(0.9), lineLimit(1)]}>{s.record}</Text>
                <Text modifiers={[font({size: 12, weight: 'medium'}), opacity(0.8), lineLimit(1)]}>{s.streak ? `Streak ${s.streak}` : s.rankSmall}</Text>
            </VStack>
        );
    }

    return (
        <VStack alignment="leading" spacing={6} modifiers={shell}>
            <HStack alignment="firstTextBaseline">
                <Text modifiers={[font({size: 22, weight: 'heavy', design: 'rounded'})]}>{t.abbrev}</Text>
                <Text modifiers={[font({size: 22, weight: 'heavy', design: 'rounded'}), monospacedDigit(), opacity(0.9)]}>{s.record}</Text>
                <Spacer/>
                <VStack alignment="trailing" spacing={0}>
                    <Text modifiers={[font({size: 22, weight: 'heavy', design: 'rounded'})]}>{s.rank || ''}</Text>
                    <Text modifiers={[font({size: 11, weight: 'medium'}), opacity(0.8), lineLimit(1)]}>{s.rankSmall}</Text>
                </VStack>
            </HStack>
            <Spacer/>
            <HStack spacing={4}>
                {stat('PTS', String(s.points))}
                {stat('GP', String(s.gp))}
                {stat('L10', s.l10 || '–')}
                {stat('PACE', s.pace == null ? '–' : String(s.pace))}
                {stat('DIFF', signed(s.diff))}
            </HStack>
            <Text modifiers={[font({size: 12, weight: 'semibold'}), opacity(0.85), lineLimit(1)]}>{gameLine}</Text>
        </VStack>
    );
};

export default createWidget(TEAM_FORM_WIDGET, TeamFormWidget, {team: null, standing: null, game: null});
