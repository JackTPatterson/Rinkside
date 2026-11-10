// Lazy access to the widget modules. They need a native build (expo-widgets); in Expo Go, on Android
// and on web the native module is missing, so everything here degrades to "no widgets".
import {Platform} from 'react-native';

let cached;

/** {nextGame, teamForm, gameActivity} on an iOS build with expo-widgets, otherwise null. */
export function widgetModules() {
    if (cached !== undefined) return cached;
    cached = null;
    if (Platform.OS !== 'ios') return cached;
    try {
        cached = {
            nextGame: require('./NextGameWidget').default,
            teamForm: require('./TeamFormWidget').default,
            gameActivity: require('./GameLiveActivity').default,
        };
    } catch {
        cached = null;
    }
    return cached;
}
