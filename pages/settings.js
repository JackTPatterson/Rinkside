import AsyncStorage from "@react-native-async-storage/async-storage";
import {NavigationContainer, useTheme} from "@react-navigation/native";
import {createStackNavigator} from "@react-navigation/stack";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {ArrowLeft, ArrowRight, InfoCircle, TickCircle, User} from "iconsax-react-native";
import {useEffect, useState} from "react";
import {
    Appearance,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import {teamAbbreviations, teamAbbreviationsWithLightImages} from "../helpers/assetsLoader";
import {getTeamColor} from "../helpers/UI";
import teamData from "../teams";

const Developed = ({navigation}) => {

    const {colors} = useTheme()

    const styles = StyleSheet.create({
        container: {
            backgroundColor: colors.background,
            height: '100%',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 10
        }
    })


    return <SafeAreaView style={{width: '100%', position: 'relative', backgroundColor: colors.background}}>
        <View
            style={styles.container}>
            <View>
                <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center'}}>
                    <TouchableOpacity onPress={() => {
                        navigation.goBack()
                        Haptics.selectionAsync()
                    }} style={{
                        backgroundColor: colors.card,
                        marginRight: 15,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 100
                    }}>
                        <ArrowLeft color={colors.text}/>
                    </TouchableOpacity>
                    <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 24, color: colors.text}}>App / Data
                        Info</Text>

                </View>
                <ScrollView>
                    <Text style={{
                        textAlign: 'left',
                        fontFamily: 'Sora_500Medium',
                        fontSize: 16,
                        marginTop: 10,
                        lineHeight: 25,
                        color: colors.text
                    }}>
                        This app was developed by Jack Patterson
                    </Text>
                    <Text style={{
                        textAlign: 'left',
                        fontFamily: 'Sora_500Medium',
                        fontSize: 16,
                        marginTop: 10,
                        lineHeight: 25,
                        color: colors.text
                    }}>
                        Email: jtpatt03@gmail.com
                    </Text>
                    <Text style={{
                        textAlign: 'left',
                        fontFamily: 'Sora_500Medium',
                        fontSize: 16,
                        marginTop: 10,
                        lineHeight: 25,
                        color: colors.text
                    }}>
                        The data displayed on this app is collected and maintained by the sites listed below. I do not
                        own any of it:
                    </Text>
                    <Image height={100} style={{marginTop: 20, backgroundColor: 'white'}}
                           width={Dimensions.get('window').width - 20}
                           source={{uri: "data:image/png;base64,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"}}/>
                    <Image height={350} style={{marginTop: 20}} width={Dimensions.get('window').width - 20}
                           source={{uri: "https://peter-tanner.com/moneypuck/logos/moneypucklogo.png"}}/>
                    <Image height={100} style={{marginTop: 20}} width={Dimensions.get('window').width - 20}
                           source={{uri: "https://yt3.googleusercontent.com/9-X2qpMCwb5maeeZPoE51a10hq2T6OaTTAT7ykDRXzfmWnE0IqAoxI2tRewnCKI8QZxxdMLjdg=w2120-fcrop64=1,00000000ffffffff-k-c0xffffffff-no-nd-rj"}}/>
                </ScrollView>

            </View>
        </View>

    </SafeAreaView>
}

const FavTeam = ({navigation}) => {

    const {colors} = useTheme()


    const storeData = async (value) => {
        try {
            await AsyncStorage.setItem('team', value);
        } catch (e) {
        }
    };


    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);


    const styles = StyleSheet.create({
        container: {
            backgroundColor: colors.background,
            height: '100%',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 10
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
            backgroundColor: '#000',
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
            color: 'white',
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
                <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center'}}>

                    <TouchableOpacity onPress={() => {
                        navigation.goBack()
                        Haptics.selectionAsync()
                    }} style={{
                        backgroundColor: colors.card,
                        marginRight: 15,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 100
                    }}>
                        <ArrowLeft color={colors.text}/>
                    </TouchableOpacity>
                    <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 24, color: colors.text}}>Favorite
                        Team</Text>

                </View>
                <Text style={{
                    textAlign: 'left',
                    fontFamily: 'Sora_500Medium',
                    fontSize: 16,
                    marginTop: 10,
                    lineHeight: 25,
                    color: colors.text
                }}>You must restart for selection to take effect</Text>
                <ScrollView style={{paddingTop: 20, width: Dimensions.get('window').width - 20, marginTop: 20}}>
                    {teamData.map((team, i) => {
                        return <TouchableOpacity style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderWidth: 2,
                            borderColor: selectedTeam === team.abbreviation ? getTeamColor(team.abbreviation, colors) : colors.background,
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
                                <TickCircle variant={"Bold"} color={`${getTeamColor(team.abbreviation, colors)}`}/>
                            }
                        </TouchableOpacity>
                    })}
                    <View style={{marginBottom: 100}}/>
                </ScrollView>
            </View>
        </View>


    </SafeAreaView>

}

const Settings = ({navigation}) => {

    const {colors} = useTheme()


    const styles = StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100%',
            backgroundColor: colors.background,
            marginHorizontal: 20
        },
        inactiveButton: {
            backgroundColor: colors.card,
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderRadius: 100,
            marginRight: 10,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center'
        },

        inactiveText: {
            color: colors.text,
            fontFamily: 'Sora_500Medium', textAlign: 'center'
        },

        activeButton: {
            backgroundColor: colors.text,
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderRadius: 100,
            marginRight: 10,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center'
        },

        activeText: {
            color: colors.background,
            fontFamily: 'Sora_600SemiBold', textAlign: 'center'
        }
    });


    return <View style={styles.container}>
        <SafeAreaView style={{width: '100%', position: 'relative'}}>
            <View>
                <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center'}}>
                    <Text style={{
                        fontFamily: 'Sora_600SemiBold',
                        marginBottom: 10,
                        fontSize: 24,
                        color: colors.text
                    }}>Settings</Text>
                </View>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync()
                    navigation.push("FavTeam")
                }} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20}}>
                    <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10}}>
                        <User color={colors.text}/>
                        <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 20, color: colors.text}}>Favorite
                            Team</Text>
                    </View>
                    <View style={{
                        backgroundColor: colors.card,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 100
                    }}>
                        <ArrowRight color={colors.text}/>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync()
                    navigation.push("Dev")
                }} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20}}>
                    <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10}}>
                        <InfoCircle color={colors.text}/>
                        <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 20, color: colors.text}}>App / Data
                            Info</Text>
                    </View>

                    <View style={{
                        backgroundColor: colors.card,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 100
                    }}>
                        <ArrowRight color={colors.text}/>
                    </View>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    </View>
}

export default function SettingsStackManager() {
    const Stack = createStackNavigator();

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

    return (

        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme} independent={true}>

            <Stack.Navigator
                lazy={true}
                optimizationsEnabled={true}
                screenOptions={{
                    headerShown: false,
                    useNativeDriver: false
                }}
                initialRouteName="Settings">
                <Stack.Screen name="Settings" component={Settings}/>
                <Stack.Screen name="FavTeam" component={FavTeam}/>
                <Stack.Screen name="Dev" component={Developed}/>


            </Stack.Navigator>


        </NavigationContainer>
    )

}
