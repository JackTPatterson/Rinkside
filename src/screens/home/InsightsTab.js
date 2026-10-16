import React, {memo, useCallback, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {alignPrediction, leaguePointPct, pdo, playoffLine, teamProfile} from '../../analytics';
import {isLive} from '../../api/nhl';
import Milestones from '../fan/Milestones';
import {ErrorState, FadeInView, InfoTip, ProgressBar, Row, Section, Skeleton, SplitBar, StatTile, T, TeamLogo} from '../../components/ui';
import {GUTTER, useAppTheme, withAlpha} from '../../theme';
import {formatTime, num, ordinal, pct, relativeDayLabel, signed} from '../../utils/format';
import {REGULAR_SEASON_GAMES} from '../../utils/season';
import {findStandingsRow, findTeamSummary, gamePrediction, gameTime, sides} from './data';
import {useMoneyPuckProb} from '../scores/GameCard';

const INFO = {
    xg: 'How many goals each team is expected to score in regulation, given both teams’ strength and home ice.',
    projected: 'Projected final points, blending the team’s current points rate with a league-average prior (stronger early in the season). The range covers 80% of likely outcomes.',
    pyth: 'Points a team “should” have given its goals for and against (Pythagorean expectation). Luck is actual minus expected points: a big positive number often means close-game wins that tend not to last.',
    race: 'Each conference team’s final points are projected and the 8th-best projection is used as the cut line. The real format is top 3 per division plus two wild cards, so the true line can differ by a point or two.',
    strength: 'Ratings from goals scored and allowed per game, pulled toward league average so a hot start doesn’t look like a dynasty. 100% is a league-average team.',
    pdo: 'PDO adds a team’s shooting % and save %. League average is about 1000. Values far from 1000 are mostly luck and tend to drift back toward average over the season.',
};

/* ----------------------------------------------------- next-game prediction */

const PredictionCard = memo(function PredictionCard({abbrev, game, ratings, onOpenGame}) {
    const {teamColor, colors} = useAppTheme();
    const {isHome, opp} = sides(game, abbrev);
    // Our model's breakdown re-centred on MoneyPuck's pregame number when it has one, so the app
    // shows a single win probability for this game everywhere.
    const mp = useMoneyPuckProb(game);
    const pred = alignPrediction(gamePrediction(ratings, game), mp); // gamePrediction is cached per ratings + matchup
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
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({pressed}) => [styles.predCard, pressed && styles.pressed]}>
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

            <View style={[styles.divider, {backgroundColor: colors.text}]}/>

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
            </Row>
            <Row gap={6}>
                {scores.map((s) => {
                    const tone = s.us > s.them ? us : s.us < s.them ? them : colors.textSecondary;
                    return (
                        <View key={`${s.us}-${s.them}`} style={[styles.scoreChip, {backgroundColor: colors.card}]}>
                            <T variant="label" color={tone}>{s.us}–{s.them}</T>
                            <T variant="caption" muted>{pct(s.p, 1)}</T>
                        </View>
                    );
                })}
            </Row>
        </Pressable>
    );
});

/* ------------------------------------------------------- playoff race */

const RACE_LABEL_W = 120;

/** Label centred on x (px) but kept inside the track; text hugs the edge it's clamped to. */
function PinnedLabel({x, width, children, color, muted, style}) {
    const left = Math.min(Math.max(0, x - RACE_LABEL_W / 2), Math.max(0, width - RACE_LABEL_W));
    const align = x < RACE_LABEL_W / 2 ? 'left' : x > width - RACE_LABEL_W / 2 ? 'right' : 'center';
    return (
        <View style={[styles.racePin, {left}, style]}>
            <T variant="caption" color={color} muted={muted} numberOfLines={1} style={[styles.tabular, styles.semi, {textAlign: align}]}>{children}</T>
        </View>
    );
}

/**
 * Projected points as a bar: solid fill up to the projection, lighter upside to the top of the 80%
 * range, and the cut line as a gap in the bar (like the split bars). Projection is labelled above,
 * the cut line below, so the two never collide.
 */
function RaceBar({hi, projected, line, color}) {
    const {colors} = useAppTheme();
    const [width, setWidth] = useState(0);
    const min = Math.floor(Math.min(projected, line) - 12);
    const max = Math.ceil(Math.max(hi, line) + 4);
    const px = (v) => (Math.min(max, Math.max(min, v)) - min) / Math.max(1, max - min) * width;
    const xp = px(projected);
    const xh = px(hi);
    const xl = px(line);
    return (
        <View style={styles.raceWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width ? (
                <>
                    <View style={styles.raceLabels}>
                    </View>
                    <View style={[styles.raceTrack, {backgroundColor: colors.cardAlt}]}>
                        <View style={[styles.raceSeg, {left: 0, width: xp, backgroundColor: color}]}/>
                        <View style={[styles.raceSeg, {left: xp, width: Math.max(0, xh - xp), backgroundColor: withAlpha(color, 0.3)}]}/>
                        <View style={[styles.raceCut, {left: xl - 1.5, backgroundColor: colors.background}]}/>
                    </View>
                    <View style={styles.raceLabels}>
                        <PinnedLabel x={xl} width={width} muted>Cut line ≈ {Math.round(line)}</PinnedLabel>
                    </View>
                </>
            ) : <View style={styles.raceTrack}/>}
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

function InsightsTab({abbrev, hero, standings, ratings, loading, error, onRetry, summary, milestones, onOpenGame, onOpenPlayer}) {
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
                <Skeleton height={28} width={160} radius={10}/>
                <Skeleton height={50} width={140} radius={10} style={styles.mt12}/>
                <Skeleton height={10} radius={100} style={styles.mt12}/>
                <Skeleton height={60} radius={10} style={styles.mt12}/>
                <Skeleton height={30} width={180} radius={15} style={styles.mt24}/>
                <Row gap={16} style={styles.mt12}>
                    <Skeleton height={60} radius={10} width="47%"/>
                    <Skeleton height={60} radius={10} width="47%"/>
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
                <T variant="body" muted>No upcoming game to predict.</T>
            )}

            {early ? (
                <T variant="caption" muted style={styles.mt12}>
                    {noGames ? 'The season hasn’t started yet, so these numbers are league-average starting points.' : `Only ${profile.gp} games in: projections still lean heavily on league averages.`}
                </T>
            ) : null}

            {milestones ? <Milestones data={milestones} onPlayer={onOpenPlayer}/> : null}

            <Section title="Season outlook">
                <View style={styles.grid}>
                    <StatTile style={styles.tile} label="Points pace" value={noGames ? '–' : num(profile.pace)} sub="82-game pace at current rate"/>
                    <StatTile
                        style={styles.tile}
                        label="Projected points"
                        value={num(profile.projected)}
                        sub={`80% range ${num(profile.projectedLo)}–${num(profile.projectedHi)}`}
                        color={color}
                        info={INFO.projected}
                    />
                    <StatTile
                        style={styles.tile}
                        label="Expected points"
                        value={noGames ? '–' : num(profile.expectedPoints)}
                        sub={noGames ? 'From goal differential' : `Luck ${signed(profile.luck, 1)} pts`}
                        info={INFO.pyth}
                    />
                    <StatTile
                        style={styles.tile}
                        label="Goal diff / game"
                        value={noGames ? '–' : signed(profile.goalDiffPerGame, 2)}
                        color={profile.goalDiffPerGame > 0 ? colors.positive : profile.goalDiffPerGame < 0 ? colors.negative : undefined}
                        sub={`${model.row.goalFor ?? 0} GF · ${model.row.goalAgainst ?? 0} GA`}
                    />
                </View>
            </Section>

            {me && line != null ? (
                <Section title="Playoff race" info={INFO.race}>
                    <View>
                        <T variant="heading" color={me.cushion >= 0 ? colors.positive : colors.negative}>
                            {Math.abs(me.cushion) < 0.5
                                ? 'Right on the projected cut line'
                                : `${num(Math.abs(me.cushion))} pts ${me.cushion > 0 ? 'above' : 'below'} the projected line`}
                        </T>
                        <T variant="caption" muted>
                            Projected {ordinal(model.projRank)} of {model.confSize} in the {model.confName}
                        </T>
                        <RaceBar hi={profile.projectedHi} projected={profile.projected} line={line} color={color}/>
                        {race ? <T variant="body" style={styles.mt12}>{race}</T> : null}
                    </View>
                </Section>
            ) : null}

            {strength ? (
                <Section title="Team strength" info={INFO.strength}>
                    <View style={styles.gap16}>
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
                    </View>
                </Section>
            ) : null}

            {luck ? (
                <Section title="Luck check (PDO)" info={INFO.pdo}>
                    <View style={styles.grid}>
                        <StatTile style={styles.tile} label="Shooting %" value={pct(luck.shootingPct, 1)} sub="League avg ≈ 10%"/>
                        <StatTile style={styles.tile} label="Save %" value={pct(luck.savePct, 1)} sub="League avg ≈ 90%"/>
                    </View>
                    <View style={[styles.divider, {backgroundColor: colors.text}]}/>
                    <View>
                        <Row style={styles.between}>
                            <T variant="label">PDO</T>
                            <T variant="stat" color={pdoTone(luck.pdo, colors)}>{num(luck.pdo)}</T>
                        </Row>
                        <T variant="body" muted style={styles.mt8}>{pdoNote(luck.pdo, early)}</T>
                    </View>
                </Section>
            ) : null}

            <T variant="caption" muted style={styles.footer}>All projections are estimates from this season’s standings.</T>
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
    pad: {paddingHorizontal: GUTTER},
    flex: {flex: 1},
    between: {justifyContent: 'space-between'},
    mt4: {marginTop: 4},
    mt8: {marginTop: 8},
    mt12: {marginTop: 12},
    mt24: {marginTop: 24},
    gap16: {gap: 16},
    predCard: {},
    pressed: {opacity: 0.6},
    tile: {backgroundColor: 'transparent', padding: 0, borderRadius: 0},
    bigRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14, marginBottom: 12},
    bigNum: {fontFamily: 'Sora_600SemiBold', fontSize: 44, lineHeight: 50, fontVariant: ['tabular-nums']},
    tabular: {fontVariant: ['tabular-nums']},
    semi: {fontFamily: 'Sora_600SemiBold'},
    splitLabels: {justifyContent: 'space-between', marginTop: 8},
    centerText: {alignItems: 'center'},
    rightText: {alignItems: 'flex-end'},
    divider: {height: 2, opacity: 0.2, marginVertical: 10},
    scoreHead: {marginTop: 14, marginBottom: 8},
    scoreChip: {flex: 1, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 15, alignItems: 'center'},
    grid: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 20},
    raceWrap: {marginTop: 16},
    raceTrack: {height: 10, borderRadius: 5, overflow: 'hidden'},
    raceSeg: {position: 'absolute', top: 0, bottom: 0},
    raceCut: {position: 'absolute', top: 0, bottom: 0, width: 3},
    raceLabels: {height: 22, justifyContent: 'center'},
    racePin: {position: 'absolute', width: RACE_LABEL_W},
    footer: {marginTop: 20},
});
