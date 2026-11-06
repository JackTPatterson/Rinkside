import * as Sharing from 'expo-sharing';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {captureRef} from 'react-native-view-shot';
import {deserveToWin, excitementIndex} from '../../analytics';
import {Close} from '../../components/icons';
import {T, tap} from '../../components/ui';
import {SheetSurface, useAppTheme} from '../../theme';
import {parseISODate, shortDate} from '../../utils/format';
import {buildEvents, gameEnd} from './liveRink';
import {currentElapsed} from './model';
import ShareCard from './ShareCard';
import {headline} from './shareFormat';
import {winProbSeries} from './winProbSeries';

/** Everything the poster shows, from what the game screen already has. Null until there is a game to show. */
function useShareData({header, pbp, xg, goals, ratings, mp, enabled}) {
    return useMemo(() => {
        if (!enabled || !header.started) return null;
        const homeId = header.home.id ?? pbp?.homeTeam?.id;
        const shots = xg ? [...xg.home.shots, ...xg.away.shots] : [];
        const events = buildEvents(pbp, homeId, shots);
        const endT = gameEnd(events, {nowT: header.live ? currentElapsed(header) : 0, final: header.final});
        const series = winProbSeries({mp, ratings, header, events, endT});
        const excitement = series.length > 2 ? excitementIndex(series.map((p) => p.p)) : null;
        const dtw = xg && (xg.home.shots.length || xg.away.shots.length) ? deserveToWin(xg.home.shots, xg.away.shots) : null;
        return {
            header,
            series,
            endT,
            xg,
            dtw,
            excitement,
            goals: events.filter((e) => e.kind === 'goal').map((e) => {
                // Names and clock come from the landing goals (they carry the scorer).
                const g = goals.find((x) => String(x.eventId) === e.id) ?? goals.find((x) => x.isHome === e.isHome && x.homeScore === e.hs && x.awayScore === e.as);
                return {...e, lastName: g?.lastName, name: g?.name, timeInPeriod: g?.timeInPeriod ?? e.clock};
            }),
            headline: headline({header, excitement, dtw}),
            dateText: header.gameDate ? shortDate(parseISODate(header.gameDate)) + (header.venue ? ` · ${header.venue}` : '') : header.venue ?? '',
        };
    }, [enabled, header, pbp, xg, goals, ratings, mp]);
}

/** Preview of the game poster with a button that turns it into an image and opens the share sheet. */
export default function ShareCardModal({visible, onClose, header, pbp, xg, goals, ratings, mp}) {
    const {colors} = useAppTheme();
    const data = useShareData({header, pbp, xg, goals, ratings, mp, enabled: visible});
    const cardRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const share = useCallback(async () => {
        tap();
        setBusy(true);
        setError(null);
        try {
            if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
            const uri = await captureRef(cardRef, {format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1350});
            await Sharing.shareAsync(uri, {mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share this game'});
        } catch (e) {
            setError(e?.message?.includes('available') ? e.message : 'Couldn’t create the image. Try again.');
        } finally {
            setBusy(false);
        }
    }, []);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SheetSurface>
                <View style={[styles.sheet, {backgroundColor: colors.background}]}>
                    <View style={styles.head}>
                        <T variant="heading">Share this game</T>
                        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={[styles.close, {backgroundColor: colors.card}]}>
                            <Close size={20} color={colors.text}/>
                        </Pressable>
                    </View>
                    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                        {data ? (
                            <View style={styles.shadow}><ShareCard cardRef={cardRef} data={data}/></View>
                        ) : (
                            <T muted style={{textAlign: 'center', marginTop: 40}}>The card is available once the game has started.</T>
                        )}
                        {error ? <T variant="caption" color={colors.negative} style={styles.err}>{error}</T> : null}
                        <Pressable
                            onPress={share}
                            disabled={!data || busy}
                            accessibilityRole="button"
                            accessibilityLabel="Share image"
                            style={[styles.btn, {backgroundColor: colors.text, opacity: !data || busy ? 0.5 : 1}]}>
                            {busy ? <ActivityIndicator color={colors.background}/> : <T variant="body" color={colors.background} style={styles.btnText}>Share image</T>}
                        </Pressable>
                        <T variant="caption" muted style={styles.note}>Shared as a 1080 × 1350 image. Choose “Save Image” in the share sheet to keep it.</T>
                    </ScrollView>
                </View>
            </SheetSurface>
        </Modal>
    );
}

const styles = StyleSheet.create({
    sheet: {flex: 1},
    head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8},
    close: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
    body: {alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 16},
    shadow: {shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: {width: 0, height: 8}},
    btn: {height: 52, borderRadius: 26, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center'},
    btnText: {fontFamily: 'Sora_600SemiBold'},
    note: {textAlign: 'center'},
    err: {textAlign: 'center'},
});
