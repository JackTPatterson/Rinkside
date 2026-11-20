import assert from 'node:assert/strict';
import test from 'node:test';
import {crossings, milestoneMessage, nearMilestones} from './milestones.mjs';
import {goaliesFor, pregameMessage} from './pregame.mjs';
import {openStore} from './store.mjs';
import {parseGoalies} from './nhl.mjs';
import {sendOnce, wantsTopic} from './push.mjs';
import {describeSpot, playoffChanges, playoffLine, spotOf, standingsMessage} from './standings.mjs';
import {runTeamAlerts} from './teamAlerts.mjs';

// East: ten teams listed in conference order; the wild cards are WC1/WC2 and the first team out is WC3.
const row = (abbrev, o) => ({teamAbbrev: {default: abbrev}, teamCommonName: {default: abbrev.toLowerCase()}, conferenceAbbrev: 'E', conferenceName: 'Eastern',
    divisionSequence: 4, wildcardSequence: 0, points: 20, gamesPlayed: 20, l10Wins: 6, l10Losses: 3, l10OtLosses: 1, conferenceSequence: 9, ...o});
const table = (over = {}) => [
    row('AAA', {divisionSequence: 1, conferenceSequence: 1, points: 34}),
    row('BBB', {divisionSequence: 2, conferenceSequence: 2, points: 30}),
    row('CCC', {divisionSequence: 3, conferenceSequence: 3, points: 29}),
    row('DDD', {divisionSequence: 4, wildcardSequence: 1, conferenceSequence: 4, points: 27}),
    row('EEE', {divisionSequence: 5, wildcardSequence: 2, conferenceSequence: 5, points: 25}),
    row('NYI', {divisionSequence: 6, wildcardSequence: 3, conferenceSequence: 6, points: 24}),
    row('FFF', {divisionSequence: 7, wildcardSequence: 4, conferenceSequence: 7, points: 20}),
].map(r => ({...r, ...(over[r.teamAbbrev.default] ?? {})}));

test('spotOf: top three in a division or a wild card is in; everyone else is out', () => {
    assert.equal(spotOf(table()[0]), 'division');
    assert.equal(spotOf(table()[3]), 'wildcard');
    assert.equal(spotOf(table()[5]), null);
});

test('playoffChanges: baseline first, then a change counts only when it repeats', () => {
    const base = playoffChanges(null, table());
    assert.deepEqual(base.events, []);
    // NYI (first out) jumps over EEE.
    const swapped = table({NYI: {wildcardSequence: 2, points: 26}, EEE: {wildcardSequence: 3, points: 25}});
    const first = playoffChanges(base.state, swapped);
    assert.deepEqual(first.events, [], 'one read is not enough');
    const second = playoffChanges(first.state, swapped);
    assert.deepEqual(second.events.map(e => [e.team, e.kind]).sort(), [['EEE', 'out'], ['NYI', 'in']]);
    assert.deepEqual(playoffChanges(second.state, swapped).events, [], 'and it is not repeated');
    // A one-read blip that reverts never fires.
    const blip = playoffChanges(first.state, table());
    assert.deepEqual(blip.events, []);
    assert.deepEqual(playoffChanges(blip.state, swapped).events, []);
});
test('playoffChanges: teams early in the season are ignored', () => {
    const base = playoffChanges(null, table({NYI: {gamesPlayed: 6}, EEE: {gamesPlayed: 6}}));
    const swapped = table({NYI: {wildcardSequence: 2, points: 26, gamesPlayed: 6}, EEE: {wildcardSequence: 3, gamesPlayed: 6}});
    const once = playoffChanges(base.state, swapped);
    assert.deepEqual(playoffChanges(once.state, swapped).events, []);
});

test('standings messages name the rival and the gap', () => {
    assert.deepEqual(standingsMessage('out', table(), 'NYI'), {title: 'nyi are out of a playoff spot', body: '1 point behind eee for the last wild card.'});
    const back = table({NYI: {wildcardSequence: 2, points: 26}, EEE: {wildcardSequence: 3, points: 25}});
    assert.deepEqual(standingsMessage('in', back, 'NYI'), {title: 'nyi are back in a playoff spot', body: 'Holding the second wild card, 1 point ahead of eee.'});
    const level = table({NYI: {points: 25}});
    assert.match(standingsMessage('out', level, 'NYI').body, /Level on points with eee/);
    assert.equal(describeSpot(table(), 'ZZZ'), null);
});

test('playoffLine: race games, bubble teams and the plain standing', () => {
    assert.match(playoffLine(table(), 'NYI', 'EEE'), /direct playoff-race game/);
    assert.equal(playoffLine(table(), 'NYI', 'AAA'), '1 point out of the last wild card; a win closes the gap.');
    assert.equal(playoffLine(table(), 'EEE', 'AAA'), 'Holding the second wild card by 1 point.');
    assert.equal(playoffLine(table(), 'AAA', 'FFF'), '1st in the Eastern with 34 points.');
    assert.match(playoffLine(table({NYI: {gamesPlayed: 6}}), 'NYI', 'AAA'), /^Early in the season/);
});

test('milestone crossings: highest threshold per stat, firsts, goalies, no false alarms', () => {
    const skater = {goalie: false, gp: 499, g: 199, a: 300, p: 499};
    assert.deepEqual(crossings(skater, {...skater, gp: 500, g: 200, p: 501}).map(c => c.phrase), ['500 career points', '200 career goals', '500 career games'].slice(0, 2));
    assert.deepEqual(crossings({goalie: false, gp: 5, g: 0, a: 0, p: 0}, {goalie: false, gp: 6, g: 1, a: 0, p: 1}).map(c => c.phrase), ['first NHL point', 'first NHL goal']);
    assert.deepEqual(crossings(skater, {...skater, gp: 500}).map(c => c.phrase), ['500 career games']);
    assert.deepEqual(crossings(skater, skater), []);
    assert.deepEqual(crossings({goalie: true, gp: 99, w: 49, so: 9}, {goalie: true, gp: 100, w: 50, so: 9}).map(c => c.phrase), ['50 career wins', '100 career games']);
    const message = milestoneMessage({name: 'Mathew Barzal'}, crossings(skater, {...skater, p: 500, gp: 500}), 'NYI');
    assert.deepEqual(message, {title: 'Mathew Barzal reaches 500 career points', body: 'Mathew Barzal (NYI) also reached 500 career games.'});
    assert.equal(milestoneMessage({name: 'Newcomer'}, [{stat: 'g', value: 1, phrase: 'first NHL goal'}], 'NYI').title, 'Newcomer scores a first NHL goal');
});
test('nearMilestones lists the closest big numbers', () => {
    const near = nearMilestones([{name: 'Mathew Barzal', goalie: false, gp: 700, g: 150, a: 400, p: 749}, {name: 'Ilya Sorokin', goalie: true, gp: 300, w: 98, so: 5}]);
    assert.deepEqual(near.map(n => n.text), ['Barzal is 1 point away from 750 career points.', 'Sorokin is 2 wins away from 100 career wins.']);
});

const game = {id: 1, date: '2026-11-18', startsAt: Date.parse('2026-11-19T00:00:00Z'), state: 'FUT', home: 'NYI', away: 'CBJ'};
test('goalies come from the right side and the blurb reads cleanly', () => {
    const map = {'CBJ@NYI': {home: {name: 'Ilya Sorokin', strength: 'Confirmed'}, away: {name: 'Elvis Merzlikins', strength: 'Likely'}}};
    const goalies = goaliesFor(map, game, 'NYI');
    assert.equal(goalies.mine.name, 'Ilya Sorokin');
    assert.equal(goaliesFor(map, game, 'CBJ').mine.name, 'Elvis Merzlikins');
    assert.equal(goaliesFor(map, {...game, home: 'XXX'}, 'NYI'), null);
    const m = pregameMessage({game, team: 'NYI', rows: table(), goalies, near: [], tz: 'America/New_York'});
    assert.equal(m.title, 'NYI host CBJ at 7:00 PM EST');
    assert.deepEqual(m.body.split('\n'), ['1 point out of the last wild card; a win closes the gap.',
        'Goalies: NYI Sorokin (confirmed), CBJ Merzlikins (expected).', '6-3-1 in the last 10.']);
    assert.match(pregameMessage({game, team: 'NYI', rows: table(), goalies: null, tz: 'Not/AZone'}).title, /7:00 PM EST/, 'a bad zone falls back to Eastern');
    assert.match(pregameMessage({game, team: 'NYI', rows: table(), goalies: {mine: {name: null}, opp: {name: null}}, tz: 'America/New_York'}).body, /NYI TBD, CBJ TBD/);
});
test('parseGoalies keys games by team abbreviation', () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props: {pageProps: {data: [{awayTeamAbbreviation: 'BOS', homeTeamAbbreviation: 'LAK',
        awayGoalieName: 'Jeremy Swayman', awayNewsStrengthName: 'Confirmed', homeGoalieName: null, homeNewsStrengthName: null}]}}})}</script>`;
    assert.deepEqual(parseGoalies(html), {'BOS@LAK': {away: {name: 'Jeremy Swayman', strength: 'Confirmed'}, home: {name: null, strength: null}}});
    assert.throws(() => parseGoalies('<html></html>'), /No page data/);
});

// ---------------------------------------------------------------- delivery + engine
const sub = (over = {}) => ({enabled: true, minimum: 'Medium', team: null, token: 'ExpoPushToken[abc]', topics: {trades: false, pregame: true, milestones: true, standings: true},
    fanTeam: 'NYI', tz: 'America/New_York', ...over});
function setup(prefs = sub()) {
    const store = openStore(':memory:');
    store.subscribe('11111111-1111-1111-1111-111111111111', 'secret', prefs);
    const sent = [];
    const send = async body => { sent.push(body); return {status: 'ok', id: `t${sent.length}`}; };
    return {store, sent, send};
}
const dayMap = confirmed => ({'CBJ@NYI': {home: {name: 'Ilya Sorokin', strength: confirmed ? 'Confirmed' : 'Likely'}, away: {name: 'Elvis Merzlikins', strength: 'Likely'}}});
function fakeNhl({games = [game], rows = table(), careers = [], goalies = dayMap(true)} = {}) {
    return {schedule: async () => games, standings: async () => rows, teamCareers: async () => careers, goalies: async () => goalies};
}

test('wantsTopic: old subscriptions mean trades only', () => {
    assert.equal(wantsTopic({enabled: true}, 'trades'), true);
    assert.equal(wantsTopic({enabled: true}, 'pregame'), false);
    assert.equal(wantsTopic({enabled: true, topics: {trades: false, pregame: true}}, 'trades'), false);
});
test('sendOnce: once per key, backs off after a failure, and disables an unregistered device', async () => {
    const {store, sent, send} = setup();
    const s = store.list('subscriptions')[0];
    assert.equal(await sendOnce(store, s, 'k', {title: 't', body: 'b'}, {send}), true);
    assert.equal(await sendOnce(store, s, 'k', {title: 't', body: 'b'}, {send}), false);
    assert.equal(sent.length, 1);
    const failing = async () => { throw new Error('down'); };
    assert.equal(await sendOnce(store, s, 'f', {title: 't', body: 'b'}, {send: failing, now: 1000}), false);
    assert.equal(await sendOnce(store, s, 'f', {title: 't', body: 'b'}, {send, now: 2000}), false, 'still backing off');
    assert.equal(await sendOnce(store, s, 'f', {title: 't', body: 'b'}, {send, now: 1000 + 5 * 60000}), true);
    const gone = async () => ({status: 'error', details: {error: 'DeviceNotRegistered'}});
    await sendOnce(store, s, 'g', {title: 't', body: 'b'}, {send: gone});
    assert.equal(store.list('subscriptions')[0].enabled, false);
});

test('pregame goes out once, inside the window only, in the device time zone', async () => {
    const {store, sent, send} = setup(sub({tz: 'America/Los_Angeles'}));
    const early = game.startsAt - 3 * 3600000;
    await runTeamAlerts(store, {nhl: fakeNhl(), send, now: early});
    assert.equal(sent.length, 0, 'too early');
    const inWindow = game.startsAt - 80 * 60000;
    await runTeamAlerts(store, {nhl: fakeNhl(), send, now: inWindow});
    await runTeamAlerts(store, {nhl: fakeNhl(), send, now: inWindow + 60000});
    assert.equal(sent.length, 1);
    assert.equal(sent[0].title, 'NYI host CBJ at 4:00 PM PST');
    assert.deepEqual(sent[0].data, {type: 'pregame', gameId: 1, team: 'NYI'});
    await runTeamAlerts(store, {nhl: fakeNhl(), send, now: game.startsAt + 1000});
    assert.equal(sent.length, 1, 'never after puck drop');
});
test('an unconfirmed goalie gets one follow-up when he is confirmed', async () => {
    const {store, sent, send} = setup();
    const t = game.startsAt - 80 * 60000;
    await runTeamAlerts(store, {nhl: fakeNhl({goalies: dayMap(false)}), send, now: t});
    assert.match(sent[0].body, /Sorokin \(expected\)/);
    await runTeamAlerts(store, {nhl: fakeNhl({goalies: dayMap(true)}), send, now: t + 60000});
    await runTeamAlerts(store, {nhl: fakeNhl({goalies: dayMap(true)}), send, now: t + 120000});
    assert.deepEqual(sent.slice(1).map(m => m.title), ['NYI confirm their goalie']);
});
test('pregame is not sent to devices that did not ask, or follow another team', async () => {
    const off = setup(sub({topics: {trades: true, pregame: false, milestones: false, standings: false}}));
    await runTeamAlerts(off.store, {nhl: fakeNhl(), send: off.send, now: game.startsAt - 60000});
    assert.equal(off.sent.length, 0);
    const other = setup(sub({fanTeam: 'TOR'}));
    await runTeamAlerts(other.store, {nhl: fakeNhl(), send: other.send, now: game.startsAt - 60000});
    assert.equal(other.sent.length, 0);
});

test('milestones: the first pass only records totals, then a crossing alerts once', async () => {
    const {store, sent, send} = setup();
    const done = {...game, id: 7, state: 'OFF', startsAt: Date.parse('2026-11-17T00:00:00Z')};
    const barzal = (p, gp) => ({id: 1, name: 'Mathew Barzal', goalie: false, gp, g: 100, a: p - 100, p, w: 0, so: 0});
    let careers = [barzal(499, 700)];
    const nhl = () => fakeNhl({games: [done], careers});
    const t0 = Date.parse('2026-11-17T04:00:00Z');
    await runTeamAlerts(store, {nhl: nhl(), send, now: t0});
    assert.equal(sent.length, 0, 'baseline is silent');
    // Another game finishes and Barzal gets his 500th point.
    const next = {...done, id: 8, startsAt: Date.parse('2026-11-18T00:00:00Z')};
    careers = [barzal(500, 701)];
    const t1 = Date.parse('2026-11-18T04:00:00Z');
    await runTeamAlerts(store, {nhl: fakeNhl({games: [done, next], careers}), send, now: t1});
    assert.equal(sent.length, 1);
    assert.equal(sent[0].title, 'Mathew Barzal reaches 500 career points');
    assert.deepEqual(sent[0].data, {type: 'milestone', playerId: 1, team: 'NYI'});
    await runTeamAlerts(store, {nhl: fakeNhl({games: [done, next], careers}), send, now: t1 + 11 * 60000});
    assert.equal(sent.length, 1, 'the same game is not processed twice');
});
test('milestones wait for the league totals to catch up, up to six hours', async () => {
    const {store, sent, send} = setup();
    const g1 = {...game, id: 7, state: 'OFF', startsAt: Date.parse('2026-11-17T00:00:00Z')};
    const g2 = {...g1, id: 8, startsAt: Date.parse('2026-11-18T00:00:00Z')};
    const stale = [{id: 1, name: 'Mathew Barzal', goalie: false, gp: 700, g: 100, a: 399, p: 499, w: 0, so: 0}];
    await runTeamAlerts(store, {nhl: fakeNhl({games: [g1], careers: stale}), send, now: g1.startsAt + 4 * 3600000});
    // Game 8 is final but the totals haven't moved: keep waiting.
    await runTeamAlerts(store, {nhl: fakeNhl({games: [g1, g2], careers: stale}), send, now: g2.startsAt + 3 * 3600000});
    assert.equal(store.get('state', 'milestones:NYI').game, 7);
    await runTeamAlerts(store, {nhl: fakeNhl({games: [g1, g2], careers: stale}), send, now: g2.startsAt + 7 * 3600000});
    assert.equal(store.get('state', 'milestones:NYI').game, 8, 'gives up waiting after six hours');
    assert.equal(sent.length, 0);
});

test('standings alerts: quiet during games, then in/out for the followed team only', async () => {
    const {store, sent, send} = setup();
    const t = Date.parse('2026-11-18T12:00:00Z');
    const swapped = table({NYI: {wildcardSequence: 2, points: 26}, EEE: {wildcardSequence: 3, points: 25}});
    const live = [{...game, state: 'LIVE'}];
    await runTeamAlerts(store, {nhl: fakeNhl({rows: table(), games: []}), send, now: t}); // baseline
    await runTeamAlerts(store, {nhl: fakeNhl({rows: swapped, games: live}), send, now: t + 11 * 60000});
    assert.equal(store.get('cursors', 'team-alerts') != null, true);
    await runTeamAlerts(store, {nhl: fakeNhl({rows: swapped, games: []}), send, now: t + 22 * 60000}); // first sighting
    assert.equal(sent.length, 0);
    await runTeamAlerts(store, {nhl: fakeNhl({rows: swapped, games: []}), send, now: t + 33 * 60000});
    assert.equal(sent.length, 1);
    assert.deepEqual([sent[0].title, sent[0].data], ['nyi are back in a playoff spot', {type: 'standings', team: 'NYI'}]);
});
test('a failing data source does not stop the other jobs', async () => {
    const {store, sent, send} = setup();
    const nhl = {...fakeNhl(), standings: async () => { throw new Error('boom'); }};
    const errors = [];
    await runTeamAlerts(store, {nhl, send, now: game.startsAt - 60000, log: m => errors.push(m)});
    assert.equal(sent.length, 0, 'pregame needs standings, so nothing, but no throw');
    assert.ok(errors.length >= 1);
});
