import {BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, useBottomSheetSpringConfigs} from '@gorhom/bottom-sheet';
import React, {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Headshot, InfoTip, Row, SHEET_SPRING, Skeleton, SplitBar, T, TeamLogo, tap} from '../../components/ui';
import {ArrowRight2} from '../../components/icons';
import {useQuery} from '../../hooks/useQuery';
import {headshotUrl, nhl} from '../../api/nhl';
import {startingGoalieWithStats} from '../../api/moneypuck';
import {getTeam} from '../../data/teams';
import {GUTTER, SheetSurface, useAppTheme} from '../../theme';
import {loc, num, pct, savePct, signed} from '../../utils/format';
import {currentSeasonId} from '../../utils/season';
import {useMoneyPuckProb} from './GameCard';
import {statusLabel} from './gameLogic';

const SNAP_POINTS = ['80%'];

const INFO = {
    gsax:
        'Goals Saved Above Expected: goals he was expected to allow, from the quality of the shots he faced, minus goals he actually ' +
        'allowed. Positive means he’s stopping more than an average goalie would on the same shots.',
};

const fmt2 = (v) => num(v, 2);
const fmtPct1 = (v) => pct(v, 1);

function TeamHeader({team, align}) {
    const meta = getTeam(team?.abbrev);
    return (
        <View style={[styles.teamHeader, {alignItems: align}]}>
            <TeamLogo abbrev={team?.abbrev} size={90} style={styles.bigLogo}/>
            <T variant="title" numberOfLines={1}>{team?.abbrev ?? '—'}</T>
            <T variant="caption" muted numberOfLines={1}>{meta?.name ?? loc(team?.name)}</T>
        </View>
    );
}

function GoalieColumn({goalie, abbrev, season, loading}) {
    const {colors, teamColor} = useAppTheme();
    if (loading) {
        return (
            <View style={styles.goalie}>
                <Skeleton width={80} height={80} radius={40}/>
                <Skeleton width={90} height={16} radius={15}/>
            </View>
        );
    }
    return (
        <View style={styles.goalie}>
            <Headshot
                uri={goalie?.id ? headshotUrl(goalie.id, abbrev, season) : undefined}
                size={80}
                borderColor={teamColor(abbrev)}
                style={[styles.headshot, {backgroundColor: colors.card}]}
            />
            <T variant="body" numberOfLines={2} style={[styles.centerText, styles.semibold]}>{goalie?.name || 'Not announced'}</T>
        </View>
    );
}

// No card: sections sit straight on the sheet background, like the original preview sheet.
function Block({title, info, children}) {
    return (
        <View style={styles.block}>
            <Row gap={6} style={styles.blockTitle}>
                <T variant="body">{title}</T>
                {info ? <InfoTip title={title} body={info}/> : null}
            </Row>
            {children}
        </View>
    );
}

/**
 * Old-style head-to-head row: "home value | label | away value" in plain SemiBold text. The better side
 * stays full strength, the other is softened.
 */
function StatRow({label, left, right, format = (v) => v, higherIsBetter = true, info}) {
    const l = Number(left) || 0;
    const r = Number(right) || 0;
    const leftBetter = higherIsBetter ? l > r : l < r;
    const rightBetter = higherIsBetter ? r > l : r < l;
    return (
        <View style={styles.statRow}>
            <T variant="body" numberOfLines={1} style={[styles.statValue, {opacity: leftBetter ? 1 : 0.6}]}>{format(left)}</T>
            <Row gap={4} style={styles.statLabel}>
                <T variant="caption" muted numberOfLines={2} style={styles.centerText}>{label}</T>
                {info ? <InfoTip title={label} body={info} size={14}/> : null}
            </Row>
            <T variant="body" numberOfLines={1} style={[styles.statValue, styles.right, {opacity: rightBetter ? 1 : 0.6}]}>{format(right)}</T>
        </View>
    );
}

/** Body of the long-press preview: model odds, starting goalies + MoneyPuck stats, team summary. */
function PreviewBody({game, model, onOpen}) {
    const {colors, teamColor} = useAppTheme();
    const mp = useMoneyPuckProb(game); // cached by the card's request, so usually instant
    const id = game.id;
    const season = String(game.season ?? currentSeasonId());
    const home = game.homeTeam?.abbrev;
    const away = game.awayTeam?.abbrev;
    const homeColor = teamColor(home);
    let awayColor = teamColor(away);
    if (awayColor === homeColor) awayColor = colors.textSecondary;

    const goalies = useQuery(
        () => Promise.all([
            startingGoalieWithStats(id, 'H', season).catch(() => null),
            startingGoalieWithStats(id, 'A', season).catch(() => null),
        ]),
        [id, season],
        {keepPreviousData: false},
    );
    const teams = useQuery(({force}) => nhl.teams({seasonId: season}, {force}), [season]);

    const [homeGoalie, awayGoalie] = goalies.data ?? [null, null];
    const summary = useMemo(() => {
        const rows = teams.data?.data ?? [];
        return {
            home: rows.find((r) => r?.teamId === game.homeTeam?.id) ?? null,
            away: rows.find((r) => r?.teamId === game.awayTeam?.id) ?? null,
        };
    }, [teams.data, game.homeTeam?.id, game.awayTeam?.id]);

    const hs = homeGoalie?.stats;
    const as = awayGoalie?.stats;
    // MoneyPuck first (backtested better), Rinkside only when MoneyPuck has no number.
    const left = mp ?? model?.home;

    return (
        <BottomSheetScrollView alwaysBounceVertical={false} contentContainerStyle={styles.sheetContent}>
            <Row style={styles.headerRow}>
                <TeamHeader team={game.homeTeam} align="flex-start"/>
                <View style={styles.headerCenter}>
                    <View style={[styles.statusPill, {backgroundColor: colors.card}]}>
                        <T variant="body" numberOfLines={1} style={styles.statusText}>{statusLabel(game)}</T>
                    </View>
                    {game.homeTeam?.score != null && game.awayTeam?.score != null ? (
                        <T variant="title" style={styles.tabular}>{game.homeTeam.score} – {game.awayTeam.score}</T>
                    ) : null}
                    {game.venue ? <T variant="caption" muted numberOfLines={1}>{loc(game.venue)}</T> : null}
                </View>
                <TeamHeader team={game.awayTeam} align="flex-end"/>
            </Row>

            {left != null ? (
                <Block title="Win probability">
                    <Row style={styles.between}>
                        <T variant="body" color={homeColor} style={[styles.semibold, styles.tabular]}>{home} {pct(left)}</T>
                        <T variant="body" color={awayColor} style={[styles.semibold, styles.tabular]}>{pct(1 - left)} {away}</T>
                    </Row>
                    <SplitBar left={left} leftColor={homeColor} rightColor={awayColor} height={8} style={styles.bar}/>
                </Block>
            ) : null}

            <Block title="Starting goalies">
                <Row style={styles.goalieRow}>
                    <GoalieColumn goalie={homeGoalie} abbrev={home} season={season} loading={goalies.loading}/>
                    <GoalieColumn goalie={awayGoalie} abbrev={away} season={season} loading={goalies.loading}/>
                </Row>
                {hs || as ? (
                    <View style={styles.compare}>
                        <StatRow label="Save %" left={hs?.savePct} right={as?.savePct} format={savePct}
                            leftColor={homeColor} rightColor={awayColor}/>
                        <StatRow label="GAA" left={hs?.gaa} right={as?.gaa} format={fmt2} higherIsBetter={false}
                            leftColor={homeColor} rightColor={awayColor}/>
                        <StatRow label="GSAx" left={hs?.gsax} right={as?.gsax} format={(v) => signed(v, 1)}
                            leftColor={homeColor} rightColor={awayColor} info={INFO.gsax}/>
                        <StatRow label="Games played" left={hs?.gamesPlayed} right={as?.gamesPlayed} format={(v) => num(v)}
                            leftColor={homeColor} rightColor={awayColor}/>
                    </View>
                ) : !goalies.loading ? (
                    <T variant="caption" muted style={styles.note}>
                        Goalie stats appear once the starters are reported.
                    </T>
                ) : null}
            </Block>

            <Block title="Team stats">
                {teams.loading && !teams.data ? (
                    <View style={styles.skeletons}>
                        {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={22}/>)}
                    </View>
                ) : summary.home || summary.away ? (
                    <View>
                        <StatRow label="Goals for / gm" left={summary.home?.goalsForPerGame} right={summary.away?.goalsForPerGame}
                            format={fmt2} leftColor={homeColor} rightColor={awayColor}/>
                        <StatRow label="Goals against / gm" left={summary.home?.goalsAgainstPerGame} right={summary.away?.goalsAgainstPerGame}
                            format={fmt2} higherIsBetter={false} leftColor={homeColor} rightColor={awayColor}/>
                        <StatRow label="Power play %" left={summary.home?.powerPlayNetPct ?? summary.home?.powerPlayPct}
                            right={summary.away?.powerPlayNetPct ?? summary.away?.powerPlayPct}
                            format={fmtPct1} leftColor={homeColor} rightColor={awayColor}/>
                        <StatRow label="Penalty kill %" left={summary.home?.penaltyKillNetPct ?? summary.home?.penaltyKillPct}
                            right={summary.away?.penaltyKillNetPct ?? summary.away?.penaltyKillPct}
                            format={fmtPct1} leftColor={homeColor} rightColor={awayColor}/>
                        <StatRow label="Faceoff win %" left={summary.home?.faceoffWinPct} right={summary.away?.faceoffWinPct}
                            format={fmtPct1} leftColor={homeColor} rightColor={awayColor}/>
                        <StatRow label="Shots for / gm" left={summary.home?.shotsForPerGame} right={summary.away?.shotsForPerGame}
                            format={fmt2} leftColor={homeColor} rightColor={awayColor}/>
                    </View>
                ) : (
                    <T variant="caption" muted style={styles.note}>
                        {teams.error ? 'Couldn’t load team stats.' : 'No season stats yet.'}
                    </T>
                )}
            </Block>

            <Pressable
                accessibilityRole="button"
                onPress={() => {
                    tap();
                    onOpen(game);
                }}
                style={({pressed}) => [styles.openBtn, {backgroundColor: colors.text}, pressed && {opacity: 0.7}]}>
                <T variant="body" color={colors.background} style={styles.semibold}>Open game centre</T>
                <ArrowRight2 size={18} color={colors.background}/>
            </Pressable>
        </BottomSheetScrollView>
    );
}

const renderBackdrop = (props) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close"/>
);

/**
 * Long-press preview sheet. The parent owns `sheetRef` (present()/dismiss()) and the selected game;
 * needs a BottomSheetModalProvider above it.
 */
/** Grey sheet background that reaches below the screen, so the opening bounce never shows a gap. */
function SheetBackground({style}) {
    const {colors} = useAppTheme();
    return <View pointerEvents="none" style={[style, styles.background, {backgroundColor: colors.sheet}]}/>;
}

export default function GamePreviewSheet({sheetRef, game, model, onOpen, onDismiss}) {
    const {colors} = useAppTheme();
    const open = useCallback((g) => {
        sheetRef.current?.dismiss();
        onOpen(g);
    }, [sheetRef, onOpen]);
    const animationConfigs = useBottomSheetSpringConfigs({...SHEET_SPRING, overshootClamping: false});
    const handleIndicatorStyle = useMemo(() => ({backgroundColor: colors.textSecondary}), [colors.textSecondary]);
    return (
        <BottomSheetModal
            ref={sheetRef}
            snapPoints={SNAP_POINTS}
            enableDynamicSizing={false}
            enablePanDownToClose
            animationConfigs={animationConfigs}
            backdropComponent={renderBackdrop}
            backgroundComponent={SheetBackground}
            onDismiss={onDismiss}
            handleIndicatorStyle={handleIndicatorStyle}>
            <SheetSurface>
                {game ? <PreviewBody key={game.id} game={game} model={model} onOpen={open}/> : null}
            </SheetSurface>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    background: {borderTopLeftRadius: 15, borderTopRightRadius: 15, bottom: -120},
    sheetContent: {paddingHorizontal: GUTTER, paddingBottom: 40, gap: 20},
    headerRow: {justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10},
    headerCenter: {flex: 1, alignItems: 'center', paddingTop: 20, gap: 6},
    teamHeader: {width: 126, alignItems: 'center'},
    bigLogo: {transform: [{scale: 0.7}]},
    statusPill: {borderRadius: 25, paddingVertical: 5, paddingHorizontal: 15, maxWidth: '100%'},
    statusText: {fontFamily: 'Sora_500Medium', fontSize: 14, lineHeight: 20, textAlign: 'center'},
    block: {},
    blockTitle: {justifyContent: 'center', marginBottom: 10},
    between: {justifyContent: 'space-between'},
    bar: {marginTop: 10},
    goalieRow: {justifyContent: 'space-around', alignItems: 'flex-start'},
    goalie: {alignItems: 'center', gap: 6, width: 140},
    headshot: {borderWidth: 3, marginTop: 10},
    centerText: {textAlign: 'center'},
    semibold: {fontFamily: 'Sora_600SemiBold'},
    tabular: {fontVariant: ['tabular-nums']},
    compare: {marginTop: 10},
    statRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10},
    statValue: {fontFamily: 'Sora_600SemiBold', width: '30%', fontVariant: ['tabular-nums']},
    statLabel: {width: '40%', justifyContent: 'center'},
    right: {textAlign: 'right'},
    note: {marginTop: 12, textAlign: 'center'},
    skeletons: {gap: 14},
    openBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 15,
        borderRadius: 100,
        marginTop: 10,
    },
});
