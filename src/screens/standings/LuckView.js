import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {EmptyState, InfoTip, Segmented, T} from '../../components/ui';
import {leaguePointPct, teamProfile} from '../../analytics';
import {useAppTheme, withAlpha} from '../../theme';
import {num, signed} from '../../utils/format';
import {REGULAR_SEASON_GAMES} from '../../utils/season';
import {ColTitle, TeamCell, TeamRow, abbrevOf, styles as shared} from './shared';

const C_W = 44;
const P_W = 48;

const SORTS = [
    {key: 'projected', label: 'Projected'},
    {key: 'luck', label: 'Luck'},
    {key: 'pace', label: 'Pace'},
];

const LUCK_INFO = 'Luck compares a team’s actual points to the points its goal differential “should” have ' +
    'earned (Pythagorean expectation, adjusted for loser points). Big positive numbers usually mean close-game ' +
    'luck — one-goal and shootout wins — which tends to fade. A model estimate.';
const PACE_INFO = 'Points per game so far × 82. A straight-line pace with no regression, so it swings a lot early in the season.';
const PROJ_INFO = 'Projected final points: current points plus a projection for the games left, where each team’s ' +
    'points rate is blended with 15 games of league-average hockey (Bayesian). The bar shows the 80% range: ' +
    'in 8 seasons out of 10 the final total should land inside it. The tick marks current points. A model estimate.';

const RangeBar = memo(function RangeBar({lo, hi, projected, current, min, max, color}) {
    const {colors} = useAppTheme();
    const span = Math.max(1, max - min);
    const x = (v) => `${Math.max(0, Math.min(1, (v - min) / span)) * 100}%`;
    const w = `${Math.max(0.01, Math.min(1, (hi - lo) / span)) * 100}%`;
    return (
        <View style={[st.range, {backgroundColor: colors.cardAlt}]}>
            <View style={[st.band, {left: x(lo), width: w, backgroundColor: withAlpha(color, 0.35)}]}/>
            <View style={[st.tick, {left: x(current), backgroundColor: colors.textSecondary}]}/>
            <View style={[st.dot, {left: x(projected), backgroundColor: color, borderColor: colors.background}]}/>
        </View>
    );
});

const LuckRow = memo(function LuckRow({item, rank, scale, fav, onTeamPress}) {
    const {colors, teamColor} = useAppTheme();
    const luckColor = item.luck >= 1.5 ? colors.positive : item.luck <= -1.5 ? colors.negative : undefined;
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress} style={st.row}>
            <View style={st.top}>
                <TeamCell rank={rank} abbrev={item.abbrev} width={92}/>
                <T variant="caption" style={[shared.num, st.c]}>{item.points}</T>
                <T variant="caption" style={[shared.num, st.c]}>{num(item.expectedPoints, 0)}</T>
                <T variant="caption" color={luckColor} style={[shared.num, st.c]}>{signed(item.luck, 1)}</T>
                <T variant="caption" style={[shared.num, st.c]}>{num(item.pace, 0)}</T>
                <T variant="label" style={[shared.num, st.p]}>{num(item.projected, 0)}</T>
            </View>
            <View style={st.bottom}>
                <RangeBar
                    lo={item.projectedLo}
                    hi={item.projectedHi}
                    projected={item.projected}
                    current={item.points}
                    min={scale.min}
                    max={scale.max}
                    color={teamColor(item.abbrev)}
                />
                <T variant="caption" muted style={st.rangeText}>{`${num(item.projectedLo, 0)}–${num(item.projectedHi, 0)}`}</T>
            </View>
        </TeamRow>
    );
});

/** Luck & projection: actual vs Pythagorean points, pace, projected final points (80% interval). */
export default function LuckView({rows, fav, onTeamPress, refreshControl, listRef}) {
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
                <View style={st.title}>
                    <T variant="heading">Luck & Projection</T>
                    <InfoTip title="Projected points" body={PROJ_INFO}/>
                </View>
                <T variant="caption" muted>{`League points% ${num(lp, 3).replace(/^0/, '')} · bars show the 80% range for final points (${scale.min}–${scale.max})`}</T>
                <Segmented options={SORTS} value={sort} onChange={setSort}/>
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={92} align="left">TEAM</ColTitle>
                <ColTitle width={C_W}>PTS</ColTitle>
                <ColTitle width={C_W}>xPTS</ColTitle>
                <View style={[st.c, st.hRow]}><ColTitle>LUCK</ColTitle><InfoTip title="Luck" body={LUCK_INFO} size={12}/></View>
                <View style={[st.c, st.hRow]}><ColTitle>PACE</ColTitle><InfoTip title="Points pace" body={PACE_INFO} size={12}/></View>
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
}

const st = StyleSheet.create({
    title: {flexDirection: 'row', alignItems: 'center', gap: 6},
    row: {flexDirection: 'column', alignItems: 'stretch', paddingVertical: 8, gap: 6},
    top: {flexDirection: 'row', alignItems: 'center'},
    bottom: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 28},
    hRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    c: {width: C_W, flexShrink: 1},
    p: {width: P_W},
    range: {flex: 1, height: 8, borderRadius: 4},
    band: {position: 'absolute', top: 0, bottom: 0, borderRadius: 4},
    tick: {position: 'absolute', top: -3, width: 2, height: 14, marginLeft: -1, borderRadius: 1},
    dot: {position: 'absolute', top: -3, width: 14, height: 14, marginLeft: -7, borderRadius: 7, borderWidth: 2},
    rangeText: {width: 64, textAlign: 'right', fontVariant: ['tabular-nums']},
});
