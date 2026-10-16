import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import {headshotUrl} from '../../api/nhl';
import {EmptyState, ErrorState, Headshot, Segmented, Skeleton, T} from '../../components/ui';
import LinesView from '../fan/LinesView';
import {GUTTER, useAppTheme} from '../../theme';
import {loc} from '../../utils/format';
import {playerName, rosterGroups} from './data';

const CARD_W = 120;
const CARD_GAP = 0;
const SIDE = GUTTER;
const keyExtractor = (p, i) => String(p?.id ?? i);
// Fixed-width cards: offsets include the leading padding and the gap after each card.
const getItemLayout = (_, index) => ({length: CARD_W + CARD_GAP, offset: SIDE + (CARD_W + CARD_GAP) * index, index});

const PlayerCard = memo(function PlayerCard({player, abbrev, onPress}) {
    const {colors} = useAppTheme();
    const uri = player?.headshot ?? (player?.id ? headshotUrl(player.id, abbrev) : undefined);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={playerName(player)}
            onPress={() => onPress(player)}
            style={({pressed}) => [styles.card, pressed && styles.pressed]}>
            <Headshot uri={uri} size={80} borderColor={colors.text} style={[styles.headshot, {backgroundColor: colors.card}]}/>
            <T variant="title" style={styles.num}>{player?.sweaterNumber != null ? `#${player.sweaterNumber}` : '–'}</T>
            <T variant="caption" muted numberOfLines={1} style={styles.first}>{loc(player?.firstName)}</T>
            <T variant="body" numberOfLines={1} style={styles.semi}>{loc(player?.lastName)}</T>
            <T variant="caption" muted>{player?.positionCode ?? ' '}</T>
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
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowContent}
            initialNumToRender={4}
            windowSize={5}
        />
    );
});

const VIEWS = [{key: 'lines', label: 'Lines'}, {key: 'roster', label: 'Roster'}];

/** Roster tab: projected lines (default) or the full roster by position. */
function RosterTab({lines, onOpenPlayerId, ...rest}) {
    const [view, setView] = useState('lines');
    return (
        <View>
            <Segmented options={VIEWS} value={view} onChange={setView} style={styles.switcher}/>
            {view === 'lines' ? (
                <View style={styles.pad}>
                    <LinesView lines={lines?.data} team={rest.abbrev} loading={lines?.loading} error={lines?.error} onRetry={lines?.refresh} onPlayer={onOpenPlayerId}/>
                </View>
            ) : <Roster {...rest}/>}
        </View>
    );
}

function Roster({abbrev, roster, loading, error, onRetry, onOpenPlayer}) {
    const groups = useMemo(() => rosterGroups(roster), [roster]);

    if (loading && !roster) {
        return (
            <View style={styles.pad}>
                {[0, 1, 2].map((i) => (
                    <View key={i} style={styles.skelBlock}>
                        <Skeleton width={120} height={20} radius={15}/>
                        <View style={styles.skelRow}>
                            {[0, 1, 2].map((j) => <Skeleton key={j} width={80} height={80} radius={40} style={styles.skelHead}/>)}
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
                    <T variant="body" style={[styles.groupTitle, styles.semi]}>
                        {g.title} <T variant="body" muted style={styles.semi}>{g.players.length}</T>
                    </T>
                    <RosterRow players={g.players} abbrev={abbrev} onOpenPlayer={onOpenPlayer}/>
                </View>
            ) : null))}
        </View>
    );
}

export default memo(RosterTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: GUTTER},
    switcher: {marginHorizontal: GUTTER, marginBottom: 4},
    semi: {fontFamily: 'Sora_600SemiBold'},
    section: {marginTop: 20},
    groupTitle: {paddingHorizontal: GUTTER, marginBottom: 10},
    rowContent: {paddingHorizontal: SIDE, gap: CARD_GAP},
    card: {width: CARD_W, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center'},
    headshot: {borderWidth: 3},
    pressed: {opacity: 0.7, transform: [{scale: 0.97}]},
    num: {marginTop: 10},
    first: {marginTop: 2},
    skelBlock: {marginTop: 20, gap: 10},
    skelRow: {flexDirection: 'row', gap: 40},
    skelHead: {marginLeft: 20},
});
