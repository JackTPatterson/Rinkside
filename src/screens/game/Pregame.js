import React, {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Card, CompareRow, EmptyState, FadeInView, InfoTip, Row, Section, SplitBar, T, TeamLogo} from '../../components/ui';
import {headshotUrl} from '../../api/nhl';
import {useAppTheme} from '../../theme';
import {loc, num, parseISODate, pct, savePct, shortDate, signed} from '../../utils/format';
import {MatchupHeading, PlayerTile} from './common';
import PlayoffImpact from './PlayoffImpact';

const MODEL_INFO = 'Rinkside’s model estimate. Each team’s scoring and defence are rated from this season’s results (pulled toward league average early in the season), home ice is factored in, and every possible game is worked out exactly — including power plays, pulled goalies and how often tied games really reach overtime.';

/* -------------------------------------------------- prediction */

const Prediction = memo(function Prediction({header, prediction, mpPregame}) {
    const {teamColor, colors} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    if (!prediction) return null;
    const p = prediction;
    return (
        <FadeInView>
            <Card>
                <Row style={{justifyContent: 'space-between', marginBottom: 4}}>
                    <T variant="label" muted>Rinkside Win Probability</T>
                    <InfoTip title="Rinkside Win Probability" body={MODEL_INFO}/>
                </Row>
                <Row style={{justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10}}>
                    <View>
                        <T variant="display" color={hc}>{pct(p.homeWin)}</T>
                        <T variant="caption" muted>{home.shortName}</T>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                        <T variant="display" color={ac}>{pct(p.awayWin)}</T>
                        <T variant="caption" muted>{away.shortName}</T>
                    </View>
                </Row>
                <SplitBar left={p.homeRegWin} middle={p.overtime} leftColor={hc} rightColor={ac} height={12}/>
                <Row style={{justifyContent: 'space-between', marginTop: 6}}>
                    <T variant="caption" muted>Reg. {pct(p.homeRegWin)}</T>
                    <Row gap={4}>
                        <T variant="caption" muted>Overtime {pct(p.overtime)}</T>
                        <InfoTip size={13} title="Overtime chance" body="How often the model expects this game to be tied after 60 minutes. The middle of the bar is that share; each side’s colour is its chance to win in regulation."/>
                    </Row>
                    <T variant="caption" muted>Reg. {pct(p.awayRegWin)}</T>
                </Row>
                {Number.isFinite(mpPregame) ? (
                    <View style={[styles.mp, {borderTopColor: colors.border}]}>
                        <Row style={{justifyContent: 'space-between', marginBottom: 6}}>
                            <T variant="label">{pct(mpPregame)}</T>
                            <Row gap={4}>
                                <T variant="caption" muted>MoneyPuck</T>
                                <InfoTip size={13} title="MoneyPuck" body="MoneyPuck.com’s published pregame model estimate, shown for comparison with Rinkside’s."/>
                            </Row>
                            <T variant="label">{pct(1 - mpPregame)}</T>
                        </Row>
                        <SplitBar left={mpPregame} leftColor={hc} rightColor={ac} height={6}/>
                    </View>
                ) : null}
            </Card>
            <View style={styles.tiles}>
                <View style={[styles.tile, {backgroundColor: colors.card}]}>
                    <Row gap={4}>
                        <T variant="caption" muted>Expected goals</T>
                        <InfoTip size={13} title="Expected goals" body="The average number of regulation goals the model expects each team to score in this matchup (model estimate)."/>
                    </Row>
                    <Row gap={8} style={{marginTop: 4}}>
                        <T variant="stat" color={hc}>{num(p.lambdaHome, 1)}</T>
                        <T variant="caption" muted>–</T>
                        <T variant="stat" color={ac}>{num(p.lambdaAway, 1)}</T>
                    </Row>
                </View>
                <View style={[styles.tile, {backgroundColor: colors.card}]}>
                    <Row gap={4}>
                        <T variant="caption" muted>Total goals</T>
                        <InfoTip size={13} title="Over / under" body="Model chance that the two teams combine for more than 5.5 or 6.5 goals in regulation. The expected total is the average across every outcome."/>
                    </Row>
                    <T variant="stat">{num(p.expectedTotal, 1)}</T>
                    <T variant="caption" muted>O5.5 {pct(p.totals?.over55)} · O6.5 {pct(p.totals?.over65)}</T>
                </View>
            </View>
            {p.scorelines?.length ? (
                <Card style={{marginTop: 10}}>
                    <Row gap={4} style={{marginBottom: 10}}>
                        <T variant="label" muted style={{flex: 1}}>Likeliest regulation scores</T>
                        <InfoTip size={13} title="Likeliest scores" body="The single most likely final scores after 60 minutes, by model estimate. Even the top one usually happens less than one game in ten."/>
                    </Row>
                    <View style={styles.scores}>
                        {p.scorelines.map((s) => {
                            const c = s.home > s.away ? hc : s.away > s.home ? ac : colors.textSecondary;
                            return (
                                <View key={`${s.home}-${s.away}`} style={[styles.scoreChip, {backgroundColor: colors.cardAlt, borderColor: c}]}>
                                    <T variant="label">{home.abbrev} {s.home}–{s.away} {away.abbrev}</T>
                                    <T variant="caption" muted>{pct(s.p, 1)}</T>
                                </View>
                            );
                        })}
                    </View>
                </Card>
            ) : null}
        </FadeInView>
    );
});

/* ------------------------------------------------------- goalies */

const GoalieColumn = memo(function GoalieColumn({goalie, team, season, onPlayer}) {
    return (
        <View style={{flex: 1, alignItems: 'center'}}>
            <PlayerTile
                playerId={goalie?.id}
                name={goalie?.name || 'Not confirmed'}
                headshot={goalie?.id ? headshotUrl(goalie.id, team, season) : undefined}
                team={team}
                caption={goalie?.confirmedBy ? `via ${goalie.confirmedBy}` : team}
                onPress={goalie?.id ? onPlayer : undefined}
            />
        </View>
    );
});

const Goalies = memo(function Goalies({goalies, loading, header, onPlayer}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const h = goalies?.home;
    const a = goalies?.away;
    if (!h && !a) {
        return (
            <Section title="Starting goalies">
                <Card><T variant="body" muted>{loading ? 'Checking for confirmed starters…' : 'Starters haven’t been confirmed yet.'}</T></Card>
            </Section>
        );
    }
    const hs = h?.stats ?? {};
    const as = a?.stats ?? {};
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    return (
        <Section title="Starting goalies" info="Projected or confirmed starters (via MoneyPuck.com) and their season numbers.">
            <Card>
                <Row style={{alignItems: 'flex-start', marginBottom: 14}}>
                    <GoalieColumn goalie={h} team={home.abbrev} season={header.season} onPlayer={onPlayer}/>
                    <GoalieColumn goalie={a} team={away.abbrev} season={header.season} onPlayer={onPlayer}/>
                </Row>
                {h?.stats || a?.stats ? (
                    <>
                        <CompareRow label="Save %" left={hs.savePct} right={as.savePct} leftColor={hc} rightColor={ac} format={savePct}/>
                        <CompareRow label="Goals against avg." left={hs.gaa} right={as.gaa} leftColor={hc} rightColor={ac} format={(v) => num(v, 2)} higherIsBetter={false}/>
                        <CompareRow
                            label="GSAx"
                            left={hs.gsax}
                            right={as.gsax}
                            leftColor={hc}
                            rightColor={ac}
                            format={(v) => signed(v, 1)}
                            info="Goals saved above expected this season (MoneyPuck): expected goals faced minus goals allowed. Positive means the goalie has stopped more than an average goalie would have. Model estimate."
                        />
                        <CompareRow label="Games" left={hs.gamesPlayed} right={as.gamesPlayed} leftColor={hc} rightColor={ac}/>
                    </>
                ) : null}
            </Card>
        </Section>
    );
});

/* -------------------------------------------------- team season */

const TeamSeason = memo(function TeamSeason({teams, header}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const rows = teams?.data ?? [];
    const h = rows.find((r) => r?.teamId === home.id) ?? rows.find((r) => r?.teamFullName === home.name);
    const a = rows.find((r) => r?.teamId === away.id) ?? rows.find((r) => r?.teamFullName === away.name);
    if (!h || !a) return null;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    const f2 = (v) => num(v, 2);
    const p1 = (v) => pct(v, 1);
    return (
        <Section title="Season per game">
            <Card>
                <MatchupHeading home={home.abbrev} away={away.abbrev}/>
                <CompareRow label="Goals for" left={h.goalsForPerGame} right={a.goalsForPerGame} leftColor={hc} rightColor={ac} format={f2}/>
                <CompareRow label="Goals against" left={h.goalsAgainstPerGame} right={a.goalsAgainstPerGame} leftColor={hc} rightColor={ac} format={f2} higherIsBetter={false}/>
                <CompareRow label="Shots for" left={h.shotsForPerGame} right={a.shotsForPerGame} leftColor={hc} rightColor={ac} format={(v) => num(v, 1)}/>
                <CompareRow label="Shots against" left={h.shotsAgainstPerGame} right={a.shotsAgainstPerGame} leftColor={hc} rightColor={ac} format={(v) => num(v, 1)} higherIsBetter={false}/>
                <CompareRow label="Power play %" left={h.powerPlayNetPct ?? h.powerPlayPct} right={a.powerPlayNetPct ?? a.powerPlayPct} leftColor={hc} rightColor={ac} format={p1}/>
                <CompareRow label="Penalty kill %" left={h.penaltyKillNetPct ?? h.penaltyKillPct} right={a.penaltyKillNetPct ?? a.penaltyKillPct} leftColor={hc} rightColor={ac} format={p1}/>
                <CompareRow label="Faceoff win %" left={h.faceoffWinPct} right={a.faceoffWinPct} leftColor={hc} rightColor={ac} format={p1}/>
            </Card>
        </Section>
    );
});

/* -------------------------------------------------------- leaders */

const CATEGORY = {points: 'Points', goals: 'Goals', assists: 'Assists', plusMinus: 'Plus/Minus', pim: 'PIM', hits: 'Hits', toi: 'TOI', faceoffs: 'Faceoffs'};

const Leaders = memo(function Leaders({landing, rail, header, onPlayer}) {
    const leaders = landing?.matchup?.teamLeadersL5 ?? landing?.matchup?.skaterComparison?.leaders ?? rail?.teamLeadersL5 ?? [];
    if (!leaders.length) return null;
    const fmt = (cat, v) => (cat === 'plusMinus' ? signed(v) : v ?? '–');
    return (
        <Section title="Team leaders · last 5 games">
            <View style={{gap: 10}}>
                {leaders.slice(0, 4).map((l, i) => (
                    <Card key={l?.category ?? i}>
                        <T variant="label" muted style={{textAlign: 'center', marginBottom: 8}}>{CATEGORY[l?.category] ?? l?.category}</T>
                        <Row style={{justifyContent: 'space-between'}}>
                            {[['home', l?.homeLeader, header.home.abbrev], ['away', l?.awayLeader, header.away.abbrev]].map(([k, p, team]) => (
                                <Row key={k} gap={10} style={{flex: 1, flexDirection: k === 'home' ? 'row' : 'row-reverse'}}>
                                    <PlayerTile
                                        playerId={p?.playerId}
                                        name={[loc(p?.firstName), loc(p?.lastName)].filter(Boolean).join(' ') || loc(p?.name)}
                                        headshot={p?.headshot}
                                        team={team}
                                        size={52}
                                        onPress={p?.playerId ? onPlayer : undefined}
                                    />
                                    <T variant="stat">{fmt(l?.category, p?.value)}</T>
                                </Row>
                            ))}
                        </Row>
                    </Card>
                ))}
            </View>
        </Section>
    );
});

/** Pregame "Preview" tab. */
export const PreviewTab = memo(function PreviewTab({header, prediction, mpPregame, goalies, goaliesLoading, teams, sims, landing, rail, onPlayer}) {
    return (
        <View>
            <Prediction header={header} prediction={prediction} mpPregame={mpPregame}/>
            <Goalies goalies={goalies} loading={goaliesLoading} header={header} onPlayer={onPlayer}/>
            <TeamSeason teams={teams} header={header}/>
            <PlayoffImpact sims={sims} header={header}/>
            <Leaders landing={landing} rail={rail} header={header} onPlayer={onPlayer}/>
        </View>
    );
});

/* ---------------------------------------------------- season series */

const SeriesGame = memo(function SeriesGame({game, onOpen}) {
    const h = game?.homeTeam ?? {};
    const a = game?.awayTeam ?? {};
    const played = h.score != null && a.score != null;
    const date = game?.gameDate ? shortDate(parseISODate(game.gameDate)) : '';
    return (
        <Card onPress={() => onOpen(game)} accessibilityLabel={`${a.abbrev} at ${h.abbrev}, ${date}`}>
            <Row style={{justifyContent: 'space-between'}}>
                <Row gap={10} style={{flex: 1}}>
                    <TeamLogo abbrev={h.abbrev} size={32}/>
                    <T variant="stat" style={{opacity: played && h.score < a.score ? 0.5 : 1}}>{played ? h.score : '–'}</T>
                </Row>
                <View style={{alignItems: 'center'}}>
                    <T variant="label">{date}</T>
                    {game?.gameOutcome?.lastPeriodType && game.gameOutcome.lastPeriodType !== 'REG' ? (
                        <Badge label={game.gameOutcome.lastPeriodType}/>
                    ) : <T variant="caption" muted>{played ? 'Final' : 'Upcoming'}</T>}
                </View>
                <Row gap={10} style={{flex: 1, justifyContent: 'flex-end'}}>
                    <T variant="stat" style={{opacity: played && a.score < h.score ? 0.5 : 1}}>{played ? a.score : '–'}</T>
                    <TeamLogo abbrev={a.abbrev} size={32}/>
                </Row>
            </Row>
        </Card>
    );
});

export const SeriesTab = memo(function SeriesTab({landing, rail, header, onOpenGame}) {
    const series = useMemo(() => landing?.matchup?.seasonSeries ?? rail?.seasonSeries ?? [], [landing, rail]);
    const wins = rail?.seasonSeriesWins ?? landing?.matchup?.seasonSeriesWins;
    if (!series.length) return <EmptyState title="First meeting" message="These teams haven’t met yet this season."/>;
    return (
        <View style={{gap: 10}}>
            {wins ? (
                <T variant="label" muted style={{textAlign: 'center', marginBottom: 4}}>
                    {header.home.abbrev} {wins.homeTeamWins ?? 0} – {wins.awayTeamWins ?? 0} {header.away.abbrev} this season
                </T>
            ) : null}
            {series.map((g, i) => (
                <FadeInView key={g?.id ?? i} delay={i * 40}>
                    <SeriesGame game={g} onOpen={onOpenGame}/>
                </FadeInView>
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    mp: {marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth},
    tiles: {flexDirection: 'row', gap: 10, marginTop: 10},
    tile: {flex: 1, borderRadius: 16, padding: 14},
    scores: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    scoreChip: {borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, minWidth: '47%', flexGrow: 1},
});
