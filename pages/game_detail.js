import {useRoute, useTheme} from "@react-navigation/native";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import * as Linking from 'expo-linking';
import {
    ArrowLeft,
    Chart2,
    Clock,
    CloseCircle,
    ExportCircle,
    Flash,
    ImportCircle,
    Profile2User,
    TimerPause,
    User,
    UserRemove
} from "iconsax-react-native";
import {MotiText, MotiView} from "moti";
import Papa from "papaparse";
import React, {useEffect, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {LineChart} from "react-native-chart-kit";
import * as Progress from 'react-native-progress';
import Svg, {Circle, Line, SvgUri} from "react-native-svg";
import {Row, Table} from 'react-native-table-component';
import teamData from '../teams';


export default function GamesDetail({navigation}) {

    const graphRef = useRef(null);

    const {colors} = useTheme()


    const styles = StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100%',
            backgroundColor: colors.background,
            paddingHorizontal: 10,
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


    const route = useRoute()

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

    const getTimeLabel = () => {


        if (route.params?.data['data'].homeTeam.score !== undefined) {
            if (route.params?.data['data'].clock?.timeRemaining === "00:00" || route.params?.data['data'].gameOutcome?.lastPeriodType) {
                return "Final"
            } else if (route.params?.data['data'].clock?.inIntermission) {
                return "INT"
            } else return route.params?.data['data'].clock?.timeRemaining
        }

    }


    const AwayTeamName = teamData.filter((item) => {
        return (item.abbreviation === route.params?.data['data']['awayTeam']['abbrev']);
    })

    const HomeTeamName = teamData.filter((item) => {
        return (item.abbreviation === route.params?.data['data']['homeTeam']['abbrev']);
    })

    const [stat, setStat] = useState({home: 0, away: 0});

    const [sim, setSim] = useState({h: {w: 0, l: 0}, a: {w: 0, l: 0}});


    const [playerStats, setPlayerStats] = useState({h: [], a: [], g: {h: [], a: []}})

    const commonConfig = {delimiter: ","};


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

    const [gameInfo, setGameInfo] = useState({home: [], away: []})
    const [shotsP1, setShotsP1] = useState({h: 0, a: 0});
    const [shotsP2, setShotsP2] = useState({h: 0, a: 0});
    const [shotsP3, setShotsP3] = useState({h: 0, a: 0});



    useEffect(()=>{


        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch(`https://api-web.nhle.com/v1/gamecenter/${route.params?.data['data']['id']}/boxscore`, requestOptions)
            .then(response => response.text())
            .then(result => {




                const pData = {h: [], a: [], g: {h: [], a: []}}

                JSON.parse(result).boxscore.playerByGameStats.homeTeam.forwards.map(player => {
                    pData.h.push(player)
                })
                JSON.parse(result).boxscore.playerByGameStats.homeTeam.defense.map(player => {
                    pData.h.push(player)
                })

                JSON.parse(result).boxscore.playerByGameStats.awayTeam.forwards.map(player => {
                    pData.a.push(player)
                })
                JSON.parse(result).boxscore.playerByGameStats.awayTeam.defense.map(player => {
                    pData.a.push(player)
                })


                JSON.parse(result).boxscore.playerByGameStats.homeTeam.goalies.map(player => {
                    pData.g.h.push(player)
                })
                JSON.parse(result).boxscore.playerByGameStats.awayTeam.goalies.map(player => {
                    pData.g.a.push(player)
                })

                setPlayerStats(pData)


                setMatchData({home: JSON.parse(result)['homeTeam'], away: JSON.parse(result)['awayTeam']})
                setGameInfo({
                    home: JSON.parse(result).boxscore.gameInfo.homeTeam.scratches,
                    away: JSON.parse(result).boxscore.gameInfo.awayTeam.scratches
                })

                setShotsP1({
                    h: JSON.parse(result)?.boxscore.shotsByPeriod[0].home,
                    a: JSON.parse(result)?.boxscore.shotsByPeriod[0].away
                })
                setShotsP2({
                    h: JSON.parse(result)?.boxscore.shotsByPeriod[1].home,
                    a: JSON.parse(result)?.boxscore.shotsByPeriod[1].away
                })
                setShotsP3({
                    h: JSON.parse(result)?.boxscore.shotsByPeriod[2].home,
                    a: JSON.parse(result)?.boxscore.shotsByPeriod[2].away
                })

                setPPData({
                    h: {
                        t: JSON.parse(result)?.situation.timeRemaining,
                        a: JSON.parse(result)?.situation.homeTeam.strength
                    },
                    a: {
                        t: JSON.parse(result)?.situation.timeRemaining,
                        a: JSON.parse(result)?.situation.awayTeam.strength
                    }
                })
            })





        getSIMData(0)


    }, [])

    const [matchData, setMatchData] = useState(null);
    const [ppData, setPPData] = useState({h: {t: 0, a: 5}, a: {t: 0, a: 5}});

    const getDate = (offset) => {
        const today = new Date();
        today.setDate(today.getDate() + offset);
        today.setHours(today.getHours() - 4)

        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Adding 1 because months are zero-based
        const day = today.getDate().toString().padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    const [winData, setWinData] = useState([]);
    const [ptsData, setPTSData] = useState([{}]);

    const [fullData, setFullData] = useState(null);

    const [playByPlay, setPlayByPlay] = useState([{}]);


    if(matchData){
        if(!stat.home){
            if (route.params?.data['data']['goals'] !== undefined) {
                Papa.parse(
                    `https://moneypuck.com/moneypuck/gameData/${route.params?.data['data']['season']}/${route.params?.data['data']['id']}.csv`,
                    {
                        ...commonConfig,
                        header: true,
                        download: true,
                        complete: (result) => {
                            const chartData = result.data.map((d, i)=>{
                                return parseFloat(d?.homeWinProbability) * 100
                            })
                            const pointsData = result.data.map((d, i) => {
                                return parseFloat(d?.homeTeamExpectedGoals)
                            })
                            const pointsDataAway = result.data.map((d, i) => {
                                return parseFloat(d?.awayTeamExpectedGoals)
                            })
                            const playData = result.data.map((d, i)=>{
                                return {
                                    raw: d.eventDescriptionRaw,
                                    type: d.event,
                                    shot: d.shot,
                                    time: d.time,
                                    x: d.xCord,
                                    y: d.yCord
                                }
                            })


                            setPlayByPlay(playData.slice(playData.length - 10, playData.length))
                            setWinData(chartData)
                            setPTSData({h: pointsData, a: pointsDataAway})
                            setStat({p: 0, home: (result.data.slice(-2)[0]).homeWinProbability, away: 1 - (result.data.slice(-2)[0]).homeWinProbability});
                            setFullData(result.data.slice(-2)[0])
                        }
                    }
                );
            }
            else{
                Papa.parse(
                    `https://moneypuck.com/moneypuck/predictions/${route.params?.data['data']['id']}.csv`,
                    {
                        ...commonConfig,
                        header: true,
                        download: true,
                        complete: (result) => {
                            setStat({p: 1, home: parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore), away: 1-parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore)});
                        }
                    }
                );
            }


        }
    }

    const [isReg, setIsReg] = useState(true);


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

    function findMinMax(arr) {
        let min = arr[0];
        let max = arr[0];
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] > max) {
                max = arr[i];
            }
            if (arr[i] < min) {
                min = arr[i];
            }
        }
        return {min: min, max: max};
    }

    const data = {
        // Your data points here
        xAxis: [0, 1, 2, 3, 4],
        yAxis: [0, 5, 2, 7, 4]
    };



    const parseEvent = (event) => {

        switch (event) {
            case "FAC":
                return "Faceoff Won";
            case "SHOT":
                return "Shot Taken"
            case "TAKE":
                return "Takeaway"
            case "GIVE":
                return "Giveaway"
            case "STOP":
                return "Play Stopped"
            case "BLOCK":
                return "Shot Blocked"
            case "HIT":
                return "Hit"
            case "MISS":
                return "Shot Missed"
            case "GOA":
                return "Goalie Stopped"
            case "GEND":
                return "Game Ended"
            case "PEND":
                return "Period Ended"
            case "GOAL":
                return "Goal Scored"
            case "GSTR":
                return "Game Started"
            case "PSTR":
                return "Period Started"
            case "PENL":
                return "Penalty"
        }


        return event;

    }


    const [assets, error] = useAssets(require("../assets/rink.png"));

    const [homeStat, setHomeStat] = useState(true);

    const [selP, setSelP] = useState(0);



    function getPCTColor(teamCode) {
        let team = teamData.filter((item) => {
            return (item.abbreviation === teamCode);
        })
        return team[0]?.primary_color;
    }

    function scaleCoordinates(originalX, originalY, newWidth, newHeight) {
        const scaledX = (originalX / 100) * newWidth;
        const scaledY = (originalY / 100) * newHeight;

        return {scaledX, scaledY};
    }

    const [tab, setTab] = useState(route.params?.data['data']['goals'] !== undefined ? 0 : 2);

    const [selectedEvent, setSelectedEvent] = useState(1);

    const [scrollView, setScrollView] = useState(false);

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
                width: 100,color: colors.text
            }}></Text>
            <View style={{flexDirection: 'row', justifyContent: 'center'}}>
                {data &&
                    <Image style={{
                        borderRadius: 100,
                        borderWidth: 3,
                        height: 80,
                        width: 80,
                        marginTop: 10,
                        borderColor: `${getPCTColor(data.currentTeamAbbrev)}`,
                        backgroundColor: colors.card
                    }} source={{uri: data.headshot}}/>}
            </View>

            <Text style={{
                fontFamily: 'Sora_600SemiBold',
                fontSize: 16,
                marginTop: 10,
                textAlign: 'center',color: colors.text
            }}>{props.player.firstName.default}</Text>
            <Text style={{
                fontFamily: 'Sora_600SemiBold',
                fontSize: 16,
                textAlign: 'center',color: colors.text
            }}>{props.player.lastName.default}</Text>

        </TouchableOpacity>
    }


    return <View style={styles.container}>
        <SafeAreaView style={{width: '100%', position: 'relative'}}>
            <View
                style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center'}}>

                    <TouchableOpacity onPress={() => {
                        navigation.goBack()
                        Haptics.selectionAsync()
                    }} style={{backgroundColor: colors.card, marginRight: 15, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 100}}>
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
                        }}><Text style={{ fontFamily: 'Sora_600SemiBold',
                        fontSize: 24, color: colors.text}}>{route.params?.data.data.awayTeam.abbrev} @ {route.params?.data.data.homeTeam.abbrev}</Text></MotiText>
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
                            }}><Text style={{ fontFamily: 'Sora_600SemiBold',
                            fontSize: 24, color: colors.text}}>{route.params?.data.data.awayTeam.abbrev} {matchData?.away.score} <Text style={{fontFamily: 'default'}}><Text style={{fontFamily: 'default'}}>•</Text></Text> {matchData?.home.score} {route.params?.data.data.homeTeam.abbrev}</Text></MotiView></View>
                </View>
                {
                    route.params?.data['data'].gameOutcome?.lastPeriodType !== undefined && <TouchableOpacity style={{
                        backgroundColor: colors.card,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 100,
                        marginRight: 10
                    }} onPress={() => {
                        Linking.openURL(`https://www.nhl.com${route.params?.data['data'].threeMinRecap}`).then(r => {
                        });
                        Haptics.selectionAsync()
                    }}>
                        <Text style={styles.inactiveText}>Video Recap</Text>
                    </TouchableOpacity>
                }
            </View>

            <ScrollView scrollEventThrottle={16} onScroll={(s) => handleScroll(s.nativeEvent.contentOffset.y)}
                        style={{height: !tab ? 1000 : '100%'}}>
                <View style={{flexDirection: 'row', alignItems: 'start', marginTop: 20, justifyContent: 'center'}}>
                    <View style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>
                        <View style={{backgroundColor: colors.card, borderRadius: 100}}>
                            <Text style={{
                                textAlign: "left",
                                paddingHorizontal: 15,
                                paddingVertical: 4,
                                fontFamily: 'Sora_500Medium',
                                fontSize: 20,color: colors.text
                            }}>{(parseFloat(stat.home > 0.0 ? stat.home : route.params?.data.prob.h) * 100).toFixed(0)}%</Text>
                        </View>
                        <SvgUri width={70} height={70} style={{
                            flexDirection: 'column',
                            justifyContent: 'center',
                            marginTop: 10,
                            marginLeft: 5
                        }}
                                uri={route.params?.data['data']['homeTeam']['logo']}/>
                        <Text style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 18,
                            textAlign: 'center',color: colors.text
                        }}>{HomeTeamName[0]['name']}</Text>
                        {ppData.h.a > ppData.a.a ??
                            <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>
                                <Text style={{
                                    textAlign: "left",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium',
                                    fontSize: 20,color: colors.text
                                }}>{ppData.h.a} on {ppData.a.a}</Text>
                            </View> }
                        {ppData.h.a > ppData.a.a &&
                            <Text style={{
                                textAlign: "center",
                                fontFamily: 'Sora_400Regular',
                                marginTop: 5,
                                fontSize: 16,color: colors.text
                            }}>{ppData.h.t}</Text>}
                    </View>
                    <View style={{flexDirection: 'column', alignItems: 'center', width: '33.3%'}}>
                        <View>
                            {route.params?.data['data'].period && getTimeLabel() !== "INT" && getTimeLabel() !== "Final" ?
                                <View style={{
                                    backgroundColor: colors.card,
                                    width: 100,
                                    paddingVertical: 5,
                                    borderRadius: 5,
                                    paddingHorizontal: 15
                                }}>
                                    <Text style={{
                                        marginTop: route.params?.data['data'].period ? 0 : 5,
                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium',color: colors.text
                                    }}>{route.params?.data['data'].period > 3 ? "OT" : `P${route.params?.data['data'].period}`}</Text>

                                </View> : getTimeLabel() === "INT" && <View style={{
                                    backgroundColor: colors.card,
                                    width: 100,
                                    paddingVertical: 5,
                                    borderRadius: 5,
                                    paddingHorizontal: 15
                                }}>
                                    <Text style={{
                                        marginTop: route.params?.data['data'].period ? 0 : 5,
                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium',color: colors.text
                                    }}>INT</Text>

                                </View> }
                            {route.params?.data['data'].period && getTimeLabel() !== "INT" ?
                                <View style={{
                                    backgroundColor: colors.card,
                                    width: 100,
                                    paddingVertical: 5,
                                    borderRadius: 5,
                                    marginTop: route.params?.data['data'].period && !route.params?.data['data'].gameOutcome?.lastPeriodType ? 5 : 0,
                                    paddingHorizontal: 15
                                }}>

                                    <Text style={{
                                        marginTop: !route.params?.data['data'].period || route.params?.data['data'].gameOutcome?.lastPeriodType ? 0 : 5,
                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium',color: colors.text
                                    }}>{getTimeLabel()}</Text>
                                </View> : getTimeLabel() === "INT" && <View style={{
                                    backgroundColor: colors.card,
                                    width: 100,
                                    paddingVertical: 5,
                                    borderRadius: 5,
                                    marginTop: route.params?.data['data'].period ? 5 : 0,
                                    paddingHorizontal: 15
                                }}>
                                    <Text style={{
                                        marginTop: !route.params?.data['data'].period ? 0 : 5,
                                        textAlign: 'center',
                                        fontFamily: 'Sora_500Medium',color: colors.text
                                    }}>{route.params?.data['data'].clock?.timeRemaining}</Text>
                                </View> }
                        </View>
                        {matchData?.home.score !== undefined ?

                            <View
                                style={{flexDirection: 'row', justifyContent: 'center', marginTop: 40, width: '100%'}}>
                                <View
                                    style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10}}>
                                <MotiText
                                    from={{
                                        opacity: 0,
                                        translateX: -10
                                    }}
                                    animate={{
                                        translateX: 0,
                                        opacity: 1


                                    }}
                                    transition={{
                                        type: 'timing',
                                        duration: 500
                                    }} style={{
                                    textAlign: "center",
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_800ExtraBold',
                                    fontSize: 32,color: colors.text
                                }}>{matchData?.home.score}</MotiText>

                                    <MotiView  from={{
                                        opacity: 0,
                                    }}
                                               animate={{
                                                   opacity: 1


                                               }}
                                               transition={{
                                                   type: 'timing',
                                                   duration: 500
                                               }}>
                                    <Svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={colors.text} stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round" className="feather feather-circle"><Circle cx="12" cy="12" r="10"></Circle></Svg>
                                    </MotiView>
                                        <MotiText
                                        from={{
                                            translateX: 10,
                                            opacity: 0
                                        }}
                                        animate={{
                                            translateX: 0,
                                            opacity: 1

                                        }}
                                        transition={{
                                            type: 'timing',
                                            duration: 500
                                        }}

                                   style={{
                                        textAlign: "center",
                                        paddingVertical: 4,
                                        fontFamily: 'Sora_800ExtraBold',
                                        fontSize: 32,color: colors.text
                                    }}>{matchData?.away.score}</MotiText>
                                </View>
                            </View> : !route.params?.data['data'].gameOutcome?.lastPeriodType &&  <View style={{
                                backgroundColor: colors.card,
                                paddingVertical: 5,
                                paddingHorizontal: 20,
                                borderRadius: 5,
                                flexDirection: 'row',
                                justifyContent: 'center'
                            }}>
                                <Text style={{
                                    fontFamily: 'Sora_500Medium',color: colors.text
                                }}>{formatAMPM(new Date(route.params.data?.data?.startTimeUTC))}</Text>
                            </View>

                        }
                        <View style={{
                            backgroundColor: colors.card,
                            width: 100,
                            paddingVertical: 5,
                            borderRadius: 5,
                            paddingHorizontal: 15,
                            opacity: 0
                        }}>
                            <Text style={{
                                textAlign: 'center',
                                fontFamily: 'Sora_500Medium',color: colors.text
                            }}>{route.params?.data['data']?.period > 3 ? "OT" : `P${route.params?.data['data'].period}`}</Text>
                        </View>
                    </View>



                    <View style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>
                        <View style={{backgroundColor: colors.card, borderRadius: 100}}>
                            <Text style={{
                                textAlign: "left",
                                paddingHorizontal: 15,
                                paddingVertical: 4,
                                fontFamily: 'Sora_500Medium',
                                fontSize: 20,color: colors.text
                            }}>{(parseFloat(stat.away > 0.0 ? stat.away : route.params?.data.prob.a) * 100).toFixed(0)}%</Text>
                        </View>
                        <SvgUri width={70} height={70} style={{
                            flexDirection: 'column',
                            justifyContent: 'center',
                            marginTop: 10,
                            marginLeft: 5
                        }}
                                uri={route.params?.data['data']['awayTeam']['logo']}/>
                        <Text style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 18,
                            textAlign: 'center',color: colors.text
                        }}>{AwayTeamName[0]['name']}</Text>
                        {ppData.a.a > ppData.h.a &&
                            <View style={{backgroundColor: '#f54242', borderRadius: 100, marginTop: 10}}>
                                <Text style={{
                                    textAlign: "left",
                                    paddingHorizontal: 15,
                                    paddingVertical: 4,
                                    fontFamily: 'Sora_500Medium',color: colors.background,
                                    fontSize: 20
                                }}>{ppData.h.a} on {ppData.a.a}</Text>

                            </View>}
                        {ppData.a.a > ppData.h.a &&
                            <Text style={{
                                textAlign: "center",
                                fontFamily: 'Sora_400Regular'
                                ,color: colors.text,
                                marginTop: 5,
                                fontSize: 16
                            }}>{ppData.a.t}</Text>}
                    </View>

                </View>

                <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                              unfilledColor={getPCTColor(route.params?.data.data.awayTeam.abbrev)} borderRadius={100}
                              borderWidth={0} style={{marginTop: 20}}
                              progress={stat.home > 0.0 ? stat.home : route.params.data.prob.h} height={12}
                              width={Dimensions.get('window').width - 20}/>
                <View style={{marginTop: 20}}>
                    <ScrollView showsHorizontalScrollIndicator={false} horizontal style={{
                        marginBottom: 20
                    }}>

                        {
                            route.params?.data['data']['goals'] !== undefined &&
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
                                </TouchableOpacity>
                        }

                        <TouchableOpacity style={tab === 2 ? styles.activeButton : styles.inactiveButton} onPress={() => {
                            setTab(2)
                            Haptics.selectionAsync()
                        }}
                                          onLongPress={() => {
                                              setHomeStat(!homeStat)
                                          }}
                        >
                            <Chart2 color={tab === 2 ? colors.background : colors.text}/>
                            <Text style={tab === 2 ? styles.activeText : styles.inactiveText}>{route.params?.data['data']['goals'] !== undefined ? "Game" : "Pregame"} Stats</Text>
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
                            route.params?.data['data']['goals'] !== undefined &&
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
                            route.params?.data['data']['goals'] !== undefined && <
                                TouchableOpacity style={tab === 4 ? styles.activeButton : styles.inactiveButton}
                                                 onPress={() => {
                                                     setTab(4)
                                                     Haptics.selectionAsync()
                                                 }}>

                                <UserRemove color={tab === 4 ? colors.background : colors.text}/>

                                <Text style={tab === 4 ? styles.activeText : styles.inactiveText}>Scratches</Text>
                            </TouchableOpacity>
                        }



                    </ScrollView>
                </View>
                <View>
                    {
                        !tab && route.params?.data['data']['goals'] !== undefined ?
                            <ScrollView style={{height: '100%'}} showsHorizontalScrollIndicator={false} horizontal>
                                {route.params?.data['data']['goals'].map((goal, i)=>{
                                    return <View style={{flexDirection: 'row'}}>
                                        <View>
                                            {(route.params?.data['data']['goals'][i]?.period !== route.params?.data['data']['goals'][i - 1]?.period) ?
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginBottom: 10,
                                                    textAlign: 'center',color: colors.text
                                                }}>Period {goal.period}</Text> : <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginBottom: 10,
                                                    textAlign: 'left',color: colors.text
                                                }}>‎ </Text>}
                                            <View onPress={() => {
                                            }} style={{
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
                                                }}>{goal.teamAbbrev}</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 14,
                                                    marginTop: 4,
                                                    textAlign: 'center',
                                                    opacity: .5,color: colors.text
                                                }}>{goal.homeScore} <Text style={{fontFamily: 'default'}}>•</Text> {goal.awayScore}</Text>
                                                <View style={{flexDirection: 'row', justifyContent: 'center'}}>
                                                    <Image style={{
                                                        borderRadius: 100,
                                                        borderWidth: 3,
                                                        height: 80,
                                                        width: 80,
                                                        marginTop: 10,
                                                        borderColor: `${getPCTColor(goal.teamAbbrev)}`,
                                                        backgroundColor: colors.card
                                                    }} source={{uri: goal.mugshot}}/>
                                                </View>

                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginTop: 10,
                                                    textAlign: 'center',
                                                    color: colors.text
                                                }}>{goal.name.default}</Text>
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 14,
                                                    marginTop: 4,
                                                    textAlign: 'center',
                                                    opacity: .5,color: colors.text
                                                }}>{goal.timeInPeriod} <Text style={{fontFamily: 'default'}}>•</Text> {goal.strength}</Text>
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
                                })}
                            </ScrollView> : tab === 2 && route.params?.data['data']['goals'] !== undefined ?
                                <View>

                                    <TouchableOpacity onPress={() => {
                                        getSIMData(!isReg)
                                        setIsReg(!isReg)
                                    }}>

                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.h.w).toFixed(2) * 100)}%</Text>
                                            <Text
                                                style={{fontFamily: 'Sora_500Medium', fontSize: 16,color: colors.text}}>{isReg ? "Reg." : "OT"} Win
                                                Playoff %</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.a.w).toFixed(2) * 100)}%</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={parseFloat(sim.h.w).toFixed(2) ?? 0} height={6}
                                                          width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}} progress={parseFloat(sim.a.w).toFixed(2) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => {
                                        getSIMData(!isReg)
                                        setIsReg(!isReg)
                                    }}>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.h.l).toFixed(2) * 100)}%</Text>
                                            <Text
                                                style={{fontFamily: 'Sora_500Medium', fontSize: 16,color: colors.text}}>{isReg ? "Reg." : "OT"} Loss
                                                Playoff %</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.a.l).toFixed(2) * 100)}%</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={parseFloat(sim.h.l).toFixed(2) ?? 0} height={6}
                                                          width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}} progress={parseFloat(sim.a.l).toFixed(2) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        setSelP(selP === 0 ? 1 : selP === 1 ? 2 : selP === 2 ? 3 : 0)
                                    }}>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,color: colors.text
                                            }}>{selP === 0 ? matchData?.home.sog : selP === 1 ? shotsP1.h : selP === 2 ? shotsP2.h : shotsP3.h}</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,color: colors.text
                                            }}>{selP === 0 ? "Shots On Goal" : selP === 1 ? "Period 1 Shots On Goal" : selP === 2 ? "Period 2 Shots On Goal" : "Period 3 Shots On Goal"}</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,color: colors.text
                                            }}>{selP === 0 ? matchData?.away.sog : selP === 1 ? shotsP1.a : selP === 2 ? shotsP2.a : shotsP3.a}</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={parseFloat(matchData?.home.sog) / (parseFloat(matchData?.home.sog) + parseFloat(matchData?.away.sog)) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={parseFloat(matchData?.away.sog) / (parseFloat(matchData?.home.sog) + parseFloat(matchData?.away.sog)) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                    </TouchableOpacity>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 16,color: colors.text
                                        }}>{Math.round((parseFloat(fullData?.homeFaceoffWinPercentage)).toFixed(2) * 100)}%</Text>
                                        <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16,color: colors.text}}>Faceoff Win Percentage</Text>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 16,color: colors.text
                                        }}>{Math.round((parseFloat(1 - fullData?.homeFaceoffWinPercentage)).toFixed(2) * 100)}%</Text>
                                    </View>

                                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                        <Progress.Bar animationType={"spring"}
                                                      color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                      unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                      style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                      progress={(parseFloat(fullData?.homeFaceoffWinPercentage)) ?? 0

                                                      } height={6}
                                                      width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                      unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                      style={{marginTop: 20}}
                                                      progress={1 - (parseFloat(fullData?.homeFaceoffWinPercentage)) ?? 0}
                                                      height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                    </View>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 16,color: colors.text
                                        }}>{Math.round((parseFloat(fullData?.homePercentOfEventsInOffensiveZone)) * 100)}%</Text>
                                        <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16,color: colors.text}}>Offensive Zone Time</Text>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 16,color: colors.text
                                        }}>{Math.round((parseFloat(1 - fullData?.homePercentOfEventsInOffensiveZone)) * 100)}%</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                        <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                      unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                      style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                      progress={((parseFloat(fullData?.homePercentOfEventsInOffensiveZone))) ?? 0}
                                                      height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                      unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                      style={{marginTop: 20}}
                                                      progress={(parseFloat(1 - fullData?.homePercentOfEventsInOffensiveZone)) ?? 0}
                                                      height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                    </View>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 16,color: colors.text
                                        }}>{parseFloat(fullData?.homeTeamExpectedGoals).toFixed(2)}</Text>
                                        <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16,color: colors.text}}>Expected Goals</Text>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 16,color: colors.text
                                        }}>{parseFloat(fullData?.awayTeamExpectedGoals).toFixed(2)}</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                        <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                      unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                      style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                      progress={matchData?.home.score / parseFloat(fullData?.homeTeamExpectedGoals).toFixed(2) ?? 0}
                                                      height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                      unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                      style={{marginTop: 20}}
                                                      progress={matchData?.away.score / parseFloat(fullData?.awayTeamExpectedGoals).toFixed(2) ?? 0}
                                                      height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                    </View>
                                    {matchData?.home.powerPlayConversion || matchData?.away.powerPlayConversion &&
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,color: colors.text
                                            }}>{Math.round((parseFloat(matchData?.home.powerPlayConversion?.split("/")[0]) / parseFloat(matchData?.home.powerPlayConversion.split("/")[1])).toFixed(2) * 100)}%</Text>
                                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>Power Play</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,color: colors.text
                                            }}>{Math.round((parseFloat(matchData?.away.powerPlayConversion?.split("/")[0]) / parseFloat(matchData?.away.powerPlayConversion.split("/")[1])) * 100)}%</Text>
                                        </View>
                                    }
                                    {matchData?.home.powerPlayConversion || matchData?.away.powerPlayConversion &&
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={parseFloat(matchData?.home.powerPlayConversion.split("/")[0]) / parseFloat(matchData?.home.powerPlayConversion.split("/")[1]) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}}
                                                          progress={parseFloat(matchData?.away.powerPlayConversion.split("/")[0]) / parseFloat(matchData?.away.powerPlayConversion.split("/")[1]) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>}
                                    {/*{matchData?.home.powerPlayConversion || matchData?.away.powerPlayConversion &&*/}
                                    {/*    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>*/}
                                    {/*        <Text style={{*/}
                                    {/*            fontFamily: 'Sora_500Medium',*/}
                                    {/*            fontSize: 16,color: colors.text*/}
                                    {/*        }}>{matchData?.home.pim}</Text>*/}
                                    {/*        <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>Penalty Minutes</Text>*/}
                                    {/*        <Text style={{*/}
                                    {/*            fontFamily: 'Sora_500Medium',*/}
                                    {/*            fontSize: 16,color: colors.text*/}
                                    {/*        }}>{matchData?.away.pim}</Text>*/}
                                    {/*    </View>}*/}
                                    {/*<View style={{flexDirection: 'row', justifyContent: 'space-between'}}>*/}
                                    {/*    <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}*/}
                                    {/*                  unfilledColor={colors.card} borderRadius={100} borderWidth={0}*/}
                                    {/*                  style={{marginTop: 20, transform: [{rotate: '180deg'}]}}*/}
                                    {/*                  progress={parseFloat(matchData?.home.pim) / (parseFloat(matchData?.home.pim) + parseFloat(matchData?.away.pim)) ?? 0}*/}
                                    {/*                  height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>*/}
                                    {/*    <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}*/}
                                    {/*                  unfilledColor={colors.card} borderRadius={100} borderWidth={0}*/}
                                    {/*                  style={{marginTop: 20}}*/}
                                    {/*                  progress={parseFloat(matchData?.away.pim) / (parseFloat(matchData?.home.pim) + parseFloat(matchData?.away.pim)) ?? 0}*/}
                                    {/*                  height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>*/}
                                    {/*</View>*/}
                                    {/*<View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>*/}
                                    {/*    <Text*/}
                                    {/*        style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{matchData?.home.blocks}</Text>*/}
                                    {/*    <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>Blocked Shots</Text>*/}
                                    {/*    <Text*/}
                                    {/*        style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{matchData?.away.blocks}</Text>*/}
                                    {/*</View>*/}
                                    {/*<View style={{flexDirection: 'row', justifyContent: 'space-between'}}>*/}
                                    {/*    <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}*/}
                                    {/*                  unfilledColor={colors.card} borderRadius={100} borderWidth={0}*/}
                                    {/*                  style={{marginTop: 20, transform: [{rotate: '180deg'}]}}*/}
                                    {/*                  progress={parseFloat(matchData?.home.blocks) / (parseFloat(matchData?.home.blocks) + parseFloat(matchData?.away.blocks)) ?? 0}*/}
                                    {/*                  height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>*/}
                                    {/*    <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}*/}
                                    {/*                  unfilledColor={colors.card} borderRadius={100} borderWidth={0}*/}
                                    {/*                  style={{marginTop: 20}}*/}
                                    {/*                  progress={parseFloat(matchData?.away.blocks) / (parseFloat(matchData?.home.blocks) + parseFloat(matchData?.away.blocks)) ?? 0}*/}
                                    {/*                  height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>*/}
                                    {/*</View>*/}
                                    {/*<View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>*/}
                                    {/*    <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{matchData?.home.hits}</Text>*/}
                                    {/*    <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>Hits</Text>*/}
                                    {/*    <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{matchData?.away.hits}</Text>*/}
                                    {/*</View>*/}
                                    {/*<View style={{flexDirection: 'row', justifyContent: 'space-between'}}>*/}
                                    {/*    <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}*/}
                                    {/*                  unfilledColor={colors.card} borderRadius={100} borderWidth={0}*/}
                                    {/*                  style={{marginTop: 20, transform: [{rotate: '180deg'}]}}*/}
                                    {/*                  progress={parseFloat(matchData?.home.hits) / (parseFloat(matchData?.home.hits) + parseFloat(matchData?.away.hits)) ?? 0}*/}
                                    {/*                  height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>*/}
                                    {/*    <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}*/}
                                    {/*                  unfilledColor={colors.card} borderRadius={100} borderWidth={0}*/}
                                    {/*                  style={{marginTop: 20}}*/}
                                    {/*                  progress={parseFloat(matchData?.away.hits) / (parseFloat(matchData?.home.hits) + parseFloat(matchData?.away.hits)) ?? 0}*/}
                                    {/*                  height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>*/}
                                    {/*</View>*/}

                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 24,
                                            marginTop: 20,color: colors.text
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

                                    <LineChart
                                        data={{

                                            datasets: [
                                                {
                                                    color: (opacity) => `${getPCTColor(homeStat ? route.params?.data.data.homeTeam.abbrev : route.params?.data.data.awayTeam.abbrev)}`,
                                                    strokeWidth: 2.5,
                                                    data: winData.map((r, i) => {
                                                        return isNaN(r) ? homeStat ? winData[i - 1] : (1 - (winData[i - 1] / 100)) * 100 : homeStat ? r : (1 - (r / 100)) * 100
                                                    })
                                                },
                                            ]
                                        }}
                                        width={Dimensions.get("window").width}
                                        height={250}
                                        yAxisSuffix="%"
                                        yAxisInterval={1}
                                        withHorizontalLines={true}
                                        withVerticalLines={false}
                                        withDots={false}
                                        withShadow
                                        chartConfig={{
                                            backgroundColor: `rgba(255, 255, 255, 0)`,
                                            useShadowColorFromDataset: true,
                                            fillShadowGradientFromOpacity: 0,
                                            fillShadowGradientToOpacity: 0,
                                            backgroundGradientFrom: `${getPCTColor(homeStat ? route.params?.data.data.homeTeam.abbrev : route.params?.data.data.awayTeam.abbrev)}`,
                                            backgroundGradientFromOpacity: 0,
                                            backgroundGradientTo: "#fff",
                                            backgroundGradientToOpacity: 0,
                                            decimalPlaces: 0,
                                            color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                            labelColor: (opacity = 1) => colors.text,
                                            strokeWidth: 3,
                                            barPercentage: 10
                                        }}
                                        bezier
                                        style={{
                                            marginVertical: 8,
                                            marginLeft: -20,
                                            marginBottom: 30
                                        }}
                                    />

                                </View>

                                : tab === 2 && !(route.params?.data['data']['goals'] !== undefined) ? <View>
                                    <TouchableOpacity onPress={() => {
                                        getSIMData(!isReg)
                                        setIsReg(!isReg)

                                    }}>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.h.w).toFixed(2) * 100)}%</Text>
                                            <Text
                                                style={{fontFamily: 'Sora_500Medium', fontSize: 16,color: colors.text}}>{isReg ? "REG" : "OT"} Win
                                                Playoff %</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.a.w).toFixed(2) * 100)}%</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={parseFloat(sim.h.w).toFixed(2) ?? 0} height={6}
                                                          width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}} progress={parseFloat(sim.a.w).toFixed(2) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        getSIMData(!isReg)
                                        setIsReg(!isReg)

                                    }}>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.h.l).toFixed(2) * 100)}%</Text>
                                            <Text
                                                style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{isReg ? "REG" : "OT"} Loss
                                                Playoff %</Text>
                                            <Text style={{
                                                fontFamily: 'Sora_500Medium',
                                                fontSize: 16,
                                                width: 60,color: colors.text
                                            }}>{Math.round(parseFloat(sim.a.l).toFixed(2) * 100)}%</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20, transform: [{rotate: '180deg'}]}}
                                                          progress={parseFloat(sim.h.l).toFixed(2) ?? 0} height={6}
                                                          width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)}
                                                          unfilledColor={colors.card} borderRadius={100} borderWidth={0}
                                                          style={{marginTop: 20}} progress={parseFloat(sim.a.l).toFixed(2) ?? 0}
                                                          height={6} width={(Dimensions.get('window').width - 20) / 2 - 2.5}/>
                                        </View>
                                    </TouchableOpacity>
                                </View> : tab === 3 ?

                                    <ScrollView>


                                        {/*<View style={{*/}
                                        {/*    height: (Dimensions.get('window').width - 20) / 2.3529,*/}
                                        {/*    borderRadius: 30,*/}
                                        {/*    width: '100%',*/}
                                        {/*    backgroundColor: 'black'*/}
                                        {/*}}>*/}
                                        {/*    <View style={{*/}
                                        {/*        position: 'absolute',*/}
                                        {/*        backgroundColor: 'white',*/}
                                        {/*        top: ((((Dimensions.get('window').width - 20) / 2) / 2.3529) + scaleCoordinates(playByPlay[selectedEvent].x, playByPlay[selectedEvent].y, Dimensions.get('window').width - 20, (Dimensions.get('window').width - 20) / 2.35).scaledY) - 5,*/}
                                        {/*        left: ((((Dimensions.get('window').width) - 20) / 2) + scaleCoordinates(playByPlay[selectedEvent].x, playByPlay[selectedEvent].y, Dimensions.get('window').width - 20, (Dimensions.get('window').width - 20) / 2.35).scaledX) - 5,*/}
                                        {/*        height: 10,*/}
                                        {/*        width: 10,*/}
                                        {/*        borderRadius: 10*/}
                                        {/*    }}></View>*/}
                                        {/*</View>*/}
                                        {
                                            playByPlay && playByPlay.reverse().map((play, i) => {
                                                if (play.type !== "PGSTR" && play.type !== "PGEND" && play.type !== "ANTHEM") {
                                                    return play.type && <TouchableOpacity key={play.type + i} onPress={() => {
                                                        Haptics.selectionAsync().then(r => {
                                                            setSelectedEvent(i + 1)
                                                        });

                                                    }} style={{
                                                        backgroundColor: colors.card,
                                                        marginBottom: 4,
                                                        paddingVertical: 15,
                                                        paddingHorizontal: 10,
                                                        borderRadius: 15
                                                    }}>

                                                        <View style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between'
                                                        }}>
                                                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                                                <Text style={{
                                                                    fontFamily: 'Sora_700Bold',
                                                                    fontSize: 16,
                                                                    color: `${play.raw.split(' ')[0].length === 3 ? getPCTColor(play.raw.split(' ')[0]) : colors.text}`
                                                                }}>{play.raw.split(' ')[0]}</Text>


                                                                {play.type === "SHOT" ?
                                                                    <Svg style={{marginHorizontal: 5}}
                                                                         xmlns="http://www.w3.org/2000/svg"
                                                                         width="24" height="24"
                                                                         viewBox="0 0 24 24" fill="none" stroke="black"
                                                                         strokeWidth="1.5"
                                                                         strokeLinecap="round" strokeLinejoin="round"
                                                                         className="feather feather-crosshair">
                                                                        <Circle cx="12" cy="12" r="10"></Circle>
                                                                        <Line x1="22" y1="12" x2="18" y2="12"></Line>
                                                                        <Line x1="6" y1="12" x2="2" y2="12"></Line>
                                                                        <Line x1="12" y1="6" x2="12" y2="2"></Line>
                                                                        <Line x1="12" y1="22" x2="12" y2="18"></Line>
                                                                    </Svg>
                                                                    : play.type === "HIT" ? <Flash style={{marginHorizontal: 5}}
                                                                                                   color={"#000"}/> : play.type === "MISS" ?
                                                                        <CloseCircle style={{marginHorizontal: 5}}
                                                                                     color={"#000"}/> : play.type === "BLOCK" ?
                                                                            <User style={{marginHorizontal: 5}}
                                                                                  color={"#000"}/> : play.type === "FAC" ?
                                                                                <Profile2User style={{marginHorizontal: 5}}
                                                                                              color={"#000"}/> : play.type === "STOP" ?
                                                                                    <TimerPause style={{marginHorizontal: 5}}
                                                                                                color={"#000"}/> : (play.type === "GEND" || play.type === "PEND") ?
                                                                                        <Clock style={{marginHorizontal: 5}}
                                                                                               color={"#000"}/> : play.type === "GIVE" ?
                                                                                            <ExportCircle
                                                                                                style={{marginHorizontal: 5}}
                                                                                                color={"#000"}/> : play.type === "TAKE" ?
                                                                                                <ImportCircle
                                                                                                    style={{marginHorizontal: 5}}
                                                                                                    color={"#000"}/> : play.type === "GOAL" &&
                                                                                                    <Svg
                                                                                                        style={{marginHorizontal: 5}}
                                                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                                                        width="24" height="24"
                                                                                                        viewBox="0 0 24 24"
                                                                                                        fill="none"
                                                                                                        stroke="red"
                                                                                                        strokeWidth="1.5"
                                                                                                        strokeLinecap="round"
                                                                                                        strokeLinejoin="round"
                                                                                                        className="feather feather-crosshair">
                                                                                                        <Circle cx="12" cy="12"
                                                                                                                r="10"></Circle>
                                                                                                        <Line x1="22" y1="12"
                                                                                                              x2="18"
                                                                                                              y2="12"></Line>
                                                                                                        <Line x1="6" y1="12" x2="2"
                                                                                                              y2="12"></Line>
                                                                                                        <Line x1="12" y1="6" x2="12"
                                                                                                              y2="2"></Line>
                                                                                                        <Line x1="12" y1="22"
                                                                                                              x2="12"
                                                                                                              y2="18"></Line>
                                                                                                    </Svg>
                                                                }

                                                                <Text style={{
                                                                    fontFamily: 'Sora_400Regular',
                                                                    fontSize: 16,
                                                                    color: colors.text
                                                                }}>{parseEvent(play.type)}</Text>
                                                            </View>
                                                            <Text style={{color: colors.text}}>{play.shot}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                }
                                            })
                                        }
                                        <View style={{height: 100}}></View>
                                    </ScrollView> : tab === 4 ?
                                        <ScrollView style={{height: 400}} horizontal
                                                    showsVerticalScrollIndicator={false}>

                                            {gameInfo.home.map((player, i) => {
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
                                            })}
                                            <View style={{
                                                height: '50%',
                                                borderWidth: 1,
                                                borderStyle: 'dotted',
                                                borderColor: 'black',
                                                opacity: .3,
                                                marginHorizontal: 10
                                            }}/>
                                            {gameInfo.away.map((player, i) => {
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
                                            })}


                                        </ScrollView> : tab === 5 &&  <ScrollView horizontal>
                                            <View>
                                                <Text style={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    fontSize: 16,
                                                    marginBottom: 10,
                                                    textAlign: 'left',
                                                    color: colors.text
                                                }}>{route.params.data.data.homeTeam.abbrev}</Text>
                                                <Table>
                                                    <Row textStyle={{fontFamily: 'Sora_600SemiBold'}} widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]} data={["Pos", "Name", "Goals", "Assists", "Shots", "TOI", "Blocks", "Hits", "+/-"]}/>
                                                    {playerStats.h && playerStats.h?.sort(sort_by('goals', true, parseInt)).map((player) => {
                                                        return <Row textStyle={{fontFamily: 'Sora_500Medium', marginTop: 10,color: colors.text}} widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]} data={[ player.position, player.name.default, player.goals, player.assists, player.shots, player.toi, player.blockedShots, player.hits, player.plusMinus]}/>
                                                    })}
                                                    <View style={{width: '100%', borderWidth: 2, borderColor: 'black', opacity: .5, borderStyle: 'dotted', marginVertical: 10}}/>
                                                    <Row textStyle={{fontFamily: 'Sora_600SemiBold',color: colors.text}} widthArr={[60, 120, 100, 100, 100, 100]} data={["Pos", "Name", "Save %", "Saved", "GA", "TOI"]}/>

                                                    {playerStats.g.h && playerStats.g.h?.sort(sort_by('goalsAgainst', true, parseFloat)).map((player) => {
                                                        return <Row textStyle={{fontFamily: 'Sora_500Medium', marginTop: 10,color: colors.text}} widthArr={[60, 120, 100, 100, 100, 100]} data={[ player.position, player.name.default, player.savePctg ?? 0, player.saveShotsAgainst, player.goalsAgainst, player.toi]}/>
                                                    })}
                                                </Table>
                                                <View style={{marginTop: 40}}>
                                                    <Text style={{
                                                        fontFamily: 'Sora_600SemiBold',
                                                        fontSize: 16,
                                                        textAlign: 'left',color: colors.text

                                                    }}>{route.params.data.data.awayTeam.abbrev}</Text>
                                                    <Table>
                                                        <Row textStyle={{fontFamily: 'Sora_600SemiBold'}} widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]} data={["Pos", "Name", "Goals", "Assists", "Shots", "TOI", "Blocks", "Hits", "+/-"]}/>
                                                        {playerStats.a && playerStats.a?.sort(sort_by('goals', true, parseInt)).map((player) => {
                                                            return <Row textStyle={{fontFamily: 'Sora_500Medium', color: colors.text, marginTop: 10}} widthArr={[60, 120, 100, 100, 100, 100, 100, 100, 100]} data={[ player.position, player.name.default, player.goals, player.assists, player.shots, player.toi, player.blockedShots, player.hits, player.plusMinus]}/>
                                                        })}
                                                        <View style={{width: '100%', borderWidth: 2, borderColor: 'black', opacity: .5, borderStyle: 'dotted', marginVertical: 10}}/>
                                                        <Row textStyle={{fontFamily: 'Sora_600SemiBold', color: colors.text}} widthArr={[60, 120, 100, 100, 100, 100]} data={["Pos", "Name", "Save %", "Saved", "GA", "TOI"]}/>

                                                        {playerStats.g.a && playerStats.g.a?.sort(sort_by('goalsAgainst', true, parseFloat)).map((player) => {
                                                            return <Row textStyle={{fontFamily: 'Sora_500Medium', marginTop: 10,color: colors.text}} widthArr={[60, 120, 100, 100, 100, 100]} data={[ player.position, player.name.default, player.savePctg ?? 0, player.saveShotsAgainst, player.goalsAgainst, player.toi]}/>
                                                        })}
                                                    </Table>


                                                </View>

                                            </View>





                                        </ScrollView>



                    }
                    <View style={{paddingBottom: tab === 5 ? 100 : 0}}/>


                </View>
            </ScrollView>


        </SafeAreaView>
    </View>


}

