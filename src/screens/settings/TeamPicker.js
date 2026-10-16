import React, {memo, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {Close, SearchNormal1, TickCircle} from '../../components/icons';
import {EmptyState, T, TeamLogo, tap} from '../../components/ui';
import TEAMS from '../../data/teams';
import {GUTTER, useAppTheme, withAlpha} from '../../theme';

// Alphabetical by full name (Montréal sorts under M).
export const SORTED_TEAMS = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name, 'en'));

const CONFERENCES = [
    {title: 'Eastern', divisions: ['Atlantic', 'Metropolitan']},
    {title: 'Western', divisions: ['Central', 'Pacific']},
];
const TWO_WORD = new Set(['Red', 'Blue', 'Maple', 'Golden']);

/** "Detroit Red Wings" → "Red Wings", "St. Louis Blues" → "Blues". */
export function nickname(name) {
    const w = String(name).split(' ');
    return w.length > 2 && TWO_WORD.has(w[w.length - 2]) ? w.slice(-2).join(' ') : w[w.length - 1];
}

// Case-, accent- and punctuation-insensitive ("st louis" finds "St. Louis", "montreal" finds "Montréal").
const fold = (s) => String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '');

const matches = (team, q) => !q || fold(team.name).includes(q) || team.abbrev.toLowerCase().startsWith(q);

/** Grid tile: logo, abbrev and nickname; the selected team is tinted in its own colour with a tick. */
const TeamTile = memo(function TeamTile({team, selected, onSelect}) {
    const {colors, teamColor} = useAppTheme();
    const color = teamColor(team.abbrev);
    return (
        <View style={styles.cell}>
            <Pressable
                accessibilityRole="radio"
                accessibilityLabel={team.name}
                accessibilityState={{selected, checked: selected}}
                onPress={() => {
                    tap();
                    onSelect(team.abbrev);
                }}
                style={({pressed}) => [styles.tile, selected && {backgroundColor: withAlpha(color, 0.16)}, pressed && styles.pressed]}>
                <TeamLogo abbrev={team.abbrev} size={44}/>
                <T variant="body" color={selected ? color : colors.text} style={styles.abbrev}>{team.abbrev}</T>
                <T variant="caption" muted numberOfLines={1} adjustsFontSizeToFit style={styles.nick}>{nickname(team.name)}</T>
                {selected ? (
                    <View style={styles.tick}>
                        <TickCircle size={18} color={color} variant="Bold"/>
                    </View>
                ) : null}
            </Pressable>
        </View>
    );
});

/** The selected team, shown above the search field. */
function CurrentTeam({abbrev, label}) {
    const {teamColor} = useAppTheme();
    const team = TEAMS.find((t) => t.abbrev === abbrev);
    if (!team) return null;
    const color = teamColor(abbrev);
    return (
        <View style={[styles.current, {backgroundColor: withAlpha(color, 0.14)}]}>
            <TeamLogo abbrev={abbrev} size={52}/>
            <View style={styles.flex}>
                <T variant="caption" color={color} style={styles.semi}>{label}</T>
                <T variant="body" numberOfLines={1} adjustsFontSizeToFit style={styles.currentName}>{team.name}</T>
                <T variant="caption" muted>{team.division} · {team.conference}</T>
            </View>
        </View>
    );
}

/**
 * Every team as a logo grid grouped by conference and division (the whole league fits on about one
 * screen), with the selected team on top and a search field that stays pinned while scrolling.
 * Used by the My Team switcher sheet, the Favourite Team page and onboarding (`showCurrent={false}`).
 */
function TeamPicker({selected, onSelect, bottomInset = 0, header, currentLabel = 'Your team', showCurrent = true}) {
    const {colors} = useAppTheme();
    const [query, setQuery] = useState('');
    const q = fold(query.trim());
    const groups = useMemo(() => CONFERENCES.map((c) => ({
        title: c.title,
        divisions: c.divisions
            .map((d) => ({title: d, teams: SORTED_TEAMS.filter((t) => t.division === d && matches(t, q))}))
            .filter((d) => d.teams.length),
    })).filter((c) => c.divisions.length), [q]);

    // Off in onboarding: a banner appearing on the first tap would shove the grid under the finger.
    const hasCurrent = showCurrent && TEAMS.some((t) => t.abbrev === selected);
    const searchIndex = (header ? 1 : 0) + (hasCurrent ? 1 : 0);

    return (
        <ScrollView
            style={styles.flex}
            alwaysBounceVertical={false}
            contentContainerStyle={[styles.list, {paddingBottom: 24 + bottomInset}]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={[searchIndex]}>
            {header ? <View style={styles.headerSlot}>{header}</View> : null}
            {hasCurrent ? <CurrentTeam abbrev={selected} label={currentLabel}/> : null}
            <View style={[styles.searchWrap, {backgroundColor: colors.background}]}>
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
                            <Close size={18} color={colors.textSecondary}/>
                        </Pressable>
                    ) : null}
                </View>
            </View>
            <View>
                {groups.length ? groups.map((c) => (
                    <View key={c.title} style={styles.conference}>
                        <T variant="title" style={styles.confTitle}>{c.title}</T>
                        {c.divisions.map((d) => (
                            <View key={d.title} style={styles.division}>
                                <T variant="caption" muted style={styles.divTitle}>{d.title.toUpperCase()}</T>
                                <View style={styles.grid}>
                                    {d.teams.map((t) => <TeamTile key={t.abbrev} team={t} selected={t.abbrev === selected} onSelect={onSelect}/>)}
                                </View>
                            </View>
                        ))}
                    </View>
                )) : (
                    <EmptyState title="No teams found" message={`Nothing matches “${query.trim()}”.`} style={styles.empty}/>
                )}
            </View>
        </ScrollView>
    );
}

export default memo(TeamPicker);

const styles = StyleSheet.create({
    flex: {flex: 1},
    semi: {fontFamily: 'Sora_600SemiBold'},
    pressed: {opacity: 0.6},
    list: {paddingHorizontal: GUTTER},
    headerSlot: {marginHorizontal: -GUTTER},
    current: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 15, marginTop: 4},
    currentName: {fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26},
    searchWrap: {paddingVertical: 10},
    search: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, borderRadius: 100, height: 44},
    input: {flex: 1, fontSize: 16, paddingVertical: 0, height: 44},
    conference: {marginTop: 10},
    confTitle: {paddingHorizontal: 5, marginBottom: 4},
    division: {marginTop: 10},
    divTitle: {paddingHorizontal: 5, marginBottom: 6, letterSpacing: 0.8, fontFamily: 'Sora_600SemiBold'},
    grid: {flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2},
    cell: {width: '25%', padding: 2},
    tile: {alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 15, minHeight: 44},
    abbrev: {fontFamily: 'Sora_600SemiBold', marginTop: 4},
    nick: {textAlign: 'center', alignSelf: 'stretch'},
    tick: {position: 'absolute', top: 6, right: 6},
    empty: {marginTop: 40},
});
