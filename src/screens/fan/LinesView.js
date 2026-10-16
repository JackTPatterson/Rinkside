import React, {memo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {EmptyState, ErrorState, Headshot, Row, SkeletonList, T} from '../../components/ui';
import {headshotUrl} from '../../api/nhl';
import {useAppTheme, withAlpha} from '../../theme';
import {shortDate} from '../../utils/format';

const lastName = (name) => {
    const parts = String(name).split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : name;
};

/** One player in a line: headshot, number and last name; a status line when injured / a game-time call. */
const Slot = memo(function Slot({player, team, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    if (!player) return <View style={styles.slot}/>;
    const uri = player.headshot ?? (player.nhlId ? headshotUrl(player.nhlId, team) : undefined);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={player.name}
            disabled={!player.nhlId}
            onPress={() => onPlayer?.(player.nhlId)}
            style={({pressed}) => [styles.slot, pressed && styles.pressed]}>
            <Headshot uri={uri} size={48} borderColor={teamColor(team)}/>
            <T variant="body" numberOfLines={1} adjustsFontSizeToFit style={styles.name}>{lastName(player.name)}</T>
            <T variant="caption" muted numberOfLines={1} color={player.status ? colors.warning : undefined}>
                {player.status ?? (player.number != null ? `#${player.number}` : ' ')}
            </T>
        </Pressable>
    );
});

function Units({title, units, columns, team, onPlayer}) {
    if (!units?.length) return null;
    return (
        <View style={styles.block}>
            <T variant="caption" muted style={styles.blockTitle}>{title.toUpperCase()}</T>
            {units.map((u) => (
                <Row key={u.key} gap={0} style={styles.unit}>
                    {Array.from({length: columns}).map((_, i) => <Slot key={i} player={u.players[i]} team={team} onPlayer={onPlayer}/>)}
                </Row>
            ))}
        </View>
    );
}

// Status pill colours: long-term absences in red, short-term in amber.
const OUT_TONE = {IR: 'negative', LTIR: 'negative', Suspended: 'negative', Out: 'negative'};

/** Someone not in the lineup: name with a status pill (IR, Day-to-day, Game-time decision...). */
function OutRow({player}) {
    const {colors} = useAppTheme();
    const label = player.status ?? 'Out';
    const c = colors[OUT_TONE[label] ?? 'warning'];
    return (
        <Row style={[styles.textUnit, styles.centered]}>
            <T variant="body" style={styles.flex}>{player.name}</T>
            <View style={[styles.pill, {backgroundColor: withAlpha(c, 0.16)}]}>
                <T variant="caption" color={c} style={styles.pillText}>{label}</T>
            </View>
        </Row>
    );
}

/** Special-teams units as text: "PP1  Tkachuk · Stützle · Batherson · Giroux · Sanderson". */
function TextUnits({title, units}) {
    if (!units?.length) return null;
    return (
        <View style={styles.block}>
            <T variant="caption" muted style={styles.blockTitle}>{title.toUpperCase()}</T>
            {units.map((u) => (
                <Row key={u.key} gap={12} style={styles.textUnit}>
                    <T variant="body" style={[styles.unitLabel]}>{u.label}</T>
                    <T variant="body" muted style={styles.flex}>{u.players.map((p) => lastName(p.name)).join(' · ')}</T>
                </Row>
            ))}
        </View>
    );
}

/**
 * Projected line combinations (fetchLines() output): forward lines, defence pairs, goalies,
 * power play and penalty kill units, and who's out.
 */
function LinesView({lines, team, loading, error, onRetry, onPlayer}) {
    if (loading && !lines) return <SkeletonList count={4} height={96} gap={10} style={styles.skeleton}/>;
    if (error && !lines) return <ErrorState message="Couldn’t load line combinations." onRetry={onRetry}/>;
    if (!lines) return <EmptyState title="No lines yet" message="Projected line combinations aren’t available for this team right now."/>;
    const updated = lines.updatedAt ? new Date(lines.updatedAt) : null;
    return (
        <View>
            <T variant="caption" muted style={styles.updated}>
                Projected lines{updated && !Number.isNaN(updated.getTime()) ? ` · updated ${shortDate(updated)}` : ''}
            </T>
            <Units title="Forwards" units={lines.forwards} columns={3} team={team} onPlayer={onPlayer}/>
            <Units title="Defence" units={lines.defense} columns={2} team={team} onPlayer={onPlayer}/>
            {lines.goalies.length ? (
                <Units title="Goalies" units={[{key: 'g', players: lines.goalies}]} columns={2} team={team} onPlayer={onPlayer}/>
            ) : null}
            <TextUnits title="Power play" units={lines.powerPlay}/>
            <TextUnits title="Penalty kill" units={lines.penaltyKill}/>
            {lines.out.length ? (
                <View style={styles.block}>
                    <T variant="caption" muted style={styles.blockTitle}>OUT</T>
                    {lines.out.map((p) => <OutRow key={p.key} player={p}/>)}
                </View>
            ) : null}
        </View>
    );
}

export default memo(LinesView);

const styles = StyleSheet.create({
    flex: {flex: 1},
    pressed: {opacity: 0.6},
    skeleton: {marginTop: 10},
    updated: {textAlign: 'center', marginTop: 4},
    block: {marginTop: 20},
    blockTitle: {fontFamily: 'Sora_600SemiBold', letterSpacing: 0.8, marginBottom: 6},
    unit: {alignItems: 'flex-start', paddingVertical: 6},
    slot: {flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4},
    name: {fontFamily: 'Sora_600SemiBold', fontSize: 14, lineHeight: 19, alignSelf: 'stretch', textAlign: 'center'},
    textUnit: {alignItems: 'flex-start', paddingVertical: 5},
    unitLabel: {fontFamily: 'Sora_600SemiBold', width: 40},
    centered: {alignItems: 'center'},
    pill: {paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100},
    pillText: {fontFamily: 'Sora_600SemiBold'},
});
