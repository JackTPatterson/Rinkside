import React, {memo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Headshot, Row, T, TeamLogo} from '../../components/ui';
import {readableOn, useAppTheme, withAlpha} from '../../theme';
import {type} from './common';
import {shotTypeLabel} from './model';

const MIN_SLOTS = 3; // a shootout is best-of-three before sudden death
const DOT = 16;

const resultLabel = (r) => (r === 'goal' ? 'Goal' : r === 'save' ? 'Saved' : r ? String(r).charAt(0).toUpperCase() + String(r).slice(1) : 'No goal');

/** One attempt marker: filled = scored, ring = missed, faint = not taken (decided before their turn). */
function Dot({state, color}) {
    const {colors} = useAppTheme();
    if (state === 'goal') return <View style={[styles.dot, {backgroundColor: color}]}/>;
    if (state === 'miss') return <View style={[styles.dot, styles.ring, {borderColor: withAlpha(color, 0.55)}]}/>;
    return <View style={[styles.dot, {backgroundColor: colors.card}]}/>;
}

/** Team line of the tally board: logo, abbrev, one dot per round, shootout goals. */
function TallyRow({abbrev, attempts, rounds, winner}) {
    const {teamColor} = useAppTheme();
    const color = teamColor(abbrev);
    const goals = attempts.filter((a) => a.result === 'goal').length;
    return (
        <Row gap={10} style={styles.tallyRow}>
            <TeamLogo abbrev={abbrev} size={24}/>
            <T variant="body" style={[type.name, styles.tallyAbbrev]}>{abbrev}</T>
            <Row gap={6} style={styles.dots}>
                {Array.from({length: rounds}).map((_, i) => (
                    <Dot key={i} color={color} state={attempts[i] ? (attempts[i].result === 'goal' ? 'goal' : 'miss') : 'empty'}/>
                ))}
            </Row>
            <T variant="body" style={[type.pie, styles.semi, styles.tallyScore, !winner && styles.dim]}>{goals}</T>
        </Row>
    );
}

/** One attempt in the round-by-round list. */
const AttemptRow = memo(function AttemptRow({attempt, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    const color = teamColor(attempt.team);
    const scored = attempt.result === 'goal';
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${attempt.name}, ${resultLabel(attempt.result)}`}
            disabled={!attempt.playerId}
            onPress={() => onPlayer?.(attempt.playerId)}
            style={({pressed}) => [styles.attempt, pressed && styles.pressed]}>
            <Headshot uri={attempt.headshot} size={36} borderColor={color} style={styles.ring2}/>
            <View style={styles.flex}>
                <T variant="body" numberOfLines={1} style={type.name}>{attempt.name}</T>
                <T variant="body" numberOfLines={1} style={type.sub}>
                    {attempt.team}{attempt.shotType ? ` • ${shotTypeLabel(attempt.shotType)}` : ''}
                </T>
            </View>
            <View style={styles.resultCol}>
                {attempt.gameWinner ? (
                    <View style={[styles.winner, {backgroundColor: color}]}>
                        <T variant="caption" color={readableOn(color)} style={styles.semi}>Winner</T>
                    </View>
                ) : (
                    <T variant="body" color={scored ? color : colors.textSecondary} style={styles.semi}>{resultLabel(attempt.result)}</T>
                )}
                {attempt.homeScore != null && attempt.awayScore != null ? (
                    <T variant="caption" muted style={styles.tabular}>{attempt.homeScore}–{attempt.awayScore}</T>
                ) : null}
            </View>
        </Pressable>
    );
});

/**
 * Shootout: a broadcast-style tally board (each team's attempts as dots, SO goals at the right) and
 * the attempts grouped by round, with the winning goal highlighted.
 * attempts: extractShootout() output, in shooting order. home / away: abbrevs.
 */
function Shootout({attempts, home, away, onPlayer}) {
    const {colors} = useAppTheme();
    const by = (abbrev) => attempts.filter((a) => a.team === abbrev);
    const h = by(home);
    const a = by(away);
    const rounds = Math.max(MIN_SLOTS, h.length, a.length);
    const hGoals = h.filter((x) => x.result === 'goal').length;
    const aGoals = a.filter((x) => x.result === 'goal').length;

    // Round n = each team's nth attempt, in shooting order.
    const seen = {};
    const byRound = [];
    for (const at of attempts) {
        const n = (seen[at.team] = (seen[at.team] ?? 0) + 1);
        (byRound[n - 1] ??= []).push(at);
    }

    return (
        <View style={styles.wrap}>
            <T variant="body" style={[type.name, styles.center, styles.title]}>Shootout</T>
            <View>
                <TallyRow abbrev={home} attempts={h} rounds={rounds} winner={hGoals > aGoals}/>
                <View style={[styles.boardDivider, {backgroundColor: colors.text}]}/>
                <TallyRow abbrev={away} attempts={a} rounds={rounds} winner={aGoals > hGoals}/>
            </View>
            {byRound.map((list, i) => (
                <View key={i} style={styles.round}>
                    <T variant="caption" muted style={styles.roundTitle}>{i < MIN_SLOTS ? `ROUND ${i + 1}` : `ROUND ${i + 1} · SUDDEN DEATH`}</T>
                    {list.map((at) => <AttemptRow key={at.key} attempt={at} onPlayer={onPlayer}/>)}
                </View>
            ))}
        </View>
    );
}

export default memo(Shootout);

const styles = StyleSheet.create({
    wrap: {marginTop: 16},
    title: {marginBottom: 4},
    center: {textAlign: 'center'},
    flex: {flex: 1},
    semi: {fontFamily: 'Sora_600SemiBold'},
    tabular: {fontVariant: ['tabular-nums']},
    dim: {opacity: 0.45},
    pressed: {opacity: 0.6},
    boardDivider: {height: 2, opacity: 0.2},
    tallyRow: {paddingVertical: 5},
    tallyAbbrev: {width: 44},
    dots: {flex: 1, flexWrap: 'wrap'},
    dot: {width: DOT, height: DOT, borderRadius: DOT / 2},
    ring: {borderWidth: 2},
    tallyScore: {minWidth: 24, textAlign: 'right'},
    round: {marginTop: 10},
    roundTitle: {fontFamily: 'Sora_600SemiBold', letterSpacing: 0.8, marginBottom: 2},
    attempt: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5},
    ring2: {borderWidth: 2},
    resultCol: {alignItems: 'flex-end'},
    winner: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100},
});
