import teamData from "../teams";

export function getTeamColor(teamCode, colors) {

    let team = teamData.filter((item) => {
        return (item.abbreviation === teamCode);
    })

    if (team.length) {
        if ((team[0].primary_color === "#111111" && colors.text === 'rgb(229, 229, 231)')) {
            return 'white'
        }
        if ((team[0].primary_color === "#000000" && colors.text === 'rgb(229, 229, 231)')) {
            return '#FCB514'
        }
        return team[0]?.primary_color;

    } else {
        return colors.text
    }
}

