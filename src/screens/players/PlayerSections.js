// Presentational sections for the Player screen. All derived data is passed in already computed
// (memoised by the screen); the only local state is the chart's stat selector.
import React, {memo, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {formLine} from '../../analytics';
import LineChart from '../../components/LineChart';
import {ArrowDownRight, ArrowUpRight, TrendDown, TrendUp} from '../../components/icons';
import {Badge, Headshot, InfoTip, PillTabs, Row, Section, Skeleton, T, TeamLogo} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {loc, num, pct, savePct, secondsToMMSS, signed} from '../../utils/format';
import {seasonLabel} from '../../utils/season';
import {
    cumulativeSeries,
    gameLabel,
    GOALIE_CHART_STATS,
    positionName,
    SKATER_CHART_STATS,
    toNum,
} from './helpers';
import RangeBar from './RangeBar';

const int = (v) => (toNum(v) == null ? '–' : String(Math.round(Number(v))));

/* ----------------------------------------------------------------- hero */

export const Hero = memo(function Hero({p, name, color}) {
    const {colors} = useAppTheme();
    const meta = [p?.sweaterNumber != null ? `#${p.sweaterNumber}` : null, positionName(p?.position)].filter(Boolean).join(' · ');
    return (
        <View style={styles.hero}>
            <Headshot uri={p?.headshot} size={80} borderColor={color} style={[styles.heroShot, {backgroundColor: colors.card}]}/>
            <View style={styles.flex}>
                <T variant="title" numberOfLines={2}>{name}</T>
                <Row gap={6} style={{marginTop: 2}}>
                    {p?.currentTeamAbbrev ? <TeamLogo abbrev={p.currentTeamAbbrev} size={20}/> : null}
                    <T variant="body" numberOfLines={1} style={[styles.flexShrink, styles.half]}>
                        {loc(p?.fullTeamName) || (p?.isActive === false ? 'Not active' : p?.currentTeamAbbrev ?? '')}
                    </T>
                </Row>
                {meta ? <T variant="body" style={[styles.small, styles.half]}>{meta}</T> : null}
            </View>
        </View>
    );
});

/* ------------------------------------------------------------------ bio */

export const BioCard = memo(function BioCard({rows}) {
    if (!rows?.length) return null;
    return (
        <View>
            {rows.map((r) => (
                <View key={r.label} style={styles.bioRow}>
                    <T variant="body" style={[styles.small, styles.half, styles.bioLabel]}>{r.label}</T>
                    <View style={styles.flex}>
                        <T variant="body" style={styles.semibold}>{r.value}</T>
                        {r.sub ? <T variant="body" style={[styles.small, styles.half]}>{r.sub}</T> : null}
                    </View>
                </View>
            ))}
        </View>
    );
});

/* ---------------------------------------------------------- stat grids */

// Season grid tiles keep the old card look (colors.card, radius 10).
const MiniStat = memo(function MiniStat({label, value, color}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.mini, {backgroundColor: colors.card}]}>
            <T variant="body" color={color} numberOfLines={1} adjustsFontSizeToFit style={styles.miniValue}>{value}</T>
            <T variant="body" numberOfLines={1} style={styles.miniLabel}>{label}</T>
        </View>
    );
});

export function skaterTiles(t) {
    if (!t) return [];
    return [
        {group: 'main', label: 'GP', value: int(t.gamesPlayed)},
        {group: 'main', label: 'Goals', value: int(t.goals)},
        {group: 'main', label: 'Assists', value: int(t.assists)},
        {group: 'main', label: 'Points', value: int(t.points), accent: true},
        {group: 'Shooting', label: 'Shots', value: int(t.shots)},
        {group: 'Shooting', label: 'Shooting %', value: pct(t.shootingPctg, 1)},
        {group: 'Shooting', label: '+/-', value: signed(t.plusMinus)},
        {group: 'Special teams', label: 'PP goals', value: int(t.powerPlayGoals)},
        {group: 'Special teams', label: 'PP points', value: int(t.powerPlayPoints)},
        {group: 'Special teams', label: 'SH goals', value: int(t.shorthandedGoals)},
        {group: 'Ice time', label: 'TOI / game', value: toNum(t.avgToiSeconds) ? secondsToMMSS(t.avgToiSeconds) : '–'},
        {group: 'Ice time', label: 'PIM', value: int(t.pim)},
    ];
}

export function goalieTiles(t) {
    if (!t) return [];
    const record = [t.wins, t.losses, t.otLosses].map((v) => int(v)).join('-');
    return [
        {group: 'main', label: 'GP', value: int(t.gamesPlayed)},
        {group: 'main', label: 'Record', value: record},
        {group: 'main', label: 'Save %', value: savePct(t.savePctg), accent: true},
        {group: 'main', label: 'GAA', value: num(t.goalsAgainstAvg, 2)},
        {group: 'Workload', label: 'Shots against', value: int(t.shotsAgainst)},
        {group: 'Workload', label: 'Saves', value: toNum(t.shotsAgainst) != null && toNum(t.goalsAgainst) != null ? int(toNum(t.shotsAgainst) - toNum(t.goalsAgainst)) : '–'},
        {group: 'Workload', label: 'Shutouts', value: int(t.shutouts)},
    ];
}

export function careerTiles(c, goalie) {
    if (!c) return [];
    if (goalie) {
        return [
            {label: 'GP', value: int(c.gamesPlayed)},
            {label: 'Wins', value: int(c.wins)},
            {label: 'Save %', value: savePct(c.savePctg)},
            {label: 'GAA', value: num(c.goalsAgainstAvg, 2)},
            {label: 'Shutouts', value: int(c.shutouts)},
            {label: 'Points', value: toNum(c.goals) != null || toNum(c.assists) != null ? int((toNum(c.goals) ?? 0) + (toNum(c.assists) ?? 0)) : '–'},
        ];
    }
    return [
        {label: 'GP', value: int(c.gamesPlayed)},
        {label: 'Goals', value: int(c.goals)},
        {label: 'Assists', value: int(c.assists)},
        {label: 'Points', value: int(c.points)},
        {label: '+/-', value: signed(c.plusMinus)},
        {label: 'Shots', value: int(c.shots)},
    ];
}

/** The headline numbers in one card: equal columns, big values, hairline dividers between. */
function HeadlineRow({tiles, color}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.headline, {backgroundColor: colors.card}]}>
            {tiles.map((t, i) => (
                <View key={t.label} style={[styles.headCell, i > 0 && {borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border}]}>
                    <T variant="body" color={t.accent ? color : undefined} numberOfLines={1} adjustsFontSizeToFit style={styles.headValue}>{t.value}</T>
                    <T variant="caption" muted numberOfLines={1}>{t.label}</T>
                </View>
            ))}
        </View>
    );
}

/**
 * Stat grid. Tiles with `group: 'main'` become one headline card; the rest are grouped under small
 * captions in rows of three, so related numbers sit together. Ungrouped tiles are one plain grid.
 */
export const StatGrid = memo(function StatGrid({tiles, color}) {
    if (!tiles?.length) return null;
    if (!tiles.some((t) => t.group)) {
        return (
            <View style={styles.grid}>
                {tiles.map((t) => <MiniStat key={t.label} label={t.label} value={t.value} color={t.accent ? color : undefined}/>)}
            </View>
        );
    }
    const main = tiles.filter((t) => t.group === 'main');
    const groups = [...new Set(tiles.filter((t) => t.group !== 'main').map((t) => t.group))];
    return (
        <View>
            {main.length ? <HeadlineRow tiles={main} color={color}/> : null}
            {groups.map((g) => (
                <View key={g} style={styles.statGroup}>
                    <T variant="caption" muted style={styles.groupTitle}>{g.toUpperCase()}</T>
                    <View style={styles.grid}>
                        {tiles.filter((t) => t.group === g).map((t) => <MiniStat key={t.label} label={t.label} value={t.value} color={t.accent ? color : undefined}/>)}
                    </View>
                </View>
            ))}
        </View>
    );
});

/** Placeholder with the StatGrid's geometry (3 tiles per row). */
export function StatGridSkeleton({count = 6}) {
    return (
        <View style={styles.grid}>
            {Array.from({length: count}).map((_, i) => <Skeleton key={i} height={MINI_HEIGHT} radius={10} style={styles.miniSkeleton}/>)}
        </View>
    );
}

/* -------------------------------------------------------------- streak */

const STREAK_COPY = {
    hot: {label: 'Heating up', icon: TrendUp},
    cold: {label: 'Cooling off', icon: TrendDown},
    normal: {label: 'Normal', icon: null},
};

export const StreakCard = memo(function StreakCard({streak, goalie}) {
    const {colors} = useAppTheme();
    if (!streak || streak.expected == null) return null;
    const copy = STREAK_COPY[streak.status] ?? STREAK_COPY.normal;
    const tone = streak.status === 'hot' ? colors.positive : streak.status === 'cold' ? colors.negative : colors.card;
    const Icon = copy.icon;
    const unit = goalie ? 'goals allowed' : 'points';
    const chance = streak.pValue == null ? '–' : streak.pValue < 0.001 ? '<0.1%' : pct(streak.pValue, streak.pValue < 0.01 ? 1 : 0);
    let sentence;
    if (streak.status === 'hot') sentence = `Only ${chance} chance a normal stretch looks this good.`;
    else if (streak.status === 'cold') sentence = `Only ${chance} chance a normal stretch looks this bad.`;
    else sentence = `Within normal ups and downs — a stretch like this happens ${chance} of the time by luck alone.`;
    const info = goalie
        ? 'Compares goals he allowed over his last few games with what his usual save % predicts on the shots he actually faced. If the gap is too big to be luck (under a 10% chance), he’s flagged as heating up or cooling off. A statistical estimate, not a guarantee.'
        : 'Compares his points over the last 10 games with his scoring rate in the rest of the season. If a stretch that good (or bad) would happen by chance less than 10% of the time, he’s flagged as heating up or cooling off. A statistical estimate, not a guarantee.';
    return (
        <Section title="Current form" info={info}>
            <View>
                <Row style={{justifyContent: 'space-between', marginBottom: 10}}>
                    <Row gap={6}>
                        {Icon ? <Icon size={20} color={tone}/> : null}
                        <Badge
                            label={copy.label}
                            color={tone}
                            textColor={streak.status === 'normal' ? colors.text : undefined}
                            style={styles.badge}
                        />
                    </Row>
                    <T variant="body" style={[styles.small, styles.half]}>Last {streak.window} games</T>
                </Row>
                <T variant="body" style={styles.semibold}>
                    {num(streak.actual)} {unit} vs {num(streak.expected, 1)} expected.
                </T>
                <T variant="body" style={[styles.small, styles.half, {marginTop: 4}]}>{sentence}</T>
            </View>
        </Section>
    );
});

/* ---------------------------------------------------------------- form */

export const FormChart = memo(function FormChart({log, goalie, color}) {
    const series = useMemo(() => {
        if (!log?.length) return null;
        if (goalie) {
            const sa = log.map((g) => toNum(g?.shotsAgainst) ?? 0);
            const sv = log.map((g) => (toNum(g?.shotsAgainst) ?? 0) - (toNum(g?.goalsAgainst) ?? 0));
            const fSa = formLine(sa);
            const fSv = formLine(sv);
            const totalSa = sa.reduce((a, b) => a + b, 0);
            const avg = totalSa ? sv.reduce((a, b) => a + b, 0) / totalSa : null;
            return {
                data: fSv.map((v, i) => ({y: fSa[i] > 0 ? v / fSa[i] : NaN, label: gameLabel(log[i])})),
                baseline: avg,
            };
        }
        const pts = log.map((g) => toNum(g?.points) ?? 0);
        const f = formLine(pts);
        return {
            data: f.map((v, i) => ({y: v, label: gameLabel(log[i])})),
            baseline: pts.reduce((a, b) => a + b, 0) / pts.length,
        };
    }, [log, goalie]);
    if (!series || series.data.length < 2) return null;
    const info = goalie
        ? 'A rolling save % that weights recent games more (each game counts half as much five games later). The dashed line is his season average.'
        : 'Points per game, smoothed so recent games count more (a game’s weight halves every five games). The dashed line is his season average, so you can see hot and cold stretches at a glance.';
    return (
        <Section title="Form">
            <View>
                <LineChart
                    data={series.data}
                    color={color}
                    baseline={series.baseline}
                    title={goalie ? 'Weighted save %' : 'Weighted points / game'}
                    format={(v) => (goalie ? savePct(v) : num(v, 2))}
                    height={150}
                />
            </View>
        </Section>
    );
});

/* ------------------------------------------------------ cumulative chart */

export const SeasonChart = memo(function SeasonChart({log, goalie, color}) {
    const stats = goalie ? GOALIE_CHART_STATS : SKATER_CHART_STATS;
    const [statKey, setStatKey] = useState(stats[0].key);
    const stat = stats.find((s) => s.key === statKey) ?? stats[0];
    const tabs = useMemo(() => stats.map((s) => ({key: s.key, label: s.label})), [stats]);
    const data = useMemo(() => cumulativeSeries(log, stat.key), [log, stat.key]);
    const markers = useMemo(() => {
        if (stat.key !== 'goals' && stat.key !== 'points') return undefined;
        return (log ?? []).map((g, i) => ((toNum(g?.goals) ?? 0) > 0 ? {index: i} : null)).filter(Boolean);
    }, [log, stat.key]);
    if (!log?.length) return null;
    const ratio = stat.kind === 'ratio';
    return (
        <Section title="Season progression">
            <PillTabs tabs={tabs} value={stat.key} onChange={setStatKey} contentStyle={styles.noPad} style={styles.chartTabs}/>
            <View>
                <LineChart
                    data={data}
                    color={color}
                    title={ratio ? `Running ${stat.label}` : `${stat.label} — season total`}
                    format={(v) => (ratio ? savePct(v) : num(v))}
                    markers={markers}
                    height={180}
                />
                {markers?.length ? <T variant="caption" muted style={{marginTop: 10}}>Dots mark games with a goal.</T> : null}
            </View>
        </Section>
    );
});

/* ------------------------------------------------------- talent cards */

export const ShootingTalentCard = memo(function ShootingTalentCard({talent, goals, shots, position, color, right}) {
    if (!talent) return null;
    const d = position === 'D';
    const avg = d ? 0.05 : 0.105;
    const max = Math.max(d ? 0.14 : 0.22, (talent.observed ?? 0) + 0.02, talent.hi + 0.02);
    const luck = talent.luck;
    const luckText = !shots
        ? 'No shots yet — this is the league-wide starting point for his position.'
        : Math.abs(luck) < 0.5
            ? 'Scoring about as many goals as his shots deserve.'
            : luck > 0
                ? `${num(luck, 1)} more goals than his shots deserve — expect his scoring rate to cool a bit.`
                : `${num(-luck, 1)} fewer goals than his shots deserve — expect more to go in.`;
    return (
        <Section
            title="True shooting talent"
            right={right}
            info="Shooting % bounces around a lot over small samples. This blends his actual shooting % with the league average for his position, trusting his own numbers more as he takes more shots. The bar shows the best estimate and an 80% range for his real talent.">
            <View>
                <Row style={{justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10}}>
                    <View>
                        <T variant="body" style={[styles.small, styles.half]}>Estimated talent</T>
                        <T variant="body" color={color} style={styles.big}>{pct(talent.estimate, 1)}</T>
                    </View>
                </Row>
                <RangeBar
                    min={0}
                    max={max}
                    lo={talent.lo}
                    hi={talent.hi}
                    estimate={talent.estimate}
                    observed={talent.observed}
                    average={avg}
                    color={color}
                    format={(v) => pct(v, 0)}
                    observedLabel="Actual"
                />
                <T variant="caption" muted style={{marginTop: 10}}>
                    80% range: {pct(talent.lo, 1)} – {pct(talent.hi, 1)} · {Math.round(talent.weight * 100)}% based on his own shots
                </T>
            </View>
            <View style={styles.tileRow}>
                <View style={[styles.flex]}>
                    <XgTile
                        label="Expected goals"
                        value={num(talent.expectedGoals, 1)}
                        sub={`from ${int(shots)} shots`}
                        info="Goals he ‘should’ have from his shots if he finished at his estimated true shooting %. It doesn’t know shot locations."
                    />
                </View>
                <View style={[styles.flex]}>
                    <XgTile
                        label="Finishing luck"
                        delta={luck}
                        sub={`${int(goals)} actual goals`}
                        tone={Math.abs(luck) < 0.5 ? undefined : luck > 0 ? 'positive' : 'negative'}
                        info="Actual goals minus expected goals. Positive means more pucks have gone in than his talent suggests (often luck that fades); negative means he’s been unlucky."
                    />
                </View>
            </View>
            <T variant="caption" muted style={{marginTop: 10}}>{luckText}</T>
        </Section>
    );
});

/**
 * Small labelled number. `delta` (a signed number) is shown as a 45° up/down arrow plus the size of
 * the change instead of a +/− sign.
 */
const XgTile = memo(function XgTile({label, value, delta, dp = 1, sub, info, tone}) {
    const {colors} = useAppTheme();
    const c = tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : undefined;
    const d = Number(delta);
    const Arrow = Number.isFinite(d) && Math.abs(d) >= 0.05 ? (d > 0 ? ArrowUpRight : ArrowDownRight) : null;
    return (
        <View>
            <Row gap={4} style={{marginBottom: 2}}>
                <T variant="body" numberOfLines={1} style={[styles.small, styles.half, styles.flexShrink]}>{label}</T>
                <InfoTip title={label} body={info} size={14}/>
            </Row>
            {delta != null ? (
                <Row gap={4}>
                    {Arrow ? <Arrow size={22} color={c ?? colors.text}/> : null}
                    <T variant="body" color={c} style={styles.big}>{Number.isFinite(d) ? num(Math.abs(d), dp) : '–'}</T>
                </Row>
            ) : (
                <T variant="body" color={c} style={styles.big}>{value}</T>
            )}
            {sub ? <T variant="body" style={[styles.small, styles.half]}>{sub}</T> : null}
        </View>
    );
});

export const GoalieTalentCard = memo(function GoalieTalentCard({talent, shotsAgainst, color}) {
    if (!talent) return null;
    const avg = 0.902;
    const vals = [talent.lo, talent.hi, talent.observed, avg].filter((v) => v != null);
    const min = Math.min(0.88, ...vals.map((v) => v - 0.005));
    const max = Math.max(0.925, ...vals.map((v) => v + 0.005));
    const gsaa = talent.goalsSavedAboveAvg;
    const weight = Math.round(talent.weight * 100);
    return (
        <Section
            title="True save talent"
            info="Save % takes most of a season to mean much. This blends his actual save % with the league average (≈.902), trusting his own numbers more as he faces more shots. The bar shows the best estimate and an 80% range for his real talent.">
            <View>
                <Row style={{justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10}}>
                    <View>
                        <T variant="body" style={[styles.small, styles.half]}>Estimated talent</T>
                        <T variant="body" color={color} style={styles.big}>{savePct(talent.estimate)}</T>
                    </View>
                </Row>
                <RangeBar
                    min={min}
                    max={max}
                    lo={talent.lo}
                    hi={talent.hi}
                    estimate={talent.estimate}
                    observed={talent.observed}
                    average={avg}
                    color={color}
                    format={savePct}
                    observedLabel="Actual"
                />
                <T variant="caption" muted style={{marginTop: 10}}>
                    80% range: {savePct(talent.lo)} – {savePct(talent.hi)}
                </T>
            </View>
            <View style={styles.tileRow}>
                <View style={styles.flex}>
                    <XgTile
                        label="Goals saved vs avg"
                        delta={gsaa}
                        sub={`on ${int(shotsAgainst)} shots`}
                        tone={Math.abs(gsaa) < 0.5 ? undefined : gsaa > 0 ? 'positive' : 'negative'}
                        info="How many goals he’s prevented compared with a league-average goalie facing the same number of shots. It doesn’t adjust for shot quality, so treat it as an estimate."
                    />
                </View>
                <View style={styles.flex}>
                    <XgTile
                        label="Data weight"
                        value={`${weight}%`}
                        sub="his own data"
                        info={`${weight}% of this estimate is his own data; the rest is the league average. A goalie needs roughly 2,400 shots before his own numbers count for half.`}
                    />
                </View>
            </View>
            <T variant="caption" muted style={{marginTop: 10}}>{weight}% of this estimate is his own data.</T>
        </Section>
    );
});

/* ---------------------------------------------------------- projection */

export const ProjectionCard = memo(function ProjectionCard({goals, points, priorSource, remaining, color}) {
    const {colors} = useAppTheme();
    if (!goals || !points) return null;
    // Two flex-1 cards side by side, in the same card style as the season stat grid.
    const tile = (label, pr) => (
        <View style={[styles.projTile, {backgroundColor: colors.card}]}>
            <T variant="body" style={styles.miniLabel}>Projected {label}</T>
            <T variant="body" color={color} numberOfLines={1} adjustsFontSizeToFit style={styles.projValue}>{Math.round(pr.projected)}</T>
            <T variant="caption" muted style={styles.tabular}>{Math.round(pr.lo)}–{Math.round(pr.hi)} range</T>
        </View>
    );
    return (
        <Section
            title="Season projection"
            info={`An estimate of his final regular-season totals. It starts from his scoring rate ${priorSource === 'position' ? 'typical for his position' : `last season (${priorSource})`}, updates with this season’s games, and simulates the ${remaining} games left. The range covers 80% of likely outcomes.`}>
            <View style={styles.projGrid}>
                {tile('goals', goals)}
                {tile('points', points)}
            </View>
            <T variant="caption" muted style={{marginTop: 10}}>{remaining} games remaining · 80% range</T>
        </Section>
    );
});

/* ---------------------------------------------------------- game tables */

/**
 * Same column contract as ui.DataTable, drawn like the original Rinkside tables: plain rows with
 * no rules, a 14pt half-opacity header and 16pt SemiBold values, straight on the page background.
 * Highlighted rows (career total, current season) sit on a colors.card band.
 */
const PlainTable = memo(function PlainTable({columns, rows, keyExtractor = (r, i) => String(i), highlight}) {
    const {colors} = useAppTheme();
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableInner}>
                <View style={styles.tr}>
                    {columns.map((c) => (
                        <T key={c.key} variant="body" numberOfLines={1} style={[styles.th, {width: c.width, textAlign: c.align ?? 'left'}]}>
                            {c.title}
                        </T>
                    ))}
                </View>
                {rows.map((r, i) => (
                    <View key={keyExtractor(r, i)} style={[styles.tr, highlight?.(r) && {backgroundColor: colors.card}]}>
                        {columns.map((c) => {
                            const v = c.render ? c.render(r, i) : r[c.key];
                            return (
                                <T key={c.key} variant="body" numberOfLines={1} style={[styles.td, {width: c.width, textAlign: c.align ?? 'left'}]}>{v}</T>
                            );
                        })}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
});

const SKATER_GAME_COLS = [
    {key: 'date', title: 'Date', width: 52, render: (g) => String(g.gameDate ?? '').slice(5).replace('-', '/')},
    {key: 'opp', title: 'Opp', width: 56, render: (g) => (g.opponentAbbrev ? `${g.homeRoadFlag === 'R' ? '@' : ''}${g.opponentAbbrev}` : '–')},
    {key: 'g', title: 'G', width: 28, align: 'right', render: (g) => int(g.goals)},
    {key: 'a', title: 'A', width: 28, align: 'right', render: (g) => int(g.assists)},
    {key: 'p', title: 'P', width: 28, align: 'right', render: (g) => int(g.points)},
    {key: 'pm', title: '+/-', width: 36, align: 'right', render: (g) => signed(g.plusMinus)},
    {key: 's', title: 'SOG', width: 36, align: 'right', render: (g) => int(g.shots)},
    {key: 'toi', title: 'TOI', width: 52, align: 'right', render: (g) => g.toi ?? '–'},
];

const GOALIE_GAME_COLS = [
    {key: 'date', title: 'Date', width: 52, render: (g) => String(g.gameDate ?? '').slice(5).replace('-', '/')},
    {key: 'opp', title: 'Opp', width: 56, render: (g) => (g.opponentAbbrev ? `${g.homeRoadFlag === 'R' ? '@' : ''}${g.opponentAbbrev}` : '–')},
    {key: 'dec', title: 'Dec', width: 36, render: (g) => g.decision ?? '–'},
    {key: 'sa', title: 'SA', width: 36, align: 'right', render: (g) => int(g.shotsAgainst)},
    {key: 'ga', title: 'GA', width: 32, align: 'right', render: (g) => int(g.goalsAgainst)},
    {key: 'sv', title: 'SV%', width: 48, align: 'right', render: (g) => savePct(g.savePctg ?? (toNum(g.shotsAgainst) ? 1 - (toNum(g.goalsAgainst) ?? 0) / g.shotsAgainst : null))},
    {key: 'toi', title: 'TOI', width: 52, align: 'right', render: (g) => g.toi ?? '–'},
];

const gameKey = (g, i) => String(g.gameId ?? i);

export const RecentGames = memo(function RecentGames({log, goalie}) {
    const rows = useMemo(() => (log ?? []).slice(-10).reverse(), [log]);
    if (!rows.length) return null;
    return (
        <Section title={`Last ${rows.length} games`}>
            <PlainTable columns={goalie ? GOALIE_GAME_COLS : SKATER_GAME_COLS} rows={rows} keyExtractor={gameKey}/>
        </Section>
    );
});

const teamShort = (s) => loc(s.teamCommonName) || loc(s.teamName) || '–';

const SKATER_CAREER_COLS = [
    {key: 'season', title: 'Season', width: 64, render: (s) => (s._career ? 'Career' : seasonLabel(s.season))},
    {key: 'team', title: 'Team', width: 104, render: (s) => (s._career ? '' : teamShort(s))},
    {key: 'gp', title: 'GP', width: 32, align: 'right', render: (s) => int(s.gamesPlayed)},
    {key: 'g', title: 'G', width: 32, align: 'right', render: (s) => int(s.goals)},
    {key: 'a', title: 'A', width: 32, align: 'right', render: (s) => int(s.assists)},
    {key: 'p', title: 'P', width: 36, align: 'right', render: (s) => int(s.points)},
    {key: 'pm', title: '+/-', width: 40, align: 'right', render: (s) => signed(s.plusMinus)},
    {key: 'pim', title: 'PIM', width: 36, align: 'right', render: (s) => int(s.pim)},
    {key: 'sh', title: 'S%', width: 48, align: 'right', render: (s) => pct(s.shootingPctg, 1)},
];

const GOALIE_CAREER_COLS = [
    {key: 'season', title: 'Season', width: 64, render: (s) => (s._career ? 'Career' : seasonLabel(s.season))},
    {key: 'team', title: 'Team', width: 104, render: (s) => (s._career ? '' : teamShort(s))},
    {key: 'gp', title: 'GP', width: 32, align: 'right', render: (s) => int(s.gamesPlayed)},
    {key: 'w', title: 'W', width: 32, align: 'right', render: (s) => int(s.wins)},
    {key: 'l', title: 'L', width: 32, align: 'right', render: (s) => int(s.losses)},
    {key: 'otl', title: 'OTL', width: 36, align: 'right', render: (s) => int(s.otLosses)},
    {key: 'sv', title: 'SV%', width: 48, align: 'right', render: (s) => savePct(s.savePctg)},
    {key: 'gaa', title: 'GAA', width: 44, align: 'right', render: (s) => num(s.goalsAgainstAvg, 2)},
    {key: 'so', title: 'SO', width: 32, align: 'right', render: (s) => int(s.shutouts)},
];

const careerKey = (s) => s._key;

export const CareerTable = memo(function CareerTable({rows, career, goalie, highlightSeason}) {
    const all = useMemo(
        () => (career ? [...rows, {...career, _career: true, _key: 'career'}] : rows),
        [rows, career],
    );
    if (!rows?.length) return null;
    return (
        <Section title="NHL career">
            <PlainTable
                columns={goalie ? GOALIE_CAREER_COLS : SKATER_CAREER_COLS}
                rows={all}
                keyExtractor={careerKey}
                highlight={(s) => s._career || String(s.season) === String(highlightSeason)}
            />
        </Section>
    );
});

// Stat block (no card): 20pt SemiBold value over a 16pt half-opacity label, 4px vertical padding.
const MINI_HEIGHT = 30 + 26 + 20;

const styles = StyleSheet.create({
    flex: {flex: 1},
    flexShrink: {flexShrink: 1},
    right: {alignItems: 'flex-end'},
    semibold: {fontFamily: 'Sora_600SemiBold'},
    half: {opacity: 0.5},
    small: {fontSize: 14, lineHeight: 19},
    big: {fontFamily: 'Sora_600SemiBold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums']},
    mid: {fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums']},
    divider: {height: 2, opacity: 0.2, marginVertical: 0},
    badge: {borderRadius: 15, paddingHorizontal: 10, paddingVertical: 4},
    hero: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10},
    heroShot: {borderWidth: 3, marginRight: 20},
    bioRow: {flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 12},
    bioLabel: {width: 72, paddingTop: 2},
    grid: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 10},
    headline: {flexDirection: 'row', borderRadius: 15, paddingVertical: 16},
    headCell: {flex: 1, alignItems: 'center', paddingHorizontal: 4, gap: 2},
    headValue: {fontFamily: 'Sora_700Bold', fontSize: 26, lineHeight: 32, fontVariant: ['tabular-nums']},
    statGroup: {marginTop: 18},
    groupTitle: {fontFamily: 'Sora_600SemiBold', letterSpacing: 0.8, marginBottom: 8},
    tabular: {fontVariant: ['tabular-nums']},
    projGrid: {flexDirection: 'row', gap: 10},
    projTile: {flex: 1, borderRadius: 10, paddingVertical: 15, paddingLeft: 20, paddingRight: 10},
    projValue: {fontFamily: 'Sora_600SemiBold', fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'], marginTop: 4},
    mini: {flexGrow: 1, flexBasis: '30%', borderRadius: 10, paddingVertical: 15, paddingLeft: 20, paddingRight: 8},
    miniValue: {fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums']},
    miniLabel: {fontFamily: 'Sora_400Regular', opacity: 0.5},
    miniSkeleton: {flexGrow: 1, flexBasis: '30%'},
    tileRow: {flexDirection: 'row', gap: 16, marginTop: 20},
    tableInner: {paddingHorizontal: 0},
    tr: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, minHeight: 40, borderRadius: 10},
    th: {fontFamily: 'Sora_600SemiBold', fontSize: 14, lineHeight: 18, opacity: 0.5},
    td: {fontFamily: 'Sora_600SemiBold', fontVariant: ['tabular-nums']},
    chartTabs: {marginBottom: 10},
    noPad: {paddingHorizontal: 0},
});
