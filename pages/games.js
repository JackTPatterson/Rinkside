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
import {useRoute, useTheme} from "@react-navigation/native";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {StatusBar} from "expo-status-bar";
import moment from "moment/moment";
import {MotiView} from "moti";
import {Skeleton} from "moti/skeleton";
import Papa from "papaparse";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Dimensions,
    Image,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import Calendar from "../components/Cal";
import {teamAbbreviations, teamAbbreviationsWithLightImages} from "../helpers/assetsLoader";
import {teamIdDictionary} from "../helpers/dataHandlers";

import {getTeamColor} from "../helpers/UI";

export default function Games({navigation}) {

    const bottomSheetRef = useRef(null);

    const snapPoints = useMemo(() => ['75%'], []);


    const [isLoading, setIsLoading] = useState(true)

    const {colors} = useTheme();

    const getDate = (offset) => {
        const today = new Date();
        today.setDate(today.getDate() + offset);
        today.setHours(today.getHours() - 4)

        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Adding 1 because months are zero-based
        const day = today.getDate().toString().padStart(2, '0');

        return `${year}-${month}-${day}`;
    }


    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);

    const [dateOffset, setDateOffset] = useState(0);


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

    const [data, setData] = useState([])


    function getMatchData(dateOffset) {
        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch(`https://api-web.nhle.com/v1/score/${getDate(dateOffset)}`, requestOptions)
            .then(response => response.text())
            .then(result => {
                setData(JSON.parse(result)['games'])
            })

        setIsLoading(false)
    }

    function getMatchDataWithCal(date) {
        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch(`https://api-web.nhle.com/v1/score/${date}`, requestOptions)
            .then(response => response.text())
            .then(result => {
                setData(JSON.parse(result)['games'])
            })

        setIsLoading(false)
    }

    const route = useRoute()


    useEffect(() => {

        getMatchData(0)
        setSelectedDate(moment().format('YYYY-MM-DD'))
    }, [])

    let commonConfig = {delimiter: ","};

    const [selectedTeam, setSelectedTeam] = useState(null);

    const [homeGoalie, setHomeGoalie] = useState({name: "", confirmed_by: null, id: 0});
    const [awayGoalie, setAwayGoalie] = useState({name: "", confirmed_by: null, id: 0});

    const [homeGoalieStats, setHomeGoalieStats] = useState({GSA: 0, SP: 0, GSAx: 0})
    const [awayGoalieStats, setAwayGoalieStats] = useState({GSA: 0, SP: 0, GSAx: 0});

    const [teamSummaryData, setTeamSummeryData] = useState({h: null, a: null})

    const getTeamStats = (franchiseIdHome, franchiseIdAway) => {


        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };


        fetch(`https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&start=0&limit=2&factCayenneExp=gamesPlayed%3E=1&cayenneExp=franchiseId%3D${teamIdDictionary[franchiseIdHome]}%20and%20gameTypeId=2%20and%20seasonId%3C=20232024%20and%20seasonId%3E=20232024&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D`, requestOptions)
            .then(response => response.text())
            .then(result => {
                console.log(JSON.parse(result).data[0])
                setTeamSummeryData(v => v.h = JSON.parse(result).data[0])

            })

        fetch(`https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&start=0&limit=2&factCayenneExp=gamesPlayed%3E=1&cayenneExp=franchiseId%3D${teamIdDictionary[franchiseIdAway]}%20and%20gameTypeId=2%20and%20seasonId%3C=20232024%20and%20seasonId%3E=20232024&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D`, requestOptions)
            .then(response => response.text())
            .then(result => {
                console.log(JSON.parse(result).data[0])

                setTeamSummeryData(v => v.a = JSON.parse(result).data[0])

            })

    }

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

    const [selectedDate, setSelectedDate] = useState(null);


    const Team = (props) => {


        const [hwp, setHwp] = useState(0)
        const [pp, setPP] = useState({h: 5, a: 5});


        useEffect(() => {


            if (props.game.homeTeam.score) {
                if (!hwp) {
                    Papa.parse(
                        `https://moneypuck.com/moneypuck/gameData/${game?.season}/${game?.id}.csv`,
                        {
                            ...commonConfig,
                            header: true,
                            download: true,
                            complete: (result) => {
                                setHwp(1 - parseFloat((result.data.slice(-2)[0]).homeWinProbability));


                            }
                        }
                    );
                }
            } else {
                if (!hwp) {
                    Papa.parse(
                        `https://moneypuck.com/moneypuck/predictions/${game?.id}.csv`,
                        {
                            ...commonConfig,
                            header: true,
                            download: true,
                            complete: (result) => {
                                setHwp(1 - parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore));
                                setPP({h: 5, a: 5});
                            }
                        }
                    );
                }
            }

        }, [])

        const game = props.game;
        const dt = props.dt;


        const getTimeLabel = () => {


            if (props.game.homeTeam.score !== undefined) {
                if (props.game.gameState === "OFF" || props.game.gameState === "OVER" || props.game.gameState === "FINAL") {
                    return props.game.gameOutcome.lastPeriodType === "REG" ? "Final" : props.game.gameOutcome.lastPeriodType === "OT" ? "Final • OT" : "Final • SO"
                } else if (props.game.clock?.inIntermission) {
                    return "INT"
                } else return props.game.clock?.timeRemaining
            }


            return formatAMPM(new Date(game.startTimeUTC))

        }

        return <TouchableOpacity onPress={() => {
            Haptics.selectionAsync().then(r => {
            });
            navigation.push("Games_Detail", {data: {data: game, date: dt, prob: {h: 1 - hwp, a: hwp}}})
        }}
                                 onLongPress={() => {
                                     getTeamStats(props.game.homeTeam.id, props.game.awayTeam.id)
                                     bottomSheetRef.current.expand();
                                     Haptics.selectionAsync().then(r => {
                                     });
                                     setAwayGoalieStats({
                                         GSA: 0,
                                         SP: 0,
                                         GSAx: 0
                                     })
                                     setHomeGoalieStats({
                                         GSA: 0,
                                         SP: 0,
                                         GSAx: 0
                                     })
                                     setSelectedTeam(props.game)
                                     Papa.parse(
                                         `https://moneypuck.com/moneypuck/tweets/starting_goalies/${game?.id}A.csv`,
                                         {
                                             ...commonConfig,
                                             header: true,
                                             download: true,
                                             complete: (result) => {
                                                 setAwayGoalie({
                                                     name: result?.data[0].goalie_name,
                                                     confirmed_by: result?.data[0].handle,
                                                     id: result?.data[0].goalie_id
                                                 })
                                                 Papa.parse(
                                                     `https://moneypuck.com/moneypuck/playerData/seasonSummary/2023_goalies.csv`,
                                                     {
                                                         ...commonConfig,
                                                         header: true,
                                                         download: true,
                                                         complete: (resultG) => {
                                                             const g = resultG.data.filter((goalie) => {
                                                                 return goalie.playerId === result?.data[0].goalie_id && goalie.situation === "all"
                                                             })

                                                             setAwayGoalieStats({
                                                                 GSA: (g[0].goals * 60) / (g[0].icetime / 60).toFixed(2),
                                                                 SP: (g[0].ongoal - g[0].goals) / g[0].ongoal,
                                                                 GSAx: g[0].xGoals - g[0].goals
                                                             })
                                                         }
                                                     }
                                                 );
                                             }
                                         }
                                     );
                                     Papa.parse(
                                         `https://moneypuck.com/moneypuck/tweets/starting_goalies/${game?.id}H.csv`,
                                         {
                                             ...commonConfig,
                                             header: true,
                                             download: true,
                                             complete: (result) => {
                                                 setHomeGoalie({
                                                     name: result?.data[0].goalie_name,
                                                     confirmed_by: result?.data[0].handle,
                                                     id: result?.data[0].goalie_id
                                                 })
                                                 Papa.parse(
                                                     `https://moneypuck.com/moneypuck/playerData/seasonSummary/2023_goalies.csv`,
                                                     {
                                                         ...commonConfig,
                                                         header: true,
                                                         download: true,
                                                         complete: (resultG) => {

                                                             const g = resultG.data.filter((goalie) => {
                                                                 return goalie.playerId === result?.data[0].goalie_id && goalie.situation === "all"
                                                             })

                                                             setHomeGoalieStats({
                                                                 GSA: (g[0].goals * 60) / (g[0].icetime / 60).toFixed(2),
                                                                 SP: (g[0].ongoal - g[0].goals) / g[0].ongoal,
                                                                 GSAx: g[0].xGoals - g[0].goals

                                                             })
                                                         }
                                                     }
                                                 );

                                             }
                                         }
                                     );


                                 }}
                                 style={{
                                     backgroundColor: colors.card,
                                     marginBottom: 4,
                                     paddingVertical: 15,
                                     borderRadius: 15

                                 }}>
            {
                props.game.gameState === "LIVE" || props.game.gameState === "CRIT" &&

                <MotiView from={{
                    opacity: 1
                }}
                          animate={{
                              opacity: .4

                          }}
                          transition={{
                              type: 'timing',
                              duration: 1000,
                              loop: true
                          }}
                          style={{
                              backgroundColor: '#f54242',
                              paddingVertical: 0,
                              borderRadius: 15,
                              height: 10, width: 10,
                              position: 'absolute',
                              zIndex: 1000,
                              top: 15,
                              right: 15
                          }}>
                </MotiView>}
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

                    {
                        (pp?.a < pp?.h && (game.gameState !== "OFF" && game.gameState !== "OVER" && game.gameState !== "FINAL")) ?
                            <MotiView from={{
                                opacity: 1
                            }}
                                      animate={{
                                          opacity: .4

                                      }}
                                      transition={{
                                          type: 'timing',
                                          duration: 1000,
                                          loop: true
                                      }}

                                      style={{
                                          backgroundColor: '#f54242',
                                          paddingVertical: 0,
                                          borderRadius: 15,
                                          paddingHorizontal: 5,
                                          flexDirection: 'row',
                                          justifyContent: 'center'

                                      }}>
                                <Text style={{
                                    color: 'white',
                                    fontFamily: 'Sora_600SemiBold'
                                }}>{game.homeTeam.abbrev}</Text>
                            </MotiView> : <Text
                                style={{color: colors.text, fontFamily: 'Sora_500Medium'}}>{game.homeTeam.abbrev}</Text>
                    }
                </View>
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{borderRadius: 100, paddingRight: 15}}>
                        <Text style={{
                            textAlign: "right",
                            color: colors.text,
                            paddingVertical: 4,
                            fontFamily: 'Sora_700Bold',
                            fontSize: 20,
                            width: !props.game.awayTeam.score ? 60 : 40
                        }}>{props.game.homeTeam.score ?? `${Math.round(parseFloat(1 - hwp).toFixed(2) * 100)}%`}</Text>
                    </View>
                    {

                        game.gameState === "LIVE" || props.game.gameState === "CRIT" ? <View>
                            <View style={{
                                backgroundColor: colors.background,
                                paddingVertical: 5,
                                borderRadius: 25,
                                paddingHorizontal: 15
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'center',
                                    fontFamily: 'Sora_500Medium'
                                }}>{!props.game.inIntermission ? props.game?.period > 3 ? "OT" : `P${props.game?.period}` : "INT"}</Text>
                            </View>
                            <View style={{
                                backgroundColor: colors.background,
                                paddingVertical: 5,
                                borderRadius: 25,
                                paddingHorizontal: 15,
                                marginTop: 4
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_500Medium'
                                }}>{getTimeLabel()}</Text>
                            </View>
                        </View> : <View style={{
                            backgroundColor: colors.background,
                            paddingVertical: 5,
                            borderRadius: 30,
                            paddingHorizontal: 15,
                            marginTop: 0
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_500Medium'
                            }}>{getTimeLabel()}</Text>
                        </View>
                    }


                    <View style={{backgroundColor: '', borderRadius: 100, paddingLeft: 15}}>
                        <Text style={{
                            textAlign: "left",
                            paddingVertical: 4,
                            fontFamily: 'Sora_700Bold',
                            fontSize: 20, color: colors.text,
                            width: !props.game.awayTeam.score ? 60 : 40
                        }}>{props.game.awayTeam.score ?? `${Math.round(parseFloat(hwp).toFixed(2) * 100)}%`}</Text>
                    </View>
                </View>

                <View style={{
                    alignItems: 'center'
                }}>

                    <Image style={{
                        height: 50, width: 70, transform: [{scale: .7}], flexDirection: 'column',
                        justifyContent: 'center'
                    }} source={assets[teamAbbreviations.indexOf(game.awayTeam.abbrev)]}/>
                    {
                        (pp?.a > pp?.h && (game.gameState !== "OFF" && game.gameState !== "OVER" && game.gameState !== "FINAL")) ?
                            <View style={{
                                backgroundColor: '#f54242',
                                paddingVertical: 0,
                                borderRadius: 15,
                                paddingHorizontal: 5,
                                flexDirection: 'row',
                                justifyContent: 'center'

                            }}>
                                <Text style={{
                                    color: 'white',
                                    fontFamily: 'Sora_600SemiBold'
                                }}>{game.awayTeam.abbrev}</Text>
                            </View> : <Text
                                style={{color: colors.text, fontFamily: 'Sora_500Medium'}}>{game.awayTeam.abbrev}</Text>


                    }
                </View>


            </View>
        </TouchableOpacity>
    }
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => {
            setRefreshing(false);
            getMatchData(dateOffset)

        }, 2000);
    }, []);

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

    function getDaySuffix(day) {
        if (day >= 11 && day <= 13) {
            return 'th';
        }
        const lastDigit = day % 10;
        switch (lastDigit) {
            case 1:
                return 'st';
            case 2:
                return 'nd';
            case 3:
                return 'rd';
            default:
                return 'th';
        }
    }

    function formatDate(date, offset) {
        const today = new Date();
        const inputDate = new Date(date);
        offset++;
        const adjustedDate = new Date(inputDate.getTime() + offset * 24 * 60 * 60 * 1000);
        if (adjustedDate.toDateString() === today.toDateString()) {
            return "Today";
        } else if (adjustedDate.toDateString() === new Date(today.getTime() + 24 * 60 * 60 * 1000).toDateString()) {
            return "Tomorrow";
        } else if (adjustedDate.toDateString() === new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString()) {
            return "Yesterday";
        } else {
            const monthAbbreviation = new Intl.DateTimeFormat('en-US', {month: 'short'}).format(adjustedDate);
            const day = adjustedDate.getDate();
            const daySuffix = getDaySuffix(day);
            const formattedDay = day < 10 ? `${day}${daySuffix}` : `${day}${daySuffix}`;
            return `${monthAbbreviation} ${formattedDay}`;
        }
    }


    if (!fontsLoaded) {
        return <></>
    } else return <View style={styles.container}>
        <SafeAreaView style={{width: '100%'}}>
            <Text style={{
                fontFamily: 'Sora_600SemiBold',
                marginBottom: 10,
                fontSize: 24,
                marginLeft: 10,
                color: colors.text
            }}>Games</Text>

            <View style={{marginBottom: 10}}>
                <Calendar colors={colors} onSelectDate={(d) => {
                    Haptics.selectionAsync().then(() => {
                    })
                    setSelectedDate(d)
                    getMatchDataWithCal(d)
                }} selected={selectedDate}/>
            </View>

            {isLoading ? <></> :
                <ScrollView showsVerticalScrollIndicator={false}
                            style={{height: Dimensions.get('window').height - 215, paddingHorizontal: 10}}>
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>
                    <Text style={{
                        marginBottom: 20,
                        fontFamily: 'Sora_600SemiBold',
                        fontSize: 16,
                        color: colors.text
                    }}>Live Games</Text>

                    {data.length ? data.filter((g => {
                        return g.gameState === "LIVE" || g.gameState === "CRIT"
                    })).map((game, i) => {
                        return (
                            <View style={{width: Dimensions.get('window').width - 20}}>
                                <MotiView from={{
                                    opacity: 0
                                }}
                                          animate={{
                                              opacity: 1
                                          }}
                                          transition={{
                                              type: 'timing',
                                              duration: 300
                                          }}>
                                    <Team game={game} keu={i}/>
                                </MotiView>
                            </View>
                        )
                    }) : <View style={{gap: 4}}>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>

                    </View>}

                    <Text style={{
                        marginBottom: 20,
                        marginTop: 20,
                        fontFamily: 'Sora_600SemiBold',
                        fontSize: 16,
                        color: colors.text
                    }}>Upcoming Games</Text>
                    {data.length ? data.filter((g => {
                        return g.gameState === "FUT" || g.gameState === "PRE"
                    })).map((game, i) => {
                        return (
                            <MotiView from={{
                                opacity: 0
                            }}
                                      animate={{
                                          opacity: 1
                                      }}
                                      transition={{
                                          type: 'timing',
                                          duration: 300
                                      }}>
                                <Team game={game} keu={i}/>
                            </MotiView>
                        )
                    }) : <View style={{gap: 10}}>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>

                    </View>}
                    <Text style={{
                        marginBottom: 20,
                        marginTop: 20,
                        fontFamily: 'Sora_600SemiBold',
                        fontSize: 16,
                        color: colors.text
                    }}>Finished Games</Text>
                    {data.length ? data.filter((g => {
                        return g.gameState === "OFF" || g.gameState === "OVER" || g.gameState === "FINAL"
                    })).map((game, i) => {
                        return (
                            <MotiView from={{
                                opacity: 0
                            }}
                                      animate={{
                                          opacity: 1
                                      }}
                                      transition={{
                                          type: 'timing',
                                          duration: 300
                                      }}>
                                <Team game={game} keu={i}/>
                            </MotiView>
                        )
                    }) : <View style={{gap: 10}}>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>
                        <Skeleton colorMode={colors.text === 'white' ? 'light' : 'dark'}
                                  width={Dimensions.get('window').width - 20} height={70} radius={15}/>

                    </View>}
                    <View style={{marginBottom: 100}}/>
                </ScrollView>}
        </SafeAreaView>
        <BottomSheet

            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            backgroundStyle={{
                backgroundColor: colors.card
            }}

        >
            {selectedTeam &&
                <ScrollView>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <View style={{
                                alignItems: 'center'
                            }}>
                                <Image style={{
                                    height: 90, width: 120, transform: [{scale: .7}], flexDirection: 'column',
                                    justifyContent: 'center'
                                }} source={assets[teamAbbreviations.indexOf(selectedTeam?.homeTeam.abbrev)]}/>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 24
                                }}>{selectedTeam?.homeTeam.abbrev}</Text>
                            </View>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                            </View>

                            <View style={{
                                alignItems: 'center'
                            }}>
                                <Image style={{
                                    height: 90, width: 120, transform: [{scale: .7}], flexDirection: 'column',
                                    justifyContent: 'center'
                                }} source={assets[teamAbbreviations.indexOf(selectedTeam?.awayTeam.abbrev)]}/>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 24
                                }}>{selectedTeam?.awayTeam.abbrev}</Text>


                            </View>


                        </View>

                    </View>
                    <Text style={{
                        fontFamily: 'Sora_500Medium',
                        fontSize: 16,
                        textAlign: 'center',
                        marginTop: 20,
                        marginBottom: 10,
                        color: colors.text
                    }}>Starting Goalies</Text>

                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <View style={{
                                alignItems: 'center'
                            }}>

                                <Image style={{
                                    borderRadius: 100,
                                    borderWidth: 3,
                                    height: 80,
                                    width: 80,
                                    marginTop: 10,
                                    borderColor: `${getTeamColor(selectedTeam?.homeTeam.abbrev, colors)}`,
                                    backgroundColor: colors.card
                                }}
                                       source={{uri: `https://assets.nhle.com/mugs/nhl/20232024/${selectedTeam?.homeTeam.abbrev}/${homeGoalie?.id}.png`}}/>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 16
                                }}>{homeGoalie.name.split(" ")[0] !== "" ? homeGoalie.name.split(" ")[0] !== "" : "\n Unknown"}</Text>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 16
                                }}>{homeGoalie.name.split(" ")[1]}</Text>
                                {/*<Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{homeGoalie.confirmed_by}</Text>*/}


                            </View>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                            </View>


                            <View style={{
                                alignItems: 'center'
                            }}>

                                <View style={{flexDirection: 'row', justifyContent: 'center'}}>
                                    <Image style={{
                                        borderRadius: 100,
                                        borderWidth: 3,
                                        height: 80,
                                        width: 80,
                                        marginTop: 10,
                                        borderColor: `${getTeamColor(selectedTeam?.awayTeam.abbrev, colors)}`,
                                        backgroundColor: colors.card
                                    }}
                                           source={{uri: `https://assets.nhle.com/mugs/nhl/20232024/${selectedTeam?.awayTeam.abbrev}/${awayGoalie?.id}.png`}}/>
                                </View>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 16
                                }}>{awayGoalie.name.split(" ")[0] !== "" ? awayGoalie.name.split(" ")[0] !== "" : "Unknown"}</Text>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_600SemiBold',
                                    fontSize: 16
                                }}>{awayGoalie?.name.split(" ")[1]}</Text>
                                {/*<Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{awayGoalie.confirmed_by}</Text>*/}

                            </View>


                        </View>

                    </View>
                    <View>

                    </View>
                    <Text style={{
                        fontFamily: 'Sora_500Medium',
                        fontSize: 16,
                        textAlign: 'center',
                        marginTop: 20,
                        marginBottom: 10,
                        color: colors.text
                    }}>Goalie Stats</Text>

                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{homeGoalieStats.SP.toFixed(3)}</Text>
                            <Text style={{
                                color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16, width: '33%',
                                textAlign: 'center'
                            }}>SV%</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{awayGoalieStats.SP.toFixed(3)}</Text>

                        </View>

                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{homeGoalieStats.GSA.toFixed(2)}</Text>
                            <Text style={{
                                color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16, width: '33%',
                                textAlign: 'center'
                            }}>GSAA</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{awayGoalieStats.GSA.toFixed(2)}</Text>

                        </View>

                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{homeGoalieStats.GSAx.toFixed(1)}</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16,
                                width: '33%',
                                textAlign: 'center'
                            }}>GSAx</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{awayGoalieStats.GSAx.toFixed(1)}</Text>
                        </View>
                    </View>

                    <Text style={{
                        fontFamily: 'Sora_500Medium',
                        fontSize: 16,
                        textAlign: 'center',
                        marginTop: 20,
                        marginBottom: 10,
                        color: colors.text
                    }}>Team Stats</Text>

                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.h?.goalsForPerGame.toFixed(2)}</Text>
                            <Text style={{
                                color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16, width: '33%',
                                textAlign: 'center'
                            }}>Goals For</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.a?.goalsForPerGame.toFixed(2)}</Text>

                        </View>

                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.h?.goalsAgainstPerGame.toFixed(2)}</Text>
                            <Text style={{
                                color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16, width: '33%',
                                textAlign: 'center'
                            }}>Goals Against</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.a?.goalsAgainstPerGame.toFixed(2)}</Text>

                        </View>

                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.h?.powerPlayNetPct.toFixed(2) * 100}%</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16,
                                width: '33%',
                                textAlign: 'center'
                            }}>Power Play %</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.a?.powerPlayNetPct.toFixed(2) * 100}%</Text>
                        </View>
                    </View>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginTop: 20,
                        marginBottom: 20
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.h?.penaltyKillNetPct.toFixed(2) * 100}%</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16,
                                width: '33%',
                                textAlign: 'center'
                            }}>Penalty Kill %</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.a?.penaltyKillNetPct.toFixed(2) * 100}%</Text>
                        </View>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.h?.faceoffWinPct.toFixed(2) * 100}%</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16,
                                width: '33%',
                                textAlign: 'center'
                            }}>Faceoff Win %</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.a?.faceoffWinPct.toFixed(2) * 100}%</Text>
                        </View>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.h?.shotsForPerGame.toFixed(2)}</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16,
                                width: '33%',
                                textAlign: 'center'
                            }}>Shots For</Text>
                            <Text style={{
                                color: colors.text,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16
                            }}>{teamSummaryData.a?.shotsForPerGame.toFixed(2)}</Text>
                        </View>
                    </View>


                </ScrollView>}

        </BottomSheet>

        <StatusBar style="auto"/>
    </View>
}
