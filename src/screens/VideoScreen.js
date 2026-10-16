import {useVideoPlayer, VideoView} from 'expo-video';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {videoSource} from '../api/brightcove';
import {Close, Global, Refresh} from '../components/icons';
import {T, tap} from '../components/ui';
import {useRadio} from '../radio/RadioProvider';
import {openLink} from './game/common';

const WHITE = '#ffffff';

/** Native player for one resolved stream. Mounted only once the source is known. */
function Player({source, onError}) {
    const player = useVideoPlayer({uri: source.uri, contentType: source.contentType, metadata: {title: source.title ?? undefined, artist: 'NHL'}}, (p) => {
        p.play();
    });
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const sub = player.addListener('statusChange', ({status, error}) => {
            if (status === 'readyToPlay') setReady(true);
            if (status === 'error') onError(error?.message ?? 'Playback failed');
        });
        return () => sub.remove();
    }, [player, onError]);
    return (
        <View style={styles.frame}>
            <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls
                fullscreenOptions={{enable: true, orientation: 'landscape'}}
                allowsPictureInPicture={false}
            />
            {!ready ? <ActivityIndicator style={styles.spinner} color={WHITE}/> : null}
        </View>
    );
}

/**
 * Plays an NHL video (3-min recap, condensed game, goal clip) in the app.
 * params: {videoId, title?, webUrl?}; webUrl is the nhl.com page, offered when a stream can't be played.
 */
export default function VideoScreen({navigation, route}) {
    const {videoId, title, webUrl} = route.params ?? {};
    const insets = useSafeAreaInsets();
    const radio = useRadio();
    const [source, setSource] = useState(null);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);

    // Two audio streams at once is never what you want: pause team radio while a video plays.
    useEffect(() => {
        if (radio.playing) radio.toggle();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let alive = true;
        setError(null);
        setSource(null);
        if (!videoId) {
            setError('No video for this yet.');
            return undefined;
        }
        videoSource(videoId).then(
            (s) => alive && setSource(s),
            (e) => alive && setError(e?.message ?? 'Couldn’t load this video.'),
        );
        return () => {
            alive = false;
        };
    }, [videoId, attempt]);

    const heading = source?.title ?? title ?? 'Video';
    return (
        <View style={[styles.screen, {paddingTop: insets.top + 6, paddingBottom: insets.bottom}]}>
            <View style={styles.header}>
                <T variant="label" color={WHITE} numberOfLines={1} style={styles.title}>{heading}</T>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close video"
                    hitSlop={10}
                    onPress={() => {
                        tap();
                        navigation.goBack();
                    }}
                    style={({pressed}) => pressed && styles.pressed}>
                    <Close size={30} color={WHITE}/>
                </Pressable>
            </View>
            <View style={styles.body}>
                {error ? (
                    <View style={styles.error}>
                        <T variant="body" color={WHITE} style={styles.center}>{error}</T>
                        <View style={styles.actions}>
                            <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} style={({pressed}) => [styles.action, pressed && styles.pressed]}>
                                <Refresh size={18} color={WHITE}/>
                                <T variant="body" color={WHITE}>Try again</T>
                            </Pressable>
                            {webUrl ? (
                                <Pressable accessibilityRole="link" onPress={() => openLink(webUrl)} style={({pressed}) => [styles.action, pressed && styles.pressed]}>
                                    <Global size={18} color={WHITE}/>
                                    <T variant="body" color={WHITE}>NHL.com</T>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                ) : source ? (
                    <Player key={`${videoId}:${attempt}`} source={source} onError={setError}/>
                ) : (
                    <View style={styles.frame}><ActivityIndicator style={styles.spinner} color={WHITE}/></View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {flex: 1, backgroundColor: '#000'},
    header: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, minHeight: 44},
    title: {flex: 1},
    body: {flex: 1, justifyContent: 'center'},
    frame: {width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', justifyContent: 'center'},
    spinner: {alignSelf: 'center'},
    error: {alignItems: 'center', gap: 16, paddingHorizontal: 30},
    actions: {flexDirection: 'row', gap: 10},
    action: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, minHeight: 44, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.15)'},
    center: {textAlign: 'center'},
    pressed: {opacity: 0.6},
});
