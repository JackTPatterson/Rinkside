import React, {useCallback, useMemo, useRef, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import {gameXG, predictGame} from '../analytics';
import {
    Chart2,
    Cup,
    Danger,
    DocumentText,
    Flash,
    Graph,
    Information,
    Location,
    Microphone2,
    Radar,
    Speedometer,
    Star1,
    User,
    Video,
} from '../components/icons';
import {BackButton, ErrorState, FadeInView, Header, PillTabs, Screen, Skeleton, SkeletonList} from '../components/ui';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {useLeague} from '../hooks/useLeague';
import {ROUTES} from '../navigation/routes';
import {useAppTheme} from '../theme';
import {parseISODate, shortDate} from '../utils/format';
import {LinkPill, openLink} from './game/common';
import GoalsTab from './game/GoalsTab';
import {InfoTab, PenaltiesTab, StarsTab} from './game/MiscTabs';
import {
    brightcoveUrl,
    extractGoals,
    extractShootout,
    goalsWithWPA,
    latestSituationCode,
    rinksideLive,
    rosterIndex,
} from './game/model';
import PlayersTab from './game/PlayersTab';
import {PreviewTab, SeriesTab} from './game/Pregame';
import RinkMapTab from './game/Rink';
import Scoreboard from './game/Scoreboard';
import StatsTab from './game/StatsTab';
import {useGameData} from './game/useGameData';
import WinProbTab from './game/WinProbTab';
import XGTab from './game/XGTab';

const PREGAME_TABS = [
    {key: 'preview', label: 'Preview', icon: Speedometer},
    {key: 'series', label: 'Season Series', icon: Cup},
];

function gameTabs(header, hasStars) {
    return [
        {key: 'goals', label: 'Goals', icon: Flash},
        {key: 'wp', label: 'Win Prob', icon: Graph},
        {key: 'xg', label: 'xG', icon: Radar},
        {key: 'stats', label: 'Game Stats', icon: Chart2},
        {key: 'players', label: 'Players', icon: User},
        {key: 'map', label: 'Rink Map', icon: Location},
        ...(header.final && hasStars ? [{key: 'stars', label: 'Stars', icon: Star1}] : []),
        {key: 'penalties', label: 'Penalties', icon: Danger},
        {key: 'info', label: 'Info', icon: Information},
        {key: 'series', label: 'Series', icon: Cup},
    ];
}

/** A video id from the right rail, or an nhl.com path from the score feed. */
function videoUrl(v) {
    if (!v) return null;
    if (typeof v === 'number' || /^\d+$/.test(String(v))) return brightcoveUrl(v);
    const s = String(v);
    return s.startsWith('http') ? s : `https://www.nhl.com${s.startsWith('/') ? '' : '/'}${s}`;
}

function LoadingBody() {
    return (
        <View style={{paddingHorizontal: 16, gap: 16}}>
            <Skeleton height={190} radius={16}/>
            <Skeleton height={40} radius={999}/>
            <SkeletonList count={4} height={96}/>
        </View>
    );
}

export default function GameScreen({route, navigation}) {
    const {colors} = useAppTheme();
    const params = route.params ?? {};
    const initialGame = params.game ?? params.data?.data; // `data.data` = legacy param shape
    const gameId = params.gameId ?? initialGame?.id;

    const data = useGameData(gameId, initialGame);
    const {header, landing, box, pbp, rail, mp} = data;
    const {ratings} = useLeague();
    const {team: favourite} = useFavoriteTeam() ?? {};
    const {home, away} = header;

    /* ------------------------------------------------- derived data */

    // Landing is refetched every 15s while live; keep the goals array identity stable unless a goal
    // actually changed, so WPA / win-probability series aren't recomputed on every poll.
    const goalsCache = useRef({sig: null, goals: []});
    const goalsRaw = useMemo(() => {
        const next = extractGoals(landing, home.abbrev);
        const sig = next.map((g) => `${g.key}:${g.homeScore}-${g.awayScore}:${g.clip ? 1 : 0}:${g.goalsToDate}:${g.assists.length}`).join('|');
        if (sig !== goalsCache.current.sig) goalsCache.current = {sig, goals: next};
        return goalsCache.current.goals;
    }, [landing, home.abbrev]);
    const goals = useMemo(
        () => goalsWithWPA(ratings, {home, away, playoff: header.playoff}, goalsRaw),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ratings, goalsRaw, home.abbrev, away.abbrev, header.playoff],
    );
    const shootout = useMemo(() => extractShootout(landing), [landing]);
    const xg = useMemo(() => (pbp?.plays?.length ? gameXG(pbp) : null), [pbp]);
    const xgShots = useMemo(() => (xg ? [...xg.home.shots, ...xg.away.shots] : null), [xg]);
    const roster = useMemo(() => rosterIndex(pbp, box, header),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pbp, box, home.id, home.abbrev, away.abbrev]);
    const prediction = useMemo(() => {
        if (!home.abbrev || !away.abbrev) return null;
        try {
            return predictGame(ratings, home.abbrev, away.abbrev, {playoff: header.playoff});
        } catch {
            return null;
        }
    }, [ratings, home.abbrev, away.abbrev, header.playoff]);
    const situationCode = useMemo(() => (header.live ? latestSituationCode(pbp, landing) : undefined), [header.live, pbp, landing]);
    const liveWP = useMemo(() => (header.live ? rinksideLive(ratings, header, situationCode) : null), [ratings, header, situationCode]);

    // Header win probability: MoneyPuck when it has a number, otherwise the Rinkside model.
    const {wp, wpSource} = useMemo(() => {
        if (header.final) {
            const h = home.score ?? 0;
            const a = away.score ?? 0;
            return {wp: h > a ? 1 : h < a ? 0 : 0.5, wpSource: null};
        }
        if (header.live) {
            const mpv = Number(mp?.last?.homeWinProbability);
            if (Number.isFinite(mpv)) return {wp: mpv, wpSource: 'MoneyPuck'};
            return {wp: liveWP?.home, wpSource: 'Rinkside model'};
        }
        if (Number.isFinite(data.mpPregame)) return {wp: data.mpPregame, wpSource: 'MoneyPuck'};
        return {wp: prediction?.homeWin, wpSource: 'Rinkside model'};
    }, [header.final, header.live, home.score, away.score, mp, liveWP, data.mpPregame, prediction]);

    /* ---------------------------------------------------- tabs */

    const hasStars = !!landing?.summary?.threeStars?.length;
    const tabs = useMemo(() => (header.started ? gameTabs(header, hasStars) : PREGAME_TABS),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [header.started, header.final, hasStars]);
    const [tab, setTab] = useState(null);
    const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

    /* ------------------------------------------------- navigation */

    const goBack = useCallback(() => navigation.goBack(), [navigation]);
    const openPlayer = useCallback((playerId) => {
        if (playerId) navigation.navigate(ROUTES.player, {playerId});
    }, [navigation]);
    const openGame = useCallback((g) => {
        if (g?.id && g.id !== gameId) navigation.push(ROUTES.game, {gameId: g.id});
    }, [navigation, gameId]);
    const openRecap = useCallback(() => navigation.navigate(ROUTES.recap, {gameId, home: home.abbrev, away: away.abbrev}), [navigation, gameId, home.abbrev, away.abbrev]);

    /* ---------------------------------------------------- links */

    const recapUrl = videoUrl(header.threeMinRecap) ?? videoUrl(rail?.gameVideo?.threeMinRecap);
    const condensedUrl = videoUrl(rail?.gameVideo?.condensedGame);
    const links = [];
    if (header.final) {
        if (recapUrl) links.push({key: 'recap', icon: Video, label: '3-min recap', onPress: () => openLink(recapUrl)});
        if (condensedUrl) links.push({key: 'condensed', icon: Video, label: 'Condensed game', onPress: () => openLink(condensedUrl)});
        links.push({key: 'story', icon: DocumentText, label: 'Recap', onPress: openRecap});
    }
    if (header.live) {
        if (home.radioLink) links.push({key: 'hr', icon: Microphone2, label: `${home.abbrev} radio`, onPress: () => openLink(home.radioLink)});
        if (away.radioLink) links.push({key: 'ar', icon: Microphone2, label: `${away.abbrev} radio`, onPress: () => openLink(away.radioLink)});
    }

    const favouriteWon = header.final && favourite && home.score !== away.score &&
        ((home.score > away.score && favourite === home.abbrev) || (away.score > home.score && favourite === away.abbrev));

    /* --------------------------------------------------- render */

    const subtitle = [
        header.gameDate ? shortDate(parseISODate(header.gameDate)) : null,
        header.playoff ? 'Playoffs' : header.gameType === 1 ? 'Preseason' : null,
    ].filter(Boolean).join(' · ');

    const body = () => {
        switch (activeTab) {
            case 'preview':
                return (
                    <PreviewTab
                        header={header}
                        prediction={prediction}
                        mpPregame={data.mpPregame}
                        goalies={data.goalies}
                        goaliesLoading={data.goaliesLoading}
                        teams={data.teams}
                        sims={data.sims}
                        landing={landing}
                        rail={rail}
                        onPlayer={openPlayer}
                    />
                );
            case 'series':
                return <SeriesTab landing={landing} rail={rail} header={header} onOpenGame={openGame}/>;
            case 'goals':
                return <GoalsTab goals={goals} shootout={shootout} header={header} pbp={pbp} xgShots={xgShots} onPlayer={openPlayer}/>;
            case 'wp':
                return (
                    <WinProbTab
                        header={header}
                        ratings={ratings}
                        goals={goalsRaw}
                        mp={mp}
                        liveWP={liveWP}
                        prediction={prediction}
                        mpPregame={data.mpPregame}
                    />
                );
            case 'xg':
                return <XGTab xg={xg} header={header} roster={roster} mp={mp} onPlayer={openPlayer}/>;
            case 'stats':
                return <StatsTab header={header} landing={landing} box={box} rail={rail} mp={mp} xg={xg} sims={data.sims}/>;
            case 'players':
                return <PlayersTab header={header} box={box} xg={xg} onPlayer={openPlayer}/>;
            case 'map':
                return <RinkMapTab pbp={pbp} xg={xg} header={header}/>;
            case 'stars':
                return <StarsTab landing={landing} onPlayer={openPlayer}/>;
            case 'penalties':
                return <PenaltiesTab landing={landing}/>;
            case 'info':
                return <InfoTab header={header} landing={landing} box={box} rail={rail} onPlayer={openPlayer}/>;
            default:
                return null;
        }
    };

    return (
        <Screen>
            <Header
                title={home.abbrev && away.abbrev ? `${away.abbrev} @ ${home.abbrev}` : 'Game'}
                subtitle={subtitle || undefined}
                left={<BackButton onPress={goBack}/>}
            />
            {data.error ? (
                <ErrorState message="Couldn’t load this game." onRetry={data.refresh}/>
            ) : data.loading || !home.abbrev ? (
                <LoadingBody/>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} tintColor={colors.textSecondary}/>}>
                    <FadeInView>
                        <Scoreboard header={header} wp={wp} wpSource={wpSource}/>
                    </FadeInView>
                    {links.length ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.links}>
                            {links.map((l) => <LinkPill key={l.key} icon={l.icon} label={l.label} onPress={l.onPress}/>)}
                        </ScrollView>
                    ) : null}
                    <PillTabs tabs={tabs} value={activeTab} onChange={setTab} style={styles.tabs}/>
                    <View style={styles.body}>
                        <FadeInView key={activeTab}>{body()}</FadeInView>
                    </View>
                </ScrollView>
            )}
            {favouriteWon ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <ConfettiCannon count={120} origin={{x: -20, y: -20}} fadeOut autoStart/>
                </View>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: {paddingBottom: 48},
    links: {paddingHorizontal: 16, gap: 8, paddingTop: 12},
    tabs: {marginTop: 16},
    body: {paddingHorizontal: 16, paddingTop: 16},
});
