import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {ErrorState, InfoTip, Segmented, SkeletonList, T} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {pct} from '../../utils/format';
import OddsSheet from './OddsSheet';
import {AnimatedBar, TeamCell, TeamRow, styles as shared} from './shared';

const MODES = [
    {key: 'madePlayoffs', label: 'Playoffs'},
    {key: 'wonCup', label: 'Cup'},
    {key: 'draftLottery', label: 'Lottery'},
];
const INFO = {
    madePlayoffs: 'MoneyPuck simulates the rest of the season thousands of times using its team-strength ' +
        'model. This is the share of simulations in which the team makes the playoffs — a model estimate, not a guarantee. Tap a team for its round-by-round odds.',
    wonCup: 'Share of MoneyPuck’s season + playoff simulations in which the team wins the Stanley Cup. ' +
        'Even the best team rarely tops ~25%: four best-of-seven series is a lot of coin flips.',
    draftLottery: 'MoneyPuck’s estimated chance that the team wins the NHL draft lottery, from its season ' +
        'simulations plus the league’s lottery odds. Bad teams have the best chances.',
};
const TITLES = {madePlayoffs: 'Playoff odds', wonCup: 'Stanley Cup odds', draftLottery: 'Draft lottery odds'};

const OddsRow = memo(function OddsRow({item, rank, mode, fav, onSelect}) {
    const {teamColor} = useAppTheme();
    const v = item[mode];
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onSelect}>
            <TeamCell rank={rank} abbrev={item.abbrev} width={100}/>
            <View style={st.bar}>
                <AnimatedBar value={v} color={teamColor(item.abbrev)} height={12} delay={Math.min(rank, 16) * 15}/>
            </View>
            <T variant="label" style={[shared.num, st.val]}>{pct(v, v != null && v > 0 && v < 0.01 ? 1 : 0)}</T>
        </TeamRow>
    );
});

/** MoneyPuck playoff / Cup / lottery odds with a per-team detail sheet. q = useQuery(fetchSimulations). */
export default function OddsView({q, fav, onTeamPress, refreshControl, listRef}) {
    const [mode, setMode] = useState('madePlayoffs');
    const [selected, setSelected] = useState(null);
    const data = useMemo(
        () => (q.data ?? []).filter((r) => r[mode] != null).sort((a, b) => b[mode] - a[mode]),
        [q.data, mode],
    );
    const byAbbrev = useMemo(() => new Map((q.data ?? []).map((r) => [r.abbrev, r])), [q.data]);
    const onSelect = useCallback((abbrev) => setSelected(byAbbrev.get(abbrev) ?? null), [byAbbrev]);
    const onClose = useCallback(() => setSelected(null), []);
    const onOpenTeam = useCallback((abbrev) => {
        setSelected(null);
        onTeamPress(abbrev);
    }, [onTeamPress]);

    const favIdx = fav ? data.findIndex((r) => r.abbrev === fav) : -1;
    const renderItem = useCallback(
        ({item, index}) => <OddsRow item={item} rank={index + 1} mode={mode} fav={fav} onSelect={onSelect}/>,
        [mode, fav, onSelect],
    );

    const header = (
        <View>
            <View style={shared.subHeader}>
                <Segmented options={MODES} value={mode} onChange={setMode}/>
                <View style={st.title}>
                    <T variant="heading">{TITLES[mode]}</T>
                    <InfoTip title={TITLES[mode]} body={INFO[mode]}/>
                </View>
                <T variant="caption" muted>via MoneyPuck simulations · tap a team for details</T>
            </View>
            {favIdx >= 0 ? (
                <View style={st.pinned}>
                    <T variant="caption" muted style={st.pinLabel}>YOUR TEAM</T>
                    <OddsRow item={data[favIdx]} rank={favIdx + 1} mode={mode} fav={fav} onSelect={onSelect}/>
                </View>
            ) : null}
        </View>
    );

    let body;
    // First load: data is undefined until the fetch settles (loading is still false on the render
    // that enables the query, so checking `loading` alone flashed the error state).
    if (q.data === undefined && !q.error) {
        body = <View>{header}<SkeletonList count={8} height={44} gap={4} style={st.pad}/></View>;
    } else if (!data.length) {
        body = (
            <View>
                {header}
                <ErrorState message="MoneyPuck odds aren’t available right now." onRetry={q.refresh}/>
            </View>
        );
    } else {
        body = (
            <FlatList
                ref={listRef}
                data={data}
                keyExtractor={(i) => i.abbrev}
                renderItem={renderItem}
                extraData={mode}
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
    title: {flexDirection: 'row', alignItems: 'center', gap: 6},
    bar: {flex: 1, paddingHorizontal: 8},
    val: {width: 52},
    pinned: {marginBottom: 12},
    pinLabel: {paddingHorizontal: 16, paddingBottom: 4},
    pad: {paddingHorizontal: 16},
});
