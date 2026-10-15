import React, {memo, useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {InfoTip, LiveDot, Row, SplitBar, T, TeamLogo, tap, Card} from '../../components/ui';
import {Star1} from '../../components/icons';
import {useQuery} from '../../hooks/useQuery';
import {isFinal, isLive, isUpcoming} from '../../api/nhl';
import {moneypuck, preGameHomeWinProb} from '../../api/moneypuck';
import {useAppTheme, withAlpha} from '../../theme';
import {pct} from '../../utils/format';
import {currentSeasonId} from '../../utils/season';
import {gameSignature, isPostponed, statusLabel} from './gameLogic';

export const GAME_OF_NIGHT_INFO =
    'The upcoming game our model rates closest to a coin flip, weighted toward match-ups between two strong ' +
    'teams (by their scoring and goal-prevention ratings). It’s a model estimate of the most competitive, ' +
    'highest-quality game on the slate — not a guarantee of fireworks.';

/** Last home win probability from a MoneyPuck gameData CSV (rows in time order), or null. */
function lastHomeWinProb(rows) {
    if (!Array.isArray(rows)) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
        const v = Number(rows[i]?.homeWinProbability);
        if (rows[i]?.homeWinProbability != null && rows[i]?.homeWinProbability !== '' && Number.isFinite(v)) return v;
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
    return enabled && Number.isFinite(data) ? data : null;
}

function TeamSide({team, sub, dim}) {
    return (
        <View style={[styles.side, dim && styles.dim]}>
            <TeamLogo abbrev={team?.abbrev} size={34}/>
            <T variant="label" numberOfLines={1}>{team?.abbrev ?? '—'}</T>
            {sub ? <T variant="caption" muted numberOfLines={1}>{sub}</T> : <View style={styles.subSpacer}/>}
        </View>
    );
}

function Center({game, live, final, upcoming}) {
    const {colors} = useAppTheme();
    const hs = game.homeTeam?.score;
    const as = game.awayTeam?.score;
    const hasScore = (live || final) && hs != null && as != null;
    const label = statusLabel(game);
    if (!hasScore) {
        return (
            <View style={styles.center}>
                <T variant="heading" numberOfLines={1} adjustsFontSizeToFit>{label}</T>
                {upcoming && game.gameState === 'FUT' && !isPostponed(game) ? (
                    <T variant="caption" muted numberOfLines={1}>Puck drop</T>
                ) : null}
            </View>
        );
    }
    const homeLead = Number(hs) > Number(as);
    const awayLead = Number(as) > Number(hs);
    return (
        <View style={styles.center}>
            <Row gap={10}>
                <T variant="stat" style={final && !homeLead ? styles.dim : null}>{hs}</T>
                <T variant="stat" muted>–</T>
                <T variant="stat" style={final && !awayLead ? styles.dim : null}>{as}</T>
            </Row>
            <Row gap={6}>
                {live && !game.clock?.inIntermission ? <LiveDot size={7}/> : null}
                <T variant="caption" color={live ? colors.live : undefined} muted={!live} numberOfLines={1}>{label}</T>
            </Row>
        </View>
    );
}

function WinProbability({game, model, mp, homeColor, awayColor}) {
    const {colors} = useAppTheme();
    const home = game.homeTeam?.abbrev;
    const away = game.awayTeam?.abbrev;
    const left = model?.home ?? mp;
    if (left == null) return null;
    const right = model ? model.away : 1 - mp;
    const live = model?.kind === 'live' || (!model && isLive(game));
    return (
        <View style={[styles.prob, {borderTopColor: colors.border}]}>
            <Row style={styles.between}>
                <T variant="label" color={homeColor}>{home} {pct(left)}</T>
                <T variant="label" color={awayColor}>{pct(right)} {away}</T>
            </Row>
            <SplitBar left={left} leftColor={homeColor} rightColor={awayColor} height={6} style={styles.bar}/>
            <Row style={styles.between}>
                <T variant="caption" muted>{model ? (live ? 'Rinkside live model' : 'Rinkside model') : 'MoneyPuck'}</T>
                {model && mp != null ? <T variant="caption" muted>MoneyPuck {home} {pct(mp)}</T> : null}
            </Row>
        </View>
    );
}

/**
 * One game in the scores list. Memoised with a custom comparator: each poll returns brand-new game
 * objects, so we compare a signature of the displayed fields and skip cards that didn't change.
 */
function GameCard({game, model, favorite, gameOfNight, onOpen, onPreview}) {
    const {colors, teamColor} = useAppTheme();
    const mp = useMoneyPuckProb(game);
    const live = isLive(game);
    const final = isFinal(game);
    const upcoming = !live && !final;
    const homeAbbrev = game.homeTeam?.abbrev;
    const awayAbbrev = game.awayTeam?.abbrev;
    const homeColor = teamColor(homeAbbrev);
    let awayColor = teamColor(awayAbbrev);
    if (awayColor === homeColor) awayColor = colors.textSecondary;

    const hs = Number(game.homeTeam?.score);
    const as = Number(game.awayTeam?.score);
    const sub = (team) => {
        if ((live || final) && team?.sog != null) return `SOG ${team.sog}`;
        if (upcoming && team?.record) return team.record;
        return null;
    };

    const onPress = useCallback(() => {
        tap();
        onOpen(game);
    }, [onOpen, game]);
    const onLongPress = useCallback(() => {
        tap();
        onPreview(game);
    }, [onPreview, game]);

    const borderColor = favorite ? teamColor(favorite) : gameOfNight ? colors.warning : null;

    return (
        <Card
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityLabel={`${game.awayTeam?.abbrev ?? ''} at ${game.homeTeam?.abbrev ?? ''}, ${statusLabel(game)}. Long press for preview.`}
            style={[styles.card, borderColor && {borderWidth: 1.5, borderColor}]}>
            {gameOfNight ? (
                <Row gap={6} style={styles.chipRow}>
                    <View style={[styles.chip, {backgroundColor: withAlpha(colors.warning, 0.16)}]}>
                        <Star1 size={14} color={colors.warning} variant="Bold"/>
                        <T variant="caption" color={colors.warning}>Game of the night</T>
                    </View>
                    <InfoTip title="Game of the night" body={GAME_OF_NIGHT_INFO} size={14}/>
                </Row>
            ) : null}
            <View style={styles.main}>
                <TeamSide team={game.homeTeam} sub={sub(game.homeTeam)} dim={final && hs < as}/>
                <Center game={game} live={live} final={final} upcoming={upcoming}/>
                <TeamSide team={game.awayTeam} sub={sub(game.awayTeam)} dim={final && as < hs}/>
            </View>
            {final ? (
                model ? (
                    <T variant="caption" muted style={styles.pregame}>
                        Pre-game model: {homeAbbrev} {pct(model.home)} · {awayAbbrev} {pct(model.away)}
                    </T>
                ) : null
            ) : isPostponed(game) ? null : (
                <WinProbability game={game} model={model} mp={mp} homeColor={homeColor} awayColor={awayColor}/>
            )}
        </Card>
    );
}

const areEqual = (a, b) =>
    a.model === b.model &&
    a.favorite === b.favorite &&
    a.gameOfNight === b.gameOfNight &&
    a.onOpen === b.onOpen &&
    a.onPreview === b.onPreview &&
    (a.game === b.game || gameSignature(a.game) === gameSignature(b.game));

export default memo(GameCard, areEqual);

const styles = StyleSheet.create({
    card: {marginHorizontal: 16, marginBottom: 8},
    main: {flexDirection: 'row', alignItems: 'center'},
    side: {flex: 1, alignItems: 'center', gap: 2},
    subSpacer: {height: 16},
    center: {width: 120, alignItems: 'center', gap: 2},
    dim: {opacity: 0.45},
    prob: {marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 6},
    between: {justifyContent: 'space-between'},
    bar: {marginVertical: 1},
    pregame: {marginTop: 10, textAlign: 'center'},
    chipRow: {marginBottom: 8},
    chip: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999},
});
