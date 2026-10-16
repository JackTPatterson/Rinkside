import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {T, tap} from '../../components/ui';
import {GUTTER, useAppTheme, withAlpha} from '../../theme';
import {addDays, parseISODate, toISODate} from '../../utils/format';

// Weeks reachable by swiping either side of the current one.
export const WEEKS_BACK = 8;
export const WEEKS_FORWARD = 8;
const MONTH_COL = 45;
const DAY_GAP = 5;
const COL_GAP = 9;

const NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfWeek = (d) => addDays(d, -d.getDay());
const keyExtractor = (w) => w.key;

const DayCell = memo(function DayCell({day, selected, onSelect}) {
    const {colors} = useAppTheme();
    const fg = selected ? colors.background : colors.text;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{selected}}
            accessibilityLabel={day.a11y}
            onPress={() => {
                if (selected) return;
                tap();
                onSelect(day.iso);
            }}
            style={({pressed}) => [
                styles.cell,
                selected
                    ? {backgroundColor: colors.text}
                    : {borderWidth: 1, borderColor: day.isToday ? withAlpha(colors.text, 0.55) : colors.border},
                pressed && styles.pressed,
            ]}>
            <T variant="caption" color={fg} style={styles.weekday}>{day.narrow}</T>
            <T variant="body" color={fg} style={styles.dayNumber}>{day.dayNumber}</T>
        </Pressable>
    );
});

/** One week: seven equal day cells (the month column stays put outside the pager). */
const Week = memo(function Week({week, width, selected, onSelect}) {
    return (
        <View style={[styles.days, {width}]}>
            {week.days.map((d) => (
                <DayCell key={d.iso} day={d} selected={d.iso === selected} onSelect={onSelect}/>
            ))}
        </View>
    );
});

/** Month column: year over month, fixed while the weeks scroll beside it. */
function MonthLabel({date}) {
    return (
        <View style={styles.monthCol}>
            <T variant="caption" muted style={styles.year}>{date.getFullYear()}</T>
            <T variant="heading" style={styles.month}>{MONTHS[date.getMonth()]}</T>
        </View>
    );
}

/** Week-paged date picker. Swipe between weeks; tap a day to select it. */
export default function DateStrip({todayISO, selected, onSelect}) {
    const {width: screenW} = useWindowDimensions();
    // The pager is only the day cells; the year/month column sits fixed to its left.
    const width = screenW - GUTTER * 2 - MONTH_COL - COL_GAP;
    const listRef = useRef(null);

    const weeks = useMemo(() => {
        const today = parseISODate(todayISO);
        const first = addDays(startOfWeek(today), -7 * WEEKS_BACK);
        const out = [];
        for (let w = 0; w <= WEEKS_BACK + WEEKS_FORWARD; w++) {
            const start = addDays(first, 7 * w);
            const days = [];
            for (let i = 0; i < 7; i++) {
                const date = addDays(start, i);
                const iso = toISODate(date);
                days.push({iso, date, narrow: NARROW[i], dayNumber: date.getDate(), isToday: iso === todayISO, a11y: date.toDateString()});
            }
            out.push({key: days[0].iso, days});
        }
        return out;
    }, [todayISO]);

    const weekOf = useCallback(
        (iso) => Math.max(0, weeks.findIndex((w) => w.days.some((d) => d.iso === iso))),
        [weeks],
    );
    const [page, setPage] = useState(() => weekOf(selected));

    // Jump to the selected day's week when the selection changes from outside (e.g. the Today button).
    useEffect(() => {
        const target = weekOf(selected);
        if (target !== page) {
            setPage(target);
            listRef.current?.scrollToIndex({index: target, animated: true});
        }
        // Only react to selection changes; `page` follows swipes on its own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, weekOf]);

    const getItemLayout = useCallback((_, index) => ({length: width, offset: width * index, index}), [width]);
    const onMomentumEnd = useCallback((e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width)), [width]);
    // The month column follows the week in view while swiping, not just once it settles.
    const [visible, setVisible] = useState(page);
    useEffect(() => setVisible(page), [page]);
    const onScroll = useCallback((e) => {
        const i = Math.max(0, Math.min(weeks.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
        setVisible((v) => (v === i ? v : i));
    }, [width, weeks.length]);
    // The selected day when it's in view, else the week's middle day (the month most of it is in).
    const shown = weeks[visible];
    const monthDate = shown?.days.find((d) => d.iso === selected)?.date ?? shown?.days[3].date ?? parseISODate(todayISO);
    const renderItem = useCallback(
        ({item}) => <Week week={item} width={width} selected={selected} onSelect={onSelect}/>,
        [width, selected, onSelect],
    );

    return (
        <View style={styles.strip}>
            <MonthLabel date={monthDate}/>
            <FlatList
                ref={listRef}
                horizontal
                pagingEnabled
                data={weeks}
                extraData={selected}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialScrollIndex={page}
                onMomentumScrollEnd={onMomentumEnd}
                onScroll={onScroll}
                scrollEventThrottle={32}
                showsHorizontalScrollIndicator={false}
                onScrollToIndexFailed={() => {}}
                style={[styles.list, {width}]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    strip: {flexDirection: 'row', alignItems: 'center', gap: COL_GAP, paddingHorizontal: GUTTER, paddingBottom: 10},
    list: {flexGrow: 0},
    monthCol: {width: MONTH_COL, gap: 1},
    year: {fontFamily: 'Sora_600SemiBold', fontSize: 12, lineHeight: 14},
    month: {fontFamily: 'Sora_700Bold', fontSize: 21, lineHeight: 25},
    days: {flexDirection: 'row', gap: DAY_GAP},
    cell: {flex: 1, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 3},
    pressed: {opacity: 0.7},
    weekday: {fontFamily: 'Sora_600SemiBold', fontSize: 12, lineHeight: 14},
    dayNumber: {fontFamily: 'Sora_600SemiBold', fontSize: 17, lineHeight: 20, fontVariant: ['tabular-nums']},
});
