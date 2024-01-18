import AsyncStorage from "@react-native-async-storage/async-storage";
import {NavigationContainer, useTheme} from "@react-navigation/native";
import {createStackNavigator} from "@react-navigation/stack";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {ArrowLeft, ArrowRight, InfoCircle, Moon, Sun, Sun1, TickCircle, User} from "iconsax-react-native";
import {useEffect, useState} from "react";
import teamData from "../../teams";
import {
    SafeAreaView,
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    ScrollView, Image, Appearance
} from "react-native";

const Developed = ({navigation}) => {

    const {colors} = useTheme()

    const styles = StyleSheet.create({
        container: {
            backgroundColor: colors.background,
            height: '100%',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 10
        },
    })



    return <SafeAreaView style={{width: '100%', position: 'relative', backgroundColor: colors.background}}>
        <View
            style={styles.container}>
            <View>
                <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center'}}>
                    <TouchableOpacity onPress={() => {
                        navigation.goBack()
                        Haptics.selectionAsync()
                    }} style={{backgroundColor: colors.card, marginRight: 15, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 100}}>
                        <ArrowLeft color={colors.text}/>
                    </TouchableOpacity>
                    <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 24, color: colors.text}}>App / Data Info</Text>

                </View>
                <ScrollView>
                <Text style={{
                    textAlign: 'left',
                    fontFamily: 'Sora_500Medium',
                    fontSize: 16,
                    marginTop: 10,
                    lineHeight: 25,
                    color: colors.text,
                }}>
                    This app was developed by Jack Patterson
                </Text>
                <Text style={{
                    textAlign: 'left',
                    fontFamily: 'Sora_500Medium',
                    fontSize: 16,
                    marginTop: 10,
                    lineHeight: 25,
                    color: colors.text,
                }}>
                    Email: jtpatt03@gmail.com
                </Text>
                <Text style={{
                    textAlign: 'left',
                    fontFamily: 'Sora_500Medium',
                    fontSize: 16,
                    marginTop: 10,
                    lineHeight: 25,
                    color: colors.text,
                }}>
                    The data displayed on this app is collected and maintained by the sites listed below:
                </Text>
                <Image height={100} style={{marginTop: 20}} width={Dimensions.get('window').width - 20} source={{uri: "https://searchvectorlogo.com/wp-content/uploads/2019/08/nhl-com-logo-vector.png"}}/>
                <Image height={350} style={{marginTop: 20}} width={Dimensions.get('window').width - 20} source={{uri: "https://peter-tanner.com/moneypuck/logos/moneypucklogo.png"}}/>
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

    const teamAbbreviations = [
        "ANA", "ARI", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL",
        "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NSH", "NJD", "NYI", "NYR",
        "OTT", "PHI", "PIT", "STL", "SJS", "SEA", "TBL", "TOR", "VAN", "VGK",
        "WSH", "WPG"
    ];

    const teamAbbreviationsWithLightImages = [
        require("../../assets/ANA_light.png"), require("../../assets/ARI_light.png"), require("../../assets/BOS_light.png"), require("../../assets/BUF_light.png"), require("../../assets/CGY_light.png"),
        require("../../assets/CAR_light.png"), require("../../assets/CHI_light.png"), require("../../assets/COL_light.png"), require("../../assets/CBJ_light.png"), require("../../assets/DAL_light.png"),
        require("../../assets/DET_light.png"), require("../../assets/EDM_light.png"), require("../../assets/FLA_light.png"), require("../../assets/LAK_light.png"), require("../../assets/MIN_light.png"),
        require("../../assets/MTL_light.png"), require("../../assets/NSH_light.png"), require("../../assets/NJD_light.png"), require("../../assets/NYI_light.png"), require("../../assets/NYR_light.png"),
        require("../../assets/OTT_light.png"), require("../../assets/PHI_light.png"), require("../../assets/PIT_light.png"), require("../../assets/STL_light.png"), require("../../assets/SJS_light.png"),
        require("../../assets/SEA_light.png"), require("../../assets/TBL_light.png"), require("../../assets/TOR_light.png"), require("../../assets/VAN_light.png"), require("../../assets/VGK_light.png"),
        require("../../assets/WSH_light.png"), require("../../assets/WPG_light.png")
    ];

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
            backgroundColor: '#000',
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

    useEffect(()=>{
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
                    }} style={{backgroundColor: colors.card, marginRight: 15, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 100}}>
                        <ArrowLeft color={colors.text}/>
                    </TouchableOpacity>
                    <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 24, color: colors.text}}>Favorite Team</Text>

                </View>
                <Text style={{
                    textAlign: 'left',
                    fontFamily: 'Sora_500Medium',
                    fontSize: 16,
                    marginTop: 10,
                    lineHeight: 25,
                    color: colors.text,
                }}>You must restart for selection to take effect</Text>
                <ScrollView style={{paddingTop: 20, width: Dimensions.get('window').width - 20, marginTop: 20}}>
                    {teamData.map((team, i) => {
                        return <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: selectedTeam === team.abbreviation ? team.primary_color : colors.background, borderRadius: 15, padding:  selectedTeam === team.abbreviation ? 10: 0}} onPress={() => {
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
                    <Text style={{fontFamily: 'Sora_600SemiBold', marginBottom: 10, fontSize: 24, color: colors.text}}>Settings</Text>
                </View>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync()
                    navigation.push("FavTeam")
                }} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20}}>
                    <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10}}>
                        <User color={colors.text}/>
                        <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 20, color: colors.text}}>Favorite Team</Text>
                    </View>
                    <View  style={{backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 100}}>
                        <ArrowRight color={colors.text}/>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync()
                    navigation.push("Dev")
                }} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20}}>
                    <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10}}>
                        <InfoCircle color={colors.text}/>
                        <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 20, color: colors.text}}>App / Data Info</Text>
                    </View>

                    <View  style={{backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 100}}>
                        <ArrowRight color={colors.text}/>
                    </View>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    </View>
                }

export default function SettingsStackManager(){
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

    return (

        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme} independent={true}>

            <Stack.Navigator
                lazy={true}
                optimizationsEnabled={true}
                screenOptions={{
                    headerShown: false,
                    useNativeDriver: false,
                }}
                initialRouteName="Settings">
                <Stack.Screen name="Settings" component={Settings}/>
                <Stack.Screen name="FavTeam" component={FavTeam}/>
                <Stack.Screen name="Dev" component={Developed}/>



            </Stack.Navigator>


        </NavigationContainer>
    )

}
