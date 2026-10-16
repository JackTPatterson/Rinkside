import React, {memo, useCallback} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Close} from '../../components/icons';
import {Sheet, T} from '../../components/ui';
import {GUTTER, useAppTheme} from '../../theme';
import TeamGrid from '../settings/TeamPicker';

/** "Your team" / "Switch team" sheet: the shared team grid in a tall bottom sheet (drag the grabber or tap outside to dismiss). */
function TeamPicker({visible, current, onSelect, onClose, title = 'Select a team', currentLabel = 'Current'}) {
    const {colors} = useAppTheme();
    const insets = useSafeAreaInsets();
    const select = useCallback((abbrev) => {
        onSelect(abbrev);
        onClose();
    }, [onSelect, onClose]);
    return (
        <Sheet visible={visible} onClose={onClose} height={0.9} style={styles.body}>
            <View style={styles.header}>
                <T variant="title" style={styles.flex}>{title}</T>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose} style={({pressed}) => pressed && styles.pressed}>
                    <Close size={28} color={colors.textSecondary}/>
                </Pressable>
            </View>
            <TeamGrid selected={current} onSelect={select} currentLabel={currentLabel} bottomInset={insets.bottom}/>
        </Sheet>
    );
}

export default memo(TeamPicker);

const styles = StyleSheet.create({
    flex: {flex: 1},
    body: {paddingBottom: 0},
    pressed: {opacity: 0.6},
    header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER + 5, paddingBottom: 6},
});
