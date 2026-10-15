import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {ErrorState, InfoTip, Segmented, SkeletonList, T} from '../../components/ui';
import {pdo} from '../../analytics';
import {useAppTheme} from '../../theme';
import {num, pct, savePct} from '../../utils/format';
import {matchTeamSummaries} from './data';
import {ColTitle, DivergingBar, TeamCell, TeamRow, abbrevOf, styles as shared} from './shared';

const SORTS = [
    {key: 'pdo', label: 'PDO'},
    {key: 'shootingPct', label: 'Shooting %'},
    {key: 'savePct', label: 'Save %'},
];

const PDO_INFO = 'PDO = team shooting % + team save % (×1000), all situations. League average is about 1000. ' +
    'Teams far above it are usually riding hot shooting or goaltending and tend to come back to earth; teams ' +
    'well below are often better than their record. It’s a luck flag, not a skill rating.';
const SH_INFO = 'Share of the team’s shots on goal that go in.';
const SV_INFO = 'Share of shots on goal against that the team’s goalies stop.';

const PdoRow = memo(function PdoRow({item, rank, fav, onTeamPress}) {
    const {colors} = useAppTheme();
    const d = item.pdo - 1000;
    const color = d > 10 ? colors.warning : d < -10 ? colors.accent : undefined;
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress}>
            <TeamCell rank={rank} abbrev={item.abbrev} width={92}/>
            <View style={st.pdoCol}>
                <T variant="label" color={color} style={shared.num}>{num(item.pdo, 0)}</T>
                <DivergingBar value={d} max={40} height={6} color={d > 0 ? colors.warning : colors.accent}/>
            </View>
            <T variant="caption" style={[shared.num, st.c]}>{pct(item.shootingPct, 1)}</T>
            <T variant="caption" style={[shared.num, st.c]}>{savePct(item.savePct)}</T>
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
                <View style={st.title}>
                    <T variant="heading">PDO</T>
                    <InfoTip title="PDO" body={PDO_INFO}/>
                </View>
                <T variant="caption" muted>Above 1000 = running hot (likely to cool off) · below = running cold</T>
                <Segmented options={SORTS} value={sort} onChange={setSort}/>
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={92} align="left">TEAM</ColTitle>
                <View style={[st.pdoCol, st.hRow]}><ColTitle>PDO</ColTitle></View>
                <View style={[st.c, st.hRow]}><ColTitle>SH%</ColTitle><InfoTip title="Shooting %" body={SH_INFO} size={12}/></View>
                <View style={[st.c, st.hRow]}><ColTitle>SV%</ColTitle><InfoTip title="Save %" body={SV_INFO} size={12}/></View>
            </View>
        </View>
    );

    if (q.loading && !q.data) return <View>{header}<SkeletonList count={8} height={48} style={st.pad}/></View>;
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
    title: {flexDirection: 'row', alignItems: 'center', gap: 6},
    pdoCol: {flex: 1, gap: 4, paddingHorizontal: 6},
    hRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    c: {width: 64},
    pad: {paddingHorizontal: 16},
});
