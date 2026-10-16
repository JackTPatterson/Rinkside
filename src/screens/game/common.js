import {useNavigation} from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import React, {memo, useCallback} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {ArrowDown2} from '../../components/icons';
import {Badge, Headshot, InfoTip, Row, Sheet, T, TeamLogo, tap} from '../../components/ui';
import {readableOn, useAppTheme, withAlpha} from '../../theme';
import {pct} from '../../utils/format';
import {videoIdOf} from '../../api/brightcove';
import {ROUTES} from '../../navigation/routes';

/** Opens a URL in the in-app browser (never throws). */
export function openLink(url) {
    if (!url) return;
    tap();
    WebBrowser.openBrowserAsync(url).catch(() => {});
}

/**
 * Returns open(video, {title, webUrl}): plays an NHL video (Brightcove id, or an nhl.com video URL that
 * ends in one) in the in-app player; anything else falls back to the in-app browser.
 */
export function useOpenVideo() {
    const navigation = useNavigation();
    return useCallback((video, {title, webUrl} = {}) => {
        const videoId = videoIdOf(video);
        const page = webUrl ?? (typeof video === 'string' && video.startsWith('http') ? video : null);
        if (!videoId) return openLink(page);
        tap();
        navigation.navigate(ROUTES.video, {videoId, title, webUrl: page});
    }, [navigation]);
}

/** Typography used by the original game page. */
export const type = StyleSheet.create({
    // Big stat number (old app: SemiBold 24).
    big: {fontFamily: 'Sora_600SemiBold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums']},
    // Row values either side of a stat label (old app: Medium 16).
    value: {fontFamily: 'Sora_500Medium', fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums']},
    // Names under headshots.
    name: {fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 22},
    // Secondary lines under names (old app: SemiBold 14 at 50% opacity).
    sub: {fontFamily: 'Sora_600SemiBold', fontSize: 14, lineHeight: 19, opacity: 0.5},
    // Small label.
    small: {fontFamily: 'Sora_500Medium', fontSize: 14, lineHeight: 19},
    // Pie-chart side values (old app: Medium 20).
    pie: {fontFamily: 'Sora_500Medium', fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums']},
});

/** Rounded pill button with an icon, used for recap / radio / clip links (old "Clip" / "Video Recap" pill). */
export const LinkPill = memo(function LinkPill({icon: Icon, label, onPress, color, onCard, small}) {
    const {colors} = useAppTheme();
    const bg = color ?? (onCard ? colors.background : colors.card);
    const fg = color ? readableOn(color) : colors.text;
    return (
        <Pressable
            accessibilityRole="link"
            onPress={onPress}
            hitSlop={small ? 8 : undefined}
            style={({pressed}) => [styles.pill, small && styles.pillSmall, {backgroundColor: bg}, pressed && {opacity: 0.6}]}>
            {Icon ? <Icon size={small ? 14 : 20} color={fg}/> : null}
            <T variant={small ? 'caption' : 'body'} color={fg}>{label}</T>
        </Pressable>
    );
});

/** "HOM  label  AWY" heading with logos, used above head-to-head comparisons. */
export const MatchupHeading = memo(function MatchupHeading({home, away, label}) {
    return (
        <Row style={styles.matchup}>
            <Row gap={6}>
                <TeamLogo abbrev={home} size={26}/>
                <T variant="body" style={type.name}>{home}</T>
            </Row>
            {label ? <T variant="body" muted style={type.small}>{label}</T> : null}
            <Row gap={6}>
                <T variant="body" style={type.name}>{away}</T>
                <TeamLogo abbrev={away} size={26}/>
            </Row>
        </Row>
    );
});

/** Headshot + name tile that opens the player page (old style: 80pt headshot, 3pt team ring). */
/**
 * Headshot tile. `status` = {label, color} renders a tinted status pill under the name; the name
 * keeps a two-line height then so pills in neighbouring tiles line up.
 */
/** "Connor McDavid" → ["Connor", "McDavid"]; "Jean-Gabriel Pageau" keeps the rest together. */
const splitFullName = (name) => {
    const s = String(name || 'Unknown').trim();
    const i = s.indexOf(' ');
    return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
};

export const PlayerTile = memo(function PlayerTile({playerId, name, headshot, team, caption, status, onPress, size = 80, splitName = false}) {
    const {teamColor} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={name}
            disabled={!onPress}
            onPress={() => onPress?.(playerId)}
            style={({pressed}) => [styles.tile, pressed && {opacity: 0.6}]}>
            <Headshot uri={headshot} size={size} borderColor={team ? teamColor(team) : undefined} style={team ? styles.ring : null}/>
            {splitName ? (
                // First name over last name, always two lines, so a row of tiles lines up.
                <View style={styles.split}>
                    {splitFullName(name).map((part, i) => (
                        <T key={i} variant="body" numberOfLines={1} adjustsFontSizeToFit style={[type.name, styles.center]}>{part || ' '}</T>
                    ))}
                </View>
            ) : (
                <T variant="body" numberOfLines={2} style={[type.name, styles.center, status && styles.twoLines]}>{name || 'Unknown'}</T>
            )}
            {status ? (
                <View style={[styles.status, {backgroundColor: withAlpha(status.color, 0.16)}]}>
                    <T variant="label" color={status.color} numberOfLines={1}>{status.label}</T>
                </View>
            ) : null}
            {caption ? <T variant="body" numberOfLines={1} style={[type.sub, styles.center]}>{caption}</T> : null}
        </Pressable>
    );
});

/** Big two-sided probability readout: "54%  label  46%". */
export function ProbRow({left, right, leftColor, rightColor, label}) {
    return (
        <Row style={{justifyContent: 'space-between'}}>
            <T variant="body" color={leftColor} style={type.big}>{pct(left)}</T>
            {label ? <T variant="body" muted style={type.small}>{label}</T> : null}
            <T variant="body" color={rightColor} style={type.big}>{pct(right)}</T>
        </Row>
    );
}

/** Old app divider: 2pt, text colour at 20%. */
export function Divider({style}) {
    const {colors} = useAppTheme();
    return <View style={[styles.divider, {backgroundColor: colors.text}, style]}/>;
}

/** Old centred section heading (Medium 16), e.g. "Starting Goalies", "Goalie Stats". */
export function SectionTitle({title, info, style}) {
    return (
        <Row gap={4} style={[styles.sectionTitle, style]}>
            <T variant="body" style={[type.value, styles.center]}>{title}</T>
            {info ? <InfoTip title={title} body={info} size={14}/> : null}
        </Row>
    );
}

/** Old pregame row: "value   label   value" in SemiBold 16, three equal columns, no bars. */
export function TriRow({left, label, right, info, style}) {
    return (
        <View style={[styles.triRow, style]}>
            <T variant="body" numberOfLines={1} style={[type.name, styles.third]}>{left}</T>
            <Row gap={4} style={[styles.third, {justifyContent: 'center'}]}>
                <T variant="body" numberOfLines={2} style={[type.name, styles.center, {flexShrink: 1}]}>{label}</T>
                {info ? <InfoTip title={label} body={info} size={14}/> : null}
            </Row>
            <T variant="body" numberOfLines={1} style={[type.name, styles.third, {textAlign: 'right'}]}>{right}</T>
        </View>
    );
}

/**
 * Old chart-header style row: title on the left (Medium 16), value on the right (SemiBold 24),
 * optional dimmed line under the title.
 */
export function ValueRow({title, value, sub, info, color, style, children}) {
    const row = (
        <View style={[styles.valueRow, children ? null : style]}>
            <View style={{flex: 1}}>
                <Row gap={4}>
                    <T variant="body" style={[type.value, {flexShrink: 1}]}>{title}</T>
                    {info ? <InfoTip title={title} body={info} size={14}/> : null}
                </Row>
                {sub ? (typeof sub === 'string' ? <T variant="body" style={[type.sub, {marginTop: 4}]}>{sub}</T> : <View style={{marginTop: 4}}>{sub}</View>) : null}
            </View>
            {typeof value === 'string' || typeof value === 'number'
                ? <T variant="body" color={color} style={type.big}>{value}</T>
                : value}
        </View>
    );
    if (!children) return row;
    return (
        <View style={style}>
            {row}
            <View style={{marginTop: 12}}>{children}</View>
        </View>
    );
}

/** Old "Event ▾" / "Select Stat ▾" card row that opens a picker sheet. */
export function SelectRow({label, value, onPress}) {
    const {colors} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => {
                tap();
                onPress();
            }}
            style={({pressed}) => [styles.selectRow, {backgroundColor: colors.card}, pressed && {opacity: 0.7}]}>
            <T variant="body" style={type.value}>{label}</T>
            <Row gap={4}>
                <T variant="body" style={[type.value, {opacity: 0.5}]}>{value}</T>
                <View style={{opacity: 0.7}}><ArrowDown2 size={16} color={colors.text}/></View>
            </Row>
        </Pressable>
    );
}

/** Old "Select A Stat" bottom sheet: SemiBold 24 title, SemiBold 20 options. */
export function OptionSheet({visible, title = 'Select A Stat', options, onSelect, onClose}) {
    return (
        <Sheet visible={visible} onClose={onClose} style={styles.sheet}>
            <T variant="title" style={{marginBottom: 20}}>{title}</T>
            {options.map((o) => (
                <Pressable
                    key={o.key}
                    accessibilityRole="button"
                    onPress={() => {
                        tap();
                        onSelect(o.key);
                        onClose();
                    }}
                    style={({pressed}) => [styles.option, pressed && {opacity: 0.6}]}>
                    <T variant="body" style={styles.optionText}>{o.label}</T>
                </Pressable>
            ))}
        </Sheet>
    );
}

/** Half bar that fills outward from the centre (old mirrored Progress.Bar pair). */
// Each half grows outward from the centre. The centre (inner) end is flat and the outer end rounded;
// a fill at 100% reaches the outer end of its track, so it is rounded at the outer side only, like the track.
function HalfBar({share, color, track, reverse}) {
    const v = Math.max(0, Math.min(1, share || 0));
    // reverse = left half: inner end is on the right.
    const outer = reverse
        ? {borderTopLeftRadius: 3, borderBottomLeftRadius: 3}
        : {borderTopRightRadius: 3, borderBottomRightRadius: 3};
    return (
        <View style={[styles.halfTrack, outer, {backgroundColor: track, alignItems: reverse ? 'flex-end' : 'flex-start'}]}>
            <View style={[{width: `${v * 100}%`, height: '100%', backgroundColor: color}, v >= 1 ? outer : null]}/>
        </View>
    );
}

/** The old pair of 6pt bars under a stat row, each filled to its own share (0–1). */
export function HalfBars({left, right, leftColor, rightColor, style}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.bars, style]}>
            <HalfBar share={left} color={leftColor ?? colors.text} track={colors.card} reverse/>
            <HalfBar share={right} color={rightColor ?? colors.textSecondary} track={colors.card}/>
        </View>
    );
}

/**
 * Head-to-head stat row in the original layout: "home  label  away" (Medium 16) with two bars
 * growing out from the middle. `pill` puts the label in the old card pill (SOG, power play, odds);
 * otherwise the label is plain text like the old PIM / Hits / Blocked Shots rows.
 * `shares` overrides the bar fills (e.g. probabilities that are already 0–1).
 */
export function StatRow({label, left, right, leftColor, rightColor, format = (v) => v, info, shares, style}) {
    const l = Number(left) || 0;
    const r = Number(right) || 0;
    const total = Math.abs(l) + Math.abs(r);
    const lShare = shares ? shares[0] : total > 0 ? Math.abs(l) / total : 0;
    const rShare = shares ? shares[1] : total > 0 ? Math.abs(r) / total : 0;
    return (
        <View style={[styles.statRow, style]}>
            <View style={styles.statHead}>
                <T variant="body" numberOfLines={1} style={[type.value, styles.statVal]}>{format(left)}</T>
                {/* Every stat label is plain text (the old app pilled a few headline rows, which read as inconsistent). */}
                <Row gap={4} style={{flexShrink: 1}}>
                    <T variant="body" numberOfLines={1} style={[type.value, {flexShrink: 1}]}>{label}</T>
                    {info ? <InfoTip title={label} body={info} size={14}/> : null}
                </Row>
                <T variant="body" numberOfLines={1} style={[type.value, styles.statVal, {textAlign: 'right'}]}>{format(right)}</T>
            </View>
            <HalfBars left={lShare} right={rShare} leftColor={leftColor} rightColor={rightColor}/>
        </View>
    );
}

/** Donut split (the old faceoff / offensive-zone pie charts): Medium 16 title, "54%  (ring)  46%" in Medium 20. */
export function PieRow({label, left, leftColor, rightColor, info, size = 110, style}) {
    const {colors} = useAppTheme();
    const l = Math.max(0, Math.min(1, Number(left) || 0));
    const stroke = size * 0.1;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const gap = 4; // px of background at each seam
    return (
        <View style={[styles.pieRow, style]}>
            <Row gap={4} style={{justifyContent: 'center'}}>
                <T variant="body" style={type.value}>{label}</T>
                {info ? <InfoTip title={label} body={info} size={14}/> : null}
            </Row>
            <Row gap={40} style={{justifyContent: 'center', marginTop: 10}}>
                <T variant="body" style={[type.pie, styles.pieVal, {textAlign: 'right'}]}>{pct(l)}</T>
                {/* Rotated so each arc is centred on its team's side: left team at 9 o'clock, right team at 3. */}
                <Svg width={size} height={size} style={{transform: [{rotate: `${180 - 180 * l}deg`}]}}>
                    {/* Two arcs with a small gap at each seam so similar team colours stay separate. */}
                    {l < 1 ? (
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            stroke={rightColor ?? colors.card}
                            strokeWidth={stroke}
                            strokeDasharray={`${Math.max(0, c * (1 - l) - gap)} ${c}`}
                            strokeDashoffset={-(c * l + gap / 2)}
                            fill="none"
                        />
                    ) : null}
                    {l > 0 ? (
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            stroke={leftColor ?? colors.text}
                            strokeWidth={stroke}
                            strokeDasharray={`${Math.max(0, c * l - (l < 1 ? gap : 0))} ${c}`}
                            strokeDashoffset={l < 1 ? -gap / 2 : 0}
                            fill="none"
                        />
                    ) : null}
                </Svg>
                <T variant="body" style={[type.pie, styles.pieVal]}>{pct(1 - l)}</T>
            </Row>
        </View>
    );
}

/** Big number tile on a card (replaces the shared StatTile so numbers use the old SemiBold 24). */
export function Tile({label, value, sub, color, info, style}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.statTile, {backgroundColor: colors.card}, style]}>
            <Row gap={4} style={{marginBottom: 4}}>
                <T variant="body" muted numberOfLines={1} style={[type.small, {flexShrink: 1}]}>{label}</T>
                {info ? <InfoTip title={label} body={info} size={14}/> : null}
            </Row>
            <T variant="body" color={color} numberOfLines={1} adjustsFontSizeToFit style={type.big}>{value}</T>
            {sub ? <T variant="caption" muted numberOfLines={2}>{sub}</T> : null}
        </View>
    );
}

/**
 * Plain table in the old player/penalty style: dimmed SemiBold 14 headers, Medium 16 rows, no rules.
 * Same props as the shared DataTable.
 */
export function PlainTable({columns, rows, keyExtractor = (r, i) => String(i), onRowPress, style, highlight}) {
    const {colors} = useAppTheme();
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
            <View>
                <View style={styles.tr}>
                    {columns.map((c) => (
                        <T key={c.key} variant="body" numberOfLines={1} style={[type.sub, {width: c.width, textAlign: c.align ?? 'left'}]}>
                            {c.title}
                        </T>
                    ))}
                </View>
                {rows.map((r, i) => {
                    const content = columns.map((c) => {
                        const v = c.render ? c.render(r, i) : r[c.key];
                        return typeof v === 'string' || typeof v === 'number' ? (
                            <T key={c.key} variant="body" numberOfLines={1} style={{width: c.width, textAlign: c.align ?? 'left'}}>{v}</T>
                        ) : (
                            <View key={c.key} style={{width: c.width, alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start'}}>{v}</View>
                        );
                    });
                    const rowStyle = [styles.tr, highlight?.(r) && {backgroundColor: colors.card, borderRadius: 15}];
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

/**
 * A titled block of stat rows, separated from the previous block by a divider. Renders nothing when
 * none of its rows have data. `first` skips the divider (nothing above it).
 */
export function Group({title, info, first, children}) {
    // The first row sits right under the title (rows carry their own top margin for spacing between them).
    const rows = React.Children.toArray(children).filter(Boolean)
        .map((r, i) => (i === 0 ? React.cloneElement(r, {style: [r.props.style, {marginTop: 0}]}) : r));
    if (!rows.length) return null;
    return (
        <View>
            {first ? null : <Divider style={{marginTop: 20}}/>}
            <SectionTitle title={title} info={info}/>
            {rows}
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, minHeight: 44},
    pillSmall: {gap: 4, paddingHorizontal: 10, paddingVertical: 1, minHeight: 0}, // about one text line tall, so it can sit inline
    matchup: {justifyContent: 'space-between', marginBottom: 15},
    tile: {width: 110, alignItems: 'center', gap: 4},
    twoLines: {minHeight: 40, textAlignVertical: 'center'},
    split: {alignSelf: 'stretch'},
    status: {borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4},
    ring: {borderWidth: 3},
    center: {textAlign: 'center'},
    divider: {height: 2, marginVertical: 10, opacity: 0.2, width: '100%'},
    badge: {borderRadius: 15, paddingHorizontal: 10, paddingVertical: 3},
    sectionTitle: {justifyContent: 'center', marginTop: 20, marginBottom: 10},
    triRow: {flexDirection: 'row', alignItems: 'center', marginTop: 20},
    third: {width: '33.3%'},
    valueRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, gap: 10},
    selectRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, borderRadius: 15, marginBottom: 4},
    sheet: {paddingHorizontal: 20},
    option: {paddingVertical: 10, minHeight: 44, justifyContent: 'center'},
    optionText: {fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26},
    statRow: {marginTop: 20},
    statHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6},
    statVal: {width: 60},
    bars: {flexDirection: 'row', gap: 3, marginTop: 20},
    halfTrack: {flex: 1, height: 6, overflow: 'hidden'},
    pieRow: {marginTop: 20},
    pieVal: {width: 70},
    statTile: {borderRadius: 15, paddingVertical: 15, paddingHorizontal: 15, flex: 1, minWidth: 140},
    tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8},
});
