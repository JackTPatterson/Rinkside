import React, {memo, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import LineChart from '../../components/LineChart';
import {EmptyState, ErrorState, FadeInView, InfoTip, PillTabs, Row, Skeleton, StatTile, T} from '../../components/ui';
import {GUTTER, useAppTheme} from '../../theme';
import {seasonLabel} from '../../utils/season';
import {buildMetric, METRIC_BY_KEY, METRICS, mpDateLabel} from './data';

const TABS = METRICS.map((m) => ({key: m.key, label: m.label}));

const fmtPct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '–');
const fmtDiff = (v) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(0)}` : '–');

function StatsTab({abbrev, data, loading, error, onRetry}) {
    const {colors, teamColor} = useAppTheme();
    const [metric, setMetric] = useState('xg');
    const games = data?.games;
    const m = METRIC_BY_KEY[metric];
    const series = useMemo(() => (games?.length >= 2 ? buildMetric(games, metric) : null), [games, metric]);

    if (loading && !data) {
        return (
            <View style={styles.pad}>
                <Skeleton height={30} width={200} radius={15}/>
                <Skeleton height={54} radius={100} style={styles.mt20}/>
                <Skeleton height={260} radius={15} style={styles.mt12}/>
                <Row gap={16} style={styles.mt20}>
                    <Skeleton height={44} radius={10} width="30%"/>
                    <Skeleton height={44} radius={10} width="30%"/>
                    <Skeleton height={44} radius={10} width="30%"/>
                </Row>
            </View>
        );
    }
    if (error && !data) return <ErrorState message="Couldn’t load season stats." onRetry={onRetry}/>;
    if (!series) {
        return (
            <EmptyState
                title="No game data yet"
                message="Game-by-game numbers for this team aren’t published yet. Check back after a few games."
            />
        );
    }

    const color = teamColor(abbrev);
    const first = mpDateLabel(games[0]?.gameDate);
    const last = mpDateLabel(games[games.length - 1]?.gameDate);
    const fmt = series.isPct ? fmtPct : fmtDiff;
    const lastY = series.data[series.data.length - 1]?.y;

    return (
        <View>
            <T variant="title" style={styles.title}>Season Wide Stats</T>
            <PillTabs tabs={TABS} value={metric} onChange={setMetric}/>
            <View style={styles.pad}>
                {data.fallback ? (
                    <T variant="caption" muted style={styles.note}>
                        This season’s numbers aren’t out yet, showing {seasonLabel(data.seasonId)}.
                    </T>
                ) : null}
                <FadeInView>
                    <View style={styles.mt12}>
                        <Row gap={6} style={styles.chartHeader}>
                            <Row gap={6} style={styles.flex}>
                                <T variant="body" numberOfLines={1} style={styles.shrink}>{m.label}</T>
                                <InfoTip title={m.label} body={m.info}/>
                            </Row>
                            <T variant="title" style={styles.tabular}>{fmt(lastY)}</T>
                        </Row>
                        <T variant="caption" muted>
                            {m.kind === 'xg' ? 'Form line (recent games weigh most)' : m.kind === 'fo' ? 'Season-to-date win %' : 'Running differential'}
                            {` · ${games.length} games`}
                        </T>
                        <LineChart
                            data={series.data}
                            color={color}
                            colorBelow={series.isPct || m.kind === 'diff' ? colors.negative : undefined}
                            baseline={series.baseline}
                            format={fmt}
                            height={200}
                            style={styles.mt12}
                        />
                        <Row style={styles.axis}>
                            <T variant="caption" muted>{first}</T>
                            <T variant="caption" muted>{last}</T>
                        </Row>
                    </View>
                    <Row gap={16} style={styles.tiles}>
                        {series.tiles.map((t) => (
                            <StatTile key={t.label} label={t.label} value={t.value} style={styles.tile}/>
                        ))}
                    </Row>
                </FadeInView>
                <T variant="caption" muted style={styles.source}>Drag across the chart to see any game.</T>
            </View>
        </View>
    );
}

export default memo(StatsTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: GUTTER},
    flex: {flex: 1},
    shrink: {flexShrink: 1},
    tabular: {fontVariant: ['tabular-nums']},
    title: {paddingHorizontal: GUTTER, marginBottom: 20},
    mt4: {marginTop: 4},
    mt12: {marginTop: 12},
    mt20: {marginTop: 20},
    note: {marginTop: 12},
    chartHeader: {marginBottom: 4},
    axis: {justifyContent: 'space-between', marginTop: 6},
    tiles: {marginTop: 20, alignItems: 'stretch'},
    tile: {minWidth: 0, backgroundColor: 'transparent', padding: 0, borderRadius: 0},
    source: {marginTop: 15},
});
