import React, {memo, useState} from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import Svg, {Circle, G, Line, Polygon, Text as SvgText} from 'react-native-svg';
import {Row, Section, T, tap} from '../../components/ui';
import {GUTTER, useAppTheme, withAlpha} from '../../theme';
import {ordinal} from './edge';
import {radarGeometry} from './radar';

/**
 * NHL Edge percentiles as a radar chart: one axis per metric (centre = 0, rim = 100th percentile),
 * the player's shape filled in his team colour over the dashed league-average (50th) ring.
 * Tap an axis label to highlight that metric and show its number and the league average. metrics: skaterEdge() / goalieEdge().
 */
function EdgeRadial({metrics, color, subtitle}) {
    const {colors} = useAppTheme();
    const {width} = useWindowDimensions();
    const [active, setActive] = useState(null);
    if (!metrics?.length) return null;

    const size = Math.min(width - GUTTER * 2, 340);
    const g = radarGeometry(size, metrics.map((m) => m.percentile));
    const picked = metrics.find((m) => m.key === active);
    const select = (key) => {
        tap();
        setActive((k) => (k === key ? null : key));
    };

    return (
        <Section title="Percentiles">
            {subtitle ? <T variant="caption" muted style={styles.subtitle}>{subtitle}</T> : null}
            <View style={styles.chart}>
                <Svg width={size} height={size}>
                    {g.rings.map((pts, i) => (
                        <Polygon
                            key={i}
                            points={pts}
                            fill={i === g.rings.length - 1 ? withAlpha(colors.text, 0.03) : 'none'}
                            stroke={i === 1 ? withAlpha(colors.text, 0.35) : colors.border}
                            strokeWidth={1}
                            strokeDasharray={i === 1 ? '4 4' : undefined}
                        />
                    ))}
                    {g.axes.map((a, i) => (
                        <Line key={i} x1={g.c} y1={g.c} x2={a.x} y2={a.y} stroke={colors.border} strokeWidth={1}/>
                    ))}
                    <Polygon points={g.shape} fill={withAlpha(color, 0.28)} stroke={color} strokeWidth={2.5} strokeLinejoin="round"/>
                    {g.dots.map((d, i) => (
                        <Circle
                            key={metrics[i].key}
                            cx={d.x}
                            cy={d.y}
                            r={active === metrics[i].key ? 6 : 4}
                            fill={active === metrics[i].key ? colors.text : color}
                            stroke={colors.background}
                            strokeWidth={1.5}
                        />
                    ))}
                    {g.axes.map((a, i) => {
                        const m = metrics[i];
                        const dim = active && active !== m.key;
                        return (
                            <G key={m.key} onPress={() => select(m.key)} opacity={dim ? 0.35 : 1}>
                                {/* Invisible target so the small label is easy to tap. */}
                                <Circle cx={a.lx + (a.anchor === 'start' ? 24 : a.anchor === 'end' ? -24 : 0)} cy={a.ly + 6} r={26} fill="transparent"/>
                                <SvgText x={a.lx} y={a.ly} fill={colors.textSecondary} fontSize={11} fontFamily="Sora_500Medium" textAnchor={a.anchor}>
                                    {m.short}
                                </SvgText>
                                <SvgText x={a.lx} y={a.ly + 17} fill={m.percentile >= 0.9 ? color : colors.text} fontSize={16} fontFamily="Sora_600SemiBold" textAnchor={a.anchor}>
                                    {Math.round(m.percentile * 100)}
                                </SvgText>
                            </G>
                        );
                    })}
                </Svg>
            </View>
            <Row gap={16} style={styles.legend}>
                <Row gap={6}>
                    <View style={[styles.swatch, {backgroundColor: withAlpha(color, 0.5), borderColor: color}]}/>
                    <T variant="caption" muted>Percentile</T>
                </Row>
                <Row gap={6}>
                    <View style={[styles.dash, {borderColor: withAlpha(colors.text, 0.45)}]}/>
                    <T variant="caption" muted>League average</T>
                </Row>
            </Row>
            {/* The selected stat's actual number and the league average, in place of a full list. */}
            <T variant="caption" muted style={styles.detail}>
                {picked ? `${picked.label}: ${picked.value} · league avg ${picked.avg} · ${ordinal(picked.percentile * 100)} percentile` : 'Tap a stat for its numbers'}
            </T>
        </Section>
    );
}

export default memo(EdgeRadial);

const styles = StyleSheet.create({
    subtitle: {marginTop: -6, marginBottom: 4},
    chart: {alignItems: 'center'},
    legend: {justifyContent: 'center', marginTop: 2},
    swatch: {width: 12, height: 12, borderRadius: 3, borderWidth: 1.5},
    dash: {width: 16, borderTopWidth: 1.5, borderStyle: 'dashed'},
    detail: {textAlign: 'center', marginTop: 10, minHeight: 34},
});
