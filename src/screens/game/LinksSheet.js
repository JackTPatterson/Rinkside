import React, {memo, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowRight} from '../../components/icons';
import {Sheet, T, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';

/**
 * Round header button that opens a bottom sheet of recap / listen options.
 * links: [{key, icon, label, onPress}]; `icon` is the button's own icon.
 * A chosen link runs only after the sheet has fully closed: opening the in-app browser while the
 * sheet is still dismissing makes iOS drop the browser and leaves the app unresponsive.
 */
function LinksSheet({links, icon: ButtonIcon, title = 'Recaps', size = 36}) {
    const {colors} = useAppTheme();
    const [open, setOpen] = useState(false);
    const pending = useRef(null);
    if (!links.length) return null;

    const runPending = () => {
        const fn = pending.current;
        pending.current = null;
        fn?.();
    };

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={title}
                hitSlop={8}
                onPress={() => {
                    tap();
                    setOpen(true);
                }}
                style={({pressed}) => [styles.button, {width: size, height: size, backgroundColor: colors.card}, pressed && styles.pressed]}>
                <ButtonIcon size={20} color={colors.text}/>
            </Pressable>
            <Sheet visible={open} onClose={() => setOpen(false)} onClosed={runPending} style={styles.sheet}>
                <T variant="title" style={styles.title}>{title}</T>
                {links.map(({key, icon: Icon, label, onPress}) => (
                    <Pressable
                        key={key}
                        accessibilityRole="button"
                        onPress={() => {
                            tap();
                            pending.current = onPress;
                            setOpen(false);
                        }}
                        style={({pressed}) => [styles.row, pressed && styles.pressed]}>
                        <View style={styles.left}>
                            {Icon ? <Icon size={24} color={colors.text}/> : null}
                            <T variant="body" style={styles.label}>{label}</T>
                        </View>
                        <View style={[styles.arrow, {backgroundColor: colors.card}]}>
                            <ArrowRight size={20} color={colors.text}/>
                        </View>
                    </Pressable>
                ))}
            </Sheet>
        </>
    );
}

export default memo(LinksSheet);

const styles = StyleSheet.create({
    button: {borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    pressed: {opacity: 0.6},
    sheet: {paddingHorizontal: 20, gap: 20},
    title: {marginBottom: -4},
    row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44},
    left: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
    label: {fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26},
    arrow: {width: 44, height: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
});
