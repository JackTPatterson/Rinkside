import React, {memo, useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, InfoTip, LiveDot, Row, T, TeamLogo, tap} from '../../components/ui';
import {Star1} from '../../components/icons';
import {useQuery} from '../../hooks/useQuery';
import {isFinal, isLive, isUpcoming} from '../../api/nhl';
import {moneypuck, preGameHomeWinProb} from '../../api/moneypuck';
import {GUTTER, useAppTheme} from '../../theme';
import {pct} from '../../utils/format';
import {currentSeasonId} from '../../utils/season';
import {gameSignature, isPostponed, statusLabel} from './gameLogic';

export const GAME_OF_NIGHT_INFO =
    'The upcoming game rated closest to a coin flip, weighted toward match-ups between two strong ' +
    'teams (by their scoring and goal-prevention ratings). It’s an estimate of the most competitive, ' +
    'highest-quality game on the slate — not a guarantee of fireworks.';

/** Last home win probability from a MoneyPuck gameData CSV (rows in time order), or null. */
function lastHomeWinProb(rows) {
    if (!Array.isArray(rows)) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
        const raw = rows[i]?.homeWinProbability;
        const v = Number(raw);
        if (raw != null && raw !== '' && Number.isFinite(v) && v >= 0 && v <= 1) return v;
    }
    return null;
}

/**
 * MoneyPuck home win probability for one game: pre-game prediction for upcoming games, the latest
 * in-game number for live ones. Missing files are normal → null.
 */
export function useMoneyPuckProb(game) {
    const id = game?.id;
    const live = isLive(game);
    const enabled = !!id && (live || (isUpcoming(game) && !isPostponed(game)));
    const season = game?.season ?? currentSeasonId();
    const {data} = useQuery(
        ({force}) => (live
            ? moneypuck.gameData(season, id, {force}).then(lastHomeWinProb, () => null)
            : preGameHomeWinProb(id).catch(() => null)),
        [id, live, season],
        {enabled, refetchInterval: live ? 60000 : 0, keepPreviousData: false},
    );
    return enabled && Number.isFinite(data) && data >= 0 && data <= 1 ? data : null;
}

// Old Rinkside card: logo (70x50 scaled .7) over the abbrev in plain Medium text.
function TeamSide({team, dim}) {
    return (
        <View style={[styles.side, dim && styles.dim]}>
            <TeamLogo abbrev={team?.abbrev} size={50} style={styles.logo}/>
            <T variant="body" numberOfLines={1} style={styles.abbrev}>{team?.abbrev ?? '—'}</T>
        </View>
    );
}

/** Live label "P2 · 12:34" / "P2 INT" → {period: 'P2', centre: '12:34' | 'INT'}; otherwise no period. Shown as the two status lines in the centre. */
function splitLive(label) {
    const s = String(label);
    if (s.includes(' · ')) {
        const [period, centre] = s.split(' · ');
        return {period, centre};
    }
    if (s.endsWith(' INT')) return {period: s.slice(0, -4), centre: 'INT'};
    return {period: null, centre: s};
}

const SUFFIX = {OT: 'Overtime', SO: 'Shootout'};

/**
 * Status as two lines of type instead of pills: a strong first line for the state and a quiet second
 * line for the detail. live → "● P2" (red) / "12:34" | "Intermission"; final → "Final" / "Overtime";
 * upcoming → "7:00 PM" / "Puck drop". Always two lines, so every card has the same rhythm.
 */
function StatusBlock({game, live, final}) {
    const {colors} = useAppTheme();
    const label = statusLabel(game);
    let head = label;
    let sub = null;
    let headColor = colors.text;
    if (live) {
        const {period, centre} = splitLive(label);
        head = period ?? centre;
        sub = period ? (centre === 'INT' ? 'Intermission' : centre) : null;
        headColor = colors.live;
    } else if (final) {
        const [h, suffix] = String(label).split(' · ');
        head = h;
        sub = SUFFIX[suffix] ?? suffix ?? null;
    } else if (game.gameState === 'FUT' && !isPostponed(game)) {
        sub = 'Puck drop';
    }
    return (
        <View style={styles.status}>
            <Row gap={5} style={styles.statusHead}>
                {live && !game.clock?.inIntermission ? <LiveDot size={7}/> : null}
                <T variant="body" color={headColor} numberOfLines={1} style={styles.statusText}>{head}</T>
            </Row>
            <T variant="caption" muted numberOfLines={1} style={styles.statusSub}>{sub ?? ' '}</T>
        </View>
    );
}

/**
 * Card centre: home value | status | away value. Values are the score once the game has one,
 * otherwise each side's win chance.
 */
function Center({game, live, final, homeP}) {
    const hs = game.homeTeam?.score;
    const as = game.awayTeam?.score;
    const hasScore = (live || final) && hs != null && as != null;
    const homeVal = hasScore ? String(hs) : homeP != null ? pct(homeP) : '--';
    const awayVal = hasScore ? String(as) : homeP != null ? pct(1 - homeP) : '--';
    return (
        <View style={styles.center}>
            <T variant="body" numberOfLines={1} adjustsFontSizeToFit
                style={[styles.value, styles.valueRight, final && Number(hs) < Number(as) && styles.dim]}>{homeVal}</T>
            <View style={styles.pills}>
                <StatusBlock game={game} live={live} final={final}/>
            </View>
            <T variant="body" numberOfLines={1} adjustsFontSizeToFit
                style={[styles.value, styles.valueLeft, final && Number(as) < Number(hs) && styles.dim]}>{awayVal}</T>
        </View>
    );
}

/**
 * One game in the scores list. Memoised with a custom comparator: each poll returns brand-new game
 * objects, so we compare a signature of the displayed fields and skip cards that didn't change.
 */
function GameCard({game, model, favorite, gameOfNight, modelPending, onOpen, onPreview}) {
    const {colors} = useAppTheme();
    const mp = useMoneyPuckProb(game);
    const live = isLive(game);
    const final = isFinal(game);
    const upcoming = !live && !final;

    const hs = Number(game.homeTeam?.score);
    const as = Number(game.awayTeam?.score);
    // MoneyPuck first (backtested better), Rinkside only when MoneyPuck has no number.
    const homeP = upcoming && !isPostponed(game) ? (mp ?? model?.home) : null;

    const onPress = useCallback(() => {
        tap();
        onOpen(game);
    }, [onOpen, game]);
    const onLongPress = useCallback(() => {
        tap();
        onPreview(game);
    }, [onPreview, game]);

    return (
        <Card
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityLabel={`${game.awayTeam?.abbrev ?? 'Away'} at ${game.homeTeam?.abbrev ?? 'Home'}, ${statusLabel(game)}. Long press for preview.`}
            style={styles.card}>
            {gameOfNight ? (
                <Row gap={6} style={styles.chipRow}>
                    <View style={[styles.chip, {backgroundColor: colors.background}]}>
                        <Star1 size={14} color={colors.warning} variant="Bold"/>
                        <T variant="caption" color={colors.warning}>Game of the night</T>
                    </View>
                    <InfoTip title="Game of the night" body={GAME_OF_NIGHT_INFO} size={14}/>
                </Row>
            ) : null}
            <View style={styles.main}>
                <TeamSide team={game.homeTeam} dim={final && hs < as}/>
                <Center game={game} live={live} final={final} homeP={homeP}/>
                <TeamSide team={game.awayTeam} dim={final && as < hs}/>
            </View>
        </Card>
    );
}

const areEqual = (a, b) =>
    a.model === b.model &&
    a.favorite === b.favorite &&
    a.gameOfNight === b.gameOfNight &&
    a.modelPending === b.modelPending &&
    a.onOpen === b.onOpen &&
    a.onPreview === b.onPreview &&
    (a.game === b.game || gameSignature(a.game) === gameSignature(b.game));

export default memo(GameCard, areEqual);

const styles = StyleSheet.create({
    card: {marginHorizontal: GUTTER, marginBottom: 4, borderRadius: 15, paddingVertical: 15},
    main: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
    side: {flex: 1, alignItems: 'center'},
    logo: {transform: [{scale: 0.7}]},
    abbrev: {fontFamily: 'Sora_500Medium'},
    center: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
    value: {width: 52, fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26, paddingVertical: 4, fontVariant: ['tabular-nums']},
    valueRight: {textAlign: 'right', marginRight: 10},
    valueLeft: {textAlign: 'left', marginLeft: 10},
    // Fixed widths (status column and both value columns) so scores line up down the whole list.
    pills: {alignItems: 'center', width: 128},
    status: {alignItems: 'center', alignSelf: 'stretch'},
    statusHead: {justifyContent: 'center'},
    statusText: {fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums']},
    statusSub: {fontVariant: ['tabular-nums'], marginTop: 1},
    dim: {opacity: 0.45},
    chipRow: {marginBottom: 8},
    chip: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 15},
});
