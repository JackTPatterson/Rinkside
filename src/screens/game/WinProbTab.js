import React, {memo, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {excitementIndex} from '../../analytics';
import LineChart from '../../components/LineChart';
import {Card, FadeInView, InfoTip, Row, Section, Segmented, SplitBar, StatTile, T} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {num, pct} from '../../utils/format';
import {buildRinksideSeries, currentElapsed, moneyPuckChart} from './model';

const RINKSIDE_INFO = 'Rinkside’s own model estimate. It rates each team’s scoring and defence from this season’s results (pulled toward league average early on), then works out every way the rest of the game could play out given the score, clock, power plays and pulled goalies.';
const MP_INFO = 'MoneyPuck.com’s published model estimate, built from shot-level expected goals and game state. Shown for comparison with Rinkside’s model.';
const EXCITEMENT_INFO = 'How much the win-probability line moved over the game. Every swing adds up: back-and-forth games with late lead changes score highest; a wire-to-wire blowout scores near zero. Based on a model estimate of win probability.';

/** One model's home/away split with a label. */
const ModelRow = memo(function ModelRow({title, info, home, away, homeColor, awayColor, sub}) {
    return (
        <View style={{marginBottom: 14}}>
            <Row style={{justifyContent: 'space-between', marginBottom: 6}}>
                <T variant="stat" color={homeColor}>{pct(home)}</T>
                <Row gap={4}>
                    <T variant="caption" muted>{title}</T>
                    <InfoTip size={13} title={title} body={info}/>
                </Row>
                <T variant="stat" color={awayColor}>{pct(away)}</T>
            </Row>
            <SplitBar left={home} leftColor={homeColor} rightColor={awayColor} height={8}/>
            {sub ? <T variant="caption" muted style={{marginTop: 6, textAlign: 'center'}}>{sub}</T> : null}
        </View>
    );
});

function WinProbTab({header, ratings, goals, mp, liveWP, prediction, mpPregame}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    const [picked, setSource] = useState(null);
    const source = picked ?? (mp ? 'mp' : 'rs');
    const [side, setSide] = useState('home');
    const [eventType, setEventType] = useState('GOAL');
    const useMp = source === 'mp' && !!mp;

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
    const winner = home.score > away.score ? home : away;
    const winnerLow = excitement?.comeback;
    const winnerPre = prediction ? (winner === home ? prediction.homeWin : prediction.awayWin) : null;
    const resultLine = header.final && home.score !== away.score && Number.isFinite(winnerPre)
        ? (winnerPre < 0.45
            ? `${winner.shortName} won as a ${pct(winnerPre)} underdog.`
            : `${winner.shortName} won as the ${pct(winnerPre)} favourite.`)
        : null;

    return (
        <View>
            <FadeInView>
                <Card>
                    {header.final ? (
                        <>
                            <T variant="label" muted style={styles.cardTitle}>Pregame odds vs. result</T>
                            <ModelRow
                                title="Rinkside model (pregame)"
                                info={RINKSIDE_INFO}
                                home={prediction?.homeWin}
                                away={prediction?.awayWin}
                                homeColor={hc}
                                awayColor={ac}
                            />
                            {Number.isFinite(mpPregame) ? (
                                <ModelRow title="MoneyPuck (pregame)" info={MP_INFO} home={mpPregame} away={1 - mpPregame} homeColor={hc} awayColor={ac}/>
                            ) : null}
                            {resultLine ? <T variant="body" muted style={{textAlign: 'center'}}>{resultLine}</T> : null}
                        </>
                    ) : (
                        <>
                            <T variant="label" muted style={styles.cardTitle}>Win probability now</T>
                            {liveWP ? (
                                <ModelRow
                                    title="Rinkside model"
                                    info={RINKSIDE_INFO}
                                    home={liveWP.home}
                                    away={liveWP.away}
                                    homeColor={hc}
                                    awayColor={ac}
                                    sub={`Projected final ${home.abbrev} ${num(liveWP.projected?.home, 1)} – ${num(liveWP.projected?.away, 1)} ${away.abbrev} · OT ${pct(liveWP.ot)}`}
                                />
                            ) : null}
                            {Number.isFinite(mpNow) ? (
                                <ModelRow title="MoneyPuck" info={MP_INFO} home={mpNow} away={1 - mpNow} homeColor={hc} awayColor={ac}/>
                            ) : null}
                        </>
                    )}
                </Card>
            </FadeInView>

            <Section
                title="Win probability timeline"
                info={`The chance ${home.abbrev} (above the line) or ${away.abbrev} (below) wins, moment by moment. Dots mark goals. ${useMp ? MP_INFO : 'Built by replaying the game through Rinkside’s model — a model estimate.'}`}>
                <Card>
                    <View style={{gap: 8, marginBottom: 12}}>
                        {mp ? (
                            <Segmented options={[{key: 'mp', label: 'MoneyPuck'}, {key: 'rs', label: 'Rinkside model'}]} value={source} onChange={setSource}/>
                        ) : null}
                        <Row gap={8}>
                            <Segmented
                                style={{flex: 1}}
                                options={[{key: 'home', label: home.abbrev}, {key: 'away', label: away.abbrev}]}
                                value={side}
                                onChange={setSide}
                            />
                            {useMp ? (
                                <Segmented
                                    style={{flex: 1}}
                                    options={[{key: 'GOAL', label: 'Goals'}, {key: 'PENL', label: 'Penalties'}]}
                                    value={eventType}
                                    onChange={setEventType}
                                />
                            ) : null}
                        </Row>
                    </View>
                    <LineChart
                        data={chartData}
                        title={`${flip ? away.abbrev : home.abbrev} win probability`}
                        format={(v) => pct(v)}
                        baseline={0.5}
                        yDomain={[0, 1]}
                        color={flip ? ac : hc}
                        colorBelow={flip ? hc : ac}
                        markers={markers}
                        height={190}
                    />
                    <T variant="caption" muted style={{marginTop: 8}}>
                        {useMp ? 'Source: MoneyPuck.com' : 'Source: Rinkside model (sampled every 2 minutes and at every goal)'} · drag to scrub
                    </T>
                </Card>
            </Section>

            {excitement ? (
                <Section title="Excitement Index" info={EXCITEMENT_INFO}>
                    <FadeInView>
                        <Card style={{marginBottom: 10}}>
                            <Row style={{justifyContent: 'space-between'}}>
                                <View style={{flex: 1}}>
                                    <T variant="title">{excitement.label}</T>
                                    <T variant="caption" muted>{header.final ? 'Final rating' : 'So far'}</T>
                                </View>
                                <T variant="display">{num(excitement.index, 1)}</T>
                            </Row>
                            <View style={{marginTop: 10}}>
                                <SplitBar left={Math.min(1, excitement.index / 5)} leftColor={hc} rightColor={ac} height={6}/>
                            </View>
                        </Card>
                        <View style={styles.tiles}>
                            <StatTile
                                label="Lead swings"
                                value={String(excitement.swings)}
                                sub="Times the favourite flipped"
                                info="How many times the win-probability line crossed 50% — i.e. the model’s favourite changed."
                            />
                            {header.final && home.score !== away.score ? (
                                <StatTile
                                    label="Comeback"
                                    value={pct(winnerLow)}
                                    sub={`${winner.abbrev}’s lowest win chance`}
                                    info="The winner’s lowest win probability during the game (model estimate). Under 20% means they climbed out of a real hole."
                                />
                            ) : (
                                <StatTile
                                    label="Leader’s low"
                                    value={pct(winnerLow)}
                                    sub="Current favourite’s lowest point"
                                    info="The current favourite’s lowest win probability so far (model estimate)."
                                />
                            )}
                        </View>
                    </FadeInView>
                </Section>
            ) : null}
        </View>
    );
}

export default memo(WinProbTab);

const styles = StyleSheet.create({
    cardTitle: {marginBottom: 12},
    tiles: {flexDirection: 'row', gap: 10},
});
