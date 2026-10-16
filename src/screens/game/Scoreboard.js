import React, {memo, useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {LiveDot, SplitBar, T, TeamLogo} from '../../components/ui';
import {useNow} from '../../hooks/useQuery';
import {GUTTER, useAppTheme} from '../../theme';
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

/** Status pill in the middle column (old: colors.card pill, radius 30, Medium 16). */
function StatusPill({children, live}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.statusPill, {backgroundColor: colors.card}]}>
            {live ? <LiveDot size={8}/> : null}
            <T variant="body" numberOfLines={1} style={[styles.center, styles.statusText]}>{children}</T>
        </View>
    );
}

/** Game status (Final / period + clock / pregame). Shown in the screen header's top-right once the game has started. */
export function StatusLine({header}) {
    const intermission = useIntermissionClock(header);
    if (header.final) {
        const extra = header.lastPeriodType && header.lastPeriodType !== 'REG' ? ` • ${header.lastPeriodType}` : '';
        return <StatusPill>Final{extra}</StatusPill>;
    }
    if (header.live) {
        const p = periodLabel(header.period, header.periodType);
        return (
            <StatusPill live>
                {header.clock.inIntermission ? `${p} INT • ${intermission}` : `${p} • ${header.clock.timeRemaining}`}
            </StatusPill>
        );
    }
    if (header.state === 'PRE') return <StatusPill>Pregame</StatusPill>;
    if (header.state === 'PPD' || header.state === 'POSTPONED') return <StatusPill>Postponed</StatusPill>;
    if (!header.startTimeUTC) return <StatusPill>Scheduled</StatusPill>;
    const d = new Date(header.startTimeUTC);
    return (
        // Plain text, no pills: day on top, puck-drop time underneath.
        <View style={styles.when}>
            <T variant="body" muted numberOfLines={1} style={styles.center}>{relativeDayLabel(header.gameDate ? parseISODate(header.gameDate) : d)}</T>
            <T variant="heading" numberOfLines={1} adjustsFontSizeToFit style={[styles.center, styles.whenTime]}>{formatTime(d)}</T>
        </View>
    );
}

/** Red manpower pill (old "5 on 4" / "EN" badge). */
function PPPill({label}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.ppPill, {backgroundColor: colors.live}]}>
            <T variant="body" color="#FFFFFF" style={styles.ppText}>{label}</T>
        </View>
    );
}

const TeamColumn = memo(function TeamColumn({team, wp, showWp, pp, en, ppTime}) {
    const {colors} = useAppTheme();
    return (
        <View style={styles.teamCol}>
            {showWp ? (
                <View style={[styles.wpPill, {backgroundColor: colors.card}]}>
                    <T variant="body" style={styles.wpText}>{pct(wp, wp > 0.99 || wp < 0.01 ? 1 : 0)}</T>
                </View>
            ) : null}
            <TeamLogo abbrev={team.abbrev} size={50} style={{marginTop: 10}}/>
            <T variant="body" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.teamName}>{team.shortName}</T>
            {pp ? <PPPill label={pp}/> : null}
            {en ? <PPPill label="EN"/> : null}
            {pp && ppTime ? <T variant="body" style={styles.ppTime}>{ppTime}</T> : null}
        </View>
    );
});

/** Status pill centred between the two scores: white "FINAL" / red "P2 · 12:34" while live. */
function StatusBadge({header}) {
    const {colors} = useAppTheme();
    const intermission = useIntermissionClock(header);
    let label;
    if (header.final) label = `Final${header.lastPeriodType && header.lastPeriodType !== 'REG' ? ` · ${header.lastPeriodType}` : ''}`;
    else {
        const p = periodLabel(header.period, header.periodType);
        label = header.clock.inIntermission ? `${p} INT · ${intermission}` : `${p} · ${header.clock.timeRemaining}`;
    }
    return (
        <View style={[styles.badge, {backgroundColor: header.live ? colors.live : colors.text}]}>
            <T variant="body" color={header.live ? '#FFFFFF' : colors.background} numberOfLines={1} style={styles.badgeText}>{label.toUpperCase()}</T>
        </View>
    );
}

/** One side of the started-game score row: logo over abbrev, then the big score over SOG. */
function ScoreSide({team, right, lost}) {
    return (
        <View style={[styles.side, right && styles.sideRight]}>
            <View style={styles.logoCol}>
                <TeamLogo abbrev={team.abbrev} size={36}/>
                <T variant="body" style={styles.abbr}>{team.abbrev}</T>
            </View>
            <View style={[styles.scoreCol, right && styles.alignEnd, lost && styles.lost]}>
                <T variant="body" style={styles.bigScore}>{team.score ?? 0}</T>
                {team.sog != null ? <T variant="caption" muted style={styles.sog}>{team.sog} SOG</T> : null}
            </View>
        </View>
    );
}

/**
 * Score header in the original layout: home | status + score | away, straight on the background,
 * win-probability pills over each logo and a full-width team-colour bar underneath.
 */
function Scoreboard({header, wp}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const pp = header.live ? powerPlayState(header.situation) : null;
    const series = header.seriesStatus;
    const seriesText = series && series.topSeedTeamAbbrev ? (() => {
        const homeTop = series.topSeedTeamAbbrev === home.abbrev;
        const hw = homeTop ? series.topSeedWins : series.bottomSeedWins;
        const aw = homeTop ? series.bottomSeedWins : series.topSeedWins;
        return `Series ${hw ?? 0} • ${aw ?? 0}`;
    })() : null;

    return (
        <View style={styles.wrap}>
            {header.started ? (
                <View>
                    <View style={styles.scoreRow}>
                        <ScoreSide team={home} lost={header.final && home.score < away.score}/>
                        <ScoreSide team={away} right lost={header.final && away.score < home.score}/>
                        <View pointerEvents="none" style={styles.scoreMiddle}>
                            <StatusBadge header={header}/>
                            {pp?.even ? <PPPill label={pp.even}/> : null}
                            {pp?.homePP || pp?.awayPP ? <PPPill label={`${pp.homePP ? home.abbrev : away.abbrev} ${pp.homePP ?? pp.awayPP}`}/> : null}
                            {pp?.homeEN || pp?.awayEN ? <PPPill label={`${pp.homeEN ? home.abbrev : away.abbrev} EN`}/> : null}
                        </View>
                    </View>
                    {seriesText ? <T variant="body" style={styles.sub}>{seriesText}</T> : null}
                </View>
            ) : (
                <View style={styles.row}>
                    <TeamColumn team={home} wp={wp} showWp={false}/>
                    <View style={styles.middle}>
                        {/* Centred on the logos (which sit 10pt down, 50pt tall), not the top of the row. */}
                        <View style={styles.whenSlot}>
                            <StatusLine header={header}/>
                        </View>
                        {seriesText ? <T variant="body" style={styles.sub}>{seriesText}</T> : null}
                    </View>
                    <TeamColumn team={away} wp={1 - wp} showWp={false}/>
                </View>
            )}
            {header.live && Number.isFinite(wp) ? (
                <View style={{marginTop: 20}}>
                    <SplitBar left={wp} leftColor={teamColor(home.abbrev)} rightColor={teamColor(away.abbrev)} height={10}/>
                </View>
            ) : null}
            {header.venue ? <T variant="caption" muted style={[styles.center, {marginTop: 8}]}>{header.venue}</T> : null}
        </View>
    );
}

export default memo(Scoreboard);

const styles = StyleSheet.create({
    wrap: {paddingHorizontal: GUTTER, paddingTop: 10},
    row: {flexDirection: 'row', alignItems: 'flex-start'},
    teamCol: {width: '33%', alignItems: 'center'},
    middle: {width: '34%', alignItems: 'center'},
    whenSlot: {marginTop: 10, minHeight: 50, justifyContent: 'center', alignItems: 'center'},
    wpPill: {paddingHorizontal: 15, paddingVertical: 4, borderRadius: 100},
    wpText: {fontFamily: 'Sora_500Medium', fontSize: 20, lineHeight: 26},
    teamName: {fontFamily: 'Sora_600SemiBold', fontSize: 18, lineHeight: 24, textAlign: 'center', marginTop: 6},
    when: {alignItems: 'center', gap: 2},
    whenTime: {fontFamily: 'Sora_600SemiBold', fontVariant: ['tabular-nums']},
    // 36pt tall to match the round recap / listen button beside it in the header.
    statusText: {fontFamily: 'Sora_500Medium', fontSize: 15, lineHeight: 19, fontVariant: ['tabular-nums']},
    statusPill: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 100},
    ppPill: {borderRadius: 100, marginTop: 10, paddingHorizontal: 15, paddingVertical: 4},
    ppText: {fontFamily: 'Sora_500Medium', fontSize: 20, lineHeight: 26, textAlign: 'center'},
    ppTime: {fontFamily: 'Sora_400Regular', marginTop: 10, textAlign: 'center'},
    sub: {fontFamily: 'Sora_600SemiBold', fontSize: 14, opacity: 0.5, marginTop: 4, textAlign: 'center'},
    center: {textAlign: 'center'},
    // Started-game score row (App Store build): sides at the edges, manpower pills centred between.
    scoreRow: {flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', width: '100%', paddingTop: 6, paddingHorizontal: 10},
    // Each side takes half the row, so the two teams sit at the far edges whatever the score width.
    side: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14},
    sideRight: {flexDirection: 'row-reverse'},
    logoCol: {alignItems: 'center', gap: 6},
    abbr: {fontFamily: 'Sora_700Bold', fontSize: 17, lineHeight: 22},
    scoreCol: {alignItems: 'flex-start'},
    alignEnd: {alignItems: 'flex-end'},
    lost: {opacity: 0.55},
    bigScore: {fontFamily: 'Sora_800ExtraBold', fontSize: 54, lineHeight: 60, fontVariant: ['tabular-nums']},
    sog: {fontFamily: 'Sora_500Medium', fontSize: 13, lineHeight: 17},
    badge: {paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100},
    badgeText: {fontFamily: 'Sora_600SemiBold', fontSize: 13, lineHeight: 17, fontVariant: ['tabular-nums']},
    // Explicit insets (not absoluteFillObject) so the pill always overlays the centre of the row.
    scoreMiddle: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 6},
});
