import {
    Sora_100Thin,
    Sora_200ExtraLight,
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold,
    useFonts
} from "@expo-google-fonts/sora";
import BottomSheet from "@gorhom/bottom-sheet";
import AppLoading from "expo-app-loading";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {StatusBar} from "expo-status-bar";
import {MotiView} from "moti";
import Papa from "papaparse";
import {useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import * as Progress from 'react-native-progress';

import Svg, {Path, SvgUri} from "react-native-svg";
import teamData from "../teams";
import React from "react";



export default function Home() {
    const [data, setData] = useState([])

    const [tab, setTab] = useState(0);

    let commonConfig = {delimiter: ","};

    useEffect(() => {
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

    const snapPoints = useMemo(() => ['1%', '75%'], []);

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
                            fontSize: 20
                        }}>{props.rnd}</Text>
                        <View style={{backgroundColor: '#f7f7f7', borderRadius: 100}}>
                            <Text style={{
                                textAlign: "left",
                                paddingHorizontal: 15,

                                paddingVertical: 4,
                                fontFamily: 'Sora_500Medium',
                                fontSize: 20
                            }}>{Math.round(pct)}%</Text>
                        </View>
                    </View>

                    <Progress.Bar unfilledColor={'#f7f7f7'} color={getPCTColor(props.teamCode) ?? "black"} borderRadius={100} borderWidth={0} style={{marginVertical: 0}} progress={pct/100} height={10} width={Dimensions.get('window').width - 40} />



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




    const Team = (props) => {

        const rank = props.rank;
        const i = props.i;


        let team = teamData.filter((item) => {
            return (item.abbreviation === rank.teamCode);
        })
        const color = (team[0]?.primary_color)

        let val = !tab ? (parseFloat(rank.madePlayoffs)).toFixed(2) * (Dimensions.get('window').width - 70) : (parseFloat(rank.draftLottery)).toFixed(2) * (Dimensions.get('window').width - 70)

        return rank.scenerio === 'ALL' ?
            <Pressable onPress={props.onClick} key={i}
                       style={{width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                <Text style={{
                    textAlign: 'center',
                    fontFamily: 'Sora_500Medium',
                    marginRight: 10,
                    width: 40
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


                    {val > 100 ?
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
                                marginTop: 10}} source={assets[teamAbbreviations.indexOf(rank.teamCode)]} /></MotiView> : <></>
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
                        color: !tab ? (val > 100 ? 'white' : "black") : 'black',
                        fontSize: 16,
                        top: 20,
                        fontFamily: 'Sora_500Medium'

                    }}>{((parseFloat(!tab ? rank.madePlayoffs : rank.draftLottery)).toFixed(2) * 100) > 0 ? ((parseFloat(!tab ? rank.madePlayoffs : rank.draftLottery)).toFixed(2) * 100) : 0}%</Text>
                </MotiView>
                {val < 100 ?
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
                            }} source={assets[teamAbbreviations.indexOf(rank.teamCode)]} /></MotiView> : <></>
                }
            </Pressable>
            : <></>
    }


    const styles = StyleSheet.create({
        container: {
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingHorizontal: 10
        },

        inactiveButton: {
            backgroundColor: 'transparent', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 100, width: '50%'
        },

        inactiveText: {
            color: 'black',
            fontFamily: 'Sora_500Medium', textAlign: 'center'
        },

        activeButton: {
            backgroundColor: '#000', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 100, width: '50%'
        },

        activeText: {
            color: 'white',
            fontFamily: 'Sora_600SemiBold', textAlign: 'center'
        }

    });

    const [sel, setSel] = useState("NYI");

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
        return <AppLoading/>
    }
    else return (
        <GestureHandlerRootView>
            <View style={styles.container}>


                <SafeAreaView style={{width: '100%'}}>

                    <Text style={{fontFamily: 'Sora_500Medium', marginBottom: 10, fontSize: 24}}>Stats</Text>

                    <View>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 20
                        }}>


                            <Pressable style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                                       onPress={() => {
                                           setTab(0)
                                           Haptics.selectionAsync()
                                       }}>
                                <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Playoff</Text>
                            </Pressable>
                            <Pressable style={tab === 1 ? styles.activeButton : styles.inactiveButton} onPress={() => {
                                setTab(1)
                                Haptics.selectionAsync()
                            }}>
                                <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Draft</Text>
                            </Pressable>
                        </View>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}
                                style={{height: Dimensions.get('window').height - 215}}>
                        <View style={{marginBottom: 5}}>
                            {data?.sort(sort_by(!tab ? 'madePlayoffs' : 'draftLottery', true, parseFloat)).map((rank, i) => {
                                return rank.teamCode === "NYI" ? <Team key={i} onClick={() => {
                                    Haptics.selectionAsync()
                                    setSel(rank)
                                    !tab ? bottomSheetRef.current.expand() : null
                                }} rank={rank} i={0}/> : null
                            })}
                        </View>
                        <View style={{height: 2, backgroundColor: 'black', opacity: .2, width: '100%'}}/>
                        <View style={{marginTop: 10}}>
                            {data?.sort(sort_by(!tab ? 'madePlayoffs' : 'draftLottery', true, parseFloat)).map((rank, i) => {
                                return <Team key={i} onClick={() => {
                                    Haptics.selectionAsync()
                                    setSel(rank)
                                    !tab ? bottomSheetRef.current.expand() : null
                                }} rank={rank} i={i+1}/>
                            })}
                        </View>

                        <View style={{marginBottom: 50}}/>

                    </ScrollView>
                    <StatusBar style="auto"/>
                </SafeAreaView>
                <BottomSheet

                    ref={bottomSheetRef}
                    index={0}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    style={{
                        paddingHorizontal: 20
                    }}

                >
                    <View>
                        <View>

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
                                        textAlign: 'center'
                                    }}>{team[0]?.name}</Text>
                                </View>
                                <View style={{backgroundColor: 'black', borderRadius: 100}}>
                                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                         xmlns="http://www.w3.org/2000/svg">
                                        <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </Svg>
                                </View>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false} horizontal snapToAlignment={"center"}
                                        decelerationRate={0} snapToInterval={Dimensions.get('window').width - 40}>
                                <View style={{width: Dimensions.get('window').width - 40}}>
                                    <Text style={{
                                        fontSize: 20,
                                        fontFamily: 'Sora_500Medium',
                                        textAlign: 'left',
                                        marginBottom: 20
                                    }}>Overall</Text>
                                    <ScrollView style={{height: '100%'}}>
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
                                            marginBottom: 20
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
                                        marginBottom: 20
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
                                        marginBottom: 20
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
                                        marginBottom: 20
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
