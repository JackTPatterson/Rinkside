import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildStories, validateReport, shouldAlert, DAY} from './model.mjs';
const now = Date.now();
const report = (extra = {}) => validateReport({sourceId: 'friedman', title: 'Example player trade talks', url: 'https://x.com/FriedgeHNIC/status/123',
    publishedAt: new Date(now).toISOString(), teams: ['TOR'], claimId: 'example-trade', independent: true, ...extra}, now);

test('Friedman original triggers Medium immediately; syndication never inflates it', () => {
    const original = report();
    const copied = report({sourceId: 'sportsnet', url: 'https://sportsnet.ca/example', originId: 'friedman', independent: false});
    const story = buildStories([original, copied], now)[0];
    assert.equal(story.confidence, 'Medium');
    assert.equal(story.reports.length, 2);
    assert.equal(shouldAlert(story, {enabled: true, minimum: 'Medium', team: 'TOR', startedAt: now - 1}, null, now), true);
});
test('quotes and two outlets repeating the same original do not create High', () => {
    assert.equal(buildStories([report({independent: false})], now)[0].confidence, 'Low');
    const copy = report({sourceId: 'sportsnet', url: 'https://sportsnet.ca/example', originId: 'friedman', reviewed: true});
    assert.equal(buildStories([report({reviewed: true}), copy], now)[0].confidence, 'Medium');
});
test('independent reviewed evidence is High; official announcement is Confirmed', () => {
    const independent = report({sourceId: 'sportsnet', url: 'https://sportsnet.ca/example', reviewed: true});
    assert.equal(buildStories([report({reviewed: true}), independent], now)[0].confidence, 'High');
    const official = report({sourceId: 'nhl', url: 'https://nhl.com/news/example', status: 'confirmed', reviewed: true});
    assert.equal(buildStories([official, independent], now)[0].confidence, 'Confirmed');
    assert.throws(() => report({status: 'confirmed'}), /official/);
});
test('verified denials override confidence; stale reports decay and expire', () => {
    const denied = report({sourceId: 'sportsnet', url: 'https://sportsnet.ca/example', reviewed: true, status: 'denied'});
    const story = buildStories([report(), denied], now)[0];
    assert.equal(story.confidence, 'Low');
    assert.equal(story.disputed, true);
    assert.equal(buildStories([report()], now + 3 * DAY)[0].stale, true);
    assert.equal(buildStories([report()], now + 8 * DAY).length, 0);
});
test('alert thresholds, team filters, opt-out, dedupe and correction delivery', () => {
    const story = buildStories([report()], now)[0];
    const sub = {enabled: true, minimum: 'Medium', team: 'TOR', startedAt: now - 1};
    assert.equal(shouldAlert(story, {...sub, team: 'BOS'}, null, now), false);
    assert.equal(shouldAlert(story, {...sub, enabled: false}, null, now), false);
    assert.equal(shouldAlert(story, {...sub, minimum: 'High'}, null, now), false);
    assert.equal(shouldAlert(story, {...sub, startedAt: now + 1}, null, now), false);
    assert.equal(shouldAlert(story, sub, {level: 1}, now), false);
    assert.equal(shouldAlert({...story, confidence: 'High'}, sub, {level: 1}, now), true);
    assert.equal(shouldAlert({...story, disputed: true, confidence: 'Low'}, sub, {level: 1}, now), true);
    assert.equal(shouldAlert({...story, disputed: true}, sub, {level: 1, disputed: true}, now), false);
});
test('reject spoofed source domains, another X account, future timestamps and unsafe links', () => {
    for (const url of ['https://evil.com/FriedgeHNIC/status/123', 'https://x.com/Other/status/123', 'javascript:alert(1)', 'https://x.com.evil.com/FriedgeHNIC/status/123']) assert.throws(() => report({url}));
    assert.throws(() => report({publishedAt: new Date(now + DAY).toISOString()}));
});
