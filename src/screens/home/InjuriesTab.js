import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Card, EmptyState, FadeInView, Row, SkeletonList, T} from '../../components/ui';
import {useAppTheme} from '../../theme';

function statusColor(status, colors) {
    const s = String(status ?? '').toLowerCase();
    if (s.includes('day')) return colors.warning;
    if (s.includes('out') || s.includes('ir') || s.includes('reserve')) return colors.negative;
    return colors.cardAlt;
}

const InjuryRow = memo(function InjuryRow({item}) {
    const {colors} = useAppTheme();
    const first = String(item?.firstname ?? '');
    const name = `${first ? `${first.slice(0, 1)}. ` : ''}${item?.lastname ?? item?.player ?? ''}`.trim() || 'Unknown player';
    const color = statusColor(item?.status, colors);
    return (
        <Card style={styles.row}>
            <View style={styles.flex}>
                <Row gap={6}>
                    <T variant="label" numberOfLines={1} style={styles.shrink}>{name}</T>
                    {item?.position ? <T variant="caption" muted>{item.position}</T> : null}
                </Row>
                <T variant="caption" muted numberOfLines={2}>{item?.injury || 'Undisclosed'}</T>
            </View>
            {item?.status ? <Badge label={String(item.status)} color={color}/> : null}
        </Card>
    );
});

function InjuriesTab({injuries, loading, error}) {
    if (loading && !injuries) return <SkeletonList count={4} height={60} style={styles.pad}/>;
    if (error && !injuries) {
        return <EmptyState title="Injury report unavailable" message="The injury feed couldn’t be reached. Pull down to try again."/>;
    }
    if (!injuries?.length) return <EmptyState title="No injuries reported" message="Everyone’s healthy, at least officially."/>;
    return (
        <FadeInView style={styles.list}>
            {injuries.map((item, i) => <InjuryRow key={`${item?.ID ?? item?.lastname ?? ''}-${i}`} item={item}/>)}
            <T variant="caption" muted style={styles.source}>Source: RotoWire injury report.</T>
        </FadeInView>
    );
}

export default memo(InjuriesTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: 16},
    flex: {flex: 1},
    shrink: {flexShrink: 1},
    list: {paddingHorizontal: 16, gap: 8},
    row: {flexDirection: 'row', alignItems: 'center', gap: 12},
    source: {marginTop: 8},
});
