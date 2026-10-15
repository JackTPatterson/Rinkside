import {useScrollToTop} from '@react-navigation/native';
import React, {memo, useCallback, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {nhl} from '../api/nhl';
import {CloseCircle, People, RowVertical, SearchNormal1, Shield} from '../components/icons';
import {EmptyState, ErrorState, Header, InfoTip, PillTabs, Screen, Segmented, SkeletonList, T, tap} from '../components/ui';
import {useLeague} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {ROUTES} from '../navigation/routes';
import {useAppTheme} from '../theme';
import {currentSeasonId, previousSeasonId, REGULAR_SEASON_GAMES, seasonLabel} from '../utils/season';
import {
    compactColumns,
    GOALIE_COLUMNS,
    leagueGamesPlayed,
    prepareRows,
    SKATER_COLUMNS,
    SORTS,
} from './players/helpers';
import {
    CompactHeader,
    LeaderboardRow,
    ROW_HEIGHT,
    TABLE_NAME_WIDTH,
    TABLE_ROW_HEIGHT,
    TableHeader,
    TableRow,
} from './players/LeaderboardRow';

const KIND_TABS = [
    {key: 'skaters', label: 'Skaters', icon: People},
    {key: 'goalies', label: 'Goalies', icon: Shield},
];
const PAGE = 50;
const FIRST_PAGE = {skaters: 50, goalies: 100};
const MAX_LIMIT = 500;
const QUALIFY_SHARE = 0.3; // rate stats need 30% of team games (close to the NHL's own qualifiers)

const SORT_INFO = {
    pointsPerGame: 'Points per game played. Only players who have appeared in at least the qualifying number of games are ranked, so a hot two-game call-up can’t top the list.',
    timeOnIcePerGame: 'Average minutes on the ice per game — a good read on how much the coach trusts a player. Qualified players only.',
    savePct: 'Share of shots on goal the goalie stopped. Qualified goalies only; save % swings a lot over small samples.',
    goalsAgainstAverage: 'Goals allowed per 60 minutes. Lower is better. It depends heavily on the defence in front of the goalie. Qualified goalies only.',
    gsaa: 'Goals Saved Above Average: goals this goalie prevented compared with a league-average goalie (≈.902 save %) facing the same number of shots. It ignores shot quality, so it’s an estimate.',
};

const keyExtractor = (item) => String(item.row.playerId);
const compactLayout = (_, index) => ({length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index});
const tableLayout = (_, index) => ({length: TABLE_ROW_HEIGHT, offset: TABLE_ROW_HEIGHT * index, index});

const SearchBox = memo(function SearchBox({value, onChange, placeholder}) {
    const {colors, fonts} = useAppTheme();
    return (
        <View style={[styles.search, {backgroundColor: colors.card}]}>
            <SearchNormal1 size={18} color={colors.textSecondary}/>
            <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
                clearButtonMode="never"
                maxFontSizeMultiplier={1.3}
                style={[styles.searchInput, {color: colors.text, fontFamily: fonts.medium}]}
            />
            {value ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChange('')}>
                    <CloseCircle size={18} color={colors.textSecondary}/>
                </Pressable>
            ) : null}
        </View>
    );
});

const ListFooter = memo(function ListFooter({loadingMore, canLoadMore, onLoadMore, searching, loadedCount}) {
    const {colors} = useAppTheme();
    if (loadingMore) return <ActivityIndicator style={styles.footer} color={colors.textSecondary}/>;
    if (!canLoadMore) return <View style={styles.footerSpace}/>;
    return (
        <View style={styles.footer}>
            {searching ? <T variant="caption" muted style={styles.center}>Searching the top {loadedCount}. Load more to search further.</T> : null}
            <Pressable
                accessibilityRole="button"
                onPress={() => {
                    tap();
                    onLoadMore();
                }}
                style={({pressed}) => [styles.more, {backgroundColor: colors.card}, pressed && {opacity: 0.6}]}>
                <T variant="label">Load {PAGE} more</T>
            </Pressable>
        </View>
    );
});

export default function PlayersScreen({navigation}) {
    const {colors} = useAppTheme();
    const listRef = useRef(null);
    useScrollToTop(listRef);

    const current = currentSeasonId();
    const seasons = useMemo(() => [
        {key: current, label: seasonLabel(current)},
        {key: previousSeasonId(current), label: seasonLabel(previousSeasonId(current))},
    ], [current]);

    const [kind, setKindRaw] = useState('skaters');
    const [seasonId, setSeasonRaw] = useState(current);
    const [sortKey, setSortRaw] = useState('points');
    const [limit, setLimit] = useState(FIRST_PAGE.skaters);
    const [query, setQuery] = useState('');
    const [table, setTable] = useState(false);

    const setKind = useCallback((k) => {
        setKindRaw(k);
        setSortRaw(SORTS[k][0].key);
        setLimit(FIRST_PAGE[k]);
    }, []);
    const setSeason = useCallback((s) => {
        setSeasonRaw(s);
        setLimit(FIRST_PAGE[kind]);
    }, [kind]);

    const sort = SORTS[kind].find((s) => s.key === sortKey) ?? SORTS[kind][0];

    // Qualifying games for rate stats, from how far the season has gone.
    const {standings} = useLeague();
    const teamGames = seasonId === current ? leagueGamesPlayed(standings) : REGULAR_SEASON_GAMES;
    const minGames = sort.rate ? Math.max(1, Math.ceil(teamGames * QUALIFY_SHARE)) : 1;

    const q = useQuery(async ({force}) => {
        const fetcher = kind === 'skaters' ? nhl.skaters : nhl.goalies;
        const res = await fetcher({seasonId, sortBy: sort.server, limit, minGames}, {force});
        return {kind, seasonId, limit, rows: Array.isArray(res?.data) ? res.data : []};
    }, [kind, seasonId, sort.server, limit, minGames]);

    const data = q.data && q.data.kind === kind && q.data.seasonId === seasonId ? q.data : null;
    const items = useMemo(
        () => (data ? prepareRows(data.rows, kind, sort.key, query, minGames) : []),
        [data, kind, sort.key, query, minGames],
    );
    const compactCols = useMemo(() => compactColumns(kind, sort.key), [kind, sort.key]);
    const allCols = kind === 'skaters' ? SKATER_COLUMNS : GOALIE_COLUMNS;
    const tableWidth = useMemo(
        () => 32 + TABLE_NAME_WIDTH + allCols.reduce((a, c) => a + c.width + 8, 0),
        [allCols],
    );

    const loadingMore = !!data && data.limit < limit && !q.error;
    const canLoadMore = !!data && data.rows.length >= data.limit && limit < MAX_LIMIT;
    const loadMore = useCallback(() => setLimit((l) => Math.min(MAX_LIMIT, l + PAGE)), []);

    const openPlayer = useCallback((row, name) => {
        navigation.navigate(ROUTES.player, {playerId: row.playerId, name});
    }, [navigation]);

    const renderCompact = useCallback(({item}) => (
        <LeaderboardRow item={item} columns={compactCols} sortKey={sort.key} seasonId={seasonId} onPress={openPlayer}/>
    ), [compactCols, sort.key, seasonId, openPlayer]);
    const renderTable = useCallback(({item}) => (
        <TableRow item={item} columns={allCols} sortKey={sort.key} onPress={openPlayer}/>
    ), [allCols, sort.key, openPlayer]);

    const refreshControl = (
        <RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.textSecondary}/>
    );
    const footer = (
        <ListFooter
            loadingMore={loadingMore}
            canLoadMore={canLoadMore}
            onLoadMore={loadMore}
            searching={!!query.trim()}
            loadedCount={data?.rows.length ?? 0}
        />
    );
    const empty = data ? (
        <EmptyState
            title={query.trim() ? 'No matches' : 'No stats yet'}
            message={query.trim()
                ? `Nobody in the loaded list matches “${query.trim()}”.`
                : `There are no ${kind} stats for ${seasonLabel(seasonId)} yet. Try the previous season.`}
        />
    ) : null;

    const listProps = {
        ref: listRef,
        style: styles.flex,
        data: items,
        keyExtractor,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'on-drag',
        refreshControl,
        ListFooterComponent: footer,
        ListEmptyComponent: empty,
        initialNumToRender: 14,
        maxToRenderPerBatch: 20,
        windowSize: 9,
        removeClippedSubviews: true,
    };

    let body;
    if (!data && q.error) {
        body = <ErrorState message="Couldn’t load the leaderboard." onRetry={q.refresh}/>;
    } else if (!data) {
        body = <SkeletonList count={8} height={56} style={styles.skeleton}/>;
    } else if (table) {
        body = (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
                <View style={[styles.flex, {width: tableWidth}]}>
                    <TableHeader columns={allCols} sortKey={sort.key}/>
                    <FlatList {...listProps} renderItem={renderTable} getItemLayout={tableLayout}/>
                </View>
            </ScrollView>
        );
    } else {
        body = (
            <View style={styles.flex}>
                <CompactHeader columns={compactCols} sortKey={sort.key}/>
                <FlatList {...listProps} renderItem={renderCompact} getItemLayout={compactLayout}/>
            </View>
        );
    }

    const sortTabs = useMemo(() => SORTS[kind].map((s) => ({key: s.key, label: s.label})), [kind]);
    const info = SORT_INFO[sort.key];

    return (
        <Screen>
            <Header
                title="Players"
                subtitle={`Regular season ${seasonLabel(seasonId)}`}
                right={(
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={table ? 'Show compact list' : 'Show all stat columns'}
                        accessibilityState={{selected: table}}
                        hitSlop={8}
                        onPress={() => {
                            tap();
                            setTable((t) => !t);
                        }}
                        style={[styles.iconBtn, {backgroundColor: table ? colors.text : colors.card}]}>
                        <RowVertical size={20} color={table ? colors.background : colors.text}/>
                    </Pressable>
                )}
            />
            <PillTabs tabs={KIND_TABS} value={kind} onChange={setKind}/>
            <View style={styles.controls}>
                <Segmented options={seasons} value={seasonId} onChange={setSeason}/>
                <SearchBox value={query} onChange={setQuery} placeholder={`Search ${kind}`}/>
            </View>
            <PillTabs tabs={sortTabs} value={sort.key} onChange={setSortRaw} style={styles.sortTabs}/>
            {sort.rate || info ? (
                <View style={styles.note}>
                    <T variant="caption" muted style={styles.flex}>
                        {sort.rate ? `Qualified players only (${minGames}+ GP)` : `Sorted by ${sort.label}`}
                    </T>
                    {info ? <InfoTip title={sort.label} body={info} size={14}/> : null}
                </View>
            ) : <View style={styles.noteSpacer}/>}
            {body}
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    center: {textAlign: 'center'},
    controls: {paddingHorizontal: 16, paddingTop: 12, gap: 10},
    search: {flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 42},
    searchInput: {flex: 1, fontSize: 15, paddingVertical: 0},
    sortTabs: {marginTop: 12},
    note: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4},
    noteSpacer: {height: 8},
    skeleton: {paddingHorizontal: 16, paddingTop: 12},
    footer: {paddingVertical: 20, alignItems: 'center', gap: 10},
    footerSpace: {height: 32},
    more: {paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999},
    iconBtn: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
});
