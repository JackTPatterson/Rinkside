import React, {memo, useMemo, useState} from 'react';
import {View} from 'react-native';
import {playerXG} from '../../analytics';
import {Card, DataTable, EmptyState, FadeInView, InfoTip, Row, Section, Segmented, T, TeamLogo} from '../../components/ui';
import {num, savePct, signed} from '../../utils/format';
import {boxPlayers} from './model';

const SORTS = [
    {key: 'pts', label: 'Points'},
    {key: 'toiSec', label: 'TOI'},
    {key: 'sog', label: 'Shots'},
    {key: 'xg', label: 'xG'},
];

const SKATER_COLUMNS = [
    {key: 'number', title: '#', width: 28, align: 'right'},
    {key: 'name', title: 'Player', width: 140},
    {key: 'pos', title: 'POS', width: 36, align: 'center'},
    {key: 'g', title: 'G', width: 28, align: 'right'},
    {key: 'a', title: 'A', width: 28, align: 'right'},
    {key: 'pts', title: 'P', width: 28, align: 'right'},
    {key: 'sog', title: 'SOG', width: 40, align: 'right'},
    {key: 'xg', title: 'xG', width: 44, align: 'right', render: (r) => (r.xg != null ? num(r.xg, 2) : '–')},
    {key: 'pm', title: '+/-', width: 36, align: 'right', render: (r) => signed(r.pm)},
    {key: 'hits', title: 'HIT', width: 36, align: 'right'},
    {key: 'blk', title: 'BLK', width: 36, align: 'right'},
    {key: 'pim', title: 'PIM', width: 36, align: 'right'},
    {key: 'toi', title: 'TOI', width: 52, align: 'right'},
];

const GOALIE_COLUMNS = [
    {key: 'number', title: '#', width: 28, align: 'right'},
    {key: 'name', title: 'Goalie', width: 140},
    {key: 'svPct', title: 'SV%', width: 52, align: 'right', render: (r) => savePct(r.svPct)},
    {key: 'saves', title: 'SV/SA', width: 56, align: 'right'},
    {key: 'ga', title: 'GA', width: 32, align: 'right'},
    {key: 'gsax', title: 'GSAx', width: 52, align: 'right', render: (r) => (r.gsax != null ? signed(r.gsax, 2) : '–')},
    {key: 'toi', title: 'TOI', width: 56, align: 'right'},
];

const keyOf = (r, i) => String(r.id ?? i);

/** Box-score tables per team, with Rinkside xG per skater and goals saved above expected per goalie. */
function PlayersTab({header, box, xg, onPlayer}) {
    const [sideKey, setSideKey] = useState('homeTeam');
    const [sort, setSort] = useState('pts');
    const isHome = sideKey === 'homeTeam';
    const team = isHome ? header.home : header.away;

    const {skaters, goalies} = useMemo(() => {
        const base = boxPlayers(box, sideKey);
        const own = xg ? (isHome ? xg.home.shots : xg.away.shots) : null;
        const opp = xg ? (isHome ? xg.away.shots : xg.home.shots) : null;
        const byId = own ? new Map(playerXG(own).map((r) => [r.playerId, r.xg])) : null;
        const xgAgainst = opp ? opp.filter((s) => !s.emptyNet).reduce((a, s) => a + s.xg, 0) : null;
        const totalToi = Math.max(0, ...base.goalies.map((g) => g.toiSec));
        return {
            skaters: base.skaters.map((p) => ({...p, xg: byId ? byId.get(p.id) ?? 0 : null})),
            // GSAx needs the goalie to have faced every shot, so only for a goalie who played (nearly) all of it.
            goalies: base.goalies
                .filter((g) => g.toiSec > 0 || base.goalies.length === 1)
                .map((g) => ({...g, gsax: xgAgainst != null && base.goalies.filter((x) => x.toiSec > 0).length === 1 && g.toiSec >= totalToi ? xgAgainst - g.ga : null})),
        };
    }, [box, sideKey, isHome, xg]);

    const sorted = useMemo(() => [...skaters].sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0) || b.g - a.g || b.toiSec - a.toiSec), [skaters, sort]);

    if (!box) return <EmptyState message="Player stats will appear once the game starts."/>;

    return (
        <View>
            <Segmented
                options={[{key: 'homeTeam', label: header.home.abbrev}, {key: 'awayTeam', label: header.away.abbrev}]}
                value={sideKey}
                onChange={setSideKey}
            />
            <FadeInView key={sideKey}>
                <Section
                    title="Skaters"
                    right={<TeamLogo abbrev={team.abbrev} size={26}/>}
                    info="Box score from the NHL. xG is Rinkside’s model estimate of the goals a player ‘should’ have scored from the quality of his unblocked shots. Tap a player for his page.">
                    <Segmented options={SORTS} value={sort} onChange={setSort} style={{marginBottom: 10}}/>
                    <Card style={{paddingVertical: 4}}>
                        {sorted.length ? (
                            <DataTable columns={SKATER_COLUMNS} rows={sorted} keyExtractor={keyOf} onRowPress={(r) => onPlayer(r.id)}/>
                        ) : <EmptyState message="No skater stats yet."/>}
                    </Card>
                </Section>
                <Section title="Goalies">
                    <Card style={{paddingVertical: 4}}>
                        {goalies.length ? (
                            <DataTable columns={GOALIE_COLUMNS} rows={goalies} keyExtractor={keyOf} onRowPress={(r) => onPlayer(r.id)}/>
                        ) : <EmptyState message="No goalie stats yet."/>}
                    </Card>
                    <Row gap={4} style={{marginTop: 8}}>
                        <T variant="caption" muted style={{flex: 1}}>GSAx = goals saved above expected</T>
                        <InfoTip
                            size={13}
                            title="Goals saved above expected"
                            body="The xG of every non-empty-net shot this goalie faced minus the goals he allowed. Positive means he stopped more than an average goalie would have. Model estimate; shown only when one goalie played the whole game."
                        />
                    </Row>
                </Section>
            </FadeInView>
        </View>
    );
}

export default memo(PlayersTab);
