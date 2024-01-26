import BottomSheet from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {useTheme} from "@react-navigation/native";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {Activity, Calendar, User} from "iconsax-react-native";
import {MotiView} from "moti";
import {Skeleton} from "moti/skeleton";
import Papa from "papaparse";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import DataLineChart from "../components/Chart";
import {PlayerSkeleton} from "../components/Skeleton";
import {teamAbbreviations, teamAbbreviationsWithLightImages} from "../helpers/assetsLoader";
import {getTeamColor} from "../helpers/UI";
import teamData from "../teams";

export default function Home({navigation}) {

    const bottomSheetRef = useRef(null);

    const snapPoints = useMemo(() => ['75%'], []);

    const [selectedTeam, setSelectedTeam] = useState(null)

    const {colors} = useTheme();


    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);

    const getData = async () => {
        try {
            const value = await AsyncStorage.getItem('team');
            if (value !== null) {
                setSelectedTeam(value)
                return value
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

    const [schedule, setSchedule] = useState(null)

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

    const [roster, setRoster] = useState([])


    const getRoster = (code) => {

        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch(`https://api-web.nhle.com/v1/roster/${code}/current`, requestOptions)
            .then(response => response.text())
            .then(result => {
                setRoster(JSON.parse(result))
            })

    }

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

    function getWeekNameOrDate(dateInput) {
        // Get today's date
        var today = new Date();

        // Extract month and day from the input
        var parts = dateInput.split('/');
        var month = parseInt(parts[0], 10) - 1; // Adjust for 0-indexed months
        var day = parseInt(parts[1], 10);

        // Create a new date object for the input date this year
        var inputDate = new Date(today.getFullYear(), month, day);

        // Get the day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday)
        var dayOfWeek = inputDate.getDay();

        // Define an array of day names
        var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Get the name of the day for the input date
        var dayName = dayNames[dayOfWeek];

        return dayName;
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
                    s: !(d[0].wildcardSequence > 0 && d[0].wildcardSequence < 3) ? d[0].divisionSequence : "Wildcard"
                })

            })
    }


    useEffect(() => {

        getData().then(r => {
            getSchedule(true, r)
            getTimeLine(r)
            getTeamData(r)
            getRoster(r)
        })
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
                backgroundColor: colors.card,
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
                    <Text style={{color: colors.text, fontFamily: 'Sora_500Medium'}}>{game.homeTeam.abbrev}</Text>
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
                            width: 60,
                            color: colors.text
                        }}>{(game.awayTeam.abbrev === `${selectedTeam}`) ? `${Math.round(parseFloat(hwp).toFixed(2) * 100)}%` : `${Math.round(parseFloat(1 - hwp).toFixed(2) * 100)}%`}</Text>
                    </View>
                    <View>
                        <View style={{
                            backgroundColor: colors.background,
                            paddingVertical: 5,
                            borderRadius: 15,
                            paddingHorizontal: 15
                        }}>
                            <Text style={{
                                color: colors.text,
                                textAlign: 'center',
                                fontFamily: 'Sora_500Medium'

                            }}>{getWeekNameOrDate(convertUTCtoMMDD(game.startTimeUTC))}</Text>
                        </View>
                        <View style={{
                            backgroundColor: colors.background,
                            paddingVertical: 5,
                            borderRadius: 15,
                            paddingHorizontal: 15,
                            marginTop: 4
                        }}>
                            <Text style={{
                                textAlign: 'center',
                                color: colors.text,
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
                            width: 60,
                            color: colors.text
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
                    <Text style={{fontFamily: 'Sora_500Medium', color: colors.text}}>{game.awayTeam.abbrev}</Text>
                </View>
            </View>
        </View>
    }

    return (
        <GestureHandlerRootView>
            <View style={styles.container}>
                <TouchableOpacity

                    onPress={() => {
                        Haptics.selectionAsync().then(() => {
                        })
                        bottomSheetRef.current.expand()
                    }}

                    style={{
                        backgroundColor: `${getTeamColor(`${selectedTeam}`, colors)}`,
                        paddingTop: 75,
                        width: '100%',
                        paddingHorizontal: 10,
                        paddingBottom: 20,
                        borderRadius: 0,
                        flexDirection: 'row',
                        justifyContent: 'flex-start',
                        alignItems: 'center'
                    }}>
                    {assets && selectedTeam &&
                        <Image style={{
                            height: 50, width: 70, flexDirection: 'column',
                            justifyContent: 'center'
                        }} source={assets[teamAbbreviations.indexOf(`${selectedTeam}`)]}/>}
                    <View>
                        <Text style={{fontFamily: 'Sora_500Medium', fontSize: 24, color: 'white'}}>{
                            teamData.filter((t) => {
                                return t.abbreviation === selectedTeam
                            })[0]?.name
                        }
                        </Text>
                        <Text style={{
                            fontFamily: 'Sora_500Medium',
                            fontSize: 16,
                            color: 'white',
                            opacity: .7
                        }}>{stats.w}<Text style={{fontFamily: ""}}>•</Text>{stats.l}<Text
                            style={{fontFamily: ""}}>•</Text>{stats.o} <Text
                            style={{fontFamily: 'default'}}>•</Text> {stats.s}{stats.s === 4 || stats.s === 5 || stats.s === 6 || stats.s === 7 ? "th" : stats.s === 3 ? "rd" : stats.s === 2 ? "nd" : stats.s !== "Wildcard" ? "st" : ""} {stats.d}
                        </Text>
                    </View>
                </TouchableOpacity>
                <SafeAreaView style={{width: '100%'}}>
                    <View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{
                            marginBottom: 20, marginHorizontal: 10,
                            marginTop: 20
                        }}>


                            <TouchableOpacity style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                                              onPress={() => {
                                                  setTab(0)
                                                  Haptics.selectionAsync()
                                              }}>
                                <Calendar color={tab === 0 ? colors.background : colors.text}/>

                                <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Schedule</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={tab === 1 ? styles.activeButton : styles.inactiveButton}
                                              onPress={() => {
                                                  setTab(1)
                                                  Haptics.selectionAsync()
                                              }}>
                                <Activity color={tab === 1 ? colors.background : colors.text}/>
                                <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Season Stats</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={tab === 2 ? styles.activeButton : styles.inactiveButton}
                                              onPress={() => {
                                                  setTab(2)
                                                  Haptics.selectionAsync()
                                              }}>
                                <User color={tab === 2 ? colors.background : colors.text}/>
                                <Text style={tab === 2 ? styles.activeText : styles.inactiveText}>Roster</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>

                    {!tab ?
                        <View style={{marginHorizontal: 10}}>
                            <View>
                                <Text style={{
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 24, color: colors.text
                                }}>This Weeks Games</Text>

                            </View>


                            <ScrollView style={{height: '100%', marginTop: 20}} showsVerticalScrollIndicator={false}>
                                {schedule ? schedule?.map((game, i) => {

                                    return <MotiView from={{
                                        opacity: 0
                                    }}
                                                     animate={{
                                                         opacity: 1
                                                     }}
                                                     transition={{
                                                         type: 'timing',
                                                         duration: 300
                                                     }}>
                                        <Match game={game}/>
                                    </MotiView>
                                }) : <View style={{gap: 10}}>
                                    <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                              width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                                    <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                              width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                                    <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                              width={Dimensions.get('window').width - 20} height={70} radius={15}/>

                                </View>}

                            </ScrollView>

                        </View> : tab === 1 ?
                            <View style={{marginHorizontal: 10}}>
                                <View>
                                    <Text style={{
                                        fontFamily: 'Sora_600SemiBold',
                                        fontSize: 24, color: colors.text
                                    }}>Season Wide Stats</Text>
                                    <ScrollView style={{marginTop: 20}}>


                                        <DataLineChart title={"Goal Differential"}
                                                       data={timeline}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Faceoff Win %"} isPCT data={timelineFO} colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Shot Differential"} data={timelineSD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Penalty Minutes Differential"} data={timelinePD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Giveaway Differential"} data={timelineFO}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>

                                        <DataLineChart title={"Takeaway Differential"} data={timelineGD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Shot Differential"} data={timelineTD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Low Danger Shots Differential"} data={timelineLDD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"High Danger Shots Differential"} data={timelineHDD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Missed Shot Differential"} data={timelineMD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>
                                        <DataLineChart title={"Hits Differential"} data={timelineHD}
                                                       colors={colors}
                                                       selectedTeam={selectedTeam}/>


                                        <View style={{marginBottom: 400}}/>
                                    </ScrollView>
                                </View>
                            </View>
                            : <View style={{marginHorizontal: 10}}>
                                <View>
                                    <Text style={{
                                        fontFamily: 'Sora_600SemiBold',
                                        fontSize: 24, color: colors.text
                                    }}>Team Roster</Text>
                                    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{marginTop: 20}}>
                                        <Text style={{
                                            fontFamily: 'Sora_600SemiBold',
                                            fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 10
                                        }}>Forwards</Text>
                                        <ScrollView style={{height: 175}} showsHorizontalScrollIndicator={false}
                                                    horizontal>

                                            {roster.forwards.length ? roster.forwards.map((player, i) => {
                                                return <View style={{flexDirection: 'row'}}>
                                                    <View>
                                                        <View style={{
                                                            marginBottom: 4,
                                                            alignSelf: 'center',
                                                            height: 80,
                                                            borderRadius: 100,
                                                            marginHorizontal: 20
                                                        }}>


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
                                                                    borderColor: colors.text,
                                                                    backgroundColor: colors.card
                                                                }} source={{uri: player.headshot}}/>
                                                            </View>
                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 24,
                                                                marginTop: 10,
                                                                textAlign: 'center', color: colors.text
                                                            }}>#{player.sweaterNumber}</Text>
                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 16,
                                                                marginTop: 5,
                                                                textAlign: 'center', color: colors.text
                                                            }}>{player.firstName.default} {player.lastName.default}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            }) : <View style={{marginTop: 20}}>
                                                <PlayerSkeleton colors={colors}/>
                                            </View>}
                                        </ScrollView>
                                        <Text style={{
                                            fontFamily: 'Sora_600SemiBold',
                                            fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 10
                                        }}>Defensemen</Text>
                                        <ScrollView style={{height: 175}} showsHorizontalScrollIndicator={false}
                                                    horizontal>
                                            {roster.defensemen.length ? roster.defensemen.map((player, i) => {
                                                return <View style={{flexDirection: 'row'}}>
                                                    <View>
                                                        <View style={{
                                                            marginBottom: 4,
                                                            alignSelf: 'center',
                                                            height: 80,
                                                            borderRadius: 100,
                                                            marginHorizontal: 20
                                                        }}>


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
                                                                    borderColor: colors.text,
                                                                    backgroundColor: colors.card
                                                                }} source={{uri: player.headshot}}/>
                                                            </View>
                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 24,
                                                                marginTop: 10,
                                                                textAlign: 'center', color: colors.text
                                                            }}>#{player.sweaterNumber}</Text>
                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 16,
                                                                marginTop: 5,
                                                                textAlign: 'center', color: colors.text
                                                            }}>{player.firstName.default} {player.lastName.default}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            }) : <View style={{marginTop: 20}}>
                                                <PlayerSkeleton colors={colors}/>

                                            </View>}
                                        </ScrollView>
                                        <Text style={{
                                            fontFamily: 'Sora_600SemiBold',
                                            fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 10
                                        }}>Goalies</Text>
                                        <ScrollView style={{height: 175}} showsHorizontalScrollIndicator={false}
                                                    horizontal>
                                            {roster.goalies ? roster.goalies.map((player, i) => {
                                                return <View style={{flexDirection: 'row'}}>
                                                    <View>
                                                        <View style={{
                                                            marginBottom: 4,
                                                            alignSelf: 'center',
                                                            height: 80,
                                                            borderRadius: 100,
                                                            marginHorizontal: 20
                                                        }}>


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
                                                                    borderColor: colors.text,
                                                                    backgroundColor: colors.card
                                                                }} source={{uri: player.headshot}}/>
                                                            </View>
                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 24,
                                                                marginTop: 10,
                                                                textAlign: 'center', color: colors.text
                                                            }}>#{player.sweaterNumber}</Text>
                                                            <Text style={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                fontSize: 16,
                                                                marginTop: 5,
                                                                textAlign: 'center', color: colors.text
                                                            }}>{player.firstName.default} {player.lastName.default}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            }) : <View style={{marginTop: 20}}>
                                                <PlayerSkeleton colors={colors}/>

                                            </View>}
                                        </ScrollView>
                                        <View style={{marginBottom: 450}}/>
                                    </ScrollView>
                                </View>


                            </View>


                    }


                </SafeAreaView>
                <BottomSheet

                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backgroundStyle={{
                        backgroundColor: colors.background
                    }}
                >
                    <View style={{
                        paddingHorizontal: 20

                    }}>
                        <Text style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 24,
                            marginBottom: 20,
                            color: colors.text
                        }}>Select a Team</Text>
                        <ScrollView style={{height: 500}}>
                            {teamData.map((team, i) => {
                                return <TouchableOpacity onPress={() => {
                                    Haptics.selectionAsync().then(() => {
                                    })
                                    setSelectedTeam(team.abbreviation)
                                    getTimeLine(team.abbreviation)
                                    getTeamData(team.abbreviation)
                                    getSchedule(true, team.abbreviation)
                                    bottomSheetRef.current.close()

                                }}>
                                    <View style={{
                                        flexDirection: 'row',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        marginBottom: 10,
                                        marginLeft: -10
                                    }}>
                                        {assets &&
                                            <Image style={{
                                                height: 50,
                                                width: 70,
                                                transform: [{scale: .7}],
                                                flexDirection: 'column',
                                                justifyContent: 'center'
                                            }} source={assets[teamAbbreviations.indexOf(team.abbreviation)]}/>}

                                        <Text style={{
                                            fontFamily: 'Sora_500Medium',
                                            fontSize: 20,
                                            color: colors.text
                                        }}>{team.name}</Text>
                                    </View>
                                </TouchableOpacity>
                            })}
                        </ScrollView>
                    </View>
                </BottomSheet>
            </View>
        </GestureHandlerRootView>
    );


}
