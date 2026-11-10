import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
    LIVE_STALE_MS,
    buildSnapshot,
    buildTimeline,
    gameSnapshot,
    liveActivityProps,
    pickGame,
    readableOn,
    standingSnapshot,
    teamPalette,
} from '../snapshot.js';

const NOW = Date.parse('2026-11-06T23:00:00Z');
const H = 3600 * 1000;
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();

const game = (id, offsetMs, state, extra = {}) => ({
    id,
    gameState: state,
    startTimeUTC: iso(offsetMs),
    homeTeam: {abbrev: 'NYI', commonName: {default: 'Islanders'}, score: extra.hs, sog: extra.hsog},
    awayTeam: {abbrev: 'BOS', commonName: {default: 'Bruins'}, score: extra.as, sog: extra.asog},
    ...extra.rest,
});

test('readableOn: white on dark brand colours, near-black on light ones', () => {
    assert.equal(readableOn('#00539B'), '#FFFFFF'); // Islanders blue
    assert.equal(readableOn('#FFB81C'), '#0B0B0C'); // Predators gold
    assert.equal(readableOn('#69B3E7'), '#0B0B0C'); // Mammoth light blue
    assert.equal(readableOn('nonsense'), '#FFFFFF');
});

test('teamPalette falls back for unknown teams', () => {
    assert.equal(teamPalette('XXX').bgLight, '#2A2D34');
    assert.equal(teamPalette('NYI').bgLight, '#00539B');
});

test('pickGame: live beats everything, then a recent final, then the next game', () => {
    const live = game(1, -H, 'LIVE');
    const fin = game(2, -5 * H, 'FINAL');
    const next = game(3, 24 * H, 'FUT');
    assert.equal(pickGame([next, fin, live], NOW).id, 1);
    assert.equal(pickGame([next, fin], NOW).id, 2, 'result stays up for hours after the game');
    assert.equal(pickGame([next, game(4, -20 * H, 'FINAL')], NOW).id, 3, 'old results give way to the next game');
    assert.equal(pickGame([], NOW), null);
    assert.equal(pickGame([game(5, -10 * H, 'FUT')], NOW), null, 'a never-started game from yesterday is not "next"');
});

test('gameSnapshot: upcoming, live and final from the favourite team side', () => {
    const up = gameSnapshot(game(1, 2 * H, 'FUT'), 'NYI', NOW);
    assert.equal(up.state, 'upcoming');
    assert.equal(up.isHome, true);
    assert.equal(up.opp.abbrev, 'BOS');
    assert.equal(up.opp.name, 'Bruins');
    assert.equal(up.us, null, 'no score before puck drop');
    assert.match(up.startLabel, /^\d{1,2}:\d{2} (AM|PM)$/);
    assert.equal(up.url, 'rinkside://game/1');

    const live = gameSnapshot(game(2, -H, 'LIVE', {
        hs: 2, as: 3, hsog: 20, asog: 25,
        rest: {periodDescriptor: {number: 2, periodType: 'REG'}, clock: {timeRemaining: '12:34', inIntermission: false}},
    }), 'BOS', NOW);
    assert.equal(live.state, 'live');
    assert.equal(live.isHome, false);
    assert.deepEqual([live.us, live.them, live.usSog, live.themSog], [3, 2, 25, 20], 'scores flip to the favourite team view');
    assert.equal(live.period, '2nd');
    assert.equal(live.clock, '12:34');

    const int = gameSnapshot(game(3, -H, 'LIVE', {hs: 0, as: 0, rest: {periodDescriptor: {number: 1}, clock: {timeRemaining: '00:00', inIntermission: true}}}), 'NYI', NOW);
    assert.equal(int.intermission, true);
    assert.equal(int.clock, null);

    const otl = gameSnapshot(game(4, -4 * H, 'OFF', {hs: 2, as: 3, rest: {gameOutcome: {lastPeriodType: 'OT'}}}), 'NYI', NOW);
    assert.equal(otl.result, 'OTL');
    assert.equal(otl.finalLabel, 'Final · OT');
    const win = gameSnapshot(game(5, -4 * H, 'FINAL', {hs: 4, as: 1, rest: {gameOutcome: {lastPeriodType: 'REG'}}}), 'NYI', NOW);
    assert.equal(win.result, 'W');

    assert.equal(gameSnapshot(game(6, 0, 'FUT'), 'TOR', NOW), null, 'not our game');
});

test('standingSnapshot: rank, wild card, L10, streak and point pace', () => {
    const row = {
        wins: 20, losses: 10, otLosses: 4, points: 44, gamesPlayed: 34, divisionSequence: 4, wildcardSequence: 1,
        conferenceName: 'Eastern', divisionName: 'Metropolitan', l10Wins: 6, l10Losses: 3, l10OtLosses: 1,
        streakCode: 'W', streakCount: 3, goalDifferential: 12,
    };
    const s = standingSnapshot(row);
    assert.equal(s.record, '20-10-4');
    assert.equal(s.rank, 'WC1');
    assert.equal(s.rankSmall, 'Eastern wild card');
    assert.equal(s.l10, '6-3-1');
    assert.equal(s.streak, 'W3');
    assert.equal(s.pace, Math.round((44 / 34) * 82));
    assert.equal(standingSnapshot({...row, wildcardSequence: 0}).rank, '4th');
    assert.equal(standingSnapshot(null), null);
    assert.equal(standingSnapshot({wins: 0, losses: 0, otLosses: 0, points: 0, gamesPlayed: 0}).pace, null);
});

test('buildSnapshot: JSON-safe, merges live detail from the richer feed', () => {
    const week = [game(9, -H, 'LIVE', {hs: 1, as: 0})];
    const richer = game(9, -H, 'LIVE', {hs: 1, as: 0, hsog: 11, asog: 7, rest: {clock: {timeRemaining: '08:00'}, periodDescriptor: {number: 1}}});
    const snap = buildSnapshot({team: 'NYI', standings: {standings: []}, games: week, liveGame: richer, now: NOW});
    assert.equal(snap.team.abbrev, 'NYI');
    assert.equal(snap.team.short, 'Islanders');
    assert.equal(snap.standing, null);
    assert.equal(snap.game.usSog, 11);
    assert.equal(snap.game.clock, '08:00');
    assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap, 'survives JSON round-trip (props cross a native bridge)');
    assert.equal(buildSnapshot({team: 'ZZZ', games: [], now: NOW}), null);
    assert.equal(buildSnapshot({team: 'NYI', games: [], now: NOW}).game, null);
});

test('buildTimeline: countdown flips at puck drop, live score expires', () => {
    const upcoming = buildSnapshot({team: 'NYI', games: [game(1, 2 * H, 'FUT')], now: NOW});
    const tl = buildTimeline(upcoming, NOW);
    assert.deepEqual(tl.map((e) => e.props.game.state), ['upcoming', 'started', 'stale']);
    assert.equal(tl[1].date, NOW + 2 * H);
    assert.ok(tl.every((e, i) => i === 0 || e.date > tl[i - 1].date), 'strictly increasing');

    const live = buildSnapshot({team: 'NYI', games: [game(2, -H, 'LIVE', {hs: 0, as: 0})], now: NOW});
    const ltl = buildTimeline(live, NOW);
    assert.deepEqual(ltl.map((e) => e.props.game.state), ['live', 'liveStale']);
    assert.equal(ltl[1].date, NOW + LIVE_STALE_MS);

    const none = buildSnapshot({team: 'NYI', games: [], now: NOW});
    assert.equal(buildTimeline(none, NOW).length, 1);

    const ppd = buildSnapshot({team: 'NYI', games: [game(3, 2 * H, 'FUT', {rest: {gameScheduleState: 'PPD'}})], now: NOW});
    assert.deepEqual(buildTimeline(ppd, NOW).map((e) => e.props.game.state), ['upcoming'], 'postponed games never "start" or expire');
});

test('liveActivityProps: compact team-side payload', () => {
    assert.equal(liveActivityProps(buildSnapshot({team: 'NYI', games: [], now: NOW})), null);
    const snap = buildSnapshot({
        team: 'NYI', now: NOW,
        games: [game(7, -H, 'LIVE', {hs: 3, as: 2, hsog: 10, asog: 9, rest: {periodDescriptor: {number: 3}, clock: {timeRemaining: '01:02'}}})],
    });
    const p = liveActivityProps(snap);
    assert.equal(p.gameId, 7);
    assert.deepEqual([p.us, p.them, p.period, p.clock], [3, 2, '3rd', '01:02']);
    assert.equal(p.team.abbrev, 'NYI');
    assert.equal(p.opp.abbrev, 'BOS');
    assert.ok(JSON.stringify(p).length < 1500, 'well under the 4KB Live Activity limit');
});

test('parseWidgetUrl: game and standings links, nothing else', async () => {
    const {parseWidgetUrl} = await import('../links.js');
    assert.deepEqual(parseWidgetUrl('rinkside://game/2026020123'), {type: 'game', gameId: 2026020123});
    assert.deepEqual(parseWidgetUrl('rinkside://game/2026020123?x=1'), {type: 'game', gameId: 2026020123});
    assert.deepEqual(parseWidgetUrl('rinkside://standings'), {type: 'standings'});
    for (const bad of ['rinkside://', 'rinkside://game', 'rinkside://game/abc', 'https://example.com/game/1', 'rinkside://player/8', '', null, undefined]) {
        assert.equal(parseWidgetUrl(bad), null, String(bad));
    }
});
