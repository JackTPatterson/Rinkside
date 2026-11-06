import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cheerFor, heartbeatInterval, heartbeatPlan, moments, plan, tension} from '../pulse.js';

test('tension: a tied overtime is max, an early blowout is ~0, late-and-close beats early-and-close', () => {
    assert.ok(tension({wpHome: 0.5, period: 4}) >= 0.99);
    assert.ok(tension({wpHome: 0.97, period: 1, secondsLeft: 900}) < 0.05);
    const early = tension({wpHome: 0.5, period: 1, secondsLeft: 1100});
    const late = tension({wpHome: 0.5, period: 3, secondsLeft: 120});
    assert.ok(late > early + 0.5, `${late} vs ${early}`);
    assert.ok(late > 0.9);
    assert.equal(tension({wpHome: NaN}), 0);
    assert.ok(tension({wpHome: 0.6, period: 3, secondsLeft: 300}) > tension({wpHome: 0.85, period: 3, secondsLeft: 300}));
    assert.ok(tension({wpHome: 0.5, period: 3, secondsLeft: 60, playoff: true}) <= 1);
});

test('heartbeatInterval: silent when calm, faster as it gets tenser', () => {
    assert.equal(heartbeatInterval(0.2), null);
    assert.equal(heartbeatInterval(NaN), null);
    assert.equal(heartbeatInterval(0.35), 2400);
    assert.equal(heartbeatInterval(1), 800);
    assert.ok(heartbeatInterval(0.8) < heartbeatInterval(0.5));
});

test('moments: goals (with big swing), non-goal swings, and nothing', () => {
    const base = {hs: 1, as: 1, wp: 0.5};
    assert.deepEqual(moments(base, {hs: 2, as: 1, wp: 0.62}), [{kind: 'goal', home: true, big: false}]);
    assert.deepEqual(moments(base, {hs: 1, as: 2, wp: 0.25}), [{kind: 'goal', home: false, big: true}]);
    assert.deepEqual(moments(base, {hs: 1, as: 1, wp: 0.66}), [{kind: 'swing', home: true}]);
    assert.deepEqual(moments(base, {hs: 1, as: 1, wp: 0.3}), [{kind: 'swing', home: false}]);
    assert.deepEqual(moments(base, {hs: 1, as: 1, wp: 0.55}), []);
    assert.deepEqual(moments(null, base), []);
    assert.equal(moments(base, {hs: 2, as: 2, wp: 0.5}).length, 2, 'both teams scoring between polls');
    assert.deepEqual(moments(base, {hs: 1, as: 1, wp: undefined}), []);
});

test('plan: a goal for you builds up and ends in success; against you sinks; steps are ordered', () => {
    const cheer = plan({kind: 'goal', home: true, big: false}, 'for');
    assert.deepEqual(cheer.map((s) => s.style), ['light', 'medium', 'heavy', 'success']);
    assert.ok(cheer.every((s, i) => i === 0 || s.at > cheer[i - 1].at));
    assert.equal(plan({kind: 'goal', home: true, big: true}, 'for').length, 5, 'a big goal gets an extra thump');
    const against = plan({kind: 'goal', home: false, big: false}, 'against');
    assert.equal(against[against.length - 1].style, 'warning');
    assert.equal(plan({kind: 'goal', home: true, big: false}, null).length, 2);
    assert.equal(plan({kind: 'swing', home: true}, 'for')[1].style, 'rigid');
    for (const s of [...cheer, ...against, ...heartbeatPlan(0.4), ...heartbeatPlan(0.9)]) {
        assert.ok(['impact', 'notify'].includes(s.type));
    }
});

test('cheerFor and heartbeatPlan', () => {
    assert.equal(cheerFor({home: true}, true), 'for');
    assert.equal(cheerFor({home: true}, false), 'against');
    assert.equal(cheerFor({home: true}, null), null);
    assert.equal(heartbeatPlan(0.4)[0].style, 'medium');
    assert.equal(heartbeatPlan(0.9)[0].style, 'heavy');
});
