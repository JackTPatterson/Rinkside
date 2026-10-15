import React, {memo, useCallback, useMemo} from 'react';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import {headshotUrl} from '../../api/nhl';
import {EmptyState, ErrorState, Headshot, Skeleton, T} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {playerName, rosterGroups} from './data';

const CARD_W = 116;

const PlayerCard = memo(function PlayerCard({player, abbrev, onPress}) {
    const {colors, teamColor} = useAppTheme();
    const uri = player?.headshot ?? (player?.id ? headshotUrl(player.id, abbrev) : undefined);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={playerName(player)}
            onPress={() => onPress(player)}
            style={({pressed}) => [styles.card, {backgroundColor: colors.card}, pressed && styles.pressed]}>
            <Headshot uri={uri} size={72} borderColor={teamColor(abbrev)}/>
            <T variant="heading" style={styles.num}>{player?.sweaterNumber != null ? `#${player.sweaterNumber}` : '–'}</T>
            <T variant="caption" muted numberOfLines={1}>{player?.firstName?.default ?? ''}</T>
            <T variant="label" numberOfLines={1}>{player?.lastName?.default ?? ''}</T>
            {player?.positionCode ? <T variant="caption" muted>{player.positionCode}</T> : null}
        </Pressable>
    );
});

const RosterRow = memo(function RosterRow({players, abbrev, onOpenPlayer}) {
    const renderItem = useCallback(
        ({item}) => <PlayerCard player={item} abbrev={abbrev} onPress={onOpenPlayer}/>,
        [abbrev, onOpenPlayer],
    );
    return (
        <FlatList
            horizontal
            data={players}
            keyExtractor={(p, i) => String(p?.id ?? i)}
            renderItem={renderItem}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowContent}
            initialNumToRender={4}
            windowSize={5}
        />
    );
});

function RosterTab({abbrev, roster, loading, error, onRetry, onOpenPlayer}) {
    const groups = useMemo(() => rosterGroups(roster), [roster]);

    if (loading && !roster) {
        return (
            <View style={styles.pad}>
                {[0, 1, 2].map((i) => (
                    <View key={i} style={styles.skelBlock}>
                        <Skeleton width={120} height={20}/>
                        <View style={styles.skelRow}>
                            {[0, 1, 2].map((j) => <Skeleton key={j} width={CARD_W} height={170} radius={16}/>)}
                        </View>
                    </View>
                ))}
            </View>
        );
    }
    if (error && !roster) return <ErrorState message="Couldn’t load the roster." onRetry={onRetry}/>;
    if (!groups.some((g) => g.players.length)) return <EmptyState title="No roster available"/>;

    return (
        <View>
            {groups.map((g) => (g.players.length ? (
                <View key={g.key} style={styles.section}>
                    <T variant="heading" style={styles.groupTitle}>
                        {g.title} <T variant="heading" muted>{g.players.length}</T>
                    </T>
                    <RosterRow players={g.players} abbrev={abbrev} onOpenPlayer={onOpenPlayer}/>
                </View>
            ) : null))}
        </View>
    );
}

export default memo(RosterTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: 16},
    section: {marginTop: 16},
    groupTitle: {paddingHorizontal: 16, marginBottom: 10},
    rowContent: {paddingHorizontal: 16, gap: 8},
    card: {width: CARD_W, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center'},
    pressed: {opacity: 0.7, transform: [{scale: 0.97}]},
    num: {marginTop: 8},
    skelBlock: {marginTop: 16, gap: 12},
    skelRow: {flexDirection: 'row', gap: 8},
});
