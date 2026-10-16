import {useScrollToTop} from '@react-navigation/native';
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View} from 'react-native';
import {nhl} from '../api/nhl';
import {Close, People, SearchNormal1, Shield} from '../components/icons';
import {EmptyState, ErrorState, Header, InfoTip, PillTabs, Screen, T, UnderlineTabs, tap} from '../components/ui';
import {useLeague} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {ROUTES} from '../navigation/routes';
import SeasonPicker from './players/SeasonPicker';
import {GUTTER, useAppTheme} from '../theme';
import {currentSeasonId, previousSeasonId, REGULAR_SEASON_GAMES, seasonLabel} from '../utils/season';
import {
    compactColumns,
    dedupeRows,
    leagueGamesPlayed,
    rankRows,
    searchItems,
    SORTS,
} from './players/helpers';
import {
    CompactHeader,
    LeaderboardRow,
    LeaderboardSkeleton,
    ROW_HEIGHT,
} from './players/LeaderboardRow';
import {searchPlayers} from './players/search';

const KIND_TABS = [
    {key: 'skaters', label: 'Skaters', icon: People},
    {key: 'goalies', label: 'Goalies', icon: Shield},
];
const PAGE = 50;
const FIRST_PAGE = {skaters: 50, goalies: 100};
const MAX_ROWS = 500;
const SEARCH_DEBOUNCE = 300;
const EMPTY_MORE = {key: null, rows: [], done: false};
const QUALIFY_SHARE = 0.3; // rate stats need 30% of team games (close to the NHL's own qualifiers)

const SORT_INFO = {
    pointsPerGame: 'Points per game played. Only players who have appeared in at least the qualifying number of games are ranked, so a hot two-game call-up can’t top the list.',
    timeOnIcePerGame: 'Average minutes on the ice per game — a good read on how much the coach trusts a player. Qualified players only.',
    savePct: 'Share of shots on goal the goalie stopped. Qualified goalies only; save % swings a lot over small samples.',
    goalsAgainstAverage: 'Goals allowed per 60 minutes. Lower is better. It depends heavily on the defence in front of the goalie. Qualified goalies only.',
    gsaa: 'Goals Saved Above Average: goals this goalie prevented compared with a league-average goalie (≈.902 save %) facing the same number of shots. It ignores shot quality, so it’s an estimate.',
};

const keyExtractor = (item) => String(item.row.playerId);
const SEASON_COUNT = 10;
const compactLayout = (_, index) => ({length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index});

const SearchBox = memo(function SearchBox({value, onChange, placeholder, busy}) {
    const {colors, fonts} = useAppTheme();
    return (
        <View style={[styles.search, {backgroundColor: colors.card}]}>
            <SearchNormal1 size={20} color={colors.textSecondary}/>
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
                accessibilityLabel={placeholder}
                style={[styles.searchInput, {color: colors.text, fontFamily: fonts.medium}]}
            />
            {busy ? <ActivityIndicator size="small" color={colors.textSecondary}/> : null}
            {value ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={13} onPress={() => onChange('')}>
                    <Close size={20} color={colors.textSecondary}/>
                </Pressable>
            ) : null}
        </View>
    );
});

const ListFooter = memo(function ListFooter({loadingMore, canLoadMore, onLoadMore, searching, loadedCount, error}) {
    const {colors} = useAppTheme();
    if (loadingMore) return <ActivityIndicator style={styles.footer} color={colors.textSecondary}/>;
    if (!canLoadMore) return <View style={styles.footerSpace}/>;
    return (
        <View style={styles.footer}>
            {searching ? <T variant="caption" muted style={styles.center}>Searching the top {loadedCount}. Load more to search further.</T> : null}
            {error ? <T variant="caption" muted style={styles.center}>Couldn’t load more players.</T> : null}
            <Pressable
                accessibilityRole="button"
                onPress={() => {
                    tap();
                    onLoadMore();
                }}
                style={({pressed}) => [styles.more, {backgroundColor: colors.card}, pressed && {opacity: 0.6}]}>
                <T variant="body" style={styles.semibold}>{error ? 'Try again' : `Load ${PAGE} more`}</T>
            </Pressable>
        </View>
    );
});

export default function PlayersScreen({navigation}) {
    const {colors} = useAppTheme();
    const listRef = useRef(null);
    useScrollToTop(listRef);

    const current = currentSeasonId();
    // Newest first: this season and the nine before it.
    const seasons = useMemo(() => {
        const out = [current];
        while (out.length < SEASON_COUNT) out.push(previousSeasonId(out[out.length - 1]));
        return out;
    }, [current]);

    const [kind, setKindRaw] = useState('skaters');
    const [seasonId, setSeasonId] = useState(current);
    const [sortKey, setSortKey] = useState('points');
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');

    const setKind = useCallback((k) => {
        setKindRaw(k);
        setSortKey(SORTS[k][0].key);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE);
        return () => clearTimeout(t);
    }, [query]);

    const sort = SORTS[kind].find((s) => s.key === sortKey) ?? SORTS[kind][0];
    const direction = sort.direction ?? 'DESC';

    // Qualifying games for rate stats, from how far the season has gone.
    const {standings} = useLeague();
    const teamGames = seasonId === current ? leagueGamesPlayed(standings) : REGULAR_SEASON_GAMES;
    const minGames = sort.rate ? Math.max(1, Math.ceil(teamGames * QUALIFY_SHARE)) : 1;
    const baseKey = `${kind}|${seasonId}|${sort.server}|${direction}|${minGames}`;

    /* ---------------------------------------------------- first page */
    const q = useQuery(async ({force}) => {
        const fetcher = kind === 'skaters' ? nhl.skaters : nhl.goalies;
        const limit = FIRST_PAGE[kind];
        const res = await fetcher({seasonId, sortBy: sort.server, direction, start: 0, limit, minGames}, {force});
        const rows = Array.isArray(res?.data) ? res.data : [];
        return {key: baseKey, kind, seasonId, rows, full: rows.length >= limit};
    }, [baseKey]);
    // Stale data from another sort is fine (re-sorted locally); another kind/season is not.
    const data = q.data && q.data.kind === kind && q.data.seasonId === seasonId ? q.data : null;

    /* ------------------------------------------------ further pages */
    const [more, setMore] = useState(EMPTY_MORE);
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreError, setMoreError] = useState(false);
    const keyRef = useRef(baseKey);
    keyRef.current = baseKey;
    const busyRef = useRef(false);
    const moreRows = more.key === baseKey && data?.key === baseKey ? more.rows : EMPTY_MORE.rows;
    const loaded = useMemo(() => (data ? dedupeRows(data.rows, moreRows) : []), [data, moreRows]);
    const canLoadMore = !!data && data.key === baseKey && data.full && !(more.key === baseKey && more.done) &&
        loaded.length < MAX_ROWS;

    const loadMore = useCallback(async () => {
        if (busyRef.current || !data || data.key !== baseKey) return;
        busyRef.current = true;
        setLoadingMore(true);
        setMoreError(false);
        const key = baseKey;
        try {
            const fetcher = kind === 'skaters' ? nhl.skaters : nhl.goalies;
            const start = data.rows.length + moreRows.length;
            const res = await fetcher({seasonId, sortBy: sort.server, direction, start, limit: PAGE, minGames});
            const rows = Array.isArray(res?.data) ? res.data : [];
            if (keyRef.current === key) {
                setMore((prev) => ({
                    key,
                    rows: prev.key === key ? [...prev.rows, ...rows] : rows,
                    done: rows.length < PAGE,
                }));
            }
        } catch {
            if (keyRef.current === key) setMoreError(true);
        } finally {
            busyRef.current = false;
            setLoadingMore(false);
        }
    }, [data, baseKey, kind, seasonId, sort.server, direction, minGames, moreRows]);

    const refresh = useCallback(() => {
        setMore(EMPTY_MORE);
        setMoreError(false);
        q.refresh();
    }, [q.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

    /* -------------------------------------------------------- search */
    const searchOn = debounced.length >= 2;
    const sq = useQuery(async ({force}) => {
        try {
            return {key: `${kind}|${seasonId}|${debounced}`, rows: await searchPlayers(kind, debounced, {seasonId, force})};
        } catch {
            return {key: `${kind}|${seasonId}|${debounced}`, rows: null}; // fall back to client filtering
        }
    }, [kind, seasonId, debounced], {enabled: searchOn, keepPreviousData: false});
    const serverRows = searchOn && sq.data?.key === `${kind}|${seasonId}|${debounced}` ? sq.data.rows : null;
    const searching = !!query.trim();
    const searchPending = searching && (query.trim() !== debounced || (searchOn && sq.loading));

    /* ---------------------------------------------------------- rows */
    const ranked = useMemo(() => rankRows(loaded, kind, sort.key, minGames), [loaded, kind, sort.key, minGames]);
    const items = useMemo(
        () => (searching ? searchItems(ranked, serverRows, kind, sort.key, query) : ranked),
        [searching, ranked, serverRows, kind, sort.key, query],
    );
    const compactCols = useMemo(() => compactColumns(kind, sort.key), [kind, sort.key]);

    const openPlayer = useCallback((row, name) => {
        navigation.navigate(ROUTES.player, {playerId: row.playerId, name});
    }, [navigation]);

    const renderCompact = useCallback(({item}) => (
        <LeaderboardRow item={item} columns={compactCols} sortKey={sort.key} seasonId={seasonId} onPress={openPlayer}/>
    ), [compactCols, sort.key, seasonId, openPlayer]);

    // With server search results the list is complete, so paging only matters for plain browsing
    // or the client-side fallback.
    const serverSearchActive = searching && serverRows != null;
    const footer = (
        <ListFooter
            loadingMore={loadingMore}
            canLoadMore={canLoadMore && !serverSearchActive}
            onLoadMore={loadMore}
            searching={searching}
            loadedCount={loaded.length}
            error={moreError}
        />
    );
    const empty = !data ? null : searchPending ? (
        <ActivityIndicator style={styles.footer} color={colors.textSecondary}/>
    ) : (
        <EmptyState
            title={searching ? 'No matches' : 'No stats yet'}
            message={searching
                ? `No ${kind} named “${query.trim()}” have played in ${seasonLabel(seasonId)}.`
                : `There are no ${kind} stats for ${seasonLabel(seasonId)} yet. Try the previous season.`}
        />
    );

    const listProps = {
        ref: listRef,
        style: styles.flex,
        data: items,
        keyExtractor,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'on-drag',
        refreshControl: <RefreshControl refreshing={q.refreshing} onRefresh={refresh} tintColor={colors.textSecondary} colors={[colors.textSecondary]}/>,
        ListFooterComponent: footer,
        ListEmptyComponent: empty,
        initialNumToRender: 14,
        maxToRenderPerBatch: 20,
        windowSize: 9,
        removeClippedSubviews: true,
    };

    let body;
    if (!data && q.error) {
        body = <ErrorState message="Couldn’t load the leaderboard." onRetry={refresh}/>;
    } else if (!data) {
        body = <LeaderboardSkeleton/>;
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
                right={<SeasonPicker seasons={seasons} value={seasonId} onChange={setSeasonId}/>}
            />
            <UnderlineTabs tabs={KIND_TABS} value={kind} onChange={setKind}/>
            <View style={styles.controls}>
                <SearchBox value={query} onChange={setQuery} placeholder={`Search all ${kind}`} busy={searchPending}/>
            </View>
            <PillTabs tabs={sortTabs} value={sort.key} onChange={setSortKey} style={styles.sortTabs}/>
            <View style={styles.note}>
                <T variant="caption" muted numberOfLines={1} style={styles.flexShrink}>
                    {sort.rate ? `Qualified players only (${minGames}+ GP)` : `Sorted by ${sort.label}`}
                    {direction === 'ASC' ? ' · lowest first' : ''}
                </T>
                {info ? <InfoTip title={sort.label} body={info} size={14}/> : null}
            </View>
            {body}
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    flexShrink: {flexShrink: 1},
    center: {textAlign: 'center'},
    semibold: {fontFamily: 'Sora_600SemiBold'},
    controls: {paddingHorizontal: GUTTER, paddingTop: 10, gap: 10},
    search: {flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, paddingHorizontal: 20, height: 52},
    searchInput: {flex: 1, fontSize: 16, paddingVertical: 0, height: 52},
    sortTabs: {marginTop: 10},
    note: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 6, minHeight: 34},
    footer: {paddingVertical: 20, alignItems: 'center', gap: 10, paddingHorizontal: GUTTER},
    footerSpace: {height: 32},
    more: {paddingHorizontal: 20, paddingVertical: 15, minHeight: 44, justifyContent: 'center', borderRadius: 100},
});
