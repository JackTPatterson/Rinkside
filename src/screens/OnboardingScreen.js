import React, {useCallback, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowRight} from '../components/icons';
import {FadeInView, Screen, T, tap} from '../components/ui';
import {getTeam} from '../data/teams';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {GUTTER, useAppTheme, withAlpha} from '../theme';
import TeamPicker from './settings/TeamPicker';

const BAR_HEIGHT = 56; // 15pt vertical padding around 20pt text

function Intro() {
    return (
        <FadeInView style={styles.intro}>
            <T variant="display" accessibilityRole="header" style={styles.title}>Let’s get started</T>
            <T variant="body" style={styles.sub}>Choose your favourite team. You can change it any time in Settings.</T>
        </FadeInView>
    );
}

/** First-launch team picker. App.js swaps to the tabs as soon as a team is saved. */
export default function OnboardingScreen() {
    const {colors} = useAppTheme();
    const {setTeam} = useFavoriteTeam();
    const insets = useSafeAreaInsets();
    const [selected, setSelected] = useState(null);

    const onSelect = useCallback((abbrev) => setSelected(abbrev), []);

    // Original "Lets Go" pill: colors.text fill with background-coloured text once a team is picked.
    const fill = selected ? colors.text : colors.card;
    const fg = selected ? colors.background : colors.textSecondary;
    const team = getTeam(selected);
    const bottom = Math.max(insets.bottom, 10);

    return (
        <Screen>
            <TeamPicker
                selected={selected}
                onSelect={onSelect}
                showCurrent={false}
                header={<Intro/>}
                bottomInset={BAR_HEIGHT + bottom + 10}
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
                    style={({pressed}) => [styles.button, {backgroundColor: fill}, pressed && styles.pressed]}>
                    <T variant="heading" color={fg} style={selected ? styles.goText : styles.idleText}>{team ? 'Let’s go' : 'Pick a team'}</T>
                    {team ? <ArrowRight size={24} color={fg}/> : null}
                </Pressable>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    // The original onboarding used a wider 20pt margin; this lines the text up with the team logos.
    intro: {paddingHorizontal: GUTTER * 2, paddingTop: 10, paddingBottom: 20},
    title: {fontFamily: 'Sora_600SemiBold'},
    sub: {marginTop: 5},
    bar: {position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 10},
    button: {
        height: BAR_HEIGHT,
        borderRadius: 100,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    goText: {fontSize: 20, lineHeight: 26},
    idleText: {fontFamily: 'Sora_500Medium', fontSize: 16},
    pressed: {opacity: 0.85},
});
