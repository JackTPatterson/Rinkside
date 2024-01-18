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
import {useTheme} from "@react-navigation/native";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {StatusBar} from "expo-status-bar";
import {ArrowDown2, ArrowLeft, ArrowRight} from "iconsax-react-native";
import {Skeleton} from "moti/skeleton";
import Papa from "papaparse";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {LineChart} from "react-native-chart-kit";
import {GestureHandlerRootView} from "react-native-gesture-handler";

import Svg, {Path} from "react-native-svg";
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

    function accumulateArrayValues(inputArray) {
        let resultArray = [];
        let sum = 0;

        for (let i = 0; i < inputArray.length; i++) {
            sum += inputArray[i];
            resultArray.push(sum);
        }

        return resultArray;
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
    const bottomSheetRef2 = useRef(null);

    const snapPoints = useMemo(() => ['90%'], []);

    const [selectedPlayer, setSelectedPlayer] = useState(null)


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

            onLongPress={() => {
                bottomSheetRef.current.expand()
                Haptics.impactAsync()
                    fetch(`https://api-web.nhle.com/v1/player/${rank.playerId}/landing`, requestOptions)
                        .then(response => response.text())
                        .then(result => {
                            setSelectedPlayer(JSON.parse(result))
                        });
            }}

            style={{
                backgroundColor: colors.card,
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
                <Text style={{color: colors.text, fontSize: 24, fontFamily: 'Sora_500Medium'}}>{page + 1 + props.i}</Text>
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
                            color: colors.text,
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
                                    color: colors.text,
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
                                        color: colors.text,
                                        opacity: .5,
                                        fontSize: 16,
                                        marginRight: 10,
                                        fontFamily: 'Sora_500Medium'
                                    }}>Assists:
                                    </Text>
                                    <Text style={{
                                        color: colors.text,
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
                                        color: colors.text,
                                        opacity: .5,
                                        fontSize: 16,
                                        marginRight: 10,
                                        fontFamily: 'Sora_500Medium'
                                    }}>Pts:
                                    </Text>
                                    <Text style={{
                                        color: colors.text,
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

    const { colors } = useTheme();


    const styles = StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100%',
            backgroundColor: colors.background,
            paddingHorizontal: 10
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

    const [selectedStat, setSelectedStat] = useState("goals")

    if (!fontsLoaded) {
        return <></>
    } else return (
        <GestureHandlerRootView>
            <View style={styles.container}>
                <SafeAreaView style={{width: '100%'}}>

                    <Text style={{fontFamily: 'Sora_600SemiBold', marginBottom: 10, fontSize: 24, color: colors.text}}>Player Rankings</Text>

                    <View>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            marginBottom: 20,
                            marginTop: 10
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
                                            fontSize: 24,
                                            color: colors.text,
                                        }}>Ranks {page + 1} - {page + 10}</Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end'
                                        }}>
                                            {page > 0 &&
                                                <TouchableOpacity onPress={() => {
                                                    setPage(page => page - 10)
                                                    getPlayerData(0, page - 10)
                                                    Haptics.selectionAsync()
                                                }} style={{
                                                    backgroundColor: colors.card,
                                                    marginRight: 10,
                                                    paddingHorizontal: 15,
                                                    paddingVertical: 15,
                                                    borderRadius: 100
                                                }}>
                                                    <ArrowLeft color={colors.text}/>
                                                </TouchableOpacity>}

                                            <TouchableOpacity onPress={() => {
                                                setPage(page => page + 10)
                                                getPlayerData(0, page + 10)
                                                Haptics.selectionAsync()
                                            }} style={{
                                                backgroundColor: colors.card,
                                                paddingHorizontal: 15,
                                                paddingVertical: 15,
                                                borderRadius: 100
                                            }}>
                                                <ArrowRight color={colors.text}/>
                                            </TouchableOpacity>
                                        </View>


                                    </View>
                                    {
                                        data.length ? data.map((rank, i) => {
                                            return <Player i={i} rank={rank}/>
                                        }) : <View style={{gap: 10}}>
                                            <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'} width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                                            <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'} width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                                            <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'} width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                                        </View>
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
                                            fontSize: 24,
                                            color: colors.text,
                                        }}>Ranks {page + 1} - {page + 10}</Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end'
                                        }}>
                                            {page > 0 &&
                                                <TouchableOpacity onPress={() => {
                                                    setPage(page => page - 10)
                                                    getPlayerData(1, page - 10)
                                                    Haptics.selectionAsync()
                                                }} style={{
                                                    backgroundColor: colors.card,
                                                    marginRight: 10,
                                                    paddingHorizontal: 15,
                                                    paddingVertical: 15,
                                                    borderRadius: 100
                                                }}>
                                                    <ArrowLeft color={colors.text}/>
                                                </TouchableOpacity> }
                                            <TouchableOpacity onPress={() => {
                                                setPage(page => page + 10)
                                                getPlayerData(1, page + 10)
                                                Haptics.selectionAsync()
                                            }} style={{
                                                backgroundColor: colors.card,
                                                paddingHorizontal: 15,
                                                paddingVertical: 15,
                                                borderRadius: 100
                                            }}>
                                                <ArrowRight color={colors.text}/>
                                            </TouchableOpacity>
                                        </View>


                                    </View>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center'}}>
                                        <Text style={{
                                           color: colors.text,
                                            opacity: .5,
                                            fontSize: 16,
                                            marginRight: 10,
                                            fontFamily: 'Sora_500Medium'
                                        }}>Showing:
                                        </Text>
                                        <Text style={{
                                           color: colors.text,
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
                                                    backgroundColor: colors.card,
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
                                                       color: colors.text,
                                                        fontSize: 24,
                                                        fontFamily: 'Sora_500Medium',
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
                                                           color: colors.text,
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
                                                                   color: colors.text,
                                                                    opacity: .5,
                                                                    fontSize: 16,
                                                                    marginRight: 10,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>GSAA:
                                                                </Text>
                                                                <Text style={{
                                                                   color: colors.text,
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
                                                                   color: colors.text,
                                                                    opacity: .5,
                                                                    fontSize: 16,
                                                                    marginRight: 10,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>SV%:
                                                                </Text>
                                                                <Text style={{
                                                                   color: colors.text,
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
                                                                   color: colors.text,
                                                                    opacity: .5,
                                                                    fontSize: 16,
                                                                    marginRight: 10,
                                                                    fontFamily: 'Sora_500Medium'
                                                                }}>GSAx:
                                                                </Text>
                                                                <Text style={{
                                                                   color: colors.text,
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
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    style={{
                        paddingHorizontal: 20
                    }}
                    backgroundStyle={{
                        backgroundColor: colors.background
                    }}
                >
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
                                <Image style={{
                                    borderRadius: 100,
                                    borderWidth: 3,
                                    height: 80,
                                    width: 80,
                                    marginRight: 20,
                                    borderColor: `${getPCTColor(selectedPlayer?.currentTeamAbbrev)}`,
                                    backgroundColor: colors.card
                                }} source={{uri: selectedPlayer?.headshot}}/>
                                <Text style={{
                                    fontSize: 24,
                                    fontFamily: 'Sora_600SemiBold',
                                    textAlign: 'center',
                                    color: colors.text
                                }}>{selectedPlayer?.firstName.default} {selectedPlayer?.lastName.default}</Text>
                            </View>

                            <View style={{backgroundColor: 'black', borderRadius: 100}}>
                                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                     xmlns="http://www.w3.org/2000/svg">
                                    <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
                                </Svg>
                            </View>

                        </View>
                        <Text style={{
                           color: colors.text,
                            marginTop: 10,
                            fontSize: 16,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Career
                        </Text>
                        <View style={{
                            flexDirection: "row",
                            width: '100%',
                            alignItems: 'center',
                            marginBottom: 10,
                            gap: 10,
                            marginTop: 10,
                            justifyContent: 'flex-start'
                        }}>
                            <View style={{backgroundColor: colors.card, width: (Dimensions.get('window').width / 3) - 20,  paddingVertical: 15, paddingLeft: 20, borderRadius: 10}}>
                            <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 24,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                {selectedPlayer?.careerTotals.regularSeason.goals + selectedPlayer?.careerTotals.playoffs.goals}
                                </Text>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>Goals</Text>
                            </View>
                            <View style={{backgroundColor: colors.card, width: (Dimensions.get('window').width / 3) - 20,  paddingVertical: 15, paddingLeft: 20, borderRadius: 10}}>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 24,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.careerTotals.regularSeason.assists + selectedPlayer?.careerTotals.playoffs.assists}
                                </Text>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>Assists</Text>
                            </View>
                            <View style={{backgroundColor: colors.card, width: (Dimensions.get('window').width / 3) - 20,  paddingVertical: 15, paddingLeft: 20, borderRadius: 10}}>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 24,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.careerTotals.regularSeason.points + selectedPlayer?.careerTotals.playoffs.points}
                                </Text>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>Points</Text>
                            </View>

                        </View>
                        <View style={{
                            flexDirection: "row",
                            width: '100%',
                            alignItems: 'center',
                            marginBottom: 10,
                            gap: 10,
                            justifyContent: 'flex-start'
                        }}>
                            <View style={{backgroundColor: colors.card, width: (Dimensions.get('window').width / 3) - 20,  paddingVertical: 15, paddingLeft: 20, borderRadius: 10}}>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 24,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.careerTotals.regularSeason.plusMinus}
                                </Text>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>+/-</Text>
                            </View>
                            <View style={{backgroundColor: colors.card, width: (Dimensions.get('window').width / 3) - 20,  paddingVertical: 15, paddingLeft: 20, borderRadius: 10}}>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 24,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.careerTotals.regularSeason.shots}
                                </Text>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>Shots</Text>
                            </View>
                            <View style={{backgroundColor: colors.card, width: (Dimensions.get('window').width / 3) - 20,  paddingVertical: 15, paddingLeft: 20, borderRadius: 10}}>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 24,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.careerTotals.regularSeason.gamesPlayed}
                                </Text>
                                <Text style={{
                                   color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>Games</Text>
                            </View>

                        </View>
                        <Text style={{
                           color: colors.text,
                            marginTop: 10,
                            fontSize: 16,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Last 5 Games
                        </Text>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10}}>
                            <TouchableOpacity onPress={() => {
                                Haptics.selectionAsync().then(() => {
                                })
                                bottomSheetRef2.current.expand()
                            }} style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: colors.card,
                                borderRadius: 100,
                                alignSelf: 'flex-start',
                                paddingHorizontal: 10,
                                paddingVertical: 3
                            }}>
                                <Text style={{
                                   color: colors.text,
                                    fontSize: 16,
                                    fontFamily: 'Sora_500Medium'
                                }}>{selectedStat.charAt(0).toUpperCase() + selectedStat.slice(1)}
                                </Text>
                                <ArrowDown2 color={colors.text} size={16}/>

                            </TouchableOpacity>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_700Bold'

                            }}  duration={250}>
                                {selectedPlayer ? accumulateArrayValues(selectedPlayer?.last5Games.map((r, i) => {
                                    return isNaN(parseInt(r[`${selectedStat}`])) ? 0 : parseInt(r[`${selectedStat}`])
                                }))[4] : 0}
                            </Text>


                        </View>

                        {selectedPlayer &&
                            <LineChart
                                data={{
                                    labels: ["Game 1", "Game 2", "Game 3", "Game 4", "Game 5"],
                                    datasets: [
                                        {
                                            color: (opacity) => `${getPCTColor(selectedPlayer?.currentTeamAbbrev)}`,
                                            strokeWidth: 2.5,
                                            data: selectedPlayer?.last5Games.map((r, i) => {
                                                return isNaN(parseInt(r[`${selectedStat}`])) ? 0 : parseInt(r[`${selectedStat}`])
                                            })
                                        }
                                    ],
                                }}

                                width={Dimensions.get("window").width}
                                height={150}
                                yLabelsOffset={20}
                                xLabelsOffset={-5}

                                withHorizontalLines={true}
                                withVerticalLines={false}
                                withDots={false}
                                withShadow
                                chartConfig={{
                                    backgroundColor: `rgba(255, 255, 255, 0)`,
                                    useShadowColorFromDataset: true,
                                    fillShadowGradientFromOpacity: 0,
                                    fillShadowGradientToOpacity: 0,
                                    backgroundGradientFrom: '#fff',
                                    backgroundGradientFromOpacity: 0,
                                    backgroundGradientTo: "#fff",
                                    backgroundGradientToOpacity: 0,
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                    labelColor: () =>  colors.text,
                                    strokeWidth: 3,
                                }}
                                bezier
                                yAxisInterval={2}
                                style={{
                                    marginVertical: 8,
                                    marginLeft: -30,
                                }}
                            />}


                    </View>

                </BottomSheet>
                <BottomSheet

                    ref={bottomSheetRef2}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    style={{
                        paddingHorizontal: 20
                    }}
                    backgroundStyle={{
                        backgroundColor: colors.background
                    }}
                >
                    <View style={{flexDirection: 'column', gap: 20}}>
                        <Text style={{
                           color: colors.text,
                            fontSize: 24,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Select A Stat
                        </Text>

                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("goals")
                            bottomSheetRef2.current.collapse()
                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>Goals
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("assists")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>Assists
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("points")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>Points
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("shots")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>Shots
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("pim")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>PIM
                            </Text></TouchableOpacity>

                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("powerPlayGoals")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>PPG
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("shorthandedGoals")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>SHG
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("plusMinus")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>+/-
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelectedStat("shifts")
                            bottomSheetRef2.current.collapse()

                        }}>
                            <Text style={{
                               color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>Shifts
                            </Text></TouchableOpacity>

                    </View>

                </BottomSheet>


            </View>
        </GestureHandlerRootView>
    );


}
