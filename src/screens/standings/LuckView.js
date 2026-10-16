import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {EmptyState, InfoTip, Segmented, T} from '../../components/ui';
import RangeBar, {RangeLegend} from '../players/RangeBar';
import {leaguePointPct, teamProfile} from '../../analytics';
import {useAppTheme} from '../../theme';
import {num, signed} from '../../utils/format';
import {REGULAR_SEASON_GAMES} from '../../utils/season';
import {ColTitle, TeamCell, TeamRow, ViewTitle, abbrevOf, styles as shared, type} from './shared';

const C_W = 44;
const P_W = 48;

const SORTS = [
    {key: 'projected', label: 'Projected'},
    {key: 'luck', label: 'Luck'},
    {key: 'pace', label: 'Pace'},
];

const LUCK_INFO = 'Luck compares a team’s actual points to the points its goal differential “should” have ' +
    'earned (Pythagorean expectation, adjusted for loser points). Big positive numbers usually mean close-game ' +
    'luck — one-goal and shootout wins — which tends to fade.';
const PROJ_INFO = 'Projected final points: current points plus a projection for the games left, where each team’s ' +
    'points rate is blended with 15 games of league-average hockey (Bayesian). The bar shows the 80% range: ' +
    'in 8 seasons out of 10 the final total should land inside it. The dot is the projection and the tick marks current points.';

const LuckRow = memo(function LuckRow({item, rank, scale, fav, onTeamPress}) {
    const {colors, teamColor} = useAppTheme();
    const luckColor = item.luck >= 1.5 ? colors.positive : item.luck <= -1.5 ? colors.live : undefined;
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress} style={st.row}>
            <View style={st.top}>
                <TeamCell rank={rank} abbrev={item.abbrev} width={106}/>
                <T style={[type.value, shared.num, st.c]}>{item.points}</T>
                <T style={[type.value, shared.num, st.c]}>{num(item.expectedPoints, 0)}</T>
                <T color={luckColor} style={[type.value, shared.num, st.c]}>{signed(item.luck, 1)}</T>
                <T style={[type.value, shared.num, st.c]}>{num(item.pace, 0)}</T>
                <T style={[type.strong, shared.num, st.p]}>{num(item.projected, 0)}</T>
            </View>
            <View style={st.bottom}>
                {/* Same bar as True shooting talent: band = 80% range, dot = projection, tick = points now. */}
                <View style={st.flex}>
                    <RangeBar
                        compact
                        lo={item.projectedLo}
                        hi={item.projectedHi}
                        estimate={item.projected}
                        observed={item.points}
                        min={scale.min}
                        max={scale.max}
                        color={teamColor(item.abbrev)}
                    />
                </View>
                <T muted style={[type.small, st.rangeText]}>{`${num(item.projectedLo, 0)}–${num(item.projectedHi, 0)}`}</T>
            </View>
        </TeamRow>
    );
});

/** Luck & projection: actual vs Pythagorean points, pace, projected final points (80% interval). */
export default memo(function LuckView({rows, fav, onTeamPress, refreshControl, listRef}) {
    const {colors} = useAppTheme();
    const [sort, setSort] = useState('projected');
    const lp = useMemo(() => leaguePointPct(rows), [rows]);
    const profiles = useMemo(
        () => (rows ?? [])
            .map((r) => ({abbrev: abbrevOf(r), ...teamProfile(r, {leaguePointPct: lp, seasonGames: REGULAR_SEASON_GAMES})}))
            .filter((p) => p.abbrev),
        [rows, lp],
    );
    const data = useMemo(() => [...profiles].sort((a, b) => b[sort] - a[sort]), [profiles, sort]);
    const scale = useMemo(() => {
        if (!profiles.length) return {min: 0, max: 1};
        const lo = Math.min(...profiles.map((p) => Math.min(p.projectedLo, p.points)));
        const hi = Math.max(...profiles.map((p) => p.projectedHi));
        return {min: Math.floor(lo / 10) * 10, max: Math.ceil(hi / 10) * 10};
    }, [profiles]);
    const played = useMemo(() => profiles.reduce((s, p) => s + p.gp, 0), [profiles]);

    const renderItem = useCallback(
        ({item, index}) => <LuckRow item={item} rank={index + 1} scale={scale} fav={fav} onTeamPress={onTeamPress}/>,
        [scale, fav, onTeamPress],
    );

    const header = (
        <View>
            <View style={shared.subHeader}>
                <ViewTitle info={PROJ_INFO} infoTitle="Projected points">Luck & Projection</ViewTitle>
                <T muted style={type.small}>{`League points% ${num(lp, 3).replace(/^0/, '')} · final points, ${scale.min}–${scale.max} scale`}</T>
                <Segmented options={SORTS} value={sort} onChange={setSort}/>
                <RangeLegend color={colors.textSecondary} estimateLabel="Projected" observedLabel="Points now" style={st.legend}/>
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={106} align="left">TEAM</ColTitle>
                <ColTitle width={C_W}>PTS</ColTitle>
                <ColTitle width={C_W}>xPTS</ColTitle>
                <View style={[st.c, st.hRow]}><ColTitle>LUCK</ColTitle><InfoTip title="Luck" body={LUCK_INFO} size={12}/></View>
                <View style={[st.c, st.hRow]}><ColTitle>PACE</ColTitle></View>
                <ColTitle width={P_W}>PROJ</ColTitle>
            </View>
        </View>
    );

    if (!played) return <View>{header}<EmptyState message="Projections appear once the season’s first games are played."/></View>;
    return (
        <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(i) => i.abbrev}
            renderItem={renderItem}
            ListHeaderComponent={header}
            refreshControl={refreshControl}
            contentContainerStyle={shared.listContent}
            initialNumToRender={12}
        />
    );
});

const st = StyleSheet.create({
    row: {flexDirection: 'column', alignItems: 'stretch', paddingVertical: 10, gap: 8},
    top: {flexDirection: 'row', alignItems: 'center'},
    bottom: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 26},
    hRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    c: {width: C_W, flexShrink: 1},
    p: {width: P_W},
    flex: {flex: 1},
    legend: {marginTop: 10},
    rangeText: {width: 64, textAlign: 'right', fontVariant: ['tabular-nums']},
});
