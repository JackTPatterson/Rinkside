import * as Haptics from 'expo-haptics';
import React, {memo, useEffect, useRef, useState} from 'react';
import {Image, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {SvgUri} from 'react-native-svg';
import {LOCAL_LOGOS, remoteLogoUrl} from '../data/logos';
import {GUTTER, SheetSurface, readableOn, useAppTheme, withAlpha} from '../theme';
import {ArrowLeft2, Close, InfoCircle} from './icons';

export const tap = () => Haptics.selectionAsync().catch(() => {});

/* ------------------------------------------------------------------ text */

const VARIANTS = {
    display: {fontFamily: 'Sora_600SemiBold', fontSize: 30, lineHeight: 36},
    title: {fontFamily: 'Sora_600SemiBold', fontSize: 24, lineHeight: 30},
    heading: {fontFamily: 'Sora_600SemiBold', fontSize: 18, lineHeight: 24},
    body: {fontFamily: 'Sora_500Medium', fontSize: 16, lineHeight: 22},
    label: {fontFamily: 'Sora_600SemiBold', fontSize: 13, lineHeight: 18},
    caption: {fontFamily: 'Sora_500Medium', fontSize: 12, lineHeight: 16},
    stat: {fontFamily: 'Sora_600SemiBold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums']},
};

/**
 * Global text scale. The original Rinkside UI read smaller than the sizes above at 1.0, so every
 * size (variants and per-screen overrides alike) is multiplied by this one factor.
 */
export const TEXT_SCALE = 0.88;

function scaled(style) {
    const flat = StyleSheet.flatten(style);
    if (flat.fontSize != null) flat.fontSize = Math.round(flat.fontSize * TEXT_SCALE * 2) / 2;
    if (flat.lineHeight != null) flat.lineHeight = Math.round(flat.lineHeight * TEXT_SCALE);
    return flat;
}

/** Text with app typography. `muted` uses the secondary colour. Dynamic Type is capped so layouts hold. */
export const T = memo(function T({variant = 'body', muted, color, style, children, ...rest}) {
    const {colors} = useAppTheme();
    return (
        <Text
            maxFontSizeMultiplier={1.3}
            // Shrink-to-fit never goes below 70% unless a screen asks for less, so long names stay legible.
            minimumFontScale={rest.adjustsFontSizeToFit ? 0.7 : undefined}
            style={scaled([VARIANTS[variant], {color: color ?? (muted ? colors.textSecondary : colors.text)}, style])}
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

/** Screen header. `titleNode` replaces the title + subtitle text (e.g. an animated title). */
export function Header({title, subtitle, titleNode, left, right, style}) {
    return (
        <View style={[styles.header, style]}>
            {left}
            <View style={{flex: 1}}>
                {titleNode ?? (
                    <>
                        <T variant="title" numberOfLines={1}>{title}</T>
                        {subtitle ? <T variant="caption" muted numberOfLines={1}>{subtitle}</T> : null}
                    </>
                )}
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
            style={({pressed}) => [base, pressed && {opacity: 0.7}]}>
            {children}
        </Pressable>
    );
}

export function Section({title, right, info, children, style}) {
    return (
        <View style={[{marginTop: 20}, style]}>
            {title ? (
                <View style={styles.sectionHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1}}>
                        <T variant="title">{title}</T>
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
/* ------------------------------------------------------ tab triggers */

// Kalshi-style motion: the active pill springs to its new spot with a slight overshoot.
const SEG_PAD = 3;
// Tight: damping ratio ≈ 0.75 (about 3% overshoot), settles in roughly 0.25 s.
const PILL_SPRING = {damping: 26, stiffness: 420, mass: 0.7};

/**
 * Sliding selection shared by PillTabs and Segmented. The highlight is one view that springs to the
 * active item, and it carries its own copy of the labels in the "active" colours, clipped to itself
 * and counter-shifted so they line up exactly with the labels underneath. Mid-slide every label shows
 * the right colour exactly where the highlight is, and nothing hides behind opaque pills.
 */
function useSlide(box) {
    const x = useSharedValue(0);
    const w = useSharedValue(0);
    const ready = useRef(false);
    useEffect(() => {
        if (!box) return;
        if (!ready.current) {
            x.value = box.x;
            w.value = box.width;
            ready.current = true;
        } else {
            x.value = withSpring(box.x, PILL_SPRING);
            w.value = withSpring(box.width, PILL_SPRING);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [box?.x, box?.width]);
    // Unclamped, so the overshoot is real; the track (Segmented) or the rounded pill row (PillTabs)
    // clips whatever swings past its ends.
    const outer = useAnimatedStyle(() => ({transform: [{translateX: x.value}], width: w.value}));
    const inner = useAnimatedStyle(() => ({transform: [{translateX: -x.value}]}));
    return {outer, inner};
}

const PillLabel = ({tab, fg, active}) => {
    const Icon = tab.icon;
    return (
        <>
            {Icon ? <Icon size={18} color={fg} variant={active ? 'Bold' : 'Outline'}/> : null}
            <T variant="body" color={fg} style={[styles.pillText, styles.pillActive]}>{tab.label}</T>
        </>
    );
};

export function PillTabs({tabs, value, onChange, style, contentStyle}) {
    const {colors} = useAppTheme();
    const [layouts, setLayouts] = useState({}); // key → {x, width}, relative to the track
    const box = layouts[value];
    const slide = useSlide(box);
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[{flexGrow: 0}, style]}
            contentContainerStyle={[{paddingHorizontal: GUTTER}, contentStyle]}>
            {/* One grey track behind every pill, same as Segmented; it also clips the highlight's overshoot. */}
            <View style={[styles.pillTrack, {backgroundColor: colors.card}]}>
                {tabs.map((t) => {
                    const active = t.key === value;
                    // Until measured, the active pill paints itself; afterwards the sliding highlight does.
                    const selfActive = active && !box;
                    return (
                        <Pressable
                            key={t.key}
                            accessibilityRole="tab"
                            accessibilityState={{selected: active}}
                            onLayout={(e) => {
                                const {x: lx, width} = e.nativeEvent.layout;
                                setLayouts((cur) => (cur[t.key]?.x === lx && cur[t.key]?.width === width ? cur : {...cur, [t.key]: {x: lx, width}}));
                            }}
                            onPress={() => {
                                if (!active) {
                                    tap();
                                    onChange(t.key);
                                }
                            }}
                            style={({pressed}) => [styles.pill, selfActive && {backgroundColor: colors.text}, pressed && !active && {opacity: 0.7}]}>
                            <PillLabel tab={t} fg={selfActive ? colors.background : colors.text} active={selfActive}/>
                        </Pressable>
                    );
                })}
                {box ? (
                    <Animated.View pointerEvents="none" style={[styles.slideOuter, styles.pillSlide, {backgroundColor: colors.text}, slide.outer]}>
                        <Animated.View style={[styles.slideInner, slide.inner]}>
                            {tabs.map((t) => (layouts[t.key] ? (
                                <View key={t.key} style={[styles.pill, styles.pillCopy, {left: layouts[t.key].x, width: layouts[t.key].width}]}>
                                    <PillLabel tab={t} fg={colors.background} active/>
                                </View>
                            ) : null))}
                        </Animated.View>
                    </Animated.View>
                ) : null}
            </View>
        </ScrollView>
    );
}

/**
 * Kalshi-style primary tabs: text labels on a hairline with equal gaps between them (with 4+ tabs the
 * first is flush left and the last flush right; 2–3 tabs split the full width equally), and an underline matching the active label's width that slides between tabs.
 * When `value` isn't one of these tabs nothing is underlined.
 */
export function UnderlineTabs({tabs, value, onChange, style, scrollable = false}) {
    const {colors} = useAppTheme();
    const [layouts, setLayouts] = useState({}); // key → {x, width}
    const index = tabs.findIndex((t) => t.key === value);
    const box = index >= 0 ? layouts[tabs[index].key] : null;
    const few = !scrollable && tabs.length <= 3;
    const scrollRef = useRef(null);
    const [viewport, setViewport] = useState(0);
    const x = useSharedValue(0);
    const w = useSharedValue(0);
    const shown = useSharedValue(0);
    useEffect(() => {
        if (box) {
            // Slide between tabs; jump (while hidden) on first layout.
            const jump = shown.value < 0.5;
            const t = {duration: 220, easing: Easing.out(Easing.cubic)};
            x.value = jump ? box.x : withTiming(box.x, t);
            w.value = jump ? box.width : withTiming(box.width, t);
            // Scrollable: keep the active tab in view, roughly centred.
            if (scrollable && viewport) scrollRef.current?.scrollTo({x: Math.max(0, box.x + box.width / 2 - viewport / 2), animated: !jump});
        }
        shown.value = withTiming(box ? 1 : 0, {duration: 150});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [box?.x, box?.width, viewport]);
    const bar = useAnimatedStyle(() => ({transform: [{translateX: x.value}], width: w.value, opacity: shown.value}));

    const items = tabs.map((t) => {
        const active = t.key === value;
        return (
            <Pressable
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{selected: active}}
                hitSlop={{left: 8, right: 8}}
                onLayout={(e) => {
                    const {x: lx, width} = e.nativeEvent.layout;
                    setLayouts((cur) => (cur[t.key]?.x === lx && cur[t.key]?.width === width ? cur : {...cur, [t.key]: {x: lx, width}}));
                }}
                onPress={() => {
                    if (!active) {
                        tap();
                        onChange(t.key);
                    }
                }}
                style={({pressed}) => [styles.uTab, few && styles.uTabFull, pressed && {opacity: 0.6}]}>
                {/* Same font for both states so a label's width (and the spacing) never shifts. */}
                <T variant="body" numberOfLines={1} color={active ? colors.text : colors.textSecondary} style={styles.uTabText}>
                    {t.label}
                </T>
            </Pressable>
        );
    });
    const underline = <Animated.View pointerEvents="none" style={[styles.uBar, {backgroundColor: colors.text}, bar]}/>;

    if (scrollable) {
        // Too many tabs for one line: a horizontally scrolling row with a fixed gap (Kalshi-style). The
        // hairline spans the full width; the underline scrolls with the labels.
        return (
            <View style={style} accessibilityRole="tablist" onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
                <View pointerEvents="none" style={[styles.uLine, {backgroundColor: colors.border}]}/>
                <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.uScroll}>
                    <View style={styles.uScrollRow}>
                        {items}
                        {underline}
                    </View>
                </ScrollView>
            </View>
        );
    }
    return (
        // 4+ tabs: sized to their text with equal gaps, ends flush to the margins. 2–3 tabs: each takes an
        // equal share of the full width (and the underline spans that whole share).
        <View style={[styles.uTabs, style]} accessibilityRole="tablist">
            {items}
            <View pointerEvents="none" style={[styles.uLine, {backgroundColor: colors.border}]}/>
            {underline}
        </View>
    );
}

/**
 * Compact equal-width segmented control. options: [{key, label, color?}]; `color` fills the option when
 * selected (e.g. a team colour). The selection springs between options with a slight bounce.
 */
export function Segmented({options, value, onChange, style}) {
    const {colors} = useAppTheme();
    const [width, setWidth] = useState(0);
    const index = Math.max(0, options.findIndex((o) => o.key === value));
    const seg = options.length && width ? (width - SEG_PAD * 2) / options.length : 0;
    const box = seg ? {x: index * seg, width: seg} : null;
    const slide = useSlide(box);
    const activeColor = options[index]?.color ?? colors.text;
    const activeFg = options[index]?.color ? readableOn(options[index].color) : colors.background;
    return (
        <View style={[styles.segmented, {backgroundColor: colors.card}, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {options.map((o) => {
                const active = o.key === value;
                const selfActive = active && !seg;
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
                        style={({pressed}) => [styles.segment, selfActive && {backgroundColor: activeColor}, pressed && !active && {opacity: 0.7}]}>
                        <T variant="label" numberOfLines={1} color={selfActive ? activeFg : colors.text} style={styles.segmentActive}>{o.label}</T>
                    </Pressable>
                );
            })}
            {seg ? (
                <Animated.View pointerEvents="none" style={[styles.slideOuter, styles.segSlide, {backgroundColor: activeColor}, slide.outer]}>
                    <Animated.View style={[styles.slideInner, styles.segInner, {width: seg * options.length}, slide.inner]}>
                        {options.map((o) => (
                            <View key={o.key} style={[styles.segment, {width: seg}]}>
                                <T variant="label" numberOfLines={1} color={activeFg} style={styles.segmentActive}>{o.label}</T>
                            </View>
                        ))}
                    </Animated.View>
                </Animated.View>
            ) : null}
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
            <Sheet visible={open} onClose={() => setOpen(false)} style={styles.infoSheet}>
                <Row style={{justifyContent: 'space-between', marginBottom: 8}}>
                    <T variant="heading" style={{flex: 1}}>{title}</T>
                    <Pressable hitSlop={10} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
                        <Close size={22} color={colors.textSecondary}/>
                    </Pressable>
                </Row>
                <T variant="body" muted style={styles.infoBody}>{body}</T>
            </Sheet>
        </>
    );
}

/* --------------------------------------------------------------- sheet */

const SHEET_OUT = 240;
/** Open/snap-back spring: under-damped so the sheet overshoots a little and settles (Waze-style bounce). */
export const SHEET_SPRING = {damping: 30, stiffness: 400, mass: 1};
// Sheet background reaches this far below the screen, so the overshoot never shows a gap.
const SHEET_OVERSCAN = 120;

/**
 * Bottom sheet: the backdrop fades while the sheet springs up from the bottom with a small bounce;
 * drag the grabber down (or tap the backdrop) to dismiss. The sheet is the secondary grey and its
 * content renders inside SheetSurface. `height` (fraction of the screen) gives a fixed-height sheet
 * for flex content such as a ScrollView; otherwise it sizes to its content up to 88%.
 * `onClosed` runs once the sheet has fully gone. Open a browser, navigate etc. from there, never
 * while the sheet is still dismissing (iOS can't present over a closing modal and the app hangs).
 */
export function Sheet({visible, onClose, onClosed, children, style, height: heightFrac}) {
    const {colors} = useAppTheme();
    const insets = useSafeAreaInsets();
    const {height} = useWindowDimensions();
    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(0);
    const drag = useSharedValue(0);
    const closedCb = useRef(onClosed);
    closedCb.current = onClosed;
    const wasMounted = useRef(false);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        let t;
        if (visible) {
            setMounted(true);
            drag.value = 0;
            progress.value = withSpring(1, SHEET_SPRING);
        } else if (mounted) {
            progress.value = withTiming(0, {duration: SHEET_OUT, easing: Easing.in(Easing.cubic)});
            t = setTimeout(() => setMounted(false), SHEET_OUT);
        }
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // Android has no Modal onDismiss: report closure once the Modal is unmounted.
    useEffect(() => {
        if (wasMounted.current && !mounted && Platform.OS !== 'ios') closedCb.current?.();
        wasMounted.current = mounted;
    }, [mounted]);

    const pan = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
            drag.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_, g) => {
            if (g.dy > 120 || g.vy > 0.8) onCloseRef.current?.();
            else drag.value = withSpring(0, SHEET_SPRING);
        },
    })).current;

    const backdropStyle = useAnimatedStyle(() => ({opacity: Math.min(1, progress.value)}));
    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{translateY: (1 - progress.value) * height + drag.value}],
    }));

    const size = heightFrac ? {height: height * heightFrac + SHEET_OVERSCAN} : {maxHeight: height * 0.88 + SHEET_OVERSCAN};
    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
            onDismiss={() => closedCb.current?.()}>
            <Animated.View style={[StyleSheet.absoluteFill, {backgroundColor: colors.overlay}, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close"/>
            </Animated.View>
            <View style={styles.sheetWrap} pointerEvents="box-none">
                <Animated.View
                    style={[styles.sheet, {backgroundColor: colors.sheet, marginBottom: -SHEET_OVERSCAN, paddingBottom: SHEET_OVERSCAN}, size, sheetStyle]}>
                    <SheetSurface>
                        <View {...pan.panHandlers} style={styles.grabArea}>
                            <View style={[styles.grabber, {backgroundColor: colors.textSecondary}]}/>
                        </View>
                        <View style={[styles.sheetBody, {paddingBottom: insets.bottom + 10}, heightFrac && styles.flex1, style]}>
                            {children}
                        </View>
                    </SheetSurface>
                </Animated.View>
            </View>
        </Modal>
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
export function Skeleton({width = '100%', height = 16, radius = 15, style}) {
    const {colors} = useAppTheme();
    const o = useSharedValue(0.55);
    useEffect(() => {
        o.value = withRepeat(withTiming(1, {duration: 800}), -1, true);
    }, [o]);
    const anim = useAnimatedStyle(() => ({opacity: o.value}));
    return <Animated.View style={[{width, height, borderRadius: radius, backgroundColor: colors.card}, anim, style]}/>;
}

export function SkeletonList({count = 4, height = 72, gap = 10, style}) {
    return (
        <View style={[{gap}, style]}>
            {Array.from({length: count}).map((_, i) => <Skeleton key={i} height={height} radius={15}/>)}
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
export function LiveDot({size = 10}) {
    const {colors} = useAppTheme();
    const o = useSharedValue(1);
    useEffect(() => {
        o.value = withRepeat(withTiming(0.4, {duration: 1000}), -1, true);
    }, [o]);
    const anim = useAnimatedStyle(() => ({opacity: o.value}));
    return <Animated.View style={[{width: size, height: size, borderRadius: size / 2, backgroundColor: colors.live}, anim]}/>;
}

export function Badge({label, color, textColor, style, large}) {
    const {colors} = useAppTheme();
    const bg = color ?? colors.background;
    return (
        <View style={[styles.badge, large && styles.badgeLarge, {backgroundColor: bg}, style]}>
            <T variant="caption" color={textColor ?? (color ? readableOn(color) : colors.text)} style={large && styles.badgeLargeText}>{label}</T>
        </View>
    );
}

/**
 * Two (or more) badges joined like the split bars: rounded outer ends, flat inner ends, 3pt gap.
 * items: [{label, color?, textColor?}]; falsy items are skipped, and a lone item is a normal pill.
 * `large` is the bigger size used on the Live Games cards.
 */
export function PillPair({items, style, large}) {
    const list = items.filter(Boolean);
    const last = list.length - 1;
    return (
        <View style={[styles.pillPair, style]}>
            {list.map((it, i) => (
                <Badge
                    key={`${i}-${it.label}`}
                    label={it.label}
                    color={it.color}
                    textColor={it.textColor}
                    large={large}
                    style={[i > 0 && styles.flatLeft, i < last && styles.flatRight]}
                />
            ))}
        </View>
    );
}

/* ----------------------------------------------------------- data viz */

/**
 * Corner radii for a single-value bar fill: rounded at its origin, flat on the leading edge until the
 * fill is full (then rounded so it matches the pill track). `from` is the origin side.
 */
export function fillRadii(value, radius, from = 'left') {
    'worklet';
    const lead = value >= 0.9995 ? radius : 0;
    if (from === 'right') {
        return {borderTopRightRadius: radius, borderBottomRightRadius: radius, borderTopLeftRadius: lead, borderBottomLeftRadius: lead};
    }
    if (from === 'bottom') {
        return {borderBottomLeftRadius: radius, borderBottomRightRadius: radius, borderTopLeftRadius: lead, borderTopRightRadius: lead};
    }
    return {borderTopLeftRadius: radius, borderBottomLeftRadius: radius, borderTopRightRadius: lead, borderBottomRightRadius: lead};
}

/**
 * Corner radii for a range band drawn inside a pill track ([start, start + width] as 0–1 fractions):
 * an end is rounded only where it reaches the track's rounded end, interior ends are flat.
 */
export function bandRadii(start, width, radius) {
    const l = start <= 0.0005 ? radius : 0;
    const r = start + width >= 0.9995 ? radius : 0;
    return {borderTopLeftRadius: l, borderBottomLeftRadius: l, borderTopRightRadius: r, borderBottomRightRadius: r};
}

export function ProgressBar({value = 0, color, track, height = 6, style}) {
    const {colors} = useAppTheme();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    return (
        <View style={[{height, borderRadius: height / 2, backgroundColor: track ?? colors.cardAlt, overflow: 'hidden'}, style]}>
            <View style={[{width: `${v * 100}%`, height: '100%', backgroundColor: color ?? colors.text}, fillRadii(v, height / 2)]}/>
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
    const r = Math.max(0, 1 - l - m);
    // Outer ends rounded, inner ends flat, with a gap so similar team colours never run together.
    // Empty segments aren't drawn, so a segment at 100% is a single pill rounded on both ends.
    const parts = [[l, leftColor], [m, colors.cardAlt], [r, rightColor]].filter(([f]) => f > 0.0005);
    const R = height / 2;
    return (
        <View style={[{flexDirection: 'row', height, gap: 3}, style]}>
            {parts.map(([flex, backgroundColor], i) => (
                <View
                    key={i}
                    style={{
                        flex,
                        backgroundColor,
                        borderTopLeftRadius: i === 0 ? R : 0,
                        borderBottomLeftRadius: i === 0 ? R : 0,
                        borderTopRightRadius: i === parts.length - 1 ? R : 0,
                        borderBottomRightRadius: i === parts.length - 1 ? R : 0,
                    }}
                />
            ))}
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
                        <T key={c.key} variant="label" style={{width: c.width, textAlign: c.align ?? 'left', fontSize: 14, opacity: 0.5}} numberOfLines={1}>
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
    header: {flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 10},
    card: {borderRadius: 15, paddingVertical: 15, paddingHorizontal: 15},
    back: {width: 44, height: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    sectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
    pill: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, minHeight: 38, borderRadius: 100},
    pillText: {fontSize: 14, lineHeight: 18},
    pillActive: {fontFamily: 'Sora_600SemiBold'},
    segmentText: {fontFamily: 'Sora_500Medium', fontSize: 14},
    segmentActive: {fontFamily: 'Sora_600SemiBold', fontSize: 14},
    segmented: {flexDirection: 'row', borderRadius: 100, padding: 3, minHeight: 44, overflow: 'hidden'},
    segment: {flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, paddingVertical: 8, borderRadius: 100},
    pillTrack: {flexDirection: 'row', padding: SEG_PAD, borderRadius: 100, overflow: 'hidden'},
    pillSlide: {top: SEG_PAD, bottom: SEG_PAD},
    pillCopy: {position: 'absolute', top: 0},
    slideOuter: {position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 100, overflow: 'hidden'},
    slideInner: {position: 'absolute', top: 0, bottom: 0, left: 0},
    segSlide: {top: SEG_PAD, bottom: SEG_PAD, left: SEG_PAD},
    segInner: {flexDirection: 'row'},
    sheetWrap: {flex: 1, justifyContent: 'flex-end'},
    flex1: {flex: 1},
    sheetBody: {flexShrink: 1},
    infoSheet: {paddingHorizontal: 20},
    infoBody: {marginBottom: 24},
    sheet: {borderTopLeftRadius: 15, borderTopRightRadius: 15, overflow: 'hidden'},
    grabArea: {alignItems: 'center', paddingTop: 8, paddingBottom: 12},
    grabber: {width: 36, height: 5, borderRadius: 3, opacity: 0.5},
    modalBackdrop: {flex: 1, justifyContent: 'center', padding: 24},
    modalCard: {borderRadius: 15, padding: 20},
    state: {alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12},
    retry: {paddingHorizontal: 24, minHeight: 44, justifyContent: 'center', borderRadius: 999},
    badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 15, alignSelf: 'flex-start'},
    uTabs: {flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: GUTTER},
    uTabFull: {flex: 1},
    uScroll: {paddingHorizontal: GUTTER},
    uScrollRow: {flexDirection: 'row', gap: 24},
    uTab: {alignItems: 'center', justifyContent: 'center', minHeight: 44},
    uTabText: {fontFamily: 'Sora_600SemiBold', fontSize: 15, lineHeight: 20},
    uLine: {position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth},
    uBar: {position: 'absolute', left: 0, bottom: 0, height: 2.5, borderRadius: 2},
    badgeLarge: {paddingHorizontal: 12, paddingVertical: 4},
    badgeLargeText: {fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums']},
    pillPair: {flexDirection: 'row', alignItems: 'center', gap: 3},
    flatLeft: {borderTopLeftRadius: 0, borderBottomLeftRadius: 0},
    flatRight: {borderTopRightRadius: 0, borderBottomRightRadius: 0},
    tile: {borderRadius: 15, padding: 15, flex: 1, minWidth: 140},
    tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8},
});
