import React from "react";
import {View} from "react-native";
import teamData from "../teams";

export function getTeamColor(teamCode, colors) {

    let team = teamData.filter((item) => {
        return (item.abbreviation === teamCode);
    })

    const isDark = colors.text === 'rgb(229, 229, 231)'

    if (team.length) {
        if (isDark) {
            return team[0]?.secondary_color ?? team[0].primary_color;
        }

    } else {
        return colors.text
    }
}

export const Divider = (props) => {
    return <View
        style={[{
            height: 2,
            marginVertical: 10,
            backgroundColor: props.colors.text,
            opacity: .2,
            width: '100%'
        }, props.style]}/>
}
