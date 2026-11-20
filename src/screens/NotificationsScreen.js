import React from 'react';
import {ScrollView, StyleSheet, Switch} from 'react-native';
import {BackButton, Header, Screen, T, tap} from '../components/ui';
import {Lamp, Calendar, Chart, Medal} from '../components/icons';
import {getTeam} from '../data/teams';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {ROUTES} from '../navigation/routes';
import {GUTTER, useAppTheme} from '../theme';
import {tradeRadarConfigured} from '../api/trades';
import {useTradeAlerts} from '../trades/TradeAlerts';
import {SettingsGroup, SettingsRow} from './settings/SettingsRow';

export default function NotificationsScreen({navigation}) {
    const {colors} = useAppTheme();
    const {team} = useFavoriteTeam();
    const {prefs, ready, busy, error, save} = useTradeAlerts();
    const name = getTeam(team)?.name ?? 'your team';
    const locked = !ready || busy || !tradeRadarConfigured || !team;
    const toggle = (key) => (on) => { tap(); save({topics: {[key]: on}}); };
    const row = (key, icon, title, subtitle) => (
        <SettingsRow
            icon={icon}
            title={title}
            subtitle={subtitle}
            right={<Switch value={prefs.topics[key]} disabled={locked} onValueChange={toggle(key)} trackColor={{true: colors.accent}} accessibilityLabel={title}/>}
        />
    );
    const trades = prefs.topics.trades ? `${prefs.team ? prefs.team : 'All teams'} · ${prefs.minimum}${prefs.minimum === 'Confirmed' ? ' only' : ' and above'}` : 'Off';
    return (
        <Screen>
            <Header title="Notifications" subtitle={name} left={<BackButton onPress={() => navigation.goBack()}/>}/>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup style={styles.rows}>
                    {row('pregame', Calendar, 'Game day preview', 'The playoff picture, starting goalies and milestones, 90 minutes before puck drop.')}
                    {row('milestones', Medal, 'Milestones', `When a player on ${name} reaches a career milestone.`)}
                    {row('standings', Chart, 'Playoff position', `When ${name} drop out of, or back into, a playoff spot.`)}
                    <SettingsRow icon={Lamp} title="Trade alerts" right={trades} onPress={() => navigation.navigate(ROUTES.trades)}/>
                </SettingsGroup>
                {!tradeRadarConfigured ? <T variant="caption" muted style={styles.note}>Notifications are not connected in this build.</T> : null}
                {error ? <T variant="caption" accessibilityRole="alert" style={styles.note}>{error}</T> : null}
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: {paddingHorizontal: GUTTER, paddingBottom: 32},
    rows: {marginTop: 20},
    note: {marginTop: 20},
});
