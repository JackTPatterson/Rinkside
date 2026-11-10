import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
    buildEvents, buildWpSeries, clockLabel, elapsedOf, gameEnd, passedEvents, scoreAt, tally, visibleEvents, wpAtTime, wpSeriesFromRows,
} from '../liveRink.js';

const HOME = 1;
const AWAY = 2;
const play = (eventId, type, period, time, owner, d = {}, extra = {}) => ({
    eventId, typeDescKey: type, periodDescriptor: {number: period, periodType: period > 3 ? 'OT' : 'REG'}, timeInPeriod: time,
    details: {eventOwnerTeamId: owner, ...d}, ...extra,
});
const pbp = {
    plays: [
        play(1, 'faceoff', 1, '00:00', HOME),
        play(2, 'shot-on-goal', 1, '03:10', HOME, {xCoord: -80, yCoord: 5, shotType: 'wrist', shootingPlayerId: 11}, {homeTeamDefendingSide: 'right'}),
        play(3, 'goal', 1, '05:00', HOME, {xCoord: 85, yCoord: -3, scoringPlayerId: 12, homeScore: 1, awayScore: 0}, {homeTeamDefendingSide: 'left'}),
        play(4, 'missed-shot', 1, '07:30', AWAY, {xCoord: 70, yCoord: 10, shootingPlayerId: 21}, {homeTeamDefendingSide: 'right'}),
        play(5, 'penalty', 2, '01:00', AWAY, {descKey: 'tripping', duration: 2, committedByPlayerId: 22}),
        play(6, 'blocked-shot', 2, '02:00', AWAY, {xCoord: 60, yCoord: 0}, {homeTeamDefendingSide: 'right'}),
        play(7, 'goal', 2, '10:00', AWAY, {xCoord: 80, yCoord: 0, scoringPlayerId: 23, homeScore: 1, awayScore: 1}, {homeTeamDefendingSide: 'right'}),
        play(8, 'goal', 4, '01:30', HOME, {xCoord: -85, yCoord: 2, scoringPlayerId: 13, homeScore: 2, awayScore: 1}, {homeTeamDefendingSide: 'right'}),
        {...play(9, 'shot-on-goal', 5, '00:00', HOME, {xCoord: 1, yCoord: 1}), periodDescriptor: {number: 5, periodType: 'SO'}},
    ],
};
const xgShots = [{eventId: 2, xg: 0.1}, {eventId: 3, xg: 0.4}, {eventId: 4, xg: 0.05}, {eventId: 7, xg: 0.2}, {eventId: 8, xg: 0.3}];

test('elapsedOf: period offsets', () => {
    assert.equal(elapsedOf(1, '00:00'), 0);
    assert.equal(elapsedOf(2, '10:30'), 1200 + 630);
    assert.equal(elapsedOf(4, '01:30'), 3600 + 90);
});

test('buildEvents: ordered, home always attacks left, shootout and faceoffs dropped', () => {
    const ev = buildEvents(pbp, HOME, xgShots);
    assert.deepEqual(ev.map((e) => e.id), ['2', '3', '4', '5', '6', '7', '8']);
    const byId = Object.fromEntries(ev.map((e) => [e.id, e]));
    // Home defending RIGHT shoots at the left end already (raw x < 0): unchanged.
    assert.equal(byId[2].x, -80);
    // Home defending LEFT shoots right (raw x > 0): flipped, so home always attacks the left end.
    assert.equal(byId[3].x, -85);
    assert.equal(byId[3].y, 3);
    assert.equal(byId[4].x, 70, 'away attacks the right end');
    assert.ok(ev.filter((e) => e.kind !== 'penalty' && e.x !== null).every((e) => (e.isHome ? e.x < 0 : e.x > 0)), 'home left, away right, for every shot');
    assert.equal(byId[5].x, null, 'penalties have no location');
    assert.equal(byId[5].kind, 'penalty');
    assert.deepEqual(byId[5].penalty, {name: 'tripping', minutes: 2});
    assert.equal(byId[3].xg, 0.4);
    assert.equal(byId[6].xg, null);
    assert.deepEqual([byId[3].hs, byId[3].as], [1, 0], 'score after the goal');
    assert.deepEqual([byId[8].hs, byId[8].as], [2, 1]);
    assert.equal(byId[2].playerId, 11);
});

test('tally / scoreAt / visibleEvents at a point in time', () => {
    const ev = buildEvents(pbp, HOME, xgShots);
    const t = elapsedOf(2, '10:00');
    assert.deepEqual(scoreAt(ev, t), {home: 1, away: 1});
    assert.deepEqual(scoreAt(ev, 100), {home: 0, away: 0});
    const s = tally(ev, t);
    assert.deepEqual([s.home.goals, s.home.sog, s.home.attempts], [1, 2, 2]);
    assert.deepEqual([s.away.goals, s.away.sog, s.away.attempts], [1, 1, 3], 'miss + block + goal = 3 attempts, 1 on goal');
    assert.ok(Math.abs(s.home.xg - 0.5) < 1e-9);
    assert.ok(Math.abs(s.away.xg - 0.25) < 1e-9, 'blocked shots add no xG');
    assert.equal(visibleEvents(ev, 400).length, 2);
    assert.equal(passedEvents(ev, 189, 300).map((e) => e.id).join(), '2,3');
    assert.equal(passedEvents(ev, 190, 300).map((e) => e.id).join(), '3', 'start is exclusive: no double-firing across ticks');
});

test('gameEnd: live clock vs last event', () => {
    const ev = buildEvents(pbp, HOME, xgShots);
    assert.equal(gameEnd(ev, {final: true}), 3690);
    assert.equal(gameEnd(ev, {nowT: 5000}), 5000);
    assert.equal(gameEnd([], {nowT: 0}), 0);
});

test('buildWpSeries: steps at goals, sorted, uses the score at the time', () => {
    const ev = buildEvents(pbp, HOME, xgShots);
    const calls = [];
    const series = buildWpSeries(ev, 1800, (t, h, a) => {
        calls.push([t, h, a]);
        return 0.5 + (h - a) * 0.2;
    });
    assert.ok(series.every((p, i) => i === 0 || p.t >= series[i - 1].t), 'sorted by time');
    const atGoal = series.filter((p) => p.t === 300);
    assert.deepEqual(atGoal.map((p) => Math.round(p.p * 100)), [50, 70], 'before/after pair at the goal');
    assert.equal(wpAtTime(series, 1000), 0.7);
    // A goal past endT is still included (a final decided in OT), so the series ends at the last goal.
    assert.equal(series[series.length - 1].t, 3690);
    assert.equal(wpAtTime(series, 1800), 0.5, 'after the 2nd-period equaliser it is 1–1');
});

test('wpAtTime: interpolation, clamping and goal steps', () => {
    const s = [{t: 0, p: 0.5}, {t: 100, p: 0.5}, {t: 100, p: 0.8}, {t: 200, p: 0.6}];
    assert.equal(wpAtTime(s, -5), 0.5);
    assert.equal(wpAtTime(s, 50), 0.5);
    assert.equal(wpAtTime(s, 100), 0.8, 'exactly at a goal: the after value');
    assert.ok(Math.abs(wpAtTime(s, 150) - 0.7) < 1e-9);
    assert.equal(wpAtTime(s, 999), 0.6);
    assert.equal(wpAtTime([], 5), 0.5);
});

test('wpSeriesFromRows drops rows without a time', () => {
    assert.deepEqual(wpSeriesFromRows([{p: 0.5, time: 0}, {p: 0.6, time: null}, {p: 0.7, time: 60}]), [{t: 0, p: 0.5}, {t: 60, p: 0.7}]);
});

test('clockLabel', () => {
    const name = (n) => ['', '1st', '2nd', '3rd', 'OT'][n];
    assert.equal(clockLabel(0, name), '1st 0:00');
    assert.equal(clockLabel(1200 + 754, name), '2nd 12:34');
    assert.equal(clockLabel(3600 + 5, name), 'OT 0:05');
});

test('share card formatting', async () => {
    const f = await import('../shareFormat.js');
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(f.periodName), ['1st', '2nd', '3rd', 'OT', '2OT', '3OT']);
    assert.equal(f.resultLabel({final: true, lastPeriodType: 'OT'}), 'FINAL · OT');
    assert.equal(f.resultLabel({final: true, lastPeriodType: 'SO'}), 'FINAL · SO');
    assert.equal(f.resultLabel({final: true}), 'FINAL');
    assert.equal(f.resultLabel({live: true, period: 2, clock: {timeRemaining: '12:34'}}), 'LIVE · 2nd 12:34');
    assert.equal(f.resultLabel({live: true, period: 1, clock: {inIntermission: true}}), 'LIVE · 1st INT');

    const goals = [
        {isHome: true, lastName: 'Barzal', period: 1, timeInPeriod: '05:00'},
        {isHome: false, name: 'Brad Marchand', period: 2, timeInPeriod: '10:07'},
        ...[1, 2, 3, 4, 5].map((i) => ({isHome: true, lastName: `P${i}`, period: 3, timeInPeriod: `1${i}:00`})),
    ];
    assert.deepEqual(f.goalLines(goals, false), ['Marchand · 2nd 10:07']);
    const home = f.goalLines(goals, true, 3);
    assert.equal(home[0], 'Barzal · 1st 5:00');
    assert.equal(home.length, 4);
    assert.equal(home[3], '+3 more');
    assert.deepEqual(f.goalLines([], true), []);

    assert.deepEqual(f.percentPair(0.57, 0.43), [57, 43]);
    assert.deepEqual(f.percentPair(1, 2), [33, 67]);
    assert.equal(f.percentPair(0, 0), null);
    assert.equal(f.percentPair(NaN, 1), null);

    const header = {home: {abbrev: 'NYI', sog: 30, score: 4}, away: {abbrev: 'BOS', sog: 25, score: 2}, final: true};
    const xg = {home: {xg: 3.1, shots: [1]}, away: {xg: 1.8, shots: [1]}};
    const tiles = f.statTiles({header, xg, dtw: {home: 0.711, away: 0.289}});
    assert.deepEqual(tiles.map((t) => [t.label, t.home, t.away]), [['SHOTS', '30', '25'], ['xG', '3.10', '1.80'], ['DESERVED', '71%', '29%']]);
    assert.deepEqual(f.statTiles({header: {home: {}, away: {}}, xg: null, dtw: null}), []);

    assert.match(f.headline({header, excitement: {comeback: 0.08, label: 'Thriller'}, dtw: null}), /won from 8% win probability/);
    assert.match(f.headline({header, excitement: {comeback: 0.5, label: 'Thriller'}, dtw: {home: 0.2, away: 0.8}}), /only a 20% chance/);
    assert.match(f.headline({header, excitement: {comeback: 0.5, label: 'Thriller'}, dtw: {home: 0.9, away: 0.1}}), /NYI dominated BOS/);
    assert.equal(f.headline({header, excitement: {comeback: 0.5, label: 'Thriller'}, dtw: {home: 0.6, away: 0.4}}), 'Thriller');
    assert.equal(f.headline({header, excitement: null, dtw: null}), null);
});
