import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {ErrorState, Segmented, SkeletonList, T} from '../../components/ui';
import {pdo} from '../../analytics';
import {GUTTER, useAppTheme} from '../../theme';
import {num, pct, savePct} from '../../utils/format';
import {matchTeamSummaries} from './data';
import {ColTitle, DivergingBar, TeamCell, TeamRow, ViewTitle, abbrevOf, styles as shared, type} from './shared';

const SORTS = [
    {key: 'pdo', label: 'PDO'},
    {key: 'shootingPct', label: 'Shooting %'},
    {key: 'savePct', label: 'Save %'},
];

const PDO_INFO = 'PDO = team shooting % + team save % (×1000), all situations. League average is about 1000. ' +
    'Teams far above it are usually riding hot shooting or goaltending and tend to come back to earth; teams ' +
    'well below are often better than their record. It’s a luck flag, not a skill rating.';

const PdoRow = memo(function PdoRow({item, rank, fav, onTeamPress}) {
    const {colors} = useAppTheme();
    const d = item.pdo - 1000;
    const color = d > 10 ? colors.warning : d < -10 ? colors.accent : undefined;
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress}>
            <TeamCell rank={rank} abbrev={item.abbrev} width={106}/>
            <View style={st.pdoCol}>
                <T color={color} style={[type.strong, shared.num]}>{num(item.pdo, 0)}</T>
                <DivergingBar value={d} max={40} height={6} color={d > 0 ? colors.warning : colors.accent}/>
            </View>
            <T style={[type.value, shared.num, st.c]}>{pct(item.shootingPct, 1)}</T>
            <T style={[type.value, shared.num, st.c]}>{savePct(item.savePct)}</T>
        </TeamRow>
    );
});

/** PDO from the stats-API team summary, matched to standings rows by name. q = useQuery(nhl.teams). */
export default function PdoView({q, rows, fav, onTeamPress, refreshControl, listRef}) {
    const [sort, setSort] = useState('pdo');
    const matched = useMemo(() => {
        const stats = Array.isArray(q.data?.data) ? q.data.data : Array.isArray(q.data) ? q.data : [];
        const map = matchTeamSummaries(rows ?? [], stats);
        const out = [];
        for (const r of rows ?? []) {
            const a = abbrevOf(r);
            const s = map.get(a);
            if (!s) continue;
            const p = pdo(s);
            if (p && Number.isFinite(p.pdo)) out.push({abbrev: a, ...p});
        }
        return out;
    }, [q.data, rows]);
    const data = useMemo(() => [...matched].sort((a, b) => b[sort] - a[sort]), [matched, sort]);

    const renderItem = useCallback(
        ({item, index}) => <PdoRow item={item} rank={index + 1} fav={fav} onTeamPress={onTeamPress}/>,
        [fav, onTeamPress],
    );
    const header = (
        <View>
            <View style={shared.subHeader}>
                <ViewTitle info={PDO_INFO}>PDO</ViewTitle>
                <T muted style={type.small}>Above 1000 = running hot (likely to cool off) · below = running cold</T>
                <Segmented options={SORTS} value={sort} onChange={setSort}/>
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={106} align="left">TEAM</ColTitle>
                <View style={[st.pdoCol, st.hRow]}><ColTitle>PDO</ColTitle></View>
                <View style={[st.c, st.hRow]}><ColTitle>SH%</ColTitle></View>
                <View style={[st.c, st.hRow]}><ColTitle>SV%</ColTitle></View>
            </View>
        </View>
    );

    if (q.data === undefined && !q.error) return <View>{header}<SkeletonList count={8} height={56} gap={4} style={st.pad}/></View>;
    if (!data.length) {
        return (
            <View>
                {header}
                <ErrorState message={q.error ? 'Couldn’t load team stats.' : 'No team stats yet this season.'} onRetry={q.refresh}/>
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
    pdoCol: {flex: 1, gap: 4, paddingHorizontal: 6},
    hRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    c: {width: 64},
    pad: {paddingHorizontal: GUTTER},
});
