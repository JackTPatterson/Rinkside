import React, {useCallback, useMemo, useRef, useState} from 'react';
import {RefreshControl, StyleSheet, View} from 'react-native';
import Animated, {useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring} from 'react-native-reanimated';
import {alignPrediction, applyExternalXG, gameXG, predictGame} from '../analytics';
import {DocumentText, Microphone2, Video} from '../components/icons';
import {BackButton, ErrorState, FadeInView, Header, Screen, Segmented, Skeleton, SkeletonList, T, UnderlineTabs} from '../components/ui';
import {useRatingsBefore} from '../hooks/useLeague';
import {ROUTES} from '../navigation/routes';
import {GUTTER, useAppTheme} from '../theme';
import {parseISODate, shortDate} from '../utils/format';
import {useOpenVideo} from './game/common';
import {videoIdOf} from '../api/brightcove';
import GameScoreTab from './game/GameScoreTab';
import GoalsTab from './game/GoalsTab';
import {OfficialsTab, PenaltiesTab, ScratchesTab, StarsTab} from './game/MiscTabs';
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
import {LinesTab, PreviewTab, SeriesTab} from './game/Pregame';
import RinkMapTab from './game/Rink';
import {useRadio} from '../radio/RadioProvider';
import LinksSheet from './game/LinksSheet';
import WhereToWatch from './fan/WhereToWatch';
import Scoreboard from './game/Scoreboard';
import StatsTab from './game/StatsTab';
import {useGameData} from './game/useGameData';
import WinProbTab from './game/WinProbTab';
import XGTab from './game/XGTab';

// The game page is organised into a few main sections (underline tabs). A section with more than
// one view shows a small switcher under the tabs; the view keys are what body() renders.
const PREGAME_SECTIONS = [
    {key: 'preview', label: 'Preview', views: [{key: 'preview', label: 'Preview'}]},
    {key: 'lines', label: 'Lines', views: [{key: 'lines', label: 'Lines'}]},
    {key: 'series', label: 'Season Series', views: [{key: 'series', label: 'Season Series'}]},
];

function gameSections(header, hasStars) {
    return [
        {
            key: 'summary',
            label: 'Summary',
            views: [
                {key: 'goals', label: 'Goals'},
                {key: 'penalties', label: 'Penalties'},
                ...(header.final && hasStars ? [{key: 'stars', label: 'Stars'}] : []),
            ],
        },
        {key: 'team', label: 'Team Stats', views: [{key: 'stats', label: 'Game Stats'}]},
        {key: 'analytics', label: 'Analytics', views: [{key: 'wp', label: 'Win Prob'}, {key: 'xg', label: 'xG'}, {key: 'map', label: 'Rink Map'}]},
        {key: 'players', label: 'Players', views: [{key: 'players', label: 'Box Score'}, {key: 'gamescore', label: 'Impact'}]},
        {key: 'info', label: 'Info', views: [{key: 'series', label: 'Season Series'}, {key: 'scratches', label: 'Scratches'}, {key: 'officials', label: 'Officials'}]},
    ];
}

/** A video id from the right rail, or an nhl.com path from the score feed. */
function videoUrl(v) {
    if (!v) return null;
    if (typeof v === 'number' || /^\d+$/.test(String(v))) return brightcoveUrl(v);
    const s = String(v);
    return s.startsWith('http') ? s : `https://www.nhl.com${s.startsWith('/') ? '' : '/'}${s}`;
}

const TITLE_SPRING = {damping: 20, stiffness: 180, mass: 0.8};

/**
 * Header title that swaps once the score section scrolls past (App Store build, Apple Sports
 * style): "BUF @ TOR" slides up and fades out while the score slides in from below.
 */
function ScrollTitle({title, scoreTitle, subtitle, scrollY, threshold}) {
    const show = useSharedValue(0);
    useAnimatedReaction(
        () => scrollY.value > threshold.value - 20,
        (past, prev) => {
            if (past !== prev) show.value = withSpring(past ? 1 : 0, TITLE_SPRING);
        },
        [],
    );
    const first = useAnimatedStyle(() => ({opacity: 1 - show.value * 1.5, transform: [{translateY: -show.value * 8}]}));
    const second = useAnimatedStyle(() => ({opacity: Math.max(0, show.value * 1.5 - 0.5), transform: [{translateY: (1 - show.value) * 8}]}));
    const sub = subtitle ? <T variant="caption" muted numberOfLines={1}>{subtitle}</T> : null;
    return (
        <View>
            <Animated.View style={first}>
                <T variant="title" numberOfLines={1}>{title}</T>
                {sub}
            </Animated.View>
            {scoreTitle ? (
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, second]}>
                    <T variant="title" numberOfLines={1} style={{fontVariant: ['tabular-nums']}}>{scoreTitle}</T>
                    {sub}
                </Animated.View>
            ) : null}
        </View>
    );
}

function LoadingBody() {
    return (
        <View style={{paddingHorizontal: GUTTER, gap: 20, paddingTop: 10}}>
            <Skeleton height={190} radius={15}/>
            <Skeleton height={54} radius={100}/>
            <SkeletonList count={4} height={96} gap={4}/>
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
    const radio = useRadio();
    const openVideo = useOpenVideo();
    const {home, away} = header;
    const broadcasts = landing?.tvBroadcasts ?? initialGame?.tvBroadcasts;
    // Ratings as of the day before the game, so a past game's model numbers never use later results.
    const {ratings} = useRatingsBefore(header.gameDate);

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
    // xG: MoneyPuck's per-shot values (backtested better) matched onto the NHL shots; our model for the
    // whole game when MoneyPuck's file is missing or doesn't line up. Every xG view reads this one object.
    const xg = useMemo(() => (pbp?.plays?.length ? applyExternalXG(gameXG(pbp), data.mpRows) : null), [pbp, data.mpRows]);
    const xgShots = useMemo(() => (xg ? [...xg.home.shots, ...xg.away.shots] : null), [xg]);
    const roster = useMemo(() => rosterIndex(pbp, box, header),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pbp, box, home.id, home.abbrev, away.abbrev]);
    // Pregame odds: MoneyPuck's number (backtested better) with our model's regulation/OT split
    // re-centred on it; our model alone only when MoneyPuck has no number. One source everywhere.
    const prediction = useMemo(() => {
        if (!home.abbrev || !away.abbrev || !ratings) return null;
        try {
            return alignPrediction(predictGame(ratings, home.abbrev, away.abbrev, {playoff: header.playoff}), data.mpPregame);
        } catch {
            return null;
        }
    }, [ratings, home.abbrev, away.abbrev, header.playoff, data.mpPregame]);
    const situationCode = useMemo(() => (header.live ? latestSituationCode(pbp, landing) : undefined), [header.live, pbp, landing]);
    const liveWP = useMemo(() => (header.live ? rinksideLive(ratings, header, situationCode) : null), [ratings, header, situationCode]);

    // Header win probability. Live: MoneyPuck's series when it exists (the Win Prob chart uses the
    // same rule, so they always agree), otherwise our live model. Pregame: the aligned prediction.
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
        return {wp: prediction?.homeWin, wpSource: Number.isFinite(data.mpPregame) ? 'MoneyPuck' : 'Rinkside model'};
    }, [header.final, header.live, home.score, away.score, mp, liveWP, data.mpPregame, prediction]);

    /* ---------------------------------------------------- tabs */

    const hasStars = !!landing?.summary?.threeStars?.length;
    const sections = useMemo(() => (header.started ? gameSections(header, hasStars) : PREGAME_SECTIONS),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [header.started, header.final, hasStars]);
    const [sectionKey, setSectionKey] = useState(null);
    const [views, setViews] = useState({}); // last view picked in each section, so switching back keeps it
    const section = sections.find((x) => x.key === sectionKey) ?? sections[0];
    const activeTab = section.views.some((v) => v.key === views[section.key]) ? views[section.key] : section.views[0].key;
    const setView = useCallback((v) => setViews((cur) => ({...cur, [section.key]: v})), [section.key]);

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
    const recapVideo = videoIdOf(rail?.gameVideo?.threeMinRecap) ?? videoIdOf(header.threeMinRecap);
    const condensedUrl = videoUrl(rail?.gameVideo?.condensedGame);
    const links = [];
    if (header.final) {
        // Recap videos play in the in-app player (Brightcove HLS); nhl.com is only the fallback.
        const matchup = `${away.abbrev} @ ${home.abbrev}`;
        if (recapUrl) links.push({key: 'recap', icon: Video, label: '3-min recap', onPress: () => openVideo(recapVideo, {title: `${matchup} · Recap`, webUrl: recapUrl})});
        if (condensedUrl) links.push({key: 'condensed', icon: Video, label: 'Condensed game', onPress: () => openVideo(rail?.gameVideo?.condensedGame, {title: `${matchup} · Condensed game`, webUrl: condensedUrl})});
        links.push({key: 'story', icon: DocumentText, label: 'Recap', onPress: openRecap});
    }
    if (header.live) {
        // Team radio streams in the app (mini player + waveform) instead of opening a browser.
        if (home.radioLink) links.push({key: 'hr', icon: Microphone2, label: `${home.abbrev} radio`, onPress: () => radio.play({key: `${gameId}-${home.abbrev}`, team: home.abbrev, title: `${home.abbrev} radio`, url: home.radioLink})});
        if (away.radioLink) links.push({key: 'ar', icon: Microphone2, label: `${away.abbrev} radio`, onPress: () => radio.play({key: `${gameId}-${away.abbrev}`, team: away.abbrev, title: `${away.abbrev} radio`, url: away.radioLink})});
    }

    /* --------------------------------------------------- render */

    // Scroll-linked header: once the score row is scrolled past, the title becomes the score
    // (or the pregame win chances), in the same home-left order as the scoreboard.
    const scrollY = useSharedValue(0);
    const scoreHeight = useSharedValue(160);
    const onScroll = useAnimatedScrollHandler({onScroll: (e) => {
        scrollY.value = e.contentOffset.y;
    }});
    const scoreTitle = !home.abbrev ? null : header.started
        ? `${home.abbrev} ${home.score ?? 0} – ${away.score ?? 0} ${away.abbrev}`
        : Number.isFinite(prediction?.homeWin)
            ? `${home.abbrev} ${Math.round(prediction.homeWin * 100)}% – ${Math.round((1 - prediction.homeWin) * 100)}% ${away.abbrev}`
            : null;

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
                        goalies={data.goalies}
                        goaliesLoading={data.goaliesLoading}
                        teams={data.teams}
                        sims={data.sims}
                        landing={landing}
                        rail={rail}
                        milestones={data.milestones}
                        onPlayer={openPlayer}
                    />
                );
            case 'lines':
                return <LinesTab header={header} onPlayer={openPlayer}/>;
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
                    />
                );
            case 'xg':
                return <XGTab xg={xg} header={header} roster={roster} onPlayer={openPlayer}/>;
            case 'gamescore':
                return <GameScoreTab box={box} pbp={pbp} shifts={data.shifts} header={header} onPlayer={openPlayer}/>;
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
            case 'scratches':
                return <ScratchesTab header={header} landing={landing} box={box} rail={rail} onPlayer={openPlayer}/>;
            case 'officials':
                return <OfficialsTab header={header} landing={landing} box={box} rail={rail}/>;
            default:
                return null;
        }
    };

    return (
        <Screen>
            <Header
                titleNode={
                    <ScrollTitle
                        title={home.abbrev && away.abbrev ? `${away.abbrev} @ ${home.abbrev}` : 'Game'}
                        scoreTitle={scoreTitle}
                        subtitle={subtitle || undefined}
                        scrollY={scrollY}
                        threshold={scoreHeight}
                    />
                }
                left={<BackButton onPress={goBack}/>}
                right={home.abbrev && (links.length || (!header.final && broadcasts?.length)) ? (
                    <View style={styles.headerRight}>
                        {!header.final ? <WhereToWatch broadcasts={broadcasts} home={home.abbrev} away={away.abbrev}/> : null}
                        <LinksSheet links={links} icon={header.live ? Microphone2 : Video} title={header.live ? 'Listen' : 'Recaps'}/>
                    </View>
                ) : null}
            />
            {data.error ? (
                <ErrorState message="Couldn’t load this game." onRetry={data.refresh}/>
            ) : data.loading || !home.abbrev ? (
                <LoadingBody/>
            ) : (
                <Animated.ScrollView
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} tintColor={colors.textSecondary}/>}>
                    <FadeInView>
                        <View onLayout={(e) => {
                            scoreHeight.value = e.nativeEvent.layout.height;
                        }}>
                            <Scoreboard header={header} wp={wp} wpSource={wpSource}/>
                        </View>
                    </FadeInView>
                    {/* Main sections as a Kalshi-style underline bar; a section with several views gets a switcher. */}
                    <UnderlineTabs tabs={sections} value={section.key} onChange={setSectionKey} style={styles.tabs}/>
                    {section.views.length > 1 ? (
                        <Segmented options={section.views} value={activeTab} onChange={setView} style={styles.subTabs}/>
                    ) : null}
                    <View style={styles.body}>
                        <FadeInView key={activeTab}>{body()}</FadeInView>
                    </View>
                </Animated.ScrollView>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: {paddingBottom: 48},
    tabs: {marginTop: 16},
    subTabs: {marginTop: 14, marginHorizontal: GUTTER},
    body: {paddingHorizontal: GUTTER, paddingTop: 20},
    headerRight: {flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '62%'},
});
