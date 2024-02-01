import {
    Sora_100Thin,
    Sora_200ExtraLight,
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    useFonts
} from "@expo-google-fonts/sora";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";

import {NavigationContainer, useTheme} from "@react-navigation/native";
import {createStackNavigator} from "@react-navigation/stack";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import {ArrowRight, Brodcast, Chart, Home2, Setting2, TickCircle, User} from "iconsax-react-native";
import React, {useEffect, useState} from "react";
import {
    Appearance,
    Dimensions,
    Image,
    LogBox,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import 'react-native-gesture-handler'
import 'react-native-reanimated'
import GamesStackManager from "./pages/games_stack_manager";
import Home from "./pages/home"
import PlayerStackManager from "./pages/player_stack_manager";
import Rankings from "./pages/rankings";
import SettingsStackManager from "./pages/settings";
import teamData from "./teams";


LogBox.ignoreLogs(['Warning: ...']);
LogBox.ignoreAllLogs();

SplashScreen.preventAutoHideAsync()


export const Onboarding = ({navigation}) => {

    const {colors} = useTheme()


    const storeData = async (value) => {
        try {
            await AsyncStorage.setItem('team', value);
        } catch (e) {
        }
    };

    const teamAbbreviations = [
        "ANA", "ARI", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL",
        "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NSH", "NJD", "NYI", "NYR",
        "OTT", "PHI", "PIT", "STL", "SJS", "SEA", "TBL", "TOR", "VAN", "VGK",
        "WSH", "WPG"
    ];

    const teamAbbreviationsWithLightImages = [
        require("./assets/ANA_light.png"), require("./assets/ARI_light.png"), require("./assets/BOS_light.png"), require("./assets/BUF_light.png"), require("./assets/CGY_light.png"),
        require("./assets/CAR_light.png"), require("./assets/CHI_light.png"), require("./assets/COL_light.png"), require("./assets/CBJ_light.png"), require("./assets/DAL_light.png"),
        require("./assets/DET_light.png"), require("./assets/EDM_light.png"), require("./assets/FLA_light.png"), require("./assets/LAK_light.png"), require("./assets/MIN_light.png"),
        require("./assets/MTL_light.png"), require("./assets/NSH_light.png"), require("./assets/NJD_light.png"), require("./assets/NYI_light.png"), require("./assets/NYR_light.png"),
        require("./assets/OTT_light.png"), require("./assets/PHI_light.png"), require("./assets/PIT_light.png"), require("./assets/STL_light.png"), require("./assets/SJS_light.png"),
        require("./assets/SEA_light.png"), require("./assets/TBL_light.png"), require("./assets/TOR_light.png"), require("./assets/VAN_light.png"), require("./assets/VGK_light.png"),
        require("./assets/WSH_light.png"), require("./assets/WPG_light.png")
    ];

    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);


    const styles = StyleSheet.create({
        container: {
            backgroundColor: colors.background,
            height: '100%',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 20
        },

        inactiveButton: {
            left: '50%',
            transform: [{translateX: ((Dimensions.get('window').width / 2) - 40) * -1}],
            position: 'absolute',
            bottom: 10,
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderRadius: 100,
            marginRight: 10,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            width: '100%',
            justifyContent: 'center'
        },

        inactiveText: {
            color: 'gray',
            fontFamily: 'Sora_500Medium'
        },

        activeButton: {
            backgroundColor: colors.text,
            left: '50%',
            transform: [{translateX: ((Dimensions.get('window').width / 2) - 40) * -1}],
            position: 'absolute',
            bottom: 10,
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderRadius: 100,
            marginRight: 10,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            width: '100%',
            justifyContent: 'center'
        },

        activeText: {
            color: colors.background,
            fontFamily: 'Sora_600SemiBold', textAlign: 'center',
            flexDirection: 'row', alignItems: 'center',
            fontSize: 20
        }

    });

    const [selectedTeam, setSelectedTeam] = useState(null);

    const getData = async () => {
        try {
            const value = await AsyncStorage.getItem('team');
            if (value !== null) {
                setSelectedTeam(value)
            }
        } catch (e) {
            return e

        }
    };

    useEffect(() => {
        getData()
    })

    return <SafeAreaView style={{width: '100%', position: 'relative', backgroundColor: colors.background}}>
        <View
            style={styles.container}>
            <View>
                <Text style={{
                    textAlign: 'left',
                    fontFamily: 'Sora_600SemiBold',
                    fontSize: 30,
                    color: colors.text
                }}>Lets Get Started</Text>
                <Text style={{
                    textAlign: 'left',
                    fontFamily: 'Sora_500Medium',
                    fontSize: 16,
                    marginTop: 5,
                    color: colors.text
                }}>Choose your favorite team</Text>
                <ScrollView style={{paddingTop: 20, width: Dimensions.get('window').width - 20, marginTop: 20}}>
                    {teamData.map((team, i) => {
                        return <TouchableOpacity style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderWidth: 2,
                            width: Dimensions.get('window').width - 40,
                            borderColor: selectedTeam === team.abbreviation ? colors.text === 'rgb(229, 229, 231)' ? team.secondary_color : team.primary_color : colors.background,
                            borderRadius: 15,
                            padding: selectedTeam === team.abbreviation ? 10 : 0
                        }} onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedTeam(team.abbreviation)
                            storeData(team.abbreviation).then(r => {
                            })
                        }}>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'flex-start',
                                alignItems: 'center',
                                marginLeft: -10
                            }}>
                                {assets &&
                                    <Image style={{
                                        height: 50, width: 70, transform: [{scale: .7}], flexDirection: 'column',
                                        justifyContent: 'center'
                                    }} source={assets[teamAbbreviations.indexOf(team.abbreviation)]}/>}

                                <Text style={{
                                    fontFamily: 'Sora_500Medium',
                                    fontSize: 20,
                                    color: colors.text
                                }}>{team.name}</Text>
                            </View>
                            {selectedTeam === team.abbreviation &&
                                <TickCircle variant={"Bold"}
                                            color={colors.text === 'rgb(229, 229, 231)' ? team.secondary_color : team.primary_color}/>
                            }
                        </TouchableOpacity>
                    })}
                    <View style={{marginBottom: 100}}/>
                </ScrollView>

            </View>
            {selectedTeam &&

                <Pressable style={styles.activeButton}
                           onPress={() => {
                               Haptics.selectionAsync()
                               navigation.push("Home")
                           }}>
                    <Text style={styles.activeText}>Lets Go</Text>
                    <ArrowRight color={colors.background}/>
                </Pressable>}


        </View>


    </SafeAreaView>

}

const AppManager = () => {

    const Tab = createBottomTabNavigator();

    const scheme = Appearance.getColorScheme();


    const DarkTheme = {
        dark: true,
        colors: {
            primary: 'rgb(10, 132, 255)',
            background: 'rgb(1, 1, 1)',
            card: 'rgb(18, 18, 18)',
            text: 'rgb(229, 229, 231)',
            border: 'rgb(39, 39, 41)',
            notification: 'rgb(255, 69, 58)'

        }
    };

    const LightTheme = {
        dark: false,
        colors: {
            primary: 'rgb(0, 122, 255)',
            background: 'white',
            card: '#f7f7f7',
            text: 'rgb(28, 28, 30)',
            border: 'rgb(216, 216, 216)',
            notification: 'rgb(255, 59, 48)'
        }
    };

    const {colors} = useTheme()

    return <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme} independent={true}
                                onStateChange={() => {
                                    Haptics.impactAsync()
                                }}>
        <Tab.Navigator
            screenOptions={({route}) => ({

                headerShown: false,
                tabBarStyle: {
                    shadowOffset: {
                        width: 0,
                        height: 0
                    },
                    shadowOpacity: 1,
                    shadowRadius: 1,
                    shadowColor: scheme === 'dark' ? "#555555" : "#d1d1d1",
                    backgroundColor: colors.background,
                    borderTopWidth: 0,
                    height: 100
                },

                tabBarShowLabel: false,
                tabBarIcon: ({focused, color, size}) => {

                    if (route.name === "Home") {
                        return (

                            <View style={{
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Home2 size={22} color={color}/>
                                <Text style={{
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 12, color: color, textAlign: 'center'
                                }}>My Team</Text>
                            </View>


                        );
                    }
                    if (route.name === "PO") {
                        return (
                            <View style={{
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Chart size={22} color={color}/>
                                <Text style={{
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 12, color: color, textAlign: 'center'
                                }}>Rankings</Text>
                            </View>

                        )
                    }
                    if (route.name === "Games") {
                        return (

                            <View style={{
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                <Brodcast color={color} size={28}/>
                                <Text style={{
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 12, color: color, textAlign: 'center'
                                }}>Live Games</Text>
                            </View>


                        )
                    }
                    if (route.name === "Players") {
                        return (
                            <View style={{
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <User color={color} size={22}/>
                                <Text style={{
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 12, color: color, textAlign: 'center'
                                }}>Players</Text>
                            </View>
                        )
                    }
                    if (route.name === "Settings") {
                        return (
                            <View style={{
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Setting2 color={color} size={22}/>
                                <Text style={{
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 12, color: color, textAlign: 'center'
                                }}>Settings</Text>
                            </View>

                        )
                    }
                },
                tabBarActiveTintColor: scheme === 'light' ? 'black' : 'white',
                tabBarInactiveTintColor: "#aaacae"
            })}
        >
            <Tab.Screen name="Home" component={Home}/>
            <Tab.Screen name="PO" component={Rankings}/>
            <Tab.Screen name="Players" component={PlayerStackManager}/>
            <Tab.Screen name="Games" component={GamesStackManager}/>
            <Tab.Screen name="Settings" component={SettingsStackManager}/>
        </Tab.Navigator>
    </NavigationContainer>
}

export default function App() {


    useEffect(() => {
        SplashScreen.hideAsync()
    })

    const Stack = createStackNavigator();

    const scheme = Appearance.getColorScheme();

    const DarkTheme = {
        dark: true,
        colors: {
            primary: 'rgb(10, 132, 255)',
            background: 'rgb(1, 1, 1)',
            card: 'rgb(18, 18, 18)',
            text: 'white',
            border: 'rgb(39, 39, 41)',
            notification: 'rgb(255, 69, 58)'

        }
    };

    const LightTheme = {
        dark: false,
        colors: {
            primary: 'rgb(0, 122, 255)',
            background: 'white',
            card: '#f7f7f7',
            text: 'black',
            border: 'rgb(216, 216, 216)',
            notification: 'rgb(255, 59, 48)'
        }
    };

    const [team, setTeam] = useState(null);

    const getData = async () => {
        try {
            const value = await AsyncStorage.getItem('team');
            if (value !== null) {
                setTeam(value)
            }
        } catch (e) {
            return e

        }
    };

    useEffect(() => {
        getData()
    })


    let [fontsLoaded] = useFonts({
        Sora_600SemiBold,
        Sora_500Medium,
        Sora_400Regular,
        Sora_300Light,
        Sora_200ExtraLight,
        Sora_100Thin,
        Sora_800ExtraBold,
        Sora_700Bold
    })

    if (!fontsLoaded) {
        return <></>
    } else return (

        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme}>
            <Stack.Navigator initialRouteName={team?.length === 3 ? "Home_team" : "Onboarding"}
                             screenOptions={({route}) => ({headerShown: false})}>
                <Stack.Screen name="Home" component={AppManager}/>
                <Stack.Screen name="Onboarding" component={Onboarding}/>
            </Stack.Navigator>
        </NavigationContainer>

    )


}


