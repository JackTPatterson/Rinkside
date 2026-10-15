import React, {memo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowDown2, Heart} from '../../components/icons';
import {BackButton, Skeleton, T, TeamLogo, tap} from '../../components/ui';
import {getTeam} from '../../data/teams';
import {readableOn, withAlpha} from '../../theme';
import {rankLabel, recordLabel} from './data';

/**
 * Team-coloured header. Tapping the name opens the team switcher.
 * `onBack` shows a back button (team route); `onFavorite` shows "Make favourite".
 */
function TeamHeader({abbrev, row, loading, bg, onPickTeam, onBack, onFavorite, isFavorite}) {
    const fg = readableOn(bg);
    const team = getTeam(abbrev);
    const rank = rankLabel(row);
    const record = recordLabel(row);
    const l10 = row && row.l10Wins != null ? `L10 ${row.l10Wins}-${row.l10Losses ?? 0}-${row.l10OtLosses ?? 0}` : null;
    const streak = row?.streakCode && row?.streakCount ? `${row.streakCode}${row.streakCount} streak` : null;
    const chip = {backgroundColor: withAlpha(fg === '#FFFFFF' ? '#FFFFFF' : '#000000', 0.16)};

    return (
        <View style={[styles.wrap, {backgroundColor: bg}]}>
            {/* fills the pull-to-refresh overscroll area with the team colour */}
            <View pointerEvents="none" style={[styles.overscroll, {backgroundColor: bg}]}/>
            {onBack ? (
                <View style={styles.topRow}>
                    <BackButton onPress={onBack}/>
                    {onFavorite ? (
                        isFavorite ? (
                            <View style={[styles.action, chip]}>
                                <Heart size={16} color={fg} variant="Bold"/>
                                <T variant="caption" color={fg}>Your team</T>
                            </View>
                        ) : (
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => {
                                    tap();
                                    onFavorite();
                                }}
                                style={({pressed}) => [styles.action, chip, pressed && {opacity: 0.6}]}>
                                <Heart size={16} color={fg}/>
                                <T variant="caption" color={fg}>Make favourite</T>
                            </Pressable>
                        )
                    ) : null}
                </View>
            ) : null}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${team?.name ?? abbrev}. Switch team`}
                onPress={() => {
                    tap();
                    onPickTeam();
                }}
                style={({pressed}) => [styles.main, pressed && {opacity: 0.8}]}>
                <TeamLogo abbrev={abbrev} size={48}/>
                <View style={styles.nameCol}>
                    <View style={styles.nameRow}>
                        <T variant="title" color={fg} numberOfLines={1} adjustsFontSizeToFit style={styles.name}>
                            {team?.name ?? abbrev}
                        </T>
                        <ArrowDown2 size={18} color={fg}/>
                    </View>
                    {record ? (
                        <T variant="body" color={fg} style={styles.dim}>
                            {record}
                            {row?.points != null ? `  ·  ${row.points} pts` : ''}
                        </T>
                    ) : loading ? <Skeleton width={110} height={16} style={styles.skel}/> : null}
                </View>
                {rank ? (
                    <View style={styles.rank}>
                        <T variant="title" color={fg}>{rank.big}</T>
                        <T variant="caption" color={fg} style={styles.dim} numberOfLines={1}>{rank.small}</T>
                    </View>
                ) : null}
            </Pressable>
            {l10 || streak ? (
                <View style={styles.chips}>
                    {l10 ? <View style={[styles.chip, chip]}><T variant="caption" color={fg}>{l10}</T></View> : null}
                    {streak ? <View style={[styles.chip, chip]}><T variant="caption" color={fg}>{streak}</T></View> : null}
                </View>
            ) : null}
        </View>
    );
}

export default memo(TeamHeader);

const styles = StyleSheet.create({
    wrap: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24},
    overscroll: {position: 'absolute', left: 0, right: 0, top: -800, height: 800},
    topRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
    action: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999},
    main: {flexDirection: 'row', alignItems: 'center', gap: 10},
    nameCol: {flex: 1},
    nameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
    name: {flexShrink: 1},
    dim: {opacity: 0.8},
    skel: {marginTop: 4, opacity: 0.5},
    rank: {alignItems: 'flex-end', maxWidth: 120},
    chips: {flexDirection: 'row', gap: 8, marginTop: 12},
    chip: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999},
});
