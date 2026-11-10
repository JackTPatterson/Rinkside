import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {fetchTrades, tradeRadarConfigured} from '../../api/trades';
import {ArrowRight2} from '../../components/icons';
import {EmptyState, ErrorState, FadeInView, Row, SkeletonList, T} from '../../components/ui';
import {useQuery} from '../../hooks/useQuery';
import {GUTTER, useAppTheme} from '../../theme';
import {Story} from '../TradeRadarScreen';

// My Team → Trades: this team's trade reports, plus the way into the full Trade Radar page
// (every team, filters and alert settings).
export default function TradesTab({abbrev, onOpenRadar}) {
    const {colors} = useAppTheme();
    const query = useQuery(fetchTrades, [], {enabled: tradeRadarConfigured, refetchInterval: 60000});
    const stories = (query.data?.stories ?? []).filter((story) => story.teams.includes(abbrev));

    let body;
    if (!tradeRadarConfigured) body = <EmptyState title="Trade Radar is coming online" message="Reports will appear once the news service is connected."/>;
    else if (query.loading && !query.data) body = <SkeletonList count={3} height={120} gap={16}/>;
    else if (query.error && !query.data) body = <ErrorState message="Trade reports couldn’t be reached right now." onRetry={query.refresh}/>;
    else if (!stories.length) body = <EmptyState title="No trade reports" message="Nothing is being reported about this team right now."/>;
    else body = stories.map((story) => <Story key={story.id} story={story}/>);

    return (
        <FadeInView style={styles.list}>
            <T variant="title">Trade Reports</T>
            <T muted>Confidence rates the reporting behind a claim, not the odds a trade happens.</T>
            <Pressable accessibilityRole="button" onPress={onOpenRadar} style={[styles.open, {borderColor: colors.border}]}>
                <Row style={styles.openRow}>
                    <T variant="label">All teams and trade alerts</T>
                    <ArrowRight2 size={18} color={colors.text}/>
                </Row>
            </Pressable>
            {body}
        </FadeInView>
    );
}

const styles = StyleSheet.create({
    list: {paddingHorizontal: GUTTER, paddingTop: 20, gap: 16},
    open: {borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14},
    openRow: {justifyContent: 'space-between'},
});
