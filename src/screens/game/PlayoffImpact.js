import React, {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {ArrowDownRight, ArrowUpRight} from '../../components/icons';
import {Row, T, TeamLogo} from '../../components/ui';
import {useAppTheme, withAlpha} from '../../theme';
import {pct} from '../../utils/format';
import {Divider, SectionTitle, type} from './common';
import {playoffStakes} from './model';

const INFO = 'The rest of the season is simulated thousands of times. These are each team’s odds right now, and after each possible result tonight: a win or loss in regulation, or in overtime / a shootout.';

const STAGE = {
    'make the playoffs': 'Playoff odds',
    'reach round 2': 'Round 2 odds',
    'reach the conference final': 'Conf. final odds',
    'reach the Final': 'Final odds',
    'win the Cup': 'Cup odds',
};

const OUTCOMES = [
    ['winReg', 'Reg. win'],
    ['winOT', 'OT win'],
    ['lossOT', 'OT loss'],
    ['lossReg', 'Reg. loss'],
];

const clamp = (v) => Math.max(0, Math.min(1, v ?? 0));

/**
 * Odds track: the whole 0–100% scale, the range tonight's result can move the team to (loss → win)
 * in a light team tint, and a marker where they stand now.
 */
function Track({now, lo, hi, color}) {
    const {colors} = useAppTheme();
    const l = clamp(Math.min(lo, hi));
    const w = clamp(Math.max(lo, hi)) - l;
    return (
        <View style={[styles.track, {backgroundColor: colors.card}]}>
            <View style={[styles.band, {left: `${l * 100}%`, width: `${w * 100}%`, backgroundColor: withAlpha(color, 0.35)}]}/>
            <View style={[styles.marker, {left: `${clamp(now) * 100}%`, backgroundColor: color}]}/>
        </View>
    );
}

/** One team: logo, odds now, the track, and all four results with their change. */
function TeamStakes({abbrev, s, bigger}) {
    const {colors, teamColor} = useAppTheme();
    const color = teamColor(abbrev);
    return (
        <View style={styles.team}>
            <Row gap={10}>
                <TeamLogo abbrev={abbrev} size={26}/>
                <T variant="body" style={type.name}>{abbrev}</T>
                {bigger ? (
                    <View style={[styles.tag, {backgroundColor: withAlpha(color, 0.16)}]}>
                        <T variant="caption" color={color} style={styles.semi}>Bigger game</T>
                    </View>
                ) : null}
                <View style={styles.flex}/>
                <T variant="caption" muted>Now</T>
                <T variant="body" style={type.pie}>{pct(s.now)}</T>
            </Row>
            <Track now={s.now} lo={s.lossReg} hi={s.winReg} color={color}/>
            <Row gap={0} style={styles.outcomes}>
                {OUTCOMES.map(([k, label]) => {
                    const d = s[k] - s.now;
                    const tone = Math.abs(d) < 0.005 ? colors.textSecondary : d > 0 ? colors.positive : colors.negative;
                    return (
                        <View key={k} style={styles.outcome}>
                            <T variant="caption" muted numberOfLines={1}>{label}</T>
                            <T variant="body" style={type.value}>{pct(s[k])}</T>
                            <Row gap={2}>
                                {Math.abs(d) >= 0.005 ? (d > 0 ? <ArrowUpRight size={12} color={tone}/> : <ArrowDownRight size={12} color={tone}/>) : null}
                                <T variant="caption" color={tone} style={styles.tabular}>{Math.abs(Math.round(d * 100))}</T>
                            </Row>
                        </View>
                    );
                })}
            </Row>
        </View>
    );
}

/** Season simulations: where each team stands, and how far tonight's result can move them. */
function PlayoffImpact({sims, header}) {
    const {home, away} = header;
    const stakes = useMemo(() => playoffStakes(sims, home.abbrev, away.abbrev), [sims, home.abbrev, away.abbrev]);
    if (!stakes) return null;
    const {home: h, away: a} = stakes;
    // The team with more riding on tonight (bigger regulation win-vs-loss swing) gets a "Bigger game" tag.
    const gap = Math.abs(h.swing) - Math.abs(a.swing);
    const biggerFor = Math.abs(gap) >= 0.01 ? (gap > 0 ? home.abbrev : away.abbrev) : null;
    return (
        <View>
            <Divider style={{marginTop: 20}}/>
            <SectionTitle title={`What’s at Stake · ${STAGE[stakes.label] ?? 'Odds'}`} info={INFO}/>
            <TeamStakes abbrev={home.abbrev} s={h} bigger={biggerFor === home.abbrev}/>
            <TeamStakes abbrev={away.abbrev} s={a} bigger={biggerFor === away.abbrev}/>
        </View>
    );
}

export default memo(PlayoffImpact);

const styles = StyleSheet.create({
    flex: {flex: 1},
    center: {textAlign: 'center'},
    tabular: {fontVariant: ['tabular-nums']},
    team: {marginTop: 16},
    track: {height: 10, borderRadius: 5, marginTop: 10, overflow: 'hidden'},
    band: {position: 'absolute', top: 0, bottom: 0},
    marker: {position: 'absolute', top: 0, bottom: 0, width: 4, marginLeft: -2, borderRadius: 2},
    outcomes: {marginTop: 10, alignItems: 'flex-start'},
    outcome: {flex: 1, alignItems: 'center'},
    semi: {fontFamily: 'Sora_600SemiBold'},
    tag: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100},
});
