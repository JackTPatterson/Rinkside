import React, {memo, useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Card, InfoTip, LiveDot, Row, SplitBar, T, TeamLogo} from '../../components/ui';
import {useNow} from '../../hooks/useQuery';
import {useAppTheme} from '../../theme';
import {formatTime, parseISODate, pct, periodLabel, relativeDayLabel, secondsToMMSS} from '../../utils/format';
import {powerPlayState} from './model';

function useIntermissionClock(header) {
    const {inIntermission, secondsRemaining, timeRemaining} = header.clock;
    const anchor = useRef({at: Date.now(), secs: secondsRemaining});
    useEffect(() => {
        anchor.current = {at: Date.now(), secs: secondsRemaining};
    }, [secondsRemaining]);
    const now = useNow(1000, inIntermission && secondsRemaining != null);
    if (!inIntermission || anchor.current.secs == null) return timeRemaining;
    return secondsToMMSS(Math.max(0, anchor.current.secs - (now - anchor.current.at) / 1000));
}

function StatusLine({header}) {
    const {colors} = useAppTheme();
    const intermission = useIntermissionClock(header);
    if (header.final) {
        const extra = header.lastPeriodType && header.lastPeriodType !== 'REG' ? ` · ${header.lastPeriodType}` : '';
        return <T variant="label">Final{extra}</T>;
    }
    if (header.live) {
        const p = periodLabel(header.period, header.periodType);
        return (
            <Row gap={6}>
                <LiveDot/>
                <T variant="label" color={colors.live}>
                    {header.clock.inIntermission ? `${p} INT · ${intermission}` : `${p} · ${header.clock.timeRemaining}`}
                </T>
            </Row>
        );
    }
    if (header.state === 'PRE') return <T variant="label">Pregame</T>;
    if (header.state === 'PPD' || header.state === 'POSTPONED') return <T variant="label">Postponed</T>;
    if (!header.startTimeUTC) return <T variant="label" muted>Scheduled</T>;
    const d = new Date(header.startTimeUTC);
    return (
        <View style={{alignItems: 'center'}}>
            <T variant="label">{formatTime(d)}</T>
            <T variant="caption" muted>{relativeDayLabel(header.gameDate ? parseISODate(header.gameDate) : d)}</T>
        </View>
    );
}

const TeamColumn = memo(function TeamColumn({team, wp, showWp, pp, en, ppTime}) {
    const {colors, teamColor} = useAppTheme();
    return (
        <View style={styles.teamCol}>
            {showWp ? (
                <View style={[styles.wpPill, {backgroundColor: colors.cardAlt}]}>
                    <T variant="label">{pct(wp, wp > 0.99 || wp < 0.01 ? 1 : 0)}</T>
                </View>
            ) : <View style={styles.wpSpacer}/>}
            <TeamLogo abbrev={team.abbrev} size={52}/>
            <T variant="label" numberOfLines={1} style={styles.center}>{team.shortName}</T>
            <View style={styles.badges}>
                {pp ? <Badge label={pp} color={colors.live}/> : null}
                {en ? <Badge label="EN" color={colors.live}/> : null}
            </View>
            {pp && ppTime ? <T variant="caption" muted>{ppTime}</T> : null}
            {!pp && !en ? <View style={{height: 2, width: 28, borderRadius: 2, backgroundColor: teamColor(team.abbrev)}}/> : null}
        </View>
    );
});

/**
 * Score header: team columns (home left, as in the original app), clock / status,
 * power-play state and the win-probability bar.
 */
function Scoreboard({header, wp, wpSource}) {
    const {colors, teamColor} = useAppTheme();
    const {home, away} = header;
    const pp = header.live ? powerPlayState(header.situation) : null;
    const showWp = !header.final && Number.isFinite(wp);
    const series = header.seriesStatus;
    const seriesText = series && series.topSeedTeamAbbrev ? (() => {
        const homeTop = series.topSeedTeamAbbrev === home.abbrev;
        const hw = homeTop ? series.topSeedWins : series.bottomSeedWins;
        const aw = homeTop ? series.bottomSeedWins : series.topSeedWins;
        return `Series ${hw ?? 0}–${aw ?? 0}`;
    })() : null;

    return (
        <Card style={styles.card}>
            <View style={styles.row}>
                <TeamColumn team={home} wp={wp} showWp={showWp} pp={pp?.homePP} en={pp?.homeEN} ppTime={pp?.time}/>
                <View style={styles.middle}>
                    <StatusLine header={header}/>
                    {header.started ? (
                        <Row gap={10} style={{marginTop: 6}}>
                            <T variant="display" style={{opacity: header.final && home.score < away.score ? 0.55 : 1}}>{home.score ?? 0}</T>
                            <T variant="heading" muted>–</T>
                            <T variant="display" style={{opacity: header.final && away.score < home.score ? 0.55 : 1}}>{away.score ?? 0}</T>
                        </Row>
                    ) : null}
                    {header.started && home.sog != null ? (
                        <T variant="caption" muted>SOG {home.sog} – {away.sog ?? 0}</T>
                    ) : null}
                    {pp?.even ? <Badge label={pp.even} color={colors.live} style={{marginTop: 6, alignSelf: 'center'}}/> : null}
                    {seriesText ? <T variant="caption" muted style={{marginTop: 4}}>{seriesText}</T> : null}
                </View>
                <TeamColumn team={away} wp={1 - wp} showWp={showWp} pp={pp?.awayPP} en={pp?.awayEN} ppTime={pp?.time}/>
            </View>
            {Number.isFinite(wp) ? (
                <View style={{marginTop: 14}}>
                    <SplitBar left={wp} leftColor={teamColor(home.abbrev)} rightColor={teamColor(away.abbrev)} height={8}/>
                    {!header.final && wpSource ? (
                        <Row gap={4} style={{justifyContent: 'center', marginTop: 6}}>
                            <T variant="caption" muted>Win probability · {wpSource}</T>
                            <InfoTip
                                size={13}
                                title="Win probability"
                                body={wpSource === 'MoneyPuck'
                                    ? 'MoneyPuck’s model estimate of each team’s chance to win, updated through the game.'
                                    : 'Rinkside’s model estimate of each team’s chance to win, from team scoring rates, the score, the clock and the manpower situation.'}
                            />
                        </Row>
                    ) : null}
                </View>
            ) : null}
            {header.venue ? <T variant="caption" muted style={[styles.center, {marginTop: 8}]}>{header.venue}</T> : null}
        </Card>
    );
}

export default memo(Scoreboard);

const styles = StyleSheet.create({
    card: {marginHorizontal: 16, paddingVertical: 16},
    row: {flexDirection: 'row', alignItems: 'flex-start'},
    teamCol: {flex: 1, alignItems: 'center', gap: 6},
    middle: {flex: 1.1, alignItems: 'center', paddingTop: 30},
    wpPill: {paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999},
    wpSpacer: {height: 24},
    badges: {flexDirection: 'row', gap: 4},
    center: {textAlign: 'center'},
});
