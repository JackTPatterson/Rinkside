import React, {memo, useCallback, useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, TextInput, View} from 'react-native';
import {CloseCircle, SearchNormal1, TickCircle} from '../../components/icons';
import {EmptyState, T, TeamLogo, tap} from '../../components/ui';
import TEAMS from '../../data/teams';
import {useAppTheme, withAlpha} from '../../theme';

// Alphabetical by full name (Montréal sorts under M).
export const SORTED_TEAMS = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name, 'en'));

const ROW_HEIGHT = 64;
const ROW_GAP = 8;
const ITEM = ROW_HEIGHT + ROW_GAP;

// Case-, accent- and punctuation-insensitive ("st louis" finds "St. Louis", "montreal" finds "Montréal").
const fold = (s) => String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '');

function matches(team, q) {
    if (!q) return true;
    return fold(team.name).includes(q) || team.abbrev.toLowerCase().startsWith(q);
}

const TeamRow = memo(function TeamRow({team, selected, onSelect}) {
    const {colors, teamColor} = useAppTheme();
    const accent = teamColor(team.abbrev);
    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityState={{selected, checked: selected}}
            accessibilityLabel={team.name}
            onPress={() => {
                tap();
                onSelect(team.abbrev);
            }}
            style={({pressed}) => [
                styles.row,
                {
                    backgroundColor: selected ? withAlpha(accent, 0.1) : colors.card,
                    borderColor: selected ? accent : 'transparent',
                },
                pressed && styles.pressed,
            ]}>
            <TeamLogo abbrev={team.abbrev} size={32}/>
            <View style={styles.rowText}>
                <T variant="body" numberOfLines={1}>{team.name}</T>
                <T variant="caption" muted numberOfLines={1}>{team.division} · {team.abbrev}</T>
            </View>
            {selected ? <TickCircle size={24} color={accent} variant="Bold"/> : <View style={styles.tickSpace}/>}
        </Pressable>
    );
});

const getItemLayout = (_, index) => ({length: ITEM, offset: ITEM * index, index});
const keyExtractor = (t) => t.abbrev;
const Separator = () => <View style={{height: ROW_GAP}}/>;

/**
 * Searchable list of the 32 teams. The search field sits above the list (not in the list header)
 * so item offsets stay exact and the list can open scrolled to the current team.
 */
export default function TeamPicker({selected, onSelect, bottomInset = 0, header}) {
    const {colors} = useAppTheme();
    const [query, setQuery] = useState('');
    const q = fold(query.trim());
    const data = useMemo(() => SORTED_TEAMS.filter((t) => matches(t, q)), [q]);

    // Open with the current team in view (only meaningful on the unfiltered list).
    const [initialIndex] = useState(() => {
        const i = SORTED_TEAMS.findIndex((t) => t.abbrev === selected);
        return i > 3 ? i - 2 : 0;
    });

    const renderItem = useCallback(
        ({item}) => <TeamRow team={item} selected={item.abbrev === selected} onSelect={onSelect}/>,
        [selected, onSelect],
    );

    return (
        <View style={styles.flex}>
            {header}
            <View style={[styles.search, {backgroundColor: colors.card}]}>
                <SearchNormal1 size={18} color={colors.textSecondary}/>
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search teams"
                    placeholderTextColor={colors.textSecondary}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    clearButtonMode="never"
                    accessibilityLabel="Search teams"
                    maxFontSizeMultiplier={1.3}
                    style={[styles.input, {color: colors.text, fontFamily: 'Sora_500Medium'}]}
                />
                {query ? (
                    <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                        <CloseCircle size={18} color={colors.textSecondary}/>
                    </Pressable>
                ) : null}
            </View>
            <FlatList
                data={data}
                extraData={selected}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialScrollIndex={initialIndex || undefined}
                ItemSeparatorComponent={Separator}
                ListEmptyComponent={<EmptyState title="No teams found" message={`Nothing matches “${query.trim()}”.`}/>}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                initialNumToRender={12}
                windowSize={7}
                contentContainerStyle={[styles.list, {paddingBottom: 24 + bottomInset}]}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        height: 44,
    },
    input: {flex: 1, fontSize: 15, paddingVertical: 0},
    list: {paddingHorizontal: 16},
    row: {
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 2,
    },
    rowText: {flex: 1},
    tickSpace: {width: 24},
    pressed: {opacity: 0.75, transform: [{scale: 0.985}]},
});
