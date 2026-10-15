import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {useScrollToTop} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, RefreshControl, SectionList, StyleSheet, View} from 'react-native';
import {EmptyState, ErrorState, FadeInView, Header, InfoTip, LiveDot, Row, Screen, SkeletonList, T, tap} from '../components/ui';
import {Calendar} from '../components/icons';
import {isLive, nhl} from '../api/nhl';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {useLeague} from '../hooks/useLeague';
import {useNow, useQuery} from '../hooks/useQuery';
import {ROUTES} from '../navigation/routes';
import {useAppTheme} from '../theme';
import {parseISODate, relativeDayLabel, toISODate} from '../utils/format';
import DateStrip from './scores/DateStrip';
import GameCard from './scores/GameCard';
import GamePreviewSheet from './scores/GamePreviewSheet';
import {buildSections, gameOfTheNight, modelProbability} from './scores/gameLogic';

const POLL_MS = 15000;
// Like the NHL's own apps, the hockey "day" rolls over at 4am so late West-coast games stay on
// "Today" after midnight.
const DAY_ROLLOVER_MS = 4 * 3600 * 1000;
const hockeyToday = (now) => toISODate(new Date(now.getTime() - DAY_ROLLOVER_MS));

const SECTION_INFO = {
    live:
        'The bar shows each team’s chance to win right now from Rinkside’s live model, which plays out the rest ' +
        'of the game from the current score and clock using both teams’ scoring rates. It’s a model estimate. ' +
        'MoneyPuck’s live number is shown too when available.',
    upcoming:
        'Pre-game win chances from Rinkside’s model: each team’s goals for and against (shrunk toward league ' +
        'average early in the season) plus home ice, played out minute by minute. It’s a model estimate. ' +
        'MoneyPuck’s prediction is shown too when available.',
    favorite: 'Your favourite team’s game is pinned to the top. Long-press any game for goalies and team stats.',
};

const keyExtractor = (g) => String(g.id);
const renderSectionHeader = ({section}) => <SectionHeader section={section}/>;

function SectionHeader({section}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.sectionHeader, {backgroundColor: colors.background}]}>
            <Row gap={6}>
                {section.key === 'live' ? <LiveDot/> : null}
                <T variant="heading">{section.title}</T>
                {section.key !== 'favorite' ? <T variant="caption" muted>{section.data.length}</T> : null}
                {SECTION_INFO[section.key] ? (
                    <InfoTip title={section.key === 'favorite' ? section.title : `${section.title} win probability`} body={SECTION_INFO[section.key]}/>
                ) : null}
            </Row>
        </View>
    );
}

function TodayButton({onPress}) {
    const {colors} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            hitSlop={8}
            onPress={() => {
                tap();
                onPress();
            }}
            style={({pressed}) => [styles.todayBtn, {backgroundColor: colors.card}, pressed && {opacity: 0.6}]}>
            <Calendar size={16} color={colors.text}/>
            <T variant="label">Today</T>
        </Pressable>
    );
}

function ScoresContent({navigation}) {
    const {colors} = useAppTheme();
    const {team: favorite} = useFavoriteTeam() ?? {};
    const {ratings} = useLeague();

    // Re-evaluate "today" every minute so the strip rolls over if the app stays open.
    const now = useNow(60000);
    const todayISO = hockeyToday(now);
    const [selected, setSelected] = useState(todayISO);
    const prevToday = useRef(todayISO);
    useEffect(() => {
        // If the user was looking at "today" when the day rolled over, follow it.
        if (prevToday.current !== todayISO) {
            setSelected((s) => (s === prevToday.current ? todayISO : s));
            prevToday.current = todayISO;
        }
    }, [todayISO]);

    const [poll, setPoll] = useState(false);
    const scores = useQuery(({force}) => nhl.score(selected, {force}), [selected], {
        refetchInterval: poll ? POLL_MS : 0,
        keepPreviousData: false,
    });
    const games = useMemo(() => (Array.isArray(scores.data?.games) ? scores.data.games : []), [scores.data]);
    const hasLive = useMemo(() => games.some(isLive), [games]);
    useEffect(() => setPoll(hasLive), [hasLive]);

    const probs = useMemo(() => {
        const out = {};
        for (const g of games) out[g.id] = modelProbability(ratings, g);
        return out;
    }, [games, ratings]);
    const gotn = useMemo(() => gameOfTheNight(games, ratings, probs), [games, ratings, probs]);
    const sections = useMemo(() => buildSections(games, favorite), [games, favorite]);

    const listRef = useRef(null);
    useScrollToTop(listRef);

    const openGame = useCallback((game) => {
        navigation.navigate(ROUTES.game, {gameId: game.id, game});
    }, [navigation]);

    const sheetRef = useRef(null);
    const [previewId, setPreviewId] = useState(null);
    const previewSnapshot = useRef(null);
    const showPreview = useCallback((game) => {
        previewSnapshot.current = game;
        setPreviewId(game.id);
        sheetRef.current?.present();
    }, []);
    const onDismiss = useCallback(() => setPreviewId(null), []);
    // Prefer the freshest copy of the game (polling keeps live scores moving inside the sheet).
    const previewGame = previewId == null ? null : games.find((g) => g.id === previewId) ?? previewSnapshot.current;

    const renderItem = useCallback(({item}) => (
        <GameCard
            game={item}
            model={probs[item.id]}
            favorite={favorite && (item.homeTeam?.abbrev === favorite || item.awayTeam?.abbrev === favorite) ? favorite : null}
            gameOfNight={item.id === gotn}
            onOpen={openGame}
            onPreview={showPreview}
        />
    ), [probs, favorite, gotn, openGame, showPreview]);

    const subtitle = relativeDayLabel(parseISODate(selected), parseISODate(todayISO));
    const isToday = selected === todayISO;

    let body;
    if (scores.loading && !scores.data) {
        body = <SkeletonList count={5} height={128} style={styles.skeleton}/>;
    } else if (scores.error && !scores.data) {
        body = <ErrorState message="Couldn’t load scores for this day." onRetry={scores.refresh}/>;
    } else {
        body = (
            <SectionList
                ref={listRef}
                sections={sections}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled
                extraData={probs}
                initialNumToRender={8}
                windowSize={7}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={scores.refreshing} onRefresh={scores.refresh} tintColor={colors.textSecondary}/>
                }
                ListEmptyComponent={
                    <EmptyState
                        title="No games"
                        message={`There are no NHL games ${isToday ? 'today' : `on ${subtitle}`}. Pick another day above.`}
                    />
                }
            />
        );
    }

    return (
        <Screen>
            <Header
                title="Scores"
                subtitle={subtitle}
                right={isToday ? null : <TodayButton onPress={() => setSelected(todayISO)}/>}
            />
            <DateStrip todayISO={todayISO} selected={selected} onSelect={setSelected}/>
            <FadeInView key={selected} style={styles.flex}>{body}</FadeInView>
            <GamePreviewSheet
                sheetRef={sheetRef}
                game={previewGame}
                model={previewGame ? probs[previewGame.id] : null}
                onOpen={openGame}
                onDismiss={onDismiss}
            />
        </Screen>
    );
}

export default function ScoresScreen(props) {
    return (
        <BottomSheetModalProvider>
            <ScoresContent {...props}/>
        </BottomSheetModalProvider>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    skeleton: {paddingHorizontal: 16, paddingTop: 8},
    listContent: {paddingBottom: 32, flexGrow: 1},
    sectionHeader: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8},
    todayBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999},
});
