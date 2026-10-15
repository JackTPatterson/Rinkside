import {BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView} from '@gorhom/bottom-sheet';
import React, {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {CompareRow, Headshot, InfoTip, Row, Skeleton, SplitBar, T, TeamLogo, tap} from '../../components/ui';
import {ArrowRight2} from '../../components/icons';
import {useQuery} from '../../hooks/useQuery';
import {headshotUrl, nhl} from '../../api/nhl';
import {startingGoalieWithStats} from '../../api/moneypuck';
import {getTeam} from '../../data/teams';
import {useAppTheme} from '../../theme';
import {loc, num, pct, savePct, signed} from '../../utils/format';
import {currentSeasonId} from '../../utils/season';
import {useMoneyPuckProb} from './GameCard';
import {statusLabel} from './gameLogic';

const SNAP_POINTS = ['80%'];

const INFO = {
    winProb:
        'Rinkside’s game model turns each team’s scoring and goal-prevention rates (adjusted for home ice) into ' +
        'a win chance. It’s a model estimate, not a sure thing. MoneyPuck’s number comes from their own model when available.',
    savePct: 'Share of shots on goal the goalie stopped this season.',
    gaa: 'Goals allowed per 60 minutes played. Lower is better, but it also reflects the defence in front of him.',
    gsax:
        'Goals Saved Above Expected: goals MoneyPuck’s shot-quality model expected him to allow minus goals he actually ' +
        'allowed. Positive means he’s stopping more than an average goalie would on the same shots.',
    ppPct: 'Share of power plays that end with a goal (net of short-handed goals allowed).',
    pkPct: 'Share of times shorthanded that the team didn’t allow a goal (net of short-handed goals scored).',
};

const fmt2 = (v) => num(v, 2);
const fmtPct1 = (v) => pct(v, 1);

function TeamHeader({team, align}) {
    const meta = getTeam(team?.abbrev);
    return (
        <View style={[styles.teamHeader, {alignItems: align}]}>
            <TeamLogo abbrev={team?.abbrev} size={48}/>
            <T variant="heading">{team?.abbrev ?? '—'}</T>
            <T variant="caption" muted numberOfLines={1}>{meta?.name ?? loc(team?.name)}</T>
        </View>
    );
}

function GoalieColumn({goalie, abbrev, season, loading}) {
    const {teamColor} = useAppTheme();
    if (loading) {
        return (
            <View style={styles.goalie}>
                <Skeleton width={72} height={72} radius={36}/>
                <Skeleton width={90} height={14}/>
            </View>
        );
    }
    return (
        <View style={styles.goalie}>
            <Headshot
                uri={goalie?.id ? headshotUrl(goalie.id, abbrev, season) : undefined}
                size={72}
                borderColor={teamColor(abbrev)}
            />
            <T variant="label" numberOfLines={2} style={styles.centerText}>{goalie?.name || 'Not announced'}</T>
            {goalie?.confirmedBy ? (
                <T variant="caption" muted numberOfLines={1}>via {goalie.confirmedBy}</T>
            ) : null}
        </View>
    );
}

function Block({title, info, children}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.block, {backgroundColor: colors.card}]}>
            <Row gap={6} style={styles.blockTitle}>
                <T variant="heading">{title}</T>
                {info ? <InfoTip title={title} body={info}/> : null}
            </Row>
            {children}
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
    const left = model?.home ?? mp;

    return (
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            <Row style={styles.headerRow}>
                <TeamHeader team={game.homeTeam} align="flex-start"/>
                <View style={styles.headerCenter}>
                    <T variant="label" numberOfLines={1}>{statusLabel(game)}</T>
                    {game.homeTeam?.score != null && game.awayTeam?.score != null ? (
                        <T variant="stat">{game.homeTeam.score} – {game.awayTeam.score}</T>
                    ) : null}
                    {game.venue ? <T variant="caption" muted numberOfLines={1}>{loc(game.venue)}</T> : null}
                </View>
                <TeamHeader team={game.awayTeam} align="flex-end"/>
            </Row>

            {left != null ? (
                <Block title="Win probability" info={INFO.winProb}>
                    <Row style={styles.between}>
                        <T variant="label" color={homeColor}>{home} {pct(left)}</T>
                        <T variant="label" color={awayColor}>{pct(1 - left)} {away}</T>
                    </Row>
                    <SplitBar left={left} leftColor={homeColor} rightColor={awayColor} height={8} style={styles.bar}/>
                    <T variant="caption" muted>
                        {model ? (model.kind === 'live' ? 'Rinkside live model' : 'Rinkside model') : 'MoneyPuck'}
                        {model && mp != null ? ` · MoneyPuck ${home} ${pct(mp)}` : ''}
                    </T>
                </Block>
            ) : null}

            <Block title="Starting goalies">
                <Row style={styles.goalieRow}>
                    <GoalieColumn goalie={homeGoalie} abbrev={home} season={season} loading={goalies.loading}/>
                    <GoalieColumn goalie={awayGoalie} abbrev={away} season={season} loading={goalies.loading}/>
                </Row>
                {hs || as ? (
                    <View style={styles.compare}>
                        <CompareRow label="Save %" left={hs?.savePct} right={as?.savePct} format={savePct}
                            leftColor={homeColor} rightColor={awayColor} info={INFO.savePct}/>
                        <CompareRow label="GAA" left={hs?.gaa} right={as?.gaa} format={fmt2} higherIsBetter={false}
                            leftColor={homeColor} rightColor={awayColor} info={INFO.gaa}/>
                        <CompareRow label="GSAx" left={hs?.gsax} right={as?.gsax} format={(v) => signed(v, 1)}
                            leftColor={homeColor} rightColor={awayColor} info={INFO.gsax}/>
                        <CompareRow label="Games played" left={hs?.gamesPlayed} right={as?.gamesPlayed} format={(v) => num(v)}
                            leftColor={homeColor} rightColor={awayColor}/>
                    </View>
                ) : !goalies.loading ? (
                    <T variant="caption" muted style={styles.note}>
                        Goalie stats appear once MoneyPuck reports the starters.
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
                        <CompareRow label="Goals for / gm" left={summary.home?.goalsForPerGame} right={summary.away?.goalsForPerGame}
                            format={fmt2} leftColor={homeColor} rightColor={awayColor}/>
                        <CompareRow label="Goals against / gm" left={summary.home?.goalsAgainstPerGame} right={summary.away?.goalsAgainstPerGame}
                            format={fmt2} higherIsBetter={false} leftColor={homeColor} rightColor={awayColor}/>
                        <CompareRow label="Power play %" left={summary.home?.powerPlayNetPct ?? summary.home?.powerPlayPct}
                            right={summary.away?.powerPlayNetPct ?? summary.away?.powerPlayPct}
                            format={fmtPct1} leftColor={homeColor} rightColor={awayColor} info={INFO.ppPct}/>
                        <CompareRow label="Penalty kill %" left={summary.home?.penaltyKillNetPct ?? summary.home?.penaltyKillPct}
                            right={summary.away?.penaltyKillNetPct ?? summary.away?.penaltyKillPct}
                            format={fmtPct1} leftColor={homeColor} rightColor={awayColor} info={INFO.pkPct}/>
                        <CompareRow label="Faceoff win %" left={summary.home?.faceoffWinPct} right={summary.away?.faceoffWinPct}
                            format={fmtPct1} leftColor={homeColor} rightColor={awayColor}/>
                        <CompareRow label="Shots for / gm" left={summary.home?.shotsForPerGame} right={summary.away?.shotsForPerGame}
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
                <T variant="label" color={colors.background}>Open game centre</T>
                <ArrowRight2 size={16} color={colors.background}/>
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
export default function GamePreviewSheet({sheetRef, game, model, onOpen, onDismiss}) {
    const {colors} = useAppTheme();
    const open = useCallback((g) => {
        sheetRef.current?.dismiss();
        onOpen(g);
    }, [sheetRef, onOpen]);
    return (
        <BottomSheetModal
            ref={sheetRef}
            snapPoints={SNAP_POINTS}
            enableDynamicSizing={false}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            onDismiss={onDismiss}
            backgroundStyle={{backgroundColor: colors.background}}
            handleIndicatorStyle={{backgroundColor: colors.textSecondary}}>
            {game ? <PreviewBody key={game.id} game={game} model={model} onOpen={open}/> : null}
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetContent: {paddingHorizontal: 16, paddingBottom: 40, gap: 12},
    headerRow: {justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4},
    headerCenter: {flex: 1, alignItems: 'center', paddingTop: 12, gap: 2},
    teamHeader: {width: 110, gap: 2},
    block: {borderRadius: 16, padding: 14},
    blockTitle: {marginBottom: 12},
    between: {justifyContent: 'space-between'},
    bar: {marginVertical: 8},
    goalieRow: {justifyContent: 'space-around', alignItems: 'flex-start'},
    goalie: {alignItems: 'center', gap: 6, width: 130},
    centerText: {textAlign: 'center'},
    compare: {marginTop: 16},
    note: {marginTop: 12, textAlign: 'center'},
    skeletons: {gap: 14},
    openBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 999,
        marginTop: 4,
    },
});
