import BottomSheet from "@gorhom/bottom-sheet";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {Activity, Calendar} from "iconsax-react-native";
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
import {LineChart} from "react-native-chart-kit";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import teamData from "../teams";


export default function Team() {

    const bottomSheetRef = useRef(null);

    const snapPoints = useMemo(() => ['1%', '75%'], []);

    const [selectedTeam, setSelectedTeam] = useState("NYI")


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

    function getPCTColor(teamCode) {
        let team = teamData.filter((item) => {
            return (item.abbreviation === teamCode);
        })
        return team[0]?.primary_color;
    }


    const styles = StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100%',
            backgroundColor: 'white'
        },
        inactiveButton: {
            backgroundColor: '#f7f7f7',
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderRadius: 100,
            marginRight: 10,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center'
        },

        inactiveText: {
            color: 'black',
            fontFamily: 'Sora_500Medium', textAlign: 'center'
        },

        activeButton: {
            backgroundColor: '#000',
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderRadius: 100,
            marginRight: 10,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center'
        },

        activeText: {
            color: 'white',
            fontFamily: 'Sora_600SemiBold', textAlign: 'center'
        }

    });

    const [schedule, setSchedule] = useState([])

    function formatAMPM(date) {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        let strTime = hours + ':' + minutes + ' ' + ampm;
        return strTime;
    }

    const [isWeek, setIsWeek] = useState(true)


    const [timeline, setTimeline] = useState([])
    const [timelineFO, setTimelineFO] = useState([])
    const [timelineSD, setTimelineSD] = useState([])
    const [timelinePD, setTimelinePD] = useState([])
    const [timelineGD, setTimelineGD] = useState([])
    const [timelineTD, setTimelineTD] = useState([])
    const [timelineLDD, setTimelineHDD] = useState([])
    const [timelineHDD, setTimelineLDD] = useState([])
    const [timelineMD, setTimelineMD] = useState([])

    const [timelineHD, setTimelineHD] = useState([])

    const getSchedule = (type, code) => {

        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch(`https://api-web.nhle.com/v1/club-schedule/${code}/${type ? "week" : "month"}/now`, requestOptions)
            .then(response => response.text())
            .then(result => {
                setSchedule(JSON.parse(result)['games'])
            })
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



    const getTimeLine = (code) => {


        Papa.parse(
            `https://moneypuck.com/moneypuck/playerData/teamGameByGame/2023/regular/${code}.csv`,
            {
                ...commonConfig,
                header: true,
                download: true,
                complete: (resultG) => {
                    const g = resultG.data.filter((goalie) => {
                        return goalie.situation === "all"
                    })



                    const chartData = g.map((d, i) => {
                        return parseFloat(d?.goalsFor - d?.goalsAgainst)
                    })

                    const foData = g.map((d, i) => {
                        return (parseFloat(d?.faceOffsWonFor) / (parseFloat(d?.faceOffsWonFor) + parseFloat(d?.faceOffsWonAgainst))) * 100
                    })

                    const sDiffData = g.map((d, i) => {
                        return (parseFloat(d?.shotAttemptsFor) - parseFloat(d?.shotAttemptsAgainst))
                    })

                    const pDiffData = g.map((d, i) => {
                        return (parseFloat(d?.penalityMinutesAgainst) - parseFloat(d?.penalityMinutesFor))
                    })
                    const gDiffData = g.map((d, i) => {
                        return (parseFloat(d?.giveawaysAgainst) - parseFloat(d?.giveawaysFor))
                    })
                    const tDiffData = g.map((d, i) => {
                        return (parseFloat(d?.takeawaysAgainst) - parseFloat(d?.takeawaysFor))
                    })

                    const ldDiffData = g.map((d, i) => {
                        return (parseFloat(d?.lowDangerShotsFor) - parseFloat(d?.lowDangerShotsAgainst))
                    })
                    const hdiffData = g.map((d, i) => {
                        return (parseFloat(d?.highDangerShotsFor) - parseFloat(d?.highDangerShotsAgainst))
                    })

                    const mdiffData = g.map((d, i) => {
                        return (parseFloat(d?.missedShotsFor) - parseFloat(d?.missedShotsAgainst))
                    })

                    const htdiffData = g.map((d, i) => {
                        return (parseFloat(d?.hitsFor) - parseFloat(d?.hitsAgainst))
                    })

                    setTimeline(accumulateArrayValues(chartData))
                    setTimelineFO(foData)
                    setTimelineSD(accumulateArrayValues(sDiffData))
                    setTimelinePD(accumulateArrayValues(pDiffData))
                    setTimelineGD(accumulateArrayValues(gDiffData))
                    setTimelineTD(accumulateArrayValues(tDiffData))

                    setTimelineLDD(accumulateArrayValues(ldDiffData))
                    setTimelineHDD(accumulateArrayValues(hdiffData))

                    setTimelineMD(accumulateArrayValues(mdiffData))
                    setTimelineHD(accumulateArrayValues(htdiffData))

                }
            }
        );
    }

    const [stats, setStats] = useState({w: 0, l: 0, o: 0, d: "", s: 0})

    const getTeamData = (code) => {

        let requestOptions = {
            method: 'GET',
            redirect: 'follow'
        };

        fetch("https://api-web.nhle.com/v1/standings/now", requestOptions)
            .then(response => response.text())
            .then(result => {

                const d = JSON.parse(result).standings.filter((t, i) => {
                    return t.teamAbbrev.default === `${code}`
                })


                setStats({
                    w: d[0].wins,
                    l: d[0].losses,
                    o: d[0].otLosses,
                    d: !(d[0].wildcardSequence > 0 && d[0].wildcardSequence < 3) ? d[0].divisionName : d[0].wildcardSequence,
                    s: !(d[0].wildcardSequence > 0 && d[0].wildcardSequence < 3) ? d[0].divisionSequence : "Wildcard",
                })

            })
    }





    useEffect(() => {
        getSchedule(true, "NYI")
        getTimeLine("NYI")
        getTeamData("NYI")
    }, [])

    let commonConfig = {delimiter: ","};

    function convertUTCtoMMDD(utcDateString) {
        // Parse the UTC date string
        const utcDate = new Date(utcDateString);

        // Extract month and day
        const month = (utcDate.getUTCMonth() + 1).toString(); // Months are zero-based
        const day = (utcDate.getUTCDate() - 1).toString();

        // Format as MM/DD
        return `${month.replace(/^0+/, '')}/${day.replace(/^0+/, '')}`;
    }

    const [tab, setTab] = useState(0)


    const Match = (props) => {

        const [hwp, setHWP] = useState(0);

        const game = props.game


        if (!hwp) {
            Papa.parse(
                `https://moneypuck.com/moneypuck/predictions/${game?.id}.csv`,
                {
                    ...commonConfig,
                    header: true,
                    download: true,
                    complete: (result) => {
                        setHWP(game.homeTeam.abbrev === `${selectedTeam}` ? 1 - parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore) : parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore));
                    }
                }
            );
        }


        return <View
            style={{
                backgroundColor: '#f7f7f7',
                marginBottom: 4,
                paddingVertical: 15,
                borderRadius: 15

            }}>
            <View style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <View style={{
                    alignItems: 'center'
                }}>

                    <Image style={{
                        height: 50, width: 70, transform: [{scale: .7}], flexDirection: 'column',
                        justifyContent: 'center'
                    }} source={assets[teamAbbreviations.indexOf(game.homeTeam.abbrev)]}/>
                    <Text style={{color: 'black', fontFamily: 'Sora_500Medium'}}>{game.homeTeam.abbrev}</Text>
                </View>
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{backgroundColor: '', borderRadius: 100, paddingRight: 15}}>
                        <Text style={{
                            textAlign: "right",
                            paddingVertical: 4,
                            fontFamily: 'Sora_700Bold',
                            fontSize: 20,
                            width: 60
                        }}>{(game.awayTeam.abbrev === `${selectedTeam}`) ? `${Math.round(parseFloat(hwp).toFixed(2) * 100)}%` : `${Math.round(parseFloat(1 - hwp).toFixed(2) * 100)}%`}</Text>
                    </View>
                    <View>
                        <View style={{
                            backgroundColor: 'white',
                            paddingVertical: 5,
                            borderRadius: 5,
                            paddingHorizontal: 15
                        }}>
                            <Text style={{
                                color: 'black',
                                textAlign: 'center',
                                fontFamily: 'Sora_500Medium'
                            }}>{convertUTCtoMMDD(game.startTimeUTC)}</Text>
                        </View>
                        <View style={{
                            backgroundColor: 'white',
                            paddingVertical: 5,
                            borderRadius: 5,
                            paddingHorizontal: 15,
                            marginTop: 10
                        }}>
                            <Text style={{
                                color: 'black',
                                textAlign: 'center',
                                fontFamily: 'Sora_500Medium'
                            }}>{formatAMPM(new Date(game.startTimeUTC))}</Text>
                        </View>
                    </View>
                    <View style={{backgroundColor: '', borderRadius: 100, paddingLeft: 15}}>
                        <Text style={{
                            textAlign: "left",
                            paddingVertical: 4,
                            fontFamily: 'Sora_700Bold',
                            fontSize: 20,
                            width: 60
                        }}>{game.homeTeam.abbrev === `${selectedTeam}` ? `${Math.round(parseFloat(hwp).toFixed(2) * 100)}%` : `${Math.round(parseFloat(1 - hwp).toFixed(2) * 100)}%`}</Text>
                    </View>
                </View>

                <View style={{
                    alignItems: 'center'
                }}>

                    <Image style={{
                        height: 50, width: 70, transform: [{scale: .7}], flexDirection: 'column',
                        justifyContent: 'center'
                    }} source={assets[teamAbbreviations.indexOf(game.awayTeam.abbrev)]}/>
                    <Text style={{color: 'black', fontFamily: 'Sora_500Medium'}}>{game.awayTeam.abbrev}</Text>
                </View>
            </View>
        </View>
    }

    return (
        <GestureHandlerRootView>
            <View style={styles.container}>
                <TouchableOpacity

                    onPress={()=>{
                        Haptics.selectionAsync().then(()=>{})

                        bottomSheetRef.current.expand()
                    }}

                    style={{
                    backgroundColor: `${getPCTColor(`${selectedTeam}`)}`,
                    paddingTop: 75,
                    width: '100%',
                    paddingHorizontal: 10,
                    paddingBottom: 20,
                    borderRadius: 0,
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                    alignItems: 'center'
                }}>
                    {assets ?
                        <Image style={{
                            height: 50, width: 70, flexDirection: 'column',
                            justifyContent: 'center'
                        }} source={assets[teamAbbreviations.indexOf(`${selectedTeam}`)]}/> : <></>}
                    <View>
                        <Text style={{fontFamily: 'Sora_500Medium', fontSize: 24, color: 'white'}}>{
                            teamData.filter((t)=>{
                                return t.abbreviation === selectedTeam
                            })[0].name
                        }
                        </Text>
                        <Text style={{
                            fontFamily: 'Sora_500Medium',
                            fontSize: 16,
                            color: 'white',
                            opacity: .7
                        }}>{stats.w}-{stats.l}-{stats.o} • {stats.s}{stats.s === 4 || stats.s === 5 || stats.s === 6 || stats.s === 7 ? "th" : stats.s === 3 ? "rd" : stats.s === 2 ? "nd" : stats.s !== "Wildcard" ? "st" : ""} {stats.d}</Text>
                    </View>
                </TouchableOpacity>
                <SafeAreaView style={{width: '100%'}}>
                    <View>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            marginBottom: 20, marginHorizontal: 10,
                            marginTop: 20
                        }}>


                            <TouchableOpacity style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                                              onPress={() => {
                                                  setTab(0)
                                                  Haptics.selectionAsync()
                                              }}>
                                <Calendar color={tab === 0 ? "white" : "black"}/>

                                <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Schedule</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={tab === 1 ? styles.activeButton : styles.inactiveButton}
                                              onPress={() => {
                                                  setTab(1)
                                                  Haptics.selectionAsync()
                                              }}>
                                <Activity color={tab === 1 ? "white" : "black"}/>
                                <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Season Stats</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {!tab ?
                    <View style={{marginHorizontal: 10}}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Text style={{
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 24
                            }}>This Weeks Games</Text>

                        </View>


                        <ScrollView style={{height: '100%', marginTop: 20}} showsVerticalScrollIndicator={false}>
                            {schedule?.map((game, i) => {
                                return <Match game={game}/>
                            })}

                        </ScrollView>

                    </View> :
                        <ScrollView style={{marginHorizontal: 10}}>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Goal Differential</Text>
                            {timeline ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timeline.map((r, i) => {
                                                    return isNaN(r) ? 1 : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: '#fff',
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Faceoff Win %</Text>
                            {timelineFO ? <LineChart
                                data={{
                                    datasets: [
                                        {
                                            color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                            strokeWidth: 2,
                                            data: timelineFO.map((r, i) => {
                                                return isNaN(r) ? timelineFO[i-1] : r
                                            })
                                        },
                                    ]
                                }}
                                width={Dimensions.get("window").width}
                                height={220}
                                yAxisInterval={1}
                                withHorizontalLines={true}
                                withVerticalLines={false}
                                yAxisSuffix={"%"}
                                withDots={false}
                                withShadow
                                chartConfig={{
                                    backgroundColor: `rgba(255, 255, 255, 0)`,

                                    useShadowColorFromDataset: true,
                                    fillShadowGradientFromOpacity: 0,
                                    fillShadowGradientToOpacity: 0,
                                    backgroundGradientFrom: "#fff",
                                    backgroundGradientFromOpacity: 0,
                                    backgroundGradientTo: "#fff",
                                    backgroundGradientToOpacity: 0,
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                    strokeWidth: 2,
                                    barPercentage: 10
                                }}
                                bezier
                                style={{
                                    marginVertical: 8,
                                    marginLeft: -20,
                                }}
                            /> : <></> }

                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Penalty Minutes Differential</Text>
                            {timelinePD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelinePD.map((r, i) => {
                                                    return isNaN(r) ? timelinePD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Giveaway Differential</Text>
                            {timelineGD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelineGD.map((r, i) => {
                                                    return isNaN(r) ? timelineGD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Takeaway Differential</Text>
                            {timelineTD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelineTD.map((r, i) => {
                                                    return isNaN(r) ? timelineTD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Shot Differential</Text>
                            {timelineSD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelineSD.map((r, i) => {
                                                    return isNaN(r) ? timelineSD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Low Danger Shots Differential</Text>
                            {timelineLDD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelineLDD.map((r, i) => {
                                                    return isNaN(r) ? timelineLDD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>High Danger Shots Differential</Text>
                            {timelineHDD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelineHDD.map((r, i) => {
                                                    return isNaN(r) ? timelineHDD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Missed Shot Differential</Text>
                            {timelineMD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelineMD.map((r, i) => {
                                                    return isNaN(r) ? timelineMD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, marginBottom: 10}}>Hits Differential</Text>
                            {timelineHD ?
                                <LineChart
                                    data={{
                                        datasets: [
                                            {
                                                color: (opacity) => `${getPCTColor(`${selectedTeam}`)}`,
                                                strokeWidth: 2,
                                                data: timelineHD.map((r, i) => {
                                                    return isNaN(r) ? timelineHD[i-1] : r
                                                })
                                            },
                                        ]
                                    }}
                                    width={Dimensions.get("window").width}
                                    height={220}
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
                                        backgroundGradientFrom: "#fff",
                                        backgroundGradientFromOpacity: 0,
                                        backgroundGradientTo: "#fff",
                                        backgroundGradientToOpacity: 0,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(0, 0, 0, 1)`,
                                        strokeWidth: 2,
                                        barPercentage: 10
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        marginLeft: -20,
                                    }}
                                /> : <></> }
                            <View style={{marginBottom: 250}}/>
                        </ScrollView>

                    }


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
                        <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 24, marginBottom: 20}}>Select a Team</Text>
                        <ScrollView>
                        {teamData.map((team, i)=>{
                            return <TouchableOpacity onPress={()=>{
                                Haptics.selectionAsync().then(()=>{})
                                setSelectedTeam(team.abbreviation)
                                getTimeLine(team.abbreviation)
                                getTeamData(team.abbreviation)
                                getSchedule(true, team.abbreviation)
                                bottomSheetRef.current.collapse()

                            }}>
                                <Text style={{fontFamily: 'Sora_500Medium', fontSize: 20, marginBottom: 20}}>{team.name}</Text>
                            </TouchableOpacity>
                        })}
                        </ScrollView>
                        <View style={{paddingTop: 100}}/>
                    </View>
                </BottomSheet>
            </View>
        </GestureHandlerRootView>
    );


}
