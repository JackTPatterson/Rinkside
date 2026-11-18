import {nearMilestones, crossings, milestoneMessage} from './milestones.mjs';
import {goalieConfirmed, goaliesFor, pregameMessage, PREGAME_LEAD} from './pregame.mjs';
import {playoffChanges, standingsMessage} from './standings.mjs';
import {sendOnce, wantsTopic} from './push.mjs';

const EVERY = {standings: 10 * 60000, milestones: 10 * 60000};
const LIVE = new Set(['LIVE', 'CRIT']);
const FINAL = new Set(['FINAL', 'OFF']);
const STALE_AFTER = 6 * 3600000; // stop waiting for a game's stats to land after this

/**
 * One pass of the team alerts: playoff position, career milestones and the pregame preview, for the teams that
 * someone follows. Each job is isolated, so one failing data source never blocks the others.
 */
export async function runTeamAlerts(store, {nhl, send, now = Date.now(), log = () => {}}) {
    const subscribers = topic => store.list('subscriptions').filter(s => s.enabled && s.fanTeam && wantsTopic(s, topic));
    const notify = (topic, team, build) => Promise.all(subscribers(topic).filter(s => s.fanTeam === team).map(async s => {
        const {key, ...message} = build(s);
        await sendOnce(store, s, key, message, {send, now});
    }));
    const cursor = store.get('cursors', 'team-alerts') ?? {};
    const due = name => now - (cursor[name] ?? 0) >= EVERY[name];
    const job = async (name, run) => { try { await run(); } catch (error) { log(`Team alerts (${name}): ${error.message}`); } };

    if (subscribers('standings').length && due('standings')) {
        cursor.standings = now;
        await job('standings', async () => {
            const games = await nhl.schedule();
            if (games.some(g => LIVE.has(g.state))) return; // standings move mid-game; wait for the dust to settle
            const rows = await nhl.standings();
            const {state, events} = playoffChanges(store.get('state', 'playoff-spots'), rows);
            store.put('state', 'playoff-spots', {id: 'playoff-spots', ...state});
            for (const {team, kind} of events) {
                const message = standingsMessage(kind, rows, team);
                if (message) await notify('standings', team, () => ({key: `standings:${team}:${kind}:${now}`, ...message, data: {type: 'standings', team}, channelId: 'standings'}));
            }
        });
    }

    const milestoneTeams = [...new Set(subscribers('milestones').map(s => s.fanTeam))];
    if (milestoneTeams.length && due('milestones')) {
        cursor.milestones = now;
        await job('milestones', async () => {
            const games = await nhl.schedule();
            for (const team of milestoneTeams) {
                const last = games.filter(g => FINAL.has(g.state) && (g.home === team || g.away === team)).sort((x, y) => y.startsAt - x.startsAt)[0];
                const state = store.get('state', `milestones:${team}`);
                if (!last || state?.game === last.id) continue;
                const careers = await nhl.teamCareers(team, {force: true});
                const snapshots = store.get('state', `careers:${team}`)?.players ?? null;
                // The league's totals can lag the final horn; wait until someone's games played moves (or give up).
                const updated = !snapshots || careers.some(c => snapshots[c.id] && c.gp > snapshots[c.id].gp);
                if (!updated && now - last.startsAt < STALE_AFTER) continue;
                if (snapshots) {
                    for (const c of careers) {
                        const before = snapshots[c.id];
                        const found = before ? crossings(before, c) : []; // a player seen for the first time is never a milestone
                        if (found.length) {
                            const message = milestoneMessage(c, found, team);
                            await notify('milestones', team, () => ({key: `milestone:${c.id}:${found.map(f => `${f.stat}${f.value}`).join('-')}`, ...message,
                                data: {type: 'milestone', playerId: c.id, team}, channelId: 'milestones'}));
                        }
                    }
                }
                store.put('state', `careers:${team}`, {id: `careers:${team}`, players: Object.fromEntries(careers.map(c => [c.id, c]))});
                store.put('state', `milestones:${team}`, {id: `milestones:${team}`, game: last.id});
            }
        });
    }

    const pregameTeams = [...new Set(subscribers('pregame').map(s => s.fanTeam))];
    if (pregameTeams.length) {
        await job('pregame', async () => {
            const games = await nhl.schedule();
            for (const team of pregameTeams) {
                const game = games.filter(g => !FINAL.has(g.state) && !LIVE.has(g.state) && (g.home === team || g.away === team) && g.startsAt > now)
                    .sort((x, y) => x.startsAt - y.startsAt)[0];
                if (!game || game.startsAt - now > PREGAME_LEAD) continue;
                const [rows, day, careers] = await Promise.all([
                    nhl.standings(), nhl.goalies(game.date).catch(() => ({})), nhl.teamCareers(team).catch(() => [])]);
                const goalies = goaliesFor(day, game, team);
                await notify('pregame', team, s => ({
                    key: `pregame:${game.id}`, ...pregameMessage({game, team, rows, goalies, near: nearMilestones(careers), tz: s.tz ?? 'America/New_York'}),
                    data: {type: 'pregame', gameId: game.id, team}, channelId: 'pregame', ttl: 3600}));
                // If the starter wasn't confirmed in the preview, say so when it is.
                const id = `pregame:${game.id}:${team}`;
                const state = store.get('state', id) ?? {confirmed: goalieConfirmed(goalies?.mine)};
                if (!state.confirmed && goalieConfirmed(goalies?.mine)) {
                    state.confirmed = true;
                    await notify('pregame', team, () => ({key: `goalie:${game.id}`, title: `${team} confirm their goalie`,
                        body: `${goalies.mine.name} starts against ${team === game.home ? game.away : game.home}.`, data: {type: 'pregame', gameId: game.id, team}, channelId: 'pregame', ttl: 3600}));
                }
                store.put('state', id, {id, ...state});
            }
        });
    }
    store.put('cursors', 'team-alerts', {id: 'team-alerts', ...cursor});
}
