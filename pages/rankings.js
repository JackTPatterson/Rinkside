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
import {Activity, ArrowDown, ArrowDown2, ArrowUp, Crown1, Moneys, RowVertical} from "iconsax-react-native";
import {MotiView} from "moti";
import Papa from "papaparse";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import * as Progress from 'react-native-progress';
import {Row, Table} from "react-native-reanimated-table";
import {SvgUri} from "react-native-svg";
import {Cell, TableWrapper} from "react-native-table-component";
import {teamAbbreviations, teamAbbreviationsWithLightImages} from "../helpers/assetsLoader";
import {sort_by} from "../helpers/dataHandlers";
import {Divider, getTeamColor} from "../helpers/UI";
import teamData from "../teams";

export default function Rankings() {
    const [data, setData] = useState(null)

    const [tab, setTab] = useState(3);

    let commonConfig = {delimiter: ","};

    const [favTeam, setFavTeam] = useState(null);

    const [power, setPower] = useState(null);

    const [standings, setStandings] = useState(null)

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

    const [movement, setMovement] = useState(null)


    const getStandings = () => {
        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch(`https://api-web.nhle.com/v1/standings/now`, requestOptions)
            .then(response => response.text())
            .then(result => {
                setStandings(JSON.parse(result).standings)
            })
    }


    const getPOData = () => {
        console.log("Test1")
        if (!data) {
            console.log("Test2")
            Papa.parse(
                "https://moneypuck.com/moneypuck/simulations/simulations_recent.csv",
                {
                    ...commonConfig,
                    header: true,
                    download: true,
                    complete: (result) => {
                        console.log("Test3")
                        setData(result.data);
                    }
                }
            );
        }

    }

    useEffect(() => {
        if (!favTeam) {
            getData()
        }
        getStandings()

    }, [])


    const teamName = (id) => teamData.filter((item) => {
        return (item.abbreviation === id);
    })


    const getPowerRankings = () => {

        if (!power)
            Papa.parse(
                `https://moneypuck.com/moneypuck/powerRankings/rankings.csv`,
                {
                    ...commonConfig,
                    header: true,
                    download: true,
                    complete: (result) => {
                        setPower(result.data);
                    }
                }
            );


        // Get today's date
        var today = new Date();

        // Subtract 7 days
        var sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Format the date parts with leading zeros if necessary
        var year = sevenDaysAgo.getFullYear();
        var month = (sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0');
        var day = sevenDaysAgo.getDate().toString().padStart(2, '0');

        // Construct the formatted date string
        var formattedDate = year + '_' + month + '_' + day;

        if (!movement)
            Papa.parse(
                `https://moneypuck.com/moneypuck/powerRankings/rankings_${formattedDate}.csv`,
                {
                    ...commonConfig,
                    header: true,
                    download: true,
                    complete: (result) => {
                        setMovement(result.data.map((rank, i) => {
                            return {rank: rank.rank, team: rank.teamCode}
                        }))
                    }
                }
            );
    }


    const bottomSheetRef = useRef(null);
    const bottomSheetRef2 = useRef(null);

    const snapPoints = useMemo(() => ['75%'], []);
    const snapPoints2 = useMemo(() => ['30%'], []);

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
                <Progress.Bar unfilledColor={colors.card} color={getTeamColor(props.teamCode, colors) ?? "black"}
                              borderRadius={100} borderWidth={0} style={{marginVertical: 0}}
                              progress={!isNaN(pct / 100) ? pct / 100 : 0} height={10}
                              width={Dimensions.get('window').width - 40}/>
            </View>
        )
    }


    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);

    const {colors} = useTheme();

    const [selView, setSelView] = useState("League")


    const Rank = (props) => {

        const rank = props.rank;
        const i = props.i;


        let team = teamData.filter((item) => {
            return (item.abbreviation === rank.teamCode);
        })

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
                          style={{
                              height: 60,
                              backgroundColor: getTeamColor(team[0]?.abbreviation, colors),
                              borderRadius: 15,
                              marginRight: 5
                          }}>
                    {val > 70 && rank.teamCode &&
                        <MotiView from={{
                            opacity: 0,
                            marginLeft: -10
                        }}
                                  animate={{
                                      opacity: 1,
                                      marginLeft: -0

                                  }}
                                  transition={{
                                      type: 'timing',
                                      delay: 10 * i + 200,
                                      duration: 500
                                  }}>
                            <Image style={{
                                height: 40, width: 60, transform: [{scale: .7}], flexDirection: 'column',
                                justifyContent: 'center',
                                marginLeft: 0,
                                marginTop: 10
                            }} source={assets[teamAbbreviations.indexOf(rank.teamCode)]}/></MotiView>
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
                        color: val > 100 ? getTeamColor(team[0]?.abbreviation, colors) === "#fff" ? "black" : colors.text : 'white',
                        fontSize: 16,
                        top: 20,
                        fontFamily: 'Sora_500Medium'

                    }}>{((parseFloat(!tab ? rank.madePlayoffs : rank.draftLottery)).toFixed(2) * 100) > 0 ? parseInt((parseFloat(!tab ? rank.madePlayoffs : rank.draftLottery)).toFixed(2) * 100) : 0}%</Text>
                </MotiView>
                {val < 70 && rank.teamCode &&
                    <MotiView from={{
                        opacity: 0,
                        marginLeft: -10
                    }}
                              animate={{
                                  opacity: 1,
                                  marginLeft: -0
                              }}
                              transition={{
                                  type: 'timing',
                                  delay: 10 * i + 200,
                                  duration: 500
                              }}>
                        <Image style={{
                            height: 40, width: 60, transform: [{scale: .7}], flexDirection: 'column',
                            justifyContent: 'center'
                        }} source={assets[teamAbbreviations.indexOf(rank.teamCode)]}/></MotiView>
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

    const parseRankDiff = (rankNow, rankPrev) => {

    }


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

    if (!fontsLoaded) {
        return <></>
    } else return (
        <GestureHandlerRootView>
            <View style={styles.container}>
                <SafeAreaView style={{width: '100%'}}>
                    <Text style={{
                        fontFamily: 'Sora_500Medium',
                        marginBottom: 10,
                        fontSize: 24,
                        color: colors.text,
                        marginHorizontal: 10
                    }}>Rankings</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                marginBottom: 10,
                                marginTop: 10, marginHorizontal: 10
                            }}>
                                <TouchableOpacity style={tab === 3 ? styles.activeButton : styles.inactiveButton}
                                                  onPress={() => {
                                                      Haptics.selectionAsync()
                                                      setTab(3)
                                                  }}>
                                    <RowVertical color={tab === 3 ? colors.background : colors.text}/>

                                    <Text style={tab === 3 ? styles.activeText : styles.inactiveText}>Standings</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={tab === 2 ? styles.activeButton : styles.inactiveButton}
                                                  onPress={() => {
                                                      setTab(2)
                                                      Haptics.selectionAsync()
                                                      getPowerRankings()
                                                  }}>
                                    <Activity color={tab === 2 ? colors.background : colors.text}/>

                                    <Text style={tab === 2 ? styles.activeText : styles.inactiveText}>Power
                                        Rankings</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                                                  onPress={() => {
                                                      if (!data) {
                                                          getPOData()
                                                      }
                                                      Haptics.selectionAsync()
                                                      setTab(0)
                                                  }}>
                                    <Crown1 color={tab === 0 ? colors.background : colors.text}/>

                                    <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Playoffs</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={tab === 1 ? styles.activeButton : styles.inactiveButton}
                                                  onPress={() => {
                                                      setTab(1)
                                                      if (!data) {
                                                          getPOData()
                                                      }
                                                      Haptics.selectionAsync()
                                                  }}>
                                    <Moneys color={tab === 1 ? colors.background : colors.text}/>

                                    <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Lottery</Text>
                                </TouchableOpacity>

                            </View>
                        </View>
                    </ScrollView>


                    {tab === 3 && <View style={{marginBottom: 10}}>
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
                            }}>Layout</Text>
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
                                }}>{selView}</Text>
                                <ArrowDown2 style={{opacity: .7}} size={16} color={colors.text}/>
                            </View>
                        </TouchableOpacity>

                    </View>}
                    {tab === 2 &&
                        <ScrollView horizontal>
                            <Table>
                                <Row textStyle={{
                                    fontFamily: 'Sora_600SemiBold',
                                    color: colors.text,
                                    fontSize: 14, opacity: .5
                                }} style={{marginBottom: 10}}
                                     widthArr={[50, 300, 70]}
                                     data={["POS", "TEAM", "WEEKLY MVMT"]}/>
                                <ScrollView style={{
                                    height: Dimensions.get('window').height - 280, marginLeft: 5
                                }}>
                                    {
                                        power?.map((team, index) => {
                                            return team.teamCode && <MotiView from={{
                                                opacity: 0,
                                                translateY: -15
                                            }}
                                                                              animate={{
                                                                                  opacity: power === null ? 0 : 1,
                                                                                  translateY: power === null ? -15 : 0
                                                                              }}
                                                                              transition={{
                                                                                  type: 'spring',
                                                                                  duration: 300,
                                                                                  delay: index * 50
                                                                              }}>
                                                <TableWrapper
                                                    style={{flexDirection: 'row'}}
                                                    key={index}>
                                                    {
                                                        [index + 1,
                                                            team.teamCode,
                                                            (team.rank - movement?.filter((t) => {
                                                                return t.team === team.teamCode
                                                            })[0].rank) * -1


                                                        ].map((data, cellIndex) => {
                                                            return <Cell style={{
                                                                width: [33, 310, 100][cellIndex]
                                                            }} textStyle={{
                                                                fontFamily: 'Sora_600SemiBold',
                                                                color: colors.text,
                                                                textAlign: 'left',
                                                                fontSize: 16

                                                            }} key={cellIndex}
                                                                         data={cellIndex === 1 ?
                                                                             <View style={{
                                                                                 flexDirection: 'row',
                                                                                 alignItems: 'center'

                                                                             }}>
                                                                                 <Image style={{
                                                                                     height: 50,
                                                                                     width: 70,
                                                                                     transform: [{scale: .7}],
                                                                                     flexDirection: 'column',
                                                                                     justifyContent: 'center'
                                                                                 }}
                                                                                        source={assets[teamAbbreviations.indexOf(team?.teamCode)]}/>
                                                                                 <Text style={{
                                                                                     fontFamily: 'Sora_600SemiBold',
                                                                                     color: colors.text,
                                                                                     textAlign: 'left',
                                                                                     fontSize: 16

                                                                                 }}>{teamName(team.teamCode)[0]?.name}</Text>
                                                                             </View> : cellIndex === 2 ?
                                                                                 <View
                                                                                     style={{
                                                                                         flexDirection: 'row',
                                                                                         gap: 4
                                                                                     }}>
                                                                                     {data > 0 ?
                                                                                         <ArrowUp color={'#7adba2'}
                                                                                                  size={20}/> : data === 0 ? <></> :
                                                                                             <ArrowDown
                                                                                                 color={'#f54242'}
                                                                                                 size={20}/>}
                                                                                     <Text style={{
                                                                                         fontFamily: 'Sora_600SemiBold',
                                                                                         marginLeft: data === 0 && 20,
                                                                                         color: data > 0 ? "#7adba2" : data === 0 ? colors.text : "#f54242",
                                                                                         fontSize: 16,
                                                                                         textAlign: 'right'
                                                                                     }}>
                                                                                         {Math.abs(data)}
                                                                                     </Text>
                                                                                 </View> : data}/>
                                                        })
                                                    }
                                                </TableWrapper>
                                            </MotiView>
                                        })
                                    }
                                    <View style={{height: 50}}/>
                                </ScrollView>

                            </Table>
                        </ScrollView>

                    }

                    {(tab === 0 || tab === 1) &&
                        <View style={{height: Dimensions.get('window').height - 280, marginTop: 10}}>
                            <ScrollView>
                                {tab === 0 && <View>
                                    <View>
                                        {data?.sort(sort_by('madePlayoffs', true, parseFloat)).map((rank, i) => {
                                            return rank.teamCode === favTeam ? <Rank key={i} onClick={() => {
                                                Haptics.selectionAsync()
                                                setSel(rank)
                                                !tab ? bottomSheetRef.current.expand() : null
                                            }} rank={rank} i={0}/> : null
                                        })}
                                    </View>
                                    <Divider colors={colors}/>
                                    <View style={{marginTop: 2}}>
                                        {data?.sort(sort_by('madePlayoffs', true, parseFloat)).map((rank, i) => {
                                            return <Rank key={i} onClick={() => {
                                                Haptics.selectionAsync()
                                                setSel(rank)
                                                !tab ? bottomSheetRef.current.expand() : null
                                            }} rank={rank} i={i + 1}/>
                                        })}
                                    </View>
                                </View>}
                                {tab === 1 && <View>
                                    <View style={{marginBottom: 5}}>
                                        {data?.sort(sort_by('draftLottery', true, parseFloat)).map((rank, i) => {
                                            return rank.teamCode === favTeam ? <Rank key={i} onClick={() => {
                                                Haptics.selectionAsync()
                                                setSel(rank)
                                                !tab ? bottomSheetRef.current.expand() : null
                                            }} rank={rank} i={0}/> : null
                                        })}
                                    </View>
                                    <Divider colors={colors}/>
                                    <View style={{marginTop: 10}}>
                                        {data?.sort(sort_by('draftLottery', true, parseFloat)).map((rank, i) => {
                                            return <Rank key={i} onClick={() => {
                                                Haptics.selectionAsync()
                                                setSel(rank)
                                                !tab ? bottomSheetRef.current.expand() : null
                                            }} rank={rank} i={i + 1}/>
                                        })}
                                    </View>
                                </View>}
                                <View/>
                            </ScrollView>
                        </View>}
                    <ScrollView horizontal showsVerticalScrollIndicator={false}
                                style={{height: Dimensions.get('window').height - 350}}>

                        <View>
                            {tab === 3 &&

                                <View style={{
                                    gap: 10, flexDirection: 'row', marginBottom: 10,
                                    justifyContent: 'flex-start',
                                    alignItems: 'center'
                                }}>
                                    <Text style={{
                                        marginRight: 33,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>RANK</Text>
                                    <Text style={{
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>TEAM</Text>
                                    <Text style={{
                                        width: 37,
                                        marginLeft: 27,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>GP</Text>
                                    <Text style={{
                                        width: 45,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>PTS</Text>
                                    <Text style={{
                                        width: 65,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>PTS%</Text>
                                    <Text style={{
                                        width: 42,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>STRK</Text>
                                    <Text style={{
                                        width: 80, marginLeft: 15,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold', textAlign: 'center'
                                    }}>10 GAME{"\n"} W <Text style={{fontFamily: ""}}>•</Text> L <Text
                                        style={{fontFamily: ""}}>•</Text> OTL</Text>
                                    <Text style={{
                                        width: 40, marginLeft: 20,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>W</Text>
                                    <Text style={{
                                        width: 33,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>L</Text>
                                    <Text style={{
                                        width: 39,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold'
                                    }}>OTL</Text>
                                    <Text style={{
                                        width: 58, marginLeft: 5,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold', textAlign: 'center'
                                    }}>HOME W <Text style={{fontFamily: ""}}>•</Text> L</Text>
                                    <Text style={{
                                        width: 48, marginLeft: 17,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold', textAlign: 'center'
                                    }}>ROAD W <Text style={{fontFamily: ""}}>•</Text> L</Text>
                                    <Text style={{
                                        width: 48, marginLeft: 20,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold', textAlign: 'center'
                                    }}>SO Wins</Text>
                                    <Text style={{
                                        width: 48, marginLeft: 16,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold', textAlign: 'center'
                                    }}>GOAL DIFF.</Text>
                                    <Text style={{
                                        width: 80, marginLeft: 0,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold', textAlign: 'center'
                                    }}>HOME GOAL DIFF.</Text>
                                    <Text style={{
                                        width: 80, marginLeft: 0,
                                        color: colors.text,
                                        fontSize: 14,
                                        opacity: .5,
                                        fontFamily: 'Sora_600SemiBold', textAlign: 'center'
                                    }}>ROAD GOAL DIFF.</Text>

                                </View>
                            }
                            {tab === 3 &&
                                <ScrollView
                                    showsHorizontalScrollIndicator={false}>
                                    <View style={{marginLeft: -10}}>


                                        {selView === "League" ? standings?.map((rank, i) => {

                                            return <MotiView from={{
                                                opacity: 0,
                                                translateY: -15
                                            }}
                                                             animate={{
                                                                 opacity: standings === null ? 0 : 1,
                                                                 translateY: standings === null ? -15 : 0
                                                             }}
                                                             transition={{
                                                                 type: 'spring',
                                                                 duration: 300,
                                                                 delay: i * 50
                                                             }}>
                                                <View style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-start',
                                                    alignItems: 'center',
                                                    paddingVertical: 5,
                                                    marginBottom: 4,
                                                    borderRadius: 15,
                                                    marginHorizontal: favTeam === rank.teamAbbrev.default ? 15 : 5,
                                                    paddingLeft: favTeam === rank.teamAbbrev.default ? 18 : 20,
                                                    borderColor: favTeam === rank.teamAbbrev.default ? getTeamColor(rank.teamAbbrev.default, colors) : "",
                                                    borderWidth: favTeam === rank.teamAbbrev.default ? 2 : 0
                                                }}>

                                                    <View style={{
                                                        flexDirection: 'row',
                                                        justifyContent: 'flex-start',
                                                        alignItems: 'center',
                                                        width: 150

                                                    }}>
                                                        <Text style={{
                                                            color: colors.text,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_800ExtraBold'
                                                        }}>{i + 1}</Text>

                                                        <View style={{
                                                            alignItems: 'center'
                                                        }}>

                                                            <Image style={{
                                                                height: 50,
                                                                width: 70,
                                                                transform: [{scale: .7}],
                                                                flexDirection: 'column',
                                                                justifyContent: 'center'
                                                            }}
                                                                   source={assets[teamAbbreviations.indexOf(rank.teamAbbrev.default)]}/>
                                                        </View>
                                                        <View>
                                                            <Text style={{
                                                                color: colors.text,
                                                                fontSize: 16,
                                                                fontFamily: 'Sora_500Medium'
                                                            }}>{rank.teamAbbrev.default}</Text>
                                                        </View>
                                                    </View>


                                                    <View style={{
                                                        gap: 20, flexDirection: 'row',
                                                        justifyContent: 'flex-start',
                                                        alignItems: 'center'
                                                    }}>
                                                        <Text style={{
                                                            width: 30,
                                                            marginLeft: favTeam === rank.teamAbbrev.default ? -10 : 0,
                                                            color: colors.text,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.gamesPlayed}</Text>

                                                        <Text style={{
                                                            color: colors.text, width: 30,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.points}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 60,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.pointPctg.toFixed(3)}</Text>
                                                        <Text style={{
                                                            color: rank.streakCode === "W" ? '#7adba2' : '#f54242',
                                                            width: 40,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.streakCode}{rank.streakCount}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 80, marginLeft: 13,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.l10Wins} <Text
                                                            style={{
                                                                fontFamily: ''
                                                            }}>•</Text> {rank.l10Losses} <Text
                                                            style={{
                                                                fontFamily: ''
                                                            }}>•</Text> {rank.l10OtLosses}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 30,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.wins}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 30,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.losses}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 30,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.otLosses}</Text>

                                                        <Text style={{
                                                            color: colors.text, width: 60, marginLeft: 7,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.homeWins} <Text
                                                            style={{fontFamily: ""}}>•</Text> {rank.homeLosses}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 60,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.roadWins} <Text
                                                            style={{fontFamily: ""}}>•</Text> {rank.roadLosses}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 60,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.shootoutWins} <Text
                                                            style={{fontFamily: ""}}>/</Text> {rank.shootoutLosses}
                                                        </Text>
                                                        <Text style={{
                                                            color: colors.text, width: 40,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.goalDifferential}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 40, marginLeft: 15,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.homeGoalDifferential}</Text>
                                                        <Text style={{
                                                            color: colors.text, width: 30, marginLeft: 32,
                                                            fontSize: 16,
                                                            fontFamily: 'Sora_400Regular'
                                                        }}>{rank.roadGoalDifferential}</Text>


                                                    </View>
                                                </View>

                                            </MotiView>
                                        }) : selView === "Conference" ? <View>
                                                <Text style={{
                                                    color: colors.text,
                                                    fontSize: 16,
                                                    marginVertical: 10,
                                                    fontFamily: 'Sora_500Medium'
                                                }}>Eastern Conference</Text>
                                                {
                                                    standings?.filter((s) => {
                                                        return s.conferenceAbbrev === "E"
                                                    }).map((rank, i) => {
                                                        return <MotiView from={{
                                                            opacity: 0,
                                                            translateY: -15
                                                        }}
                                                                         animate={{
                                                                             translateY: 0,
                                                                             opacity: 1

                                                                         }}
                                                                         transition={{
                                                                             type: 'spring',
                                                                             duration: 300,
                                                                             delay: i * 50
                                                                         }}>
                                                            <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-start',
                                                                alignItems: 'center',
                                                                paddingVertical: 5,
                                                                marginBottom: 4,
                                                                borderRadius: 15,
                                                                paddingLeft: favTeam === rank.teamAbbrev.default ? 18 : 20,
                                                                borderColor: favTeam === rank.teamAbbrev.default ? getTeamColor(rank.teamAbbrev.default, colors) : "",
                                                                borderWidth: favTeam === rank.teamAbbrev.default ? 2 : 0
                                                            }}>
                                                                <View style={{
                                                                    flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center',
                                                                    width: 150

                                                                }}>
                                                                    <Text style={{
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_800ExtraBold'
                                                                    }}>{i + 1}</Text>

                                                                    <View style={{
                                                                        alignItems: 'center'
                                                                    }}>

                                                                        <Image style={{
                                                                            height: 50,
                                                                            width: 70,
                                                                            transform: [{scale: .7}],
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                               source={assets[teamAbbreviations.indexOf(rank.teamAbbrev.default)]}/>
                                                                    </View>
                                                                    <View>
                                                                        <Text style={{
                                                                            color: colors.text,
                                                                            fontSize: 16,
                                                                            fontFamily: 'Sora_500Medium'
                                                                        }}>{rank.teamAbbrev.default}</Text>
                                                                    </View>
                                                                </View>


                                                                <View style={{
                                                                    gap: 20, flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <Text style={{
                                                                        width: 30,
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.gamesPlayed}</Text>

                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.points}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.pointPctg.toFixed(3)}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.wins}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.losses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.otLosses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.streakCount}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.homeLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.roadLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.shootoutWins} <Text
                                                                        style={{fontFamily: ""}}>/</Text> {rank.shootoutLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.goalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeGoalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadGoalDifferential}</Text>

                                                                </View>

                                                            </View>
                                                        </MotiView>
                                                    })
                                                }
                                                <Text style={{
                                                    color: colors.text,
                                                    fontSize: 16,
                                                    marginVertical: 10,
                                                    fontFamily: 'Sora_500Medium'
                                                }}>Western Conference</Text>
                                                {
                                                    standings?.filter((s) => {
                                                        return s.conferenceAbbrev === "W"
                                                    }).map((rank, i) => {
                                                        return <MotiView from={{
                                                            opacity: 0,
                                                            translateY: -15
                                                        }}
                                                                         animate={{
                                                                             opacity: 1,
                                                                             translateY: 0
                                                                         }}
                                                                         transition={{
                                                                             type: 'spring',
                                                                             duration: 300,
                                                                             delay: i * 50
                                                                         }}>
                                                            <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-start',
                                                                alignItems: 'center',
                                                                paddingVertical: 5,
                                                                marginBottom: 4,
                                                                borderRadius: 15,
                                                                paddingLeft: favTeam === rank.teamAbbrev.default ? 18 : 20,
                                                                borderColor: favTeam === rank.teamAbbrev.default ? getTeamColor(rank.teamAbbrev.default, colors) : "",
                                                                borderWidth: favTeam === rank.teamAbbrev.default ? 2 : 0
                                                            }}>
                                                                <View style={{
                                                                    flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center',
                                                                    width: 150

                                                                }}>
                                                                    <Text style={{
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_800ExtraBold'
                                                                    }}>{i + 1}</Text>

                                                                    <View style={{
                                                                        alignItems: 'center'
                                                                    }}>

                                                                        <Image style={{
                                                                            height: 50,
                                                                            width: 70,
                                                                            transform: [{scale: .7}],
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                               source={assets[teamAbbreviations.indexOf(rank.teamAbbrev.default)]}/>
                                                                    </View>
                                                                    <View>
                                                                        <Text style={{
                                                                            color: colors.text,
                                                                            fontSize: 16,
                                                                            fontFamily: 'Sora_500Medium'
                                                                        }}>{rank.teamAbbrev.default}</Text>
                                                                    </View>
                                                                </View>


                                                                <View style={{
                                                                    gap: 20, flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <Text style={{
                                                                        width: 30,
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.gamesPlayed}</Text>

                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.points}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.pointPctg.toFixed(3)}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.wins}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.losses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.otLosses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.streakCount}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.homeLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.roadLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.shootoutWins} <Text
                                                                        style={{fontFamily: ""}}>/</Text> {rank.shootoutLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.goalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeGoalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadGoalDifferential}</Text>

                                                                </View>

                                                            </View>
                                                        </MotiView>
                                                    })
                                                }
                                            </View> :
                                            <View>
                                                <Text style={{
                                                    color: colors.text,
                                                    fontSize: 16,
                                                    marginVertical: 10,
                                                    fontFamily: 'Sora_500Medium'
                                                }}>Metropolitan Division</Text>
                                                {
                                                    standings?.filter((s) => {
                                                        return s.divisionAbbrev === "M"
                                                    }).map((rank, i) => {
                                                        return <MotiView from={{
                                                            opacity: 0,
                                                            translateY: -15
                                                        }}
                                                                         animate={{
                                                                             opacity: 1,
                                                                             translateY: 0
                                                                         }}
                                                                         transition={{
                                                                             type: 'spring',
                                                                             duration: 300,
                                                                             delay: i * 50
                                                                         }}>
                                                            <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-start',
                                                                alignItems: 'center',
                                                                paddingVertical: 5,
                                                                marginBottom: 4,
                                                                borderRadius: 15,
                                                                paddingLeft: favTeam === rank.teamAbbrev.default ? 18 : 20,
                                                                borderColor: favTeam === rank.teamAbbrev.default ? getTeamColor(rank.teamAbbrev.default, colors) : "",
                                                                borderWidth: favTeam === rank.teamAbbrev.default ? 2 : 0
                                                            }}>
                                                                <View style={{
                                                                    flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center',
                                                                    width: 150

                                                                }}>
                                                                    <Text style={{
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_800ExtraBold'
                                                                    }}>{i + 1}</Text>

                                                                    <View style={{
                                                                        alignItems: 'center'
                                                                    }}>

                                                                        <Image style={{
                                                                            height: 50,
                                                                            width: 70,
                                                                            transform: [{scale: .7}],
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                               source={assets[teamAbbreviations.indexOf(rank.teamAbbrev.default)]}/>
                                                                    </View>
                                                                    <View>
                                                                        <Text style={{
                                                                            color: colors.text,
                                                                            fontSize: 16,
                                                                            fontFamily: 'Sora_500Medium'
                                                                        }}>{rank.teamAbbrev.default}</Text>
                                                                    </View>
                                                                </View>


                                                                <View style={{
                                                                    gap: 20, flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <Text style={{
                                                                        width: 30,
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.gamesPlayed}</Text>

                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.points}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.pointPctg.toFixed(3)}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.wins}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.losses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.otLosses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.streakCount}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.homeLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.roadLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.shootoutWins} <Text
                                                                        style={{fontFamily: ""}}>/</Text> {rank.shootoutLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.goalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeGoalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadGoalDifferential}</Text>

                                                                </View>

                                                            </View>
                                                        </MotiView>
                                                    })
                                                }
                                                <Text style={{
                                                    color: colors.text,
                                                    fontSize: 16,
                                                    marginVertical: 10,
                                                    fontFamily: 'Sora_500Medium'
                                                }}>Atlantic Division</Text>
                                                {
                                                    standings?.filter((s) => {
                                                        return s.divisionAbbrev === "A"
                                                    }).map((rank, i) => {
                                                        return <MotiView from={{
                                                            opacity: 0,
                                                            translateY: -15
                                                        }}
                                                                         animate={{
                                                                             opacity: 1,
                                                                             translateY: 0
                                                                         }}
                                                                         transition={{
                                                                             type: 'spring',
                                                                             duration: 300,
                                                                             delay: i * 50
                                                                         }}><View style={{
                                                            flexDirection: 'row',
                                                            justifyContent: 'flex-start',
                                                            alignItems: 'center',
                                                            paddingVertical: 5,
                                                            marginBottom: 4,
                                                            borderRadius: 15,
                                                            paddingLeft: favTeam === rank.teamAbbrev.default ? 18 : 20,
                                                            borderColor: favTeam === rank.teamAbbrev.default ? getTeamColor(rank.teamAbbrev.default, colors) : "",
                                                            borderWidth: favTeam === rank.teamAbbrev.default ? 2 : 0
                                                        }}>
                                                            <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-start',
                                                                alignItems: 'center',
                                                                width: 150

                                                            }}>
                                                                <Text style={{
                                                                    color: colors.text,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_800ExtraBold'
                                                                }}>{i + 1}</Text>

                                                                <View style={{
                                                                    alignItems: 'center'
                                                                }}>

                                                                    <Image style={{
                                                                        height: 50,
                                                                        width: 70,
                                                                        transform: [{scale: .7}],
                                                                        flexDirection: 'column',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                           source={assets[teamAbbreviations.indexOf(rank.teamAbbrev.default)]}/>
                                                                </View>
                                                                <View>
                                                                    <Text style={{
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_500Medium'
                                                                    }}>{rank.teamAbbrev.default}</Text>
                                                                </View>
                                                            </View>


                                                            <View style={{
                                                                gap: 20, flexDirection: 'row',
                                                                justifyContent: 'flex-start',
                                                                alignItems: 'center'
                                                            }}>
                                                                <Text style={{
                                                                    width: 30,
                                                                    color: colors.text,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.gamesPlayed}</Text>

                                                                <Text style={{
                                                                    color: colors.text, width: 30,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.points}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 60,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.pointPctg.toFixed(3)}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 30,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.wins}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 30,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.losses}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 30,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.otLosses}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 30,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.streakCount}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 60,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.homeWins} <Text
                                                                    style={{fontFamily: ""}}>•</Text> {rank.homeLosses}
                                                                </Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 60,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.roadWins} <Text
                                                                    style={{fontFamily: ""}}>•</Text> {rank.roadLosses}
                                                                </Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 60,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.shootoutWins} <Text
                                                                    style={{fontFamily: ""}}>/</Text> {rank.shootoutLosses}
                                                                </Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 40,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.goalDifferential}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 40,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.homeGoalDifferential}</Text>
                                                                <Text style={{
                                                                    color: colors.text, width: 60,
                                                                    fontSize: 16,
                                                                    fontFamily: 'Sora_400Regular'
                                                                }}>{rank.roadGoalDifferential}</Text>

                                                            </View>

                                                        </View>
                                                        </MotiView>
                                                    })
                                                }
                                                <Text style={{
                                                    color: colors.text,
                                                    fontSize: 16,
                                                    marginVertical: 10,
                                                    fontFamily: 'Sora_500Medium'
                                                }}>Central Division</Text>
                                                {
                                                    standings?.filter((s) => {
                                                        return s.divisionAbbrev === "C"
                                                    }).map((rank, i) => {
                                                        return <MotiView from={{
                                                            opacity: 0,
                                                            translateY: -15
                                                        }}
                                                                         animate={{
                                                                             opacity: 1,
                                                                             translateY: 0
                                                                         }}
                                                                         transition={{
                                                                             type: 'spring',
                                                                             duration: 300,
                                                                             delay: i * 50
                                                                         }}>
                                                            <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-start',
                                                                alignItems: 'center',
                                                                paddingVertical: 5,
                                                                marginBottom: 4,
                                                                borderRadius: 15,
                                                                paddingLeft: favTeam === rank.teamAbbrev.default ? 18 : 20,
                                                                borderColor: favTeam === rank.teamAbbrev.default ? getTeamColor(rank.teamAbbrev.default, colors) : "",
                                                                borderWidth: favTeam === rank.teamAbbrev.default ? 2 : 0
                                                            }}>
                                                                <View style={{
                                                                    flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center',
                                                                    width: 150

                                                                }}>
                                                                    <Text style={{
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_800ExtraBold'
                                                                    }}>{i + 1}</Text>

                                                                    <View style={{
                                                                        alignItems: 'center'
                                                                    }}>

                                                                        <Image style={{
                                                                            height: 50,
                                                                            width: 70,
                                                                            transform: [{scale: .7}],
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                               source={assets[teamAbbreviations.indexOf(rank.teamAbbrev.default)]}/>
                                                                    </View>
                                                                    <View>
                                                                        <Text style={{
                                                                            color: colors.text,
                                                                            fontSize: 16,
                                                                            fontFamily: 'Sora_500Medium'
                                                                        }}>{rank.teamAbbrev.default}</Text>
                                                                    </View>
                                                                </View>


                                                                <View style={{
                                                                    gap: 20, flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <Text style={{
                                                                        width: 30,
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.gamesPlayed}</Text>

                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.points}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.pointPctg.toFixed(3)}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.wins}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.losses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.otLosses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.streakCount}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.homeLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.roadLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.shootoutWins} <Text
                                                                        style={{fontFamily: ""}}>/</Text> {rank.shootoutLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.goalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeGoalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadGoalDifferential}</Text>

                                                                </View>

                                                            </View>
                                                        </MotiView>
                                                    })
                                                }
                                                <Text style={{
                                                    color: colors.text,
                                                    fontSize: 16,
                                                    marginVertical: 10,
                                                    fontFamily: 'Sora_500Medium'
                                                }}>Pacific Division</Text>
                                                {
                                                    standings?.filter((s) => {
                                                        return s.divisionAbbrev === "P"
                                                    }).map((rank, i) => {
                                                        return <MotiView from={{
                                                            opacity: 0,
                                                            translateY: -15
                                                        }}
                                                                         animate={{
                                                                             opacity: 1,
                                                                             translateY: 0
                                                                         }}
                                                                         transition={{
                                                                             type: 'spring',
                                                                             duration: 300,
                                                                             delay: i * 50
                                                                         }}>
                                                            <View style={{
                                                                flexDirection: 'row',
                                                                justifyContent: 'flex-start',
                                                                alignItems: 'center',
                                                                paddingVertical: 5,
                                                                marginBottom: 4,
                                                                borderRadius: 15,
                                                                paddingLeft: favTeam === rank.teamAbbrev.default ? 18 : 20,
                                                                borderColor: favTeam === rank.teamAbbrev.default ? getTeamColor(rank.teamAbbrev.default, colors) : "",
                                                                borderWidth: favTeam === rank.teamAbbrev.default ? 2 : 0
                                                            }}>
                                                                <View style={{
                                                                    flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center',
                                                                    width: 150

                                                                }}>
                                                                    <Text style={{
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_800ExtraBold'
                                                                    }}>{i + 1}</Text>

                                                                    <View style={{
                                                                        alignItems: 'center'
                                                                    }}>

                                                                        <Image style={{
                                                                            height: 50,
                                                                            width: 70,
                                                                            transform: [{scale: .7}],
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                               source={assets[teamAbbreviations.indexOf(rank.teamAbbrev.default)]}/>
                                                                    </View>
                                                                    <View>
                                                                        <Text style={{
                                                                            color: colors.text,
                                                                            fontSize: 16,
                                                                            fontFamily: 'Sora_500Medium'
                                                                        }}>{rank.teamAbbrev.default}</Text>
                                                                    </View>
                                                                </View>


                                                                <View style={{
                                                                    gap: 20, flexDirection: 'row',
                                                                    justifyContent: 'flex-start',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <Text style={{
                                                                        width: 30,
                                                                        color: colors.text,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.gamesPlayed}</Text>

                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.points}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.pointPctg.toFixed(3)}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.wins}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.losses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.otLosses}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 30,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.streakCount}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.homeLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadWins} <Text
                                                                        style={{fontFamily: ""}}>•</Text> {rank.roadLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.shootoutWins} <Text
                                                                        style={{fontFamily: ""}}>/</Text> {rank.shootoutLosses}
                                                                    </Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.goalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 40,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.homeGoalDifferential}</Text>
                                                                    <Text style={{
                                                                        color: colors.text, width: 60,
                                                                        fontSize: 16,
                                                                        fontFamily: 'Sora_400Regular'
                                                                    }}>{rank.roadGoalDifferential}</Text>

                                                                </View>

                                                            </View>
                                                        </MotiView>
                                                    })
                                                }
                                            </View>

                                        }
                                    </View>

                                </ScrollView>

                            }
                        </View>


                        <View style={{marginBottom: 100}}/>
                    </ScrollView>
                </SafeAreaView>
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
                        }}>Select View
                        </Text>

                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelView("League")
                            bottomSheetRef2.current.close()
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>League
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelView("Conference")
                            bottomSheetRef2.current.close()
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>Conference
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Haptics.selectionAsync().then(() => {
                            })
                            setSelView("Division")
                            bottomSheetRef2.current.close()
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontSize: 20,
                                fontFamily: 'Sora_600SemiBold'
                            }}>Division
                            </Text>
                        </TouchableOpacity>


                    </View>

                </BottomSheet>
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
