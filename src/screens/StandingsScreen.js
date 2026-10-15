import {useNavigation, useScrollToTop} from '@react-navigation/native';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {RefreshControl, StyleSheet, View} from 'react-native';
import {nhl} from '../api/nhl';
import {Activity, Crown1, Diagram, Radar, RowVertical, Speedometer, Status} from '../components/icons';
import {ErrorState, Header, PillTabs, Screen, Skeleton, SkeletonList} from '../components/ui';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {useLeague} from '../hooks/useLeague';
import {useQuery} from '../hooks/useQuery';
import {ROUTES} from '../navigation/routes';
import {useAppTheme} from '../theme';
import {seasonLabel} from '../utils/season';
import {fetchPowerRankings, fetchSimulations} from './standings/data';
import LuckView from './standings/LuckView';
import OddsView from './standings/OddsView';
import PdoView from './standings/PdoView';
import PowerView from './standings/PowerView';
import RaceView from './standings/RaceView';
import RatingsView from './standings/RatingsView';
import StandingsView from './standings/StandingsView';

const TABS = [
    {key: 'standings', label: 'Standings', icon: RowVertical},
    {key: 'odds', label: 'Odds', icon: Crown1},
    {key: 'power', label: 'Power', icon: Activity},
    {key: 'race', label: 'Playoff Race', icon: Status},
    {key: 'ratings', label: 'Ratings', icon: Speedometer},
    {key: 'luck', label: 'Luck', icon: Diagram},
    {key: 'pdo', label: 'PDO', icon: Radar},
];

// Views that need standings to render anything.
const NEEDS_STANDINGS = new Set(['standings', 'race', 'ratings', 'luck', 'pdo']);

const teamsFetcher = ({force}) => nhl.teams(undefined, {force});

export default function StandingsScreen() {
    const navigation = useNavigation();
    const {colors} = useAppTheme();
    const fav = useFavoriteTeam()?.team ?? null;
    const [tab, setTab] = useState('standings');
    // MoneyPuck / stats-API data loads the first time its view is opened, then stays enabled.
    const [visited, setVisited] = useState(() => new Set(['standings']));
    const onTab = useCallback((k) => {
        setTab(k);
        setVisited((v) => (v.has(k) ? v : new Set(v).add(k)));
    }, []);

    const league = useLeague();
    const sims = useQuery(fetchSimulations, [], {enabled: visited.has('odds')});
    const power = useQuery(fetchPowerRankings, [], {enabled: visited.has('power')});
    const teams = useQuery(teamsFetcher, [], {enabled: visited.has('pdo')});

    const rows = useMemo(() => {
        const s = league.standings?.standings;
        return Array.isArray(s) ? s : [];
    }, [league.standings]);

    const listRef = useRef(null);
    useScrollToTop(listRef);

    const onTeamPress = useCallback((abbrev) => {
        if (abbrev) navigation.navigate(ROUTES.team, {abbrev});
    }, [navigation]);

    const extra = tab === 'odds' ? sims : tab === 'power' ? power : tab === 'pdo' ? teams : null;
    const leagueRefresh = league.refresh;
    const extraRefresh = extra?.refresh;
    const onRefresh = useCallback(() => {
        leagueRefresh();
        extraRefresh?.();
    }, [leagueRefresh, extraRefresh]);
    const refreshing = !!(league.refreshing || extra?.refreshing);
    const refreshControl = useMemo(
        () => (
            <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.textSecondary}
                colors={[colors.text]}
                progressBackgroundColor={colors.card}
            />
        ),
        [refreshing, onRefresh, colors.textSecondary, colors.text, colors.card],
    );

    const common = {rows, fav, onTeamPress, refreshControl, listRef};
    let content;
    if (NEEDS_STANDINGS.has(tab) && !rows.length && league.loading) {
        // Mirrors the loaded layout (segmented control / title row, then 44pt rows) so nothing jumps.
        content = (
            <View style={styles.skeleton}>
                <Skeleton height={34} radius={12}/>
                <Skeleton width="45%" height={14} style={styles.skeletonCaption}/>
                <SkeletonList count={10} height={40} gap={4}/>
            </View>
        );
    } else if (NEEDS_STANDINGS.has(tab) && !rows.length) {
        content = <ErrorState message={league.error ? 'Couldn’t load the standings.' : 'No standings yet.'} onRetry={league.refresh}/>;
    } else if (tab === 'standings') {
        content = <StandingsView {...common}/>;
    } else if (tab === 'odds') {
        content = <OddsView {...common} q={sims}/>;
    } else if (tab === 'power') {
        content = <PowerView {...common} q={power}/>;
    } else if (tab === 'race') {
        content = <RaceView {...common}/>;
    } else if (tab === 'ratings') {
        content = <RatingsView {...common} ratings={league.ratings}/>;
    } else if (tab === 'luck') {
        content = <LuckView {...common}/>;
    } else {
        content = <PdoView {...common} q={teams}/>;
    }

    return (
        <Screen>
            <Header title="Standings" subtitle={`${seasonLabel()} regular season`}/>
            <PillTabs tabs={TABS} value={tab} onChange={onTab} style={styles.tabs}/>
            <View style={styles.body}>{content}</View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    tabs: {marginBottom: 4},
    body: {flex: 1},
    skeleton: {paddingHorizontal: 16, paddingTop: 8},
    skeletonCaption: {marginTop: 12, marginBottom: 16},
});
