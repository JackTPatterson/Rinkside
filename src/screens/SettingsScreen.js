import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';
import Animated, {FadeInDown, FadeOut} from 'react-native-reanimated';
import {clearCache} from '../api/client';
import {InfoCircle, Lamp, Refresh, TickCircle, User} from '../components/icons';
import {Header, Screen, T, TeamLogo, tap} from '../components/ui';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {ROUTES} from '../navigation/routes';
import {useAppTheme} from '../theme';
import {APP_VERSION} from './settings/appInfo';
import {SettingsGroup, SettingsRow} from './settings/SettingsRow';

export default function SettingsScreen({navigation}) {
    const {colors} = useAppTheme();
    const {team} = useFavoriteTeam();
    const [cleared, setCleared] = useState(false);
    const [clearing, setClearing] = useState(false);
    const timer = useRef(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            clearTimeout(timer.current);
        };
    }, []);

    const go = useCallback((route) => navigation.navigate(route), [navigation]);

    const confirmClear = useCallback(() => {
        Alert.alert(
            'Clear cached data?',
            'Scores, standings and stats saved for faster loading will be removed and downloaded again as you use the app. Your favourite team is kept.',
            [
                {text: 'Cancel', style: 'cancel'},
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                        setClearing(true);
                        clearCache().finally(() => {
                            if (!mounted.current) return;
                            setClearing(false);
                            setCleared(true);
                            tap();
                            clearTimeout(timer.current);
                            timer.current = setTimeout(() => setCleared(false), 3000);
                        });
                    },
                },
            ],
        );
    }, []);

    return (
        <Screen>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Header title="Settings" style={styles.header}/>

                <SettingsGroup style={styles.rows}>
                    <SettingsRow
                        icon={User}
                        title="Favorite Team"
                        right={team ? <TeamLogo abbrev={team} size={28}/> : null}
                        onPress={() => go(ROUTES.favoriteTeam)}
                    />
                    <SettingsRow
                        icon={Lamp}
                        title="How the Models Work"
                        onPress={() => go(ROUTES.methodology)}
                    />
                    <SettingsRow
                        icon={InfoCircle}
                        title="App / Data Info"
                        onPress={() => go(ROUTES.about)}
                    />
                    <SettingsRow
                        icon={Refresh}
                        title={clearing ? 'Clearing…' : 'Clear Cached Data'}
                        accessibilityHint="Asks for confirmation"
                        chevron={false}
                        onPress={clearing ? () => {} : confirmClear}
                    />
                </SettingsGroup>
                {cleared ? (
                    <Animated.View
                        entering={FadeInDown.duration(200)}
                        exiting={FadeOut.duration(200)}
                        accessibilityLiveRegion="polite"
                        accessibilityRole="alert"
                        style={styles.toast}>
                        <TickCircle size={18} color={colors.text}/>
                        <T variant="body">Cache cleared</T>
                    </Animated.View>
                ) : null}

                <T variant="caption" muted style={styles.footer}>
                    Rinkside{APP_VERSION ? ` v${APP_VERSION}` : ''} · Not affiliated with the NHL
                </T>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: {paddingHorizontal: 20, paddingBottom: 32},
    header: {paddingHorizontal: 0},
    rows: {marginTop: 20},
    toast: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20},
    footer: {marginTop: 40},
});
