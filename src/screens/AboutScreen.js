import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowRight2, Code, Heart, Link, Messages2, Shield} from '../components/icons';
import {BackButton, Card, FadeInView, Header, Screen, Section, T, tap} from '../components/ui';
import {useAppTheme} from '../theme';
import {APP_VERSION, DEVELOPER, LINKS, MONEYPUCK_LOGO, emailDeveloper, openLink} from './settings/appInfo';
import {SettingsGroup, SettingsRow} from './settings/SettingsRow';

const NHL_LOGO = require('./settings/nhl-logo.png');

const SOURCES = [
    {
        key: 'nhl',
        name: 'NHL',
        logo: NHL_LOGO,
        logoBg: '#D2D2D2', // the logo artwork ships on this grey; match it so the card edge is clean
        url: LINKS.nhl,
        host: 'nhl.com',
        body: 'Schedules, live scores, play-by-play, box scores, standings, rosters and player stats come from the NHL’s public web and stats APIs.',
    },
    {
        key: 'moneypuck',
        name: 'MoneyPuck',
        logo: {uri: MONEYPUCK_LOGO},
        logoBg: '#FFFFFF',
        url: LINKS.moneypuck,
        host: 'moneypuck.com',
        body: 'Game predictions, in-game expected goals, starting goalies, power rankings, playoff odds and goalie stats come from MoneyPuck’s public data files, when they’re available.',
    },
];

function SourceCard({source}) {
    const {colors} = useAppTheme();
    return (
        <Card
            onPress={() => {
                tap();
                openLink(source.url);
            }}
            accessibilityLabel={`${source.name}. Opens ${source.host}`}
            style={styles.source}>
            <View style={[styles.logoBox, {backgroundColor: source.logoBg}]}>
                <Image source={source.logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors/>
            </View>
            <View style={styles.sourceText}>
                <T variant="heading">{source.name}</T>
                <T variant="body" muted>{source.body}</T>
                <View style={styles.linkRow}>
                    <Link size={16} color={colors.accent}/>
                    <T variant="label" color={colors.accent}>{source.host}</T>
                </View>
            </View>
        </Card>
    );
}

function Bullet({children}) {
    const {colors} = useAppTheme();
    return (
        <View style={styles.bullet}>
            <View style={[styles.dot, {backgroundColor: colors.positive}]}/>
            <T variant="body" style={styles.flex}>{children}</T>
        </View>
    );
}

export default function AboutScreen({navigation}) {
    const {colors} = useAppTheme();
    const insets = useSafeAreaInsets();
    return (
        <Screen>
            <Header title="About" subtitle="Data sources, privacy and credits" left={<BackButton onPress={() => navigation.goBack()}/>}/>
            <ScrollView contentContainerStyle={[styles.content, {paddingBottom: 32 + insets.bottom}]} showsVerticalScrollIndicator={false}>
                <FadeInView>
                    <Card style={styles.hero}>
                        <T variant="title">Rinkside</T>
                        <T variant="body" muted>
                            NHL scores, standings and stats, with models that explain what’s happening: who should
                            win, who deserved to, and which hot streaks are real.
                        </T>
                        {APP_VERSION ? <T variant="caption" muted>Version {APP_VERSION}</T> : null}
                    </Card>
                </FadeInView>

                <Section title="Data sources">
                    <T variant="body" muted style={styles.lead}>
                        The data shown in Rinkside is collected and maintained by the sites below. Rinkside doesn’t own
                        any of it and isn’t affiliated with or endorsed by the NHL or MoneyPuck.
                    </T>
                    <View style={styles.stack}>
                        {SOURCES.map((s) => <SourceCard key={s.key} source={s}/>)}
                    </View>
                    <T variant="caption" muted style={styles.note}>
                        Win probabilities, Rinkside xG, true-talent estimates and projections are Rinkside’s own models
                        built on this data, not figures published by the NHL or MoneyPuck.
                    </T>
                </Section>

                <Section title="Privacy">
                    <Card style={styles.privacy}>
                        <View style={styles.privacyHead}>
                            <Shield size={20} color={colors.positive} variant="Bold"/>
                            <T variant="label">Your data stays on your phone</T>
                        </View>
                        <Bullet>No accounts or sign-in.</Bullet>
                        <Bullet>No analytics, ads or tracking.</Bullet>
                        <Bullet>Your favourite team and cached stats are stored only on this device. Clear the cache any time in Settings.</Bullet>
                        <Bullet>The app talks directly to the NHL and MoneyPuck to fetch public data.</Bullet>
                    </Card>
                </Section>

                <Section title="Developer">
                    <SettingsGroup>
                        <SettingsRow first icon={Code} title="Developed by" right={DEVELOPER.name}/>
                        <SettingsRow
                            last
                            icon={Messages2}
                            title="Send feedback"
                            subtitle={DEVELOPER.email}
                            accessibilityHint="Opens your email app"
                            onPress={emailDeveloper}
                        />
                    </SettingsGroup>
                </Section>

                <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Thanks to MoneyPuck for sharing its data. Opens moneypuck.com"
                    hitSlop={8}
                    onPress={() => {
                        tap();
                        openLink(LINKS.moneypuckData);
                    }}
                    style={({pressed}) => [styles.footer, pressed && styles.pressed]}>
                    <Heart size={14} color={colors.live} variant="Bold"/>
                    <T variant="caption" muted>Thanks to MoneyPuck for sharing its data</T>
                    <ArrowRight2 size={12} color={colors.textSecondary}/>
                </Pressable>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    content: {paddingHorizontal: 16},
    hero: {gap: 6, padding: 18},
    lead: {marginBottom: 12},
    stack: {gap: 12},
    source: {gap: 12, padding: 0, overflow: 'hidden'},
    logoBox: {height: 96, alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
    logo: {width: '70%', height: '100%'},
    sourceText: {gap: 6, paddingHorizontal: 14, paddingBottom: 14},
    linkRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2},
    note: {marginTop: 12},
    privacy: {gap: 10},
    privacyHead: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2},
    bullet: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
    dot: {width: 6, height: 6, borderRadius: 3, marginTop: 8},
    footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28, paddingVertical: 12, minHeight: 44},
    pressed: {opacity: 0.6},
});
