import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {EmptyState, InfoTip, Segmented, StatTile, T} from '../../components/ui';
import {leaguePointPct, playoffLine} from '../../analytics';
import {getTeam} from '../../data/teams';
import {useAppTheme} from '../../theme';
import {num, pct, signed} from '../../utils/format';
import {REGULAR_SEASON_GAMES} from '../../utils/season';
import {ColTitle, CutLine, TeamCell, TeamRow, conferenceOf, styles as shared, type} from './shared';

const CONFS = [
    {key: 'E', label: 'East'},
    {key: 'W', label: 'West'},
];

const LINE_INFO = 'The projected cut line is the final points total of the team projected 8th in the conference ' +
    '(8 of 16 teams per conference make the playoffs). Real seeding also uses divisions and wild cards, so treat ' +
    'this as a guide. Projections blend each team’s points rate with league-average hockey.';
const CUSHION_INFO = 'Projected final points minus the projected cut line. Positive means the team is on course to ' +
    'make it with room to spare; negative means it’s projected to fall short by that many points.';
const NEED_INFO = 'Points percentage the team needs in its remaining games to reach the projected cut line. For ' +
    'context, a .500 team earns about 50%. “In” means it already has enough points; over 100% means it can’t get there.';

const RaceRow = memo(function RaceRow({item, rank, fav, onTeamPress}) {
    const {colors} = useAppTheme();
    const cushionColor = item.cushion == null ? undefined : item.cushion >= 0 ? colors.positive : colors.live;
    let need = '–';
    let needColor;
    if (item.neededPointPct != null) {
        if (item.neededPointPct <= 0) {
            need = 'In';
            needColor = colors.positive;
        } else if (item.neededPointPct > 1) {
            need = '>100%';
            needColor = colors.live;
        } else {
            need = pct(item.neededPointPct);
            needColor = item.neededPointPct > 0.7 ? colors.live : item.neededPointPct > 0.58 ? colors.warning : undefined;
        }
    } else if (item.gp >= REGULAR_SEASON_GAMES) {
        need = 'Final';
    }
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress}>
            <TeamCell rank={rank} abbrev={item.abbrev} width={106}/>
            <View style={st.ptsCol}>
                <T style={[type.strong, shared.num]}>{item.points}</T>
                <T muted style={[type.small, shared.num]}>{item.gp} GP</T>
            </View>
            <T style={[type.value, shared.num, st.c]}>{num(item.projected, 0)}</T>
            <T color={cushionColor} style={[type.value, shared.num, st.c]}>{signed(item.cushion, 0)}</T>
            <T color={needColor} style={[type.value, shared.num, st.n]}>{need}</T>
        </TeamRow>
    );
});

/** Projected playoff line per conference with each team's cushion and required pace. */
export default memo(function RaceView({rows, fav, onTeamPress, refreshControl, listRef}) {
    const favConf = useMemo(() => (getTeam(fav)?.conference === 'Western' ? 'W' : 'E'), [fav]);
    const [conf, setConf] = useState(favConf);
    const lp = useMemo(() => leaguePointPct(rows), [rows]);
    const race = useMemo(() => {
        const confRows = (rows ?? []).filter((r) => conferenceOf(r) === conf);
        const res = playoffLine(confRows, {leaguePointPct: lp, seasonGames: REGULAR_SEASON_GAMES});
        return {
            line: res.line,
            teams: res.teams.filter((t) => t.abbrev).sort((a, b) => b.projected - a.projected || b.points - a.points),
        };
    }, [rows, conf, lp]);

    const lineLabel = race.line == null ? 'Playoff line' : `Projected cut line · ${num(race.line, 0)} pts`;
    const renderItem = useCallback(({item, index}) => (
        <>
            {index === 8 ? <CutLine label={lineLabel}/> : null}
            <RaceRow item={item} rank={index + 1} fav={fav} onTeamPress={onTeamPress}/>
        </>
    ), [fav, onTeamPress, lineLabel]);

    const bubble = race.teams[8];
    const header = (
        <View>
            <View style={shared.subHeader}>
                <Segmented options={CONFS} value={conf} onChange={setConf}/>
                <View style={st.tiles}>
                    <StatTile style={st.tile} label="Projected cut line" value={race.line == null ? '–' : `${num(race.line, 0)} pts`} info={LINE_INFO}
                        sub={race.teams[7] ? `8th: ${race.teams[7].abbrev}` : undefined}/>
                    <StatTile style={st.tile} label="First team out" value={bubble ? bubble.abbrev : '–'}
                        sub={bubble ? `${signed(bubble.cushion, 0)} pts vs line` : undefined}/>
                </View>
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={106} align="left">TEAM</ColTitle>
                <View style={st.ptsCol}><ColTitle>PTS</ColTitle></View>
                <ColTitle width={48}>PROJ</ColTitle>
                <View style={[st.c, st.hRow]}><ColTitle>+/−</ColTitle><InfoTip title="Cushion" body={CUSHION_INFO} size={12}/></View>
                <View style={[st.n, st.hRow]}><ColTitle>NEED</ColTitle><InfoTip title="Points % needed" body={NEED_INFO} size={12}/></View>
            </View>
        </View>
    );

    if (!race.teams.length) return <View>{header}<EmptyState message="No standings for this conference yet."/></View>;
    return (
        <FlatList
            ref={listRef}
            data={race.teams}
            keyExtractor={(i) => i.abbrev}
            renderItem={renderItem}
            ListHeaderComponent={header}
            refreshControl={refreshControl}
            contentContainerStyle={shared.listContent}
            initialNumToRender={16}
        />
    );
});

const st = StyleSheet.create({
    tiles: {flexDirection: 'row', gap: 16, paddingTop: 6},
    tile: {backgroundColor: 'transparent', padding: 0, borderRadius: 0},
    ptsCol: {flex: 1, alignItems: 'flex-end'},
    hRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    c: {width: 48},
    n: {width: 64},
});
