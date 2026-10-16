import React, {memo, useEffect} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withDelay, withTiming} from 'react-native-reanimated';
import {InfoTip, T, TeamLogo, fillRadii, tap} from '../../components/ui';
import {ArrowDownRight, ArrowUpRight} from '../../components/icons';
import {getTeam, migrateTeamAbbrev} from '../../data/teams';
import {GUTTER, useAppTheme} from '../../theme';

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

/** Old Rinkside type scale (Sora). Applied on top of `T` variants. */
export const type = StyleSheet.create({
    rank: {fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 22},
    abbrev: {fontFamily: 'Sora_500Medium', fontSize: 16, lineHeight: 22},
    value: {fontFamily: 'Sora_500Medium', fontSize: 14, lineHeight: 20},
    strong: {fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 22},
    small: {fontFamily: 'Sora_500Medium', fontSize: 12, lineHeight: 16},
    col: {fontFamily: 'Sora_600SemiBold', fontSize: 12, lineHeight: 16, opacity: 0.5},
});

/** Rank · logo · abbrev cell used as the first column of every list. */
export const TeamCell = memo(function TeamCell({rank, abbrev, width = 112, suffix}) {
    return (
        <View style={[styles.teamCell, {width}]}>
            <T style={[type.rank, styles.rank]}>{rank}</T>
            <TeamLogo abbrev={abbrev} size={26}/>
            <T numberOfLines={1} style={[type.abbrev, {flexShrink: 1}]}>{abbrev ?? '—'}</T>
            {suffix ? <T muted style={type.small}>{suffix}</T> : null}
        </View>
    );
});

/** Pressable list row straight on the page background; the favourite team gets team-colour lines above and below. */
export function TeamRow({abbrev, fav, onPress, style, children, height}) {
    const {teamColor} = useAppTheme();
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
                isFav && {borderColor: tc},
                pressed && {opacity: 0.6},
                style,
            ]}>
            {children}
        </Pressable>
    );
}

/** 2px divider from the old app (text colour at 20% opacity). */
export function Divider({style}) {
    const {colors} = useAppTheme();
    return <View style={[styles.divider, {backgroundColor: colors.text}, style]}/>;
}

/** Dashed line marker, e.g. the playoff cut line between 8th and 9th. */
export function CutLine({label}) {
    const {colors} = useAppTheme();
    return (
        <View style={styles.cutWrap} accessibilityRole="text" accessibilityLabel={label}>
            <View style={[styles.cutDash, {borderColor: colors.live}]}/>
            <View style={[styles.cutPill, {backgroundColor: colors.card}]}>
                <T style={type.small} color={colors.live}>{label}</T>
            </View>
            <View style={[styles.cutDash, {borderColor: colors.live}]}/>
        </View>
    );
}

/** Week-over-week movement arrow (+ = moved up). */
export const Movement = memo(function Movement({value}) {
    const {colors} = useAppTheme();
    if (value == null) return <T muted style={type.small}>new</T>;
    if (value === 0) return <T muted style={type.strong}>–</T>;
    const up = value > 0;
    const c = up ? colors.positive : colors.live;
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    return (
        <View style={styles.move}>
            <Icon size={20} color={c}/>
            <T color={c} style={type.strong}>{Math.abs(value)}</T>
        </View>
    );
});

/** Horizontal bar that grows from 0 on mount / value change (UI thread). */
export function AnimatedBar({value, color, height = 10, delay = 0, track}) {
    const {colors} = useAppTheme();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    const w = useSharedValue(0);
    useEffect(() => {
        w.value = withDelay(delay, withTiming(v, {duration: 450}));
    }, [v, delay, w]);
    const R = height / 2;
    // Rounded at the origin; the leading edge stays flat until the bar is full.
    const anim = useAnimatedStyle(() => ({width: `${w.value * 100}%`, ...fillRadii(w.value, R)}));
    return (
        <View style={[styles.barTrack, {height, borderRadius: R, backgroundColor: track ?? colors.card}]}>
            <Animated.View style={[{height: '100%', backgroundColor: color}, anim]}/>
        </View>
    );
}

/**
 * Bar centred on zero for signed values (goal differential, net rating, PDO − 1000).
 * `max` is the absolute value that fills one half.
 */
export const DivergingBar = memo(function DivergingBar({value, max, color, height = 8, track}) {
    const {colors} = useAppTheme();
    const v = Number(value) || 0;
    const share = max > 0 ? Math.min(1, Math.abs(v) / max) : 0;
    const R = height / 2;
    // Fills grow out from the centre line: flat at the centre (inner) end, rounded at the far end.
    return (
        <View style={[styles.divTrack, {height, borderRadius: R, backgroundColor: track ?? colors.card}]}>
            <View style={styles.divHalf}>
                {v < 0 ? <View style={{width: `${share * 100}%`, height: '100%', borderTopLeftRadius: R, borderBottomLeftRadius: R, backgroundColor: color ?? colors.live}}/> : null}
            </View>
            <View style={[styles.divMid, {backgroundColor: colors.textSecondary}]}/>
            <View style={[styles.divHalf, {alignItems: 'flex-start'}]}>
                {v > 0 ? <View style={{width: `${share * 100}%`, height: '100%', borderTopRightRadius: R, borderBottomRightRadius: R, backgroundColor: color ?? colors.positive}}/> : null}
            </View>
        </View>
    );
});

/** Column header label (old style: 12pt SemiBold at 50% opacity). */
export function ColTitle({children, width, align = 'right'}) {
    return <T numberOfLines={1} style={[type.col, {width, textAlign: align}]}>{children}</T>;
}

/** Section / view title: old 24pt SemiBold. */
export function ViewTitle({children, info, infoTitle}) {
    return (
        <View style={styles.title}>
            <T variant="title" style={{flexShrink: 1}}>{children}</T>
            {info ? <InfoTip title={infoTitle ?? children} body={info}/> : null}
        </View>
    );
}

// List row (no card): content sits on the screen gutter. The 2px border (transparent unless
// favourite) and a small inner pad live inside that gutter so the favourite outline has room.
const ROW_PAD = 4;
const ROW_BORDER = 2;
const ROW_MARGIN = GUTTER - ROW_PAD - ROW_BORDER;
export const ROW_INSET = ROW_MARGIN + ROW_PAD + ROW_BORDER;

export const styles = StyleSheet.create({
    teamCell: {flexDirection: 'row', alignItems: 'center', gap: 6},
    rank: {minWidth: 20, textAlign: 'right', fontVariant: ['tabular-nums']},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: ROW_MARGIN,
        marginBottom: 4,
        paddingHorizontal: ROW_PAD,
        paddingVertical: 8,
        // The favourite team is marked by a team-colour line above and below the row (no rounded box).
        borderTopWidth: ROW_BORDER,
        borderBottomWidth: ROW_BORDER,
        borderColor: 'transparent',
        minHeight: 56,
    },
    divider: {height: 2, marginVertical: 10, opacity: 0.2, marginHorizontal: GUTTER},
    cutWrap: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, paddingVertical: 6, marginBottom: 4},
    cutDash: {flex: 1, height: 0, borderTopWidth: 2, borderStyle: 'dashed'},
    cutPill: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15},
    move: {flexDirection: 'row', alignItems: 'center', gap: 4},
    // Fills the width it's given, never the height (flex: 1 in a column stretched it into a thick block).
    barTrack: {alignSelf: 'stretch', overflow: 'hidden'},
    divTrack: {flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', flex: 1},
    divHalf: {flex: 1, alignItems: 'flex-end'},
    divMid: {width: 2},
    num: {textAlign: 'right', fontVariant: ['tabular-nums']},
    listContent: {paddingBottom: 48},
    subHeader: {paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 10, gap: 10},
    colHeader: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: ROW_INSET, paddingTop: 4, paddingBottom: 8},
    note: {paddingHorizontal: GUTTER, paddingTop: 12},
    title: {flexDirection: 'row', alignItems: 'center', gap: 6},
});
