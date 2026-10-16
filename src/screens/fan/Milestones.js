import React, {memo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {TickCircle} from '../../components/icons';
import {Headshot, Section, T} from '../../components/ui';
import {headshotUrl} from '../../api/nhl';
import {useAppTheme} from '../../theme';

const MAX_PIPS = 6;

/** One player row: headshot, name and what it's about, with the key number on the right. */
const ItemRow = memo(function ItemRow({item, showTeam, value, caption, sub, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    const color = teamColor(item.team);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${sub}`}
            onPress={() => onPlayer?.(item.playerId)}
            style={({pressed}) => [styles.row, pressed && styles.pressed]}>
            <Headshot uri={item.headshot ?? headshotUrl(item.playerId, item.team)} size={40} borderColor={color}/>
            <View style={styles.flex}>
                <T variant="body" numberOfLines={1} style={styles.name}>{item.name}</T>
                <T variant="caption" muted numberOfLines={1}>{showTeam ? `${item.team} · ` : ''}{sub}</T>
            </View>
            <View style={styles.valueCol}>
                {value == null
                    ? <TickCircle size={26} color={color} variant="Bold"/>
                    : <T variant="body" color={colors.text} style={styles.value}>{value}</T>}
                <T variant="caption" muted>{caption}</T>
            </View>
        </Pressable>
    );
});

/**
 * Milestone row: headshot, name, how close they are (team-coloured "3 goals to go" over a pip track,
 * one pip per game-sized step, filled as they close in), and the mark itself big on the right.
 */
const MilestoneRow = memo(function MilestoneRow({item, showTeam, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    const color = teamColor(item.team);
    const pips = Math.min(MAX_PIPS, item.window ?? MAX_PIPS);
    const filled = item.reached ? pips : Math.max(0, pips - item.remaining);
    const status = item.reached ? 'Reached last game' : `${item.remaining} ${item.unit} to go`;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.target} ${item.label}, ${status}`}
            onPress={() => onPlayer?.(item.playerId)}
            style={({pressed}) => [styles.mRow, pressed && styles.pressed]}>
            <Headshot uri={item.headshot ?? headshotUrl(item.playerId, item.team)} size={48} borderColor={color}/>
            <View style={styles.flex}>
                <T variant="body" numberOfLines={1} style={styles.name}>{item.name}</T>
                <View style={styles.statusRow}>
                    {item.reached ? <TickCircle size={14} color={color} variant="Bold"/> : null}
                    <T variant="caption" color={color} numberOfLines={1} style={styles.semi}>
                        {showTeam ? `${item.team} · ` : ''}{status}
                    </T>
                </View>
                <View style={styles.pips}>
                    {Array.from({length: pips}).map((_, i) => (
                        <View key={i} style={[styles.pip, {backgroundColor: i < filled ? color : colors.card}]}/>
                    ))}
                </View>
            </View>
            <View style={styles.target}>
                <T variant="body" style={styles.targetValue}>{item.target}</T>
                <T variant="caption" muted numberOfLines={1}>{item.label}</T>
            </View>
        </Pressable>
    );
});

/**
 * "Milestone watch" and "Hot streaks" sections. data: fetchTeamMilestones() output, or a list of
 * them (both teams in a pregame), merged and re-sorted. Renders nothing when there's nothing to show.
 */
function Milestones({data, onPlayer, limit = 6}) {
    const list = (Array.isArray(data) ? data : [data]).filter(Boolean);
    const showTeam = list.length > 1;
    const milestones = list.flatMap((d) => d.milestones)
        .sort((a, b) => (b.reached - a.reached) || ((a.closeness ?? 0) - (b.closeness ?? 0)))
        .slice(0, limit);
    const streaks = list.flatMap((d) => d.streaks).sort((a, b) => b.length - a.length).slice(0, limit);
    return (
        <>
            {milestones.length ? (
                <Section title="Milestone watch">
                    <View style={styles.list}>
                        {milestones.map((m) => <MilestoneRow key={m.key} item={m} showTeam={showTeam} onPlayer={onPlayer}/>)}
                    </View>
                </Section>
            ) : null}
            {streaks.length ? (
                <Section title="Hot streaks">
                    <View style={styles.list}>
                        {streaks.map((s) => (
                            <ItemRow
                                key={s.key}
                                item={s}
                                showTeam={showTeam}
                                onPlayer={onPlayer}
                                sub={[s.label, s.detail].filter(Boolean).join(' · ')}
                                value={String(s.length)}
                                caption={s.label === 'Win streak' ? 'starts' : 'games'}
                            />
                        ))}
                    </View>
                </Section>
            ) : null}
        </>
    );
}

export default memo(Milestones);

const styles = StyleSheet.create({
    flex: {flex: 1},
    list: {gap: 4},
    row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6},
    pressed: {opacity: 0.6},
    name: {fontFamily: 'Sora_600SemiBold'},
    semi: {fontFamily: 'Sora_600SemiBold'},
    mRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8},
    statusRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1},
    pips: {flexDirection: 'row', gap: 3, marginTop: 6},
    pip: {width: 16, height: 5, borderRadius: 3},
    target: {alignItems: 'flex-end', maxWidth: 110},
    targetValue: {fontFamily: 'Sora_600SemiBold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums']},
    valueCol: {alignItems: 'flex-end', minWidth: 52},
    value: {fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums']},
});
