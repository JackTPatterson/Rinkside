import {Skeleton} from "moti/skeleton";
import React from "react";
import {Dimensions, View} from "react-native";

export const PlayerSkeleton = (props) => {
    return <View style={{
        gap: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: Dimensions.get('window').width - 20
    }}>
        <View>
            <View style={{flexDirection: 'column', gap: 4, marginBottom: 10, alignItems: 'center'}}>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={80} height={20}
                          radius={55}/>
            </View>
            <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={100} height={100}
                      radius={55}/>
            <View style={{flexDirection: 'column', gap: 4, marginTop: 10, alignItems: 'center'}}>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={100} height={20}
                          radius={55}/>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={75} height={20}
                          radius={55}/>

            </View>
        </View>
        <View>
            <View style={{flexDirection: 'column', gap: 4, marginBottom: 10, alignItems: 'center'}}>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={80} height={20}
                          radius={55}/>
            </View>
            <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={100} height={100}
                      radius={55}/>
            <View style={{flexDirection: 'column', gap: 4, marginTop: 10, alignItems: 'center'}}>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={100} height={20}
                          radius={55}/>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={75} height={20}
                          radius={55}/>

            </View>
        </View>
        <View>
            <View style={{flexDirection: 'column', gap: 4, marginBottom: 10, alignItems: 'center'}}>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={80} height={20}
                          radius={55}/>
            </View>
            <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={100} height={100}
                      radius={55}/>
            <View style={{flexDirection: 'column', gap: 4, marginTop: 10, alignItems: 'center'}}>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={100} height={20}
                          radius={55}/>
                <Skeleton colorMode={props.colors.text === 'white' ? 'light' : 'dark'} width={75} height={20}
                          radius={55}/>

            </View>
        </View>
    </View>
}


