import React, {memo, useCallback, useMemo} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {ErrorState, InfoTip, SkeletonList, T} from '../../components/ui';
import {getTeam} from '../../data/teams';
import {parseISODate, shortDate} from '../../utils/format';
import {ColTitle, Movement, TeamCell, TeamRow, abbrevOf, styles as shared} from './shared';

const POWER_INFO = 'MoneyPuck’s power rankings blend each team’s results with underlying play ' +
    '(expected goals, shot quality, goaltending) into one model-based ordering. The arrow shows how ' +
    'many places a team moved since the snapshot about a week ago.';

const PowerRow = memo(function PowerRow({item, fav, onTeamPress}) {
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress}>
            <TeamCell rank={item.rank} abbrev={item.abbrev} width={100}/>
            <View style={{flex: 1}}>
                <T variant="caption" muted numberOfLines={1}>{item.name}</T>
                {item.record ? <T variant="caption" numberOfLines={1}>{item.record}</T> : null}
            </View>
            <View style={st.move}><Movement value={item.hasPrev ? item.movement : 0}/></View>
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
            name: getTeam(p.abbrev)?.name ?? p.abbrev,
            record: s ? `${s.wins ?? 0}-${s.losses ?? 0}-${s.otLosses ?? 0} · ${s.points ?? 0} pts` : null,
        };
    }), [q.data, byAbbrev]);

    const renderItem = useCallback(({item}) => <PowerRow item={item} fav={fav} onTeamPress={onTeamPress}/>, [fav, onTeamPress]);
    const since = q.data?.previousDate
        ? `Movement vs ${shortDate(parseISODate(q.data.previousDate))}`
        : q.data ? 'No earlier snapshot found, so no movement this week' : '';

    const header = (
        <View>
            <View style={shared.subHeader}>
                <View style={st.title}>
                    <T variant="heading">Power Rankings</T>
                    <InfoTip title="Power Rankings" body={POWER_INFO}/>
                </View>
                {since ? <T variant="caption" muted>{since} · via MoneyPuck</T> : null}
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={100} align="left">TEAM</ColTitle>
                <View style={{flex: 1}}/>
                <ColTitle width={90}>MOVE</ColTitle>
            </View>
        </View>
    );

    if (q.data === undefined && !q.error) return <View>{header}<SkeletonList count={8} height={44} gap={4} style={st.pad}/></View>;
    if (!data.length) {
        return (
            <View>
                {header}
                <ErrorState message="MoneyPuck hasn’t published power rankings yet (or they’re unreachable)." onRetry={q.refresh}/>
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
    title: {flexDirection: 'row', alignItems: 'center', gap: 6},
    move: {width: 90, alignItems: 'flex-end'},
    pad: {paddingHorizontal: 16},
});
