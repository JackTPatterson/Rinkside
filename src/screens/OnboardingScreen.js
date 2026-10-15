import React, {useCallback, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowRight} from '../components/icons';
import {FadeInView, Screen, T, tap} from '../components/ui';
import {getTeam} from '../data/teams';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {readableOn, useAppTheme, withAlpha} from '../theme';
import TeamPicker from './settings/TeamPicker';

const BAR_HEIGHT = 56;

function Intro() {
    return (
        <FadeInView style={styles.intro}>
            <T variant="display" accessibilityRole="header">Let’s get started</T>
            <T variant="body" muted style={styles.sub}>Choose your favourite team. You can change it any time in Settings.</T>
        </FadeInView>
    );
}

/** First-launch team picker. App.js swaps to the tabs as soon as a team is saved. */
export default function OnboardingScreen() {
    const {colors, teamColor} = useAppTheme();
    const {setTeam} = useFavoriteTeam();
    const insets = useSafeAreaInsets();
    const [selected, setSelected] = useState(null);

    const onSelect = useCallback((abbrev) => setSelected(abbrev), []);

    const accent = selected ? teamColor(selected) : colors.cardAlt;
    const fg = selected ? readableOn(accent) : colors.textSecondary;
    const team = getTeam(selected);
    const bottom = Math.max(insets.bottom, 12);

    return (
        <Screen>
            <TeamPicker
                selected={selected}
                onSelect={onSelect}
                header={<Intro/>}
                bottomInset={BAR_HEIGHT + bottom + 12}
            />
            <View
                pointerEvents="box-none"
                style={[styles.bar, {paddingBottom: bottom, backgroundColor: withAlpha(colors.background, 0.94)}]}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{disabled: !selected}}
                    accessibilityLabel={team ? `Let's go with the ${team.name}` : 'Choose a team to continue'}
                    disabled={!selected}
                    onPress={() => {
                        tap();
                        setTeam(selected);
                    }}
                    style={({pressed}) => [styles.button, {backgroundColor: accent}, pressed && styles.pressed]}>
                    <T variant="heading" color={fg}>{team ? 'Let’s go' : 'Pick a team'}</T>
                    {team ? <ArrowRight size={20} color={fg}/> : null}
                </Pressable>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    intro: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16},
    sub: {marginTop: 4},
    bar: {position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12},
    button: {
        height: BAR_HEIGHT,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    pressed: {opacity: 0.85, transform: [{scale: 0.98}]},
});
