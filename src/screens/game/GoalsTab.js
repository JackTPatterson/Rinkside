import React, {memo, useCallback, useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Card, EmptyState, FadeInView, Headshot, InfoTip, Row, T, TeamLogo, tap} from '../../components/ui';
import {CloseCircle, Play, User} from '../../components/icons';
import {useAppTheme} from '../../theme';
import {num, pct, periodLabel} from '../../utils/format';
import {LinkPill, openLink, WPABadge} from './common';
import {HalfRink} from './Rink';
import {findGoalPlay, shotTypeLabel} from './model';

const WPA_INFO = 'Win Probability Added: how much this goal changed the scoring team’s chance of winning, according to Rinkside’s model estimate. A tie-breaking goal late in the 3rd is worth far more than a fourth goal in a blowout.';

const GoalCard = memo(function GoalCard({goal, index, home, away, onPress, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    const color = teamColor(goal.team);
    const details = [shotTypeLabel(goal.shotType), goal.timeInPeriod, goal.strength && goal.strength !== 'EV' ? goal.strength : null, goal.modifier || null]
        .filter(Boolean)
        .join(' · ');
    return (
        <Card onPress={() => onPress(goal, index)} accessibilityLabel={`${goal.team} goal by ${goal.name}`} style={styles.goalCard}>
            <View style={[styles.accent, {backgroundColor: color}]}/>
            <Row gap={12} style={{alignItems: 'flex-start'}}>
                <Pressable hitSlop={6} onPress={() => onPlayer(goal.playerId)} accessibilityRole="button" accessibilityLabel={goal.name}>
                    <Headshot uri={goal.headshot} size={52} borderColor={color}/>
                </Pressable>
                <View style={{flex: 1, gap: 2}}>
                    <Row style={{justifyContent: 'space-between', alignItems: 'flex-start'}}>
                        <T variant="label" numberOfLines={1} style={{flex: 1}}>
                            {goal.name}{goal.goalsToDate != null ? ` (${goal.goalsToDate})` : ''}
                        </T>
                        <WPABadge wpa={goal.wpa} color={color}/>
                    </Row>
                    <T variant="caption" muted numberOfLines={2}>
                        {goal.assists.length ? goal.assists.map((a) => `${a.name}${a.toDate != null ? ` (${a.toDate})` : ''}`).join(', ') : 'Unassisted'}
                    </T>
                    <T variant="caption" muted numberOfLines={1}>{details}</T>
                </View>
            </Row>
            <Row style={{justifyContent: 'space-between', marginTop: 10}}>
                <Row gap={6}>
                    <TeamLogo abbrev={home} size={18}/>
                    <T variant="label" style={{opacity: goal.isHome ? 1 : 0.55}}>{goal.homeScore}</T>
                    <T variant="caption" muted>–</T>
                    <T variant="label" style={{opacity: goal.isHome ? 0.55 : 1}}>{goal.awayScore}</T>
                    <TeamLogo abbrev={away} size={18}/>
                </Row>
                {goal.clip ? (
                    <LinkPill icon={Play} label="Clip" onPress={() => openLink(goal.clip)}/>
                ) : <View style={{height: 1}}/>}
            </Row>
            {Number.isFinite(goal.wpBefore) ? (
                <View style={[styles.wpTrack, {backgroundColor: colors.cardAlt}]}>
                    <View style={[styles.wpFill, {width: `${goal.wpBefore * 100}%`, backgroundColor: color, opacity: 0.35}]}/>
                    <View style={[styles.wpFill, {left: `${goal.wpBefore * 100}%`, width: `${Math.max(0, goal.wpa) * 100}%`, backgroundColor: color}]}/>
                </View>
            ) : null}
        </Card>
    );
});

function GoalSheet({goal, index, pbp, xgShots, header, onClose, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    const insets = useSafeAreaInsets();
    const play = useMemo(() => (goal ? findGoalPlay(pbp, goal, index) : null), [pbp, goal, index]);
    const shot = useMemo(() => (play ? xgShots?.find((s) => s.eventId === play.eventId) : null), [xgShots, play]);
    if (!goal) return null;
    const color = teamColor(goal.team);
    const x = Number(play?.details?.xCoord);
    const y = Number(play?.details?.yCoord);
    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={[styles.backdrop, {backgroundColor: colors.overlay}]} onPress={onClose}>
                <View
                    onStartShouldSetResponder={() => true}
                    style={[styles.sheet, {backgroundColor: colors.background, paddingBottom: insets.bottom + 16}]}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Row style={{justifyContent: 'space-between', marginBottom: 12}}>
                            <Row gap={8}>
                                <TeamLogo abbrev={goal.team} size={28}/>
                                <T variant="heading">{goal.team} goal</T>
                            </Row>
                            <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                                <CloseCircle size={24} color={colors.textSecondary}/>
                            </Pressable>
                        </Row>
                        <Row gap={12} style={{marginBottom: 14}}>
                            <Headshot uri={goal.headshot} size={60} borderColor={color}/>
                            <View style={{flex: 1}}>
                                <T variant="title" numberOfLines={1} adjustsFontSizeToFit>{goal.name}</T>
                                <T variant="caption" muted>
                                    {periodLabel(goal.period, goal.periodType)} · {goal.timeInPeriod} · {shotTypeLabel(goal.shotType) || 'Shot'}{goal.strength ? ` · ${goal.strength}` : ''}
                                </T>
                            </View>
                        </Row>
                        <HalfRink x={x} y={y} color={color} width={230}/>
                        <View style={styles.statRow}>
                            <View style={[styles.statBox, {backgroundColor: colors.card}]}>
                                <Row gap={4}>
                                    <T variant="caption" muted>Shot xG</T>
                                    <InfoTip size={13} title="Shot xG" body="Rinkside’s model estimate of how often a shot like this (same distance, angle, type and situation) becomes a goal."/>
                                </Row>
                                <T variant="stat">{shot ? num(shot.xg, 2) : '–'}</T>
                                <T variant="caption" muted>{shot ? `Scores ~${pct(shot.xg)} of the time` : 'No location data'}</T>
                            </View>
                            <View style={[styles.statBox, {backgroundColor: colors.card}]}>
                                <Row gap={4}>
                                    <T variant="caption" muted>Win prob.</T>
                                    <InfoTip size={13} title="Win Probability Added" body={WPA_INFO}/>
                                </Row>
                                <T variant="stat" color={color}>{Number.isFinite(goal.wpa) ? `${goal.wpa >= 0 ? '+' : ''}${Math.round(goal.wpa * 100)}%` : '–'}</T>
                                <T variant="caption" muted>
                                    {Number.isFinite(goal.wpBefore) ? `${pct(goal.wpBefore)} → ${pct(goal.wpAfter)} for ${goal.team}` : 'Model loading'}
                                </T>
                            </View>
                        </View>
                        {goal.assists.length ? (
                            <T variant="body" muted style={{marginTop: 12}}>
                                Assists: {goal.assists.map((a) => a.name).join(', ')}
                            </T>
                        ) : null}
                        <Row gap={8} style={{marginTop: 16, flexWrap: 'wrap'}}>
                            {goal.clip ? <LinkPill icon={Play} label="Watch clip" onPress={() => openLink(goal.clip)}/> : null}
                            {goal.playerId ? (
                                <LinkPill
                                    icon={User}
                                    label="Player page"
                                    onPress={() => {
                                        onClose();
                                        onPlayer(goal.playerId);
                                    }}
                                />
                            ) : null}
                        </Row>
                        <T variant="caption" muted style={{marginTop: 12}}>{header.away.abbrev} {goal.awayScore} – {goal.homeScore} {header.home.abbrev} after this goal</T>
                    </ScrollView>
                </View>
            </Pressable>
        </Modal>
    );
}

/** Scoring summary, grouped by period, with Win Probability Added per goal and a goal detail sheet. */
function GoalsTab({goals, shootout, header, pbp, xgShots, onPlayer}) {
    const [selected, setSelected] = useState(null);
    const open = useCallback((goal, index) => {
        tap();
        setSelected({goal, index});
    }, []);
    const close = useCallback(() => setSelected(null), []);

    const groups = useMemo(() => {
        const out = [];
        goals.forEach((g, i) => {
            const label = periodLabel(g.period, g.periodType);
            let grp = out[out.length - 1];
            if (!grp || grp.key !== label) {
                grp = {label: g.period <= 3 ? `${label} period` : label === 'OT' ? 'Overtime' : label, items: []};
                grp.key = label;
                out.push(grp);
            }
            grp.items.push({goal: g, index: i});
        });
        return out;
    }, [goals]);

    if (!goals.length && !shootout.length) {
        return <EmptyState title="No goals yet" message={header.live ? 'Goals will appear here as they’re scored.' : 'This one finished scoreless.'}/>;
    }

    return (
        <View>
            <Row gap={4} style={{marginBottom: 4}}>
                <T variant="caption" muted style={{flex: 1}}>Tap a goal for its location, shot quality and win-probability swing.</T>
                <InfoTip size={14} title="Win Probability Added (WP)" body={WPA_INFO}/>
            </Row>
            {groups.map((grp, gi) => (
                <FadeInView key={grp.key} delay={gi * 40}>
                    <T variant="heading" style={styles.periodHeader}>{grp.label}</T>
                    <View style={{gap: 10}}>
                        {grp.items.map(({goal, index}) => (
                            <GoalCard key={goal.key} goal={goal} index={index} home={header.home.abbrev} away={header.away.abbrev} onPress={open} onPlayer={onPlayer}/>
                        ))}
                    </View>
                </FadeInView>
            ))}
            {shootout.length ? (
                <FadeInView>
                    <T variant="heading" style={styles.periodHeader}>Shootout</T>
                    <Card style={{gap: 10}}>
                        {shootout.map((s) => (
                            <Row key={s.key} style={{justifyContent: 'space-between'}}>
                                <Row gap={8} style={{flex: 1}}>
                                    <TeamLogo abbrev={s.team} size={20}/>
                                    <T variant="body" numberOfLines={1} style={{flex: 1}}>{s.name}</T>
                                </Row>
                                <T variant="label" muted={s.result !== 'goal'}>{s.result === 'goal' ? 'Goal' : 'No goal'}</T>
                            </Row>
                        ))}
                    </Card>
                </FadeInView>
            ) : null}
            {selected ? (
                <GoalSheet
                    goal={selected.goal}
                    index={selected.index}
                    pbp={pbp}
                    xgShots={xgShots}
                    header={header}
                    onClose={close}
                    onPlayer={onPlayer}
                />
            ) : null}
        </View>
    );
}

export default memo(GoalsTab);

const styles = StyleSheet.create({
    periodHeader: {marginTop: 18, marginBottom: 10},
    goalCard: {overflow: 'hidden', paddingLeft: 18},
    accent: {position: 'absolute', left: 0, top: 0, bottom: 0, width: 5},
    wpTrack: {height: 4, borderRadius: 4, marginTop: 12, overflow: 'hidden'},
    wpFill: {position: 'absolute', top: 0, bottom: 0},
    backdrop: {flex: 1, justifyContent: 'flex-end'},
    sheet: {borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%'},
    statRow: {flexDirection: 'row', gap: 10, marginTop: 16},
    statBox: {flex: 1, borderRadius: 16, padding: 12, gap: 2},
});
