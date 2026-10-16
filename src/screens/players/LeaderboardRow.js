import React, {memo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {headshotUrl} from '../../api/nhl';
import {Headshot, Skeleton, T, TeamLogo} from '../../components/ui';
import {GUTTER, useAppTheme} from '../../theme';
import {lastTeam} from './helpers';

// Rows sit straight on the page background (no card), aligned to the screen gutter and separated
// by their own vertical breathing room. ROW_HEIGHT / TABLE_ROW_HEIGHT are the full per-row pitch
// because FlatList getItemLayout uses them.
const ROW_GAP = 0;
const CARD_HEIGHT = 60;
const TABLE_CARD_HEIGHT = 44;
const CARD_PAD = 0;
export const ROW_HEIGHT = CARD_HEIGHT + ROW_GAP;
export const TABLE_ROW_HEIGHT = TABLE_CARD_HEIGHT + ROW_GAP;
export const TABLE_NAME_WIDTH = 168;

/** Compact leaderboard row: rank, headshot, name / team, three stat columns. Fixed height. */
export const LeaderboardRow = memo(function LeaderboardRow({item, columns, sortKey, seasonId, onPress}) {
    const {teamColor} = useAppTheme();
    const r = item.row;
    const team = lastTeam(r.teamAbbrevs);
    const accent = teamColor(team);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.rank ? `${item.rank}. ` : ''}${item.name}, ${team}`}
            onPress={() => onPress(r, item.name)}
            style={({pressed}) => [styles.row, pressed && styles.pressed]}>
            <T variant="label" muted style={styles.rank}>{item.rank ?? '–'}</T>
            <Headshot uri={team ? headshotUrl(r.playerId, team, seasonId) : null} size={40} borderColor={accent}/>
            <View style={styles.name}>
                <T variant="body" numberOfLines={1} style={styles.semibold}>{item.name}</T>
                <View style={styles.teamLine}>
                    <TeamLogo abbrev={team} size={14}/>
                    <T variant="caption" muted numberOfLines={1}>
                        {[r.teamAbbrevs, r.positionCode].filter(Boolean).join(' · ')}
                    </T>
                </View>
            </View>
            {columns.map((c) => {
                const active = c.key === sortKey;
                return (
                    <T
                        key={c.key}
                        variant="body"
                        muted={!active}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[styles.stat, active && styles.semibold, {width: c.width + 6}]}>
                        {c.text(r)}
                    </T>
                );
            })}
        </Pressable>
    );
});

export const CompactHeader = memo(function CompactHeader({columns, sortKey}) {
    return (
        <View style={styles.header}>
            <T variant="caption" style={[styles.headerText, styles.headerName]}>Player</T>
            {columns.map((c) => (
                <T key={c.key} variant="caption" style={[styles.headerText, styles.stat, c.key === sortKey && styles.headerActive, {width: c.width + 6}]}>{c.title}</T>
            ))}
        </View>
    );
});

/** Wide row with every column (table mode, inside a horizontal ScrollView). */
export const TableRow = memo(function TableRow({item, columns, sortKey, onPress}) {
    const {teamColor} = useAppTheme();
    const r = item.row;
    const team = lastTeam(r.teamAbbrevs);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.rank ? `${item.rank}. ` : ''}${item.name}`}
            onPress={() => onPress(r, item.name)}
            style={({pressed}) => [styles.tableRow, pressed && styles.pressed]}>
            <View style={styles.tableName}>
                <T variant="caption" muted style={styles.tableRank}>{item.rank ?? '–'}</T>
                <TeamLogo abbrev={team} size={18}/>
                <T variant="body" numberOfLines={1} style={[styles.flex, styles.semibold]}>{item.name}</T>
            </View>
            {columns.map((c) => {
                const active = c.key === sortKey;
                return (
                    <T
                        key={c.key}
                        variant="body"
                        color={active ? teamColor(team) : undefined}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[styles.stat, active && styles.semibold, {width: c.width}]}>
                        {c.text(r)}
                    </T>
                );
            })}
        </Pressable>
    );
});

export const TableHeader = memo(function TableHeader({columns, sortKey}) {
    return (
        <View style={styles.tableHeader}>
            <T variant="caption" style={[styles.headerText, {width: TABLE_NAME_WIDTH}]}>Player</T>
            {columns.map((c) => (
                <T key={c.key} variant="caption" style={[styles.headerText, styles.stat, c.key === sortKey && styles.headerActive, {width: c.width}]}>{c.title}</T>
            ))}
        </View>
    );
});

/** Placeholder with the exact geometry of CompactHeader + LeaderboardRow, so nothing shifts. */
export function LeaderboardSkeleton({count = 10}) {
    return (
        <View>
            <View style={styles.header}>
                <Skeleton width={48} height={16} radius={15}/>
            </View>
            {Array.from({length: count}).map((_, i) => (
                <View key={i} style={styles.skRow}>
                    <Skeleton width={40} height={40} radius={20}/>
                    <View style={styles.name}>
                        <Skeleton width="60%" height={14} radius={7}/>
                        <Skeleton width="35%" height={10} radius={5} style={styles.skLine}/>
                    </View>
                    <Skeleton width={96} height={14} radius={7}/>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    semibold: {fontFamily: 'Sora_600SemiBold'},
    pressed: {opacity: 0.6},
    skRow: {height: CARD_HEIGHT, marginHorizontal: GUTTER, marginBottom: ROW_GAP, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 34},
    skLine: {marginTop: 6},
    row: {
        height: CARD_HEIGHT,
        marginHorizontal: GUTTER,
        marginBottom: ROW_GAP,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: CARD_PAD,
    },
    rank: {width: 24, textAlign: 'right', fontSize: 14, fontVariant: ['tabular-nums']},
    name: {flex: 1, minWidth: 0},
    teamLine: {flexDirection: 'row', alignItems: 'center', gap: 2},
    stat: {textAlign: 'right', fontVariant: ['tabular-nums']},
    // Old table header: 14pt SemiBold at half opacity, no rule underneath.
    headerText: {fontFamily: 'Sora_600SemiBold', fontSize: 14, lineHeight: 18, opacity: 0.5},
    headerActive: {opacity: 1},
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: GUTTER + CARD_PAD,
        paddingTop: 4,
        paddingBottom: 8,
    },
    headerName: {flex: 1},
    tableRow: {
        height: TABLE_CARD_HEIGHT,
        marginHorizontal: GUTTER,
        marginBottom: ROW_GAP,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 0,
    },
    tableName: {width: TABLE_NAME_WIDTH, flexDirection: 'row', alignItems: 'center', gap: 6},
    tableRank: {width: 22, textAlign: 'right'},
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: GUTTER,
        paddingTop: 4,
        paddingBottom: 8,
    },
});
