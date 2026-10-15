import React, {memo} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {InfoTip, T, TeamLogo, tap} from '../../components/ui';
import {ArrowRight2, CloseCircle} from '../../components/icons';
import {getTeam} from '../../data/teams';
import {useAppTheme, withAlpha} from '../../theme';
import {pct} from '../../utils/format';
import {AnimatedBar} from './shared';

const OVERALL = [
    ['madePlayoffs', 'Make playoffs'],
    ['round2', 'Reach second round'],
    ['round3', 'Reach conference final'],
    ['round4', 'Reach Stanley Cup Final'],
    ['wonCup', 'Win the Cup'],
];
const ROUNDS = [
    [1, 'First round'],
    [2, 'Second round'],
    [3, 'Conference final'],
    [4, 'Stanley Cup Final'],
];

const SERIES_INFO = 'MoneyPuck simulates the rest of the season and playoffs thousands of times. ' +
    'Each number is the share of simulations where the team wins that series in exactly that many games. ' +
    'These are model estimates, not certainties.';

const OddsLine = memo(function OddsLine({label, value, color, delay}) {
    return (
        <View style={st.line}>
            <View style={st.lineTop}>
                <T variant="body">{label}</T>
                <T variant="label">{pct(value, value != null && value < 0.01 && value > 0 ? 1 : 0)}</T>
            </View>
            <AnimatedBar value={value} color={color} delay={delay}/>
        </View>
    );
});

function SeriesGrid({odds, color}) {
    const {colors} = useAppTheme();
    const rounds = ROUNDS.filter(([r]) => [4, 5, 6, 7].some((g) => odds[`round${r}Winin${g}`] != null));
    if (!rounds.length) return null;
    return (
        <View style={{marginTop: 20}}>
            <View style={st.lineTop}>
                <View style={st.titleRow}>
                    <T variant="heading">Series wins by length</T>
                    <InfoTip title="Series wins by length" body={SERIES_INFO}/>
                </View>
            </View>
            {rounds.map(([r, label]) => {
                const vals = [4, 5, 6, 7].map((g) => odds[`round${r}Winin${g}`] ?? 0);
                const max = Math.max(0.0001, ...vals);
                return (
                    <View key={r} style={[st.round, {backgroundColor: colors.card}]}>
                        <T variant="label" style={{marginBottom: 8}}>{label}</T>
                        <View style={st.cols}>
                            {vals.map((v, i) => (
                                <View key={i} style={st.col}>
                                    <View style={[st.colTrack, {backgroundColor: colors.cardAlt}]}>
                                        <View style={{height: `${(v / max) * 100}%`, backgroundColor: withAlpha(color, 0.35 + 0.65 * (v / max)), borderRadius: 6}}/>
                                    </View>
                                    <T variant="caption">{pct(v, v > 0 && v < 0.01 ? 1 : 0)}</T>
                                    <T variant="caption" muted>in {i + 4}</T>
                                </View>
                            ))}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

/** Bottom sheet with one team's MoneyPuck playoff odds. odds: parsed simulations row. */
export default function OddsSheet({odds, onClose, onOpenTeam}) {
    const {colors, teamColor} = useAppTheme();
    const insets = useSafeAreaInsets();
    const visible = !!odds;
    const abbrev = odds?.abbrev;
    const color = teamColor(abbrev);
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={[st.backdrop, {backgroundColor: colors.overlay}]} onPress={onClose} accessibilityLabel="Close"/>
            {odds ? (
                <View style={[st.sheet, {backgroundColor: colors.background, paddingBottom: insets.bottom + 16}]}>
                    <View style={[st.grabber, {backgroundColor: colors.border}]}/>
                    <View style={st.header}>
                        <TeamLogo abbrev={abbrev} size={36}/>
                        <View style={{flex: 1}}>
                            <T variant="heading" numberOfLines={1}>{getTeam(abbrev)?.name ?? abbrev}</T>
                            <T variant="caption" muted>MoneyPuck simulation odds</T>
                        </View>
                        <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                            <CloseCircle size={24} color={colors.textSecondary}/>
                        </Pressable>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 8}}>
                        {OVERALL.filter(([k]) => odds[k] != null).map(([k, label], i) => (
                            <OddsLine key={k} label={label} value={odds[k]} color={color} delay={i * 60}/>
                        ))}
                        {odds.draftLottery != null ? (
                            <OddsLine label="Win the draft lottery" value={odds.draftLottery} color={colors.textSecondary} delay={OVERALL.length * 60}/>
                        ) : null}
                        <SeriesGrid odds={odds} color={color}/>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                                tap();
                                onOpenTeam(abbrev);
                            }}
                            style={({pressed}) => [st.cta, {backgroundColor: colors.text}, pressed && {opacity: 0.7}]}>
                            <T variant="label" color={colors.background}>Open team page</T>
                            <ArrowRight2 size={16} color={colors.background}/>
                        </Pressable>
                    </ScrollView>
                </View>
            ) : null}
        </Modal>
    );
}

const st = StyleSheet.create({
    backdrop: {flex: 1},
    sheet: {maxHeight: '82%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8},
    grabber: {alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12},
    header: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16},
    line: {marginBottom: 16, gap: 8},
    lineTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    titleRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12},
    round: {borderRadius: 16, padding: 14, marginBottom: 10},
    cols: {flexDirection: 'row', gap: 10},
    col: {flex: 1, alignItems: 'center', gap: 4},
    colTrack: {width: '100%', height: 56, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden'},
    cta: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 999, marginTop: 12},
});
