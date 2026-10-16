import React, {memo, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {excitementIndex} from '../../analytics';
import {Row, T, fillRadii, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {num, pct} from '../../utils/format';
import OldChart from './Chart';
import {Divider, OptionSheet, SectionTitle, SelectRow, StatRow, type, ValueRow} from './common';
import {buildRinksideSeries, currentElapsed, moneyPuckChart} from './model';

const EXCITEMENT_INFO = 'How much the win-probability line moved over the game. Every swing adds up: back-and-forth games with late lead changes score highest; a wire-to-wire blowout scores near zero. Based on an estimate of win probability.';

/** One model's home/away split in the old sim-row style: "54%  [label]  46%" with mirrored bars. */
const ModelRow = memo(function ModelRow({title, home, away, homeColor, awayColor, sub}) {
    return (
        <View>
            <StatRow label={title} left={home} right={away} shares={[home, away]} leftColor={homeColor} rightColor={awayColor} format={(v) => pct(v)}/>
            {sub ? <T variant="body" style={[type.sub, {marginTop: 10, textAlign: 'center'}]}>{sub}</T> : null}
        </View>
    );
});

const EVENT_OPTIONS = [{key: 'GOAL', label: 'Goals'}, {key: 'PENL', label: 'Penalties'}];

/** Old team toggle pill next to the "% TEAM Wins" heading (Medium 20, active = text colour). */
function TeamPill({label, active, onPress}) {
    const {colors} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{selected: active}}
            onPress={() => {
                if (!active) {
                    tap();
                    onPress();
                }
            }}
            style={[styles.teamPill, {backgroundColor: active ? colors.text : colors.card}]}>
            <T variant="body" color={active ? colors.background : colors.text} style={type.pie}>{label}</T>
        </Pressable>
    );
}

function WinProbTab({header, ratings, goals, mp, liveWP, prediction}) {
    const {colors, teamColor} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    const [side, setSide] = useState('home');
    const [eventType, setEventType] = useState('GOAL');
    const [picker, setPicker] = useState(false);
    // One series, same precedence as the header: MoneyPuck when it has data, otherwise the Rinkside model.
    const useMp = !!mp;

    // Our own series is only built when it's on screen (or needed for the excitement index).
    const elapsed = currentElapsed(header);
    const bucket = Math.floor(elapsed / 120);
    const needRinkside = !useMp;
    const rinkside = useMemo(
        () => (needRinkside && header.started ? buildRinksideSeries(ratings, header, goals, elapsed) : null),
        // header is rebuilt every poll; only these fields change the series.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [needRinkside, ratings, goals, bucket, header.final, header.started, home.score, away.score, home.abbrev, away.abbrev],
    );
    const mpChart = useMemo(() => (mp ? moneyPuckChart(mp, header, eventType) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mp, eventType, header.final, home.score, away.score]);

    const chart = useMp ? mpChart : rinkside;
    const excitement = useMemo(() => (chart?.series?.length > 2 ? excitementIndex(chart.series) : null), [chart]);

    const flip = side === 'away';
    const chartData = useMemo(() => (chart ? chart.data.map((d) => ({...d, y: flip ? 1 - d.y : d.y})) : []), [chart, flip]);
    const markers = useMemo(() => (chart ? chart.markers.map((m) => ({index: m.index, color: m.isHome ? hc : ac})) : []), [chart, hc, ac]);

    const mpNow = mp ? Number(mp.last?.homeWinProbability) : null;
    const nowHome = Number.isFinite(mpNow) ? mpNow : liveWP?.home;
    // `prediction` is already re-centred on MoneyPuck's pregame number when it has one.
    const preHome = prediction?.homeWin;
    const winner = home.score > away.score ? home : away;
    const winnerLow = excitement?.comeback;
    const winnerPre = Number.isFinite(preHome) ? (winner === home ? preHome : 1 - preHome) : null;
    const resultLine = header.final && home.score !== away.score && Number.isFinite(winnerPre)
        ? (winnerPre < 0.45
            ? `${winner.shortName} won as a ${pct(winnerPre)} underdog.`
            : `${winner.shortName} won as the ${pct(winnerPre)} favourite.`)
        : null;

    const eventLabel = EVENT_OPTIONS.find((o) => o.key === eventType)?.label;

    return (
        <View>
            {header.final ? (
                <>
                    <SectionTitle title="Pregame Odds vs. Result" style={{marginTop: 0}}/>
                    {Number.isFinite(preHome) ? (
                        <ModelRow title="Pregame win probability" home={preHome} away={1 - preHome} homeColor={hc} awayColor={ac}/>
                    ) : null}
                    {resultLine ? <T variant="body" style={[type.value, {textAlign: 'center', marginTop: 20}]}>{resultLine}</T> : null}
                </>
            ) : (
                <>
                    <SectionTitle title="Win Probability Now" style={{marginTop: 0}}/>
                    {Number.isFinite(nowHome) ? (
                        <ModelRow
                            title="Live win probability"
                            home={nowHome}
                            away={1 - nowHome}
                            homeColor={hc}
                            awayColor={ac}
                            sub={liveWP ? `Projected final ${home.abbrev} ${num(liveWP.projected?.home, 1)} • ${num(liveWP.projected?.away, 1)} ${away.abbrev} • OT ${pct(liveWP.ot)}` : null}
                        />
                    ) : null}
                </>
            )}

            <Row style={styles.winsHead}>
                <Row gap={4} style={{flex: 1}}>
                    <T variant="body" style={styles.winsTitle}>% {flip ? away.abbrev : home.abbrev} Wins</T>
                </Row>
                <Row gap={10}>
                    <TeamPill label={home.abbrev} active={!flip} onPress={() => setSide('home')}/>
                    <TeamPill label={away.abbrev} active={flip} onPress={() => setSide('away')}/>
                </Row>
            </Row>
            {useMp ? (
                <View style={{marginTop: 10}}>
                    <SelectRow label="Event" value={eventLabel} onPress={() => setPicker(true)}/>
                    <OptionSheet visible={picker} options={EVENT_OPTIONS} onSelect={setEventType} onClose={() => setPicker(false)}/>
                </View>
            ) : null}
            <OldChart
                data={chartData}
                format={(v) => pct(v)}
                baseline={0.5}
                yDomain={[0, 1]}
                color={flip ? ac : hc}
                colorBelow={flip ? hc : ac}
                markers={markers}
            />

            {excitement ? (
                <>
                    <Divider style={{marginTop: 20}}/>
                    <SectionTitle title="Excitement Index" info={EXCITEMENT_INFO}/>
                    <ValueRow title={excitement.label} sub={header.final ? 'Final rating' : 'So far'} value={num(excitement.index, 1)} style={{marginTop: 10}}/>
                    <View style={[styles.track, {backgroundColor: colors.card}]}>
                        <View style={[{width: `${Math.min(1, excitement.index / 5) * 100}%`, height: '100%', backgroundColor: hc}, fillRadii(Math.min(1, excitement.index / 5), 3)]}/>
                    </View>
                    <ValueRow title="Lead swings" sub="Times the favourite flipped" value={String(excitement.swings)}/>
                    {header.final && home.score !== away.score ? (
                        <ValueRow title="Comeback" sub={`${winner.abbrev}’s lowest win chance`} value={pct(winnerLow)}/>
                    ) : (
                        <ValueRow title="Leader’s low" sub="Current favourite’s lowest point" value={pct(winnerLow)}/>
                    )}
                </>
            ) : null}
        </View>
    );
}

export default memo(WinProbTab);

const styles = StyleSheet.create({
    winsHead: {justifyContent: 'space-between', marginTop: 30},
    winsTitle: {fontFamily: 'Sora_500Medium', fontSize: 24, lineHeight: 30},
    teamPill: {borderRadius: 100, paddingHorizontal: 15, paddingVertical: 4, minHeight: 36, justifyContent: 'center'},
    track: {height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 15},
});
