import * as WebBrowser from 'expo-web-browser';
import React, {memo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Badge, Headshot, Row, T, TeamLogo, tap} from '../../components/ui';
import {readableOn, useAppTheme, withAlpha} from '../../theme';
import {pct} from '../../utils/format';

/** Opens a URL in the in-app browser (never throws). */
export function openLink(url) {
    if (!url) return;
    tap();
    WebBrowser.openBrowserAsync(url).catch(() => {});
}

/** Rounded pill button with an icon, used for recap / radio / clip links. */
export const LinkPill = memo(function LinkPill({icon: Icon, label, onPress, color}) {
    const {colors} = useAppTheme();
    const bg = color ?? colors.card;
    const fg = color ? readableOn(color) : colors.text;
    return (
        <Pressable
            accessibilityRole="link"
            onPress={onPress}
            style={({pressed}) => [styles.pill, {backgroundColor: bg}, pressed && {opacity: 0.6}]}>
            {Icon ? <Icon size={16} color={fg}/> : null}
            <T variant="label" color={fg}>{label}</T>
        </Pressable>
    );
});

/** "HOM  label  AWY" heading with logos, used above head-to-head comparisons. */
export const MatchupHeading = memo(function MatchupHeading({home, away, label}) {
    return (
        <Row style={styles.matchup}>
            <Row gap={6}>
                <TeamLogo abbrev={home} size={22}/>
                <T variant="label">{home}</T>
            </Row>
            {label ? <T variant="caption" muted>{label}</T> : null}
            <Row gap={6}>
                <T variant="label">{away}</T>
                <TeamLogo abbrev={away} size={22}/>
            </Row>
        </Row>
    );
});

/** Win-probability-added badge, e.g. "+18% WP". */
export const WPABadge = memo(function WPABadge({wpa, color}) {
    const {colors} = useAppTheme();
    if (!Number.isFinite(wpa)) return null;
    const pctv = Math.round(wpa * 100);
    const bg = withAlpha(color ?? colors.accent, 0.18);
    return <Badge label={`${pctv >= 0 ? '+' : ''}${pctv}% WP`} color={bg} textColor={colors.text}/>;
});

/** Headshot + name tile that opens the player page. */
export const PlayerTile = memo(function PlayerTile({playerId, name, headshot, team, caption, onPress, size = 64}) {
    const {teamColor} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={name}
            disabled={!onPress}
            onPress={() => onPress?.(playerId)}
            style={({pressed}) => [styles.tile, pressed && {opacity: 0.6}]}>
            <Headshot uri={headshot} size={size} borderColor={team ? teamColor(team) : undefined}/>
            <T variant="label" numberOfLines={2} style={styles.center}>{name || 'Unknown'}</T>
            {caption ? <T variant="caption" muted numberOfLines={1} style={styles.center}>{caption}</T> : null}
        </Pressable>
    );
});

/** Big two-sided probability readout: "54%  label  46%". */
export function ProbRow({left, right, leftColor, rightColor, label}) {
    return (
        <Row style={{justifyContent: 'space-between'}}>
            <T variant="stat" color={leftColor}>{pct(left)}</T>
            {label ? <T variant="caption" muted>{label}</T> : null}
            <T variant="stat" color={rightColor}>{pct(right)}</T>
        </Row>
    );
}

export function Divider() {
    const {colors} = useAppTheme();
    return <View style={[styles.divider, {backgroundColor: colors.border}]}/>;
}

const styles = StyleSheet.create({
    pill: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999},
    matchup: {justifyContent: 'space-between', marginBottom: 12},
    tile: {width: 104, alignItems: 'center', gap: 6},
    center: {textAlign: 'center'},
    divider: {height: StyleSheet.hairlineWidth, marginVertical: 14},
});
