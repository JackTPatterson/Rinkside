import React, {memo, useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {deserveToWin, playerXG} from '../../analytics';
import LineChart from '../../components/LineChart';
import {Card, CompareRow, EmptyState, FadeInView, Headshot, InfoTip, ProgressBar, Row, Section, SplitBar, T} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {num, pct, signed} from '../../utils/format';
import {MatchupHeading} from './common';
import {timeLabel} from './model';

const XG_INFO = 'Expected goals (xG) adds up the quality of every unblocked shot — how often a shot from that spot, of that type, in that situation scores. It’s Rinkside’s model estimate from the NHL play-by-play, so it can differ a little from other sites.';
const DTW_INFO = 'If every scoring chance in this game were replayed thousands of times, how often would each team come out ahead? Calculated exactly from each shot’s xG (empty-net shots excluded). A model estimate of who played better, not who scored more.';
const HD = 0.15;

const PlayerRow = memo(function PlayerRow({row, max, color, onPress}) {
    return (
        <Pressable onPress={() => onPress(row.playerId)} style={({pressed}) => [styles.playerRow, pressed && {opacity: 0.6}]}>
            <Headshot uri={row.headshot} size={36} borderColor={color}/>
            <View style={{flex: 1, gap: 4}}>
                <Row style={{justifyContent: 'space-between'}}>
                    <T variant="label" numberOfLines={1} style={{flex: 1}}>{row.name}</T>
                    <T variant="label">{num(row.xg, 2)}</T>
                </Row>
                <ProgressBar value={max > 0 ? row.xg / max : 0} color={color} height={5}/>
                <T variant="caption" muted>{row.team} · {row.attempts} unblocked shots · {row.goals} G</T>
            </View>
        </Pressable>
    );
});

function XGTab({xg, header, roster, mp, onPlayer}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);

    const derived = useMemo(() => {
        if (!xg) return null;
        const dtw = deserveToWin(xg.home.shots, xg.away.shots);
        const order = [...xg.home.shots.map((s) => ({...s, isHome: true})), ...xg.away.shots.map((s) => ({...s, isHome: false}))]
            .sort((a, b) => a.t - b.t);
        const data = [{y: 0, label: 'Start'}];
        const markers = [];
        xg.timeline.forEach((p, i) => {
            data.push({y: p.home - p.away, label: `${timeLabel(p.t)} · ${home.abbrev} ${p.home.toFixed(2)} – ${p.away.toFixed(2)} ${away.abbrev}`});
            if (order[i]?.goal) markers.push({index: i + 1, color: order[i].isHome ? hc : ac});
        });
        const hd = (shots) => shots.filter((s) => s.xg >= HD).length;
        const players = [
            ...playerXG(xg.home.shots).map((r) => ({...r, isHome: true})),
            ...playerXG(xg.away.shots).map((r) => ({...r, isHome: false})),
        ]
            .sort((a, b) => b.xg - a.xg)
            .slice(0, 8)
            .map((r) => {
                const info = roster.get(r.playerId);
                return {...r, name: info?.name || `#${r.playerId}`, headshot: info?.headshot, team: r.isHome ? home.abbrev : away.abbrev};
            });
        return {dtw, data, markers, hdHome: hd(xg.home.shots), hdAway: hd(xg.away.shots), players};
    }, [xg, roster, home.abbrev, away.abbrev, hc, ac]);

    if (!xg || !derived) return <EmptyState title="No shot data yet" message="Expected goals appear once play-by-play is available."/>;
    if (!xg.home.shots.length && !xg.away.shots.length) return <EmptyState title="No shots yet" message="Check back once the puck drops."/>;

    const {dtw} = derived;
    const mpH = Number(mp?.last?.homeTeamExpectedGoals);
    const mpA = Number(mp?.last?.awayTeamExpectedGoals);
    const maxXG = derived.players[0]?.xg ?? 0;
    const favoured = dtw.home >= dtw.away ? home : away;
    const favouredP = Math.max(dtw.home, dtw.away);

    return (
        <View>
            <FadeInView>
                <Card>
                    <MatchupHeading home={home.abbrev} away={away.abbrev} label="Rinkside xG"/>
                    <Row style={{justifyContent: 'space-between', marginBottom: 14}}>
                        <T variant="display" color={hc}>{num(xg.home.xg, 2)}</T>
                        <Row gap={4}>
                            <T variant="caption" muted>Expected goals</T>
                            <InfoTip size={13} title="Expected goals (xG)" body={XG_INFO}/>
                        </Row>
                        <T variant="display" color={ac}>{num(xg.away.xg, 2)}</T>
                    </Row>
                    <CompareRow label="Goals" left={home.score ?? xg.home.goals} right={away.score ?? xg.away.goals} leftColor={hc} rightColor={ac}/>
                    <CompareRow label="Unblocked shots" left={xg.home.shots.length} right={xg.away.shots.length} leftColor={hc} rightColor={ac}/>
                    <CompareRow
                        label="High-danger chances"
                        left={derived.hdHome}
                        right={derived.hdAway}
                        leftColor={hc}
                        rightColor={ac}
                        info={`Shots the model gives at least a ${Math.round(HD * 100)}% chance to score — mostly from the slot, rebounds and rushes.`}
                    />
                    <CompareRow
                        label="Goals − xG"
                        left={xg.home.goals - xg.home.xg}
                        right={xg.away.goals - xg.away.xg}
                        leftColor={hc}
                        rightColor={ac}
                        format={(v) => signed(v, 2)}
                        info="Goals scored minus expected goals. Positive means a team finished better than its chances suggest (hot shooting or a cold goalie on the other side); negative means the opposite."
                    />
                    {Number.isFinite(mpH) && Number.isFinite(mpA) ? (
                        <CompareRow
                            label="MoneyPuck xG"
                            left={mpH}
                            right={mpA}
                            leftColor={hc}
                            rightColor={ac}
                            format={(v) => num(v, 2)}
                            info="MoneyPuck.com’s own expected-goals model for the same game, shown for comparison."
                        />
                    ) : null}
                </Card>
            </FadeInView>

            <Section title="Deserve to Win" info={DTW_INFO}>
                <FadeInView>
                    <Card>
                        <Row style={{justifyContent: 'space-between', marginBottom: 8}}>
                            <T variant="stat" color={hc}>{pct(dtw.home)}</T>
                            <T variant="stat" color={ac}>{pct(dtw.away)}</T>
                        </Row>
                        <SplitBar left={dtw.home} leftColor={hc} rightColor={ac} height={12}/>
                        <T variant="body" muted style={{marginTop: 10}}>
                            Replay these exact chances and {favoured.shortName} {header.final ? 'would win' : 'would be ahead'} {pct(favouredP)} of the time.
                        </T>
                    </Card>
                </FadeInView>
            </Section>

            <Section title="xG flow" info={`Running expected-goals difference: above the line ${home.abbrev} has generated the better chances, below it ${away.abbrev}. Dots are goals. ${XG_INFO}`}>
                <Card>
                    <LineChart
                        data={derived.data}
                        title={`${home.abbrev} − ${away.abbrev} xG`}
                        format={(v) => signed(v, 2)}
                        baseline={0}
                        color={hc}
                        colorBelow={ac}
                        markers={derived.markers}
                        height={170}
                    />
                </Card>
            </Section>

            {derived.players.length ? (
                <Section title="Most dangerous shooters" info="Players ranked by the total xG of their unblocked shots tonight — who generated the best chances, whether or not they scored. Model estimate.">
                    <Card style={{gap: 12}}>
                        {derived.players.map((r) => (
                            <PlayerRow key={r.playerId} row={r} max={maxXG} color={r.isHome ? hc : ac} onPress={onPlayer}/>
                        ))}
                    </Card>
                </Section>
            ) : null}
        </View>
    );
}

export default memo(XGTab);

const styles = StyleSheet.create({
    playerRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
});
