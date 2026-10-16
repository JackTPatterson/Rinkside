import React, {memo, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Sheet, T, TeamLogo, tap} from '../../components/ui';
import {ArrowRight2, Close} from '../../components/icons';
import {getTeam} from '../../data/teams';
import {GUTTER, useAppTheme} from '../../theme';
import {pct} from '../../utils/format';
import {AnimatedBar, Divider, type} from './shared';
import {PlayoffBar, StopValues} from './PlayoffBar';

const ROUNDS = [
    [1, 'First round'],
    [2, 'Second round'],
    [3, 'Conference final'],
    [4, 'Stanley Cup Final'],
];

// Old Rinkside PCTStat: label left, percentage in a card pill right, 10pt team-colour bar under.
const OddsLine = memo(function OddsLine({label, value, color, delay}) {
    const {colors} = useAppTheme();
    return (
        <View style={st.line}>
            <View style={st.lineTop}>
                <T style={st.lineLabel} numberOfLines={1}>{label}</T>
                <View style={[st.pctPill, {backgroundColor: colors.card}]}>
                    <T style={st.pctText}>{pct(value, value != null && value < 0.01 && value > 0 ? 1 : 0)}</T>
                </View>
            </View>
            <AnimatedBar value={value} color={color} delay={delay} track={colors.card} height={6}/>
        </View>
    );
});

/**
 * Series wins, kept simple: per round, the chance to win that series and the likeliest length.
 * (The per-length split is in the data; only the most likely one is worth showing.)
 */
function SeriesGrid({odds}) {
    const {colors} = useAppTheme();
    const rounds = ROUNDS.filter(([r]) => [4, 5, 6, 7].some((g) => odds[`round${r}Winin${g}`] != null));
    if (!rounds.length) return null;
    const fmt = (v) => (v > 0 && v < 0.01 ? '<1%' : pct(v));
    return (
        <View>
            <Divider style={st.divider}/>
            <T variant="title" style={st.seriesTitle}>Series wins</T>
            {rounds.map(([r, label], i) => {
                const vals = [4, 5, 6, 7].map((g) => odds[`round${r}Winin${g}`] ?? 0);
                const total = vals.reduce((x, y) => x + y, 0);
                const best = vals.indexOf(Math.max(...vals));
                return (
                    <View key={r} style={[st.sRow, i > 0 && {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border}]}>
                        <View style={st.flex}>
                            <T style={type.value}>{label}</T>
                            {total > 0 ? <T muted style={type.small}>Most likely in {best + 4} games</T> : null}
                        </View>
                        <T style={[type.value, st.sPct]}>{fmt(total)}</T>
                    </View>
                );
            })}
        </View>
    );
}

/** Bottom sheet with one team's MoneyPuck playoff odds. odds: parsed simulations row. */
export default function OddsSheet({odds: incoming, onClose, onOpenTeam}) {
    const {colors, teamColor} = useAppTheme();
    const visible = !!incoming;
    // Keep the last team rendered while the sheet slides away.
    const last = useRef(null);
    if (incoming) last.current = incoming;
    const odds = incoming ?? last.current;
    // "Open team page" navigates only once the sheet has fully closed.
    const pending = useRef(null);
    const abbrev = odds?.abbrev;
    const color = teamColor(abbrev);
    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            onClosed={() => {
                const fn = pending.current;
                pending.current = null;
                fn?.();
            }}
            style={st.sheet}>
            {odds ? (
                <View style={st.body}>
                    <View style={st.header}>
                        <TeamLogo abbrev={abbrev} size={44}/>
                        <View style={{flex: 1}}>
                            <T variant="title" numberOfLines={1}>{getTeam(abbrev)?.name ?? abbrev}</T>
                            <T muted style={type.small}>Playoff odds</T>
                        </View>
                        <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                            <Close size={24} color={colors.textSecondary}/>
                        </Pressable>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} alwaysBounceVertical={false} contentContainerStyle={{paddingBottom: 8}}>
                        {odds.madePlayoffs != null ? (
                            <View style={st.line}>
                                <View style={st.lineTop}>
                                    <T style={st.lineLabel}>Make playoffs</T>
                                    <T style={st.bigPct}>{pct(odds.madePlayoffs, odds.madePlayoffs > 0 && odds.madePlayoffs < 0.01 ? 1 : 0)}</T>
                                </View>
                                <PlayoffBar odds={odds} height={8}/>
                                <StopValues odds={odds}/>
                            </View>
                        ) : null}
                        {odds.draftLottery != null ? (
                            <OddsLine label="Win the draft lottery" value={odds.draftLottery} color={colors.textSecondary} delay={0}/>
                        ) : null}
                        <SeriesGrid odds={odds}/>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                                tap();
                                pending.current = () => onOpenTeam(abbrev);
                                onClose();
                            }}
                            style={({pressed}) => [st.cta, {backgroundColor: colors.text}, pressed && {opacity: 0.7}]}>
                            <T color={colors.background} style={st.ctaText}>Open team page</T>
                            <ArrowRight2 size={16} color={colors.background}/>
                        </Pressable>
                    </ScrollView>
                </View>
            ) : null}
        </Sheet>
    );
}

const st = StyleSheet.create({
    seriesTitle: {marginBottom: 6},
    flex: {flex: 1},
    sRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10},
    sPct: {fontFamily: 'Sora_700Bold', fontVariant: ['tabular-nums']},
    sheet: {paddingHorizontal: GUTTER * 2},
    body: {flexShrink: 1},
    header: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20},
    line: {marginBottom: 20},
    bigPct: {fontFamily: 'Sora_700Bold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums']},
    lineTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10},
    lineLabel: {fontFamily: 'Sora_400Regular', fontSize: 20, lineHeight: 26, flexShrink: 1},
    pctPill: {borderRadius: 100, paddingHorizontal: 15, paddingVertical: 4},
    pctText: {fontFamily: 'Sora_500Medium', fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums']},
    divider: {marginHorizontal: 0, marginBottom: 20},
    cta: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 100, marginTop: 20},
    ctaText: {fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 22},
});
