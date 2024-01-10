import {
    Sora_100Thin,
    Sora_200ExtraLight,
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold
} from "@expo-google-fonts/sora";
import {useRoute} from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import {ArrowDown2, ArrowLeft, ArrowUp2} from "iconsax-react-native";
import Papa from "papaparse";
import React, {useEffect, useState} from "react";
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
import {SvgUri} from "react-native-svg";
import teamData from '../teams';
import * as Progress from 'react-native-progress';

export default function GamesDetail({navigation}) {

    const styles = StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingHorizontal: 10,
            height: '100%',
            backgroundColor: 'white'
        },
        inactiveButton: {
            backgroundColor: '#f7f7f7', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 100
        },

        inactiveText: {
            color: 'black',
            fontFamily: 'Sora_500Medium', textAlign: 'center'
        },

        activeButton: {
            backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 100
        },

        activeText: {
            color: 'white',
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

    function dateToUnixTimestamp(dateString) {
        const date = new Date(dateString);
        const unixTimestamp = Math.floor(date.getTime() / 1000);
        return unixTimestamp;
    }


    const AwayTeamName = teamData.filter((item) => {
        return (item.abbreviation === route.params?.data['data']['awayTeam']['abbrev']);
    })

    const HomeTeamName = teamData.filter((item) => {
        return (item.abbreviation === route.params?.data['data']['homeTeam']['abbrev']);
    })

    const [stat, setStat] = useState({home: 0, away: 0});

    const [sim, setSim] = useState(null);

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

    useEffect(()=>{

        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch(`https://api-web.nhle.com/v1/score/${getDate(0)}`, requestOptions)
            .then(response => response.text())
            .then(result => {
                const d = JSON.parse(result)['games'].filter((r)=>{
                    return r.id === route.params?.data['data']['id']
                })
                setMatchData({home: d[0]['homeTeam']['score'], away: d[0]['awayTeam']['score']})
            })


    }, [])


    const getHomeWinBoost = () => {
        sim?.sort(sort_by(!tab ? 'madePlayoffs' : 'draftLottery', true, parseFloat)).map((rank, i) => {
        })}

    const [matchData, setMatchData] = useState(null);

    const getDate = (offset) => {
        const today = new Date();
        today.setDate(today.getDate() + offset);

        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Adding 1 because months are zero-based
        const day = today.getDate().toString().padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    const [chartData, setChartData] = useState([]);

    const [fullData, setFullData] = useState(null);

    const [playByPlay, setPlayByPlay] = useState(null);


    if(matchData){
        if(!stat.home){
            if(!matchData.p){
                Papa.parse(
                    `https://moneypuck.com/moneypuck/gameData/${route.params?.data['data']['season']}/${route.params?.data['data']['id']}.csv`,
                    {
                        ...commonConfig,
                        header: true,
                        download: true,
                        complete: (result) => {
                            const chartData = result.data.map((d, i)=>{
                                return parseFloat(d.homeWinProbability)*100
                            })

                            const playData = result.data.map((d, i)=>{
                                return d.eventDescriptionRaw
                            })
                            setPlayByPlay(playData.slice(6, 7))
                            setChartData(chartData)
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


    if(!sim){
        Papa.parse(
            "https://moneypuck.com/moneypuck/simulations/simulations_recent.csv",
            {
                ...commonConfig,
                header: true,
                download: true,
                complete: (result) => {
                    setSim(result.data);
                    getHomeWinBoost()

                }
            }
        );
    }



    function getPCTColor(teamCode) {
        let team = teamData.filter((item) => {
            return (item.abbreviation === teamCode);
        })
        return team[0]?.primary_color;
    }

    const [tab, setTab] = useState(0);

    return <View style={styles.container}>
        <SafeAreaView style={{width: '100%'}}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Pressable onPress={() => {
                    navigation.goBack()
                    Haptics.selectionAsync()
                }} style={{backgroundColor: '#f7f7f7', marginRight: 15, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 100}}>
                    <ArrowLeft color={"#000"}/>
                </Pressable>
                <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 24}}>{route.params?.data.data.awayTeam.abbrev} @ {route.params?.data.data.homeTeam.abbrev}</Text>
            </View>

            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 20, justifyContent: 'center'}}>
                <View style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>
                    <View style={{backgroundColor: '#f7f7f7', borderRadius: 100}}>
                        <Text style={{
                            textAlign: "left",
                            paddingHorizontal: 15,
                            paddingVertical: 4,
                            fontFamily: 'Sora_500Medium',
                            fontSize: 20
                        }}>{(parseFloat(stat.home)*100).toFixed(0)}%</Text>
                    </View>
                    <SvgUri width={70} height={70} style={{
                        flexDirection: 'column',
                        justifyContent: 'center',
                        marginTop: 10,
                        marginLeft: 5
                    }}
                            uri={route.params?.data['data']['homeTeam']['logo']}/>
                    <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 20, maxWidth: 120, textAlign: 'center'}}>{HomeTeamName[0]['name']}</Text>
                </View>
                {matchData?.home !== undefined ?
                <View style={{flexDirection: 'row'}}>
                    <Text style={{
                        textAlign: "left",
                        letterSpacing: 10,
                        paddingHorizontal: 15,
                        paddingVertical: 4,
                        fontFamily: 'Sora_700Bold',
                        fontSize: 36
                    }}>{matchData?.home}•{matchData?.away}</Text>
                </View> : <View style={{
                        backgroundColor: '#f7f7f7',
                        paddingVertical: 5,
                        paddingHorizontal: 20,
                        borderRadius: 15,
                        flexDirection: 'row',
                        justifyContent: 'center'
                    }}>
                        <Text style={{
                            color: 'black',
                            fontFamily: 'Sora_500Medium'
                        }}>{formatAMPM(new Date(route.params.data.data.startTimeUTC))}</Text>
                    </View>
                }
                <View style={{flexDirection: 'column', alignItems: 'center', width: '33%'}}>
                    <View style={{backgroundColor: '#f7f7f7', borderRadius: 100}}>
                        <Text style={{
                            textAlign: "left",
                            paddingHorizontal: 15,
                            paddingVertical: 4,
                            fontFamily: 'Sora_500Medium',
                            fontSize: 20
                        }}>{(parseFloat(stat.away)*100).toFixed(0)}%</Text>
                    </View>
                    <SvgUri width={70} height={70} style={{
                        flexDirection: 'column',
                        justifyContent: 'center',
                        marginTop: 10,
                        marginLeft: 5
                    }}
                            uri={route.params?.data['data']['awayTeam']['logo']}/>
                    <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 20, maxWidth: 120, textAlign: 'center'}}>{AwayTeamName[0]['name']}</Text>
                </View>
            </View>
            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)} unfilledColor={getPCTColor(route.params?.data.data.awayTeam.abbrev)} borderRadius={100} borderWidth={0} style={{marginTop: 20}} progress={stat.home} height={12} width={Dimensions.get('window').width - 20} />
            <View style={{marginTop: 20}}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 10,
                    marginBottom: 20
                }}>
                    <Pressable style={tab === 0 ? styles.activeButton : styles.inactiveButton}
                               onPress={() => {
                                   setTab(0)
                                   Haptics.selectionAsync()
                               }}>
                        <Text style={tab === 0 ? styles.activeText : styles.inactiveText}>Goals</Text>
                    </Pressable>
                    <Pressable style={tab === 2 ? styles.activeButton : styles.inactiveButton} onPress={() => {
                        setTab(2)
                        Haptics.selectionAsync()
                    }}>
                        <Text style={tab === 2 ? styles.activeText : styles.inactiveText}>Stats</Text>
                    </Pressable>
                    <Pressable style={tab === 1 ? styles.activeButton : styles.inactiveButton} onPress={() => {
                        setTab(1)
                        Haptics.selectionAsync()
                    }}>
                        <Text style={tab === 1 ? styles.activeText : styles.inactiveText}>Play By Play</Text>
                    </Pressable>

                </View>
            </View>
            <View>
                {
                    !tab ? <ScrollView style={{height: '100%'}} horizontal showsVerticalScrollIndicator={false}>
                        {route.params?.data['data']['goals'].map((goal, i)=>{
                            return <TouchableOpacity onPress={() => {
                            }} style={{
                                marginBottom: 4,
                                width: 100,
                                height: 80,
                                borderRadius: 100,
                                marginRight: 20,
                            }}>
                                <Text style={{fontFamily: 'Sora_700Bold', fontSize: 16,textAlign: 'center', width: 100}}>{goal.teamAbbrev}</Text>
                                <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 14,  marginTop: 4,  textAlign: 'center', opacity: .5}}>{goal.homeScore} • {goal.awayScore}</Text>
                                <View style={{flexDirection: 'row', justifyContent: 'center'}}>
                                    <Image style={{
                                        borderRadius: 100, borderWidth: 3, height: 80, width: 80,  marginTop: 10,  borderColor: `${getPCTColor(goal.teamAbbrev)}`, backgroundColor: '#f7f7f7'
                                    }} source={{uri: goal.mugshot}}/>
                                </View>

                                <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 16,  marginTop: 10,  textAlign: 'center', width: 100}}>{goal.name.default}</Text>
                                <Text style={{fontFamily: 'Sora_600SemiBold', fontSize: 14,  marginTop: 4,  textAlign: 'center', opacity: .5}}>{goal.timeInPeriod} • {goal.strength}</Text>

                            </TouchableOpacity>
                        })}
                    </ScrollView> : tab === 2 ? <View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{Math.round((parseFloat(fullData.homeFaceoffWinPercentage))*100)}%</Text>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>Faceoff Win Percentage</Text>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{Math.round((parseFloat(1-fullData.homeFaceoffWinPercentage))*100)}%</Text>
                        </View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)} unfilledColor={'#f7f7f7'} borderRadius={100} borderWidth={0} style={{marginTop: 20, transform: [{rotate: '180deg'}]}} progress={(parseFloat(fullData.homeFaceoffWinPercentage))} height={6} width={(Dimensions.get('window').width - 20)/2 - 2.5} />
                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)} unfilledColor={'#f7f7f7'} borderRadius={100} borderWidth={0} style={{marginTop: 20}} progress={1-(parseFloat(fullData.homeFaceoffWinPercentage))} height={6} width={(Dimensions.get('window').width - 20)/2 - 2.5} />
                        </View>

                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{parseFloat(fullData.homeTeamExpectedGoals).toFixed(2)}</Text>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>Expected Goals</Text>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{parseFloat(fullData.awayTeamExpectedGoals).toFixed(2)}</Text>
                        </View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)} unfilledColor={'#f7f7f7'} borderRadius={100} borderWidth={0} style={{marginTop: 20, transform: [{rotate: '180deg'}]}} progress={matchData?.home / parseFloat(fullData.homeTeamExpectedGoals).toFixed(2)} height={6} width={(Dimensions.get('window').width - 20)/2 - 2.5} />
                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)} unfilledColor={'#f7f7f7'} borderRadius={100} borderWidth={0} style={{marginTop: 20}} progress={matchData?.away / parseFloat(fullData.awayTeamExpectedGoals).toFixed(2)} height={6} width={(Dimensions.get('window').width - 20)/2 - 2.5} />
                        </View>

                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{Math.round((parseFloat(fullData.homePercentOfEventsInOffensiveZone))*100)}%</Text>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>Offensive Zone Time</Text>
                            <Text style={{fontFamily: 'Sora_500Medium', fontSize: 16}}>{Math.round((parseFloat(1-fullData.homePercentOfEventsInOffensiveZone))*100)}%</Text>
                        </View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                            <Progress.Bar color={getPCTColor(route.params?.data.data.homeTeam.abbrev)} unfilledColor={'#f7f7f7'} borderRadius={100} borderWidth={0} style={{marginTop: 20, transform: [{rotate: '180deg'}]}} progress={((parseFloat(fullData.homePercentOfEventsInOffensiveZone)))} height={6} width={(Dimensions.get('window').width - 20)/2 - 2.5} />
                            <Progress.Bar color={getPCTColor(route.params?.data.data.awayTeam.abbrev)} unfilledColor={'#f7f7f7'} borderRadius={100} borderWidth={0} style={{marginTop: 20}} progress={(parseFloat(1-fullData.homePercentOfEventsInOffensiveZone))} height={6} width={(Dimensions.get('window').width - 20)/2 - 2.5} />
                        </View>



                        <Text style={{fontFamily: 'Sora_500Medium', fontSize: 24, marginTop: 20}}>Chance {route.params?.data.data.homeTeam.abbrev} Wins</Text>
                        <LineChart
                        data={{
                            datasets: [
                                {
                                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                                    data: chartData.map((r, i)=>{
                                        return isNaN(r) ? 0 :  r
                                    })
                                }
                            ]
                        }}
                        width={Dimensions.get("window").width} // from react-native
                        height={220}
                        yAxisSuffix="%"
                        yAxisInterval={1} // optional, defaults to 1
                        withHorizontalLines={false}
                        withVerticalLines={false}
                        withDots={false}
                        withShadow
                        chartConfig={{

                            backgroundColor: `rgba(255, 255, 255, 0)`,
                            backgroundGradientFrom: "#fff",
                            backgroundGradientFromOpacity: 0,
                            backgroundGradientTo: "#fff",
                            backgroundGradientToOpacity: 0,
                            decimalPlaces: 0, // optional, defaults to 2dp
                            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            style: {
                                borderRadius: 16,
                            },
                            strokeWidth: 2, // optional, default 3
                            barPercentage: 1,

                        }}
                        bezier
                        style={{
                            marginVertical: 8,
                            marginLeft: -20,
                        }}
                    /></View> :

                        <TouchableOpacity onPress={() => {
                        Haptics.selectionAsync().then(r => {
                        });

                    }} style={{
                            backgroundColor: '#f7f7f7',
                            marginBottom: 4,
                            paddingVertical: 15,
                            paddingHorizontal: 10,
                            borderRadius: 15,
                    }}>

                        <Text>{playByPlay}</Text>

                    </TouchableOpacity>
                }


            </View>


        </SafeAreaView>
    </View>


}
