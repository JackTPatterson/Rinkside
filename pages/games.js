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
import {ArrowLeft, ArrowRight} from "iconsax-react-native";
import Papa from "papaparse";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import teamData from "../teams";


export default function Games({navigation}) {

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

    const bottomSheetRef = useRef(null);

    const snapPoints = useMemo(() => ['75%'], []);


    const [isLoading, setIsLoading] = useState(true)

    const { colors } = useTheme();

    const getDate = (offset) => {
        const today = new Date();
        today.setDate(today.getDate() + offset);
        today.setHours(today.getHours()-4)

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
            backgroundColor: colors.background,
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


    function getMatchData(dateOffset){
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



    useEffect(() => {
        getMatchData(0)
    }, [])

    function getPCTColor(teamCode) {
        let team = teamData.filter((item) => {
            return (item.abbreviation === teamCode);
        })
        return team[0]?.primary_color;
    }

    let commonConfig = {delimiter: ","};

    const [days, setDays] = useState(null);

    const [selectedTeam, setSelectedTeam] = useState(null);

    const [homeGoalie, setHomeGoalie] = useState({name: "", confirmed_by: null, id: 0});
    const [awayGoalie, setAwayGoalie] = useState({name: "", confirmed_by: null, id: 0});

    const [homeGoalieStats, setHomeGoalieStats] = useState({GSA: 0, SP: 0, GSAx: 0})
    const [awayGoalieStats, setAwayGoalieStats] = useState({GSA: 0, SP: 0, GSAx: 0});


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
                                setPP({
                                    h: (result.data.slice(-2)[0]).homeSkatersOnIce,
                                    a: (result.data.slice(-2)[0]).awaySkatersOnIce
                                });


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


            if(props.game.homeTeam.score !== undefined){
                if(props.game.clock?.timeRemaining === "00:00" || props.game.gameOutcome?.lastPeriodType){
                    return "Final"
                }
                else if(props.game.clock?.inIntermission){
                    return "INT"
                }
                else return props.game.clock?.timeRemaining
            }


            return formatAMPM(new Date(game.startTimeUTC))

        }

        return <TouchableOpacity onPress={() => {
            Haptics.selectionAsync().then(r => {});
            navigation.push("Games_Detail", {data: {data: game, date: dt, prob: {h: 1 - hwp, a: hwp}}})
        }}
                                 onLongPress={()=>{
                                     bottomSheetRef.current.expand();
                                     Haptics.selectionAsync().then(r => {});
                                     setAwayGoalieStats({
                                         GSA:0,
                                         SP: 0,
                                         GSAx: 0
                                     })
                                     setHomeGoalieStats({
                                         GSA:0,
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
                                                 setAwayGoalie({name: result?.data[0].goalie_name, confirmed_by: result?.data[0].handle, id: result?.data[0].goalie_id})
                                                 Papa.parse(
                                                     `https://moneypuck.com/moneypuck/playerData/seasonSummary/2023_goalies.csv`,
                                                     {
                                                         ...commonConfig,
                                                         header: true,
                                                         download: true,
                                                         complete: (resultG) => {
                                                             const g = resultG.data.filter((goalie)=>{
                                                                 return goalie.playerId === result?.data[0].goalie_id && goalie.situation === "all"
                                                             })

                                                             setAwayGoalieStats({
                                                                 GSA: (g[0].goals*60)/(g[0].icetime/60).toFixed(2),
                                                                 SP: (g[0].ongoal - g[0].goals)/g[0].ongoal,
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
                                                 setHomeGoalie({name: result?.data[0].goalie_name, confirmed_by: result?.data[0].handle, id: result?.data[0].goalie_id})
                                                 Papa.parse(
                                                     `https://moneypuck.com/moneypuck/playerData/seasonSummary/2023_goalies.csv`,
                                                     {
                                                         ...commonConfig,
                                                         header: true,
                                                         download: true,
                                                         complete: (resultG) => {

                                                             const g = resultG.data.filter((goalie)=>{
                                                                 return goalie.playerId === result?.data[0].goalie_id && goalie.situation === "all"
                                                             })

                                                             setHomeGoalieStats({
                                                                 GSA: (g[0].goals*60)/(g[0].icetime/60).toFixed(2),
                                                                 SP: (g[0].ongoal - g[0].goals)/g[0].ongoal,
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
            borderRadius: 15,

        }}>
            <View style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <View style={{
                    alignItems: 'center'
                }}>

                    <Image style={{
                        height: 50, width: 70, transform: [{scale: .7}], flexDirection: 'column',
                        justifyContent: 'center'
                    }} source={assets[teamAbbreviations.indexOf(game.homeTeam.abbrev)]}/>

                    {
                        (pp?.a < pp?.h && !(game.gameOutcome?.lastPeriodType)) ?
                            <View style={{
                                backgroundColor: '#f54242',
                                paddingVertical: 0,
                                borderRadius: 15,
                                paddingHorizontal: 5,
                                flexDirection: 'row',
                                justifyContent: 'center'

                            }}>
                                <Text style={{
                                    color: colors.background,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>{game.homeTeam.abbrev}</Text>
                            </View> : <Text style={{color: colors.text, fontFamily: 'Sora_500Medium'}}>{game.homeTeam.abbrev}</Text>


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
                        }}>{ props.game.homeTeam.score ?? `${Math.round(parseFloat(1-hwp).toFixed(2)*100)}%`}</Text>
                    </View>
                    {

                        props.game.homeTeam.score !== undefined && !(getTimeLabel() === "Final") ? <View>
                            <View style={{
                                backgroundColor: colors.background,
                                paddingVertical: 5,
                                borderRadius: 5,
                                paddingHorizontal: 15
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    textAlign: 'center',
                                    fontFamily: 'Sora_500Medium'
                                }}>{props.game?.period > 3 ? "OT" : `P${props.game?.period}`}</Text>
                            </View>
                            <View style={{
                                backgroundColor: colors.background,
                                paddingVertical: 5,
                                borderRadius: 5,
                                paddingHorizontal: 15,
                                marginTop: 10
                            }}>
                                <Text style={{
                                    color: colors.text,
                                    fontFamily: 'Sora_500Medium'
                                }}>{getTimeLabel()}</Text>
                            </View>
                        </View> : <View style={{
                            backgroundColor: colors.background,
                            paddingVertical: 5,
                            borderRadius: 5,
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
                        }}>{props.game.awayTeam.score ?? `${Math.round(parseFloat(hwp).toFixed(2)*100)}%`}</Text>
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
                        (pp?.a > pp?.h && !(game.gameOutcome?.lastPeriodType)) ?
                             <View style={{
                                backgroundColor: '#f54242',
                                paddingVertical: 0,
                                borderRadius: 15,
                                paddingHorizontal: 5,
                                flexDirection: 'row',
                                justifyContent: 'center'

                            }}>
                                <Text style={{
                                    color: colors.background,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>{game.awayTeam.abbrev}</Text>
                            </View> : <Text style={{color: colors.text, fontFamily: 'Sora_500Medium' }}>{game.awayTeam.abbrev}</Text>


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
                getMatchData(0)

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

        const adjustedDate = new Date(inputDate.getTime() + offset * 24 * 60 * 60 * 1000);

        if (adjustedDate.toDateString() === today.toDateString()) {
            return "Today";
        } else if (adjustedDate.toDateString() === new Date(today.getTime() + 24 * 60 * 60 * 1000).toDateString()) {
            return "Tomorrow";
        } else if (adjustedDate.toDateString() === new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString()) {
            return "Yesterday";
        } else {
            const monthAbbreviation = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(adjustedDate);
            const day = adjustedDate.getDate();
            const daySuffix = getDaySuffix(day);
            const formattedDay = day < 10 ? `${day}${daySuffix}` : `${day}${daySuffix}`;
            return `${monthAbbreviation} ${formattedDay}`;
        }
    }

    if(!fontsLoaded){
        return <></>
    }
    else return <View style={styles.container}>
        <SafeAreaView style={{width: '100%'}}>
                <View style={{
                    flexDirection: 'row',paddingHorizontal: 10,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 20
                }}>
                            <Text style={{fontFamily: 'Sora_600SemiBold', marginBottom: 10, fontSize: 24, color: colors.text}}>Games {formatDate("2024-01-16", dateOffset+2)}</Text>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                            }}>

                                <TouchableOpacity  onLongPress={()=>{
                                    Haptics.notificationAsync()
                                    setDateOffset(0)
                                    getMatchData(0)

                                }} onPress={() => {
                                    setDateOffset(v=>v-1)
                                    getMatchData(dateOffset-1)
                                    Haptics.selectionAsync()
                                }} style={{backgroundColor: colors.card, marginRight: 10, paddingHorizontal: 15, paddingVertical: 15, borderRadius: 100}}>
                                    <ArrowLeft color={colors.text}/>
                                </TouchableOpacity>
                                <TouchableOpacity onLongPress={()=>{
                                    Haptics.notificationAsync()
                                    setDateOffset(0)
                                    getMatchData(0)
                                }} onPress={() => {
                                    setDateOffset(v=>v+1)

                                    getMatchData(dateOffset+1)
                                    Haptics.selectionAsync()
                                }} style={{backgroundColor: colors.card, paddingHorizontal: 15, paddingVertical: 15, borderRadius: 100}}>
                                    <ArrowRight color={colors.text}/>
                                </TouchableOpacity>
                            </View>


                </View>
            {isLoading ? <></> :
            <ScrollView showsVerticalScrollIndicator={false} style={{height: Dimensions.get('window').height - 215, paddingHorizontal: 10,}}>
                <Text style={{
                    marginBottom: 20,
                    fontFamily: 'Sora_600SemiBold',
                    fontSize: 16,
                    color: colors.text
                }}>Live Games</Text>

                {data.filter((g=>{
                    return !g.gameOutcome?.lastPeriodType
                })).map((game, i) => {
                    return (
                        <View style={{width: Dimensions.get('window').width - 20}}>
                        <Team game={game} keu={i}/>
                        </View>
                    )
                })}

                <Text style={{
                    marginBottom: 20,
                    marginTop: 20,
                    fontFamily: 'Sora_600SemiBold',
                    fontSize: 16,
                    color: colors.text
                }}>Upcoming Games</Text>
                {data.filter((g=>{
                    return (g.homeTeam.score === undefined || g.awayTeam.score  === undefined) && !g.gameOutcome?.lastPeriodType
                })).map((game, i) => {
                    return (
                        <Team game={game} keu={i}/>
                    )
                })}
                <Text style={{
                    marginBottom: 20,
                    marginTop: 20,
                    fontFamily: 'Sora_600SemiBold',
                    fontSize: 16,
                    color: colors.text
                }}>Finished Games</Text>
                {data.filter((g=>{
                   return g.gameOutcome?.lastPeriodType
                })).map((game, i) => {
                    return (
                            <Team game={game} keu={i}/>
                    )
                })}
                <View style={{marginBottom: 80}}/>
            </ScrollView> }
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
            { selectedTeam &&
            <View>
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '100%',
                        alignItems: 'center',
                    }}>
                        <View style={{
                            alignItems: 'center'
                        }}>
                            <Image style={{
                                height: 90, width: 120, transform: [{scale: .7}], flexDirection: 'column',
                                justifyContent: 'center'
                            }} source={assets[teamAbbreviations.indexOf(selectedTeam?.homeTeam.abbrev)]}/>
                            <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 24}}>{selectedTeam?.homeTeam.abbrev}</Text>
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
                                    <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 24}}>{selectedTeam?.awayTeam.abbrev}</Text>


                        </View>


                    </View>

                </View>
                <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, textAlign: 'center', marginTop: 20, marginBottom: 10, color: colors.text}}>Starting Goalies</Text>

                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-around',
                        width: '100%',
                        alignItems: 'center',
                    }}>
                        <View style={{
                            alignItems: 'center'
                        }}>

                            <Image style={{
                                borderRadius: 100, borderWidth: 3, height: 80, width: 80,  marginTop: 10, borderColor: `${getPCTColor(selectedTeam?.homeTeam.abbrev)}`, backgroundColor: colors.card
                            }} source={{uri: `https://assets.nhle.com/mugs/nhl/20232024/${selectedTeam?.homeTeam.abbrev}/${homeGoalie?.id}.png`}}/>
                            <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{homeGoalie.name.split(" ")[0] !== "" ? homeGoalie.name.split(" ")[0] !== "" : "Unknown"}</Text>
                            <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{homeGoalie.name.split(" ")[1]}</Text>
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
                                    borderRadius: 100, borderWidth: 3, height: 80, width: 80,  marginTop: 10, borderColor: `${getPCTColor(selectedTeam?.awayTeam.abbrev)}`,  backgroundColor: colors.card
                                }} source={{uri: `https://assets.nhle.com/mugs/nhl/20232024/${selectedTeam?.awayTeam.abbrev}/${awayGoalie?.id}.png`}}/>
                            </View>
                            <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{awayGoalie.name.split(" ")[0] !== "" ? awayGoalie.name.split(" ")[0] !== "" : "Unknown"}</Text>
                            <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{awayGoalie?.name.split(" ")[1]}</Text>
                            {/*<Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{awayGoalie.confirmed_by}</Text>*/}

                        </View>


                    </View>

                </View>
                <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16, textAlign: 'center', marginTop: 20, marginBottom: 10, color: colors.text}}>Goalie Stats</Text>

                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-around',
                        width: '100%',
                        alignItems: 'center',
                    }}>
                        <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{homeGoalieStats.SP.toFixed(3)}</Text>
                        <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>SV%</Text>
                        <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{awayGoalieStats.SP.toFixed(3)}</Text>

                    </View>

                </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-around',
                        width: '100%',
                        alignItems: 'center',
                    }}>
                        <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{homeGoalieStats.GSA.toFixed(2)}</Text>
                        <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>GSAA</Text>
                        <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{awayGoalieStats.GSA.toFixed(2)}</Text>

                    </View>

                </View>

            </View> }
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                    width: '100%',
                    alignItems: 'center',
                }}>
                    <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{homeGoalieStats.GSAx.toFixed(1)}</Text>
                    <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>GSAx</Text>
                    <Text style={{color: colors.text, fontFamily: 'Sora_600SemiBold', fontSize: 16}}>{awayGoalieStats.GSAx.toFixed(1)}</Text>
                </View>
    </View>
        </BottomSheet>

        <StatusBar style="auto"/>
    </View>
}
