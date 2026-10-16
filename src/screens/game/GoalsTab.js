import React, {memo, useCallback, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {EmptyState, Headshot, Row, Sheet, T, fillRadii, tap} from '../../components/ui';
import {ArrowDownRight, ArrowRight, ArrowUpRight, Close, User, Video} from '../../components/icons';
import {useAppTheme, withAlpha} from '../../theme';
import {num, pct, periodLabel} from '../../utils/format';
import {LinkPill, type, useOpenVideo, ValueRow} from './common';
import {HalfRink} from './Rink';
import {findGoalPlay, shotTypeLabel} from './model';
import Shootout from './Shootout';

const WPA_INFO = 'Win Probability Added: how much this goal changed the scoring team’s chance of winning, as estimated. A tie-breaking goal late in the 3rd is worth far more than a fourth goal in a blowout.';

// Shot danger bands (same cut-offs as the xG tab): low < 5%, medium 5–15%, high 15%+. The meter runs to 40%.
const XG_MAX = 0.4;
const BANDS = [[0, 0.05, 'Low'], [0.05, 0.15, 'Medium'], [0.15, XG_MAX, 'High']];

/** Shot xG on a danger meter: three bands (low / medium / high danger) and a marker at this shot. */
function XgMeter({xg, color}) {
    const {colors} = useAppTheme();
    const at = Math.min(1, Math.max(0, xg / XG_MAX));
    const band = BANDS.find(([lo, hi]) => xg >= lo && xg < hi) ?? BANDS[2];
    return (
        <View>
            <View style={styles.meter}>
                {BANDS.map(([lo, hi, label], i) => (
                    <View
                        key={label}
                        style={[styles.meterBand, {
                            // Flex shares must sum to 1, or the layout only fills that fraction of the row.
                            flex: (hi - lo) / XG_MAX,
                            backgroundColor: band[2] === label ? withAlpha(color, 0.35 + 0.3 * i) : colors.card,
                        }, i === 0 && styles.leftEnd, i === BANDS.length - 1 && styles.rightEnd]}
                    />
                ))}
                <View style={[styles.meterMark, {left: `${at * 100}%`, backgroundColor: colors.text, borderColor: colors.background}]}/>
            </View>
            <Row style={styles.meterLabels}>
                {BANDS.map(([lo, hi, label]) => (
                    <T key={label} variant="caption" color={band[2] === label ? colors.text : colors.textSecondary} style={[{flex: (hi - lo) / XG_MAX}, band[2] === label && styles.semi]}>
                        {label}
                    </T>
                ))}
            </Row>
        </View>
    );
}

/** Win probability before the goal (faded) and what it added (solid), with before → after labels. */
function WpaBar({before, after, color}) {
    const {colors} = useAppTheme();
    const b = Math.max(0, Math.min(1, before));
    const a = Math.max(b, Math.min(1, after));
    return (
        <View>
            <View style={[styles.wpBig, {backgroundColor: colors.card}]}>
                <View style={[styles.wpFill, {width: `${b * 100}%`, backgroundColor: withAlpha(color, 0.35)}, styles.leftEnd]}/>
                <View style={[styles.wpFill, {left: `${b * 100}%`, width: `${(a - b) * 100}%`, backgroundColor: color}, a >= 0.999 && styles.rightEnd]}/>
                {b > 0 && a > b ? <View style={[styles.wpDivider, {left: `${b * 100}%`, backgroundColor: colors.background}]}/> : null}
            </View>
            <Row style={styles.meterLabels}>
                <T variant="caption" muted style={styles.flex}>Before {pct(b)}</T>
                <T variant="caption" style={styles.semi}>After {pct(a)}</T>
            </Row>
        </View>
    );
}

/** Small count chip (a player's season total) next to a name; tinted in the team colour for the scorer. */
function CountChip({value, color}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.chip, {backgroundColor: color ? withAlpha(color, 0.18) : colors.card}]}>
            <T variant="caption" color={color ?? colors.textSecondary} style={styles.chipText}>{value}</T>
        </View>
    );
}

/**
 * One goal in the old goal style, laid out as a vertical list row: 80pt headshot with team ring,
 * team + score, "Scorer • goals", assists, "shot • time • strength", WPA and the Clip pill.
 */
const GoalRow = memo(function GoalRow({goal, index, onPress, onPlayer}) {
    const openVideo = useOpenVideo();
    const {colors, teamColor} = useAppTheme();
    const color = teamColor(goal.team);
    const details = [shotTypeLabel(goal.shotType), goal.timeInPeriod, goal.strength && goal.strength !== 'EV' ? goal.strength : null, goal.modifier || null]
        .filter(Boolean)
        .join(' • ');
    const hasWpa = Number.isFinite(goal.wpa);
    const wpAfter = Number.isFinite(goal.wpAfter) ? goal.wpAfter : Number.isFinite(goal.wpBefore) && hasWpa ? goal.wpBefore + goal.wpa : null;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${goal.team} goal by ${goal.name}`}
            onPress={() => onPress(goal, index)}
            style={({pressed}) => [styles.goalRow, pressed && {opacity: 0.6}]}>
            <Row gap={15} style={{alignItems: 'flex-start'}}>
                <Pressable hitSlop={6} onPress={() => onPlayer(goal.playerId)} accessibilityRole="button" accessibilityLabel={goal.name}>
                    <Headshot uri={goal.headshot} size={80} borderColor={color} style={styles.ring}/>
                </Pressable>
                <View style={{flex: 1}}>
                    <Row style={{justifyContent: 'space-between'}}>
                        <Row gap={8}>
                            <T variant="body" style={styles.teamText}>{goal.team}</T>
                            <T variant="body" style={type.sub}>{goal.homeScore} • {goal.awayScore}</T>
                        </Row>
                        {hasWpa ? (
                            <Row gap={3}>
                                {goal.wpa >= 0 ? <ArrowUpRight size={13} color={color}/> : <ArrowDownRight size={13} color={colors.negative}/>}
                                <T variant="body" style={[type.sub, styles.wpaText]}>{Math.abs(Math.round(goal.wpa * 100))}% win chance</T>
                            </Row>
                        ) : null}
                    </Row>
                    {/* Season totals as small chips beside each name (goals for the scorer, assists for the helpers). */}
                    <Row gap={6} style={styles.line}>
                        <T variant="body" numberOfLines={1} style={[type.name, styles.shrink]}>{goal.name}</T>
                        {goal.goalsToDate != null ? <CountChip value={goal.goalsToDate} color={color}/> : null}
                    </Row>
                    {goal.assists.length ? goal.assists.map((a, i) => (
                        <Row key={a.playerId ?? i} gap={6} style={styles.line}>
                            <T variant="body" numberOfLines={1} style={[type.sub, styles.shrink]}>{a.name}</T>
                            {a.toDate != null ? <CountChip value={a.toDate}/> : null}
                        </Row>
                    )) : <T variant="body" style={[type.sub, styles.line]}>Unassisted</T>}
                    {/* Clip shares the shot-details line (right-aligned), so the swing bar sits directly under the details. */}
                    <Row gap={8} style={styles.line}>
                        <T variant="body" numberOfLines={1} style={[type.sub, styles.flex]}>{details}</T>
                        {goal.clip ? (
                            <LinkPill icon={Video} label="Clip" small onPress={() => openVideo(goal.clipId ?? goal.clip, {title: goal.name, webUrl: goal.clip})}/>
                        ) : null}
                    </Row>
                    {Number.isFinite(goal.wpBefore) ? (
                        <Row gap={10} style={styles.wpRow}>
                            <View style={[styles.wpTrack, {backgroundColor: colors.card}]}>
                                {/* Rounded at the origin, flat on the leading edges; a 3pt background divider separates before / added. */}
                                <View style={[styles.wpFill, fillRadii(goal.wpBefore, 3), {width: `${goal.wpBefore * 100}%`, backgroundColor: color, opacity: 0.35}]}/>
                                <View style={[styles.wpFill, fillRadii(goal.wpBefore + Math.max(0, goal.wpa), 3), {borderTopLeftRadius: 0, borderBottomLeftRadius: 0, left: `${goal.wpBefore * 100}%`, width: `${Math.max(0, goal.wpa) * 100}%`, backgroundColor: color}]}/>
                                {goal.wpBefore > 0 && goal.wpa > 0 ? (
                                    <View style={[styles.wpDivider, {left: `${goal.wpBefore * 100}%`, backgroundColor: colors.background}]}/>
                                ) : null}
                            </View>
                            {/* Before → after, so the bar reads without the legend. */}
                            {wpAfter != null ? (
                                <Row gap={4}>
                                    <T variant="caption" muted style={styles.wpLabel}>{pct(goal.wpBefore)}</T>
                                    <ArrowRight size={12} color={colors.textSecondary}/>
                                    <T variant="caption" style={styles.wpLabel}>{pct(wpAfter)}</T>
                                </Row>
                            ) : null}
                        </Row>
                    ) : null}
                </View>
            </Row>
        </Pressable>
    );
});

function GoalSheet({visible, goal, index, pbp, xgShots, header, onClose, onPlayer}) {
    const openVideo = useOpenVideo();
    const {colors, teamColor} = useAppTheme();
    // Clip / player page run only after the sheet has fully closed (opening the browser over a
    // dismissing sheet makes iOS drop it and leaves the app unresponsive).
    const pending = useRef(null);
    const play = useMemo(() => (goal ? findGoalPlay(pbp, goal, index) : null), [pbp, goal, index]);
    const shot = useMemo(() => (play ? xgShots?.find((s) => s.eventId === play.eventId) : null), [xgShots, play]);
    const after = (fn) => {
        pending.current = fn;
        onClose();
    };
    const runPending = () => {
        const fn = pending.current;
        pending.current = null;
        fn?.();
    };
    const color = goal ? teamColor(goal.team) : colors.text;
    const x = Number(play?.details?.xCoord);
    const y = Number(play?.details?.yCoord);
    return (
        <Sheet visible={visible} onClose={onClose} onClosed={runPending} style={styles.sheet}>
            {goal ? (
                <ScrollView showsVerticalScrollIndicator={false} alwaysBounceVertical={false}>
                    <Row style={{justifyContent: 'space-between'}}>
                        <T variant="title">{goal.team} Goal</T>
                        <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                            <Close size={24} color={colors.textSecondary}/>
                        </Pressable>
                    </Row>
                    <T variant="body" numberOfLines={1} adjustsFontSizeToFit style={[styles.sheetName, {marginTop: 20}]}>{goal.name}</T>
                    <T variant="body" style={[type.sub, {marginTop: 4}]}>
                        {periodLabel(goal.period, goal.periodType)} • {goal.timeInPeriod} • {shotTypeLabel(goal.shotType) || 'Shot'}{goal.strength ? ` • ${goal.strength}` : ''}
                    </T>
                    {goal.assists.length ? (
                        <T variant="body" style={[type.sub, {marginTop: 4}]}>Assists: {goal.assists.map((a) => a.name).join(', ')}</T>
                    ) : null}
                    <View style={{marginTop: 20}}>
                        <HalfRink x={x} y={y} color={color} width={230}/>
                    </View>
                    <ValueRow
                        title="Shot xG"
                        info="An estimate of how often a shot like this (same distance, angle, type and situation) becomes a goal."
                        sub={shot ? `Scores ~${pct(shot.xg)} of the time` : 'No location data'}
                        value={shot ? num(shot.xg, 2) : '–'}>
                        {shot ? <XgMeter xg={shot.xg} color={color}/> : null}
                    </ValueRow>
                    <ValueRow
                        title="Win Probability Added"
                        info={WPA_INFO}
                        sub={`For ${goal.team}`}
                        value={Number.isFinite(goal.wpa) ? (
                            <Row gap={4}>
                                {goal.wpa >= 0 ? <ArrowUpRight size={22} color={colors.text}/> : <ArrowDownRight size={22} color={colors.text}/>}
                                <T variant="body" style={type.big}>{Math.abs(Math.round(goal.wpa * 100))}%</T>
                            </Row>
                        ) : '–'}>
                        {Number.isFinite(goal.wpBefore) && Number.isFinite(goal.wpAfter) ? <WpaBar before={goal.wpBefore} after={goal.wpAfter} color={color}/> : null}
                    </ValueRow>
                    <T variant="body" style={[type.sub, {marginTop: 20}]}>{header.away.abbrev} {goal.awayScore} • {goal.homeScore} {header.home.abbrev} after this goal</T>
                    <Row gap={10} style={{marginTop: 20, marginBottom: 16, flexWrap: 'wrap'}}>
                        {goal.clip ? <LinkPill icon={Video} label="Clip" color={color} onPress={() => after(() => openVideo(goal.clipId ?? goal.clip, {title: goal.name, webUrl: goal.clip}))}/> : null}
                        {goal.playerId ? (
                            <LinkPill icon={User} label="Player page" color={colors.text} onPress={() => after(() => onPlayer(goal.playerId))}/>
                        ) : null}
                    </Row>
                </ScrollView>
            ) : null}
        </Sheet>
    );
}

/** Scoring summary, grouped by period, with Win Probability Added per goal and a goal detail sheet. */
function GoalsTab({goals, shootout, header, pbp, xgShots, onPlayer}) {
    const [selected, setSelected] = useState(null);
    const open = useCallback((goal, index) => {
        tap();
        setSelected({goal, index});
        setSheetOpen(true);
    }, []);
    // Keep the last goal rendered while the sheet slides away.
    const [sheetOpen, setSheetOpen] = useState(false);
    const close = useCallback(() => setSheetOpen(false), []);

    if (!goals.length && !shootout.length) {
        return <EmptyState title="No goals yet" message={header.live ? 'Goals will appear here as they’re scored.' : 'This one finished scoreless.'}/>;
    }

    return (
        <View>
            {goals.map((g, i) => {
                const label = periodLabel(g.period, g.periodType);
                const prev = goals[i - 1];
                const isNew = !prev || periodLabel(prev.period, prev.periodType) !== label;
                const title = g.period <= 3 ? `Period ${g.period}` : label === 'OT' ? 'Overtime' : label;
                return (
                    <View key={g.key}>
                        {isNew ? <T variant="body" style={[type.name, styles.center, styles.period, i === 0 && {marginTop: 0}]}>{title}</T> : null}
                        <GoalRow goal={g} index={i} onPress={open} onPlayer={onPlayer}/>
                    </View>
                );
            })}
            {shootout.length ? (
                <Shootout attempts={shootout} home={header.home.abbrev} away={header.away.abbrev} onPlayer={onPlayer}/>
            ) : null}
            {selected ? (
                <GoalSheet
                    visible={sheetOpen}
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
    goalRow: {marginBottom: 20},
    period: {marginTop: 10, marginBottom: 10},
    teamText: {fontFamily: 'Sora_700Bold', fontSize: 16, lineHeight: 22},
    center: {textAlign: 'center'},
    ring: {borderWidth: 3},
    line: {marginTop: 4},
    wpRow: {marginTop: 10},
    semi: {fontFamily: 'Sora_600SemiBold'},
    meter: {flexDirection: 'row', height: 10, gap: 3},
    meterBand: {height: '100%'},
    leftEnd: {borderTopLeftRadius: 5, borderBottomLeftRadius: 5},
    rightEnd: {borderTopRightRadius: 5, borderBottomRightRadius: 5},
    meterMark: {position: 'absolute', top: -4, width: 6, height: 18, borderRadius: 3, marginLeft: -3, borderWidth: 1.5},
    meterLabels: {marginTop: 6},
    wpBig: {height: 10, borderRadius: 5, overflow: 'hidden'},
    shrink: {flexShrink: 1},
    chip: {minWidth: 22, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 100, alignItems: 'center'},
    chipText: {fontFamily: 'Sora_600SemiBold', fontVariant: ['tabular-nums']},
    wpTrack: {flex: 1, height: 8, borderRadius: 4, overflow: 'hidden'},
    wpLabel: {fontFamily: 'Sora_600SemiBold', fontVariant: ['tabular-nums']},
    wpaText: {opacity: 1},
    wpFill: {position: 'absolute', top: 0, bottom: 0},
    wpDivider: {position: 'absolute', top: 0, bottom: 0, width: 3, marginLeft: -1.5},
    sheet: {paddingBottom: 20, paddingHorizontal: 20},
    flex: {flex: 1},
    sheetName: {fontFamily: 'Sora_400Regular', fontSize: 20, lineHeight: 26},
});
