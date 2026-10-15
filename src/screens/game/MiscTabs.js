import React, {memo, useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Badge, Card, DataTable, EmptyState, FadeInView, Headshot, Row, Section, T, TeamLogo} from '../../components/ui';
import {Star1} from '../../components/icons';
import {headshotUrl} from '../../api/nhl';
import {useAppTheme} from '../../theme';
import {loc, savePct} from '../../utils/format';
import {PlayerTile} from './common';
import {extractPenalties} from './model';

/* ----------------------------------------------------------- stars */

const STAR_LABELS = ['First star', 'Second star', 'Third star'];

export const StarsTab = memo(function StarsTab({landing, onPlayer}) {
    const {colors, teamColor} = useAppTheme();
    const stars = landing?.summary?.threeStars ?? [];
    if (!stars.length) {
        return (
            <View style={styles.emptyStars}>
                <Star1 size={64} color={colors.textSecondary} variant="Bold"/>
                <EmptyState title="Stars not announced yet" message="Please check back in a few minutes."/>
            </View>
        );
    }
    return (
        <View style={{gap: 10}}>
            {stars.map((s, i) => {
                const team = loc(s?.teamAbbrev) || s?.teamAbbrev || '';
                const name = loc(s?.name) || [loc(s?.firstName), loc(s?.lastName)].filter(Boolean).join(' ');
                const line = s?.position === 'G'
                    ? `${savePct(s?.savePctg)} SV%${s?.goalsAgainstAverage != null ? ` · ${Number(s.goalsAgainstAverage).toFixed(2)} GAA` : ''}`
                    : `${s?.goals ?? 0} G · ${s?.assists ?? 0} A · ${s?.points ?? 0} P`;
                return (
                    <FadeInView key={s?.playerId ?? i} delay={i * 60}>
                        <Card onPress={() => onPlayer(s?.playerId)} accessibilityLabel={`${STAR_LABELS[i] ?? 'Star'}: ${name}`}>
                            <Row gap={14}>
                                <Headshot uri={s?.headshot} size={64} borderColor={teamColor(team)}/>
                                <View style={{flex: 1, gap: 4}}>
                                    <Row gap={6}>
                                        {Array.from({length: 3 - i}).map((_, k) => <Star1 key={k} size={14} color={teamColor(team)} variant="Bold"/>)}
                                        <T variant="caption" muted>{STAR_LABELS[(s?.star ?? i + 1) - 1] ?? 'Star'}</T>
                                    </Row>
                                    <T variant="heading" numberOfLines={1}>{name}</T>
                                    <Row gap={6}>
                                        <TeamLogo abbrev={team} size={18}/>
                                        <T variant="caption" muted>{team}{s?.position ? ` · ${s.position}` : ''}</T>
                                    </Row>
                                    <T variant="label">{line}</T>
                                </View>
                            </Row>
                        </Card>
                    </FadeInView>
                );
            })}
        </View>
    );
});

/* -------------------------------------------------------- penalties */

const PENALTY_COLUMNS = [
    {key: 'period', title: 'PER', width: 40},
    {key: 'team', title: 'TEAM', width: 52, render: (r) => <Row gap={4}><TeamLogo abbrev={r.team} size={16}/><T variant="caption">{r.team}</T></Row>},
    {key: 'player', title: 'PLAYER', width: 130},
    {key: 'type', title: 'INFRACTION', width: 150},
    {key: 'time', title: 'TIME', width: 52, align: 'right'},
    {key: 'duration', title: 'LENGTH', width: 60, align: 'right'},
];

export const PenaltiesTab = memo(function PenaltiesTab({landing}) {
    const rows = useMemo(() => extractPenalties(landing), [landing]);
    if (!rows.length) return <EmptyState title="No penalties" message="A clean game so far."/>;
    return (
        <Card style={{paddingVertical: 4}}>
            <DataTable columns={PENALTY_COLUMNS} rows={rows} keyExtractor={(r) => r.key}/>
        </Card>
    );
});

/* ---------------------------------------------------- game info */

function gameInfo(landing, box, rail) {
    return landing?.summary?.gameInfo ?? box?.summary?.gameInfo ?? rail?.gameInfo ?? null;
}

const ScratchRow = memo(function ScratchRow({team, list, season, onPlayer}) {
    if (!list?.length) return null;
    return (
        <View style={{marginBottom: 16}}>
            <Row gap={8} style={{marginBottom: 10}}>
                <TeamLogo abbrev={team} size={22}/>
                <T variant="label">{team}</T>
                <Badge label={`${list.length}`}/>
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 4}}>
                {list.map((p) => (
                    <PlayerTile
                        key={p?.id}
                        playerId={p?.id}
                        name={[loc(p?.firstName), loc(p?.lastName)].filter(Boolean).join(' ') || loc(p?.name)}
                        headshot={p?.headshot ?? (p?.id ? headshotUrl(p.id, team, season) : undefined)}
                        team={team}
                        size={56}
                        onPress={onPlayer}
                    />
                ))}
            </ScrollView>
        </View>
    );
});

/** Scratches, officials and coaches. */
export const InfoTab = memo(function InfoTab({header, landing, box, rail, onPlayer}) {
    const info = gameInfo(landing, box, rail);
    const homeScr = info?.homeTeam?.scratches ?? rail?.gameInfo?.homeTeam?.scratches ?? [];
    const awayScr = info?.awayTeam?.scratches ?? rail?.gameInfo?.awayTeam?.scratches ?? [];
    const refs = (info?.referees ?? []).map(loc).filter(Boolean);
    const lines = (info?.linesmen ?? []).map(loc).filter(Boolean);
    const coaches = [
        [header.home.abbrev, loc(info?.homeTeam?.headCoach)],
        [header.away.abbrev, loc(info?.awayTeam?.headCoach)],
    ].filter(([, c]) => c);
    return (
        <View>
            <Section title="Scratches" style={{marginTop: 4}}>
                <Card>
                    {homeScr.length || awayScr.length ? (
                        <>
                            <ScratchRow team={header.home.abbrev} list={homeScr} season={header.season} onPlayer={onPlayer}/>
                            <ScratchRow team={header.away.abbrev} list={awayScr} season={header.season} onPlayer={onPlayer}/>
                        </>
                    ) : <T variant="body" muted>No scratches listed.</T>}
                </Card>
            </Section>
            {refs.length || lines.length ? (
                <Section title="Officials">
                    <Card style={{gap: 10}}>
                        {refs.length ? (
                            <View>
                                <T variant="caption" muted>Referees</T>
                                <T variant="body">{refs.join(' · ')}</T>
                            </View>
                        ) : null}
                        {lines.length ? (
                            <View>
                                <T variant="caption" muted>Linesmen</T>
                                <T variant="body">{lines.join(' · ')}</T>
                            </View>
                        ) : null}
                    </Card>
                </Section>
            ) : null}
            {coaches.length ? (
                <Section title="Head coaches">
                    <Card style={{gap: 8}}>
                        {coaches.map(([team, name]) => (
                            <Row key={team} gap={8}>
                                <TeamLogo abbrev={team} size={20}/>
                                <T variant="body">{name}</T>
                            </Row>
                        ))}
                    </Card>
                </Section>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create({
    emptyStars: {alignItems: 'center', paddingTop: 24},
});
