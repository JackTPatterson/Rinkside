import React, {memo, useCallback, useDeferredValue, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {EmptyState, InfoTip, Segmented, T} from '../../components/ui';
import {PRIOR_GAMES, predictGame} from '../../analytics';
import {useAppTheme} from '../../theme';
import {num, pct, signed} from '../../utils/format';
import {ColTitle, DivergingBar, TeamCell, TeamRow, styles as shared} from './shared';

const SORTS = [
    {key: 'net', label: 'Net'},
    {key: 'off', label: 'Offense'},
    {key: 'def', label: 'Defense'},
    {key: 'win', label: 'Win %'},
];

const INFO = `Net rating is how many more goals per game a team should score than it allows against an ` +
    `average opponent on neutral ice: league scoring rate × (attack − defence). It’s built from goals for and ` +
    `against, but each team is first blended with ${PRIOR_GAMES} games of league-average hockey (Bayesian ` +
    `shrinkage), so a hot 5-game start doesn’t look like a dynasty. The more games played, the less the blend matters. A model estimate.`;
const OFF_INFO = 'Estimated goals per game this team scores against an average defence (after shrinkage).';
const DEF_INFO = 'Estimated goals per game this team allows against an average offence (after shrinkage). Lower is better.';
const WIN_INFO = 'Rinkside’s game model: the chance this team beats a league-average team on neutral ice, ' +
    'including overtime and shootouts. A model estimate.';

const AVG = '__AVG__'; // unknown abbrev → league-average ratings in matchupRates

// Win % vs average for every team (32 exact Markov-chain runs) — cached per ratings object.
let winCacheKey = null;
let winCache = null;
function winVsAverage(ratings) {
    if (!ratings?.teams) return null;
    if (ratings === winCacheKey) return winCache;
    const neutral = {...ratings, homeEdge: 1};
    const out = {};
    for (const abbrev of Object.keys(ratings.teams)) {
        try {
            out[abbrev] = predictGame(neutral, abbrev, AVG).homeWin;
        } catch {
            out[abbrev] = null;
        }
    }
    winCacheKey = ratings;
    winCache = out;
    return out;
}

const RatingRow = memo(function RatingRow({item, rank, maxNet, fav, onTeamPress}) {
    const {colors} = useAppTheme();
    return (
        <TeamRow abbrev={item.abbrev} fav={fav} onPress={onTeamPress}>
            <TeamCell rank={rank} abbrev={item.abbrev} width={92}/>
            <View style={st.netCol}>
                <T variant="label" color={item.net > 0.005 ? colors.positive : item.net < -0.005 ? colors.negative : undefined} style={shared.num}>
                    {signed(item.net, 2)}
                </T>
                <DivergingBar value={item.net} max={maxNet} height={6}/>
            </View>
            <T variant="caption" style={[shared.num, st.c]}>{num(item.off, 2)}</T>
            <T variant="caption" style={[shared.num, st.c]}>{num(item.def, 2)}</T>
            <T variant="caption" style={[shared.num, st.w]}>{item.win == null ? '…' : pct(item.win)}</T>
        </TeamRow>
    );
});

/** Rinkside Ratings: attack/defence multipliers → net goals per game vs an average opponent. */
export default function RatingsView({ratings, fav, onTeamPress, refreshControl, listRef}) {
    const [sort, setSort] = useState('net');
    // Render the cheap columns first; the 32 model runs happen in a deferred re-render.
    const deferredRatings = useDeferredValue(ratings, null);
    const wins = useMemo(() => winVsAverage(deferredRatings), [deferredRatings]);

    const base = useMemo(() => {
        const lr = ratings?.leagueRate;
        if (!ratings?.teams || !Number.isFinite(lr)) return [];
        return Object.entries(ratings.teams)
            .filter(([a, t]) => a && Number.isFinite(t?.attack) && Number.isFinite(t?.defense))
            .map(([abbrev, t]) => ({
                abbrev,
                gp: t.gp,
                off: lr * t.attack,
                def: lr * t.defense,
                net: lr * (t.attack - t.defense),
            }));
    }, [ratings]);

    const data = useMemo(() => {
        const rows = base.map((r) => ({...r, win: wins?.[r.abbrev] ?? null}));
        const key = {net: (r) => r.net, off: (r) => r.off, def: (r) => -r.def, win: (r) => r.win ?? r.net}[sort];
        return rows.sort((a, b) => key(b) - key(a));
    }, [base, wins, sort]);
    const maxNet = useMemo(() => Math.max(0.1, ...data.map((r) => Math.abs(r.net))), [data]);

    const renderItem = useCallback(
        ({item, index}) => <RatingRow item={item} rank={index + 1} maxNet={maxNet} fav={fav} onTeamPress={onTeamPress}/>,
        [maxNet, fav, onTeamPress],
    );

    const header = (
        <View>
            <View style={shared.subHeader}>
                <View style={st.title}>
                    <T variant="heading">Rinkside Ratings</T>
                    <InfoTip title="Net rating" body={INFO}/>
                </View>
                <T variant="caption" muted>
                    Expected goal differential per game vs an average team on neutral ice
                    {Number.isFinite(ratings?.leagueRate) ? ` · league avg ${num(ratings.leagueRate, 2)} goals/team/game` : ''}
                </T>
                <Segmented options={SORTS} value={sort} onChange={setSort}/>
            </View>
            <View style={shared.colHeader}>
                <ColTitle width={92} align="left">TEAM</ColTitle>
                <View style={[st.netCol, st.hRow]}>
                    <ColTitle align="right">NET</ColTitle>
                </View>
                <View style={[st.c, st.hRow]}><ColTitle>OFF</ColTitle><InfoTip title="Offense rating" body={OFF_INFO} size={12}/></View>
                <View style={[st.c, st.hRow]}><ColTitle>DEF</ColTitle><InfoTip title="Defense rating" body={DEF_INFO} size={12}/></View>
                <View style={[st.w, st.hRow]}><ColTitle>WIN</ColTitle><InfoTip title="Win % vs average" body={WIN_INFO} size={12}/></View>
            </View>
        </View>
    );

    if (!data.length) return <View>{header}<EmptyState message="Ratings appear once the season’s first games are played."/></View>;
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
    netCol: {flex: 1, gap: 4, paddingHorizontal: 6},
    hRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    c: {width: 52},
    w: {width: 54},
});
