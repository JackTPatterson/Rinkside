import React, {memo, useState} from 'react';
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import Svg, {ClipPath, Defs, G, Polygon, Rect, Text as SvgText} from 'react-native-svg';
import RinkSvg from '../../components/RinkSvg';
import {Location} from '../../components/icons';
import {Row, Segmented, Sheet, T, tap} from '../../components/ui';
import {useAppTheme, withAlpha} from '../../theme';
import {SHOT_ZONES, ZONE_ORDER, mapHeight, toScreen} from './shotZones';

const MODES = [{key: 'sog', label: 'Shots'}, {key: 'goals', label: 'Goals'}, {key: 'pct', label: 'Shooting %'}];
const pctLabel = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);

/** The offensive zone as tiles, each shaded by the player's shots / goals / shooting % from there. */
function ZoneMap({areas, mode, color, width}) {
    const {colors} = useAppTheme();
    const h = mapHeight(width);
    const pt = (p) => toScreen(p, width);
    const valueOf = (a) => (mode === 'pct' ? (a?.sog ? a.goals / a.sog : null) : a?.[mode] ?? 0);
    const max = Math.max(1e-9, ...ZONE_ORDER.map((k) => (mode === 'pct' ? 0 : valueOf(areas[k]) ?? 0)));
    const strength = (v) => (v == null || v === 0 ? 0 : mode === 'pct' ? Math.min(1, v / 0.4) : v / max);
    const s = width / 85; // px per foot
    return (
        <View style={{width, height: h}}>
            <Svg width={width} height={h}>
                <Defs>
                    <ClipPath id="rink">
                        <Rect x={0} y={0} width={width} height={h + 40 * s} rx={28 * s} ry={28 * s}/>
                    </ClipPath>
                </Defs>
                <G clipPath="url(#rink)">
                    <Rect x={0} y={0} width={width} height={h} fill={colors.card}/>
                    {ZONE_ORDER.map((k) => {
                        const z = SHOT_ZONES[k];
                        const v = valueOf(areas[k]);
                        const f = strength(v);
                        const points = z.pts.map((p) => pt(p).join(',')).join(' ');
                        return (
                            <Polygon
                                key={k}
                                points={points}
                                fill={f > 0 ? withAlpha(color, 0.18 + 0.82 * f) : colors.card}
                                stroke={colors.background}
                                strokeWidth={2}
                            />
                        );
                    })}
                </G>
                {ZONE_ORDER.map((k) => {
                    const z = SHOT_ZONES[k];
                    const v = valueOf(areas[k]);
                    const [lx, ly] = pt(z.label);
                    const strong = strength(v) > 0.55;
                    return (
                        <SvgText
                            key={k}
                            x={lx}
                            y={ly + (z.small ? 3 : 5)}
                            fill={strong ? '#FFFFFF' : v ? colors.text : colors.textSecondary}
                            fontSize={z.small ? 10 : 14}
                            fontFamily="Sora_600SemiBold"
                            textAnchor="middle">
                            {mode === 'pct' ? (v == null ? '' : pctLabel(v)) : String(v ?? 0)}
                        </SvgText>
                    );
                })}
            </Svg>
            {/* The real rink markings, faint, over the tiles. */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <RinkSvg view="zone" width={width} height={h} lines/>
            </View>
        </View>
    );
}

/**
 * "Shot map" button + sheet: where the player's shots on goal came from this season (NHL Edge
 * shot locations), as shots, goals or shooting % per area. data: skater-comparison payload.
 */
function ShotMap({data, color, seasonLabel}) {
    const {colors} = useAppTheme();
    const {width} = useWindowDimensions();
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('sog');
    const areas = Object.fromEntries((data?.shotLocationDetails ?? []).map((a) => [a.area, a]));
    const total = (data?.shotLocationTotals ?? []).find((t) => t.locationCode === 'all');
    if (!total?.sog) return null;
    const far = ['Offensive Neutral Zone', 'Beyond Red Line'].reduce((n, k) => n + (areas[k]?.sog ?? 0), 0);
    const mapW = Math.min(width - 40, 380);
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Shot map"
                hitSlop={8}
                onPress={() => {
                    tap();
                    setOpen(true);
                }}
                style={({pressed}) => [styles.button, {backgroundColor: colors.card}, pressed && styles.pressed]}>
                <Location size={16} color={colors.text}/>
                <T variant="caption" style={styles.semi}>Shot map</T>
            </Pressable>
            <Sheet visible={open} onClose={() => setOpen(false)} style={styles.sheet}>
                <T variant="title">Shot map</T>
                {seasonLabel ? <T variant="caption" muted>{seasonLabel} · shots on goal</T> : null}
                <Row gap={0} style={styles.totals}>
                    {[['Shots', total.sog], ['Goals', total.goals], ['Shooting %', pctLabel(total.shootingPctg)]].map(([label, v]) => (
                        <View key={label} style={styles.total}>
                            <T variant="body" style={styles.totalValue}>{v ?? '–'}</T>
                            <T variant="caption" muted>{label}</T>
                        </View>
                    ))}
                </Row>
                <Segmented options={MODES} value={mode} onChange={setMode}/>
                <View style={styles.map}>
                    <ZoneMap areas={areas} mode={mode} color={color} width={mapW}/>
                </View>
                {far ? <T variant="caption" muted style={styles.note}>Plus {far} from outside the zone</T> : null}
            </Sheet>
        </>
    );
}

export default memo(ShotMap);

const styles = StyleSheet.create({
    semi: {fontFamily: 'Sora_600SemiBold'},
    pressed: {opacity: 0.6},
    button: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100},
    sheet: {paddingHorizontal: 20},
    totals: {marginVertical: 16},
    total: {flex: 1, alignItems: 'center'},
    totalValue: {fontFamily: 'Sora_600SemiBold', fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums']},
    map: {alignItems: 'center', marginTop: 16},
    note: {textAlign: 'center', marginTop: 10},
});
