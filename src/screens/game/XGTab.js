import React, {memo, useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {deserveToWin, playerXG} from '../../analytics';
import {EmptyState, Headshot, Row, SplitBar, T, fillRadii} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {num, pct, periodLabel, signed} from '../../utils/format';
import OldChart from './Chart';
import {Divider, Group, SectionTitle, StatRow, type} from './common';
import {timeLabel} from './model';

const XG_INFO = 'Expected goals (xG) adds up the quality of every unblocked shot — how often a shot from that spot, of that type, in that situation scores. It’s estimated from the NHL play-by-play, so it can differ a little from other sites.';
const DTW_INFO = 'If every scoring chance in this game were replayed thousands of times, how often would each team come out ahead? Calculated exactly from each shot’s xG (empty-net shots excluded). An estimate of who played better, not who scored more.';
const HD = 0.15;

const PlayerRow = memo(function PlayerRow({row, max, color, onPress}) {
    const {colors} = useAppTheme();
    const v = max > 0 ? Math.max(0, Math.min(1, row.xg / max)) : 0;
    return (
        <Pressable onPress={() => onPress(row.playerId)} style={({pressed}) => [styles.playerRow, pressed && {opacity: 0.6}]}>
            <Headshot uri={row.headshot} size={48} borderColor={color} style={{borderWidth: 3}}/>
            <View style={{flex: 1, gap: 4}}>
                <Row style={{justifyContent: 'space-between'}}>
                    <T variant="body" numberOfLines={1} style={[type.name, {flex: 1}]}>{row.name}</T>
                    <T variant="body" style={type.name}>{num(row.xg, 2)}</T>
                </Row>
                <View style={[styles.track, {backgroundColor: colors.card}]}>
                    <View style={[{width: `${v * 100}%`, height: '100%', backgroundColor: color}, fillRadii(v, 3)]}/>
                </View>
                <T variant="body" style={type.sub}>{row.team} • {row.attempts} shots • {row.goals} G{row.best > 0 ? ` • best ${num(row.best, 2)}` : ''}</T>
            </View>
        </Pressable>
    );
});

const sum = (shots) => shots.reduce((t, x) => t + x.xg, 0);
const DANGER = [
    {key: 'high', label: 'High danger', test: (x) => x.xg >= HD},
    {key: 'mid', label: 'Medium danger', test: (x) => x.xg >= 0.05 && x.xg < HD},
    {key: 'low', label: 'Low danger', test: (x) => x.xg < 0.05},
];
const SITUATIONS = [
    {key: 'ev', label: 'Even strength', test: (x) => !x.manpower},
    {key: 'pp', label: 'Power play', test: (x) => x.manpower > 0},
    {key: 'sh', label: 'Shorthanded', test: (x) => x.manpower < 0},
];

/** Headline: each team's xG on its own side (home left), goals underneath, split bar between. */
function Headline({xg, home, away, hc, ac}) {
    return (
        <View>
            <Row style={styles.between}>
                <View>
                    <T variant="body" style={[type.big, styles.hero]}>{num(xg.home.xg, 2)}</T>
                    <T variant="body" style={type.sub}>{home.abbrev} xG · {home.score ?? xg.home.goals} G</T>
                </View>
                <View style={styles.right}>
                    <T variant="body" style={[type.big, styles.hero, styles.textRight]}>{num(xg.away.xg, 2)}</T>
                    <T variant="body" style={[type.sub, styles.textRight]}>{away.abbrev} xG · {away.score ?? xg.away.goals} G</T>
                </View>
            </Row>
            <SplitBar left={xg.home.xg / Math.max(0.001, xg.home.xg + xg.away.xg)} leftColor={hc} rightColor={ac} height={10} style={styles.mt10}/>
        </View>
    );
}

function XGTab({xg, header, roster, onPlayer}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);

    const derived = useMemo(() => {
        if (!xg) return null;
        const H = xg.home.shots;
        const A = xg.away.shots;
        const dtw = deserveToWin(H, A);
        const order = [...H.map((x) => ({...x, isHome: true})), ...A.map((x) => ({...x, isHome: false}))].sort((p, q) => p.t - q.t);
        const data = [{y: 0, label: 'Start'}];
        const markers = [];
        xg.timeline.forEach((p, i) => {
            data.push({y: p.home - p.away, label: `${timeLabel(p.t)} · ${home.abbrev} ${p.home.toFixed(2)} – ${p.away.toFixed(2)} ${away.abbrev}`});
            if (order[i]?.goal) markers.push({index: i + 1, color: order[i].isHome ? hc : ac});
        });
        const split = (test) => ({h: H.filter(test), a: A.filter(test)});
        const periods = [...new Set([...H, ...A].map((x) => x.period))].sort((p, q) => p - q)
            .map((n) => ({n, ...split((x) => x.period === n)}));
        const players = [
            ...playerXG(H).map((r) => ({...r, isHome: true})),
            ...playerXG(A).map((r) => ({...r, isHome: false})),
        ]
            .sort((p, q) => q.xg - p.xg)
            .slice(0, 8)
            .map((r) => {
                const info = roster.get(r.playerId);
                const best = Math.max(0, ...(r.isHome ? H : A).filter((x) => x.playerId === r.playerId).map((x) => x.xg));
                return {...r, best, name: info?.name || `#${r.playerId}`, headshot: info?.headshot, team: r.isHome ? home.abbrev : away.abbrev};
            });
        return {
            dtw,
            data,
            markers,
            periods,
            danger: DANGER.map((d) => ({...d, ...split(d.test)})),
            situations: SITUATIONS.map((d) => ({...d, ...split(d.test)})),
            rebounds: split((x) => x.rebound),
            rushes: split((x) => x.rush),
            players,
        };
    }, [xg, roster, home.abbrev, away.abbrev, hc, ac]);

    if (!xg || !derived) return <EmptyState title="No shot data yet" message="Expected goals appear once play-by-play is available."/>;
    if (!xg.home.shots.length && !xg.away.shots.length) return <EmptyState title="No shots yet" message="Check back once the puck drops."/>;

    const {dtw} = derived;
    const maxXG = derived.players[0]?.xg ?? 0;
    const favoured = dtw.home >= dtw.away ? home : away;
    const favouredP = Math.max(dtw.home, dtw.away);
    const xgRow = (key, label, h, a, extra) => (
        <StatRow key={key} label={label} left={sum(h)} right={sum(a)} leftColor={hc} rightColor={ac} format={(v) => num(v, 2)} {...extra}/>
    );
    const countRow = (key, label, h, a, extra) => (
        <StatRow key={key} label={label} left={h.length} right={a.length} leftColor={hc} rightColor={ac} {...extra}/>
    );

    return (
        <View>
            <SectionTitle title="Expected Goals" info={XG_INFO} style={{marginTop: 0}}/>
            <Headline xg={xg} home={home} away={away} hc={hc} ac={ac}/>
            <Group title="Shots">
                {countRow('shots', 'Unblocked shots', xg.home.shots, xg.away.shots)}
                <StatRow
                    key="fin"
                    label="Goals − xG"
                    left={xg.home.goals - xg.home.xg}
                    right={xg.away.goals - xg.away.xg}
                    leftColor={hc}
                    rightColor={ac}
                    format={(v) => signed(v, 2)}
                    info="Goals scored minus expected goals. Positive means a team finished better than its chances suggest (hot shooting or a cold goalie on the other side); negative means the opposite."
                />
                <StatRow
                    key="per"
                    label="xG per shot"
                    left={xg.home.shots.length ? xg.home.xg / xg.home.shots.length : 0}
                    right={xg.away.shots.length ? xg.away.xg / xg.away.shots.length : 0}
                    leftColor={hc}
                    rightColor={ac}
                    format={(v) => num(v, 3)}
                />
            </Group>
            <Group title="Chance Quality" info={`High danger: at least a ${Math.round(HD * 100)}% chance to score (mostly the slot, rebounds and rushes). Medium: 5–${Math.round(HD * 100)}%. Low: under 5%. Counts of unblocked shots.`}>
                {derived.danger.map((d) => countRow(d.key, d.label, d.h, d.a))}
                {countRow('reb', 'Rebound chances', derived.rebounds.h, derived.rebounds.a, {info: 'Shots within 3 seconds of a teammate’s previous attempt.'})}
                {countRow('rush', 'Rush chances', derived.rushes.h, derived.rushes.a, {info: 'Shots within 4 seconds of play leaving the other end or the neutral zone.'})}
            </Group>
            <Group title="xG by Period">
                {derived.periods.map((p) => xgRow(`p${p.n}`, periodLabel(p.n), p.h, p.a))}
            </Group>
            <Group title="xG by Situation">
                {derived.situations.filter((d) => d.h.length || d.a.length).map((d) => xgRow(d.key, d.label, d.h, d.a))}
            </Group>

            <Divider style={{marginTop: 20}}/>
            <SectionTitle title="Deserve to Win" info={DTW_INFO}/>
            <Row style={{justifyContent: 'space-between', marginBottom: 10}}>
                <T variant="body" style={type.big}>{pct(dtw.home)}</T>
                <T variant="body" style={type.big}>{pct(dtw.away)}</T>
            </Row>
            <SplitBar left={dtw.home} leftColor={hc} rightColor={ac} height={10}/>
            <T variant="body" style={[type.value, {marginTop: 20, textAlign: 'center'}]}>
                Replay these exact chances and {favoured.shortName} {header.final ? 'would win' : 'would be ahead'} {pct(favouredP)} of the time.
            </T>

            <OldChart
                data={derived.data}
                title={`${home.abbrev} − ${away.abbrev} xG`}
                format={(v) => signed(v, 2)}
                baseline={0}
                color={hc}
                colorBelow={ac}
                markers={derived.markers}
                height={170}
                style={{marginTop: 10}}
            />

            {derived.players.length ? (
                <>
                    <Divider style={{marginTop: 20}}/>
                    <SectionTitle title="Most Dangerous Shooters"/>
                    {derived.players.map((r) => (
                        <PlayerRow key={r.playerId} row={r} max={maxXG} color={r.isHome ? hc : ac} onPress={onPlayer}/>
                    ))}
                </>
            ) : null}
        </View>
    );
}

export default memo(XGTab);

const styles = StyleSheet.create({
    playerRow: {flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 10, minHeight: 44},
    track: {height: 6, borderRadius: 3, overflow: 'hidden'},
    between: {justifyContent: 'space-between', alignItems: 'flex-end'},
    right: {alignItems: 'flex-end'},
    textRight: {textAlign: 'right'},
    hero: {fontSize: 32, lineHeight: 38},
    mt10: {marginTop: 10},
});
