import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import {T, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {addDays, dayName, parseISODate, toISODate} from '../../utils/format';

export const DAYS_BACK = 5;
export const DAYS_FORWARD = 7;
const ITEM_WIDTH = 58;
const GAP = 8;
const STRIDE = ITEM_WIDTH + GAP;
const SIDE = 16;

// Each item's length includes the separator after it; offsets include the leading padding.
const getItemLayout = (_, index) => ({length: STRIDE, offset: SIDE + STRIDE * index, index});
const keyExtractor = (d) => d.iso;

const DateChip = memo(function DateChip({item, selected, onSelect}) {
    const {colors} = useAppTheme();
    const fg = selected ? colors.background : colors.text;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{selected}}
            accessibilityLabel={item.a11y}
            onPress={() => {
                if (selected) return;
                tap();
                onSelect(item.iso);
            }}
            style={({pressed}) => [
                styles.chip,
                {backgroundColor: selected ? colors.text : colors.card},
                item.isToday && !selected && {borderColor: colors.text, borderWidth: 1.5},
                pressed && {opacity: 0.7},
            ]}>
            <T variant="caption" color={selected ? fg : undefined} muted={!selected}>
                {item.isToday ? 'Today' : item.day}
            </T>
            <T variant="heading" color={fg}>{item.dayNumber}</T>
        </Pressable>
    );
});

/** Horizontal date picker: DAYS_BACK days before today through DAYS_FORWARD after. */
export default function DateStrip({todayISO, selected, onSelect}) {
    const listRef = useRef(null);
    const dates = useMemo(() => {
        const today = parseISODate(todayISO);
        const out = [];
        for (let i = -DAYS_BACK; i <= DAYS_FORWARD; i++) {
            const d = addDays(today, i);
            out.push({
                iso: toISODate(d),
                day: dayName(d).toUpperCase(),
                dayNumber: d.getDate(),
                isToday: i === 0,
                a11y: d.toDateString(),
            });
        }
        return out;
    }, [todayISO]);

    const selectedIndex = Math.max(0, dates.findIndex((d) => d.iso === selected));
    // Bring the selected chip to (roughly) the middle when it changes.
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        listRef.current?.scrollToIndex({index: selectedIndex, viewPosition: 0.5, animated: true});
    }, [selectedIndex]);

    const renderItem = useCallback(
        ({item}) => <DateChip item={item} selected={item.iso === selected} onSelect={onSelect}/>,
        [selected, onSelect],
    );

    return (
        <View>
            <FlatList
                ref={listRef}
                horizontal
                data={dates}
                extraData={selected}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialScrollIndex={Math.max(0, selectedIndex - 2)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.content}
                ItemSeparatorComponent={Separator}
                onScrollToIndexFailed={() => {}}
            />
        </View>
    );
}

function Separator() {
    return <View style={{width: GAP}}/>;
}

const styles = StyleSheet.create({
    content: {paddingHorizontal: SIDE, paddingBottom: 8},
    chip: {
        width: ITEM_WIDTH,
        height: 64,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
});
