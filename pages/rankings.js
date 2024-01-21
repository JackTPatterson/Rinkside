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
import BottomSheet from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {useTheme} from "@react-navigation/native";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {Crown1, Moneys} from "iconsax-react-native";
import {MotiView} from "moti";
import Papa from "papaparse";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import * as Progress from 'react-native-progress';

import Svg, {Path, SvgUri} from "react-native-svg";
import teamData from "../teams";


export default function Rankings() {
    const [data, setData] = useState([])

    const [tab, setTab] = useState(0);

    let commonConfig = {delimiter: ","};

    const [favTeam, setFavTeam] = useState(null);

    const getData = async () => {
        try {
            const value = await AsyncStorage.getItem('team');
            if (value !== null) {
                setFavTeam(value)
            }
        } catch (e) {
            return e

        }
    };

    useEffect(() => {
        if(favTeam){
            getData()
        }
        if(!data.length)
        Papa.parse(
            "https://moneypuck.com/moneypuck/simulations/simulations_recent.csv",
            {
                ...commonConfig,
                header: true,
                download: true,
                complete: (result) => {
                    setData(result.data);
                }
            }
        );
    }, [])

    const sort_by = (field, reverse, primer) => {

        const key = primer ?
            function (x) {
                return primer(x[field])
            } :
            function (x) {
                return x[field]
            };

        reverse = !reverse ? 1 : -1;

        return function (a, b) {
            return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
        }
    }

    function getPCTColor(teamCode) {
        let team = teamData.filter((item) => {
            return (item.abbreviation === teamCode);
        })

        return team[0]?.primary_color;

    }

    const bottomSheetRef = useRef(null);

    const snapPoints = useMemo(() => ['75%'], []);

    const PCTStat = (props) => {

        const pct = parseFloat(props.pct).toFixed(2) * 100


            return (
                <View style={{marginBottom: 20}}>
                    <View style={{
                        flexDirection: 'row',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        borderRadius: '100%',
                        marginBottom: 10
                    }}>
                        <Text style={{
                            textAlign: "left",
                            fontFamily: 'Sora_400Regular',
                            fontSize: 20,
                            color: colors.text
                        }}>{props.rnd}</Text>
                        <View style={{backgroundColor: colors.card, borderRadius: 100}}>
                            <Text style={{
                                textAlign: "left",
                                paddingHorizontal: 15,

                                paddingVertical: 4,
                                fontFamily: 'Sora_500Medium',
                                fontSize: 20,
                                color: colors.text
                            }}>{Math.round(pct)}%</Text>
                        </View>
                    </View>
                    <Progress.Bar unfilledColor={colors.card} color={getPCTColor(props.teamCode) ?? "black"} borderRadius={100} borderWidth={0} style={{marginVertical: 0}} progress={!isNaN(pct/100) ? pct/100 : 0} height={10} width={Dimensions.get('window').width - 40} />
                </View>
            )
    }

    const teamAbbreviations = [
        "ANA", "ARI", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL",
        "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NSH", "NJD", "NYI", "NYR",
        "OTT", "PHI", "PIT", "STL", "SJS", "SEA", "TBL", "TOR", "VAN", "VGK",
        "WSH", "WPG"
    ];

    const teamAbbreviationsWithLightImages = [
        require("../assets/ANA_light.png"), require("../assets/ARI_light.png"), require("../assets/BOS_light.png"), require("../assets/BUF_light.png"), require("../assets/CGY_light.png"),
        require("../assets/CAR_light.png"), require("../assets/CHI_light.png"), require("../assets/COL_light.png"), require("../assets/CBJ_light.png"), require("../assets/DAL_light.png"),
        require("../assets/DET_light.png"), require("../assets/EDM_light.png"), require("../assets/FLA_light.png"), require("../assets/LAK_light.png"), require("../assets/MIN_light.png"),
        require("../assets/MTL_light.png"), require("../assets/NSH_light.png"), require("../assets/NJD_light.png"), require("../assets/NYI_light.png"), require("../assets/NYR_light.png"),
        require("../assets/OTT_light.png"), require("../assets/PHI_light.png"), require("../assets/PIT_light.png"), require("../assets/STL_light.png"), require("../assets/SJS_light.png"),
        require("../assets/SEA_light.png"), require("../assets/TBL_light.png"), require("../assets/TOR_light.png"), require("../assets/VAN_light.png"), require("../assets/VGK_light.png"),
        require("../assets/WSH_light.png"), require("../assets/WPG_light.png")
    ];


    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);

    const { colors } = useTheme();



    const Home = (props) => {

        const rank = props.rank;
        const i = props.i;


        let team = teamData.filter((item) => {
            return (item.abbreviation === rank.teamCode);
        })
        const color = (team[0]?.primary_color)

        let val = !tab ? (parseFloat(rank.madePlayoffs)).toFixed(2) * (Dimensions.get('window').width - 70) : (parseFloat(rank.draftLottery)).toFixed(2) * (Dimensions.get('window').width - 70)

        return rank.scenerio === 'ALL' &&
            <TouchableOpacity onPress={props.onClick} key={i}
                       style={{width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                <Text style={{
                    textAlign: 'center',
                    fontFamily: 'Sora_500Medium',
                    marginRight: 10,
                    width: 40,
                    color: colors.text
                }}>{rank.teamCode}</Text>
                <MotiView from={{
                    width: 0
                }}
                          animate={{
                              width: val
                          }}
                          transition={{
                              type: 'timing',
                              delay: 10 * i,
                              duration: 500
                          }}
                          style={{height: 60, backgroundColor: color ?? "#000", borderRadius: 15, marginRight: 5}}>


                    {val > 100 && rank.teamCode &&
                        <MotiView  from={{
                            opacity: 0,
                            marginLeft: -10,
                        }}
                                   animate={{
                                       opacity: 1,
                                       marginLeft: -0,

                                   }}
                                   transition={{
                                       type: 'timing',
                                       delay: 10 * i + 200,
                                       duration: 500
                                   }}>
                            <Image style={{height: 40, width: 60,  transform: [{scale: .7}],  flexDirection: 'column',
                                justifyContent: 'center',
                                marginLeft: 0,
                                marginTop: 10}} source={assets[teamAbbreviations.indexOf(rank.teamCode)]} /></MotiView>
                    }
                </MotiView>

                <MotiView style={{
                    position: 'absolute',
                    zIndex: 100,
                    left: !tab ? `30%` : "90%",
                    top: '0%'
                }} from={{
                    opacity: 0,
                    left: !tab ? `25%` : "85%"
                }}
                          animate={{
                              opacity: 1,
                              left: !tab ? (val > 100 ? "30%" : '90%') : "90%"

                          }}
                          transition={{
                              type: 'spring',
                              delay: 10 * i + 200,
                              duration: 500
                          }}>
                    <Text style={{
                        textAlign: 'center',
                        color: val < 100 ?  colors.text : 'white',
                        fontSize: 16,
                        top: 20,
                        fontFamily: 'Sora_500Medium'

                    }}>{(( parseFloat(!tab ? rank.madePlayoffs : rank.draftLottery)).toFixed(2) * 100) > 0 ? parseInt((parseFloat(!tab ? rank.madePlayoffs : rank.draftLottery)).toFixed(2) * 100) : 0}%</Text>
                </MotiView>
                {val < 100 && rank.teamCode &&
                    <MotiView  from={{
                        opacity: 0,
                        marginLeft: -10,
                    }}
                               animate={{
                                   opacity: 1,
                                   marginLeft: -0,
                               }}
                               transition={{
                                   type: 'timing',
                                   delay: 10 * i + 200,
                                   duration: 500
                               }}>
                        <Image style={{height: 40, width: 60,  transform: [{scale: .7}],  flexDirection: 'column',
                            justifyContent: 'center',
                            }} source={assets[teamAbbreviations.indexOf(rank.teamCode)]} /></MotiView>
                }
            </TouchableOpacity>

    }


    const styles = StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100%',
            backgroundColor: colors.background
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

    const [sel, setSel] = useState(favTeam ?? "NYI");

    let team = teamData.filter((item) => {
        return (item.abbreviation === sel.teamCode);
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
        <GestureHandlerRootView>
            <View style={styles.container}>

                <SafeAreaView style={{width: '100%'}}>
                    <Text style={{fontFamily: 'Sora_500Medium', marginBottom: 10, fontSize: 24, color: colors.text, marginHorizontal: 10}}>Rankings</Text>
                    <View>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            marginBottom: 20,
                            marginTop: 10, marginHorizontal: 10
                        }}>
                            <TouchableOpacity style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                                       onPress={() => {
                                           setTab(0)
                                           Haptics.selectionAsync()
                                       }}>
                                <Crown1 color={tab === 0 ? colors.background : colors.text}/>

                                <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Playoffs</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={tab === 1 ? styles.activeButton : styles.inactiveButton} onPress={() => {
                                setTab(1)
                                Haptics.selectionAsync()
                            }}>
                                <Moneys color={tab === 1 ? colors.background : colors.text}/>

                                <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Lottery</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}
                                style={{height: Dimensions.get('window').height - 215, marginHorizontal: 10}}>
                        <View style={{marginBottom: 5}}>
                            {data?.sort(sort_by(!tab ? 'madePlayoffs' : 'draftLottery', true, parseFloat)).map((rank, i) => {
                                return rank.teamCode === favTeam ? <Home key={i} onClick={() => {
                                    Haptics.selectionAsync()
                                    setSel(rank)
                                    !tab ? bottomSheetRef.current.expand() : null
                                }} rank={rank} i={0}/> : null
                            })}
                        </View>
                        <View style={{height: 2, backgroundColor: 'black', opacity: .2, width: '100%'}}/>
                        <View style={{marginTop: 10}}>
                            {data?.sort(sort_by(!tab ? 'madePlayoffs' : 'draftLottery', true, parseFloat)).map((rank, i) => {
                                return <Home key={i} onClick={() => {
                                    Haptics.selectionAsync()
                                    setSel(rank)
                                    !tab ? bottomSheetRef.current.expand() : null
                                }} rank={rank} i={i+1}/>
                            })}
                        </View>

                        <View style={{marginBottom: 50}}/>
                    </ScrollView>
                </SafeAreaView>
                <BottomSheet
                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose

                    style={{
                        paddingHorizontal: 20
                    }}
                    backgroundStyle={{
                        backgroundColor: colors.card
                    }}
                >
                    <View  >
                        <View s>
                            <View style={{
                                flexDirection: "row",
                                width: '100%',
                                alignItems: 'center',
                                marginBottom: 10,
                                justifyContent: 'space-between'
                            }}>
                                <View style={{
                                    flexDirection: "row",
                                    width: '100%',
                                    alignItems: 'center',
                                    marginBottom: 0,
                                    justifyContent: 'start'
                                }}>
                                    <SvgUri width={100} height={50} style={{
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        marginLeft: -15
                                    }}
                                            uri={`https://assets.nhle.com/logos/nhl/svg/${sel?.teamCode}_light.svg`}/>
                                    <Text style={{
                                        fontSize: 24,
                                        fontFamily: 'Sora_600SemiBold',
                                        textAlign: 'center',
                                        color: colors.text
                                    }}>{team[0]?.name}</Text>
                                </View>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false} horizontal snapToAlignment={"center"}
                                        decelerationRate={0} snapToInterval={Dimensions.get('window').width - 40}>
                                <View style={{width: Dimensions.get('window').width - 40}}>
                                    <Text style={{
                                        fontSize: 20,
                                        fontFamily: 'Sora_500Medium',
                                        textAlign: 'left',
                                        marginBottom: 20,
                                        color: colors.text
                                    }}>Overall</Text>
                                    <ScrollView style={{height: '100%', marginRight: 10}}>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.madePlayoffs}
                                                 rnd={'Playoff Percentage'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round2} rnd={'Second Round'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round3} rnd={'Third Round'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round4} rnd={'Finals'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.wonCup} rnd={'Won Cup'}/>
                                    </ScrollView>
                                </View>

                                <View style={{width: Dimensions.get('window').width - 40}}>
                                    <ScrollView style={{height: '100%'}}>
                                        <Text style={{
                                            fontSize: 20,
                                            fontFamily: 'Sora_500Medium',
                                            textAlign: 'left',
                                            marginBottom: 20,
                                            color: colors.text
                                        }}>First Round</Text>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round1Winin4} rnd={'Win in 4'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round1Winin5} rnd={'Win in 5'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round1Winin6} rnd={'Win in 6'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round1Winin7} rnd={'Win in 7'}/>
                                    </ScrollView>
                                </View>
                                <View style={{width: Dimensions.get('window').width - 40}}>
                                    <Text style={{
                                        fontSize: 20,
                                        fontFamily: 'Sora_500Medium',
                                        textAlign: 'left',
                                        marginBottom: 20,
                                        color: colors.text
                                    }}>Second Round</Text>
                                    <ScrollView style={{height: '100%'}}>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round2Winin4} rnd={'Win in 4'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round2Winin5} rnd={'Win in 5'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round2Winin6} rnd={'Win in 6'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round2Winin7} rnd={'Win in 7'}/>
                                    </ScrollView>
                                </View>
                                <View style={{width: Dimensions.get('window').width - 40}}>
                                    <Text style={{
                                        fontSize: 20,
                                        fontFamily: 'Sora_500Medium',
                                        textAlign: 'left',
                                        marginBottom: 20,
                                        color: colors.text
                                    }}>Third Round</Text>
                                    <ScrollView style={{height: '100%'}}>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round3Winin4} rnd={'Win in 4'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round3Winin5} rnd={'Win in 5'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round3Winin6} rnd={'Win in 6'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round3Winin7} rnd={'Win in 7'}/>
                                    </ScrollView>
                                </View>
                                <View style={{width: Dimensions.get('window').width - 40}}>
                                    <Text style={{
                                        fontSize: 20,
                                        fontFamily: 'Sora_500Medium',
                                        textAlign: 'left',
                                        marginBottom: 20,
                                        color: colors.text
                                    }}>Finals</Text>
                                    <ScrollView style={{height: '100%'}}>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round4Winin4} rnd={'Win in 4'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round4Winin5} rnd={'Win in 5'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round4Winin6} rnd={'Win in 6'}/>
                                        <PCTStat teamCode={sel.teamCode} pct={sel.round4Winin7} rnd={'Win in 7'}/>
                                    </ScrollView>
                                </View>
                            </ScrollView>


                            {/* Spacer */}
                        </View>
                    </View>
                </BottomSheet>


            </View>
        </GestureHandlerRootView>
    );


}
