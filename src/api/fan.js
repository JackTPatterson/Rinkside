import {activeStreaks, milestoneWatch} from '../analytics/milestones';
import {nhl} from './nhl';

const none = () => ({data: []});

/**
 * Milestone watch and active streaks for one team's current roster:
 * {milestones, streaks}, each item carrying {team, headshot, number} for display.
 */
export async function fetchTeamMilestones(abbrev, {force} = {}) {
    const roster = await nhl.roster(abbrev, {force});
    const skaters = [...(roster?.forwards ?? []), ...(roster?.defensemen ?? [])];
    const goalies = roster?.goalies ?? [];
    const [cs, cg, sg, gg] = await Promise.all([
        skaters.length ? nhl.careerSkaters(skaters.map((p) => p.id), {force}).catch(none) : none(),
        goalies.length ? nhl.careerGoalies(goalies.map((p) => p.id), {force}).catch(none) : none(),
        nhl.teamGames('skater', abbrev, undefined, {force}).catch(none),
        nhl.teamGames('goalie', abbrev, undefined, {force}).catch(none),
    ]);
    const onRoster = new Map([...skaters, ...goalies].map((p) => [p.id, p]));
    const input = {
        careerSkaters: cs?.data ?? [],
        careerGoalies: cg?.data ?? [],
        // Only current players: someone traded away keeps rows for this team.
        skaterGames: (sg?.data ?? []).filter((r) => onRoster.has(r.playerId)),
        goalieGames: (gg?.data ?? []).filter((r) => onRoster.has(r.playerId)),
    };
    const decorate = (item) => ({...item, team: abbrev, headshot: onRoster.get(item.playerId)?.headshot ?? null});
    return {
        milestones: milestoneWatch(input).map(decorate),
        streaks: activeStreaks(input).map(decorate),
    };
}
