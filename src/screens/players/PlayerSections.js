// Presentational sections for the Player screen. All derived data is passed in already computed
// (memoised by the screen); the only local state is the chart's stat selector.
import React, {memo, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {formLine} from '../../analytics';
import LineChart from '../../components/LineChart';
import {TrendDown, TrendUp} from '../../components/icons';
import {Badge, Card, DataTable, Headshot, InfoTip, PillTabs, Row, Section, Skeleton, T, TeamLogo} from '../../components/ui';
import {useAppTheme, withAlpha} from '../../theme';
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
    const meta = [p?.sweaterNumber != null ? `#${p.sweaterNumber}` : null, positionName(p?.position)].filter(Boolean).join(' · ');
    return (
        <View style={[styles.hero, {backgroundColor: withAlpha(color, 0.16), borderColor: withAlpha(color, 0.45)}]}>
            <Headshot uri={p?.headshot} size={92} borderColor={color}/>
            <View style={styles.flex}>
                <T variant="title" numberOfLines={2}>{name}</T>
                {meta ? <T variant="label" muted>{meta}</T> : null}
                <Row gap={6} style={{marginTop: 6}}>
                    {p?.currentTeamAbbrev ? <TeamLogo abbrev={p.currentTeamAbbrev} size={20}/> : null}
                    <T variant="caption" muted numberOfLines={1} style={styles.flexShrink}>
                        {loc(p?.fullTeamName) || (p?.isActive === false ? 'Not active' : p?.currentTeamAbbrev ?? '')}
                    </T>
                </Row>
            </View>
            <View style={[styles.heroStripe, {backgroundColor: color}]}/>
        </View>
    );
});

/* ------------------------------------------------------------------ bio */

export const BioCard = memo(function BioCard({rows}) {
    const {colors} = useAppTheme();
    if (!rows?.length) return null;
    return (
        <Card style={styles.bio}>
            {rows.map((r, i) => (
                <View key={r.label} style={[styles.bioRow, i > 0 && {borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth}]}>
                    <T variant="caption" muted style={styles.bioLabel}>{r.label}</T>
                    <View style={styles.flex}>
                        <T variant="label">{r.value}</T>
                        {r.sub ? <T variant="caption" muted>{r.sub}</T> : null}
                    </View>
                </View>
            ))}
        </Card>
    );
});

/* ---------------------------------------------------------- stat grids */

const MiniStat = memo(function MiniStat({label, value, color}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.mini, {backgroundColor: colors.card}]}>
            <T variant="stat" color={color} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
            <T variant="caption" muted numberOfLines={1}>{label}</T>
        </View>
    );
});

export function skaterTiles(t) {
    if (!t) return [];
    return [
        {label: 'GP', value: int(t.gamesPlayed)},
        {label: 'Goals', value: int(t.goals)},
        {label: 'Assists', value: int(t.assists)},
        {label: 'Points', value: int(t.points), accent: true},
        {label: '+/-', value: signed(t.plusMinus)},
        {label: 'Shots', value: int(t.shots)},
        {label: 'Shooting %', value: pct(t.shootingPctg, 1)},
        {label: 'PP goals', value: int(t.powerPlayGoals)},
        {label: 'PP points', value: int(t.powerPlayPoints)},
        {label: 'SH goals', value: int(t.shorthandedGoals)},
        {label: 'PIM', value: int(t.pim)},
        {label: 'TOI / GP', value: toNum(t.avgToiSeconds) ? secondsToMMSS(t.avgToiSeconds) : '–'},
    ];
}

export function goalieTiles(t) {
    if (!t) return [];
    const record = [t.wins, t.losses, t.otLosses].map((v) => int(v)).join('-');
    return [
        {label: 'GP', value: int(t.gamesPlayed)},
        {label: 'Record', value: record},
        {label: 'Save %', value: savePct(t.savePctg), accent: true},
        {label: 'GAA', value: num(t.goalsAgainstAvg, 2)},
        {label: 'Shutouts', value: int(t.shutouts)},
        {label: 'Shots against', value: int(t.shotsAgainst)},
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

export const StatGrid = memo(function StatGrid({tiles, color}) {
    if (!tiles?.length) return null;
    return (
        <View style={styles.grid}>
            {tiles.map((t) => <MiniStat key={t.label} label={t.label} value={t.value} color={t.accent ? color : undefined}/>)}
        </View>
    );
});

/** Placeholder with the StatGrid's geometry (3 tiles per row). */
export function StatGridSkeleton({count = 6}) {
    return (
        <View style={styles.grid}>
            {Array.from({length: count}).map((_, i) => <Skeleton key={i} height={64} radius={14} style={styles.miniSkeleton}/>)}
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
    const tone = streak.status === 'hot' ? colors.positive : streak.status === 'cold' ? colors.negative : colors.cardAlt;
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
            <Card>
                <Row style={{justifyContent: 'space-between', marginBottom: 8}}>
                    <Row gap={6}>
                        {Icon ? <Icon size={18} color={tone}/> : null}
                        <Badge label={copy.label} color={streak.status === 'normal' ? undefined : tone}/>
                    </Row>
                    <T variant="caption" muted>Last {streak.window} games</T>
                </Row>
                <T variant="body">
                    {num(streak.actual)} {unit} vs {num(streak.expected, 1)} expected.
                </T>
                <T variant="caption" muted style={{marginTop: 4}}>{sentence}</T>
            </Card>
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
        <Section title="Form" info={info}>
            <Card>
                <LineChart
                    data={series.data}
                    color={color}
                    baseline={series.baseline}
                    title={goalie ? 'Weighted save %' : 'Weighted points / game'}
                    format={(v) => (goalie ? savePct(v) : num(v, 2))}
                    height={150}
                />
            </Card>
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
            <Card>
                <LineChart
                    data={data}
                    color={color}
                    title={ratio ? `Running ${stat.label}` : `${stat.label} — season total`}
                    format={(v) => (ratio ? savePct(v) : num(v))}
                    markers={markers}
                    height={180}
                />
                {markers?.length ? <T variant="caption" muted style={{marginTop: 6}}>Dots mark games with a goal.</T> : null}
            </Card>
        </Section>
    );
});

/* ------------------------------------------------------- talent cards */

export const ShootingTalentCard = memo(function ShootingTalentCard({talent, goals, shots, position, color}) {
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
            info="Shooting % bounces around a lot over small samples. This blends his actual shooting % with the league average for his position, trusting his own numbers more as he takes more shots. The bar shows the model’s best estimate and an 80% range for his real talent.">
            <Card>
                <Row style={{justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10}}>
                    <View>
                        <T variant="caption" muted>Estimated talent</T>
                        <T variant="stat" color={color}>{pct(talent.estimate, 1)}</T>
                    </View>
                    <View style={styles.right}>
                        <T variant="caption" muted>Actual</T>
                        <T variant="heading">{talent.observed == null ? '–' : pct(talent.observed, 1)}</T>
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
                <T variant="caption" muted style={{marginTop: 8}}>
                    80% range: {pct(talent.lo, 1)} – {pct(talent.hi, 1)} · {Math.round(talent.weight * 100)}% based on his own shots
                </T>
            </Card>
            <View style={styles.tileRow}>
                <View style={[styles.flex]}>
                    <XgTile
                        label="Expected goals"
                        value={num(talent.expectedGoals, 1)}
                        sub={`from ${int(shots)} shots`}
                        info="Goals he ‘should’ have from his shots if he finished at his estimated true shooting %. A model estimate — it doesn’t know shot locations."
                    />
                </View>
                <View style={[styles.flex]}>
                    <XgTile
                        label="Finishing luck"
                        value={signed(luck, 1)}
                        sub={`${int(goals)} actual goals`}
                        tone={Math.abs(luck) < 0.5 ? undefined : luck > 0 ? 'positive' : 'negative'}
                        info="Actual goals minus expected goals. Positive means more pucks have gone in than his talent suggests (often luck that fades); negative means he’s been unlucky."
                    />
                </View>
            </View>
            <T variant="caption" muted style={{marginTop: 8}}>{luckText}</T>
        </Section>
    );
});

const XgTile = memo(function XgTile({label, value, sub, info, tone}) {
    const {colors} = useAppTheme();
    const c = tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : undefined;
    return (
        <View style={[styles.tile, {backgroundColor: colors.card}]}>
            <Row gap={4} style={{marginBottom: 4}}>
                <T variant="caption" muted numberOfLines={1} style={styles.flexShrink}>{label}</T>
                <InfoTip title={label} body={info} size={14}/>
            </Row>
            <T variant="stat" color={c}>{value}</T>
            {sub ? <T variant="caption" muted>{sub}</T> : null}
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
            info="Save % takes most of a season to mean much. This blends his actual save % with the league average (≈.902), trusting his own numbers more as he faces more shots. The bar shows the model’s best estimate and an 80% range for his real talent.">
            <Card>
                <Row style={{justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10}}>
                    <View>
                        <T variant="caption" muted>Estimated talent</T>
                        <T variant="stat" color={color}>{savePct(talent.estimate)}</T>
                    </View>
                    <View style={styles.right}>
                        <T variant="caption" muted>Actual</T>
                        <T variant="heading">{talent.observed == null ? '–' : savePct(talent.observed)}</T>
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
                <T variant="caption" muted style={{marginTop: 8}}>
                    80% range: {savePct(talent.lo)} – {savePct(talent.hi)}
                </T>
            </Card>
            <View style={styles.tileRow}>
                <View style={styles.flex}>
                    <XgTile
                        label="Goals saved vs avg"
                        value={signed(gsaa, 1)}
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
            <T variant="caption" muted style={{marginTop: 8}}>{weight}% of this estimate is his own data.</T>
        </Section>
    );
});

/* ---------------------------------------------------------- projection */

export const ProjectionCard = memo(function ProjectionCard({goals, points, priorSource, remaining, color}) {
    if (!goals || !points) return null;
    const line = (label, abbr, pr) => (
        <View style={styles.projRow}>
            <T variant="caption" muted>{label}</T>
            <Row gap={6} style={{alignItems: 'baseline'}}>
                <T variant="stat" color={color}>Projected {Math.round(pr.projected)} {abbr}</T>
                <T variant="label" muted>({Math.round(pr.lo)}–{Math.round(pr.hi)})</T>
            </Row>
        </View>
    );
    return (
        <Section
            title="Season projection"
            info={`A model estimate of his final regular-season totals. It starts from his scoring rate ${priorSource === 'position' ? 'typical for his position' : `last season (${priorSource})`}, updates with this season’s games, and simulates the ${remaining} games left. The range covers 80% of likely outcomes.`}>
            <Card style={{gap: 12}}>
                {line('Goals', 'G', goals)}
                {line('Points', 'PTS', points)}
                <T variant="caption" muted>{remaining} games remaining · 80% range in brackets</T>
            </Card>
        </Section>
    );
});

/* ---------------------------------------------------------- game tables */

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
            <Card style={styles.tableCard}>
                <DataTable columns={goalie ? GOALIE_GAME_COLS : SKATER_GAME_COLS} rows={rows} keyExtractor={gameKey}/>
            </Card>
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
            <Card style={styles.tableCard}>
                <DataTable
                    columns={goalie ? GOALIE_CAREER_COLS : SKATER_CAREER_COLS}
                    rows={all}
                    keyExtractor={careerKey}
                    highlight={(s) => s._career || String(s.season) === String(highlightSeason)}
                />
            </Card>
        </Section>
    );
});

const styles = StyleSheet.create({
    flex: {flex: 1},
    flexShrink: {flexShrink: 1},
    right: {alignItems: 'flex-end'},
    hero: {
        borderRadius: 24,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    heroStripe: {position: 'absolute', left: 0, top: 0, bottom: 0, width: 5},
    bio: {paddingVertical: 4},
    bioRow: {flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 12},
    bioLabel: {width: 64, paddingTop: 1},
    grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    mini: {flexGrow: 1, flexBasis: '30%', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12},
    miniSkeleton: {flexGrow: 1, flexBasis: '30%'},
    tileRow: {flexDirection: 'row', gap: 8, marginTop: 8},
    tile: {borderRadius: 16, padding: 14},
    projRow: {gap: 2},
    tableCard: {paddingVertical: 4},
    chartTabs: {marginBottom: 10},
    noPad: {paddingHorizontal: 0},
});
