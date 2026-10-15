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
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import React, {useCallback, useEffect} from 'react';
import {View} from 'react-native';
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
import OnboardingScreen from './src/screens/OnboardingScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import PlayersScreen from './src/screens/PlayersScreen';
import RecapScreen from './src/screens/RecapScreen';
import ScoresScreen from './src/screens/ScoresScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StandingsScreen from './src/screens/StandingsScreen';
import {ThemeProvider, useAppTheme} from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenLayout = ({children}) => <ErrorBoundary>{children}</ErrorBoundary>;

const TAB_ICONS = {
    [ROUTES.home]: Home2,
    [ROUTES.scores]: Brodcast,
    [ROUTES.standings]: Chart,
    [ROUTES.players]: User,
    [ROUTES.settings]: Setting2,
};

function Tabs() {
    const {colors, fonts} = useAppTheme();
    return (
        <Tab.Navigator
            screenLayout={screenLayout}
            screenListeners={{tabPress: () => Haptics.selectionAsync().catch(() => {})}}
            screenOptions={({route}) => ({
                headerShown: false,
                // Keep tabs mounted after first visit so switching back is instant.
                lazy: true,
                freezeOnBlur: true,
                tabBarActiveTintColor: colors.text,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                },
                tabBarLabelStyle: {fontFamily: fonts.semibold, fontSize: 11, lineHeight: 15},
                tabBarIcon: ({color, focused}) => {
                    const Icon = TAB_ICONS[route.name];
                    return <Icon size={24} color={color} variant={focused ? 'Bold' : 'Linear'}/>;
                },
            })}>
            <Tab.Screen name={ROUTES.home} component={HomeScreen} options={{title: 'My Team'}}/>
            <Tab.Screen name={ROUTES.scores} component={ScoresScreen} options={{title: 'Scores'}}/>
            <Tab.Screen name={ROUTES.standings} component={StandingsScreen} options={{title: 'Standings'}}/>
            <Tab.Screen name={ROUTES.players} component={PlayersScreen} options={{title: 'Players'}}/>
            <Tab.Screen name={ROUTES.settings} component={SettingsScreen} options={{title: 'Settings'}}/>
        </Tab.Navigator>
    );
}

function RootNavigator() {
    const theme = useAppTheme();
    const {team, ready} = useFavoriteTeam();
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
            <NavigationContainer theme={theme.navigation}>
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
                        </>
                    )}
                </Stack.Navigator>
            </NavigationContainer>
        </View>
    );
}

export default function App() {
    return (
        <GestureHandlerRootView style={{flex: 1}}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <FavoriteTeamProvider>
                        <RootNavigator/>
                    </FavoriteTeamProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
