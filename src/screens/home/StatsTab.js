import React, {memo, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import LineChart from '../../components/LineChart';
import {Card, EmptyState, ErrorState, FadeInView, InfoTip, PillTabs, Row, Skeleton, StatTile, T} from '../../components/ui';
import {useAppTheme} from '../../theme';
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
                <Skeleton height={38} radius={999}/>
                <Skeleton height={310} radius={16} style={styles.mt12}/>
                <Row style={styles.mt12}>
                    <Skeleton height={72} radius={16} width="32%"/>
                    <Skeleton height={72} radius={16} width="32%"/>
                    <Skeleton height={72} radius={16} width="32%"/>
                </Row>
            </View>
        );
    }
    if (error && !data) return <ErrorState message="Couldn’t load season stats." onRetry={onRetry}/>;
    if (!series) {
        return (
            <EmptyState
                title="No game data yet"
                message="MoneyPuck hasn’t published game-by-game numbers for this team yet. Check back after a few games."
            />
        );
    }

    const color = teamColor(abbrev);
    const first = mpDateLabel(games[0]?.gameDate);
    const last = mpDateLabel(games[games.length - 1]?.gameDate);

    return (
        <View>
            <PillTabs tabs={TABS} value={metric} onChange={setMetric}/>
            <View style={styles.pad}>
                {data.fallback ? (
                    <T variant="caption" muted style={styles.note}>
                        This season’s numbers aren’t out yet, showing {seasonLabel(data.seasonId)}.
                    </T>
                ) : null}
                <FadeInView>
                    <Card style={styles.mt12}>
                        <Row gap={6} style={styles.chartHeader}>
                            <T variant="heading" style={styles.flex}>{m.label}</T>
                            <InfoTip title={m.label} body={m.info}/>
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
                            format={series.isPct ? fmtPct : fmtDiff}
                            height={200}
                            style={styles.mt12}
                        />
                        <Row style={styles.axis}>
                            <T variant="caption" muted>{first}</T>
                            <T variant="caption" muted>{last}</T>
                        </Row>
                    </Card>
                    <Row style={styles.tiles}>
                        {series.tiles.map((t) => (
                            <StatTile key={t.label} label={t.label} value={t.value} style={styles.tile}/>
                        ))}
                    </Row>
                </FadeInView>
                <T variant="caption" muted style={styles.source}>Data: MoneyPuck.com, all situations. Drag across the chart to see any game.</T>
            </View>
        </View>
    );
}

export default memo(StatsTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: 16},
    flex: {flex: 1},
    mt12: {marginTop: 12},
    note: {marginTop: 12},
    chartHeader: {marginBottom: 2},
    axis: {justifyContent: 'space-between', marginTop: 6},
    tiles: {marginTop: 8, alignItems: 'stretch'},
    tile: {minWidth: 0},
    source: {marginTop: 16},
});
