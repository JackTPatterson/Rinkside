import React, {memo, useCallback, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {leaguePointPct, pdo, playoffLine, teamProfile} from '../../analytics';
import {isLive} from '../../api/nhl';
import {Card, ErrorState, FadeInView, InfoTip, ProgressBar, Row, Section, Skeleton, SplitBar, StatTile, T, TeamLogo} from '../../components/ui';
import {useAppTheme, withAlpha} from '../../theme';
import {formatTime, num, ordinal, pct, relativeDayLabel, signed} from '../../utils/format';
import {REGULAR_SEASON_GAMES} from '../../utils/season';
import {findStandingsRow, findTeamSummary, gamePrediction, gameTime, sides} from './data';

const INFO = {
    prediction: 'A model estimate, not a guarantee. Rinkside rates each team’s scoring and goal prevention from this season’s results (pulled toward league average early on), adds home ice, then plays out regulation minute by minute, including power plays and pulled goalies, to get every possible outcome.',
    scorelines: 'The single most likely final scores after 60 minutes, from the same model estimate. Even the likeliest score usually happens less than 1 time in 10, which is why hockey is hard to predict.',
    xg: 'How many goals the model expects each team to score in regulation, given both teams’ strength and home ice. A model estimate.',
    pace: 'Points the team would finish with if it kept earning points at exactly its current rate for all 82 games.',
    projected: 'Final points total from a model estimate that blends the team’s current points rate with a league-average prior (stronger early in the season). The range covers 80% of likely outcomes.',
    pyth: 'Points a team “should” have given its goals for and against (Pythagorean expectation). Luck is actual minus expected points: a big positive number often means close-game wins that tend not to last.',
    gd: 'Goals scored minus goals allowed, per game played. It’s one of the most reliable signs of how good a team really is.',
    race: 'Each conference team’s final points are projected (a model estimate) and the 8th-best projection is used as the cut line. The real format is top 3 per division plus two wild cards, so the true line can differ by a point or two.',
    strength: 'Model ratings from goals scored and allowed per game, pulled toward league average so a hot start doesn’t look like a dynasty. 100% is a league-average team.',
    pdo: 'PDO adds a team’s shooting % and save %. League average is about 1000. Values far from 1000 are mostly luck and tend to drift back toward average over the season.',
};

/* ----------------------------------------------------- next-game prediction */

const PredictionCard = memo(function PredictionCard({abbrev, game, ratings, onOpenGame}) {
    const {teamColor, colors} = useAppTheme();
    const {isHome, opp} = sides(game, abbrev);
    const pred = gamePrediction(ratings, game); // cached per ratings + matchup
    const onPress = useCallback(() => onOpenGame(game), [onOpenGame, game]);
    if (!pred) return null;
    const win = isHome ? pred.homeWin : pred.awayWin;
    const regWin = isHome ? pred.homeRegWin : pred.awayRegWin;
    const regLoss = isHome ? pred.awayRegWin : pred.homeRegWin;
    const xgUs = isHome ? pred.lambdaHome : pred.lambdaAway;
    const xgThem = isHome ? pred.lambdaAway : pred.lambdaHome;
    const start = gameTime(game);
    const us = teamColor(abbrev);
    const them = teamColor(opp);
    const scores = pred.scorelines.slice(0, 4).map((s) => ({
        us: isHome ? s.home : s.away,
        them: isHome ? s.away : s.home,
        p: s.p,
    }));

    return (
        <Card onPress={onPress} style={styles.predCard}>
            <Row style={styles.between}>
                <Row gap={8} style={styles.flex}>
                    <T variant="caption" muted>{isHome ? 'vs' : '@'}</T>
                    <TeamLogo abbrev={opp} size={28}/>
                    <View style={styles.flex}>
                        <T variant="label" numberOfLines={1}>{opp ?? 'TBD'}</T>
                        <T variant="caption" muted numberOfLines={1}>
                            {isLive(game) ? 'Live now · pregame prediction' : start ? `${relativeDayLabel(start)} · ${formatTime(start)}` : 'TBD'}
                        </T>
                    </View>
                </Row>
                <InfoTip title="Game prediction" body={INFO.prediction}/>
            </Row>

            <View style={styles.bigRow}>
                <T variant="display" color={us} style={styles.bigNum} numberOfLines={1}>{pct(win)}</T>
                <T variant="body" muted style={styles.flex}>chance {abbrev} wins</T>
            </View>

            <SplitBar left={regWin} middle={pred.overtime} leftColor={us} rightColor={them} height={10}/>
            <Row style={styles.splitLabels}>
                <View>
                    <T variant="label">{pct(regWin)}</T>
                    <T variant="caption" muted>Win in reg.</T>
                </View>
                <View style={styles.centerText}>
                    <T variant="label">{pct(pred.overtime)}</T>
                    <T variant="caption" muted>Goes to OT</T>
                </View>
                <View style={styles.rightText}>
                    <T variant="label">{pct(regLoss)}</T>
                    <T variant="caption" muted>Lose in reg.</T>
                </View>
            </Row>

            <View style={[styles.divider, {backgroundColor: colors.border}]}/>

            <Row style={styles.between}>
                <Row gap={4}>
                    <T variant="caption" muted>Expected goals</T>
                    <InfoTip title="Expected goals" body={INFO.xg} size={14}/>
                </Row>
                <T variant="label">
                    <T variant="label" color={us}>{abbrev} {num(xgUs, 1)}</T>
                    {'  ·  '}
                    <T variant="label" color={them}>{opp} {num(xgThem, 1)}</T>
                </T>
            </Row>

            <Row gap={4} style={styles.scoreHead}>
                <T variant="caption" muted>Likeliest scores after 60 min</T>
                <InfoTip title="Likeliest scores" body={INFO.scorelines} size={14}/>
            </Row>
            <Row gap={6} style={styles.wrap}>
                {scores.map((s) => {
                    const tone = s.us > s.them ? us : s.us < s.them ? them : colors.textSecondary;
                    return (
                        <View key={`${s.us}-${s.them}`} style={[styles.scoreChip, {backgroundColor: withAlpha(tone, 0.14)}]}>
                            <T variant="label">{s.us}–{s.them}</T>
                            <T variant="caption" muted>{pct(s.p, 1)}</T>
                        </View>
                    );
                })}
            </Row>
        </Card>
    );
});

/* ------------------------------------------------------- playoff race */

function RaceBar({lo, hi, projected, line, color}) {
    const {colors} = useAppTheme();
    const min = Math.floor(Math.min(lo, line) - 4);
    const max = Math.ceil(Math.max(hi, line) + 4);
    const x = (v) => `${((v - min) / Math.max(1, max - min)) * 100}%`;
    return (
        <View style={styles.raceWrap}>
            <View style={[styles.raceTrack, {backgroundColor: colors.cardAlt}]}>
                <View style={[styles.raceBand, {left: x(lo), width: `${((hi - lo) / Math.max(1, max - min)) * 100}%`, backgroundColor: withAlpha(color, 0.3)}]}/>
                <View style={[styles.raceDot, {left: x(projected), backgroundColor: color, borderColor: colors.card}]}/>
                <View style={[styles.raceLine, {left: x(line), backgroundColor: colors.text}]}/>
            </View>
            <Row style={styles.between}>
                <T variant="caption" muted style={styles.tabular}>{min} pts</T>
                <T variant="caption" muted style={styles.tabular}>Cut line ≈ {Math.round(line)}</T>
                <T variant="caption" muted style={styles.tabular}>{max} pts</T>
            </Row>
        </View>
    );
}

function raceSentence(me) {
    const remainingGames = Math.max(0, REGULAR_SEASON_GAMES - me.gp);
    if (!remainingGames) return 'The regular season is over.';
    if (me.neededPointPct == null) return null;
    if (me.neededPointPct <= 0) return 'Has already banked more points than the projected cut line.';
    if (me.neededPointPct > 1) return 'Can’t reach the projected cut line even by winning every remaining game.';
    return `Needs to earn ${pct(me.neededPointPct)} of remaining points (about ${num(me.neededPerGame, 2)} per game) to reach the line. So far: ${pct(me.pointPct)}.`;
}

/* ---------------------------------------------------------------- tab */

function InsightsTab({abbrev, hero, standings, ratings, loading, error, onRetry, summary, onOpenGame}) {
    const {teamColor, colors} = useAppTheme();
    const color = teamColor(abbrev);

    const model = useMemo(() => {
        const rows = standings?.standings ?? [];
        const row = findStandingsRow(standings, abbrev);
        if (!row) return null;
        const lp = leaguePointPct(rows);
        const opts = {leaguePointPct: lp, seasonGames: REGULAR_SEASON_GAMES};
        const profile = teamProfile(row, opts);
        const conf = rows.filter((r) => (r.conferenceAbbrev ?? r.conferenceName) === (row.conferenceAbbrev ?? row.conferenceName));
        const race = playoffLine(conf, opts);
        const ranked = [...race.teams].sort((a, b) => b.projected - a.projected);
        const me = race.teams.find((t) => t.abbrev === abbrev) ?? null;
        const projRank = ranked.findIndex((t) => t.abbrev === abbrev) + 1;
        return {row, profile, line: race.line, me, projRank, confName: row.conferenceName ?? 'conference', confSize: conf.length};
    }, [standings, abbrev]);

    const strength = useMemo(() => {
        const teams = ratings?.teams;
        const mine = teams?.[abbrev];
        if (!mine) return null;
        const list = Object.entries(teams);
        const attackRank = [...list].sort((a, b) => b[1].attack - a[1].attack).findIndex(([k]) => k === abbrev) + 1;
        const defenseRank = [...list].sort((a, b) => a[1].defense - b[1].defense).findIndex(([k]) => k === abbrev) + 1;
        return {...mine, attackRank, defenseRank, count: list.length};
    }, [ratings, abbrev]);

    const luck = useMemo(() => {
        const r = findTeamSummary(summary, abbrev, model?.row);
        return r ? pdo(r) : null;
    }, [summary, abbrev, model?.row]);

    if (loading && !standings) {
        return (
            <View style={styles.pad}>
                <Skeleton height={260} radius={16}/>
                <Skeleton height={24} width={180} style={styles.mt24}/>
                <Row style={styles.mt12}>
                    <Skeleton height={84} radius={16} width="49%"/>
                    <Skeleton height={84} radius={16} width="49%"/>
                </Row>
            </View>
        );
    }
    if (error && !standings) return <ErrorState message="Couldn’t load league data." onRetry={onRetry}/>;
    if (!model) return <ErrorState message="This team isn’t in the current standings." onRetry={onRetry}/>;

    const {profile, me, line} = model;
    const race = me ? raceSentence(me) : null;
    const early = profile.gp < 10;
    const noGames = profile.gp === 0;

    return (
        <FadeInView style={styles.pad}>
            {hero ? (
                <PredictionCard abbrev={abbrev} game={hero} ratings={ratings} onOpenGame={onOpenGame}/>
            ) : (
                <Card><T variant="body" muted>No upcoming game to predict.</T></Card>
            )}

            {early ? (
                <T variant="caption" muted style={styles.mt12}>
                    {noGames ? 'The season hasn’t started yet, so these numbers are league-average starting points.' : `Only ${profile.gp} games in: projections still lean heavily on league averages.`}
                </T>
            ) : null}

            <Section title="Season outlook">
                <View style={styles.grid}>
                    <StatTile label="Points pace" value={noGames ? '–' : num(profile.pace)} sub="82-game pace at current rate" info={INFO.pace}/>
                    <StatTile
                        label="Projected points"
                        value={num(profile.projected)}
                        sub={`80% range ${num(profile.projectedLo)}–${num(profile.projectedHi)}`}
                        color={color}
                        info={INFO.projected}
                    />
                    <StatTile
                        label="Expected points"
                        value={noGames ? '–' : num(profile.expectedPoints)}
                        sub={noGames ? 'From goal differential' : `Luck ${signed(profile.luck, 1)} pts`}
                        info={INFO.pyth}
                    />
                    <StatTile
                        label="Goal diff / game"
                        value={noGames ? '–' : signed(profile.goalDiffPerGame, 2)}
                        color={profile.goalDiffPerGame > 0 ? colors.positive : profile.goalDiffPerGame < 0 ? colors.negative : undefined}
                        sub={`${model.row.goalFor ?? 0} GF · ${model.row.goalAgainst ?? 0} GA`}
                        info={INFO.gd}
                    />
                </View>
            </Section>

            {me && line != null ? (
                <Section title="Playoff race" info={INFO.race}>
                    <Card>
                        <T variant="heading" color={me.cushion >= 0 ? colors.positive : colors.negative}>
                            {Math.abs(me.cushion) < 0.5
                                ? 'Right on the projected cut line'
                                : `${num(Math.abs(me.cushion))} pts ${me.cushion > 0 ? 'above' : 'below'} the projected line`}
                        </T>
                        <T variant="caption" muted>
                            Projected {ordinal(model.projRank)} of {model.confSize} in the {model.confName}
                        </T>
                        <RaceBar lo={profile.projectedLo} hi={profile.projectedHi} projected={profile.projected} line={line} color={color}/>
                        {race ? <T variant="body" style={styles.mt12}>{race}</T> : null}
                    </Card>
                </Section>
            ) : null}

            {strength ? (
                <Section title="Team strength" info={INFO.strength}>
                    <Card style={styles.gap16}>
                        <StrengthRow
                            label="Attack"
                            text={strengthText(strength.attack, true)}
                            rank={strength.attackRank}
                            count={strength.count}
                            color={color}
                        />
                        <StrengthRow
                            label="Defense"
                            text={strengthText(strength.defense, false)}
                            rank={strength.defenseRank}
                            count={strength.count}
                            color={color}
                        />
                    </Card>
                </Section>
            ) : null}

            {luck ? (
                <Section title="Luck check (PDO)" info={INFO.pdo}>
                    <View style={styles.grid}>
                        <StatTile label="Shooting %" value={pct(luck.shootingPct, 1)} sub="League avg ≈ 10%"/>
                        <StatTile label="Save %" value={pct(luck.savePct, 1)} sub="League avg ≈ 90%"/>
                    </View>
                    <Card style={styles.mt8}>
                        <Row style={styles.between}>
                            <T variant="label">PDO</T>
                            <T variant="stat" color={pdoTone(luck.pdo, colors)}>{num(luck.pdo)}</T>
                        </Row>
                        <T variant="body" muted style={styles.mt8}>{pdoNote(luck.pdo, early)}</T>
                    </Card>
                </Section>
            ) : null}

            <T variant="caption" muted style={styles.footer}>All projections are model estimates from this season’s standings.</T>
        </FadeInView>
    );
}

function strengthText(r, attack) {
    const d = attack ? r - 1 : 1 - r;
    const mag = Math.abs(d * 100).toFixed(0);
    if (Math.abs(d) < 0.01) return attack ? 'Scores at a league-average rate' : 'Allows goals at a league-average rate';
    return attack
        ? `Scores ${mag}% ${d > 0 ? 'more' : 'fewer'} goals than average`
        : `Allows ${mag}% ${d > 0 ? 'fewer' : 'more'} goals than average`;
}

const StrengthRow = memo(function StrengthRow({label, text, rank, count, color}) {
    return (
        <View>
            <Row style={styles.between}>
                <T variant="label">{label}</T>
                <T variant="caption" muted>{ordinal(rank)} of {count}</T>
            </Row>
            <T variant="body" style={styles.mt4}>{text}</T>
            <ProgressBar value={count > 1 ? (count - rank) / (count - 1) : 0.5} color={color} style={styles.mt8}/>
        </View>
    );
});

function pdoTone(v, colors) {
    if (v >= 1015) return colors.warning;
    if (v <= 985) return colors.accent;
    return undefined;
}

function pdoNote(v, early) {
    const caveat = early ? ' It’s early, so expect big swings either way.' : '';
    if (v >= 1015) return `Running hot: pucks are going in and saves are being made at an unusual rate. Expect results to cool off.${caveat}`;
    if (v <= 985) return `Running cold: shooting and goaltending luck have been poor. Results should improve even if nothing changes.${caveat}`;
    return `In the normal range: results aren’t being propped up or dragged down much by luck.${caveat}`;
}

export default memo(InsightsTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: 16},
    flex: {flex: 1},
    between: {justifyContent: 'space-between'},
    mt4: {marginTop: 4},
    mt8: {marginTop: 8},
    mt12: {marginTop: 12},
    mt24: {marginTop: 24},
    gap16: {gap: 16},
    predCard: {padding: 16},
    bigRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14, marginBottom: 12},
    bigNum: {fontSize: 44, lineHeight: 50, fontVariant: ['tabular-nums']},
    tabular: {fontVariant: ['tabular-nums']},
    splitLabels: {justifyContent: 'space-between', marginTop: 8},
    centerText: {alignItems: 'center'},
    rightText: {alignItems: 'flex-end'},
    divider: {height: StyleSheet.hairlineWidth, marginVertical: 14},
    scoreHead: {marginTop: 14, marginBottom: 8},
    wrap: {flexWrap: 'wrap'},
    scoreChip: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center'},
    grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    raceWrap: {marginTop: 16, gap: 6},
    raceTrack: {height: 12, borderRadius: 6, justifyContent: 'center'},
    raceBand: {position: 'absolute', top: 0, bottom: 0, borderRadius: 6},
    raceDot: {position: 'absolute', width: 16, height: 16, marginLeft: -8, borderRadius: 8, borderWidth: 2},
    raceLine: {position: 'absolute', width: 2, height: 22, marginLeft: -1, borderRadius: 1},
    footer: {marginTop: 20},
});
