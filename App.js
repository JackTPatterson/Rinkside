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

import {DarkTheme, DefaultTheme, NavigationContainer, useTheme} from "@react-navigation/native";
import {createStackNavigator} from "@react-navigation/stack";
import SettingsStackManager from "./pages/settings/settings";
import {getColor, getBackground} from "./constants";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import {ArrowRight, TickCircle} from "iconsax-react-native";
import React, {useEffect, useState} from "react";
import {
    Dimensions,
    Image,
    LogBox,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import 'react-native-gesture-handler'
import 'react-native-reanimated'
import Svg, {Path} from 'react-native-svg';
import GamesStackManager from "./pages/games_stack_manager";
import Home from "./pages/home";
import Players from "./pages/players";
import Team from "./pages/team"
import teamData from "./teams";
import { Appearance, useColorScheme } from 'react-native';


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
            transform: [{translateX: ((Dimensions.get('window').width / 2)-40)*-1}],
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
            justifyContent: 'center',
        },

        inactiveText: {
            color: 'gray',
            fontFamily: 'Sora_500Medium',
        },

        activeButton: {
            backgroundColor: colors.text,
            left: '50%',
            transform: [{translateX: ((Dimensions.get('window').width / 2)-40)*-1}],
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

    useEffect(()=>{
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
                <ScrollView style={{paddingTop: 20, width: Dimensions.get('window').width - 20}}>
                    {teamData.map((team, i) => {
                        return <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: selectedTeam === team.abbreviation ? team.primary_color : '#000', borderRadius: 15, padding:  selectedTeam === team.abbreviation ? 10: 0}} onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedTeam(team.abbreviation)
                            storeData(team.abbreviation).then(r => {})
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
                                    }} source={assets[teamAbbreviations.indexOf(team.abbreviation)]}/> }

                                <Text style={{fontFamily: 'Sora_500Medium', fontSize: 20, color: colors.text}}>{team.name}</Text>
                            </View>
                            {selectedTeam === team.abbreviation &&
                                <TickCircle variant={"Bold"} color={`${team.primary_color}`}/>
                            }
                        </TouchableOpacity>
                    })}
                    <View style={{marginBottom: 100}}/>
                </ScrollView>
            </View>

            { selectedTeam &&
            <TouchableOpacity style={styles.activeButton}
                              onPress={() => {
                                  Haptics.selectionAsync()
                                  navigation.push("Home")
                              }}>
                <Text style={styles.activeText}>Lets Go</Text>
                <ArrowRight color={colors.background}/>
            </TouchableOpacity>  }
        </View>


    </SafeAreaView>

}

const AppManager = () => {

    const Tab = createBottomTabNavigator();

    const scheme = useColorScheme();

    const DarkTheme = {
        dark: true,
        colors: {
            primary: 'rgb(10, 132, 255)',
            background: 'rgb(1, 1, 1)',
            card: 'rgb(18, 18, 18)',
            text: 'rgb(229, 229, 231)',
            border: 'rgb(39, 39, 41)',
            notification: 'rgb(255, 69, 58)',

        },
    };

    const LightTheme = {
        dark: false,
        colors: {
            primary: 'rgb(0, 122, 255)',
            background: 'white',
            card: '#f7f7f7',
            text: 'rgb(28, 28, 30)',
            border: 'rgb(216, 216, 216)',
            notification: 'rgb(255, 59, 48)',
        },
    };

    const {colors} = useTheme()

    return <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme} independent={true}>
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

                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                 xmlns="http://www.w3.org/2000/svg">
                                <Path
                                    d="M9.02 2.83998L3.63 7.03998C2.73 7.73998 2 9.22998 2 10.36V17.77C2 20.09 3.89 21.99 6.21 21.99H17.79C20.11 21.99 22 20.09 22 17.78V10.5C22 9.28998 21.19 7.73998 20.2 7.04998L14.02 2.71998C12.62 1.73998 10.37 1.78998 9.02 2.83998Z"
                                    stroke={color} strokeWidth={2} stroke-linecap="round" stroke-linejoin="round"/>
                                <Path d="M12 17.99V14.99" stroke={color} strokeWidth={2} stroke-linecap="round"
                                      stroke-linejoin="round"/>
                            </Svg>

                        );
                    }
                    if (route.name === "PO") {
                        return (
                            <Svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                 strokeWidth={1.5} stroke={color} style={{height: 28, width: 28}}>
                                <Path strokeLinecap="round" strokeLinejoin="round"
                                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>
                            </Svg>
                        )
                    }
                    if (route.name === "Games") {
                        return (

                            <Svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width={28}
                                 height={28} strokeWidth={1.5} stroke={color} className="w-7 h-7">
                                <Path strokeLinecap="round" strokeLinejoin="round"
                                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                            </Svg>


                        )
                    }
                    if (route.name === "Players") {
                        return (
                            <Svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none"
                                 viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} className="w-6 h-6">
                                <Path strokeLinecap="round" strokeLinejoin="round"
                                      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
                            </Svg>
                        )
                    }
                    if (route.name === "Settings") {
                        return (
                            <Svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none"
                                 viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} className="w-6 h-6">
                                <Path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </Svg>

                        )
                    }
                },
                tabBarActiveTintColor: scheme === 'light' ? 'black' : 'white',
                tabBarInactiveTintColor: "#aaacae"
            })}
        >
            <Tab.Screen name="Home" component={Team}/>
            <Tab.Screen name="PO" component={Home}/>
            <Tab.Screen name="Players" component={Players}/>
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

    const scheme = useColorScheme();

    const DarkTheme = {
        dark: true,
        colors: {
            primary: 'rgb(10, 132, 255)',
            background: 'rgb(1, 1, 1)',
            card: 'rgb(18, 18, 18)',
            text: 'rgb(229, 229, 231)',
            border: 'rgb(39, 39, 41)',
            notification: 'rgb(255, 69, 58)',

        },
    };

    const LightTheme = {
        dark: false,
        colors: {
            primary: 'rgb(0, 122, 255)',
            background: 'white',
            card: '#f7f7f7',
            text: 'rgb(28, 28, 30)',
            border: 'rgb(216, 216, 216)',
            notification: 'rgb(255, 59, 48)',
        },
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

    if(!fontsLoaded){
        return <></>
    }
    else return (

        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme}>
            <Stack.Navigator initialRouteName={team?.length === 3 ? "Home" : "Onboarding"} screenOptions={({route}) => ({headerShown: false})}>
                <Stack.Screen name="Home" component={AppManager}/>
                <Stack.Screen name="Onboarding" component={Onboarding}/>
            </Stack.Navigator>
        </NavigationContainer>

    )


}


