import * as Haptics from "expo-haptics";
import React from "react";
import {Dimensions, Text, View} from "react-native";
import {LineChart as LC} from "react-native-wagmi-charts";
import {getTeamColor} from "../helpers/UI";

export default function DataLineChart(props) {


    return props.data && <View style={props.style}>
        <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end'
        }}>
            {props.title &&
                <Text style={!props.titleStyle ? {
                    fontFamily: 'Sora_500Medium',
                    fontSize: 16,
                    marginBottom: 10,
                    color: props.colors.text,
                    marginTop: 20
                } : props.titleStyle}>{props.title}</Text>}
            <Text style={{
                fontFamily: 'Sora_600SemiBold',
                fontSize: 24,
                marginBottom: 10,
                color: props.colors.text,
                marginTop: 20
            }}>{!props.lastVal ? `${parseFloat(props.data.slice(-1)).toFixed(props.precise)}${props.isPCT ? "%" : ""}` : `${parseFloat(props.lastVal).toFixed(props.precise)}${props.isPCT ? "%" : ""}`}</Text>
        </View>
        <LC.Provider data={!props.override ?
            props.data.map((r, i) => {
                return {value: isNaN(r) ? props.data[i - 1] : r}
            }) : props.data
        }>
            <LC width={props.widthOffset ? (Dimensions.get('window').width - (props.widthOffset + 20)) : Dimensions.get('window').width - 20}
                style={{marginLeft: 'auto', marginRight: 'auto'}}
                height={200}>
                <LC.Path color={`${getTeamColor(`${props.selectedTeam}`, props.colors)}`}>
                    <LC.Gradient gradientOffsets={[0, 50, 100]} gradientOpacity={[.5, .25, 0]}
                                 color={`${getTeamColor(`${props.selectedTeam}`, props.colors)}`}
                                 opacity={props.gradient ? props.gradient : 1}/>
                    <LC.HorizontalLine at={{index: 0}}/>
                    {props.dots && props.dots.map((dot, i) => {
                        return dot.goal > 0 &&
                            <LC.Dot hasPulse
                                    color={`${getTeamColor(`${dot.team.split(" ")[0]}`, props.colors)}`}
                                    at={dot.goal}/>
                    })}
                </LC.Path>


                <LC.CursorCrosshair onActivated={() => {
                    Haptics.selectionAsync().then(() => {
                    })
                }} onEnded={() => {
                    Haptics.selectionAsync().then(() => {
                    })
                }}
                                    color={`${getTeamColor(`${props.selectedTeam}`, props.colors)}`}>
                    <LC.Tooltip position={"bottom"} style={{
                        marginTop: props.tooltipTopMarginTop ?? 30,
                        marginBottom: props.tooltipTopMarginBottom
                    }}>
                        <LC.PriceText precision={props.precise ?? 0} format={({value}) => {
                            'worklet';
                            return `${value}${props.isPCT ? "%" : ""}`;
                        }} style={{
                            fontFamily: 'Sora_600SemiBold',
                            fontSize: 24,
                            color: props.colors.text
                        }}/>


                    </LC.Tooltip>

                    {props.time &&

                        <LC.Tooltip position={"bottom"} style={{
                            marginTop: props.tooltipBottomMarginTop ?? 70,
                            marginBottom: props.tooltipBottomMarginBottom
                        }}>
                            <LC.DatetimeText style={{
                                paddingBottom: 20,
                                fontFamily: 'Sora_600SemiBold',
                                fontSize: 16,
                                color: props.colors.text
                            }} precision={props.precise ?? 0} format={(timestamp) => {
                                'worklet';
                                return `${(timestamp.value)}`;
                            }}/>
                        </LC.Tooltip>}

                </LC.CursorCrosshair>

            </LC>
        </LC.Provider>
    </View>
}

