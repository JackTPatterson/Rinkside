// Career milestones, detected by comparing a player's career totals before and after a game.
// stat keys: gp (games), g, a, p (goals, assists, points), w (goalie wins), so (shutouts).

export const THRESHOLDS = {
    skater: {
        p: [1, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000],
        g: [1, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800],
        a: [100, 250, 500, 750, 1000, 1250, 1500],
        gp: [1, 100, 250, 500, 750, 1000, 1250, 1500],
    },
    goalie: {w: [1, 50, 100, 150, 200, 250, 300, 400, 500], so: [1, 10, 25, 50, 75, 100], gp: [1, 100, 250, 500, 750, 1000]},
};
const ORDER = ['p', 'g', 'w', 'a', 'so', 'gp']; // which to lead with when one game crosses several
const LABEL = {p: 'career points', g: 'career goals', a: 'career assists', gp: 'career games', w: 'career wins', so: 'career shutouts'};
const FIRST = {p: 'first NHL point', g: 'first NHL goal', gp: 'NHL debut', w: 'first NHL win', so: 'first NHL shutout'};
const UNIT = {p: 'point', g: 'goal', a: 'assist', w: 'win', so: 'shutout'};
const fmt = n => n.toLocaleString('en-US');
const surname = name => String(name).split(' ').slice(1).join(' ') || name;

/** Milestones crossed between two snapshots of the same player: [{stat, value, phrase}], at most two, most notable first. */
export function crossings(before, now) {
    const table = THRESHOLDS[now.goalie ? 'goalie' : 'skater'];
    const out = [];
    for (const stat of ORDER) {
        const crossed = (table[stat] ?? []).filter(t => before[stat] < t && now[stat] >= t);
        if (!crossed.length) continue;
        const value = Math.max(...crossed);
        out.push({stat, value, phrase: value === 1 ? FIRST[stat] : `${fmt(value)} ${LABEL[stat]}`});
    }
    return out.slice(0, 2);
}

export function milestoneMessage(player, found, team) {
    const [first, second] = found;
    const title = first.value === 1
        ? ({gp: `${player.name} makes an NHL debut`, g: `${player.name} scores a first NHL goal`, p: `${player.name} records a first NHL point`,
            w: `${player.name} earns a first NHL win`, so: `${player.name} earns a first NHL shutout`})[first.stat]
        : `${player.name} reaches ${first.phrase}`;
    return {title, body: `${player.name} (${team})${second ? ` also reached ${second.phrase}` : ' hit the mark in the latest game'}.`};
}

/** Players a point, goal, assist, win or shutout or two away from a milestone: [{name, need, stat, value, text}], biggest first. */
export function nearMilestones(careers, {within = 2} = {}) {
    const out = [];
    for (const player of careers) {
        const table = THRESHOLDS[player.goalie ? 'goalie' : 'skater'];
        for (const stat of ORDER.filter(s => s !== 'gp')) {
            for (const value of (table[stat] ?? []).filter(t => t > 1)) {
                const need = value - player[stat];
                if (need >= 1 && need <= within) out.push({name: player.name, need, stat, value, text: `${surname(player.name)} is ${need} ${UNIT[stat]}${need === 1 ? '' : 's'} away from ${fmt(value)}${stat === 'so' ? ' career shutouts' : ` career ${stat === 'w' ? 'wins' : UNIT[stat] + 's'}`}.`});
            }
        }
    }
    return out.sort((x, y) => y.value - x.value || x.need - y.need);
}
