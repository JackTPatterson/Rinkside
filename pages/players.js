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
import AppLoading from "expo-app-loading";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {StatusBar} from "expo-status-bar";
import {ArrowLeft, ArrowRight} from "iconsax-react-native";
import Papa from "papaparse";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {
    Dimensions,
    Image,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import * as Progress from 'react-native-progress';

import Svg, {Path, SvgUri} from "react-native-svg";
import teamData from "../teams";


export default function Players() {
    const [data, setData] = useState([])

    const [tab, setTab] = useState(0);

    let commonConfig = {delimiter: ","};

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


    const getPlayerData = (type, pageOffset) => {
        if (type) {
            Papa.parse(
                "https://moneypuck.com/moneypuck/playerData/seasonSummary/2023/regular/goalies.csv",
                {
                    ...commonConfig,
                    header: true,
                    download: true,
                    complete: (result) => {
                        const d = result.data?.filter((d, i) => {
                            return d['situation'] === "all"
                        })
                        d.map((s, i) => {
                            d[i]['GAA'] = s.xGoals - s.goals
                        })

                        const r = d.sort(sort_by('GAA', true, parseFloat)).map((rank, i) => {
                            return rank
                        })


                        setData(r.slice(pageOffset, pageOffset + 10))
                    }
                }
            );
        } else {
            Papa.parse(
                "https://moneypuck.com/moneypuck/playerData/seasonSummary/2023_skaters.csv",
                {
                    ...commonConfig,
                    header: true,
                    download: true,
                    complete: (result) => {
                        const d = result.data?.filter((d, i) => {
                            return d['situation'] === "all"
                        })

                        const r = d.sort(sort_by('I_F_xGoals', true, parseFloat)).map((rank, i) => {
                            return rank
                        })


                        //
                        // r.map((_, i)=>{
                        //     r[i]['stats'] = fetchPlayerStats()
                        // })


                        setData(r.slice(pageOffset, pageOffset + 10))
                    }
                }
            );
        }
    }

    useEffect(() => {
        //needs to be dynamic to year
        getPlayerData(0, 0)

    }, [])


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

                <Progress.Bar unfilledColor={'#f7f7f7'} color={getPCTColor(props.teamCode) ?? "black"}
                              borderRadius={100} borderWidth={0} style={{marginVertical: 0}}
                              progress={!isNaN(pct / 100) ? pct / 100 : 0} height={10}
                              width={Dimensions.get('window').width - 40}/>


            </View>


        )


    }


    const Player = (props) => {

        const rank = props.rank;

        const [data, setData] = useState(null)

        const [sshowing, setSshowing] = useState(2)


        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };


        const getData = () => {
            if(!data){
                fetch(`https://api-web.nhle.com/v1/player/${rank.playerId}/landing`, requestOptions)
                    .then(response => response.text())
                    .then(result => {
                        console.log("test")
                        setData(JSON.parse(result).featuredStats.regularSeason.subSeason)
                    });
            }

        }

        useEffect(() => {
            getData()
        }, [])


        return <TouchableOpacity

            onPress={()=>{
                Haptics.selectionAsync()
                setSshowing(val=>!val ? 1 : val === 2 ? 0 : 2)
            }}


            style={{
                backgroundColor: '#f7f7f7',
                paddingVertical: 15,
                marginBottom: 4,
                borderRadius: 15,
                paddingLeft: 20
            }}>
            <View style={{
                flexDirection: 'row',
                justifyContent: 'flex-left',
                alignItems: 'center'
            }}>
                <Text style={{color: 'black', fontSize: 24, fontFamily: 'Sora_500Medium'}}>{page + 1 + props.i}</Text>
                <View style={{
                    alignItems: 'center'
                }}>

                    <Image style={{
                        height: 50, width: 70, transform: [{scale: .7}], flexDirection: 'column',
                        justifyContent: 'center'
                    }} source={assets[teamAbbreviations.indexOf(rank.team)]}/>
                </View>
                <View>
                    <View>
                        <Text style={{
                            color: 'black',
                            fontSize: 16,
                            fontFamily: 'Sora_500Medium'
                        }}>{rank.name}</Text>
                        {
                            !sshowing ? <View style={{
                                flexDirection: 'row',
                                justifyContent: 'flex-left',
                                alignItems: 'center'
                            }}>


                                <Text style={{
                                    color: 'black',
                                    opacity: .5,
                                    fontSize: 16,
                                    marginRight: 10,
                                    fontFamily: 'Sora_500Medium'
                                }}>Goals:
                                </Text>
                                <Text style={{
                                    color: 'black',
                                    fontSize: 16,
                                    fontFamily: 'Sora_500Medium'
                                }}> {data?.goals}
                                </Text>

                            </View> : sshowing === 1 ? <View  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'flex-left',
                                    alignItems: 'center'
                                }}>
                                    <Text style={{
                                        color: 'black',
                                        opacity: .5,
                                        fontSize: 16,
                                        marginRight: 10,
                                        fontFamily: 'Sora_500Medium'
                                    }}>Assists:
                                    </Text>
                                    <Text style={{
                                        color: 'black',
                                        fontSize: 16,
                                        fontFamily: 'Sora_500Medium'
                                    }}>{data?.assists}
                                    </Text>
                                </View> :
                                <View  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'flex-left',
                                    alignItems: 'center'
                                }}>
                                    <Text style={{
                                        color: 'black',
                                        opacity: .5,
                                        fontSize: 16,
                                        marginRight: 10,
                                        fontFamily: 'Sora_500Medium'
                                    }}>Pts:
                                    </Text>
                                    <Text style={{
                                        color: 'black',
                                        fontSize: 16,
                                        fontFamily: 'Sora_500Medium'
                                    }}>{data?.goals + data?.assists}
                                    </Text>
                                </View>
                        }

                    </View>

                </View>

            </View>

        </TouchableOpacity>

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


    const styles = StyleSheet.create({
        container: {
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingHorizontal: 10
        },

        inactiveButton: {
            backgroundColor: '#f7f7f7', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 100, marginRight: 10, flexDirection: 'row', gap: 10, alignItems: 'center'
        },

        inactiveText: {
            color: 'black',
            fontFamily: 'Sora_500Medium', textAlign: 'center'
        },

        activeButton: {
            backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 100, marginRight: 10, flexDirection: 'row', gap: 10, alignItems: 'center'
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

    const [page, setPage] = useState(0)

    const [gShowing, setGShowing] = useState(2)

    if (!fontsLoaded) {
        return <AppLoading/>
    } else return (
        <GestureHandlerRootView>
            <View style={styles.container}>


                <SafeAreaView style={{width: '100%'}}>

                    <Text style={{fontFamily: 'Sora_600SemiBold', marginBottom: 10, fontSize: 24}}>Stats</Text>

                    <View>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            marginBottom: 20
                        }}>


                            <TouchableOpacity style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                                       onPress={() => {
                                           setTab(0)
                                           Haptics.selectionAsync()
                                           getPlayerData(0, 0)
                                       }}>
                                <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Skaters</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={tab === 1 ? styles.activeButton : styles.inactiveButton} onPress={() => {
                                setTab(1)
                                Haptics.selectionAsync()
                                getPlayerData(1, 0)

                            }}>
                                <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Goalies</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}
                                style={{height: Dimensions.get('window').height - 215}}>

                        <View style={{marginTop: 10}}>

                            {!tab ? <View>
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 20
                                    }}>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 24
                                        }}>Ranks {page + 1} - {page + 10}</Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end'
                                        }}>
                                            {page > 0 ?
                                                <TouchableOpacity onPress={() => {
                                                    setPage(page => page - 10)
                                                    getPlayerData(0, page - 10)
                                                    Haptics.selectionAsync()
                                                }} style={{
                                                    backgroundColor: '#f7f7f7',
                                                    marginRight: 10,
                                                    paddingHorizontal: 15,
                                                    paddingVertical: 15,
                                                    borderRadius: 100
                                                }}>
                                                    <ArrowLeft color={"#000"}/>
                                                </TouchableOpacity> : <></>}

                                            <TouchableOpacity onPress={() => {
                                                setPage(page => page + 10)
                                                getPlayerData(0, page + 10)
                                                Haptics.selectionAsync()
                                            }} style={{
                                                backgroundColor: '#f7f7f7',
                                                paddingHorizontal: 15,
                                                paddingVertical: 15,
                                                borderRadius: 100
                                            }}>
                                                <ArrowRight color={"#000"}/>
                                            </TouchableOpacity>
                                        </View>


                                    </View>
                                    {
                                        data.map((rank, i) => {
                                            return <Player i={i} rank={rank}/>
                                        })
                                    }
                                </View> :
                                <View>

                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 20
                                    }}>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 24
                                        }}>Ranks {page + 1} - {page + 10}</Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end'
                                        }}>
                                            {page > 0 ?
                                                <TouchableOpacity onPress={() => {
                                                    setPage(page => page - 10)
                                                    getPlayerData(1, page - 10)
                                                    Haptics.selectionAsync()
                                                }} style={{
                                                    backgroundColor: '#f7f7f7',
                                                    marginRight: 10,
                                                    paddingHorizontal: 15,
                                                    paddingVertical: 15,
                                                    borderRadius: 100
                                                }}>
                                                    <ArrowLeft color={"#000"}/>
                                                </TouchableOpacity> : <></>}
                                            <TouchableOpacity onPress={() => {
                                                setPage(page => page + 10)
                                                getPlayerData(1, page + 10)
                                                Haptics.selectionAsync()
                                            }} style={{
                                                backgroundColor: '#f7f7f7',
                                                paddingHorizontal: 15,
                                                paddingVertical: 15,
                                                borderRadius: 100
                                            }}>
                                                <ArrowRight color={"#000"}/>
                                            </TouchableOpacity>
                                        </View>


                                    </View>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center'}}>
                                        <Text style={{
                                            color: 'black',
                                            opacity: .5,
                                            fontSize: 16,
                                            marginRight: 10,
                                            fontFamily: 'Sora_500Medium'
                                        }}>Showing:
                                        </Text>
                                        <Text style={{
                                            color: 'black',
                                            fontSize: 16,
                                            fontFamily: 'Sora_500Medium'
                                        }}>{!gShowing ? "Goals Saved Above Average" : gShowing === 2 ? "Save %" : "Goals Saved Above Expected"}
                                        </Text>
                                    </View>
                                    {
                                        data.map((rank, i) => {
                                            return <TouchableOpacity
                                                onPress={()=>{
                                                    Haptics.selectionAsync()
                                                    setGShowing(val=>!val ? 1 : val === 2 ? 0 : 2)
                                                }}
                                                style={{
                                                    backgroundColor: '#f7f7f7',
                                                    marginBottom: 4,
                                                    paddingVertical: 15,
                                                    borderRadius: 15,
                                                    paddingLeft: 20

                                                }}>
                                                <View style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-left',
                                                    alignItems: 'center'
                                                }}>
                                                    <Text style={{
                                                        color: 'black',
                                                        fontSize: 24,
                                                        fontFamily: 'Sora_500Medium'
                                                    }}>{page + 1 + i}</Text>

                                                    <View style={{
                                                        alignItems: 'center'
                                                    }}>

                                                        <Image style={{
                                                            height: 50,
                                                            width: 70,
                                                            transform: [{scale: .7}],
                                                            flexDirection: 'column',
                                                            justifyContent: 'center'
                                                        }} source={assets[teamAbbreviations.indexOf(rank.team)]}/>
                                                    </View>
                                                    <View>
                                                        <Text style={{
                                                            color: 'black',
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_500Medium'
                                                        }}>{rank.name}</Text>
                                                        {
                                                            !gShowing ? <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-left',
                                                                alignItems: 'center'
                                                            }}>


                                                                <Text style={{
                                                                    color: 'black',
                                                                    opacity: .5,
                                                                    fontSize: 16,
                                                                    marginRight: 10,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>GSAA:
                                                                </Text>
                                                                <Text style={{
                                                                    color: 'black',
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>{((rank.goals*60)/(rank.icetime/60).toFixed(2)).toFixed(3)}
                                                                </Text>

                                                            </View> : gShowing === 2 ? <View  style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-left',
                                                                alignItems: 'center'
                                                            }}>
                                                                <Text style={{
                                                                    color: 'black',
                                                                    opacity: .5,
                                                                    fontSize: 16,
                                                                    marginRight: 10,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>SV%:
                                                                </Text>
                                                                <Text style={{
                                                                    color: 'black',
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>{((rank.ongoal - rank.goals) / rank.ongoal).toFixed(3)}
                                                                </Text>
                                                                </View> :
                                                                <View  style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-left',
                                                                alignItems: 'center'
                                                            }}>
                                                                <Text style={{
                                                                    color: 'black',
                                                                    opacity: .5,
                                                                    fontSize: 16,
                                                                    marginRight: 10,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>GSAx:
                                                                </Text>
                                                                <Text style={{
                                                                    color: 'black',
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>{(rank.xGoals - rank.goals).toFixed(2)}
                                                                </Text>
                                                            </View>
                                                        }

                                                    </View>

                                                </View>

                                            </TouchableOpacity>
                                        })
                                    }
                                </View>}
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
                                        <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
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
