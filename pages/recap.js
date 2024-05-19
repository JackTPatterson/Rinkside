import {useTheme} from "@react-navigation/native";
import {MotiView} from "moti";
import Papa from "papaparse";
import {useEffect, useState} from "react";
import {Dimensions, Text, View} from "react-native";
import {getTeamColor} from "../helpers/UI";

export default function Recap({route, navigation}) {

    const [pregamePCT, setPregamePCT] = useState({
        home: 0,
        away: 0

    });

    useEffect(() => {
        const commonConfig = {delimiter: ","};

        Papa.parse(
            `https://moneypuck.com/moneypuck/predictions/${route.params.id}.csv`,
            {
                ...commonConfig,
                header: true,
                download: true,
                complete: (result) => {

                    console.log(parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore));

                    setPregamePCT({
                        home: parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore),
                        away: 1 - parseFloat((result.data.slice(-2)[0]).preGameHomeTeamWinOverallScore)
                    });
                }
            }
        );
    }, [])

    const {colors} = useTheme();


    return <View>
        <View style={{
            backgroundColor: getTeamColor(route.params?.aTeam, colors),
            height: "100%"
        }}>
            <MotiView

                from={{
                    height: (Dimensions.get('window').height) * .5
                }}
                animate={{
                    height: (Dimensions.get('window').height - 100) * pregamePCT.home ?? 0
                }}
                transition={{
                    type: 'timing',
                    duration: 1000,
                    delay: 500
                }}
                style={{
                    backgroundColor: getTeamColor(route.params?.hTeam, colors),
                    width: "100%"

                }}>
                <MotiView

                    from={{
                        marginTop: (Dimensions.get('window').height) * .5 - ((((Dimensions.get('window').height) * .5) / 2) - 110)
                    }}
                    animate={{
                        marginTop: (Dimensions.get('window').height - 100) * pregamePCT.home - ((((Dimensions.get('window').height - 100) * pregamePCT.home) / 2) - 138) ?? 0
                    }}
                    transition={{
                        type: 'timing',
                        duration: 1000,
                        delay: 500
                    }}
                    style={{
                        marginLeft: 10
                    }}>

                    <Text style={{
                        color: 'white',
                        textAlign: 'left',
                        fontSize: 82
                    }}>
                        {parseInt(pregamePCT.home * 100) + "%"}
                    </Text>
                </MotiView>

            </MotiView>

            <MotiView

                from={{
                    marginTop: (Dimensions.get('window').height) * .5 - ((((Dimensions.get('window').height) * .5) / 2) + 210)
                }}
                animate={{
                    marginTop: (Dimensions.get('window').height - 100) * pregamePCT.away - ((((Dimensions.get('window').height - 100) * pregamePCT.away) / 2) + 136) ?? 0
                }}
                transition={{
                    type: 'timing',
                    duration: 1000,
                    delay: 500
                }}
                style={{
                    marginLeft: 10
                }}>
                <Text style={{
                    color: 'white',
                    textAlign: 'left',
                    fontSize: 82
                }}>
                    {parseInt(pregamePCT.away * 100) + "%"}
                </Text>
            </MotiView>


        </View>

    </View>


}
