import React, {memo, useState} from 'react';
import {FlatList, Pressable, StyleSheet} from 'react-native';
import {ArrowDown2, TickCircle} from '../../components/icons';
import {Sheet, T, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {seasonLabel} from '../../utils/season';

/** Pill that shows the selected season and opens a sheet listing `seasons` (season ids, newest first). */
function SeasonPicker({seasons, value, onChange}) {
    const {colors} = useAppTheme();
    const [open, setOpen] = useState(false);

    const pick = (id) => {
        tap();
        setOpen(false);
        if (id !== value) onChange(id);
    };

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Season ${seasonLabel(value)}. Change season`}
                hitSlop={6}
                onPress={() => {
                    tap();
                    setOpen(true);
                }}
                style={({pressed}) => [styles.pill, {backgroundColor: colors.card}, pressed && styles.pressed]}>
                <T variant="body" style={styles.semi}>{seasonLabel(value)}</T>
                <ArrowDown2 size={18} color={colors.text}/>
            </Pressable>
            <Sheet visible={open} onClose={() => setOpen(false)} style={styles.sheet}>
                <T variant="title" style={styles.title}>Season</T>
                <FlatList
                    data={seasons}
                    keyExtractor={(id) => id}
                    renderItem={({item: id}) => {
                        const active = id === value;
                        return (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{selected: active}}
                                onPress={() => pick(id)}
                                style={({pressed}) => [styles.row, active && {backgroundColor: colors.card}, pressed && styles.pressed]}>
                                <T variant="body" style={active ? styles.semi : null}>{seasonLabel(id)}</T>
                                {active ? <TickCircle size={22} color={colors.text} variant="Bold"/> : null}
                            </Pressable>
                        );
                    }}
                />
            </Sheet>
        </>
    );
}

export default memo(SeasonPicker);

const styles = StyleSheet.create({
    pill: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, minHeight: 44, borderRadius: 100},
    semi: {fontFamily: 'Sora_600SemiBold'},
    pressed: {opacity: 0.6},
    sheet: {paddingHorizontal: 10},
    title: {marginBottom: 10, paddingHorizontal: 10},
    row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 15, borderRadius: 15, marginBottom: 4},
});
