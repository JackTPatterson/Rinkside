import BottomSheet from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {useRoute, useTheme} from "@react-navigation/native";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import * as Linking from 'expo-linking';
import {
    ArrowDown2,
    ArrowLeft,
    Chart2,
    Forbidden,
    Map1,
    Radio,
    Star1,
    User,
    UserRemove,
    VideoCircle
} from "iconsax-react-native";
import {MotiText, MotiView} from "moti";
import {Skeleton} from "moti/skeleton";
import Papa from "papaparse";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Progress from 'react-native-progress';
import Svg, {Circle, Line} from "react-native-svg";
import {Row, Table} from 'react-native-table-component';
import DataLineChart from "../components/Chart";
import {PlayerSkeleton} from "../components/Skeleton";
import {teamAbbreviations, teamAbbreviationsWithLightImages} from "../helpers/assetsLoader";
import {hyphenToCapitalizedWords, sort_by} from "../helpers/dataHandlers";
import {getTeamColor} from "../helpers/UI";
import teamData from '../teams';

export default function GamesDetail({navigation}) {


    const bottomSheetRef2 = useRef()
    const snapPoints = useMemo(() => ['90%'], []);
    const snapPoints2 = useMemo(() => ['30%'], []);


    const {colors} = useTheme()

    const route = useRoute()

    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);

    const [teamWon, setTeamWon] = useState(null)

    const [stat, setStat] = useState({home: null, away: null});

    const [sim, setSim] = useState({h: {w: 0, l: 0}, a: {w: 0, l: 0}});


    const [playerStats, setPlayerStats] = useState({h: [], a: [], g: {h: [], a: []}})

    const [scratches, setScratches] = useState({home: [], away: []})
    const [shotsP, setShotsP] = useState({totalH: 0, totalA: 0, h: [], a: []});

    const [goals, setGoals] = useState(null)
    const [penalties, setPenalties] = useState(null);


    const [mapStats, setMapStats] = useState([])
    const [mapStatsSel, setMapStatsSel] = useState("")
    const [eventSel, setEventSel] = useState("")

    const [matchData, setMatchData] = useState(null);
    const [ppData, setPPData] = useState({t: 0, code: "1551"});

    const [winData, setWinData] = useState([{pct: 0, event: "", team: ""}]);

    const [fullData, setFullData] = useState(null);

    // const [playByPlay, setPlayByPlay] = useState([{}]);

    const [isReg, setIsReg] = useState(true);

    const [gameState, setGameState] = useState({
        type: "LIVE",
        TR: "20:00",
        isINT: false,
        period: 1,
        endPeriod: 3,
        endType: null
    });


    const [homeStat, setHomeStat] = useState(true);
    const [landing, setLanding] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [selP, setSelP] = useState(0);
    const [selPP, setSelPP] = useState(false);

    const [tab, setTab] = useState(route.params?.data['data']['goals'] !== undefined ? 0 : 2);

    // const [selectedEvent, setSelectedEvent] = useState(1);

    const [scrollView, setScrollView] = useState(false);


    const getSavedTeamData = async () => {
        try {
            const value = await AsyncStorage.getItem('team');
            if (value !== null) {
                setTeamWon(value)
            }
        } catch (e) {
            return e
        }
    };


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


    function formatAMPM(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        var strTime = hours + ':' + minutes + ' ' + ampm;
        return strTime;
    }


    const AwayTeamName = teamData.filter((item) => {
        return (item.abbreviation === route.params?.data['data']['awayTeam']['abbrev']);
    })

    const HomeTeamName = teamData.filter((item) => {
        return (item.abbreviation === route.params?.data['data']['homeTeam']['abbrev']);
    })


    const commonConfig = {delimiter: ","};


    function mapToPixel(x, y, width, height, elementSize) {
        let halfElementSize = elementSize / 2;
        let pixelX = (x + 100) / 200 * width - halfElementSize;
        let pixelY = (1 - (y + 42.5) / 85) * height - halfElementSize; // Flip y-axis for typical graph orientation
        return {x: pixelX, y: pixelY};
    }

    const getMapData = (type) => {
        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };
        fetch(`https://api-web.nhle.com/v1/gamecenter/${route.params?.data['data']['id']}/play-by-play`, requestOptions)
            .then(response => response.text())
            .then(result => {
                const d = JSON.parse(result).plays.filter(shot => {
                    return shot.typeDescKey === type
                })
                setMapStats(d.map(s => {
                    return {x: s.details.xCoord, y: s.details.yCoord, d: s.details.eventOwnerTeamId}
                }))
            })
    }


    const getData = () => {
        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };


        fetch(`https://api-web.nhle.com/v1/gamecenter/${route.params?.data['data']['id']}/landing`, requestOptions)
            .then(response => response.text())
            .then(result => {

                const res = JSON.parse(result)

                setLanding(res)
                if (res.gameState !== "FUT" && res.gameState !== "PRE") {
                    let g = res.summary?.scoring.flatMap(period => period.goals);
                    setGoals(g)
                    let p = res.summary?.penalties.flatMap(period =>
                        period.penalties.map(goal => ({periodData: period, penaltyData: goal}))
                    );
                    setPenalties(p)
                }

                if (gameState.type !== "PRE" && gameState.type !== "FUT") {

                    console.log(JSON.parse(result).situation)

                    const situation = JSON.parse(result).situation

                    setPPData({
                        t: situation ? situation.timeRemaining : 0,
                        code: situation.situationCode.toString()
                    })
                }


            })

        fetch(`https://api-web.nhle.com/v1/gamecenter/${route.params?.data['data']['id']}/boxscore`, requestOptions)
            .then(response => response.text())
            .then(result => {

                const res = JSON.parse(result)

                setGameState({
                    type: res.gameState,
                    TR: res.clock.timeRemaining,
                    isINT: res.clock.inIntermission,
                    period: res.period,
                    endPeriod: res.gameState === "FINAL" || res.gameState === "OVER" || res.gameState === "OFF" ? res.gameOutcome.otPeriods : 0,
                    endType: (res.gameState === "FINAL" || res.gameState === "OVER" || res.gameState === "OFF" && res.gameOutcome) && res.gameOutcome.lastPeriodType
                })


                const pData = {h: [], a: [], g: {h: [], a: []}}

                if (res.gameState !== "FUT" && res.gameState !== "PRE") {
                    res.boxscore.playerByGameStats.homeTeam.forwards.map(player => {
                        pData.h.push(player)
                    })
                    res.boxscore.playerByGameStats.homeTeam.defense.map(player => {
                        pData.h.push(player)
                    })

                    res.boxscore.playerByGameStats.awayTeam.forwards.map(player => {
                        pData.a.push(player)
                    })
                    res.boxscore.playerByGameStats.awayTeam.defense.map(player => {
                        pData.a.push(player)
                    })


                    res.boxscore.playerByGameStats.homeTeam.goalies.map(player => {
                        pData.g.h.push(player)
                    })
                    res.boxscore.playerByGameStats.awayTeam.goalies.map(player => {
                        pData.g.a.push(player)
                    })

                    if (gameState.type !== "PRE" && gameState.type !== "FUT") {

                        setPlayerStats(pData)


                        setMatchData({home: res['homeTeam'], away: res['awayTeam']})
                        setScratches({
                            home: res.boxscore.gameInfo.homeTeam.scratches,
                            away: res.boxscore.gameInfo.awayTeam.scratches
                        })


                        setShotsP({
                            totalH: 0,
                            totalA: 0,
                            h: res?.boxscore.shotsByPeriod.map((s) => {
                                return s.home
                            }),
                            a: res?.boxscore.shotsByPeriod.map((s) => {
                                return s.away
                            })
                        })
                    }


                }


            })

        getMapData('shot-on-goal')
        getSIMData(0)
    }

    useEffect(() => {
        setMapStatsSel("Shots")
        setEventSel("GOAL")
        getData()
        getSavedTeamData()
    }, [])


    if (matchData) {
        if (!stat.home) {
            if (gameState.type !== "PRE" && gameState.type !== "FUT") {
                Papa.parse(
                    `https://moneypuck.com/moneypuck/gameData/${route.params?.data['data']['season']}/${route.params?.data['data']['id']}.csv`,
                    {
                        ...commonConfig,
                        header: true,
                        download: true,
                        complete: (result) => {
                            const chartData = result.data.map((d, i) => {
                                return {
                                    pct: parseFloat(d?.homeWinProbability) * 100,
                                    event: d?.event,
                                    team: d?.eventDescriptionRaw
                                }
                            })
                            setWinData(chartData)
                            setStat({
                                p: 0,
                                home: (result.data.slice(-2)[0]).homeWinProbability,
                                away: 1 - (result.data.slice(-2)[0]).homeWinProbability
                            });
                            setFullData(result.data.slice(-2)[0])
                        }
                    }
                );
            } else {
                Papa.parse(
                    `https://moneypuck.com/moneypuck/predictions/${route.params?.data['data']['id']}.csv`,
                    {
                        ...commonConfig,
                        header: true,
                        download: true,
                        complete: (result) => {
                            setStat({
                                p: 1,
                                home: parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore),
                                away: 1 - parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore)
                            });
                        }
                    }
                );
            }


        }
    }


    const getSIMData = (type) => {

        Papa.parse(
            "https://moneypuck.com/moneypuck/simulations/simulations_recent.csv",
            {
                ...commonConfig,
                header: true,
                download: true,
                complete: (result) => {
                    const dw = result.data.filter((data, i) => {
                        if (type) {
                            return data['scenerio'] === "WINREG"
                        } else {
                            return data['scenerio'] === "WINOT"
                        }

                    })
                    const dl = result.data.filter((data, i) => {
                        if (type) {
                            return data['scenerio'] === "LOSSREG"
                        } else {
                            return data['scenerio'] === "LOSSOT"
                        }
                    })
                    const hTeamW = dw.filter((data, i) => {
                        return data.teamCode === route.params?.data.data.homeTeam.abbrev
                    })
                    const aTeamW = dw.filter((data, i) => {
                        return data.teamCode === route.params?.data.data.awayTeam.abbrev
                    })

                    const hTeamL = dl.filter((data, i) => {
                        return data.teamCode === route.params?.data.data.homeTeam.abbrev
                    })
                    const aTeamL = dl.filter((data, i) => {
                        return data.teamCode === route.params?.data.data.awayTeam.abbrev
                    })

                    setSim({
                        h: {w: hTeamW[0]['madePlayoffs'], l: hTeamL[0]['madePlayoffs']},
                        a: {w: aTeamW[0]['madePlayoffs'], l: aTeamL[0]['madePlayoffs']}
                    });
                }
            }
        );
    }


    // const parseEvent = (event) => {
    //
    //     switch (event) {
    //         case "FAC":
    //             return "Faceoff Won";
    //         case "SHOT":
    //             return "Shot Taken"
    //         case "TAKE":
    //             return "Takeaway"
    //         case "GIVE":
    //             return "Giveaway"
    //         case "STOP":
    //             return "Play Stopped"
    //         case "BLOCK":
    //             return "Shot Blocked"
    //         case "HIT":
    //             return "Hit"
    //         case "MISS":
    //             return "Shot Missed"
    //         case "GOA":
    //             return "Goalie Stopped"
    //         case "GEND":
    //             return "Game Ended"
    //         case "PEND":
    //             return "Period Ended"
    //         case "GOAL":
    //             return "Goal Scored"
    //         case "GSTR":
    //             return "Game Started"
    //         case "PSTR":
    //             return "Period Started"
    //         case "PENL":
    //             return "Penalty"
    //     }
    //
    //
    //     return event;
    //
    // }


    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => {
            getData()
        }, 2000);
    }, []);


    const landingData = (data) => {
        try {
            return {
                h: parseInt(landing?.summary?.teamGameStats.filter(stat => {
                    return stat.category === data
                })[0].homeValue), a: parseInt(landing?.summary.teamGameStats?.filter(stat => {
                    return stat.category === data
                })[0].awayValue)
            }
        } catch {
            return {h: 0, a: 0}
        }

    }

    const getPPCData = () => {
        try {
            return {
                h: parseFloat(eval(landing?.summary?.teamGameStats.filter(stat => {
                    return stat.category === "powerPlay"
                })[0].homeValue)).toFixed(2), a: parseFloat(eval(landing?.summary.teamGameStats?.filter(stat => {
                    return stat.category === "powerPlay"
                })[0].awayValue)).toFixed(2)
            }
        } catch {
            return {h: 0, a: 0}
        }

    }

    const getPPCDataF = () => {
        try {
            return {
                h: landing?.summary?.teamGameStats.filter(stat => {
                    return stat.category === "powerPlay"
                })[0].homeValue, a: landing?.summary.teamGameStats?.filter(stat => {
                    return stat.category === "powerPlay"
                })[0].awayValue
            }
        } catch {
            return {h: 0, a: 0}
        }

    }


    const handleScroll = (pos) => {
        setScrollView(pos > 100)
    }


    const Player = (props) => {


        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        const [data, setData] = useState(null)


        useEffect(() => {
            fetch(`https://api-web.nhle.com/v1/player/${props.id}/landing`, requestOptions)
                .then(response => response.text())
                .then(result => {
                    setData(JSON.parse(result))
                })


        })


        return <TouchableOpacity onPress={() => {
        }} style={{
            marginBottom: 4,
            width: 100,
            height: 80,
            borderRadius: 100,
            marginHorizontal: 20
        }}>

            <Text style={{
                fontFamily: 'Sora_700Bold',
                fontSize: 16,
                textAlign: 'center',
                width: 100, color: colors.text
            }}></Text>
            <View style={{flexDirection: 'row', justifyContent: 'center'}}>
                {data ?
                    <Image style={{
                        borderRadius: 100,
                        borderWidth: 3,
                        height: 80,
                        width: 80,
                        marginTop: 10,
                        borderColor: `${getTeamColor(data.currentTeamAbbrev, colors)}`,
                        backgroundColor: colors.card
                    }} source={{uri: data.headshot}}/> : <></>}
            </View>

            <Text style={{
                fontFamily: 'Sora_600SemiBold',
                fontSize: 16,
                marginTop: 10,
                textAlign: 'center', color: colors.text
            }}>{props.player.firstName.default}</Text>
            <Text style={{
                fontFamily: 'Sora_600SemiBold',
                fontSize: 16,
                textAlign: 'center', color: colors.text
            }}>{props.player.lastName.default}</Text>

        </TouchableOpacity>
    }

    if (gameState.type === "PRE" || gameState.type === "FUT") {
        if (!landing) {
            return <SafeAreaView style={{width: '100%', position: 'relative', zIndex: 1000}}>
                <MotiView from={{
                    opacity: 1
                }}
                          animate={{
                              opacity: 1
                          }}
                          transition={{
                              type: 'timing',
                              duration: 500
                          }} style={styles.container}>
                    <View style={{flexDirection: 'column', gap: 20}}>
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 10
                            }}>
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

                                <Skeleton width={200} height={40} radius={55}/>
                            </View>


                        </View>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            marginTop: 20,
                            justifyContent: 'center'
                        }}>
                            <View
                                style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>


                                <Skeleton width={60} height={25} radius={55}/>

                                <View style={{marginVertical: 10}}>
                                    <Skeleton width={70} height={70} radius={55}/>

                                </View>


                                <Skeleton width={120} height={20} radius={55}/>
                                <View style={{marginTop: 10}}>
                                    <Skeleton width={120} height={20} radius={55}/>
                                </View>


                            </View>
                            <View style={{flexDirection: 'column', alignItems: 'center', width: '33.3%'}}>
                                <View>
                                    <Skeleton width={60} height={25} radius={55}/>
                                </View>

                                {gameState.type !== "PRE" && gameState.type !== "FUT" ?
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            marginTop: (gameState.type === "FINAL" || gameState.type === "OVER" || gameState.type === "OFF") ? 20 : 40,
                                            width: '100%'
                                        }}>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: 10
                                            }}>
                                            <Skeleton width={30} height={30} radius={55}/>

                                            <View>
                                                <Svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                                                     viewBox="0 0 24 24" fill={colors.text} stroke="currentColor"
                                                     strokeWidth="0" strokeLinecap="round" strokeLinejoin="round"
                                                     className="feather feather-circle"><Circle cx="12" cy="12"
                                                                                                r="10"></Circle></Svg>
                                            </View>
                                            <Skeleton width={30} height={30} radius={55}/>

                                        </View>
                                    </View> : <></>

                                }
                            </View>
                            <View
                                style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>


                                <Skeleton width={60} height={25} radius={55}/>

                                <View style={{marginVertical: 10}}>
                                    <Skeleton width={70} height={70} radius={55}/>

                                </View>


                                <Skeleton width={120} height={20} radius={55}/>
                                <View style={{marginTop: 10}}>
                                    <Skeleton width={120} height={20} radius={55}/>
                                </View>


                            </View>

                        </View>
                        <Skeleton width={Dimensions.get('window').width - 20} height={12}/>
                        <Skeleton width={200} height={50} radius={100}/>
                        <View style={{marginTop: 10}}>
                            <Skeleton width={Dimensions.get('window').width - 20} height={20} radius={100}/>
                            <View style={{marginTop: 10}}>
                                <Skeleton width={Dimensions.get('window').width - 20} height={20} radius={100}/>
                            </View>
                        </View>
                        <View>
                            <Skeleton width={Dimensions.get('window').width - 20} height={20} radius={100}/>
                            <View style={{marginTop: 10}}>
                                <Skeleton width={Dimensions.get('window').width - 20} height={20} radius={100}/>
                            </View>
                        </View>


                    </View>
                </MotiView>
            </SafeAreaView>

        }
    } else {
        if (!matchData || !goals || !stat.home || !penalties || !gameState || !mapStats || !HomeTeamName || !AwayTeamName || !fullData || !route.params?.data.data) {
            return <SafeAreaView style={{width: '100%', position: 'relative', zIndex: 1000}}>
                <MotiView from={{
                    opacity: 1
                }}
                          animate={{
                              opacity: 1
                          }}
                          transition={{
                              type: 'timing',
                              duration: 500
                          }} style={styles.container}>
                    <View style={{flexDirection: 'column', gap: 20}}>
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 10
                            }}>
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

                                <Skeleton width={200} height={40} radius={55}/>
                            </View>


                        </View>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            marginTop: 20,
                            justifyContent: 'center'
                        }}>
                            <View
                                style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>


                                <Skeleton width={60} height={25} radius={55}/>

                                <View style={{marginVertical: 10}}>
                                    <Skeleton width={70} height={70} radius={55}/>

                                </View>


                                <Skeleton width={120} height={20} radius={55}/>
                                <View style={{marginTop: 10}}>
                                    <Skeleton width={120} height={20} radius={55}/>
                                </View>


                            </View>
                            <View style={{flexDirection: 'column', alignItems: 'center', width: '33.3%'}}>
                                <View>
                                    <Skeleton width={60} height={25} radius={55}/>
                                </View>

                                {gameState.type !== "PRE" && gameState.type !== "FUT" ?
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            marginTop: (gameState.type === "FINAL" || gameState.type === "OVER" || gameState.type === "OFF") ? 20 : 40,
                                            width: '100%'
                                        }}>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: 10
                                            }}>
                                            <Skeleton width={30} height={30} radius={55}/>

                                            <View>
                                                <Svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                                                     viewBox="0 0 24 24" fill={colors.text} stroke="currentColor"
                                                     strokeWidth="0" strokeLinecap="round" strokeLinejoin="round"
                                                     className="feather feather-circle"><Circle cx="12" cy="12"
                                                                                                r="10"></Circle></Svg>
                                            </View>
                                            <Skeleton width={30} height={30} radius={55}/>

                                        </View>
                                    </View> : <></>

                                }
                            </View>
                            <View
                                style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>


                                <Skeleton width={60} height={25} radius={55}/>

                                <View style={{marginVertical: 10}}>
                                    <Skeleton width={70} height={70} radius={55}/>

                                </View>


                                <Skeleton width={120} height={20} radius={55}/>
                                <View style={{marginTop: 10}}>
                                    <Skeleton width={120} height={20} radius={55}/>
                                </View>


                            </View>

                        </View>
                        <Skeleton width={Dimensions.get('window').width - 20} height={12}/>
                        <Skeleton width={200} height={50} radius={100}/>
                        <Skeleton width={Dimensions.get('window').width - 20} height={20} radius={100}/>

                        <PlayerSkeleton colors={colors}/>


                    </View>
                </MotiView>
            </SafeAreaView>
        }
    }


    return <MotiView from={{
        opacity: 0
    }}
                     animate={{
                         opacity: (gameState.type === "PRE" || gameState.type === "FUT") ? (!landing ? 0 : 1) : ((!matchData || !goals || !stat.home || !penalties || !gameState || !mapStats || !HomeTeamName || !AwayTeamName || !fullData || !route.params?.data.data) ? 0 : 1)
                     }}
                     transition={{
                         type: 'timing',
                         duration: 500
                     }} style={styles.container}>
        {
            (matchData?.away.score > matchData?.home.score && route.params?.data.data.awayTeam.abbrev === teamWon) || (matchData?.home.score > matchData?.away.score && route.params?.data.data.homeTeam.abbrev === teamWon) ?
                <ConfettiCannon fadeOut count={100}
                                origin={{x: -20, y: -20}}/> : <></>}
        <SafeAreaView style={{width: '100%', position: 'relative'}}>
            <View
                style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
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

                    <View style={{position: 'relative'}}><MotiText

                        from={{
                            opacity: scrollView ? 1 : 0
                        }}
                        animate={{
                            opacity: !scrollView ? 1 : 0

                        }}
                        transition={{
                            type: 'timing',
                            duration: 150
                        }}

                        style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 24, position: 'absolute', top: '50%', transform: [{translateY: -37}]
                        }}><Text style={{
                        fontFamily: 'Sora_600SemiBold',
                        fontSize: 24, color: colors.text
                    }}>{route.params?.data.data.awayTeam.abbrev} @ {route.params?.data.data.homeTeam.abbrev}</Text></MotiText>
                        <MotiView
                            from={{
                                opacity: !scrollView ? 1 : 0
                            }}
                            animate={{
                                opacity: scrollView ? 1 : 0

                            }}
                            transition={{
                                type: 'timing',
                                duration: 150
                            }}
                            style={{
                                position: 'absolute', top: '50%', transform: [{translateY: -37}]
                            }}><Text style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 24, color: colors.text
                        }}>{route.params?.data.data.awayTeam.abbrev} {matchData?.away.score} <Text
                            style={{fontFamily: ""}}>•</Text> {matchData?.home.score} {route.params?.data.data.homeTeam.abbrev}
                        </Text></MotiView></View>
                </View>
                {
                    ((gameState.type === "FINAL" || gameState.type === "OVER" || gameState.type === "OFF") && route.params?.data['data'].threeMinRecap) ?
                        <TouchableOpacity style={{
                            backgroundColor: colors.card,
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 100,
                            marginRight: 10
                        }} onPress={() => {
                            Linking.openURL(`https://www.nhl.com${route.params?.data['data'].threeMinRecap}`).then(() => {
                            })
                            Haptics.selectionAsync()
                        }}>
                            <Text style={styles.inactiveText}>Video Recap</Text>
                        </TouchableOpacity> : gameState.type === "LIVE" || gameState.type === "CRIT" ?
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                                <TouchableOpacity onPress={() => {
                                    Linking.openURL(landing.homeTeam.radioLink).then(r => {
                                    });
                                    Haptics.selectionAsync()
                                }} style={{
                                    backgroundColor: colors.card,
                                    marginRight: 15,
                                    paddingHorizontal: 10,
                                    paddingVertical: 10,
                                    borderRadius: 100
                                }}>
                                    <Text style={{

                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium', color: colors.text, fontSize: 16
                                    }}><Radio color={colors.text}/>
                                    </Text>
                                </TouchableOpacity>
                                <View
                                    style={{
                                        backgroundColor: '#f54242',
                                        paddingVertical: 10,
                                        borderRadius: 15,
                                        paddingHorizontal: 15,
                                        opacity: 1

                                    }}><Text
                                    style={{
                                        color: 'white',
                                        fontFamily: 'Sora_500Medium',
                                        fontSize: 12
                                    }}>LIVE</Text>
                                </View>
                            </View> : <></>
                }
            </View>
            <ScrollView refreshing={refreshing} onRefresh={onRefresh} scrollEventThrottle={16}
                        onScroll={(s) => handleScroll(s.nativeEvent.contentOffset.y)}
                        style={{height: !tab ? 1000 : '100%'}}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, justifyContent: 'center'}}>
                    <View style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>
                        {gameState.type !== "FINAL" && gameState.type !== "OFF" && gameState.type !== "OVER" ?
                            <View style={{backgroundColor: colors.card, borderRadius: 100}}>
                                <Text style={{
                                    textAlign: "left",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium',
                                    fontSize: 20, color: colors.text
                                }}>
                                    {(parseFloat(stat?.home > 0.0 ? stat?.home :
                                        route.params?.data.prob.h) * 100).toFixed(2) >= 99 &&
                                    (parseFloat(stat?.home > 0.0 ? stat?.home : route.params?.data.prob.h) * 100).toFixed(2) < 100 ||
                                    (parseFloat(stat?.home > 0.0 ? stat?.home : route.params?.data.prob.h) * 100).toFixed(2) < 1 &&
                                    (parseFloat(stat?.home > 0.0 ? stat?.home : route.params?.data.prob.h) * 100).toFixed(2) > 0 ?
                                        (parseFloat(stat?.home > 0.0 ? stat?.home : route.params?.data.prob.h) * 100).toFixed(2) :
                                        (parseFloat(stat?.home > 0.0 ? stat?.home : route.params?.data.prob.h) * 100).toFixed(0)}%
                                </Text>
                            </View> : <></>}
                        {assets && <Image style={{
                            height: 70, width: 100, transform: [{scale: .7}], flexDirection: 'column', marginTop: 10,
                            marginLeft: 5,
                            justifyContent: 'center'
                        }}
                                          source={assets[teamAbbreviations.indexOf(route.params?.data['data']['homeTeam']['abbrev'])]}/>}
                        <Text style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 18,
                            textAlign: 'center', color: colors.text
                        }}>{HomeTeamName[0]['name']}</Text>
                        {/*{(ppData.h > ppData.a || (ppData.a === ppData.h && (ppData.a < 5 && ppData.h < 5))) &&*/}
                        {/*    <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>*/}
                        {/*        <Text style={{*/}
                        {/*            textAlign: "left",*/}
                        {/*            paddingHorizontal: 15,*/}
                        {/*            paddingVertical: 4,*/}
                        {/*            fontFamily: 'Sora_500Medium',*/}
                        {/*            fontSize: 20, color: colors.text*/}
                        {/*        }}>{ppData.h} on {ppData.a}</Text>*/}
                        {/*    </View>}*/}
                        {(parseInt(ppData.code[1]) > parseInt(ppData.code[2])) &&
                            <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>
                                <Text style={{
                                    textAlign: "center",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium',
                                    fontSize: 20, color: colors.text
                                }}>{ppData.code[1]} on {ppData.code[2]}</Text>
                            </View>}
                        {(parseInt(ppData?.code[0]) === 0) &&
                            <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>
                                <Text style={{
                                    textAlign: "center",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium',
                                    fontSize: 20, color: colors.text
                                }}>EN</Text>
                            </View>}
                        {parseInt(ppData.code[1]) > parseInt(ppData.code[2]) &&
                            <Text style={{
                                textAlign: "center",
                                fontFamily: 'Sora_400Regular',
                                marginTop: 10,
                                fontSize: 16, color: 'white'
                            }}>{ppData.t}</Text>}

                    </View>
                    <View style={{flexDirection: 'column', alignItems: 'center', width: '33.3%'}}>
                        <View>
                            {gameState.type === "PRE" || gameState.type === "FUT" &&
                                <View style={{
                                    backgroundColor: colors.card,
                                    paddingVertical: 8,
                                    borderRadius: 30,
                                    paddingHorizontal: 15,
                                    marginTop: 70
                                }}>
                                    <Text style={{
                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium', color: colors.text
                                    }}>{formatAMPM(new Date(route.params.data?.data?.startTimeUTC))}</Text>
                                </View>

                            }
                            {
                                !gameState.isINT && (gameState.type === "LIVE" || gameState.type === "CRIT") &&
                                <View style={{
                                    backgroundColor: colors.card,
                                    paddingVertical: 6.5,
                                    borderRadius: 30,
                                    paddingHorizontal: 15
                                }}>
                                    <Text style={{

                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium', color: colors.text, fontSize: 16
                                    }}> {gameState.period <= 3 ? `P${gameState.period} ` : `${gameState.period - 3 > 1 ? gameState.period - 3 : ""}OT `}
                                        <Text style={{fontFamily: ""}}>•</Text> {gameState.TR}</Text>
                                </View>

                            }
                            {
                                (gameState.type === "FINAL" || gameState.type === "OVER" || gameState.type === "OFF") &&
                                <View style={{
                                    backgroundColor: colors.card,
                                    paddingVertical: 6.5,
                                    borderRadius: 30,
                                    paddingHorizontal: 15
                                }}>
                                    <Text style={{

                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium', color: colors.text, fontSize: 16
                                    }}>Final<Text
                                        style={{fontFamily: ""}}> {gameState.endType !== "REG" && "•"}</Text> {gameState.endType !== "REG" && gameState.endType}
                                    </Text>
                                </View>

                            }
                            {
                                gameState.isINT && <View style={{
                                    backgroundColor: colors.card,
                                    paddingVertical: 6.5,
                                    borderRadius: 30,

                                    paddingHorizontal: 15
                                }}>
                                    <Text style={{

                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium', color: colors.text, fontSize: 16
                                    }}>INT <Text style={{fontFamily: ""}}>•</Text> {gameState.TR}</Text>
                                </View>

                            }
                            {
                                (parseInt(ppData.code[1]) === parseInt(ppData.code[2]) && parseInt(ppData.code[1]) < 5) &&
                                <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>
                                    <Text style={{
                                        textAlign: "center",
                                        paddingHorizontal: 15,
                                        paddingVertical: 4,
                                        fontFamily: 'Sora_500Medium', color: 'white',
                                        fontSize: 20
                                    }}>{ppData.code[2]} on {ppData.code[1]}</Text>

                                </View>

                            }

                        </View>

                        {gameState.type !== "PRE" && gameState.type !== "FUT" ?
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    marginTop: (gameState.type === "FINAL" || gameState.type === "OVER" || gameState.type === "OFF") || (parseInt(ppData.code[1]) === parseInt(ppData.code[2]) && parseInt(ppData.code[1]) < 5) ? 20 : 40,
                                    width: '100%'
                                }}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: 10
                                    }}>
                                    <Text
                                        style={{
                                            textAlign: "center",
                                            paddingVertical: 4,
                                            fontFamily: 'Sora_800ExtraBold',
                                            fontSize: 32, color: colors.text
                                        }}>{matchData?.home.score}</Text>
                                    <View>
                                        <Svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                                             viewBox="0 0 24 24" fill={colors.text} stroke="currentColor"
                                             strokeWidth="0" strokeLinecap="round" strokeLinejoin="round"
                                             className="feather feather-circle"><Circle cx="12" cy="12" r="10"></Circle></Svg>
                                    </View>
                                    <Text
                                        style={{
                                            textAlign: "center",
                                            paddingVertical: 4,
                                            fontFamily: 'Sora_800ExtraBold',
                                            fontSize: 32, color: colors.text
                                        }}>{matchData?.away.score}</Text>
                                </View>
                            </View> : <></>

                        }
                    </View>
                    <View
                        style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>
                        {gameState.type !== "FINAL" && gameState.type !== "OFF" && gameState.type !== "OVER" &&
                            <View style={{backgroundColor: colors.card, borderRadius: 100}}>
                                <Text style={{
                                    textAlign: "left",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium',
                                    fontSize: 20, color: colors.text
                                }}>{(parseFloat(stat?.away > 0.0 ? stat?.away :
                                    route.params?.data.prob.a) * 100).toFixed(2) >= 99 &&
                                (parseFloat(stat?.away > 0.0 ? stat?.away : route.params?.data.prob.h) * 100).toFixed(2) < 100 ||
                                (parseFloat(stat?.away > 0.0 ? stat?.away : route.params?.data.prob.h) * 100).toFixed(2) <= 1 &&
                                (parseFloat(stat?.away > 0.0 ? stat?.away : route.params?.data.prob.h) * 100).toFixed(2) > 0 ?
                                    (parseFloat(stat?.away > 0.0 ? stat?.away : route.params?.data.prob.h) * 100).toFixed(2) :
                                    (parseFloat(stat?.away > 0.0 ? stat?.away : route.params?.data.prob.h) * 100).toFixed(0)}%</Text>

                            </View>}
                        {assets &&
                            <Image style={{
                                height: 70, width: 90, transform: [{scale: .7}], flexDirection: 'column', marginTop: 10,
                                marginLeft: 5,
                                justifyContent: 'center'
                            }}
                                   source={assets[teamAbbreviations.indexOf(route.params?.data['data']['awayTeam']['abbrev'])]}/>}
                        <Text style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 18,
                            textAlign: 'center', color: colors.text
                        }}>{AwayTeamName[0]['name']}</Text>
                        {(parseInt(ppData.code[1]) < parseInt(ppData.code[2])) &&
                            <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>
                                <Text style={{
                                    textAlign: "center",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium', color: 'white',
                                    fontSize: 20
                                }}>{ppData.code[2]} on {ppData.code[1]}</Text>

                            </View>}
                        {(parseInt(ppData?.code[3]) === 0) &&
                            <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>
                                <Text style={{
                                    textAlign: "center",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium',
                                    fontSize: 20, color: colors.text
                                }}>EN</Text>
                            </View>}
                        {(parseInt(ppData.code[1]) < parseInt(ppData.code[2])) &&
                            <Text style={{
                                textAlign: "center",
                                fontFamily: 'Sora_400Regular',
                                marginTop: 10,
                                fontSize: 16, color: 'white'
                            }}>{ppData.t}</Text>}

                    </View>

                </View>

                <Progress.Bar color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                              unfilledColor={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                              borderRadius={100}
                              borderWidth={0} style={{marginTop: 20}}
                              progress={gameState.type === "FINAL" || gameState.type === "OFF" || gameState.type === "OVER" ? (matchData?.home.score > matchData?.away.score ? 1 : 0) : stat?.home > 0.0 ? stat?.home : route.params.data.prob.h}
                              height={10}
                              width={Dimensions.get('window').width - 20}/>
                <View style={{marginTop: 20}}>
                    <ScrollView showsHorizontalScrollIndicator={false} horizontal style={{
                        marginBottom: 20
                    }}>
                        {
                            gameState.type !== "FUT" && gameState.type !== "PRE" ?
                                <TouchableOpacity style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                                                  onPress={() => {
                                                      setTab(0)
                                                      Haptics.selectionAsync()
                                                  }}>

                                    <Svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24" height="24"
                                        viewBox="0 0 24 24" fill="none"
                                        stroke={tab === 0 ? colors.background : colors.text} strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="feather feather-crosshair">
                                        <Circle cx="12" cy="12"
                                                r="10"></Circle>
                                        <Line x1="22" y1="12" x2="18"
                                              y2="12"></Line>
                                        <Line x1="6" y1="12" x2="2"
                                              y2="12"></Line>
                                        <Line x1="12" y1="6" x2="12"
                                              y2="2"></Line>
                                        <Line x1="12" y1="22" x2="12"
                                              y2="18"></Line>
                                    </Svg>

                                    <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Goals</Text>
                                </TouchableOpacity> : <></>
                        }

                        <TouchableOpacity style={tab === 2 ? styles.activeButton : styles.inactiveButton}
                                          onPress={() => {
                                              setTab(2)
                                              Haptics.selectionAsync()
                                          }}
                                          onLongPress={() => {
                                              setHomeStat(!homeStat)
                                          }}
                        >
                            <Chart2 color={tab === 2 ? colors.background : colors.text}/>
                            <Text
                                style={tab === 2 ? styles.activeText : styles.inactiveText}>{gameState.type !== 'FUT' && gameState.type !== "PRE" ? "Game" : "Pregame"} Stats</Text>
                        </TouchableOpacity>

                        {/*{*/}
                        {/*    route.params?.data['data']['goals'] !== undefined &&*/}
                        {/*        <TouchableOpacity style={tab === 1 ? styles.activeButton : styles.inactiveButton}*/}
                        {/*                          onPress={() => {*/}
                        {/*                              setTab(1)*/}
                        {/*                              Haptics.selectionAsync()*/}
                        {/*                          }}>*/}
                        {/*            <Clock color={tab === 1 ? colors.background : colors.text}/>*/}
                        {/*            <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Play By Play</Text>*/}
                        {/*        </TouchableOpacity>*/}
                        {/*}*/}
                        {
                            gameState.type !== "FUT" && gameState.type !== "PRE" &&
                            <TouchableOpacity style={tab === 5 ? styles.activeButton : styles.inactiveButton}
                                              onPress={() => {
                                                  setTab(5)
                                                  Haptics.selectionAsync()
                                              }}>
                                <User color={tab === 5 ? colors.background : colors.text}/>
                                <Text style={tab === 5 ? styles.activeText : styles.inactiveText}>Player Stats</Text>
                            </TouchableOpacity>
                        }
                        {
                            gameState.type !== "FUT" && gameState.type !== "PRE" && <
                                TouchableOpacity style={tab === 8 ? styles.activeButton : styles.inactiveButton}
                                                 onPress={() => {
                                                     setTab(8)
                                                     Haptics.selectionAsync()
                                                 }}>

                                <Forbidden color={tab === 8 ? colors.background : colors.text}/>

                                <Text style={tab === 8 ? styles.activeText : styles.inactiveText}>Penalties</Text>
                            </TouchableOpacity>
                        }
                        {
                            gameState.type !== "FUT" && gameState.type !== "PRE" && <
                                TouchableOpacity style={tab === 7 ? styles.activeButton : styles.inactiveButton}
                                                 onPress={() => {
                                                     setTab(7)
                                                     Haptics.selectionAsync()
                                                 }}>

                                <Map1 color={tab === 7 ? colors.background : colors.text}/>

                                <Text style={tab === 7 ? styles.activeText : styles.inactiveText}>Rink Map</Text>
                            </TouchableOpacity>
                        }
                        {
                            gameState.type !== "FUT" && gameState.type !== "PRE" && <
                                TouchableOpacity style={tab === 4 ? styles.activeButton : styles.inactiveButton}
                                                 onPress={() => {
                                                     setTab(4)
                                                     Haptics.selectionAsync()
                                                 }}>

                                <UserRemove color={tab === 4 ? colors.background : colors.text}/>

                                <Text style={tab === 4 ? styles.activeText : styles.inactiveText}>Scratches</Text>
                            </TouchableOpacity>
                        }


                        {
                            (gameState.type === "FINAL" || gameState.type === "OFF" || gameState.type === "OVER") && landing?.summary?.threeStars ?
                                <
                                    TouchableOpacity style={tab === 6 ? styles.activeButton : styles.inactiveButton}
                                                     onPress={() => {
                                                         setTab(6)
                                                         Haptics.selectionAsync()
                                                     }}>

                                    <Star1 color={tab === 6 ? colors.background : colors.text}/>

                                    <Text style={tab === 6 ? styles.activeText : styles.inactiveText}>Stars</Text>
                                </TouchableOpacity> : <></>
                        }
                    </ScrollView>
                </View>
                <View>
                    {
                        !tab && gameState.type !== "FUT" && gameState.type !== "PRE" ?
                            <ScrollView style={{height: 600}} showsHorizontalScrollIndicator={false} horizontal>
                                {goals ? goals?.map((goal, i) => {
                                    return <View>
                                        <View>
                                            {(route.params?.data['data']['goals'][i]?.period !== route.params?.data['data']['goals'][i - 1]?.period) ?
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginBottom: 10,
                                                    textAlign: 'center', color: colors.text
                                                }}>Period {route.params?.data['data']['goals'][i]?.period}</Text> :
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginBottom: 10,
                                                    textAlign: 'left', color: colors.text
                                                }}>‎ </Text>}
                                            <View style={{
                                                marginBottom: 4,
                                                alignSelf: 'center',
                                                height: 80,
                                                borderRadius: 100,
                                                marginHorizontal: 20
                                            }}>

                                                <Text style={{
                                                    fontFamily: 'Sora_700Bold',
                                                    fontSize: 16,
                                                    textAlign: 'center',
                                                    color: colors.text
                                                }}>{goal.teamAbbrev.default}</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 14,
                                                    marginTop: 4,
                                                    textAlign: 'center',
                                                    opacity: .5, color: colors.text
                                                }}>{goal.homeScore} <Text
                                                    style={{fontFamily: ""}}>•</Text> {goal.awayScore}</Text>
                                                <View style={{flexDirection: 'row', justifyContent: 'center'}}>
                                                    <Image style={{
                                                        borderRadius: 100,
                                                        borderWidth: 3,
                                                        height: 80,
                                                        width: 80,
                                                        marginTop: 10,
                                                        borderColor: `${getTeamColor(goal.teamAbbrev.default, colors)}`,
                                                        backgroundColor: colors.card
                                                    }} source={{uri: goal.headshot}}/>
                                                </View>

                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginTop: 10,
                                                    textAlign: 'center',
                                                    color: colors.text
                                                }}>{goal.name.default} <Text
                                                    style={{fontFamily: ""}}>•</Text> {goal.goalsToDate}</Text>

                                                {
                                                    goal.assists.map(a => {
                                                        return <Text style={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            fontSize: 14,
                                                            marginTop: 4,
                                                            textAlign: 'center',
                                                            opacity: .5, color: colors.text
                                                        }}>{a.name.default} <Text
                                                            style={{fontFamily: ""}}>•</Text> {a.assistsToDate}</Text>
                                                    })
                                                }
                                                {
                                                    goal.assists.length === 1 && <Text style={{
                                                        fontFamily: 'Sora_600SemiBold',
                                                        fontSize: 14,
                                                        marginTop: 4,
                                                        textAlign: 'center',
                                                        opacity: .5, color: colors.text
                                                    }}>‎ </Text>

                                                }
                                                {
                                                    goal.assists.length === 0 && <View>
                                                        <Text style={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            fontSize: 14,
                                                            marginTop: 4,
                                                            textAlign: 'center',
                                                            opacity: .5, color: colors.text
                                                        }}>‎ </Text>
                                                        <Text style={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            fontSize: 14,
                                                            marginTop: 4,
                                                            textAlign: 'center',
                                                            opacity: .5, color: colors.text
                                                        }}>‎ </Text>
                                                    </View>

                                                }
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 14,
                                                    marginTop: 4,
                                                    textAlign: 'center',
                                                    opacity: .5, color: colors.text
                                                }}>{goal.shotType === "wrist" ? 'Wrist' : goal.shotType === "tip-in" ? "Tip In" : goal.shotType === "slap" ? "Slapshot" : goal.shotType === "deflected" ? "Deflected" : "Snap"}
                                                    <Text style={{fontFamily: ""}}> •</Text> {goal.timeInPeriod} <Text
                                                        style={{fontFamily: ""}}>•</Text> {goal.strength.toUpperCase()}
                                                </Text>

                                                {goal.highlightClip &&
                                                    <TouchableOpacity onPress={() => {
                                                        Linking.openURL(`https://players.brightcove.net/6415718365001/EXtG1xJ7H_default/index.html?videoId=${goal.highlightClip}`).then(r => {
                                                        });
                                                        Haptics.selectionAsync()
                                                    }} style={{
                                                        backgroundColor: colors.card,
                                                        alignSelf: 'center',
                                                        marginTop: 10,
                                                        paddingHorizontal: 20,
                                                        paddingVertical: 10,
                                                        borderRadius: 100,
                                                        marginRight: 10,
                                                        flexDirection: 'row',
                                                        gap: 5,
                                                        alignItems: 'center'
                                                    }}>
                                                        <VideoCircle color={colors.text}/>
                                                        <Text style={styles.inactiveText}>Clip</Text>
                                                    </TouchableOpacity>}
                                            </View>

                                        </View>


                                    </View>
                                }) : <View style={{marginTop: 20}}>
                                    <PlayerSkeleton colors={colors}/>
                                </View>}
                            </ScrollView> : tab === 2 ? gameState.type !== "FUT" && gameState.type !== "PRE" ?
                                    <View>

                                        <TouchableOpacity onPress={() => {
                                            getSIMData(!isReg)
                                            setIsReg(!isReg)
                                        }}>

                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.h.w).toFixed(2) * 100)}%</Text>
                                                <Text
                                                    style={{
                                                        fontFamily: 'Sora_500Medium',
                                                        fontSize: 16,
                                                        color: colors.text
                                                    }}>{isReg ? "Reg." : "OT"} Win
                                                    Playoff %</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16, textAlign: 'right',
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.a.w).toFixed(2) * 100)}%</Text>
                                            </View>
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                    progress={parseFloat(sim.h.w).toFixed(2) ?? 0} height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20}}
                                                    progress={parseFloat(sim.a.w).toFixed(2) ?? 0}
                                                    height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={() => {
                                            getSIMData(!isReg)
                                            setIsReg(!isReg)
                                        }}>
                                            <View
                                                style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.h.l).toFixed(2) * 100)}%</Text>
                                                <Text
                                                    style={{
                                                        fontFamily: 'Sora_500Medium',
                                                        fontSize: 16,
                                                        color: colors.text
                                                    }}>{isReg ? "Reg." : "OT"} Loss
                                                    Playoff %</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16, textAlign: 'right',
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.a.l).toFixed(2) * 100)}%</Text>
                                            </View>
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                    progress={parseFloat(sim.h.l).toFixed(2) ?? 0} height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20}}
                                                    progress={parseFloat(sim.a.l).toFixed(2) ?? 0}
                                                    height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                            setSelP(val => val < gameState.period ? val + 1 : 0)
                                        }}>
                                            <View
                                                style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16, color: colors.text
                                                }}>{selP === 0 ? shotsP.h.reduce((a, b) => a + b, 0) : shotsP.h[selP - 1]}</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16, color: colors.text
                                                }}>{selP === 0 ? "Shots On Goal" : `Period ${selP} Shots On Goal`}</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16, color: colors.text
                                                }}>{selP === 0 ? shotsP.a.reduce((a, b) => a + b, 0) : shotsP.a[selP - 1]}</Text>
                                            </View>
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                    progress={parseFloat(matchData?.home.sog) / (parseFloat(matchData?.home.sog) + parseFloat(matchData?.away.sog)) ?? 0}
                                                    height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20}}
                                                    progress={parseFloat(matchData?.away.sog) / (parseFloat(matchData?.home.sog) + parseFloat(matchData?.away.sog)) ?? 0}
                                                    height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            </View>
                                        </TouchableOpacity>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16, color: colors.text
                                            }}>{Math.round((parseFloat(fullData?.homeFaceoffWinPercentage)).toFixed(2) * 100)}%</Text>
                                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, color: colors.text}}>Faceoff
                                                Win Percentage</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16, color: colors.text
                                            }}>{Math.round((parseFloat(1 - fullData?.homeFaceoffWinPercentage)).toFixed(2) * 100)}%</Text>
                                        </View>

                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar animationType={"spring"}
                                                          color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={(parseFloat(fullData?.homeFaceoffWinPercentage)) ?? 0

                                                          } height={6}
                                                          width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={1 - (parseFloat(fullData?.homeFaceoffWinPercentage)) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16, color: colors.text
                                            }}>{Math.round((parseFloat(fullData?.homePercentOfEventsInOffensiveZone)) * 100)}%</Text>
                                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, color: colors.text}}>Offensive
                                                Zone Time</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16, color: colors.text
                                            }}>{Math.round((parseFloat(1 - fullData?.homePercentOfEventsInOffensiveZone)) * 100)}%</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={((parseFloat(fullData?.homePercentOfEventsInOffensiveZone))) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={(parseFloat(1 - fullData?.homePercentOfEventsInOffensiveZone)) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16, color: colors.text
                                            }}>{parseFloat(fullData?.homeTeamExpectedGoals).toFixed(2)}</Text>
                                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, color: colors.text}}>Expected
                                                Goals</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16, color: colors.text
                                            }}>{parseFloat(fullData?.awayTeamExpectedGoals).toFixed(2)}</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={matchData?.home.score / parseFloat(fullData?.homeTeamExpectedGoals).toFixed(2) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={matchData?.away.score / parseFloat(fullData?.awayTeamExpectedGoals).toFixed(2) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>

                                        <TouchableOpacity onPress={() => {
                                            setSelPP(!selPP)
                                        }}>
                                            <View
                                                style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16, color: colors.text
                                                }}>{selPP ? getPPCDataF().h : getPPCData().h * 100}{!selPP && "%"}</Text>
                                                <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, color: colors.text}}>Power
                                                    Play</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16, color: colors.text
                                                }}>{selPP ? getPPCDataF().a : getPPCData().a * 100}{!selPP && "%"}</Text>
                                            </View>

                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                    progress={getPPCData().h}
                                                    height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20}}
                                                    progress={getPPCData().a}
                                                    height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            </View>
                                        </TouchableOpacity>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text
                                                style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    color: colors.text
                                                }}>{landingData('pim').h}</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                color: colors.text
                                            }}>PIM</Text>
                                            <Text
                                                style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    color: colors.text
                                                }}>{landingData('pim').a}</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={isNaN(landingData('pim').h / (landingData('pim').h + landingData('pim').a)) ? 0 : landingData('pim').h / ((landingData('pim').h + landingData('pim').a))}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={isNaN(landingData('pim').a / (landingData('pim').h + landingData('pim').a)) ? 0 : landingData('pim').a / ((landingData('pim').h + landingData('pim').a))}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text
                                                style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    color: colors.text
                                                }}>{landingData('blockedShots').h}</Text>
                                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, color: colors.text}}>Blocked
                                                Shots</Text>
                                            <Text
                                                style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    color: colors.text
                                                }}>{landingData('blockedShots').a}</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={isNaN(landingData('blockedShots').h) ? 0 : landingData('blockedShots').h / (landingData('blockedShots').h + landingData('blockedShots').a)}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={isNaN(landingData('blockedShots').h) ? 0 : landingData('blockedShots').a / (landingData('blockedShots').h + landingData('blockedShots').a)}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text
                                                style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    color: colors.text
                                                }}>{landingData('hits').h}</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                color: colors.text
                                            }}>Hits</Text>
                                            <Text
                                                style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    color: colors.text
                                                }}>{landingData('hits').a}</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={isNaN(landingData('hits').h) ? 0 : landingData('hits').h / (landingData('hits').h + landingData('hits').a)}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={isNaN(landingData('hits').a) ? 0 : landingData('hits').a / (landingData('hits').h + landingData('hits').a)}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>

                                        <View style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 24,
                                                marginTop: 20, color: colors.text
                                            }}>% {homeStat ? route.params?.data.data.homeTeam.abbrev : route.params ? route.params.data.data.awayTeam.abbrev : undefined} Wins</Text>
                                            <View style={{
                                                flexDirection: 'row',
                                                justifyContent: 'flex-end',
                                                alignItems: 'center',
                                                gap: 10,
                                                marginTop: 20
                                            }}>

                                                <TouchableOpacity onPress={() => {
                                                    Haptics.selectionAsync().then(r => {
                                                        setHomeStat(true)
                                                    });

                                                }}
                                                                  style={{
                                                                      backgroundColor: homeStat ? colors.text : colors.card,
                                                                      borderRadius: 100
                                                                  }}>
                                                    <Text style={{
                                                        textAlign: "left",
                                                        paddingHorizontal: 15,
                                                        paddingVertical: 4,
                                                        fontFamily: 'Sora_500Medium',
                                                        fontSize: 20,
                                                        color: homeStat ? colors.background : colors.text
                                                    }}>{route.params?.data.data.homeTeam.abbrev}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => {
                                                    Haptics.selectionAsync().then(r => {
                                                        setHomeStat(false)
                                                    });

                                                }}
                                                                  style={{
                                                                      backgroundColor: !homeStat ? colors.text : colors.card,
                                                                      borderRadius: 100
                                                                  }}>
                                                    <Text style={{
                                                        textAlign: "left",
                                                        paddingHorizontal: 15,
                                                        paddingVertical: 4,
                                                        fontFamily: 'Sora_500Medium',
                                                        fontSize: 20,
                                                        color: !homeStat ? colors.background : colors.text
                                                    }}>{route.params?.data.data.awayTeam.abbrev}</Text>
                                                </TouchableOpacity>

                                            </View>
                                        </View>
                                        <View style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: 10
                                        }}>
                                            <TouchableOpacity onPress={() => {
                                                Haptics.selectionAsync().then(() => {
                                                })
                                                bottomSheetRef2.current.expand()
                                            }} style={{
                                                width: '100%',
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                paddingVertical: 20,
                                                paddingHorizontal: 20,
                                                borderRadius: 15,
                                                backgroundColor: colors.card,
                                                marginBottom: 4
                                            }}>
                                                <Text style={{
                                                    color: colors.text,
                                                    fontSize: 16,
                                                    fontFamily: 'Sora_500Medium'
                                                }}>Event</Text>
                                                <View style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}>
                                                    <Text style={{
                                                        color: colors.text,
                                                        opacity: .5,
                                                        fontSize: 16,
                                                        fontFamily: 'Sora_500Medium'
                                                    }}>{eventSel}</Text>
                                                    <ArrowDown2 style={{opacity: .7}} size={16}
                                                                color={colors.text}/>
                                                </View>
                                            </TouchableOpacity>


                                        </View>
                                        <DataLineChart precise={2}
                                                       style={{marginBottom: 100}}
                                                       override
                                                       data={winData.map((r, i) => {
                                                           return {value: isNaN(r.pct) ? homeStat ? winData[i - 1].pct : (1 - (winData[i - 1].pct / 100)) * 100 : homeStat ? r.pct : (1 - (r.pct / 100)) * 100}
                                                       })}
                                                       lastVal={winData.map((r, i) => {
                                                           return isNaN(r.pct) ? homeStat ? winData[i - 1].pct : (1 - (winData[i - 1].pct / 100)) * 100 : homeStat ? r.pct : (1 - (r.pct / 100)) * 100
                                                       }).slice(-1)}
                                                       isPCT
                                                       dots={winData.map((r, i) => {
                                                           return {goal: r.event === `${eventSel}` ? i - 1 : -1, team: r.team}
                                                       })}
                                                       colors={colors}
                                                       selectedTeam={homeStat ? route.params?.data.data.homeTeam.abbrev : route.params?.data.data.awayTeam.abbrev}/>

                                    </View>
                                    : <View>
                                        <TouchableOpacity onPress={() => {
                                            getSIMData(!isReg)
                                            setIsReg(!isReg)
                                        }}>
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.h.w).toFixed(2) * 100)}%</Text>
                                                <Text
                                                    style={{
                                                        fontFamily: 'Sora_500Medium',
                                                        fontSize: 16,
                                                        color: colors.text
                                                    }}>{isReg ? "Regulation" : "OT"} Win
                                                    Playoff %</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.a.w).toFixed(2) * 100)}%</Text>
                                            </View>
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                    progress={parseFloat(sim.h.w).toFixed(2) ?? 0} height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20}}
                                                    progress={parseFloat(sim.a.w).toFixed(2) ?? 0}
                                                    height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                            getSIMData(!isReg)
                                            setIsReg(!isReg)

                                        }}>
                                            <View
                                                style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.h.l).toFixed(2) * 100)}%</Text>
                                                <Text
                                                    style={{
                                                        fontFamily: 'Sora_500Medium',
                                                        fontSize: 16, color: colors.text
                                                    }}>{isReg ? "Regulation" : "OT"} Loss
                                                    Playoff %</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_500Medium',
                                                    fontSize: 16,
                                                    width: 60, color: colors.text
                                                }}>{Math.round(parseFloat(sim.a.l).toFixed(2) * 100)}%</Text>
                                            </View>
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.homeTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                    progress={parseFloat(sim.h.l).toFixed(2) ?? 0} height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                                <Progress.Bar
                                                    color={getTeamColor(route.params?.data.data.awayTeam.abbrev, colors)}
                                                    unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                    style={{marginTop: 20}}
                                                    progress={parseFloat(sim.a.l).toFixed(2) ?? 0}
                                                    height={6}
                                                    width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            </View>
                                        </TouchableOpacity>
                                    </View>

                                : tab === 4 ?
                                    <ScrollView style={{height: 400}} horizontal
                                                showsVerticalScrollIndicator={false}>

                                        {scratches?.home.length ? scratches?.home.map((player, i) => {
                                            return <View style={{flexDirection: 'row'}}>
                                                <View>
                                                    {i === 0 ?
                                                        <Text style={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            fontSize: 16,
                                                            marginBottom: 10,
                                                            textAlign: 'left',
                                                            color: colors.text
                                                        }}>{route.params?.data['data']['homeTeam']['abbrev']}</Text> :
                                                        <Text style={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            fontSize: 16,
                                                            marginBottom: 10,
                                                            textAlign: 'left',
                                                            color: colors.text
                                                        }}>‎ </Text>}
                                                    <Player player={player} id={player.id}/>
                                                </View>
                                            </View>
                                        }) : <View style={{marginTop: 20}}>
                                            <PlayerSkeleton colors={colors}/>

                                        </View>}
                                        <View style={{
                                            height: '50%',
                                            borderWidth: 1,
                                            borderStyle: 'dotted',
                                            borderColor: 'black',
                                            opacity: .3,
                                            marginHorizontal: 10
                                        }}/>
                                        {scratches.away.length ? scratches.away.map((player, i) => {
                                            return <View style={{flexDirection: 'row'}}>
                                                <View>
                                                    {i === 0 ?
                                                        <Text style={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            fontSize: 16,
                                                            marginBottom: 10,
                                                            textAlign: 'left',
                                                            color: colors.text
                                                        }}>{route.params?.data['data']['awayTeam']['abbrev']}</Text> :
                                                        <Text style={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            fontSize: 16,
                                                            marginBottom: 10,
                                                            textAlign: 'left',
                                                            color: colors.text
                                                        }}>‎ </Text>}
                                                    <Player player={player} id={player.id}/>
                                                </View>
                                            </View>
                                        }) : <View style={{marginTop: 20}}>
                                            <PlayerSkeleton colors={colors}/>

                                        </View>}


                                    </ScrollView> : tab === 5 ? <ScrollView horizontal>
                                        <View>

                                            <Text style={{
                                                fontFamily: 'Sora_600SemiBold',
                                                fontSize: 16,
                                                marginBottom: 10,
                                                textAlign: 'left',
                                                color: colors.text
                                            }}>{route.params.data.data.homeTeam.abbrev}</Text>
                                            <Table>
                                                <Row textStyle={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    color: colors.text,
                                                    fontSize: 14, opacity: .5
                                                }}
                                                     widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]}
                                                     data={["POS", "NAME", "GOALS", "ASSISTS", "SHOTS", "TOI", "BLOCKS", "HITS", "+/-"]}/>
                                                {playerStats.h && playerStats.h?.sort(sort_by('goals', true, parseInt)).map((player) => {
                                                    return <Row textStyle={{
                                                        fontFamily: 'Sora_500Medium',
                                                        marginTop: 10,
                                                        color: colors.text
                                                    }} widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]}
                                                                data={[player.position, player.name.default, player.goals, player.assists, player.shots, player.toi, player.blockedShots, player.hits, player.plusMinus]}/>
                                                })}
                                                <View style={{
                                                    width: '100%',
                                                    borderWidth: 2,
                                                    borderColor: 'black',
                                                    opacity: .5,
                                                    borderStyle: 'dotted',
                                                    marginVertical: 10
                                                }}/>
                                                <Row textStyle={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    color: colors.text,
                                                    fontSize: 14, opacity: .5
                                                }}
                                                     widthArr={[60, 120, 100, 100, 100, 100]}
                                                     data={["POS", "NAME", "SAVE %", "SAVED", "GA", "TOI"]}/>

                                                {playerStats.g.h && playerStats.g.h?.sort(sort_by('goalsAgainst', true, parseFloat)).map((player) => {
                                                    return <Row textStyle={{
                                                        fontFamily: 'Sora_500Medium',
                                                        marginTop: 10,
                                                        color: colors.text
                                                    }} widthArr={[60, 120, 100, 100, 100, 100]}
                                                                data={[player.position, player.name.default, player.savePctg ?? 0, player.saveShotsAgainst, player.goalsAgainst, player.toi]}/>
                                                })}
                                            </Table>
                                            <View style={{marginTop: 40}}>
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginBottom: 10,
                                                    textAlign: 'left', color: colors.text
                                                }}>{route.params.data.data.awayTeam.abbrev}</Text>
                                                <Table>
                                                    <Row
                                                        textStyle={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            color: colors.text,
                                                            fontSize: 14, opacity: .5
                                                        }}
                                                        widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]}
                                                        data={["POS", "NAME", "GOALS", "ASSISTS", "SHOTS", "TOI", "BLOCKS", "HITS", "+/-"]}/>
                                                    {playerStats.a && playerStats.a?.sort(sort_by('goals', true, parseInt)).map((player) => {
                                                        return <Row textStyle={{
                                                            fontFamily: 'Sora_500Medium',
                                                            color: colors.text,
                                                            marginTop: 10
                                                        }} widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]}
                                                                    data={[player.position, player.name.default, player.goals, player.assists, player.shots, player.toi, player.blockedShots, player.hits, player.plusMinus]}/>
                                                    })}
                                                    <View style={{
                                                        width: '100%',
                                                        borderWidth: 2,
                                                        borderColor: 'black',
                                                        opacity: .5,
                                                        borderStyle: 'dotted',
                                                        marginVertical: 10
                                                    }}/>
                                                    <Row
                                                        textStyle={{
                                                            fontFamily: 'Sora_600SemiBold',
                                                            color: colors.text,
                                                            fontSize: 14, opacity: .5
                                                        }}
                                                        widthArr={[60, 120, 100, 100, 100, 100]}
                                                        data={["POS", "NAME", "SAVE %", "SAVED", "GA", "TOI"]}/>

                                                    {playerStats.g.a && playerStats.g.a?.sort(sort_by('goalsAgainst', true, parseFloat)).map((player) => {
                                                        return <Row textStyle={{
                                                            fontFamily: 'Sora_500Medium',
                                                            marginTop: 10,
                                                            color: colors.text
                                                        }} widthArr={[60, 120, 100, 100, 100, 100]}
                                                                    data={[player.position, player.name.default, player.savePctg ?? 0, player.saveShotsAgainst, player.goalsAgainst, player.toi]}/>
                                                    })}
                                                </Table>


                                            </View>

                                        </View>


                                    </ScrollView> : tab === 6 ?
                                        <ScrollView style={{height: '100%'}} showsHorizontalScrollIndicator={false}
                                                    horizontal>
                                            {landing?.summary.threeStars ? landing?.summary.threeStars.map((star, i) => {
                                                return <View>
                                                    <View>

                                                        <View style={{
                                                            marginBottom: 4,
                                                            alignSelf: 'center',
                                                            height: 80,
                                                            borderRadius: 100,
                                                            marginHorizontal: 20
                                                        }}>
                                                            <Text style={{
                                                                fontFamily: 'Sora_700Bold',
                                                                fontSize: 16,
                                                                textAlign: 'center',
                                                                color: colors.text
                                                            }}>{star.teamAbbrev}</Text>

                                                            <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'center'
                                                            }}>
                                                                <Image style={{
                                                                    borderRadius: 100,
                                                                    borderWidth: 3,
                                                                    height: 80,
                                                                    width: 80,
                                                                    marginTop: 10,
                                                                    borderColor: `${getTeamColor(star.teamAbbrev, colors)}`,
                                                                    backgroundColor: colors.card
                                                                }} source={{uri: star.headshot}}/>
                                                            </View>


                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 16,
                                                                marginTop: 10,
                                                                textAlign: 'center',
                                                                color: colors.text
                                                            }}>{star.firstName} {star.lastName}</Text>
                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 14,
                                                                marginTop: 4,
                                                                textAlign: 'center',
                                                                opacity: .5, color: colors.text
                                                            }}>{star.position !== "G" ? star.points : star.savePctg} {star.position !== "G" ? "Points" : "SV %"}</Text>
                                                        </View>
                                                    </View>
                                                    {(route.params?.data['data']['goals'][i]?.period !== route.params?.data['data']['goals'][i + 1]?.period && i !== route.params?.data['data']['goals'].length - 1) &&
                                                        <View style={{
                                                            height: '50%',
                                                            borderWidth: 1,
                                                            borderStyle: 'dotted',
                                                            borderColor: 'black',
                                                            opacity: .3,
                                                            marginHorizontal: 10
                                                        }}/>}
                                                </View>
                                            }) : <PlayerSkeleton colors={colors}/>}

                                        </ScrollView> : tab === 7 ? <View>
                                            <View style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginTop: 10
                                            }}>
                                                <TouchableOpacity onPress={() => {
                                                    Haptics.selectionAsync().then(() => {
                                                    })
                                                    bottomSheetRef2.current.expand()
                                                }} style={{
                                                    width: '100%',
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    paddingVertical: 20,
                                                    paddingHorizontal: 20,
                                                    borderRadius: 15,
                                                    backgroundColor: colors.card,
                                                    marginBottom: 4
                                                }}>
                                                    <Text style={{
                                                        color: colors.text,
                                                        fontSize: 16,
                                                        fontFamily: 'Sora_500Medium'
                                                    }}>Stat</Text>
                                                    <View style={{
                                                        flexDirection: 'row',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        gap: 4
                                                    }}>
                                                        <Text style={{
                                                            color: colors.text,
                                                            opacity: .5,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_500Medium'
                                                        }}>{mapStatsSel}</Text>
                                                        <ArrowDown2 style={{opacity: .7}} size={16}
                                                                    color={colors.text}/>
                                                    </View>
                                                </TouchableOpacity>


                                            </View>
                                            <View style={{
                                                height: Math.round((Dimensions.get('window').width - 20) * (42.5 / 100)),
                                                width: Dimensions.get('window').width - 20,
                                                backgroundColor: 'white',
                                                marginLeft: 'auto',
                                                marginRight: 'auto',
                                                position: 'relative',
                                                borderRadius: 100,
                                                marginTop: 20,
                                                transform: [{rotateX: '45deg'}]
                                            }}>
                                                <Image width={Dimensions.get('window').width - 20}

                                                       style={{
                                                           position: 'absolute',
                                                           borderRadius: 50,
                                                           borderWidth: 1,
                                                           borderColor: 'lightgray',
                                                           width: Dimensions.get('window').width - 20,
                                                           height: Math.round((Dimensions.get('window').width - 20) * (42.5 / 100))
                                                       }}
                                                       source={{uri: "https://github.com/war-on-ice/icerink/blob/master/ex/fullHorizontal.PNG?raw=true"}}/>

                                                {mapStats.map(s => {
                                                    const pixelPosition = mapToPixel(s.x, s.y, Dimensions.get('window').width - 20, Math.round((Dimensions.get('window').width - 20) * (42.5 / 100)), 10);
                                                    return <View style={{
                                                        height: 10,
                                                        width: 10,
                                                        zIndex: 3,
                                                        backgroundColor: route.params?.data['data']['homeTeam']['id'] === s.d ? getTeamColor(route.params?.data['data']['homeTeam']['abbrev'], colors) === "#fff" ? "#000" : getTeamColor(route.params?.data['data']['homeTeam']['abbrev'], colors) : getTeamColor(route.params?.data['data']['awayTeam']['abbrev'], colors) === "#fff" ? "#000" : getTeamColor(route.params?.data['data']['awayTeam']['abbrev'], colors),
                                                        borderRadius: 100,
                                                        position: 'absolute',
                                                        top: pixelPosition.y,
                                                        left: pixelPosition.x
                                                    }}/>
                                                })}
                                                {assets && <Image style={{
                                                    height: 50,
                                                    width: 50,
                                                    transform: [{scale: .7}],
                                                    flexDirection: 'column',
                                                    marginTop: 10,
                                                    marginLeft: 5,
                                                    justifyContent: 'center',
                                                    position: 'absolute',
                                                    left: ((Dimensions.get('window').width - 20) / 2) - 30,
                                                    top: 45,
                                                    zIndex: 2
                                                }}
                                                                  source={assets[teamAbbreviations.indexOf(route.params?.data['data']['homeTeam']['abbrev'])]}/>}
                                                <View/>

                                            </View>
                                        </View> : tab === 8 ?
                                            <ScrollView showsHorizontalScrollIndicator={false}
                                                        horizontal>
                                                <Table>
                                                    <Row textStyle={{
                                                        fontFamily: 'Sora_600SemiBold',
                                                        color: colors.text,
                                                        fontSize: 14, opacity: .5
                                                    }}
                                                         widthArr={[60, 60, 150, 150, 100, 100]}
                                                         data={["PER", "TEAM", "COMITTED NAME", "TYPE", "TIME", "DURATION"]}/>
                                                    {penalties && penalties.map((player) => {
                                                        const periodData = player.periodData;
                                                        const penalty = player.penaltyData;

                                                        return <Row textStyle={{
                                                            fontFamily: 'Sora_500Medium',
                                                            marginTop: 10,
                                                            color: colors.text
                                                        }} widthArr={[60, 60, 150, 150, 100, 100]}
                                                                    data={[periodData.period, penalty.teamAbbrev, penalty.committedByPlayer.split(" ")[0][0] + ". " + penalty.committedByPlayer.split(" ")[1], hyphenToCapitalizedWords(penalty.descKey), penalty.timeInPeriod, `${penalty.duration} min.`]}/>
                                                    })}
                                                </Table>
                                                {/*{penalties ? penalties?.map((goal, i) => {*/}
                                                {/*        return <View>*/}
                                                {/*            <View>*/}
                                                {/*                /!*{(route.params?.data['data']['goals'][i]?.period !== route.params?.data['data']['goals'][i - 1]?.period) ?*!/*/}
                                                {/*                /!*    <Text style={{*!/*/}
                                                {/*                /!*        fontFamily: 'Sora_600SemiBold',*!/*/}
                                                {/*                /!*        fontSize: 16,*!/*/}
                                                {/*                /!*        marginBottom: 10,*!/*/}
                                                {/*                /!*        textAlign: 'center', color: colors.text*!/*/}
                                                {/*                /!*    }}>Period {route.params?.data['data']['goals'][i]?.period}</Text> :*!/*/}
                                                {/*                /!*    <Text style={{*!/*/}
                                                {/*                /!*        fontFamily: 'Sora_600SemiBold',*!/*/}
                                                {/*                /!*        fontSize: 16,*!/*/}
                                                {/*                /!*        marginBottom: 10,*!/*/}
                                                {/*                /!*        textAlign: 'left', color: colors.text*!/*/}
                                                {/*                /!*    }}>‎ </Text>}*!/*/}
                                                {/*                <View style={{*/}
                                                {/*                    marginBottom: 4,*/}
                                                {/*                    alignSelf: 'center',*/}
                                                {/*                    height: 80,*/}
                                                {/*                    borderRadius: 100,*/}
                                                {/*                    marginHorizontal: 20*/}
                                                {/*                }}>*/}

                                                {/*                    /!*<Text style={{*!/*/}
                                                {/*                    /!*    fontFamily: 'Sora_700Bold',*!/*/}
                                                {/*                    /!*    fontSize: 16,*!/*/}
                                                {/*                    /!*    textAlign: 'center',*!/*/}
                                                {/*                    /!*    color: colors.text*!/*/}
                                                {/*                    /!*}}>{goal.teamAbbrev}</Text>*!/*/}
                                                {/*                    /!*<Text style={{*!/*/}
                                                {/*                    /!*    fontFamily: 'Sora_600SemiBold',*!/*/}
                                                {/*                    /!*    fontSize: 14,*!/*/}
                                                {/*                    /!*    marginTop: 4,*!/*/}
                                                {/*                    /!*    textAlign: 'center',*!/*/}
                                                {/*                    /!*    opacity: .5, color: colors.text*!/*/}
                                                {/*                    /!*}}>{goal.homeScore} <Text*!/*/}
                                                {/*                    /!*    style={{fontFamily: ""}}>•</Text> {goal.awayScore}*!/*/}
                                                {/*                    /!*</Text>*!/*/}
                                                {/*                    /!*<View style={{*!/*/}
                                                {/*                    /!*    flexDirection: 'row',*!/*/}
                                                {/*                    /!*    justifyContent: 'center'*!/*/}
                                                {/*                    /!*}}>*!/*/}
                                                {/*                    /!*    <Image style={{*!/*/}
                                                {/*                    /!*        borderRadius: 100,*!/*/}
                                                {/*                    /!*        borderWidth: 3,*!/*/}
                                                {/*                    /!*        height: 80,*!/*/}
                                                {/*                    /!*        width: 80,*!/*/}
                                                {/*                    /!*        marginTop: 10,*!/*/}
                                                {/*                    /!*        borderColor: `${getTeamColor(goal.teamAbbrev, colors)}`,*!/*/}
                                                {/*                    /!*        backgroundColor: colors.card*!/*/}
                                                {/*                    /!*    }} source={{uri: goal.headshot}}/>*!/*/}
                                                {/*                    /!*</View>*!/*/}

                                                {/*                    <Text style={{*/}
                                                {/*                        fontFamily: 'Sora_600SemiBold',*/}
                                                {/*                        fontSize: 16,*/}
                                                {/*                        marginTop: 10,*/}
                                                {/*                        textAlign: 'center',*/}
                                                {/*                        color: colors.text*/}
                                                {/*                    }}>{goal.committedByPlayer.split(" ")[0][0] + ". " + goal.committedByPlayer.split(" ")[1]}*/}
                                                {/*                    </Text>*/}
                                                {/*                    <Text style={{*/}
                                                {/*                        fontFamily: 'Sora_600SemiBold',*/}
                                                {/*                        fontSize: 14,*/}
                                                {/*                        marginTop: 4,*/}
                                                {/*                        textAlign: 'center',*/}
                                                {/*                        opacity: .5, color: colors.text*/}
                                                {/*                    }}>{goal.type} <Text style={{*/}
                                                {/*                        fontFamily: 'Sora_600SemiBold',*/}
                                                {/*                        fontSize: 14,*/}
                                                {/*                        marginTop: 4,*/}
                                                {/*                        textAlign: 'center',*/}
                                                {/*                        opacity: .5, color: colors.text*/}
                                                {/*                    }}>{goal.periodDescriptor?.number}*/}
                                                {/*                        <Text*/}
                                                {/*                            style={{fontFamily: ""}}>•</Text> {goal.timeInPeriod}*/}
                                                {/*                    </Text>*/}
                                                {/*                    </Text>*/}
                                                {/*                    <Text style={{*/}
                                                {/*                        fontFamily: 'Sora_600SemiBold',*/}
                                                {/*                        fontSize: 14,*/}
                                                {/*                        marginTop: 4,*/}
                                                {/*                        textAlign: 'center',*/}
                                                {/*                        opacity: .5, color: colors.text*/}
                                                {/*                    }}>{goal.descKey}*/}
                                                {/*                    </Text>*/}
                                                {/*                </View>*/}

                                                {/*            </View>*/}


                                                {/*        </View>*/}
                                                {/*    }) :*/}
                                                {/*    <View style={{marginTop: 20}}>*/}
                                                {/*        <PlayerSkeleton colors={colors}/>*/}

                                                {/*    </View>*/}
                                                {/*}*/}
                                                <View style={{marginBottom: 1000}}/>
                                            </ScrollView> :
                                            <></>


                    }
                    <View style={{paddingBottom: tab === 5 ? 100 : 0}}/>


                </View>
            </ScrollView>
            <BottomSheet

                ref={bottomSheetRef2}
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
                        setMapStatsSel("Shots")
                        getMapData('shot-on-goal')
                        bottomSheetRef2.current.close()
                    }}>
                        <Text style={{
                            color: colors.text,
                            fontSize: 20,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Shots
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        Haptics.selectionAsync().then(() => {
                        })
                        setMapStatsSel("Goals")
                        getMapData('goal')
                        bottomSheetRef2.current.close()
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
                        setMapStatsSel("Blocked Shots")
                        getMapData('blocked-shot')
                        bottomSheetRef2.current.close()
                    }}>
                        <Text style={{
                            color: colors.text,
                            fontSize: 20,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Blocked Shots
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        Haptics.selectionAsync().then(() => {
                        })
                        setMapStatsSel("Giveaways")
                        getMapData('giveaway')
                        bottomSheetRef2.current.close()
                    }}>
                        <Text style={{
                            color: colors.text,
                            fontSize: 20,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Giveaways
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        Haptics.selectionAsync().then(() => {
                        })
                        setMapStatsSel("Takeaways")
                        getMapData('takeaway')
                        bottomSheetRef2.current.close()
                    }}>
                        <Text style={{
                            color: colors.text,
                            fontSize: 20,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Takeaways
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        Haptics.selectionAsync().then(() => {
                        })
                        setMapStatsSel("Missed Shots")
                        getMapData('missed-shot')
                        bottomSheetRef2.current.close()
                    }}>
                        <Text style={{
                            color: colors.text,
                            fontSize: 20,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Missed Shots
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        Haptics.selectionAsync().then(() => {
                        })
                        setMapStatsSel("Hits")
                        getMapData('hit')
                        bottomSheetRef2.current.close()
                    }}>
                        <Text style={{
                            color: colors.text,
                            fontSize: 20,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Hits
                        </Text>
                    </TouchableOpacity>


                </View>

            </BottomSheet>

            <BottomSheet

                ref={bottomSheetRef2}
                index={-1}
                snapPoints={snapPoints2}
                enablePanDownToClose
                style={{
                    paddingHorizontal: 20
                }}
                backgroundStyle={{
                    backgroundColor: colors.card
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
                        setEventSel("GOAL")
                        bottomSheetRef2.current.close()
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
                        setEventSel("PENL")
                        bottomSheetRef2.current.close()
                    }}>
                        <Text style={{
                            color: colors.text,
                            fontSize: 20,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Penalties
                        </Text>
                    </TouchableOpacity>
                </View>

            </BottomSheet>


        </SafeAreaView>
    </MotiView>


}

