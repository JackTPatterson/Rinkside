// Prints what the team alerts would say right now for a team, from live NHL data. Sends nothing.
//   node preview-alerts.mjs NYI [IANA time zone]
import {createNhl} from './nhl.mjs';
import {nearMilestones} from './milestones.mjs';
import {goaliesFor, pregameMessage} from './pregame.mjs';
import {playoffLine, standingsMessage} from './standings.mjs';

const team = (process.argv[2] ?? 'NYI').toUpperCase();
const tz = process.argv[3] ?? 'America/New_York';
const nhl = createNhl();
const [rows, games, careers] = await Promise.all([nhl.standings(), nhl.schedule(), nhl.teamCareers(team)]);
const game = games.filter(g => g.startsAt > Date.now() && (g.home === team || g.away === team)).sort((a, b) => a.startsAt - b.startsAt)[0];
const show = (label, m) => console.log(`\n[${label}]\n${m.title}\n${m.body}`);
if (game) show('pregame', pregameMessage({game, team, rows, goalies: goaliesFor(await nhl.goalies(game.date).catch(() => ({})), game, team), near: nearMilestones(careers), tz}));
else console.log('No upcoming game this week.');
console.log('\nplayoff line vs a rival:', playoffLine(rows, team, game ? (game.home === team ? game.away : game.home) : team));
show('standings: out', standingsMessage('out', rows, team));
show('standings: in', standingsMessage('in', rows, team));
console.log('\nclosest milestones:', nearMilestones(careers).slice(0, 4).map(n => n.text));
