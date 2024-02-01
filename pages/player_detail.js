import BottomSheet from "@gorhom/bottom-sheet";
import {useRoute, useTheme} from "@react-navigation/native";
import {useAssets} from "expo-asset";
import * as Haptics from "expo-haptics";
import {ArrowDown2, ArrowLeft} from "iconsax-react-native";
import {MotiView} from "moti";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import DataLineChart from "../components/Chart";
import {teamAbbreviationsWithLightImages} from "../helpers/assetsLoader";

export default function PlayerDetail({navigation}) {


    const bottomSheetRef2 = useRef()

    const {colors} = useTheme()

    const route = useRoute()

    const [assets, error] = useAssets(teamAbbreviationsWithLightImages);

    const [selectedPlayer, setSelectedPlayer] = useState(null)

    const snapPoints = useMemo(() => ['90%'], []);

    const getData = () => {


        let myHeaders = new Headers();
        myHeaders.append("accept", "application/json");

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };
        Haptics.impactAsync()

        fetch(`https://api-web.nhle.com/v1/player/${route.params?.data['data']}/landing`, requestOptions)
            .then(response => response.text())
            .then(result => {
                setSelectedPlayer(JSON.parse(result))
            });
    }

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
    const [selectedStat, setSelectedStat] = useState(!pos ? "goals" : "Save %")


    useEffect(() => {
        getData()
        setSelectedStat("goals")


    }, [])

    function accumulateArrayValues(inputArray) {
        let resultArray = [];
        let sum = 0;

        for (let i = 0; i < inputArray.length; i++) {
            sum += inputArray[i];
            resultArray.push(sum);
        }

        return resultArray;
    }

    const pos = parseInt(route.params?.data['pos']);

    return <SafeAreaView style={{width: '100%', position: 'relative'}}>
        <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            marginLeft: 10,
            marginBottom: 10
        }}>

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
            <Text style={{
                fontFamily: 'Sora_600SemiBold',
                fontSize: 24, color: colors.text
            }}>{selectedPlayer?.firstName.default} {selectedPlayer?.lastName.default}</Text>
        </View>
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

            <View>
                <ScrollView>
                    <Text style={{
                        color: colors.text,
                        marginTop: 10,
                        fontSize: 16,
                        fontFamily: 'Sora_600SemiBold'
                    }}>Career Stats
                    </Text>
                    <View style={{
                        flexDirection: "row",
                        width: '100%',
                        alignItems: 'center',
                        marginBottom: 10,
                        marginTop: 10,
                        gap: 10,
                        justifyContent: 'flex-start'
                    }}>
                        <View style={{
                            backgroundColor: colors.card,
                            width: (Dimensions.get('window').width / 3) - 13,
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
                            backgroundColor: colors.card,
                            width: (Dimensions.get('window').width / 3) - 13,
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
                            backgroundColor: colors.card,
                            width: (Dimensions.get('window').width / 3) - 13,
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
                            backgroundColor: colors.card,
                            width: (Dimensions.get('window').width / 3) - 13,
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
                            backgroundColor: colors.card,
                            width: (Dimensions.get('window').width / 3) - 13,
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
                            backgroundColor: colors.card,
                            width: (Dimensions.get('window').width / 3) - 13,
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
                            backgroundColor: colors.card,
                            marginBottom: 4
                        }}>
                            {!pos ?
                                <Text style={{
                                    color: colors.text,
                                    fontSize: 16,
                                    fontFamily: 'Sora_600SemiBold'
                                }}>Stat</Text> : <Text style={{
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
                                {!pos ?
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
                    <DataLineChart widthOffset={0} tooltipTopMarginTop={0} tooltipBottomMarginTop={35}
                                   title={"Total Over 5 Games"}
                                   precise={0} time
                                   lastVal={selectedPlayer ? accumulateArrayValues(selectedPlayer?.last5Games.map((r, i) => {
                                       return isNaN(parseFloat(r[`${selectedStat}`])) ? 0 : parseFloat(r[`${selectedStat}`])
                                   })).slice(-1) : 0} override
                                   data={selectedPlayer?.last5Games.map((r, i) => {
                                       return {
                                           value: isNaN(parseFloat(r[`${selectedStat}`])) ? 0 : parseFloat(r[`${selectedStat}`]),
                                           timestamp: `${r?.gameDate.slice(5).replaceAll("-", "/")}`
                                       }
                                   }).reverse()}
                                   colors={colors}
                                   selectedTeam={selectedPlayer?.currentTeamAbbrev}/>
                </ScrollView>

            </View>
        </MotiView>
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
                        setSelectedStat(!pos ? "goals" : "savePctg")

                    }, 150)
                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos ? "Goals" : "Save %"}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync().then(() => {
                    })

                    bottomSheetRef2.current.close()
                    setTimeout(() => {
                        setSelectedStat(!pos ? "assists" : "goalsAgainst")

                    }, 150)
                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos ? "Assists" : "Goals Against"}
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
                    }}>{!pos && "Points"}
                    </Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync().then(() => {
                    })

                    bottomSheetRef2.current.close()
                    setTimeout(() => {
                        setSelectedStat(!pos && "shots")

                    }, 150)

                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos && "Shots"}
                    </Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync().then(() => {
                    })
                    bottomSheetRef2.current.close()

                    setTimeout(() => {
                        setSelectedStat(!pos && "pim")

                    }, 150)


                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos && "PIM"}
                    </Text></TouchableOpacity>

                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync().then(() => {
                    })
                    setTimeout(() => {
                        setSelectedStat(!pos && "powerPlayGoals")

                    }, 150)
                    bottomSheetRef2.current.close()

                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos && "PPG"}
                    </Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync().then(() => {
                    })
                    bottomSheetRef2.current.close()
                    setTimeout(() => {
                        setSelectedStat(!pos && "shorthandedGoals")
                    }, 150)
                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos && "SHG"}
                    </Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync().then(() => {
                    })
                    bottomSheetRef2.current.close()
                    setTimeout(() => {
                        setSelectedStat(!pos && "plusMinus")
                    }, 150)

                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos && "+/-"}
                    </Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync().then(() => {
                    })
                    bottomSheetRef2.current.close()
                    setTimeout(() => {
                        setSelectedStat(!pos && "shifts")

                    }, 150)
                }}>
                    <Text style={{
                        color: colors.text,
                        fontSize: 20,
                        fontFamily: 'Sora_600SemiBold'
                    }}>{!pos && "Shifts"}
                    </Text></TouchableOpacity>

            </View>

        </BottomSheet>
    </SafeAreaView>


}

