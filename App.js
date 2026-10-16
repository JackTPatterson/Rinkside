import {
    Sora_100Thin,
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    useFonts,
} from '@expo-google-fonts/sora';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import React, {useCallback, useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import {nhl} from './src/api/nhl';
import {toISODate} from './src/utils/format';
import {Brodcast, Chart, Home2, Setting2, User} from './src/components/icons';
import {FavoriteTeamProvider, useFavoriteTeam} from './src/hooks/useFavoriteTeam';
import {ROUTES} from './src/navigation/routes';
import AboutScreen from './src/screens/AboutScreen';
import FavoriteTeamScreen from './src/screens/FavoriteTeamScreen';
import GameScreen from './src/screens/GameScreen';
import HomeScreen from './src/screens/HomeScreen';
import MethodologyScreen from './src/screens/MethodologyScreen';
import VideoScreen from './src/screens/VideoScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import PlayersScreen from './src/screens/PlayersScreen';
import RecapScreen from './src/screens/RecapScreen';
import ScoresScreen from './src/screens/ScoresScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StandingsScreen from './src/screens/StandingsScreen';
import RadioBar from './src/radio/RadioBar';
import {RadioProvider} from './src/radio/RadioProvider';
import {ThemeProvider, useAppTheme} from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();
const TAB_BAR_HEIGHT = 100;
const Stack = createNativeStackNavigator();

const screenLayout = ({children}) => <ErrorBoundary>{children}</ErrorBoundary>;

// Old-app tab bar: icon with a small label underneath, no stock labels.
const TABS = {
    [ROUTES.home]: {Icon: Home2, label: 'My Team', size: 22},
    [ROUTES.standings]: {Icon: Chart, label: 'Rankings', size: 22},
    [ROUTES.players]: {Icon: User, label: 'Players', size: 22},
    [ROUTES.scores]: {Icon: Brodcast, label: 'Live Games', size: 28},
    [ROUTES.settings]: {Icon: Setting2, label: 'Settings', size: 22},
};

function Tabs() {
    const {colors, fonts, dark} = useAppTheme();
    return (
        <Tab.Navigator
            screenLayout={screenLayout}
            screenListeners={{tabPress: () => Haptics.selectionAsync().catch(() => {})}}
            screenOptions={({route}) => ({
                headerShown: false,
                // Keep tabs mounted after first visit so switching back is instant.
                lazy: true,
                freezeOnBlur: true,
                tabBarShowLabel: false,
                tabBarActiveTintColor: dark ? '#FFFFFF' : '#000000',
                tabBarInactiveTintColor: '#AAACAE',
                tabBarStyle: {
                    backgroundColor: colors.background,
                    borderTopWidth: 0,
                    height: 100,
                    shadowOffset: {width: 0, height: 0},
                    shadowOpacity: 1,
                    shadowRadius: 1,
                    shadowColor: dark ? '#555555' : '#D1D1D1',
                },
                tabBarIconStyle: {width: 80, height: 50},
                tabBarIcon: ({color}) => {
                    const {Icon, label, size} = TABS[route.name];
                    return (
                        <View style={{alignItems: 'center', justifyContent: 'center', gap: size > 24 ? 0 : 4}}>
                            <Icon size={size} color={color}/>
                            <Text
                                maxFontSizeMultiplier={1.2}
                                numberOfLines={1}
                                style={{fontFamily: fonts.semibold, fontSize: 12, color, textAlign: 'center'}}>
                                {label}
                            </Text>
                        </View>
                    );
                },
            })}>
            <Tab.Screen name={ROUTES.home} component={HomeScreen} options={{title: 'My Team'}}/>
            <Tab.Screen name={ROUTES.standings} component={StandingsScreen} options={{title: 'Rankings'}}/>
            <Tab.Screen name={ROUTES.scores} component={ScoresScreen} options={{title: 'Live Games'}}/>
            <Tab.Screen name={ROUTES.players} component={PlayersScreen} options={{title: 'Players'}}/>
            <Tab.Screen name={ROUTES.settings} component={SettingsScreen} options={{title: 'Settings'}}/>
        </Tab.Navigator>
    );
}

function RootNavigator() {
    const theme = useAppTheme();
    const {team, ready} = useFavoriteTeam();
    // Whether the tab bar is showing, so the radio mini player can sit right above it or near the bottom edge.
    const [onTabs, setOnTabs] = useState(true);
    const [onVideo, setOnVideo] = useState(false); // the video player covers everything, so hide the radio bar
    const syncRoute = useCallback(() => {
        const root = navigationRef.isReady() ? navigationRef.getRootState() : null;
        const name = root?.routes[root.index]?.name;
        setOnTabs(!root || name === ROUTES.tabs);
        setOnVideo(name === ROUTES.video);
    }, []);
    const [fontsLoaded] = useFonts({
        Sora_100Thin,
        Sora_300Light,
        Sora_400Regular,
        Sora_500Medium,
        Sora_600SemiBold,
        Sora_700Bold,
        Sora_800ExtraBold,
    });

    // Warm the caches the first tabs need while the splash screen is still up.
    useEffect(() => {
        nhl.standings().catch(() => {});
        // Same key the Scores tab uses: the hockey day rolls over at 4am.
        nhl.score(toISODate(new Date(Date.now() - 4 * 3600 * 1000))).catch(() => {});
    }, []);

    const onLayout = useCallback(() => {
        if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {});
    }, [fontsLoaded, ready]);

    // Keep the native splash up until fonts + the saved team are ready: no flash of unstyled text,
    // and returning users never see onboarding flicker.
    if (!fontsLoaded || !ready) return null;

    return (
        <View style={{flex: 1, backgroundColor: theme.colors.background}} onLayout={onLayout}>
            <StatusBar style={theme.dark ? 'light' : 'dark'}/>
            <NavigationContainer ref={navigationRef} theme={theme.navigation} onReady={syncRoute} onStateChange={syncRoute}>
                <Stack.Navigator
                    screenLayout={screenLayout}
                    screenOptions={{
                        headerShown: false,
                        contentStyle: {backgroundColor: theme.colors.background},
                        animation: 'default',
                    }}>
                    {!team ? (
                        <Stack.Screen name={ROUTES.onboarding} component={OnboardingScreen}/>
                    ) : (
                        <>
                            <Stack.Screen name={ROUTES.tabs} component={Tabs}/>
                            <Stack.Screen name={ROUTES.game} component={GameScreen}/>
                            <Stack.Screen name={ROUTES.recap} component={RecapScreen}/>
                            <Stack.Screen name={ROUTES.player} component={PlayerScreen}/>
                            <Stack.Screen name={ROUTES.team} component={HomeScreen}/>
                            <Stack.Screen name={ROUTES.favoriteTeam} component={FavoriteTeamScreen}/>
                            <Stack.Screen name={ROUTES.about} component={AboutScreen}/>
                            <Stack.Screen name={ROUTES.methodology} component={MethodologyScreen}/>
                            <Stack.Screen
                                name={ROUTES.video}
                                component={VideoScreen}
                                options={{presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: {backgroundColor: '#000'}}}
                            />
                        </>
                    )}
                </Stack.Navigator>
            </NavigationContainer>
            {/* Mini player floats over every screen while team radio is on. */}
            {!onVideo ? <RadioBar bottomOffset={onTabs ? TAB_BAR_HEIGHT : null}/> : null}
        </View>
    );
}

export default function App() {
    return (
        <GestureHandlerRootView style={{flex: 1}}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <FavoriteTeamProvider>
                        <RadioProvider>
                            <RootNavigator/>
                        </RadioProvider>
                    </FavoriteTeamProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
