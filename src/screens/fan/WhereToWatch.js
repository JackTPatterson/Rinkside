import React, {memo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Tv} from '../../components/icons';
import {Row, Sheet, T, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {watchGroups} from '../../utils/broadcasts';

/**
 * Round header button (TV icon) that opens a "Where to watch" sheet: national channels by country
 * (the viewer's first), then each team's local channels. Renders nothing when the feed lists none.
 */
function WhereToWatch({broadcasts, home, away, size = 36}) {
    const {colors} = useAppTheme();
    const [open, setOpen] = useState(false);
    const groups = watchGroups(broadcasts, {home, away});
    if (!groups.length) return null;
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Where to watch"
                hitSlop={8}
                onPress={() => {
                    tap();
                    setOpen(true);
                }}
                style={({pressed}) => [styles.button, {width: size, height: size, backgroundColor: colors.card}, pressed && styles.pressed]}>
                <Tv size={20} color={colors.text}/>
            </Pressable>
            <Sheet visible={open} onClose={() => setOpen(false)} style={styles.sheet}>
                <T variant="title">Where to watch</T>
                <View style={styles.list}>
                    {groups.map((g) => (
                        <Row key={g.key} gap={12}>
                            <View style={[styles.icon, {backgroundColor: colors.card}]}>
                                <Tv size={20} color={colors.text}/>
                            </View>
                            <View style={styles.flex}>
                                <T variant="caption" muted>{g.title}</T>
                                <T variant="body" style={styles.networks}>{g.networks.join(' · ')}</T>
                            </View>
                        </Row>
                    ))}
                </View>
            </Sheet>
        </>
    );
}

export default memo(WhereToWatch);

const styles = StyleSheet.create({
    flex: {flex: 1},
    pressed: {opacity: 0.6},
    button: {borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    sheet: {paddingHorizontal: 20},
    list: {gap: 16, marginTop: 20, marginBottom: 14},
    icon: {width: 44, height: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    networks: {fontFamily: 'Sora_600SemiBold', fontSize: 18, lineHeight: 24},
});
