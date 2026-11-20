import assert from 'node:assert/strict';
import test from 'node:test';
import {assistPositions, createTracking} from './tracking.mjs';

// Rink inches: x 0..2400, y 0..1020. Puck path: starts with player 7, passes to 8 (assist2 -> assist1), then scorer 9.
const frame = (puck, players) => ({timeStamp: 0, onIce: {
    puck: {id: 1, playerId: '', ...puck},
    ...Object.fromEntries(Object.entries(players).map(([id, p]) => [id, {id: Number(id), playerId: Number(id), ...p}])),
}});
const frames = [
    frame({x: 600, y: 300}, {7: {x: 610, y: 300}, 8: {x: 900, y: 700}, 9: {x: 1700, y: 500}}),
    frame({x: 800, y: 500}, {7: {x: 640, y: 320}, 8: {x: 810, y: 520}, 9: {x: 1700, y: 500}}),
    frame({x: 1500, y: 520}, {7: {x: 700, y: 330}, 8: {x: 1000, y: 560}, 9: {x: 1520, y: 520}}),
    frame({x: 2200, y: 510}, {7: {x: 720, y: 330}, 8: {x: 1100, y: 560}, 9: {x: 2190, y: 510}}),
];

test('assists are placed where each player last had the puck, converted to feet', () => {
    const r = assistPositions(frames, {scorer: 9, assist1: 8, assist2: 7});
    assert.deepEqual(r.a1, {x: -32.5, y: -0.8}); // frame 1: (810, 520) in
    assert.deepEqual(r.a2, {x: -49.2, y: 17.5}); // frame 0: (610, 300) in -- 7 left the puck after the first pass
});
test('a missing assister or puck position yields null instead of throwing', () => {
    assert.deepEqual(assistPositions(frames, {scorer: 9, assist1: 99}), {a1: null, a2: null});
    assert.deepEqual(assistPositions([], {scorer: 9}), {a1: null, a2: null});
    const noPuck = [{timeStamp: 0, onIce: {7: {playerId: 7, x: 100, y: 100}}}];
    assert.deepEqual(assistPositions(noPuck, {scorer: 9, assist1: 7}), {a1: null, a2: null});
});

const pbp = {plays: [
    {eventId: 5, typeDescKey: 'goal', pptReplayUrl: 'https://wsr.nhle.com/sprites/x/ev5.json', details: {scoringPlayerId: 9, assist1PlayerId: 8, assist2PlayerId: 7}},
    {eventId: 6, typeDescKey: 'goal', pptReplayUrl: 'https://evil.example/ev6.json', details: {scoringPlayerId: 9, assist1PlayerId: 8}},
    {eventId: 7, typeDescKey: 'shot-on-goal', details: {}},
]};
const json = body => ({ok: true, status: 200, json: async () => body});

test('goalAssists reads clips only from the NHL tracking host, caches, and validates the game id', async () => {
    const calls = [];
    const fetchImpl = async url => { calls.push(url); return url.includes('play-by-play') ? json(pbp) : json(frames); };
    const assists = createTracking({fetchImpl});
    const out = await assists('2026020283');
    assert.deepEqual(Object.keys(out), ['5']);
    assert.equal(calls.some(u => u.includes('evil.example')), false);
    const before = calls.length;
    await assists('2026020283');
    assert.equal(calls.slice(before).filter(u => u.includes('ev5')).length, 0, 'found clip is cached');
    await assert.rejects(() => assists('../etc'), /Invalid game id/);
    assert.deepEqual(await createTracking({fetchImpl, enabled: false})('2026020283'), {});
});

test('an upstream failure gives no data rather than an error for the whole game', async () => {
    const fetchImpl = async url => url.includes('play-by-play') ? json(pbp) : {ok: false, status: 403, json: async () => ({})};
    assert.deepEqual(await createTracking({fetchImpl})('2026020283'), {});
});
