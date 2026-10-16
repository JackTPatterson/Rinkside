import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {EmptyState, ErrorState, FadeInView, Row, SkeletonList, T} from '../../components/ui';
import {GUTTER, readableOn, useAppTheme} from '../../theme';

function statusColor(status, colors) {
    const s = String(status ?? '').toLowerCase();
    if (s.includes('day')) return colors.warning;
    if (s.includes('out') || s.includes('ir') || s.includes('reserve')) return colors.negative;
    return colors.card;
}

/** "2026-10-16" → "Oct 16" (local date, no timezone shift); null when missing/invalid. */
function returnLabel(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

const InjuryRow = memo(function InjuryRow({item, first: isFirst}) {
    const {colors} = useAppTheme();
    const first = String(item?.firstname ?? '');
    const name = `${first ? `${first.slice(0, 1)}. ` : ''}${item?.lastname ?? item?.player ?? ''}`.trim() || 'Unknown player';
    const color = statusColor(item?.status, colors);
    return (
        <>
            {isFirst ? null : <View style={[styles.divider, {backgroundColor: colors.text}]}/>}
            <View style={styles.row}>
                <View style={styles.flex}>
                    <Row gap={8}>
                        <T variant="body" numberOfLines={1} style={[styles.shrink, styles.semi]}>{name}</T>
                        {item?.position ? <T variant="body" muted>{String(item.position)}</T> : null}
                    </Row>
                    <T variant="body" muted numberOfLines={2} style={styles.injury}>
                        {item?.injury ? String(item.injury) : 'Undisclosed'}
                        {returnLabel(item?.returnDate) ? ` · Est. return ${returnLabel(item.returnDate)}` : ''}
                    </T>
                </View>
                {item?.status ? (
                    <View style={[styles.status, {backgroundColor: color}]}>
                        <T variant="body" numberOfLines={1} color={color === colors.card ? colors.text : readableOn(color)} style={styles.statusText}>
                            {String(item.status)}
                        </T>
                    </View>
                ) : null}
            </View>
        </>
    );
});

function InjuriesTab({injuries, loading, error, onRetry}) {
    if (loading && !injuries) return <SkeletonList count={4} height={50} gap={22} style={styles.pad}/>;
    if (error && !injuries) {
        return <ErrorState message="The injury report couldn’t be reached right now." onRetry={onRetry}/>;
    }
    if (!injuries?.length) return <EmptyState title="No injuries reported" message="Everyone’s healthy, at least officially."/>;
    return (
        <FadeInView style={styles.list}>
            <T variant="title" style={styles.title}>Team Injuries</T>
            <Row style={styles.head}>
                <T variant="caption" style={[styles.headText, styles.flex]}>NAME · INJURY</T>
                <T variant="caption" style={styles.headText}>STATUS</T>
            </Row>
            {injuries.map((item, i) => <InjuryRow key={`${item?.ID ?? item?.lastname ?? ''}-${i}`} item={item} first={i === 0}/>)}
        </FadeInView>
    );
}

export default memo(InjuriesTab);

const styles = StyleSheet.create({
    pad: {paddingHorizontal: GUTTER},
    flex: {flex: 1},
    shrink: {flexShrink: 1},
    semi: {fontFamily: 'Sora_600SemiBold'},
    list: {paddingHorizontal: GUTTER},
    title: {marginBottom: 16},
    head: {marginBottom: 6},
    headText: {fontFamily: 'Sora_600SemiBold', fontSize: 14, opacity: 0.5},
    row: {flexDirection: 'row', alignItems: 'center', gap: 12},
    divider: {height: 2, opacity: 0.2, marginVertical: 10},
    injury: {fontSize: 14, marginTop: 2},
    status: {borderRadius: 100, paddingHorizontal: 15, paddingVertical: 4, maxWidth: 150},
    statusText: {fontSize: 14},
});
