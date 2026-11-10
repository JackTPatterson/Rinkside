import React, {useMemo, useState} from 'react';
import {Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Switch, View} from 'react-native';
import {fetchTrades, tradeRadarConfigured} from '../api/trades';
import {BackButton, Card, EmptyState, Header, PillTabs, Screen, T} from '../components/ui';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import {useQuery} from '../hooks/useQuery';
import {useAppTheme} from '../theme';
import {useTradeAlerts} from '../trades/TradeAlerts';

const LEVELS = ['Low', 'Medium', 'High', 'Confirmed'];
const thresholds = LEVELS.map(key => ({key, label: key}));
async function openSource(url) {
    try { if (!url.startsWith('https://')) throw new Error(); await Linking.openURL(url); }
    catch { Alert.alert('Could not open source', 'Please try again later.'); }
}
export function Story({story, highlighted}) {
    const {colors} = useAppTheme();
    return (
        <Card style={[styles.story, highlighted && {borderWidth: 2, borderColor: colors.text}]}>
            <View style={styles.row}>
                <T variant="label">{story.disputed ? 'Disputed' : story.confidence === 'Confirmed' ? 'Confirmed' : `${story.confidence} confidence`}</T>
                <T variant="caption" muted>{story.teams.join(' · ') || 'Around the league'}</T>
            </View>
            <T variant="heading">{story.title}</T>
            <T variant="caption" muted>{new Date(story.updatedAt).toLocaleString()}{story.stale ? ' · Older report' : ''}</T>
            <T variant="body" muted>{story.reason}</T>
            <View style={[styles.sources, {borderTopColor: colors.border}]}>
                {story.reports.map(report => (
                    <Pressable key={report.id} accessibilityRole="link" accessibilityLabel={`Read ${report.sourceName}: ${report.title}`} onPress={() => openSource(report.url)} style={styles.source}>
                        <T variant="label" style={styles.link}>{report.sourceName}</T>
                        <T variant="caption" muted>{report.status === 'denied' ? 'Denial / correction' : report.reviewed && report.independent ? 'Verified original reporting' : 'Read original source'}</T>
                    </Pressable>
                ))}
            </View>
        </Card>
    );
}

export default function TradeRadarScreen({navigation, route}) {
    const {team} = useFavoriteTeam();
    const {colors} = useAppTheme();
    const {prefs, ready, busy, error: alertError, save} = useTradeAlerts();
    const [scope, setScope] = useState(route.params?.storyId ? 'all' : 'team');
    const [minimum, setMinimum] = useState('Low');
    const query = useQuery(fetchTrades, [], {enabled: tradeRadarConfigured, refetchInterval: 60000});
    const selectedId = route.params?.storyId;
    const stories = useMemo(() => (query.data?.stories ?? []).filter(story =>
        story.id === selectedId || ((scope === 'all' || story.teams.includes(team)) && LEVELS.indexOf(story.confidence) >= LEVELS.indexOf(minimum)))
        .sort((a, b) => a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0), [query.data, scope, team, minimum, selectedId]);
    const tabs = [{key: 'team', label: team || 'My team'}, {key: 'all', label: 'All teams'}];
    const unavailable = query.data?.sources?.filter(source => source.status !== 'ok') ?? [];
    return (
        <Screen>
            <Header title="Trade Radar" subtitle="The reports. The sources. The confidence." left={<BackButton onPress={() => navigation.goBack()}/>}/>
            <FlatList
                data={stories} keyExtractor={story => story.id} contentContainerStyle={styles.content}
                renderItem={({item}) => <Story story={item} highlighted={item.id === selectedId}/>}
                refreshControl={<RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.text}/>}
                ListHeaderComponent={<View style={styles.header}>
                    <T muted>Confidence describes the reporting behind a claim, not the probability a trade will happen. Reposts don’t count as independent confirmation.</T>
                    <PillTabs tabs={tabs} value={scope} onChange={setScope}/>
                    <T variant="label">Minimum confidence in feed</T>
                    <PillTabs tabs={thresholds} value={minimum} onChange={setMinimum}/>
                    <Card style={styles.alerts}>
                        <View style={styles.row}>
                            <View style={styles.flex}>
                                <T variant="heading">Trade alerts</T>
                                <T variant="caption" muted>{prefs.enabled ? `Following ${prefs.team || 'all teams'} · ${prefs.minimum}${prefs.minimum === 'Confirmed' ? ' only' : ' and above'}` : 'Get notified when reporting strengthens.'}</T>
                            </View>
                            <Switch accessibilityLabel="Trade alerts" value={prefs.enabled} disabled={!ready || busy || !tradeRadarConfigured} onValueChange={enabled => save({enabled, team: scope === 'team' ? team : null})}/>
                        </View>
                        {prefs.enabled ? <>
                            <T variant="label">Alert coverage</T>
                            <PillTabs tabs={tabs} value={prefs.team ? 'team' : 'all'} onChange={value => { if (!busy) save({team: value === 'team' ? team : null}); }}/>
                            <T variant="label">Alert me at</T>
                            <PillTabs tabs={thresholds} value={prefs.minimum} onChange={value => { if (!busy) save({minimum: value}); }}/>
                        </> : null}
                        {busy ? <T variant="caption" muted>Saving alert settings…</T> : null}
                        {alertError ? <T variant="caption" accessibilityRole="alert">{alertError}</T> : null}
                    </Card>
                    {!tradeRadarConfigured ? <EmptyState title="Trade Radar is coming online" message="Live reporting and alerts will appear once the news service is connected."/> : null}
                    {query.error ? <T accessibilityRole="alert">Couldn’t refresh reports. Pull down to retry.{query.data ? ' Showing the last available reports.' : ''}</T> : null}
                    {query.data ? <View style={styles.health}>
                        <T variant="caption" muted>Last refresh {new Date(query.data.fetchedAt).toLocaleString()}</T>
                        {unavailable.length ? <T variant="caption" muted>Coverage incomplete: {unavailable.map(source => source.name).join(', ')} currently unavailable.</T> : <T variant="caption" muted>All configured sources responding</T>}
                    </View> : null}
                    {selectedId && query.data && !query.data.stories.some(s => s.id === selectedId) ? <T muted>This alert’s report has expired or is no longer available.</T> : null}
                </View>}
                ListEmptyComponent={tradeRadarConfigured ? <EmptyState title={query.loading ? 'Checking the latest reports…' : 'No matching reports'} message={query.loading ? 'Gathering source coverage.' : 'Try all teams or a lower confidence filter. New reports will appear here.'}/> : null}
            />
        </Screen>
    );
}
const styles = StyleSheet.create({
    content: {paddingHorizontal: 20, paddingBottom: 110},
    header: {gap: 16, marginBottom: 20},
    row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'},
    flex: {flex: 1},
    alerts: {gap: 14},
    story: {gap: 12, marginBottom: 16},
    sources: {borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4},
    source: {paddingVertical: 8, gap: 4},
    link: {textDecorationLine: 'underline'},
    health: {gap: 4},
});
