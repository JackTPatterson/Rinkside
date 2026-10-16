import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowRight2, Code, Heart, Link, Messages2, Shield} from '../components/icons';
import {BackButton, FadeInView, Header, Screen, Section, T, tap} from '../components/ui';
import {GUTTER, useAppTheme} from '../theme';
import {APP_VERSION, DEVELOPER, LINKS, MONEYPUCK_LOGO, emailDeveloper, openLink} from './settings/appInfo';
import {SettingsGroup, SettingsRow} from './settings/SettingsRow';

const NHL_LOGO = require('./settings/nhl-logo.png');

const SOURCES = [
    {
        key: 'nhl',
        name: 'NHL',
        logo: NHL_LOGO,
        logoBg: '#D2D2D2', // the logo artwork ships on this grey; match it so the tile edge is clean
        url: LINKS.nhl,
        host: 'nhl.com',
        body: 'Schedules, live scores, play-by-play, box scores, standings, rosters, player stats, NHL Edge tracking, TV listings, highlight video and team radio come from the NHL’s public web and stats APIs.',
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
    {
        key: 'dailyfaceoff',
        name: 'Daily Faceoff',
        letter: 'DF',
        url: LINKS.dailyfaceoff,
        host: 'dailyfaceoff.com',
        body: 'Projected line combinations and starting-goalie confirmations.',
    },
    {
        key: 'espn',
        name: 'ESPN',
        letter: 'E',
        url: LINKS.espn,
        host: 'espn.com',
        body: 'The injury report.',
    },
];

function SourceCard({source}) {
    const {colors} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => {
                tap();
                openLink(source.url);
            }}
            accessibilityLabel={`${source.name}. Opens ${source.host}`}
            style={({pressed}) => [styles.source, pressed && styles.pressed]}>
            <View style={[styles.logoBox, {backgroundColor: source.logoBg ?? colors.card}]}>
                {source.logo
                    ? <Image source={source.logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors/>
                    : <T variant="heading">{source.letter}</T>}
            </View>
            <View style={styles.sourceText}>
                <T variant="heading">{source.name}</T>
                <T variant="body" muted style={styles.para}>{source.body}</T>
                <View style={styles.linkRow}>
                    <Link size={16} color={colors.accent}/>
                    <T variant="label" color={colors.accent}>{source.host}</T>
                </View>
            </View>
        </Pressable>
    );
}

function Bullet({children}) {
    const {colors} = useAppTheme();
    return (
        <View style={styles.bullet}>
            <View style={[styles.dot, {backgroundColor: colors.positive}]}/>
            <T variant="body" style={[styles.flex, styles.para]}>{children}</T>
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
                    <View style={styles.hero}>
                        <T variant="title">Rinkside</T>
                        <T variant="body" muted style={styles.para}>
                            NHL scores, standings and stats, with models that explain what’s happening: who should
                            win, who deserved to, and which hot streaks are real.
                        </T>
                        {APP_VERSION ? <T variant="caption" muted>Version {APP_VERSION}</T> : null}
                    </View>
                </FadeInView>

                <Section title="Data sources">
                    <T variant="body" muted style={styles.lead}>
                        The data shown in Rinkside is collected and maintained by the sites below. Rinkside doesn’t own
                        any of it and isn’t affiliated with or endorsed by the NHL, its teams, MoneyPuck, Daily Faceoff or ESPN.
                    </T>
                    <View style={styles.stack}>
                        {SOURCES.map((s, i) => (
                            <React.Fragment key={s.key}>
                                {i > 0 ? <View style={[styles.divider, {backgroundColor: colors.text}]}/> : null}
                                <SourceCard source={s}/>
                            </React.Fragment>
                        ))}
                    </View>
                    <T variant="caption" muted style={styles.note}>
                        Win probabilities, Rinkside xG, true-talent estimates and projections are Rinkside’s own models
                        built on this data, not figures published by the NHL or MoneyPuck.
                    </T>
                </Section>

                <Section title="Privacy">
                    <View style={styles.privacy}>
                        <View style={styles.privacyHead}>
                            <Shield size={20} color={colors.positive} variant="Bold"/>
                            <T variant="heading">Your data stays on your phone</T>
                        </View>
                        <Bullet>No accounts or sign-in.</Bullet>
                        <Bullet>No analytics, ads or tracking.</Bullet>
                        <Bullet>Your favourite team and cached stats are stored only on this device. Clear the cache any time in Settings.</Bullet>
                        <Bullet>The app talks directly to the NHL, MoneyPuck, Daily Faceoff and ESPN to fetch public data. Nothing about you is sent.</Bullet>
                        <Pressable
                            accessibilityRole="link"
                            onPress={() => {
                                tap();
                                openLink(LINKS.privacy);
                            }}
                            style={({pressed}) => [styles.linkRow, pressed && styles.pressed]}>
                            <Link size={16} color={colors.accent}/>
                            <T variant="label" color={colors.accent}>Privacy policy</T>
                        </Pressable>
                    </View>
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
    content: {paddingHorizontal: GUTTER},
    para: {lineHeight: 25},
    hero: {gap: 6},
    lead: {marginBottom: 10, lineHeight: 25},
    stack: {},
    divider: {height: 2, opacity: 0.2, marginVertical: 10},
    source: {gap: 10},
    logoBox: {height: 100, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingVertical: 10},
    logo: {width: '70%', height: '100%'},
    sourceText: {gap: 6},
    linkRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2},
    note: {marginTop: 10, fontSize: 13, lineHeight: 18},
    privacy: {gap: 10},
    privacyHead: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2},
    bullet: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
    dot: {width: 6, height: 6, borderRadius: 3, marginTop: 10},
    footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 30, paddingVertical: 10, minHeight: 44},
    pressed: {opacity: 0.6},
});
