import React, {memo, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {CompareRow, EmptyState, FadeInView, Row, Section, Segmented, SplitBar, T, TeamLogo} from '../../components/ui';
import {fetchLines} from '../../api/dailyfaceoff';
import {useQuery} from '../../hooks/useQuery';
import LinesView from '../fan/LinesView';
import Milestones from '../fan/Milestones';
import {headshotUrl} from '../../api/nhl';
import {useAppTheme} from '../../theme';
import {loc, num, parseISODate, pct, savePct, shortDate, signed} from '../../utils/format';
import {MatchupHeading, PlayerTile, type} from './common';
import PlayoffImpact from './PlayoffImpact';

/* -------------------------------------------------- prediction */

/** One small labelled number in a row of equal columns. */
function Figure({label, value, color, align = 'center'}) {
    return (
        <View style={[styles.figure, {alignItems: align}]}>
            <T variant="body" color={color} style={type.value}>{value}</T>
            <T variant="caption" muted numberOfLines={1}>{label}</T>
        </View>
    );
}

const SubTitle = ({children, first}) => <T variant="caption" muted style={[styles.subTitle, first && styles.firstSub]}>{children.toUpperCase()}</T>;

/**
 * Pregame prediction in three plain steps: who wins (big numbers and one bar), how (regulation,
 * overtime, expected goals per side), then the scoring picture (total goals and likeliest scores).
 */
const Prediction = memo(function Prediction({header, prediction}) {
    const {teamColor, colors} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    if (!prediction) return null;
    const p = prediction;
    const scores = (p.scorelines ?? []).slice(0, 4);
    return (
        <FadeInView>
            <SubTitle first>Win probability</SubTitle>
            <Row style={styles.winRow}>
                <Row gap={8} style={styles.flex}>
                    <TeamLogo abbrev={home.abbrev} size={30}/>
                    <T variant="display" color={hc}>{pct(p.homeWin)}</T>
                </Row>
                <Row gap={8} style={[styles.flex, styles.end]}>
                    <T variant="display" color={ac}>{pct(p.awayWin)}</T>
                    <TeamLogo abbrev={away.abbrev} size={30}/>
                </Row>
            </Row>
            <SplitBar left={p.homeRegWin} middle={p.overtime} leftColor={hc} rightColor={ac} height={12}/>
            {/* Each part of the bar labelled right under it: regulation wins at the ends, overtime in the middle. */}
            <Row gap={0} style={styles.barLabels}>
                <Figure label="Reg. win" value={pct(p.homeRegWin)} color={hc} align="flex-start"/>
                <Figure label="Overtime" value={pct(p.overtime)}/>
                <Figure label="Reg. win" value={pct(p.awayRegWin)} color={ac} align="flex-end"/>
            </Row>

            <SubTitle>Goals</SubTitle>
            <Row gap={0}>
                <Figure label={`${home.abbrev} expected`} value={num(p.lambdaHome, 1)} color={hc} align="flex-start"/>
                <Figure label="Expected total" value={num(p.expectedTotal, 1)}/>
                <Figure label={`${away.abbrev} expected`} value={num(p.lambdaAway, 1)} color={ac} align="flex-end"/>
            </Row>
            <T variant="caption" muted style={styles.overs}>
                Over 5.5: {pct(p.totals?.over55)}  ·  Over 6.5: {pct(p.totals?.over65)}
            </T>

            {scores.length ? (
                <>
                    <SubTitle>Likeliest regulation scores</SubTitle>
                    <Row gap={0} style={styles.scores}>
                        {scores.map((s) => {
                            const winner = s.home > s.away ? home.abbrev : s.away > s.home ? away.abbrev : null;
                            const c = winner ? teamColor(winner) : colors.textSecondary;
                            return (
                                <View key={`${s.home}-${s.away}`} style={styles.figure}>
                                    <T variant="caption" color={c} style={styles.semi}>{winner ?? 'Tied'}</T>
                                    <T variant="body" style={type.pie}>{s.home}–{s.away}</T>
                                    <T variant="caption" muted>{pct(s.p, 1)}</T>
                                </View>
                            );
                        })}
                    </Row>
                </>
            ) : null}
        </FadeInView>
    );
});

/* ------------------------------------------------------- goalies */

const GoalieColumn = memo(function GoalieColumn({goalie, team, season, onPlayer}) {
    const {colors} = useAppTheme();
    // Confirmed (a beat reporter or the team said so), Likely, or Projected (the expected starter).
    const STATUS = {Confirmed: colors.positive, Likely: colors.warning, Projected: colors.textSecondary};
    const status = !goalie
        ? {label: 'TBD', color: colors.textSecondary}
        : {label: goalie.status ?? 'Projected', color: STATUS[goalie.status] ?? colors.textSecondary};
    return (
        <View style={{flex: 1, alignItems: 'center'}}>
            <PlayerTile
                playerId={goalie?.id}
                name={goalie?.name || 'Not announced'}
                headshot={goalie?.id ? headshotUrl(goalie.id, team, season) : undefined}
                team={team}
                status={status}
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
                <View><T variant="body" muted>{loading ? 'Checking for confirmed starters…' : 'Starters haven’t been confirmed yet.'}</T></View>
            </Section>
        );
    }
    const hs = h?.stats ?? {};
    const as = a?.stats ?? {};
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    return (
        <Section title="Starting goalies" info="Tonight’s expected starters and how sure that is: Confirmed (announced by the team or a beat reporter), Likely, or Projected. Season numbers below.">
            <View>
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
                            info="Goals saved above expected this season: expected goals faced minus goals allowed. Positive means the goalie has stopped more than an average goalie would have."
                        />
                        <CompareRow label="Games" left={hs.gamesPlayed} right={as.gamesPlayed} leftColor={hc} rightColor={ac}/>
                    </>
                ) : null}
            </View>
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
            <View>
                <MatchupHeading home={home.abbrev} away={away.abbrev}/>
                <CompareRow label="Goals for" left={h.goalsForPerGame} right={a.goalsForPerGame} leftColor={hc} rightColor={ac} format={f2}/>
                <CompareRow label="Goals against" left={h.goalsAgainstPerGame} right={a.goalsAgainstPerGame} leftColor={hc} rightColor={ac} format={f2} higherIsBetter={false}/>
                <CompareRow label="Shots for" left={h.shotsForPerGame} right={a.shotsForPerGame} leftColor={hc} rightColor={ac} format={(v) => num(v, 1)}/>
                <CompareRow label="Shots against" left={h.shotsAgainstPerGame} right={a.shotsAgainstPerGame} leftColor={hc} rightColor={ac} format={(v) => num(v, 1)} higherIsBetter={false}/>
                <CompareRow label="Power play %" left={h.powerPlayNetPct ?? h.powerPlayPct} right={a.powerPlayNetPct ?? a.powerPlayPct} leftColor={hc} rightColor={ac} format={p1}/>
                <CompareRow label="Penalty kill %" left={h.penaltyKillNetPct ?? h.penaltyKillPct} right={a.penaltyKillNetPct ?? a.penaltyKillPct} leftColor={hc} rightColor={ac} format={p1}/>
                <CompareRow label="Faceoff win %" left={h.faceoffWinPct} right={a.faceoffWinPct} leftColor={hc} rightColor={ac} format={p1}/>
            </View>
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
                    <View key={l?.category ?? i} style={styles.leader}>
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
                    </View>
                ))}
            </View>
        </Section>
    );
});

/** Pregame "Preview" tab. */
export const PreviewTab = memo(function PreviewTab({header, prediction, goalies, goaliesLoading, teams, sims, landing, rail, milestones, onPlayer}) {
    return (
        <View>
            <Prediction header={header} prediction={prediction}/>
            <Goalies goalies={goalies} loading={goaliesLoading} header={header} onPlayer={onPlayer}/>
            <TeamSeason teams={teams} header={header}/>
            <PlayoffImpact sims={sims} header={header}/>
            <Leaders landing={landing} rail={rail} header={header} onPlayer={onPlayer}/>
            {milestones ? <Milestones data={milestones} onPlayer={onPlayer}/> : null}
        </View>
    );
});

/* ------------------------------------------------------------ lines */

/** Pregame "Lines" tab: each team's projected line combinations, one team at a time. */
export const LinesTab = memo(function LinesTab({header, onPlayer}) {
    const {home, away} = header;
    const [team, setTeam] = useState(home.abbrev);
    const q = useQuery(({force}) => fetchLines(team, {force}), [team], {enabled: !!team});
    return (
        <View>
            <Segmented
                options={[{key: home.abbrev, label: home.abbrev}, {key: away.abbrev, label: away.abbrev}]}
                value={team}
                onChange={setTeam}
            />
            <LinesView key={team} lines={q.data} team={team} loading={q.loading} error={q.error} onRetry={q.refresh} onPlayer={onPlayer}/>
        </View>
    );
});

/* ---------------------------------------------------- season series */

/** Old season-series card: logo, score (Bold 20), date, score, logo — centred on one line. */
const SeriesGame = memo(function SeriesGame({game, onOpen}) {
    const {colors} = useAppTheme();
    const h = game?.homeTeam ?? {};
    const a = game?.awayTeam ?? {};
    const played = h.score != null && a.score != null;
    const date = game?.gameDate ? shortDate(parseISODate(game.gameDate)) : '';
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${a.abbrev} at ${h.abbrev}, ${date}`}
            onPress={() => onOpen(game)}
            style={({pressed}) => [styles.seriesCard, {backgroundColor: colors.card}, pressed && {opacity: 0.7}]}>
            <Row gap={0} style={{justifyContent: 'center'}}>
                <TeamLogo abbrev={h.abbrev} size={35}/>
                <T variant="body" style={[styles.seriesScore, {paddingLeft: 15}]}>{played ? h.score : '--'}</T>
                <View style={{alignItems: 'center'}}>
                    {/* Plain text, no pill (same treatment as the header date/time). */}
                    <T variant="body" style={styles.seriesDate}>{date}</T>
                    <T variant="body" style={[type.sub, {marginTop: 4}]}>
                        {game?.gameOutcome?.lastPeriodType && game.gameOutcome.lastPeriodType !== 'REG'
                            ? game.gameOutcome.lastPeriodType
                            : played ? 'Final' : 'Upcoming'}
                    </T>
                </View>
                <T variant="body" style={[styles.seriesScore, {paddingLeft: 15}]}>{played ? a.score : '--'}</T>
                <TeamLogo abbrev={a.abbrev} size={35}/>
            </Row>
        </Pressable>
    );
});

export const SeriesTab = memo(function SeriesTab({landing, rail, header, onOpenGame}) {
    const series = useMemo(() => landing?.matchup?.seasonSeries ?? rail?.seasonSeries ?? [], [landing, rail]);
    const wins = rail?.seasonSeriesWins ?? landing?.matchup?.seasonSeriesWins;
    if (!series.length) return <EmptyState title="First meeting" message="These teams haven’t met yet this season."/>;
    return (
        <View>
            {wins ? (
                <T variant="body" style={[type.value, {textAlign: 'center', marginBottom: 20}]}>
                    {header.home.abbrev} {wins.homeTeamWins ?? 0} • {wins.awayTeamWins ?? 0} {header.away.abbrev} this season
                </T>
            ) : null}
            {series.map((g, i) => <SeriesGame key={g?.id ?? i} game={g} onOpen={onOpenGame}/>)}
        </View>
    );
});

const styles = StyleSheet.create({
    flex: {flex: 1},
    end: {justifyContent: 'flex-end'},
    right: {textAlign: 'right'},
    semi: {fontFamily: 'Sora_600SemiBold'},
    firstSub: {marginTop: 0},
    subTitle: {fontFamily: 'Sora_600SemiBold', letterSpacing: 0.8, marginTop: 24, marginBottom: 10},
    winRow: {marginBottom: 10},
    barLabels: {marginTop: 10, alignItems: 'flex-start'},
    overs: {textAlign: 'center', marginTop: 10, fontVariant: ['tabular-nums']},
    figure: {flex: 1, alignItems: 'center', gap: 2},
    leader: {paddingVertical: 4},
    scores: {alignItems: 'flex-start'},
    seriesCard: {borderRadius: 15, paddingVertical: 15, marginBottom: 4},
    seriesDate: {fontFamily: 'Sora_600SemiBold', textAlign: 'center', fontVariant: ['tabular-nums']},
    seriesScore: {fontFamily: 'Sora_700Bold', fontSize: 20, lineHeight: 26, width: 55, fontVariant: ['tabular-nums']},
});
