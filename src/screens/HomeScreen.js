// "My Team" tab and the generic Team page (root-stack ROUTES.team with {abbrev}).
import {useIsFocused, useScrollToTop} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {preGameHomeWinProb} from '../api/moneypuck';
import {isFinal, isLive, nhl} from '../api/nhl';
import {Activity, Calendar, Danger, Lamp, User} from '../components/icons';
import {EmptyState, Screen, T, UnderlineTabs} from '../components/ui';
import {getTeam} from '../data/teams';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {useLeague} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {ROUTES} from '../navigation/routes';
import {GUTTER, readableOn, useAppTheme} from '../theme';
import {isSameDay} from '../utils/format';
import {
    fetchInjuries,
    fetchTeamGames,
    findStandingsRow,
    gameTime,
    nextFromSeason,
    pickHeroGame,
    playerName,
} from './home/data';
import InjuriesTab from './home/InjuriesTab';
import InsightsTab from './home/InsightsTab';
import RosterTab from './home/RosterTab';
import {fetchLines} from '../api/dailyfaceoff';
import {fetchTeamMilestones} from '../api/fan';
import ScheduleTab from './home/ScheduleTab';
import StatsTab from './home/StatsTab';
import TeamHeader from './home/TeamHeader';
import TeamPicker from './home/TeamPicker';

const TABS = [
    {key: 'schedule', label: 'Schedule', icon: Calendar},
    {key: 'insights', label: 'Insights', icon: Lamp},
    {key: 'stats', label: 'Stats', icon: Activity}, // short: five labels share one underline bar
    {key: 'roster', label: 'Roster', icon: User},
    {key: 'injuries', label: 'Injuries', icon: Danger},
];

const STICKY = [1];

export default function HomeScreen({navigation, route}) {
    const {colors, dark, teamColor} = useAppTheme();
    const insets = useSafeAreaInsets();
    const focused = useIsFocused();
    const {team: favorite, setTeam} = useFavoriteTeam() ?? {};
    const isTeamRoute = route?.name === ROUTES.team;
    const abbrev = route?.params?.abbrev ?? favorite ?? null;
    const known = !!getTeam(abbrev);

    const [tab, setTab] = useState('schedule');
    const [seen, setSeen] = useState({schedule: true});
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pastHeader, setPastHeader] = useState(false);
    const pastRef = useRef(false);
    const headerH = useRef(200);
    const scrollRef = useRef(null);
    useScrollToTop(scrollRef);

    const changeTab = useCallback((k) => {
        setTab(k);
        setSeen((s) => (s[k] ? s : {...s, [k]: true}));
    }, []);

    /* ------------------------------------------------------------ data */

    const league = useLeague();
    const row = useMemo(() => findStandingsRow(league.standings, abbrev), [league.standings, abbrev]);

    const [weekPoll, setWeekPoll] = useState(0);
    const week = useQuery(({force}) => nhl.clubWeek(abbrev, {force}), [abbrev], {
        enabled: known,
        keepPreviousData: false,
        refetchInterval: weekPoll,
    });
    const weekGames = week.data?.games;
    const weekHero = useMemo(() => pickHeroGame(weekGames), [weekGames]);

    // Nothing left this week (e.g. a break): look further ahead in the season schedule.
    const season = useQuery(({force}) => nhl.clubSeason(abbrev, {force}), [abbrev], {
        enabled: known && !!week.data && !weekHero,
        keepPreviousData: false,
    });
    const seasonHero = useMemo(() => (weekHero ? null : nextFromSeason(season.data)), [weekHero, season.data]);
    const hero = weekHero ?? seasonHero;

    // Poll the week while a game is live (scores) or about to start today (state flips to LIVE).
    useEffect(() => {
        const live = (weekGames ?? []).some(isLive);
        const start = gameTime(weekHero);
        const today = !!start && isSameDay(start, new Date()) && !isFinal(weekHero);
        setWeekPoll(live ? 30000 : today ? 120000 : 0);
    }, [weekGames, weekHero]);

    const heroId = hero?.id;
    const heroPregame = !!heroId && !isLive(hero) && !isFinal(hero);
    const mpProb = useQuery(() => preGameHomeWinProb(heroId), [heroId], {
        enabled: heroPregame,
        keepPreviousData: false,
    });

    const mp = useQuery(({force}) => fetchTeamGames(abbrev, force), [abbrev], {
        enabled: known && !!seen.stats,
        keepPreviousData: false,
    });
    const roster = useQuery(({force}) => nhl.roster(abbrev, {force}), [abbrev], {
        enabled: known && !!seen.roster,
        keepPreviousData: false,
    });
    const injuries = useQuery(({force}) => fetchInjuries(abbrev, force), [abbrev], {
        enabled: known && !!seen.injuries,
        keepPreviousData: false,
    });
    const summary = useQuery(({force}) => nhl.teams(undefined, {force}), [], {enabled: !!seen.insights});
    const milestones = useQuery(({force}) => fetchTeamMilestones(abbrev, {force}), [abbrev], {
        enabled: known && !!seen.insights,
        keepPreviousData: false,
    });
    const lines = useQuery(({force}) => fetchLines(abbrev, {force}), [abbrev], {
        enabled: known && !!seen.roster,
        keepPreviousData: false,
    });

    /* ------------------------------------------------------- actions */

    const onOpenGame = useCallback((g) => {
        if (g?.id) navigation.navigate(ROUTES.game, {gameId: g.id, game: g});
    }, [navigation]);

    const onOpenPlayer = useCallback((p) => {
        if (p?.id) navigation.navigate(ROUTES.player, {playerId: p.id, name: playerName(p)});
    }, [navigation]);

    const onOpenPlayerId = useCallback((id) => {
        if (id) navigation.navigate(ROUTES.player, {playerId: id});
    }, [navigation]);

    const onSelectTeam = useCallback((a) => {
        if (isTeamRoute) navigation.setParams({abbrev: a});
        else setTeam?.(a);
        scrollRef.current?.scrollTo?.({y: 0, animated: false});
    }, [isTeamRoute, navigation, setTeam]);

    const openPicker = useCallback(() => setPickerOpen(true), []);
    const closePicker = useCallback(() => setPickerOpen(false), []);
    const onBack = useCallback(() => navigation.goBack(), [navigation]);
    const onFavorite = useCallback(() => setTeam?.(abbrev), [setTeam, abbrev]);

    const tabQuery = {stats: mp, roster, injuries, insights: summary}[tab];
    const refreshing = league.refreshing || week.refreshing || !!tabQuery?.refreshing;
    // Depend on the (stable) refresh functions, not the query objects, which are new every render.
    const refreshLeague = league.refresh;
    const refreshWeek = week.refresh;
    const refreshSeason = season.refresh;
    const refreshMp = mpProb.refresh;
    const refreshTab = tabQuery?.refresh;
    const seasonNeeded = !weekHero && !!week.data;
    const onRefresh = useCallback(() => {
        refreshLeague();
        refreshWeek();
        if (seasonNeeded) refreshSeason();
        if (heroPregame) refreshMp();
        refreshTab?.();
    }, [refreshLeague, refreshWeek, refreshSeason, refreshMp, refreshTab, seasonNeeded, heroPregame]);

    const onHeaderLayout = useCallback((e) => {
        headerH.current = e.nativeEvent.layout.height;
    }, []);
    const onScroll = useCallback((e) => {
        const past = e.nativeEvent.contentOffset.y > headerH.current - 4;
        if (past !== pastRef.current) {
            pastRef.current = past;
            setPastHeader(past);
        }
    }, []);

    /* -------------------------------------------------------- render */

    if (!known) {
        return (
            <Screen>
                <EmptyState title="Pick a team" message="Choose a team to see its schedule, stats and roster."/>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choose team"
                    onPress={openPicker}
                    style={({pressed}) => [styles.pick, {backgroundColor: colors.card}, pressed && styles.pressed]}>
                    <T variant="label" style={styles.centerText}>Choose team</T>
                </Pressable>
                <TeamPicker visible={pickerOpen} current={abbrev} onSelect={onSelectTeam} onClose={closePicker}/>
            </Screen>
        );
    }

    const headerBg = teamColor(abbrev);
    const headerFg = readableOn(headerBg);
    // The tab bar sits below the My Team tab; the root-stack Team page has no tab bar, so clear the
    // home indicator there.
    const contentStyle = isTeamRoute ? [styles.content, {paddingBottom: 48 + insets.bottom}] : styles.content;
    const barStyle = pastHeader ? (dark ? 'light' : 'dark') : headerFg === '#FFFFFF' ? 'light' : 'dark';

    let content = null;
    if (tab === 'schedule') {
        content = (
            <ScheduleTab
                abbrev={abbrev}
                games={weekGames}
                loading={week.loading}
                error={week.error}
                onRetry={week.refresh}
                hero={hero}
                heroFromSeason={!!seasonHero}
                mpHomeProb={heroPregame && Number.isFinite(mpProb.data) ? mpProb.data : null}
                ratings={league.ratings}
                onOpenGame={onOpenGame}
            />
        );
    } else if (tab === 'insights') {
        content = (
            <InsightsTab
                abbrev={abbrev}
                hero={hero}
                standings={league.standings}
                ratings={league.ratings}
                loading={league.loading}
                error={league.error}
                onRetry={league.refresh}
                summary={summary.data}
                milestones={milestones.data}
                onOpenGame={onOpenGame}
                onOpenPlayer={onOpenPlayerId}
            />
        );
    } else if (tab === 'stats') {
        content = <StatsTab abbrev={abbrev} data={mp.data} loading={mp.loading} error={mp.error} onRetry={mp.refresh}/>;
    } else if (tab === 'roster') {
        content = (
            <RosterTab
                abbrev={abbrev}
                roster={roster.data}
                loading={roster.loading}
                error={roster.error}
                onRetry={roster.refresh}
                onOpenPlayer={onOpenPlayer}
                lines={lines}
                onOpenPlayerId={onOpenPlayerId}
            />
        );
    } else {
        content = <InjuriesTab injuries={injuries.data} loading={injuries.loading} error={injuries.error} onRetry={injuries.refresh}/>;
    }

    return (
        <View style={[styles.root, {backgroundColor: colors.background, paddingTop: insets.top}]}>
            {focused ? <StatusBar style={barStyle}/> : null}
            <View style={[styles.statusFill, {height: insets.top, backgroundColor: pastHeader ? colors.background : headerBg}]}/>
            <ScrollView
                ref={scrollRef}
                stickyHeaderIndices={STICKY}
                onScroll={onScroll}
                scrollEventThrottle={32}
                contentContainerStyle={contentStyle}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={headerFg} colors={[headerBg]}/>
                }>
                <View onLayout={onHeaderLayout}>
                    <TeamHeader
                        abbrev={abbrev}
                        row={row}
                        loading={league.loading}
                        bg={headerBg}
                        onPickTeam={openPicker}
                        onBack={isTeamRoute ? onBack : undefined}
                        onFavorite={isTeamRoute ? onFavorite : undefined}
                        isFavorite={abbrev === favorite}
                    />
                </View>
                <View style={[styles.tabs, {backgroundColor: colors.background}]}>
                    <UnderlineTabs tabs={TABS} value={tab} onChange={changeTab}/>
                </View>
                <View key={`${abbrev}-${tab}`}>{content}</View>
            </ScrollView>
            <TeamPicker
                visible={pickerOpen}
                current={abbrev}
                onSelect={onSelectTeam}
                onClose={closePicker}
                title={isTeamRoute ? 'Switch team' : 'Your team'}
                currentLabel={isTeamRoute ? 'Viewing' : 'Your team'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {flex: 1},
    statusFill: {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2},
    content: {paddingBottom: 48},
    tabs: {paddingTop: 12, paddingBottom: 16},
    // A pill button (like Players' "Load more"), not a card.
    pick: {marginHorizontal: GUTTER, paddingHorizontal: 20, paddingVertical: 15, minHeight: 44, justifyContent: 'center', borderRadius: 100},
    pressed: {opacity: 0.6},
    centerText: {textAlign: 'center'},
});
