import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';
import Animated, {FadeInDown, FadeOut} from 'react-native-reanimated';
import {clearCache} from '../api/client';
import {Code, Global, InfoCircle, Lamp, Refresh, Shield, TickCircle} from '../components/icons';
import {Card, Header, Screen, Section, T, TeamLogo, tap} from '../components/ui';
import {getTeam} from '../data/teams';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {ROUTES} from '../navigation/routes';
import {readableOn, useAppTheme, withAlpha} from '../theme';
import {APP_VERSION, DEVELOPER, LINKS, openLink} from './settings/appInfo';
import {SettingsGroup, SettingsRow} from './settings/SettingsRow';

function TeamCard({abbrev, onPress}) {
    const {teamColor} = useAppTheme();
    const team = getTeam(abbrev);
    const accent = teamColor(abbrev);
    return (
        <Card
            onPress={() => {
                tap();
                onPress();
            }}
            accessibilityLabel={`Favourite team: ${team?.name ?? 'none'}. Change`}
            style={[styles.teamCard, {backgroundColor: withAlpha(accent, 0.12), borderColor: withAlpha(accent, 0.5)}]}>
            <TeamLogo abbrev={abbrev} size={44}/>
            <View style={styles.flex}>
                <T variant="caption" muted>Favourite team</T>
                <T variant="heading" numberOfLines={1}>{team?.name ?? 'Choose a team'}</T>
                {team?.division ? <T variant="caption" muted>{team.division} Division</T> : null}
            </View>
            <View style={[styles.changePill, {backgroundColor: accent}]}>
                <T variant="label" color={readableOn(accent)}>Change</T>
            </View>
        </Card>
    );
}

export default function SettingsScreen({navigation}) {
    const {colors} = useAppTheme();
    const {team} = useFavoriteTeam();
    const [cleared, setCleared] = useState(false);
    const [clearing, setClearing] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

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

                <TeamCard abbrev={team} onPress={() => go(ROUTES.favoriteTeam)}/>

                <Section title="Learn">
                    <SettingsGroup>
                        <SettingsRow
                            first
                            icon={Lamp}
                            iconColor={colors.warning}
                            title="How the models work"
                            subtitle="Win probability, xG, true talent and projections, explained"
                            onPress={() => go(ROUTES.methodology)}
                        />
                        <SettingsRow
                            last
                            icon={InfoCircle}
                            iconColor={colors.accent}
                            title="About & data sources"
                            subtitle="NHL, MoneyPuck, privacy and credits"
                            onPress={() => go(ROUTES.about)}
                        />
                    </SettingsGroup>
                </Section>

                <Section title="Data">
                    <SettingsGroup>
                        <SettingsRow
                            first
                            last
                            icon={Refresh}
                            title={clearing ? 'Clearing…' : 'Clear cached data'}
                            subtitle="Frees space and forces fresh downloads"
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
                            style={[styles.toast, {backgroundColor: withAlpha(colors.positive, 0.12)}]}>
                            <TickCircle size={18} color={colors.positive} variant="Bold"/>
                            <T variant="label" color={colors.positive}>Cache cleared</T>
                        </Animated.View>
                    ) : null}
                </Section>

                <Section title="Credits">
                    <SettingsGroup>
                        <SettingsRow
                            first
                            icon={Global}
                            title="NHL"
                            subtitle="Scores, schedules, play-by-play, standings, stats"
                            right="nhl.com"
                            chevron={false}
                            onPress={() => openLink(LINKS.nhl)}
                        />
                        <SettingsRow
                            icon={Global}
                            title="MoneyPuck"
                            subtitle="Advanced stats and expected goals"
                            right="moneypuck.com"
                            chevron={false}
                            onPress={() => openLink(LINKS.moneypuck)}
                        />
                        <SettingsRow
                            last
                            icon={Code}
                            title="Developed by"
                            right={DEVELOPER.name}
                        />
                    </SettingsGroup>
                </Section>

                <View style={styles.footer}>
                    <Shield size={16} color={colors.textSecondary}/>
                    <T variant="caption" muted style={styles.footerText}>
                        No accounts, no tracking. Your favourite team is stored only on this device.
                    </T>
                    <T variant="caption" muted>
                        Rinkside{APP_VERSION ? ` v${APP_VERSION}` : ''} · Not affiliated with the NHL
                    </T>
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    content: {paddingHorizontal: 16, paddingBottom: 32},
    header: {paddingHorizontal: 0},
    teamCard: {flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, padding: 16},
    changePill: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999},
    toast: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12},
    footer: {alignItems: 'center', gap: 6, marginTop: 32},
    footerText: {textAlign: 'center', maxWidth: 300},
});
