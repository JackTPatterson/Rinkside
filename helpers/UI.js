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
