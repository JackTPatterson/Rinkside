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
import {ArrowDown2} from "iconsax-react-native";
import {MotiView} from "moti";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {Row, Table} from "react-native-reanimated-table"

import Svg, {Path} from "react-native-svg";
import {Cell, TableWrapper} from "react-native-table-component";
import DataLineChart from "../components/Chart";
import {teamAbbreviations, teamAbbreviationsWithLightImages} from "../helpers/assetsLoader";
import {getTeamColor} from "../helpers/UI";

export default function Players() {
    const [data, setData] = useState([])

    const [tab, setTab] = useState(0);

    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);


    const getPlayerData = (type) => {

        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };


        fetch(type ?
            "https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=20232024%20and%20seasonId%3E=20232024" :
            `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22gamesPlayed%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameTypeId=2%20and%20seasonId%3C=20232024%20and%20seasonId%3E=20232024`, requestOptions)
            .then(response => response.text())
            .then(result => {
                setData(JSON.parse(result).data)
            });

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
        getPlayerData(0)

    }, [])


    const bottomSheetRef = useRef(null);
    const bottomSheetRef2 = useRef(null);

    const snapPoints = useMemo(() => ['90%'], []);

    const [selectedPlayer, setSelectedPlayer] = useState(null)

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


    const {colors} = useTheme();


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

    const [selectedStat, setSelectedStat] = useState("goals")

    const element = (data, index) => {
        return <Image style={{
            height: 40, width: 60, transform: [{scale: .7}], flexDirection: 'column',
            justifyContent: 'center'
        }} source={assets[teamAbbreviations.indexOf(data.teamAbbrevs)]}/>

    }

    function secondsToMSS(seconds) {
        // Calculate minutes and seconds
        let minutes = Math.floor(seconds / 60);
        let remainingSeconds = seconds % 60;

        // Format the result as "M:SS"
        return minutes + ':' + (remainingSeconds < 10 ? '0' : '') + Math.round(remainingSeconds);
    }

    if (!fontsLoaded) {
        return <></>
    } else return (
        <GestureHandlerRootView>
            <View style={styles.container}>
                <SafeAreaView style={{width: '100%'}}>

                    <Text style={{fontFamily: 'Sora_600SemiBold', marginBottom: 10, fontSize: 24, color: colors.text}}>Player
                        Rankings</Text>

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
                            <TouchableOpacity style={tab === 1 ? styles.activeButton : styles.inactiveButton}
                                              onPress={() => {
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

                            <ScrollView horizontal showsVerticalScrollIndicator={false}
                            >

                                <View>

                                    <View>
                                        <View>
                                            <Table>
                                                <Row style={{marginBottom: 10}} textStyle={{
                                                    fontFamily: 'Sora_600SemiBold',
                                                    color: colors.text,
                                                    fontSize: 14, opacity: .5
                                                }}
                                                     widthArr={tab ? [50, 80, 175, 70, 70, 70, 70, 70, 70, 70, 70] : [50, 80, 175, 50, 50, 60, 50, 70, 70, 50, 50, 50, 50, 70]}
                                                     data={tab ? ["POS", "TEAM", "NAME", "SV%", "GAA", "GSAA", "GP", "W", "L", "SO", "PTS"] : ["POS", "TEAM", "NAME", "G", "A", "PTS", "+/-", "SHOTS", "SHOT %", "S/GP", "PPG", "PPP", "SHG", "TOI/GP"]}/>
                                                <ScrollView style={{
                                                    height: Dimensions.get('window').height - 280

                                                }}>
                                                    {
                                                        data?.map((player, index) => {
                                                            return <MotiView from={{
                                                                opacity: 0,
                                                                translateY: -15
                                                            }}
                                                                             animate={{
                                                                                 opacity: data === null ? 0 : 1,
                                                                                 translateY: data === null ? -15 : 0
                                                                             }}
                                                                             transition={{
                                                                                 type: 'spring',
                                                                                 duration: 300,
                                                                                 delay: index * 50
                                                                             }}>
                                                                <TouchableOpacity
                                                                    onPress={() => {

                                                                        let myHeaders = new Headers();
                                                                        myHeaders.append("accept", "application/json");

                                                                        let requestOptions = {
                                                                            method: 'GET',
                                                                            headers: myHeaders,
                                                                            redirect: 'follow'
                                                                        };


                                                                        bottomSheetRef.current.expand()
                                                                        Haptics.impactAsync()
                                                                        fetch(`https://api-web.nhle.com/v1/player/${player.playerId}/landing`, requestOptions)
                                                                            .then(response => response.text())
                                                                            .then(result => {
                                                                                setSelectedPlayer(JSON.parse(result))
                                                                            });
                                                                    }}
                                                                >
                                                                    <TableWrapper
                                                                        style={{flexDirection: 'row'}}
                                                                        key={index}>
                                                                        {
                                                                            [page + index + 1,
                                                                                player.teamAbbrevs,
                                                                                !tab ? player?.skaterFullName && `${player?.skaterFullName?.slice(0, 1)}. ${player?.skaterFullName?.split(" ")[1]}` : player?.goalieFullName && `${player?.goalieFullName?.slice(0, 1)}. ${player?.goalieFullName?.split(" ")[1]}`,
                                                                                !tab ? player.goals : parseFloat(player.savePct).toFixed(3),
                                                                                !tab ? player.assists : parseFloat(player.goalsAgainstAverage).toFixed(2),
                                                                                !tab ? player.points : ((parseFloat(player.goalsAgainst) * 60) / (parseFloat(player.timeOnIce) / 60)).toFixed(2),
                                                                                !tab ? player.plusMinus : player.gamesPlayed,
                                                                                !tab ? player.shots : player.wins,
                                                                                !tab ? (parseFloat(player.shootingPct) * 100).toFixed(2) : player.losses,
                                                                                !tab ? (parseInt(player.shots) / parseInt(player.gamesPlayed)).toFixed(1) : player.shutouts,
                                                                                !tab ? player.ppGoals : player.points,
                                                                                !tab ? player.ppPoints : "",
                                                                                !tab ? player.shGoals : "",
                                                                                !tab ? secondsToMSS(player.timeOnIcePerGame) : ""
                                                                            ].map((data, cellIndex) => {
                                                                                return <Cell style={{
                                                                                    width: tab ? [37, 93, 175, 70, 70, 70, 70, 70, 70, 70][cellIndex] : [37, 93, 175, 50, 50, 60, 50, 70, 70, 50, 50, 50, 50, 70][cellIndex]
                                                                                }} textStyle={{
                                                                                    fontFamily: 'Sora_600SemiBold',
                                                                                    color: colors.text,
                                                                                    textAlign: 'left',
                                                                                    fontSize: 16

                                                                                }} key={cellIndex}
                                                                                             data={cellIndex === 1 ?
                                                                                                 <Image style={{
                                                                                                     height: 50,
                                                                                                     width: 70,
                                                                                                     transform: [{scale: .7}],
                                                                                                     flexDirection: 'column',
                                                                                                     justifyContent: 'center'
                                                                                                 }}
                                                                                                        source={assets[teamAbbreviations.indexOf(player?.teamAbbrevs)]}/> : data}/>
                                                                            })
                                                                        }
                                                                    </TableWrapper>
                                                                </TouchableOpacity>
                                                            </MotiView>
                                                        })
                                                    }
                                                </ScrollView>

                                            </Table>
                                        </View>

                                    </View>
                                </View>


                            </ScrollView>
                        </View>
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
                        backgroundColor: colors.card
                    }}
                >
                    <ScrollView showsVerticalScrollIndicator={false}>
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
                                    borderColor: `${getTeamColor(selectedPlayer?.currentTeamAbbrev, colors)}`,
                                    backgroundColor: colors.card
                                }} source={{uri: selectedPlayer?.headshot}}/>
                                <View>
                                    <Text style={{
                                        fontSize: 24,
                                        fontFamily: 'Sora_600SemiBold',
                                        textAlign: 'left',
                                        color: colors.text
                                    }}>{selectedPlayer?.firstName.default} {selectedPlayer?.lastName.default}</Text>
                                    <Text style={{
                                        fontFamily: 'Sora_500Medium',
                                        fontSize: 16,
                                        opacity: .5,
                                        textAlign: 'left',
                                        color: colors.text
                                    }}>{selectedPlayer?.fullTeamName.default}</Text>
                                </View>

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
                            <View style={{
                                backgroundColor: colors.background,
                                width: (Dimensions.get('window').width / 3) - 20,
                                paddingVertical: 15,
                                paddingLeft: 20,
                                borderRadius: 10
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 20,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.position === "G" ? parseFloat(selectedPlayer?.careerTotals.regularSeason.savePctg).toFixed(3) : selectedPlayer?.careerTotals.regularSeason.goals}
                                </Text>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>{!(selectedPlayer?.position === "G") ? "Goals" : "SV %"}</Text>
                            </View>
                            <View style={{
                                backgroundColor: colors.background,
                                width: (Dimensions.get('window').width / 3) - 20,
                                paddingVertical: 15,
                                paddingLeft: 20,
                                borderRadius: 10
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 20,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.position === "G" ? parseFloat(selectedPlayer?.careerTotals.regularSeason.goalsAgainstAvg).toFixed(2) : selectedPlayer?.careerTotals.regularSeason.assists}
                                </Text>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>{!(selectedPlayer?.position === "G") ? "Assists" : "GAA"}</Text>
                            </View>
                            <View style={{
                                backgroundColor: colors.background,
                                width: (Dimensions.get('window').width / 3) - 20,
                                paddingVertical: 15,
                                paddingLeft: 20,
                                borderRadius: 10
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 20,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.position === "G" ? (selectedPlayer?.careerTotals.regularSeason.shutouts) : selectedPlayer?.careerTotals.regularSeason.points}
                                </Text>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>{!(selectedPlayer?.position === "G") ? "Points" : "SO"}</Text>
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
                            <View style={{
                                backgroundColor: colors.background,
                                width: (Dimensions.get('window').width / 3) - 20,
                                paddingVertical: 15,
                                paddingLeft: 20,
                                borderRadius: 10
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 20,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.position === "G" ? (selectedPlayer?.careerTotals.regularSeason.wins) : selectedPlayer?.careerTotals.regularSeason.plusMinus}
                                </Text>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>{!(selectedPlayer?.position === "G") ? "+/-" : "Wins"}</Text>
                            </View>
                            <View style={{
                                backgroundColor: colors.background,
                                width: (Dimensions.get('window').width / 3) - 20,
                                paddingVertical: 15,
                                paddingLeft: 20,
                                borderRadius: 10
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 20,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>
                                    {selectedPlayer?.position === "G" ? parseInt(selectedPlayer?.careerTotals.regularSeason.goals) + parseInt(selectedPlayer?.careerTotals.regularSeason.assists) : selectedPlayer?.careerTotals.regularSeason.shots}
                                </Text>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    opacity: .5,
                                    fontSize: 16,
                                    fontFamily: 'Sora_400Regular'
                                }}>{!(selectedPlayer?.position === "G") ? "Shots" : "PTS"}</Text>
                            </View>
                            <View style={{
                                backgroundColor: colors.background,
                                width: (Dimensions.get('window').width / 3) - 20,
                                paddingVertical: 15,
                                paddingLeft: 20,
                                borderRadius: 10
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'left',
                                    fontSize: 20,
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
                                }}>GP</Text>
                            </View>

                        </View>
                        <Text style={{
                            color: colors.text,
                            marginTop: 10,
                            fontSize: 16,
                            fontFamily: 'Sora_600SemiBold'
                        }}>Last 5 Games
                        </Text>
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
                                backgroundColor: colors.background,
                                marginBottom: 4
                            }}>
                                {!tab ?
                                    <Text style={{
                                        color: colors.text,
                                        fontSize: 16,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>Total: {selectedPlayer ? accumulateArrayValues(selectedPlayer?.last5Games.map((r, i) => {
                                        return isNaN(parseInt(r[`${selectedStat}`])) ? 0 : parseInt(r[`${selectedStat}`])
                                    })).slice(-1) : 0}</Text> : <Text style={{
                                        color: colors.text,
                                        fontSize: 16,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>Stat</Text>}
                                <View style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    {!tab ?
                                        <Text style={{
                                            color: colors.text,
                                            opacity: .5,
                                            fontSize: 16,
                                            fontFamily: 'Sora_500Medium'
                                        }}>{selectedStat.charAt(0).toUpperCase() + selectedStat.slice(1)}</Text> :
                                        <Text style={{
                                            color: colors.text,
                                            opacity: .5,
                                            fontSize: 16,
                                            fontFamily: 'Sora_500Medium'
                                        }}>{selectedStat.charAt(0).toUpperCase() + selectedStat.slice(1)}</Text>}
                                    <ArrowDown2 style={{opacity: .7}} size={16} color={colors.text}/>
                                </View>
                            </TouchableOpacity>
                        </View>
                        <DataLineChart secondaryLabel titleStyle={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 24,
                            marginBottom: 10,
                            color: colors.text,
                            marginTop: 20
                        }} title={"Last Game"} precise={tab && 3}
                                       lastVal={selectedPlayer ? (selectedPlayer?.last5Games.map((r, i) => {
                                           return isNaN(parseFloat(r[`${selectedStat}`])) ? 0 : parseFloat(r[`${selectedStat}`])
                                       })).reverse().slice(-1) : 0} override
                                       data={selectedPlayer?.last5Games.map((r, i) => {
                                           return {
                                               value: isNaN(parseFloat(r[`${selectedStat}`])) ? 0 : parseFloat(r[`${selectedStat}`]),
                                               timestamp: selectedPlayer?.last5Games.map((r, i) => {
                                                   return new Date(r.gameDate).getTime() / 1000
                                               }).reverse()
                                           }
                                       }).reverse()}
                                       colors={colors}
                                       selectedTeam={selectedPlayer?.currentTeamAbbrev}/>
                    </ScrollView>

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
                            bottomSheetRef2.current.close()
                            setTimeout(() => {
                                setSelectedStat(!tab ? "goals" : "savePctg")

                            }, 150)
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab ? "Goals" : "Save %"}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })

                            bottomSheetRef2.current.close()
                            setTimeout(() => {
                                setSelectedStat(!tab ? "assists" : "goalsAgainst")

                            }, 150)
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab ? "Assists" : "Goals Against"}
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            bottomSheetRef2.current.close()
                            setTimeout(() => {
                                setSelectedStat("points")

                            }, 150)

                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab && "Points"}
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })

                            bottomSheetRef2.current.close()
                            setTimeout(() => {
                                setSelectedStat(!tab && "shots")

                            }, 150)

                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab && "Shots"}
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            bottomSheetRef2.current.close()

                            setTimeout(() => {
                                setSelectedStat(!tab && "pim")

                            }, 150)


                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab && "PIM"}
                            </Text></TouchableOpacity>

                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setTimeout(() => {
                                setSelectedStat(!tab && "powerPlayGoals")

                            }, 150)
                            bottomSheetRef2.current.close()

                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab && "PPG"}
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })

                            bottomSheetRef2.current.close()
                            setTimeout(() => {
                                setSelectedStat(!tab && "shorthandedGoals")

                            }, 150)
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab && "SHG"}
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            bottomSheetRef2.current.close()
                            setTimeout(() => {
                                setSelectedStat(!tab && "plusMinus")
                            }, 150)

                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab && "+/-"}
                            </Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            bottomSheetRef2.current.close()
                            setTimeout(() => {
                                setSelectedStat(!tab && "shifts")

                            }, 150)

                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>{!tab && "Shifts"}
                            </Text></TouchableOpacity>

                    </View>

                </BottomSheet>


            </View>
        </GestureHandlerRootView>
    );


}
