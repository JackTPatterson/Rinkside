import React, {memo, useCallback, useMemo} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {ErrorState, SkeletonList, T} from '../../components/ui';
import {GUTTER} from '../../theme';
import {parseISODate, shortDate} from '../../utils/format';
import {ColTitle, Movement, TeamCell, TeamRow, ViewTitle, abbrevOf, styles as shared, type} from './shared';

const POWER_INFO = 'MoneyPuck’s power rankings blend each team’s results with underlying play ' +
    '(expected goals, shot quality, goaltending) into one ordering. The arrow shows how ' +
    'many places a team moved since the snapshot about a week ago.';

const RECORD_W = 90;

const PowerRow = memo(function PowerRow({item, fav, onTeamPress}) {
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress}>
            <TeamCell rank={item.rank} abbrev={item.abbrev} width={106}/>
            <View style={st.move}><Movement value={item.hasPrev ? item.movement : 0}/></View>
            {/* Record on the right edge, like the value columns in the other tables. */}
            <View style={st.record}>
                {item.record ? <T numberOfLines={1} style={[type.value, st.right]}>{item.record}</T> : null}
                {item.points != null ? <T muted numberOfLines={1} style={[type.small, st.right]}>{item.points} pts</T> : null}
            </View>
        </TeamRow>
    );
});

/** MoneyPuck power rankings with week-over-week movement. q = useQuery(fetchPowerRankings). */
export default function PowerView({q, rows, fav, onTeamPress, refreshControl, listRef}) {
    const byAbbrev = useMemo(() => new Map((rows ?? []).map((r) => [abbrevOf(r), r])), [rows]);
    const data = useMemo(() => (q.data?.rows ?? []).map((p) => {
        const s = byAbbrev.get(p.abbrev);
        return {
            ...p,
            hasPrev: !!q.data?.previousDate,
            record: s ? `${s.wins ?? 0}-${s.losses ?? 0}-${s.otLosses ?? 0}` : null,
            points: s ? s.points ?? 0 : null,
        };
    }), [q.data, byAbbrev]);

    const renderItem = useCallback(({item}) => <PowerRow item={item} fav={fav} onTeamPress={onTeamPress}/>, [fav, onTeamPress]);
    const since = q.data?.previousDate
        ? `Movement vs ${shortDate(parseISODate(q.data.previousDate))}`
        : q.data ? 'No earlier snapshot found, so no movement this week' : '';

    const header = (
        <View>
            <View style={shared.subHeader}>
                <ViewTitle info={POWER_INFO}>Power Rankings</ViewTitle>
                {since ? <T muted style={type.small}>{since}</T> : null}
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={106} align="left">TEAM</ColTitle>
                <View style={st.move}><ColTitle align="left">MOVE</ColTitle></View>
                <ColTitle width={RECORD_W}>RECORD</ColTitle>
            </View>
        </View>
    );

    if (q.data === undefined && !q.error) return <View>{header}<SkeletonList count={8} height={56} gap={4} style={st.pad}/></View>;
    if (!data.length) {
        return (
            <View>
                {header}
                <ErrorState message="Power rankings haven’t been published yet (or they’re unreachable)." onRetry={q.refresh}/>
            </View>
        );
    }
    return (
        <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(i) => i.abbrev}
            renderItem={renderItem}
            ListHeaderComponent={header}
            refreshControl={refreshControl}
            contentContainerStyle={shared.listContent}
            initialNumToRender={16}
        />
    );
}

const st = StyleSheet.create({
    move: {flex: 1, alignItems: 'flex-start'},
    record: {width: RECORD_W, alignItems: 'flex-end'},
    right: {textAlign: 'right', fontVariant: ['tabular-nums']},
    pad: {paddingHorizontal: GUTTER},
});
