// "Next Game" widget: puck drop countdown, live score, or the final result for the favourite team.
// Home screen: small + medium (team colour background). Lock screen: circular, rectangular, inline.
//
// IMPORTANT: the function marked 'widget' is compiled into a separate bundle and runs in an isolated
// runtime. It can't see anything at module scope (including the helpers in snapshot.js), so
// every helper below is declared inside it. Data arrives only through `props` (see snapshot.js).
import {AccessoryWidgetBackground, HStack, Spacer, Text, VStack, ZStack} from '@expo/ui/swift-ui';
import {
    containerBackground,
    font,
    foregroundStyle,
    frame,
    lineLimit,
    minimumScaleFactor,
    monospacedDigit,
    multilineTextAlignment,
    opacity,
    padding,
    widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import {createWidget} from 'expo-widgets';

export const NEXT_GAME_WIDGET = 'NextGame';

const NextGameWidget = (props, environment) => {
    'widget';
    const t = props.team;
    const g = props.game;
    const family = environment.widgetFamily;
    const dark = environment.colorScheme === 'dark';
    const accessory = family === 'accessoryCircular' || family === 'accessoryRectangular' || family === 'accessoryInline';

    const bg = t ? (dark ? t.bgDark : t.bgLight) : '#2A2D34';
    const fg = t ? (dark ? t.fgDark : t.fgLight) : '#FFFFFF';
    const url = (g && g.url) || 'rinkside://';
    const now = environment.date ? environment.date.getTime() : Date.now();

    // What the centre of the widget says, for every game state.
    const dayLabel = () => {
        if (!g || g.startMs == null) return '';
        const start = new Date(g.startMs);
        const today = new Date(now);
        const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        if (sameDay(start, today)) return 'Today';
        const tomorrow = new Date(now + 24 * 3600 * 1000);
        if (sameDay(start, tomorrow)) return 'Tomorrow';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[start.getDay()]}, ${months[start.getMonth()]} ${start.getDate()}`;
    };
    const resultWord = () => (g.result === 'W' ? 'W' : g.result === 'OTL' ? 'OTL' : 'L');
    const copy = () => {
        if (!t) return {big: '—', sub: 'Open Rinkside', short: 'Open Rinkside', tiny: '—'};
        if (!g) return {big: '—', sub: 'No games scheduled', short: 'No games scheduled', tiny: '—'};
        const score = `${g.us}–${g.them}`;
        const vs = `${g.isHome ? 'vs' : '@'} ${g.opp.abbrev}`;
        if (g.postponed) return {big: 'PPD', sub: 'Postponed', short: `${t.abbrev} ${vs} postponed`, tiny: 'PPD'};
        if (g.state === 'live' || g.state === 'liveStale') {
            const where = g.intermission ? `${g.period || ''} INT`.trim() : g.shootout ? 'Shootout' : g.clock ? `${g.period} · ${g.clock}` : g.period || 'Live';
            const stale = g.state === 'liveStale';
            return {
                big: score,
                sub: stale ? 'Open app to refresh' : where,
                short: `${t.abbrev} ${g.us}–${g.them} ${g.opp.abbrev} · ${stale ? 'refresh' : where}`,
                tiny: score,
            };
        }
        if (g.state === 'final') {
            return {
                big: `${resultWord()} ${score}`,
                sub: g.finalLabel || 'Final',
                short: `${t.abbrev} ${resultWord()} ${score} ${vs}`,
                tiny: `${resultWord()} ${score}`,
            };
        }
        if (g.state === 'started') return {big: 'Puck drop', sub: 'Live in the app', short: `${t.abbrev} ${vs} · puck drop`, tiny: 'Now'};
        if (g.state === 'stale') return {big: '—', sub: 'Open Rinkside', short: `${t.abbrev} ${vs}`, tiny: '—'};
        return {
            big: g.startLabel || 'TBD',
            sub: dayLabel(),
            short: `${t.abbrev} ${vs} · ${g.startLabel || 'TBD'}`,
            tiny: g.startLabel ? g.startLabel.replace(' ', '') : 'TBD',
        };
    };
    const c = copy();
    const showCountdown = !!g && g.state === 'upcoming' && !g.postponed && g.startMs != null && g.startMs > now && g.startMs - now < 12 * 3600 * 1000;
    const live = !!g && (g.state === 'live' || g.state === 'liveStale');
    const vsLine = g ? `${g.isHome ? 'vs' : '@'} ${g.opp.abbrev}` : '';

    /* -------------------------------------------------------------- lock screen */

    if (family === 'accessoryInline') {
        return <Text modifiers={[widgetURL(url)]}>{c.short}</Text>;
    }
    if (family === 'accessoryCircular') {
        return (
            <ZStack modifiers={[widgetURL(url), containerBackground('#00000000', 'widget')]}>
                <AccessoryWidgetBackground/>
                <VStack spacing={0}>
                    <Text modifiers={[font({size: 10, weight: 'bold'}), lineLimit(1)]}>{g ? g.opp.abbrev : t ? t.abbrev : 'NHL'}</Text>
                    <Text modifiers={[font({size: live ? 17 : 13, weight: 'heavy', design: 'rounded'}), minimumScaleFactor(0.5), lineLimit(1), monospacedDigit()]}>{c.tiny}</Text>
                </VStack>
            </ZStack>
        );
    }
    if (family === 'accessoryRectangular') {
        return (
            <VStack alignment="leading" spacing={1} modifiers={[widgetURL(url), containerBackground('#00000000', 'widget')]}>
                <Text modifiers={[font({size: 12, weight: 'semibold'}), lineLimit(1)]}>{t ? `${t.abbrev} ${vsLine}` : 'Rinkside'}</Text>
                <Text modifiers={[font({size: 20, weight: 'heavy', design: 'rounded'}), minimumScaleFactor(0.6), lineLimit(1), monospacedDigit()]}>{c.big}</Text>
                {showCountdown ? (
                    <Text date={new Date(g.startMs)} dateStyle="timer" modifiers={[font({size: 12}), monospacedDigit(), lineLimit(1)]}/>
                ) : (
                    <Text modifiers={[font({size: 12}), lineLimit(1)]}>{c.sub}</Text>
                )}
            </VStack>
        );
    }

    /* -------------------------------------------------------------- home screen */

    const shell = [widgetURL(url), containerBackground(bg, 'widget'), foregroundStyle(fg)];

    if (family === 'systemSmall') {
        return (
            <VStack alignment="leading" spacing={2} modifiers={shell}>
                <HStack>
                    <Text modifiers={[font({size: 13, weight: 'bold'}), opacity(0.85)]}>{t ? t.abbrev : 'Rinkside'}</Text>
                    <Spacer/>
                    <Text modifiers={[font({size: 13, weight: 'bold'}), opacity(0.85)]}>{vsLine}</Text>
                </HStack>
                <Spacer/>
                <Text modifiers={[font({size: 30, weight: 'heavy', design: 'rounded'}), minimumScaleFactor(0.5), lineLimit(1), monospacedDigit()]}>{c.big}</Text>
                <Text modifiers={[font({size: 13, weight: 'semibold'}), opacity(0.85), lineLimit(1)]}>{c.sub}</Text>
                {showCountdown ? (
                    <Text date={new Date(g.startMs)} dateStyle="timer" modifiers={[font({size: 13, weight: 'medium'}), monospacedDigit(), opacity(0.85), lineLimit(1)]}/>
                ) : null}
            </VStack>
        );
    }

    // systemMedium and anything larger.
    return (
        <HStack spacing={8} modifiers={shell}>
            <VStack alignment="leading" spacing={2} modifiers={[frame({maxWidth: 9999, alignment: 'leading'})]}>
                <Text modifiers={[font({size: 32, weight: 'heavy', design: 'rounded'})]}>{t ? t.abbrev : '—'}</Text>
                <Text modifiers={[font({size: 12, weight: 'semibold'}), opacity(0.8), lineLimit(1)]}>{t ? t.short : 'Pick a team in Rinkside'}</Text>
                <Spacer/>
                <Text modifiers={[font({size: 12, weight: 'medium'}), opacity(0.8), lineLimit(1)]}>
                    {g && g.playoff ? 'Playoffs' : g ? (g.isHome ? 'Home' : 'Away') : ''}
                </Text>
            </VStack>
            <VStack spacing={2} modifiers={[frame({maxWidth: 9999})]}>
                <Spacer/>
                <Text modifiers={[font({size: 30, weight: 'heavy', design: 'rounded'}), minimumScaleFactor(0.5), lineLimit(1), monospacedDigit(), multilineTextAlignment('center')]}>{c.big}</Text>
                <Text modifiers={[font({size: 13, weight: 'semibold'}), opacity(0.85), lineLimit(1)]}>{c.sub}</Text>
                {showCountdown ? (
                    <Text date={new Date(g.startMs)} dateStyle="timer" modifiers={[font({size: 13, weight: 'medium'}), monospacedDigit(), opacity(0.85), lineLimit(1)]}/>
                ) : null}
                <Spacer/>
            </VStack>
            <VStack alignment="trailing" spacing={2} modifiers={[frame({maxWidth: 9999, alignment: 'trailing'})]}>
                <Text modifiers={[font({size: 32, weight: 'heavy', design: 'rounded'}), opacity(0.9)]}>{g ? g.opp.abbrev : ''}</Text>
                <Text modifiers={[font({size: 12, weight: 'semibold'}), opacity(0.8), lineLimit(1)]}>{g ? g.opp.name : ''}</Text>
                <Spacer/>
                <Text modifiers={[font({size: 12, weight: 'medium'}), opacity(0.8), padding({top: 0})]}>
                    {g && g.usSog != null && g.themSog != null ? `SOG ${g.usSog}–${g.themSog}` : ''}
                </Text>
            </VStack>
        </HStack>
    );
};

export default createWidget(NEXT_GAME_WIDGET, NextGameWidget, {team: null, game: null});
