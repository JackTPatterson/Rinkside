import React, {memo, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {gameScores} from '../../analytics';
import {EmptyState, FadeInView, Row, Segmented, Skeleton, SkeletonList, T} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {DivergingBar} from '../standings/shared';
import {PlayerTile, SectionTitle, type} from './common';

const INFO_BASE = 'Game Score rolls a player’s night into one number: above zero helped his team, below zero hurt it. ' +
    'Skaters earn credit for goals, primary and secondary assists, shots on goal, blocked shots, penalties drawn and faceoff wins, and lose it for penalties taken and faceoff losses. ';
const INFO_SHIFTS = INFO_BASE +
    'They also gain or lose a little for the 5-on-5 shot attempts and goals for and against while they were on the ice, from the NHL’s shift charts. ' +
    'Goalies gain a little for every save and lose more for every goal allowed. ' +
    'The weights follow Dom Luszczyszyn’s public Game Score. Shootouts don’t count. Tap a player for his page.';
const INFO_PM = INFO_BASE +
    'Goalies gain a little for every save and lose more for every goal allowed. ' +
    'The weights follow Dom Luszczyszyn’s public Game Score. Shift data isn’t available for this game yet, so goals for and against on ice use the player’s plus/minus (even-strength and short-handed goals only), and the on-ice shot-attempt (Corsi) part is left out rather than guessed. ' +
    'Shootouts don’t count. Tap a player for his page.';

const GROUPS = [
    {pos: 'F', title: 'Forwards'},
    {pos: 'D', title: 'Defence'},
    {pos: 'G', title: 'Goalies'},
];

/** "+3.04" / "−2.77" / "0.00" with a true minus sign. */
const fmt = (v) => {
    const x = Number(v) || 0;
    const s = Math.abs(x).toFixed(2);
    return x > 0 ? `+${s}` : x < 0 ? `−${s}` : s;
};

const ScoreRow = memo(function ScoreRow({row, max, color, onPress}) {
    const {colors} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.name}, game score ${fmt(row.gs)}`}
            onPress={() => onPress(row.playerId)}
            style={({pressed}) => [styles.row, pressed && {opacity: 0.6}]}>
            <T variant="body" style={[type.small, styles.sweater, {color: colors.textSecondary}]}>{row.sweater ?? ''}</T>
            <T variant="body" numberOfLines={1} style={[type.small, styles.name]}>{row.shortName || row.name}</T>
            <View style={styles.bar}>
                <DivergingBar value={row.gs} max={max} height={10} color={row.gs >= 0 ? color : colors.textSecondary}/>
            </View>
            <T variant="body" style={[type.small, styles.value, {color: row.gs >= 0 ? colors.text : colors.textSecondary}]}>{fmt(row.gs)}</T>
        </Pressable>
    );
});

/** Per-player Game Score as diverging bars around 0, per team, grouped by position. */
function GameScoreTab({box, pbp, shifts, header, onPlayer}) {
    const {teamColor} = useAppTheme();
    const [sideKey, setSideKey] = useState('home');

    const scores = useMemo(() => (box && pbp ? gameScores(box, pbp, shifts) : null), [box, pbp, shifts]);
    // One scale for both teams so switching sides doesn't rescale the bars.
    const max = useMemo(() => {
        if (!scores) return 2;
        return Math.max(2, ...[...scores.home, ...scores.away].map((r) => Math.abs(r.gs)));
    }, [scores]);

    if (!box || !pbp) {
        return (
            <View style={{gap: 20}}>
                <Skeleton height={44} radius={100}/>
                <SkeletonList count={8} height={28} gap={8}/>
            </View>
        );
    }

    const team = sideKey === 'home' ? header.home : header.away;
    const color = teamColor(team.abbrev);
    const rows = scores[sideKey];
    if (!rows.length) return <EmptyState message="Game Scores appear once players have stats."/>;
    const top = rows.slice(0, 3);

    return (
        <View>
            <Segmented
                options={[
                    {key: 'home', label: header.home.abbrev, color: teamColor(header.home.abbrev)},
                    {key: 'away', label: header.away.abbrev, color: teamColor(header.away.abbrev)},
                ]}
                value={sideKey}
                onChange={setSideKey}
            />
            <FadeInView key={sideKey}>
                <SectionTitle title="Top Performers" info={scores.onIceSource === 'shifts' ? INFO_SHIFTS : INFO_PM}/>
                <Row gap={0} style={styles.top}>
                    {top.map((r) => (
                        <PlayerTile
                            key={r.playerId}
                            playerId={r.playerId}
                            name={r.name}
                            headshot={r.headshot}
                            team={team.abbrev}
                            caption={fmt(r.gs)}
                            onPress={onPlayer}
                            size={64}
                            splitName
                        />
                    ))}
                </Row>
                {GROUPS.map(({pos, title}) => {
                    const list = rows.filter((r) => r.position === pos);
                    if (!list.length) return null;
                    return (
                        <View key={pos}>
                            <SectionTitle title={title}/>
                            {list.map((r) => <ScoreRow key={r.playerId} row={r} max={max} color={color} onPress={onPlayer}/>)}
                        </View>
                    );
                })}
            </FadeInView>
        </View>
    );
}

export default memo(GameScoreTab);

const styles = StyleSheet.create({
    top: {alignItems: 'flex-start', justifyContent: 'space-around'},
    row: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44},
    sweater: {width: 24, textAlign: 'right', fontVariant: ['tabular-nums']},
    name: {width: 112},
    bar: {flex: 1, height: 10, justifyContent: 'center'},
    value: {width: 50, textAlign: 'right', fontVariant: ['tabular-nums']},
});
