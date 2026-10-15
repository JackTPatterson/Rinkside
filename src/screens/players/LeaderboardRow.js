import React, {memo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {headshotUrl} from '../../api/nhl';
import {Headshot, T, TeamLogo} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {lastTeam} from './helpers';

export const ROW_HEIGHT = 64;
export const TABLE_ROW_HEIGHT = 52;
export const TABLE_NAME_WIDTH = 168;

/** Compact leaderboard row: rank, headshot, name / team, three stat columns. Fixed height. */
export const LeaderboardRow = memo(function LeaderboardRow({item, columns, sortKey, seasonId, onPress}) {
    const {colors, teamColor} = useAppTheme();
    const r = item.row;
    const team = lastTeam(r.teamAbbrevs);
    const accent = teamColor(team);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.rank}. ${item.name}, ${team}`}
            onPress={() => onPress(r, item.name)}
            style={({pressed}) => [styles.row, {borderBottomColor: colors.border}, pressed && {backgroundColor: colors.card}]}>
            <T variant="label" muted style={styles.rank}>{item.rank}</T>
            <Headshot uri={team ? headshotUrl(r.playerId, team, seasonId) : null} size={40} borderColor={accent}/>
            <View style={styles.name}>
                <T variant="label" numberOfLines={1}>{item.name}</T>
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
                        variant={active ? 'label' : 'body'}
                        color={active ? accent : undefined}
                        muted={!active}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[styles.stat, {width: c.width + 6}]}>
                        {c.text(r)}
                    </T>
                );
            })}
        </Pressable>
    );
});

export const CompactHeader = memo(function CompactHeader({columns, sortKey}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <T variant="caption" muted style={styles.headerName}>Player</T>
            {columns.map((c) => (
                <T key={c.key} variant="caption" muted={c.key !== sortKey} style={[styles.stat, {width: c.width + 6}]}>{c.title}</T>
            ))}
        </View>
    );
});

/** Wide row with every column (table mode, inside a horizontal ScrollView). */
export const TableRow = memo(function TableRow({item, columns, sortKey, onPress}) {
    const {colors, teamColor} = useAppTheme();
    const r = item.row;
    const team = lastTeam(r.teamAbbrevs);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.rank}. ${item.name}`}
            onPress={() => onPress(r, item.name)}
            style={({pressed}) => [styles.tableRow, {borderBottomColor: colors.border}, pressed && {backgroundColor: colors.card}]}>
            <View style={styles.tableName}>
                <T variant="caption" muted style={styles.tableRank}>{item.rank}</T>
                <TeamLogo abbrev={team} size={18}/>
                <T variant="label" numberOfLines={1} style={{flex: 1}}>{item.name}</T>
            </View>
            {columns.map((c) => {
                const active = c.key === sortKey;
                return (
                    <T
                        key={c.key}
                        variant={active ? 'label' : 'body'}
                        color={active ? teamColor(team) : undefined}
                        numberOfLines={1}
                        style={[styles.stat, {width: c.width}]}>
                        {c.text(r)}
                    </T>
                );
            })}
        </Pressable>
    );
});

export const TableHeader = memo(function TableHeader({columns, sortKey}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.tableHeader, {borderBottomColor: colors.border}]}>
            <T variant="caption" muted style={{width: TABLE_NAME_WIDTH}}>Player</T>
            {columns.map((c) => (
                <T key={c.key} variant="caption" muted={c.key !== sortKey} style={[styles.stat, {width: c.width}]}>{c.title}</T>
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    row: {
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rank: {width: 24, textAlign: 'right', fontVariant: ['tabular-nums']},
    name: {flex: 1, minWidth: 0},
    teamLine: {flexDirection: 'row', alignItems: 'center', gap: 2},
    stat: {textAlign: 'right', fontVariant: ['tabular-nums']},
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerName: {flex: 1},
    tableRow: {
        height: TABLE_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tableName: {width: TABLE_NAME_WIDTH, flexDirection: 'row', alignItems: 'center', gap: 6},
    tableRank: {width: 22, textAlign: 'right'},
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});
