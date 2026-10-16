import React, {memo, useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {EmptyState, Headshot, Row, T} from '../../components/ui';
import {Star1} from '../../components/icons';
import {headshotUrl} from '../../api/nhl';
import {useAppTheme} from '../../theme';
import {loc, savePct} from '../../utils/format';
import {Divider, PlainTable, type} from './common';
import {extractPenalties} from './model';

/* ----------------------------------------------------------- stars */

const STAR_LABELS = ['First star', 'Second star', 'Third star'];

export const StarsTab = memo(function StarsTab({landing, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    const stars = landing?.summary?.threeStars ?? [];
    if (!stars.length) {
        return (
            <View style={styles.emptyStars}>
                <Star1 size={82} color={colors.text} variant="Bold"/>
                <T variant="body" style={styles.emptyTitle}>The Stars of the Game have not been released yet</T>
                <T variant="body" style={styles.emptySub}>Please check back in a few minutes</T>
            </View>
        );
    }
    return (
        <View style={styles.starsRow}>
            {stars.map((s, i) => {
                const team = loc(s?.teamAbbrev) || s?.teamAbbrev || '';
                const name = loc(s?.name) || [loc(s?.firstName), loc(s?.lastName)].filter(Boolean).join(' ');
                const line = s?.position === 'G'
                    ? `${savePct(s?.savePctg)} SV%${s?.goalsAgainstAverage != null ? ` • ${Number(s.goalsAgainstAverage).toFixed(2)} GAA` : ''}`
                    : `${s?.goals ?? 0} G • ${s?.assists ?? 0} A • ${s?.points ?? 0} P`;
                return (
                    <Pressable
                        key={s?.playerId ?? i}
                        accessibilityRole="button"
                        accessibilityLabel={`${STAR_LABELS[i] ?? 'Star'}: ${name}`}
                        onPress={() => onPlayer(s?.playerId)}
                        style={({pressed}) => [styles.star, pressed && {opacity: 0.6}]}>
                        <T variant="body" style={[styles.teamText, styles.center]}>{team}</T>
                        <Headshot uri={s?.headshot} size={80} borderColor={teamColor(team)} style={styles.ring}/>
                        <T variant="body" numberOfLines={2} style={[type.name, styles.center, {marginTop: 10}]}>{name}</T>
                        <T variant="body" style={[type.sub, styles.center, styles.line]}>
                            {STAR_LABELS[(s?.star ?? i + 1) - 1] ?? 'Star'}{s?.position ? ` • ${s.position}` : ''}
                        </T>
                        <T variant="body" style={[type.sub, styles.center, styles.line]}>{line}</T>
                    </Pressable>
                );
            })}
        </View>
    );
});

/* -------------------------------------------------------- penalties */

const PENALTY_COLUMNS = [
    {key: 'period', title: 'PER', width: 40},
    {key: 'team', title: 'TEAM', width: 60},
    {key: 'player', title: 'PLAYER', width: 130},
    {key: 'type', title: 'INFRACTION', width: 150},
    {key: 'time', title: 'TIME', width: 52, align: 'right'},
    {key: 'duration', title: 'LENGTH', width: 60, align: 'right'},
];

export const PenaltiesTab = memo(function PenaltiesTab({landing}) {
    const rows = useMemo(() => extractPenalties(landing), [landing]);
    if (!rows.length) return <EmptyState title="No penalties" message="A clean game so far."/>;
    return <PlainTable columns={PENALTY_COLUMNS} rows={rows} keyExtractor={(r) => r.key}/>;
});

/* ---------------------------------------------------- game info */

function gameInfo(landing, box, rail) {
    return landing?.summary?.gameInfo ?? box?.summary?.gameInfo ?? rail?.gameInfo ?? null;
}

/** One scratched player as a list row: ringed headshot, full name, position. Tap opens the player page. */
const ScratchRow = memo(function ScratchRow({player, team, season, onPlayer}) {
    const {teamColor} = useAppTheme();
    const name = [loc(player?.firstName), loc(player?.lastName)].filter(Boolean).join(' ') || loc(player?.name) || 'Unknown';
    const pos = player?.positionCode ?? player?.position;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={name}
            disabled={!player?.id}
            onPress={() => player?.id && onPlayer(player.id)}
            style={({pressed}) => [styles.scratchRow, pressed && {opacity: 0.6}]}>
            <Headshot
                uri={player?.headshot ?? (player?.id ? headshotUrl(player.id, team, season) : undefined)}
                size={44}
                borderColor={teamColor(team)}
            />
            <T variant="body" numberOfLines={1} style={[type.name, styles.flex]}>{name}</T>
            {pos ? <T variant="body" style={type.sub}>{pos}</T> : null}
        </Pressable>
    );
});

export const ScratchesTab = memo(function ScratchesTab({header, landing, box, rail, onPlayer}) {
    const info = gameInfo(landing, box, rail);
    const homeScr = info?.homeTeam?.scratches ?? rail?.gameInfo?.homeTeam?.scratches ?? [];
    const awayScr = info?.awayTeam?.scratches ?? rail?.gameInfo?.awayTeam?.scratches ?? [];
    if (!homeScr.length && !awayScr.length) return <T variant="body" style={type.sub}>No scratches listed.</T>;
    const group = (team, list) => (list.length ? (
        <View>
            <Row gap={6} style={{marginBottom: 10}}>
                <T variant="body" style={type.name}>{team}</T>
                <T variant="body" style={type.sub}>{list.length}</T>
            </Row>
            {list.map((p, i) => <ScratchRow key={p?.id ?? i} player={p} team={team} season={header.season} onPlayer={onPlayer}/>)}
        </View>
    ) : null);
    return (
        <View>
            {group(header.home.abbrev, homeScr)}
            {homeScr.length && awayScr.length ? <Divider style={{marginVertical: 20}}/> : null}
            {group(header.away.abbrev, awayScr)}
        </View>
    );
});

export const OfficialsTab = memo(function OfficialsTab({header, landing, box, rail}) {
    const info = gameInfo(landing, box, rail);
    // Officials arrive as {fullName: {default}, sweaterNumber}; older feeds sent plain {default} names.
    const official = (o) => {
        const name = loc(o?.fullName) || loc(o?.default) || (typeof o === 'string' ? o : '');
        if (!name) return null;
        return o?.sweaterNumber != null ? `#${o.sweaterNumber} ${name}` : name;
    };
    const refs = (info?.referees ?? []).map(official).filter(Boolean);
    const lines = (info?.linesmen ?? []).map(official).filter(Boolean);
    const coaches = [
        [header.home.abbrev, loc(info?.homeTeam?.headCoach)],
        [header.away.abbrev, loc(info?.awayTeam?.headCoach)],
    ].filter(([, c]) => c);
    if (!refs.length && !lines.length && !coaches.length) return <T variant="body" style={type.sub}>Officials haven’t been announced yet.</T>;
    const block = (title, names, first) => (names.length ? (
        <View>
            <T variant="body" style={[type.name, styles.officialHead, !first && {marginTop: 20}]}>{title}</T>
            {names.map((n, i) => <T key={i} variant="body" style={[type.name, {marginBottom: 10}]}>{n}</T>)}
        </View>
    ) : null);
    return (
        <View>
            {block('Referees', refs, true)}
            {block('Linesmen', lines, !refs.length)}
            {block('Head Coaches', coaches.map(([team, name]) => `${team} • ${name}`), !refs.length && !lines.length)}
        </View>
    );
});

/** Scratches, officials and coaches together (kept for callers that want a single tab). */
export const InfoTab = memo(function InfoTab(props) {
    return (
        <View>
            <ScratchesTab {...props}/>
            <Divider style={{marginVertical: 20}}/>
            <OfficialsTab {...props}/>
        </View>
    );
});

const styles = StyleSheet.create({
    emptyStars: {alignItems: 'center', paddingTop: 20},
    emptyTitle: {fontFamily: 'Sora_400Regular', fontSize: 24, lineHeight: 30, textAlign: 'center', marginHorizontal: 20, marginVertical: 20},
    emptySub: {fontFamily: 'Sora_400Regular', fontSize: 16, lineHeight: 22, opacity: 0.7, textAlign: 'center', marginHorizontal: 40},
    starsRow: {flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start'},
    star: {flex: 1, alignItems: 'center', paddingHorizontal: 4},
    teamText: {fontFamily: 'Sora_700Bold', fontSize: 16, lineHeight: 22, marginBottom: 10},
    center: {textAlign: 'center'},
    line: {marginTop: 4},
    ring: {borderWidth: 3},
    scratchRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6},
    flex: {flex: 1},
    officialHead: {opacity: 0.7, marginBottom: 10},
});
