import * as Haptics from 'expo-haptics';
import React, {memo, useEffect, useState} from 'react';
import {Image, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';
import {SvgUri} from 'react-native-svg';
import {LOCAL_LOGOS, remoteLogoUrl} from '../data/logos';
import {readableOn, useAppTheme, withAlpha} from '../theme';
import {ArrowLeft2, CloseCircle, InfoCircle} from './icons';

export const tap = () => Haptics.selectionAsync().catch(() => {});

/* ------------------------------------------------------------------ text */

const VARIANTS = {
    display: {fontFamily: 'Sora_700Bold', fontSize: 30, lineHeight: 36},
    title: {fontFamily: 'Sora_600SemiBold', fontSize: 24, lineHeight: 30},
    heading: {fontFamily: 'Sora_600SemiBold', fontSize: 18, lineHeight: 24},
    body: {fontFamily: 'Sora_500Medium', fontSize: 15, lineHeight: 21},
    label: {fontFamily: 'Sora_600SemiBold', fontSize: 13, lineHeight: 18},
    caption: {fontFamily: 'Sora_500Medium', fontSize: 12, lineHeight: 16},
    stat: {fontFamily: 'Sora_700Bold', fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums']},
};

/** Text with app typography. `muted` uses the secondary colour. Dynamic Type is capped so layouts hold. */
export const T = memo(function T({variant = 'body', muted, color, style, children, ...rest}) {
    const {colors} = useAppTheme();
    return (
        <Text
            maxFontSizeMultiplier={1.3}
            style={[VARIANTS[variant], {color: color ?? (muted ? colors.textSecondary : colors.text)}, style]}
            {...rest}>
            {children}
        </Text>
    );
});

/* --------------------------------------------------------------- layout */

/** Full-screen container with safe-area top inset and app background. */
export function Screen({children, edges = ['top'], style}) {
    const {colors} = useAppTheme();
    return (
        <SafeAreaView edges={edges} style={[{flex: 1, backgroundColor: colors.background}, style]}>
            {children}
        </SafeAreaView>
    );
}

export function Header({title, subtitle, left, right, style}) {
    return (
        <View style={[styles.header, style]}>
            {left}
            <View style={{flex: 1}}>
                <T variant="title" numberOfLines={1}>{title}</T>
                {subtitle ? <T variant="caption" muted numberOfLines={1}>{subtitle}</T> : null}
            </View>
            {right}
        </View>
    );
}

/** Circular back button for detail screens (the native swipe-back gesture also works). */
export function BackButton({onPress, color}) {
    const {colors} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={() => {
                tap();
                onPress();
            }}
            style={({pressed}) => [styles.back, {backgroundColor: colors.card}, pressed && {opacity: 0.6}]}>
            <ArrowLeft2 size={20} color={color ?? colors.text}/>
        </Pressable>
    );
}

export function Card({children, style, onPress, onLongPress, accessibilityLabel}) {
    const {colors} = useAppTheme();
    const base = [styles.card, {backgroundColor: colors.card}, style];
    if (!onPress && !onLongPress) return <View style={base}>{children}</View>;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({pressed}) => [base, pressed && {opacity: 0.7, transform: [{scale: 0.985}]}]}>
            {children}
        </Pressable>
    );
}

export function Section({title, right, info, children, style}) {
    return (
        <View style={[{marginTop: 24}, style]}>
            {title ? (
                <View style={styles.sectionHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1}}>
                        <T variant="heading">{title}</T>
                        {info ? <InfoTip title={title} body={info}/> : null}
                    </View>
                    {right}
                </View>
            ) : null}
            {children}
        </View>
    );
}

export function Row({children, style, gap = 8}) {
    return <View style={[{flexDirection: 'row', alignItems: 'center', gap}, style]}>{children}</View>;
}

/** Fades content in once when it mounts (UI-thread animation). */
export function FadeInView({children, delay = 0, style}) {
    return (
        <Animated.View entering={FadeIn.duration(220).delay(delay)} style={style}>
            {children}
        </Animated.View>
    );
}

/* -------------------------------------------------------------- controls */

/**
 * Horizontal pill tabs.
 * tabs: [{key, label, icon?: IconComponent}]
 */
export function PillTabs({tabs, value, onChange, style, contentStyle}) {
    const {colors} = useAppTheme();
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[{flexGrow: 0}, style]}
            contentContainerStyle={[{paddingHorizontal: 16, gap: 8}, contentStyle]}>
            {tabs.map((t) => {
                const active = t.key === value;
                const fg = active ? colors.background : colors.text;
                const Icon = t.icon;
                return (
                    <Pressable
                        key={t.key}
                        accessibilityRole="tab"
                        accessibilityState={{selected: active}}
                        onPress={() => {
                            if (!active) {
                                tap();
                                onChange(t.key);
                            }
                        }}
                        style={[styles.pill, {backgroundColor: active ? colors.text : colors.card}]}>
                        {Icon ? <Icon size={18} color={fg}/> : null}
                        <T variant="label" color={fg}>{t.label}</T>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

/** Compact equal-width segmented control. options: [{key, label}] */
export function Segmented({options, value, onChange, style}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.segmented, {backgroundColor: colors.card}, style]}>
            {options.map((o) => {
                const active = o.key === value;
                return (
                    <Pressable
                        key={o.key}
                        accessibilityRole="button"
                        accessibilityState={{selected: active}}
                        onPress={() => {
                            if (!active) {
                                tap();
                                onChange(o.key);
                            }
                        }}
                        style={[styles.segment, active && {backgroundColor: colors.cardAlt}]}>
                        <T variant="caption" numberOfLines={1} muted={!active}>{o.label}</T>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** Small (i) button that opens an explanation sheet. Used for every advanced stat. */
export function InfoTip({title, body, size = 16}) {
    const {colors} = useAppTheme();
    const [open, setOpen] = useState(false);
    return (
        <>
            <Pressable
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={`About ${title}`}
                onPress={() => {
                    tap();
                    setOpen(true);
                }}>
                <InfoCircle size={size} color={colors.textSecondary}/>
            </Pressable>
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={[styles.modalBackdrop, {backgroundColor: colors.overlay}]} onPress={() => setOpen(false)}>
                    <View style={[styles.modalCard, {backgroundColor: colors.card}]}>
                        <Row style={{justifyContent: 'space-between', marginBottom: 8}}>
                            <T variant="heading" style={{flex: 1}}>{title}</T>
                            <CloseCircle size={22} color={colors.textSecondary}/>
                        </Row>
                        <T variant="body" muted>{body}</T>
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

/* ---------------------------------------------------------------- team */

/** Team logo: bundled PNG when we have one, NHL CDN SVG otherwise (e.g. Utah). */
export const TeamLogo = memo(function TeamLogo({abbrev, size = 40, style}) {
    const {dark} = useAppTheme();
    const local = LOCAL_LOGOS[abbrev];
    const w = size * 1.4;
    if (local) {
        return <Image source={local} style={[{width: w, height: size}, style]} resizeMode="contain"/>;
    }
    if (!abbrev) return <View style={[{width: w, height: size}, style]}/>;
    return (
        <View style={[{width: w, height: size, alignItems: 'center', justifyContent: 'center'}, style]}>
            <SvgUri uri={remoteLogoUrl(abbrev, dark)} width={w} height={size}/>
        </View>
    );
});

/** Player headshot with a neutral placeholder background. */
export const Headshot = memo(function Headshot({uri, size = 56, borderColor, style}) {
    const {colors} = useAppTheme();
    return (
        <Image
            source={uri ? {uri} : undefined}
            style={[{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.cardAlt,
                borderWidth: borderColor ? 2 : 0,
                borderColor,
            }, style]}
        />
    );
});

/* -------------------------------------------------------------- states */

/** Pulsing placeholder block. */
export function Skeleton({width = '100%', height = 16, radius = 8, style}) {
    const {colors} = useAppTheme();
    const o = useSharedValue(0.55);
    useEffect(() => {
        o.value = withRepeat(withTiming(1, {duration: 800}), -1, true);
    }, [o]);
    const anim = useAnimatedStyle(() => ({opacity: o.value}));
    return <Animated.View style={[{width, height, borderRadius: radius, backgroundColor: colors.card}, anim, style]}/>;
}

export function SkeletonList({count = 4, height = 72, gap = 8, style}) {
    return (
        <View style={[{gap}, style]}>
            {Array.from({length: count}).map((_, i) => <Skeleton key={i} height={height} radius={16}/>)}
        </View>
    );
}

export function ErrorState({message = 'Couldn’t load this right now.', onRetry, style}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.state, style]}>
            <T variant="body" muted style={{textAlign: 'center'}}>{message}</T>
            {onRetry ? (
                <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                        tap();
                        onRetry();
                    }}
                    style={[styles.retry, {backgroundColor: colors.text}]}>
                    <T variant="label" color={colors.background}>Try again</T>
                </Pressable>
            ) : null}
        </View>
    );
}

export function EmptyState({title, message, style}) {
    return (
        <View style={[styles.state, style]}>
            {title ? <T variant="heading" style={{textAlign: 'center'}}>{title}</T> : null}
            {message ? <T variant="body" muted style={{textAlign: 'center'}}>{message}</T> : null}
        </View>
    );
}

/** Blinking red dot for live games. */
export function LiveDot({size = 8}) {
    const {colors} = useAppTheme();
    const o = useSharedValue(1);
    useEffect(() => {
        o.value = withRepeat(withTiming(0.3, {duration: 900}), -1, true);
    }, [o]);
    const anim = useAnimatedStyle(() => ({opacity: o.value}));
    return <Animated.View style={[{width: size, height: size, borderRadius: size / 2, backgroundColor: colors.live}, anim]}/>;
}

export function Badge({label, color, textColor, style}) {
    const {colors} = useAppTheme();
    const bg = color ?? colors.cardAlt;
    return (
        <View style={[styles.badge, {backgroundColor: bg}, style]}>
            <T variant="caption" color={textColor ?? (color ? readableOn(color) : colors.text)}>{label}</T>
        </View>
    );
}

/* ----------------------------------------------------------- data viz */

export function ProgressBar({value = 0, color, track, height = 6, style}) {
    const {colors} = useAppTheme();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    return (
        <View style={[{height, borderRadius: height, backgroundColor: track ?? colors.cardAlt, overflow: 'hidden'}, style]}>
            <View style={{width: `${v * 100}%`, height: '100%', backgroundColor: color ?? colors.text, borderRadius: height}}/>
        </View>
    );
}

/**
 * Two-sided probability bar: left share in leftColor, remainder in rightColor.
 * Optional middle share (e.g. overtime) in neutral.
 */
export function SplitBar({left, middle = 0, leftColor, rightColor, height = 10, style}) {
    const {colors} = useAppTheme();
    const l = Math.max(0, Math.min(1, left || 0));
    const m = Math.max(0, Math.min(1 - l, middle || 0));
    return (
        <View style={[{flexDirection: 'row', height, borderRadius: height, overflow: 'hidden', gap: 2}, style]}>
            <View style={{flex: l || 0.0001, backgroundColor: leftColor}}/>
            {m > 0 ? <View style={{flex: m, backgroundColor: colors.cardAlt}}/> : null}
            <View style={{flex: 1 - l - m || 0.0001, backgroundColor: rightColor}}/>
        </View>
    );
}

/**
 * Head-to-head stat row: "home value | label | away value" with a split bar underneath.
 * `higherIsBetter=false` flips which side gets emphasised (e.g. goals against).
 */
export function CompareRow({label, left, right, leftColor, rightColor, format = (v) => v, higherIsBetter = true, info}) {
    const {colors} = useAppTheme();
    const l = Number(left) || 0;
    const r = Number(right) || 0;
    const total = Math.abs(l) + Math.abs(r);
    const share = total > 0 ? Math.abs(l) / total : 0.5;
    const leftBetter = higherIsBetter ? l > r : l < r;
    const rightBetter = higherIsBetter ? r > l : r < l;
    return (
        <View style={{marginBottom: 14}}>
            <Row style={{justifyContent: 'space-between', marginBottom: 6}}>
                <T variant="label" style={{opacity: leftBetter ? 1 : 0.6, minWidth: 56}}>{format(left)}</T>
                <Row gap={4}>
                    <T variant="caption" muted>{label}</T>
                    {info ? <InfoTip title={label} body={info} size={14}/> : null}
                </Row>
                <T variant="label" style={{opacity: rightBetter ? 1 : 0.6, minWidth: 56, textAlign: 'right'}}>{format(right)}</T>
            </Row>
            <SplitBar left={share} leftColor={leftColor ?? colors.text} rightColor={rightColor ?? colors.textSecondary} height={6}/>
        </View>
    );
}

/** Big number with a caption underneath. */
export function StatTile({label, value, sub, color, info, style}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.tile, {backgroundColor: colors.card}, style]}>
            <Row gap={4} style={{marginBottom: 4}}>
                <T variant="caption" muted numberOfLines={1} style={{flexShrink: 1}}>{label}</T>
                {info ? <InfoTip title={label} body={info} size={14}/> : null}
            </Row>
            <T variant="stat" color={color} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
            {sub ? <T variant="caption" muted numberOfLines={2}>{sub}</T> : null}
        </View>
    );
}

/**
 * Simple table. columns: [{key, title, width, align?, render?(row)}]. Horizontal scroll when wide.
 * For long lists (>50 rows) render rows in a FlatList instead.
 */
export function DataTable({columns, rows, keyExtractor = (r, i) => String(i), onRowPress, style, highlight}) {
    const {colors} = useAppTheme();
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
            <View>
                <View style={[styles.tr, {borderBottomColor: colors.border}]}>
                    {columns.map((c) => (
                        <T key={c.key} variant="caption" muted style={{width: c.width, textAlign: c.align ?? 'left'}} numberOfLines={1}>
                            {c.title}
                        </T>
                    ))}
                </View>
                {rows.map((r, i) => {
                    const content = columns.map((c) => {
                        const v = c.render ? c.render(r, i) : r[c.key];
                        return typeof v === 'string' || typeof v === 'number' ? (
                            <T key={c.key} variant="body" style={{width: c.width, textAlign: c.align ?? 'left'}} numberOfLines={1}>{v}</T>
                        ) : (
                            <View key={c.key} style={{width: c.width, alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start'}}>{v}</View>
                        );
                    });
                    const rowStyle = [styles.tr, {borderBottomColor: colors.border}, highlight?.(r) && {backgroundColor: withAlpha(colors.accent, 0.12)}];
                    return onRowPress ? (
                        <Pressable key={keyExtractor(r, i)} onPress={() => onRowPress(r)} style={({pressed}) => [rowStyle, pressed && {opacity: 0.6}]}>
                            {content}
                        </Pressable>
                    ) : (
                        <View key={keyExtractor(r, i)} style={rowStyle}>{content}</View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    header: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12},
    card: {borderRadius: 16, padding: 14},
    back: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
    sectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
    pill: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999},
    segmented: {flexDirection: 'row', borderRadius: 12, padding: 3, minHeight: 44},
    segment: {flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, paddingVertical: 8, borderRadius: 10},
    modalBackdrop: {flex: 1, justifyContent: 'center', padding: 24},
    modalCard: {borderRadius: 20, padding: 20},
    state: {alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12},
    retry: {paddingHorizontal: 24, minHeight: 44, justifyContent: 'center', borderRadius: 999},
    badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start'},
    tile: {borderRadius: 16, padding: 14, flex: 1, minWidth: 140},
    tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth},
});
