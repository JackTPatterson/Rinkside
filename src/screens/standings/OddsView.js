import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {ErrorState, SkeletonList, T} from '../../components/ui';
import {GUTTER} from '../../theme';
import {pct} from '../../utils/format';
import OddsSheet from './OddsSheet';
import {PlayoffBar, StopKey} from './PlayoffBar';
import {ColTitle, TeamCell, TeamRow, ViewTitle, styles as shared, type} from './shared';

const INFO = {
    madePlayoffs: 'MoneyPuck simulates the rest of the season thousands of times using its team-strength ' +
        'ratings. This is the share of simulations in which the team makes the playoffs. Tap a team for its round-by-round odds.',
};
const TITLES = {madePlayoffs: 'Playoff odds'};

// Same row as every other Rankings table: rank · logo · abbrev, then the slim stacked playoff bar and
// the number on the right. The favourite team gets the usual lines (no pinned copy).
const ROW_H = 52;
const PCT_W = 56;
const MODE_COL = {madePlayoffs: 'PLAYOFFS'};

const OddsRow = memo(function OddsRow({item, rank, mode, fav, onSelect}) {
    const v = item[mode];
    const label = pct(v, v != null && v > 0 && v < 0.01 ? 1 : 0);
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onSelect} height={ROW_H}>
            <TeamCell rank={rank} abbrev={item.abbrev} width={106}/>
            <View style={st.bar}>
                <PlayoffBar odds={item} height={6}/>
            </View>
            <T style={[type.strong, st.pct]} accessibilityLabel={`${item.abbrev}, ${label}`}>{label}</T>
        </TeamRow>
    );
});

/** MoneyPuck playoff odds with a per-team detail sheet (round-by-round, Cup and lottery odds). q = useQuery(fetchSimulations). */
export default function OddsView({q, fav, onTeamPress, refreshControl, listRef}) {
    const mode = 'madePlayoffs';
    const [selected, setSelected] = useState(null);
    const data = useMemo(
        () => (q.data ?? []).filter((r) => r[mode] != null).sort((a, b) => b[mode] - a[mode]),
        [q.data],
    );
    const byAbbrev = useMemo(() => new Map((q.data ?? []).map((r) => [r.abbrev, r])), [q.data]);
    const onSelect = useCallback((abbrev) => setSelected(byAbbrev.get(abbrev) ?? null), [byAbbrev]);
    const onClose = useCallback(() => setSelected(null), []);
    const onOpenTeam = useCallback((abbrev) => {
        setSelected(null);
        onTeamPress(abbrev);
    }, [onTeamPress]);

    const renderItem = useCallback(
        ({item, index}) => <OddsRow item={item} rank={index + 1} mode={mode} fav={fav} onSelect={onSelect}/>,
        [fav, onSelect],
    );

    const header = (
        <View>
            <View style={shared.subHeader}>
                <ViewTitle info={INFO[mode]}>{TITLES[mode]}</ViewTitle>
                <T muted style={type.small}>MoneyPuck season simulations · tap a team for round-by-round, Cup and lottery odds</T>
                <StopKey style={st.key}/>
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={106} align="left">TEAM</ColTitle>
                <View style={st.bar}/>
                <ColTitle width={PCT_W}>{MODE_COL[mode]}</ColTitle>
            </View>
        </View>
    );

    let body;
    // First load: data is undefined until the fetch settles (loading is still false on the render
    // that enables the query, so checking `loading` alone flashed the error state).
    if (q.data === undefined && !q.error) {
        body = <View>{header}<SkeletonList count={8} height={ROW_H} gap={4} style={st.pad}/></View>;
    } else if (!data.length) {
        body = (
            <View>
                {header}
                <ErrorState message="Odds aren’t available right now." onRetry={q.refresh}/>
            </View>
        );
    } else {
        body = (
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
    return (
        <>
            {body}
            <OddsSheet odds={selected} onClose={onClose} onOpenTeam={onOpenTeam}/>
        </>
    );
}

const st = StyleSheet.create({
    bar: {flex: 1, marginHorizontal: 10},
    pct: {width: PCT_W, textAlign: 'right', fontVariant: ['tabular-nums']},
    pad: {paddingHorizontal: GUTTER},
    key: {marginTop: 12},
});
