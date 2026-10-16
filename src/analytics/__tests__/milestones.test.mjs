import assert from 'node:assert/strict';
import {test} from 'node:test';
import {activeStreaks, milestoneWatch} from '../milestones.js';

const game = (playerId, gameId, gameDate, s) => ({playerId, gameId, gameDate, skaterFullName: `P${playerId}`, goals: 0, assists: 0, points: 0, ...s});

test('milestoneWatch: close marks, just-reached marks, and nothing far away', () => {
    const items = milestoneWatch({
        careerSkaters: [
            {playerId: 1, skaterFullName: 'Near', goals: 297, assists: 10, points: 307, gamesPlayed: 450},
            {playerId: 2, skaterFullName: 'Done', goals: 100, assists: 20, points: 120, gamesPlayed: 300},
            {playerId: 3, skaterFullName: 'Far', goals: 120, assists: 150, points: 270, gamesPlayed: 420},
        ],
        careerGoalies: [],
        skaterGames: [game(2, 10, '2026-10-15', {goals: 1, points: 1}), game(1, 10, '2026-10-15', {})],
        goalieGames: [],
    });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    assert.equal(byKey['1-goals'].remaining, 3);
    assert.equal(byKey['1-goals'].target, 300);
    assert.equal(byKey['2-goals-done'].reached, true);
    assert.equal(byKey['2-goals-done'].target, 100);
    assert.equal(items[0].reached, true, 'reached milestones sort first');
    assert.ok(!items.some((i) => i.playerId === 3));
    assert.ok(!items.some((i) => i.key.endsWith('gamesPlayed')), 'games only from 500');
});

test('activeStreaks: alive through the latest game, one row per player', () => {
    const rows = [
        ...[1, 2, 3, 4].map((g) => game(1, g, `2026-10-0${g}`, {points: 1, goals: g > 1 ? 1 : 0, assists: g > 1 ? 0 : 1})),
        ...[1, 2, 3].map((g) => game(2, g, `2026-10-0${g}`, {points: 1, assists: 1})), // missed game 4
    ];
    const s = activeStreaks({skaterGames: rows, goalieGames: []});
    assert.equal(s.length, 1);
    assert.equal(s[0].label, 'Point streak');
    assert.equal(s[0].length, 4);
    assert.match(s[0].detail, /goal in 3 straight/);
});
