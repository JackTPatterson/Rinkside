import React, {memo, useEffect} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withDelay, withTiming} from 'react-native-reanimated';
import {T, TeamLogo, tap} from '../../components/ui';
import {ArrowDown, ArrowUp} from '../../components/icons';
import {getTeam, migrateTeamAbbrev} from '../../data/teams';
import {useAppTheme, withAlpha} from '../../theme';

/* ------------------------------------------------------------- helpers */

export const abbrevOf = (row) => {
    const a = row?.teamAbbrev?.default ?? row?.teamAbbrev;
    return typeof a === 'string' ? a : null;
};

export const toNum = (v) => {
    const x = Number(v);
    return v === null || v === undefined || v === '' || !Number.isFinite(x) ? null : x;
};

// MoneyPuck uses dotted codes in some files (L.A, N.J, S.J, T.B) and may still say ARI.
const MP_CODES = {'L.A': 'LAK', 'N.J': 'NJD', 'S.J': 'SJS', 'T.B': 'TBL', LA: 'LAK', NJ: 'NJD', SJ: 'SJS', TB: 'TBL'};
export function normalizeMpCode(code) {
    if (code == null) return null;
    const c = String(code).trim().toUpperCase();
    if (!c) return null;
    return migrateTeamAbbrev(MP_CODES[c] ?? c);
}

/** Conference letter ('E' | 'W') for a standings row, with a teams.js fallback. */
export function conferenceOf(row) {
    const c = row?.conferenceAbbrev;
    if (c === 'E' || c === 'W') return c;
    const t = getTeam(abbrevOf(row));
    return t?.conference === 'Eastern' ? 'E' : t?.conference === 'Western' ? 'W' : null;
}

const DIV_LETTER = {Atlantic: 'A', Metropolitan: 'M', Central: 'C', Pacific: 'P'};
export function divisionOf(row) {
    const d = row?.divisionAbbrev;
    if (d) return d;
    return DIV_LETTER[getTeam(abbrevOf(row))?.division] ?? null;
}

export const DIVISION_NAMES = {A: 'Atlantic', M: 'Metropolitan', C: 'Central', P: 'Pacific'};
export const CONFERENCE_NAMES = {E: 'Eastern', W: 'Western'};
export const CONFERENCE_DIVISIONS = {E: ['A', 'M'], W: ['C', 'P']};

/** Stable NHL order (includes the league's tiebreakers). */
export const bySequence = (a, b) => (toNum(a?.leagueSequence) ?? 99) - (toNum(b?.leagueSequence) ?? 99);

/* ---------------------------------------------------------- components */

/** Rank · logo · abbrev cell used as the first column of every list. */
export const TeamCell = memo(function TeamCell({rank, abbrev, width = 112, suffix}) {
    return (
        <View style={[styles.teamCell, {width}]}>
            <T variant="caption" muted style={styles.rank}>{rank}</T>
            <TeamLogo abbrev={abbrev} size={20}/>
            <T variant="label" numberOfLines={1} style={styles.abbrev}>{abbrev ?? '—'}</T>
            {suffix ? <T variant="caption" muted>{suffix}</T> : null}
        </View>
    );
});

/** Pressable row with optional favourite-team highlight. */
export function TeamRow({abbrev, fav, onPress, style, children, height}) {
    const {colors, teamColor} = useAppTheme();
    const isFav = fav && abbrev === fav;
    const tc = teamColor(abbrev);
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress ? () => {
                tap();
                onPress(abbrev);
            } : undefined}
            style={({pressed}) => [
                styles.row,
                height ? {height} : null,
                {borderBottomColor: colors.border},
                isFav && {backgroundColor: withAlpha(tc, 0.14), borderLeftColor: tc, borderLeftWidth: 3},
                pressed && {opacity: 0.6},
                style,
            ]}>
            {children}
        </Pressable>
    );
}

/** Dashed line marker, e.g. the playoff cut line between 8th and 9th. */
export function CutLine({label}) {
    const {colors} = useAppTheme();
    return (
        <View style={styles.cutWrap} accessibilityRole="text" accessibilityLabel={label}>
            <View style={[styles.cutDash, {borderColor: colors.negative}]}/>
            <View style={[styles.cutPill, {backgroundColor: withAlpha(colors.negative, 0.14)}]}>
                <T variant="caption" color={colors.negative}>{label}</T>
            </View>
            <View style={[styles.cutDash, {borderColor: colors.negative}]}/>
        </View>
    );
}

/** Week-over-week movement arrow (+ = moved up). */
export const Movement = memo(function Movement({value}) {
    const {colors} = useAppTheme();
    if (value == null) return <T variant="caption" muted>new</T>;
    if (value === 0) return <T variant="label" muted>–</T>;
    const up = value > 0;
    const c = up ? colors.positive : colors.negative;
    const Icon = up ? ArrowUp : ArrowDown;
    return (
        <View style={styles.move}>
            <Icon size={14} color={c}/>
            <T variant="label" color={c}>{Math.abs(value)}</T>
        </View>
    );
});

/** Horizontal bar that grows from 0 on mount / value change (UI thread). */
export function AnimatedBar({value, color, height = 10, delay = 0}) {
    const {colors} = useAppTheme();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    const w = useSharedValue(0);
    useEffect(() => {
        w.value = withDelay(delay, withTiming(v, {duration: 450}));
    }, [v, delay, w]);
    const anim = useAnimatedStyle(() => ({width: `${w.value * 100}%`}));
    return (
        <View style={[styles.barTrack, {height, borderRadius: height, backgroundColor: colors.cardAlt}]}>
            <Animated.View style={[{height: '100%', borderRadius: height, backgroundColor: color}, anim]}/>
        </View>
    );
}

/**
 * Bar centred on zero for signed values (goal differential, net rating, PDO − 1000).
 * `max` is the absolute value that fills one half.
 */
export const DivergingBar = memo(function DivergingBar({value, max, color, height = 8}) {
    const {colors} = useAppTheme();
    const v = Number(value) || 0;
    const share = max > 0 ? Math.min(1, Math.abs(v) / max) : 0;
    return (
        <View style={[styles.divTrack, {height, borderRadius: height, backgroundColor: colors.cardAlt}]}>
            <View style={styles.divHalf}>
                {v < 0 ? <View style={{width: `${share * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? colors.negative}}/> : null}
            </View>
            <View style={[styles.divMid, {backgroundColor: colors.textSecondary}]}/>
            <View style={[styles.divHalf, {alignItems: 'flex-start'}]}>
                {v > 0 ? <View style={{width: `${share * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? colors.positive}}/> : null}
            </View>
        </View>
    );
});

/** Column header label with optional InfoTip-free alignment helper. */
export function ColTitle({children, width, align = 'right'}) {
    return <T variant="caption" muted numberOfLines={1} style={{width, textAlign: align}}>{children}</T>;
}

export const styles = StyleSheet.create({
    // Team codes never truncate ("W…"); the cell's other content gives way instead.
    abbrev: {flexShrink: 0, minWidth: 36},
    teamCell: {flexDirection: 'row', alignItems: 'center', gap: 6},
    rank: {width: 22, textAlign: 'right', fontVariant: ['tabular-nums']},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',
        minHeight: 48,
    },
    cutWrap: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6},
    cutDash: {flex: 1, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed'},
    cutPill: {paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999},
    move: {flexDirection: 'row', alignItems: 'center', gap: 2},
    barTrack: {flex: 1, overflow: 'hidden'},
    divTrack: {flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', flex: 1},
    divHalf: {flex: 1, alignItems: 'flex-end'},
    divMid: {width: 1.5},
    num: {textAlign: 'right', fontVariant: ['tabular-nums']},
    listContent: {paddingBottom: 48},
    subHeader: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 10},
    colHeader: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 3, borderLeftColor: 'transparent'},
    note: {paddingHorizontal: 16, paddingTop: 12},
});
