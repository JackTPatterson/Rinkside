import React, {memo, useState} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {InfoCircle} from '../../components/icons';
import {Sheet, T, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {BioCard} from './PlayerSections';

/** Round header button (info icon) that opens the player's bio — born, height, weight, shoots, draft — in a sheet. */
function BioSheet({rows, name, size = 36}) {
    const {colors} = useAppTheme();
    const [open, setOpen] = useState(false);
    if (!rows?.length) return null;
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Player bio"
                hitSlop={8}
                onPress={() => {
                    tap();
                    setOpen(true);
                }}
                style={({pressed}) => [styles.button, {width: size, height: size, backgroundColor: colors.card}, pressed && styles.pressed]}>
                <InfoCircle size={20} color={colors.text}/>
            </Pressable>
            <Sheet visible={open} onClose={() => setOpen(false)} style={styles.sheet}>
                <T variant="title" numberOfLines={1} style={styles.title}>{name ? `${name} · Bio` : 'Bio'}</T>
                <BioCard rows={rows}/>
            </Sheet>
        </>
    );
}

export default memo(BioSheet);

const styles = StyleSheet.create({
    button: {borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    pressed: {opacity: 0.6},
    sheet: {paddingHorizontal: 20},
    title: {marginBottom: 14},
});
