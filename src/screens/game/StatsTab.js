import React, {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {EmptyState, Row, SplitBar, T, TeamLogo} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {pct} from '../../utils/format';
import {parseFraction, shotsByPeriod, teamGameStats} from './model';
import PlayoffImpact from './PlayoffImpact';

const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
};

/** Which side leads a stat: 'left' | 'right' | null (tie / no data). */
function leader(l, r, higherIsBetter) {
    if (l == null || r == null || l === r) return null;
    return (l > r) === higherIsBetter ? 'left' : 'right';
}

/** Small-caps group heading. */
const Heading = ({children}) => <T variant="caption" muted style={styles.heading}>{children.toUpperCase()}</T>;

/** Team key: home on the left, away on the right, matching every row below. */
function TeamKey({home, away}) {
    return (
        <Row style={styles.key}>
            <Row gap={8}>
                <TeamLogo abbrev={home} size={22}/>
                <T variant="body" style={styles.semi}>{home}</T>
            </Row>
            <Row gap={8}>
                <T variant="body" style={styles.semi}>{away}</T>
                <TeamLogo abbrev={away} size={22}/>
            </Row>
        </Row>
    );
}

/**
 * One stat: "value  label  value" with one split bar under it. The side that's ahead is bold,
 * the other muted. `share` overrides the bar split (e.g. percentages).
 */
function Line({label, left, right, format = String, leftText, rightText, higherIsBetter = true, share, hc, ac}) {
    const {colors} = useAppTheme();
    if (left == null && right == null) return null;
    const lead = leader(left, right, higherIsBetter);
    const total = Math.abs(left ?? 0) + Math.abs(right ?? 0);
    const s = share ?? (total > 0 ? Math.abs(left ?? 0) / total : 0.5);
    return (
        <View style={styles.line}>
            <Row style={styles.between}>
                <T variant="body" color={lead === 'right' ? colors.textSecondary : colors.text} style={[styles.lineValue, lead === 'left' && styles.bold]}>{leftText ?? format(left)}</T>
                <T variant="body" muted numberOfLines={1} style={styles.lineLabel}>{label}</T>
                <T variant="body" color={lead === 'left' ? colors.textSecondary : colors.text} style={[styles.lineValue, styles.right, lead === 'right' && styles.bold]}>{rightText ?? format(right)}</T>
            </Row>
            <SplitBar left={s} leftColor={hc} rightColor={ac} height={5}/>
        </View>
    );
}

/** Shots on goal per period as a small table: one row per team, a column per period, totals at the end. */
function PeriodTable({shots, home, away}) {
    const {colors} = useAppTheme();
    const tot = (k) => shots.reduce((a, s) => a + (s[k] ?? 0), 0);
    const cell = (v, bold) => <T variant="body" style={[styles.cell, bold && styles.bold]}>{v}</T>;
    return (
        <View>
            <Row style={styles.tableRow}>
                <View style={styles.teamCell}/>
                {shots.map((s) => <T key={s.period} variant="caption" muted style={styles.cell}>{s.period}</T>)}
                <T variant="caption" muted style={styles.cell}>Total</T>
            </Row>
            {[['home', home], ['away', away]].map(([k, abbrev]) => (
                <Row key={k} style={[styles.tableRow, styles.tableLine, {borderTopColor: colors.border}]}>
                    <Row gap={8} style={styles.teamCell}>
                        <TeamLogo abbrev={abbrev} size={20}/>
                        <T variant="body" style={styles.semi}>{abbrev}</T>
                    </Row>
                    {shots.map((s) => <React.Fragment key={s.period}>{cell(s[k] ?? 0)}</React.Fragment>)}
                    {cell(tot(k), true)}
                </Row>
            ))}
        </View>
    );
}

/** Team-vs-team game stats: shots by period, then grouped rows in one consistent style. */
function StatsTab({header, landing, box, rail, mp, xg, sims}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);

    const stats = useMemo(() => teamGameStats(landing, rail), [landing, rail]);
    const shots = useMemo(() => shotsByPeriod(box, rail), [box, rail]);
    const v = (key, side) => n(stats[key]?.[side]);

    const ppH = parseFraction(stats.powerPlay?.home);
    const ppA = parseFraction(stats.powerPlay?.away);
    const foH = n(stats.faceoffWinningPctg?.home) ?? n(mp?.last?.homeFaceoffWinPercentage);
    const foA = n(stats.faceoffWinningPctg?.away) ?? (foH != null ? 1 - foH : null);
    const oz = n(mp?.last?.homePercentOfEventsInOffensiveZone);
    const hasAny = Object.keys(stats).length || shots.length || home.sog != null;
    const p = {hc, ac};
    const pct0 = (x) => (x == null ? '–' : pct(x));

    if (!hasAny) return <EmptyState message="Team stats will appear once the game is underway."/>;

    return (
        <View>
            <TeamKey home={home.abbrev} away={away.abbrev}/>


            {/* Shots on goal live in the score header and this table only; xG lives in Analytics → xG. */}
            {shots.length ? (
                <>
                    <Heading>Shots on goal by period</Heading>
                    <PeriodTable shots={shots} home={home.abbrev} away={away.abbrev}/>
                </>
            ) : null}

            <Heading>Possession</Heading>
            {foH != null ? <Line label="Faceoffs" left={foH} right={foA} format={pct0} share={foH / ((foH + (foA ?? 1 - foH)) || 1)} {...p}/> : null}
            {oz != null ? <Line label="Offensive zone time" left={oz} right={1 - oz} format={pct0} share={oz} {...p}/> : null}
            <Line label="Takeaways" left={v('takeaways', 'home')} right={v('takeaways', 'away')} {...p}/>
            <Line label="Giveaways" left={v('giveaways', 'home')} right={v('giveaways', 'away')} higherIsBetter={false} {...p}/>

            <Heading>Special teams</Heading>
            {ppH && ppA ? (
                <Line
                    label="Power play"
                    left={ppH.pct}
                    right={ppA.pct}
                    leftText={`${ppH.made}/${ppH.opps}`}
                    rightText={`${ppA.made}/${ppA.opps}`}
                    share={ppH.pct + ppA.pct > 0 ? ppH.pct / (ppH.pct + ppA.pct) : 0.5}
                    {...p}
                />
            ) : null}
            <Line label="Penalty minutes" left={v('pim', 'home')} right={v('pim', 'away')} higherIsBetter={false} {...p}/>

            <Heading>Physical</Heading>
            <Line label="Hits" left={v('hits', 'home')} right={v('hits', 'away')} {...p}/>
            <Line label="Blocked shots" left={v('blockedShots', 'home')} right={v('blockedShots', 'away')} {...p}/>

            {!header.final ? <PlayoffImpact sims={sims} header={header}/> : null}
        </View>
    );
}

export default memo(StatsTab);

const styles = StyleSheet.create({
    semi: {fontFamily: 'Sora_600SemiBold'},
    bold: {fontFamily: 'Sora_700Bold'},
    right: {textAlign: 'right'},
    between: {justifyContent: 'space-between', alignItems: 'flex-end'},
    key: {justifyContent: 'space-between', marginBottom: 6},
    heading: {fontFamily: 'Sora_600SemiBold', letterSpacing: 0.8, marginTop: 28, marginBottom: 6},
    line: {paddingVertical: 9, gap: 7},
    lineValue: {width: 64, fontFamily: 'Sora_600SemiBold', fontVariant: ['tabular-nums']},
    lineLabel: {flex: 1, textAlign: 'center'},
    tableRow: {paddingVertical: 8},
    tableLine: {borderTopWidth: StyleSheet.hairlineWidth},
    teamCell: {flex: 1.6},
    cell: {flex: 1, textAlign: 'center', fontVariant: ['tabular-nums']},
});
