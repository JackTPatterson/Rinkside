import {
    Sora_100Thin,
    Sora_200ExtraLight,
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold, useFonts
} from "@expo-google-fonts/sora";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";

import {NavigationContainer} from "@react-navigation/native";
import AppLoading from "expo-app-loading";
import React, {useState} from "react";
import {LogBox} from 'react-native';
import 'react-native-gesture-handler'
import 'react-native-reanimated'
import Svg, {Path} from 'react-native-svg';
import GamesStackManager from "./pages/games_stack_manager";
import Home from "./pages/home";
import Team from "./pages/team"

LogBox.ignoreLogs(['Warning: ...']);
LogBox.ignoreAllLogs();



export default function App() {

    const Tab = createBottomTabNavigator();


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
        return <AppLoading/>
    }
    else return (
        <NavigationContainer independent={true}>
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
                        shadowColor: "#d1d1d1",
                        backgroundColor: "#fff",
                        borderTopWidth: 0,
                        height: 100
                    },

                    tabBarShowLabel: false,
                    tabBarIcon: ({focused, color, size}) => {

                        // You can return any component that you like here!
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

                                <Svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{height: 28, width: 28}}>
                                    <Path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                                </Svg>





                            )
                        }
                        if (route.name === "Games") {
                            return (

                                <Svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6">
                                    <Path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                                </Svg>

                            )
                        }
                        if (route.name === "Business") {
                            return (

                                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                     xmlns="http://www.w3.org/2000/svg">
                                    <Path
                                        d="M12 13.4299C13.7231 13.4299 15.12 12.0331 15.12 10.3099C15.12 8.58681 13.7231 7.18994 12 7.18994C10.2769 7.18994 8.88 8.58681 8.88 10.3099C8.88 12.0331 10.2769 13.4299 12 13.4299Z"
                                        stroke={color} strokeWidth={2}/>
                                    <Path
                                        d="M3.62001 8.49C5.59001 -0.169998 18.42 -0.159997 20.38 8.5C21.53 13.58 18.37 17.88 15.6 20.54C13.59 22.48 10.41 22.48 8.39001 20.54C5.63001 17.88 2.47001 13.57 3.62001 8.49Z"
                                        stroke={color} strokeWidth={2}/>
                                </Svg>

                            )
                        }
                    },
                    tabBarActiveTintColor: "black",
                    tabBarInactiveTintColor: "#aaacae"
                })}
            >
                <Tab.Screen name="Home" component={Team}/>
                <Tab.Screen name="PO" component={Home}/>

                <Tab.Screen name="Games" component={GamesStackManager}/>
            </Tab.Navigator>
        </NavigationContainer>
    )


}


