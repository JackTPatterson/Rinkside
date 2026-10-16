#!/usr/bin/env node
'use strict';
// Render smoke test: serves the web export (scripts/smoke/dist) and walks every screen in headless
// Chromium with all network traffic answered from ./fixtures.js. See README.md.
//
//   node scripts/smoke/run.js [--scenario onboarding,full,degraded] [--scheme light,dark]
//                             [--no-shots] [--headed] [--only home,scores,...] [--verbose]

const fs = require('fs');
const http = require('http');
const path = require('path');
const fx = require('./fixtures');

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(__dirname, 'dist');
const OUT = path.join(__dirname, 'out');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VIEWPORT = {width: 390, height: 844};

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const arg = (name, def) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);
const SCENARIOS = arg('scenario', 'onboarding,full,degraded').split(',');
const SCHEMES = arg('scheme', 'light,dark').split(',');
const ONLY = arg('only', '') ? new Set(arg('only', '').split(',')) : null;
const SHOTS = !flag('no-shots');
const VERBOSE = flag('verbose');

/* -------------------------------------------------------------- preflight */

for (const f of ['src/screens/GameScreen.js', 'src/screens/RecapScreen.js']) {
    if (!fs.existsSync(path.join(ROOT, f))) {
        console.error(`✗ ${f} is missing: the app can't be built yet.`);
        process.exit(2);
    }
}
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('✗ scripts/smoke/dist is missing. Build it first:\n  EXPO_OFFLINE=1 npx expo export --platform web --output-dir scripts/smoke/dist --source-maps');
    process.exit(2);
}
let chromium;
try {
    ({chromium} = require('playwright-core'));
} catch {
    console.error('✗ playwright-core is not installed (npm i -D playwright-core)');
    process.exit(2);
}

/* ---------------------------------------------------------- static server */

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.map': 'application/json',
    '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function serve() {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://x');
        let file = path.join(DIST, decodeURIComponent(url.pathname));
        if (!file.startsWith(DIST)) {
            res.writeHead(403).end();
            return;
        }
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            const idx = path.join(file, 'index.html');
            file = fs.existsSync(idx) ? idx : path.join(DIST, 'index.html'); // SPA fallback
        }
        res.writeHead(200, {'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store'});
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/* --------------------------------------------------------- symbolication */

let tracer = null;
function loadTracer() {
    try {
        const {TraceMap, originalPositionFor} = require('@jridgewell/trace-mapping');
        const dir = path.join(DIST, '_expo/static/js/web');
        const maps = new Map();
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js.map'))) {
            maps.set(f.replace(/\.map$/, ''), new TraceMap(fs.readFileSync(path.join(dir, f), 'utf8')));
        }
        if (!maps.size) return null;
        return (stack) => String(stack ?? '').split('\n').map((line) => line.replace(/(?:https?:\/\/[^\s)]+\/)([^/\s):]+\.js):(\d+):(\d+)/, (m, file, l, c) => {
            const map = maps.get(file);
            if (!map) return m;
            const pos = originalPositionFor(map, {line: Number(l), column: Number(c) - 1});
            return pos.source ? `${pos.source.replace(/^.*?\/(src|node_modules)\//, '$1/')}:${pos.line}:${pos.column + 1}${pos.name ? ` (${pos.name})` : ''}` : m;
        })).join('\n');
    } catch (e) {
        if (VERBOSE) console.warn('source maps unavailable:', e.message);
        return null;
    }
}

const symbolicate = (s) => (tracer ? tracer(s) : String(s ?? ''));
const appFrames = (stack) => symbolicate(stack).split('\n').filter((l) => /\b(src\/|App\.js)/.test(l) && !/node_modules/.test(l)).slice(0, 6).map((l) => l.trim());

/* -------------------------------------------------------------- the tour */

class Tour {
    constructor(page, {scenario, scheme, report}) {
        this.page = page;
        this.scenario = scenario;
        this.scheme = scheme;
        this.report = report;
        this.screen = 'boot';
        this.inflight = 0;
        this.lastNet = Date.now();
        this.shots = 0;
        this.visited = [];
    }

    log(...a) {
        if (VERBOSE) console.log(`  [${this.scenario}/${this.scheme}] ${this.screen}:`, ...a);
    }

    error(kind, message, stack) {
        const entry = {scenario: this.scenario, scheme: this.scheme, screen: this.screen, kind, message: String(message).slice(0, 2000)};
        if (stack) {
            entry.stack = symbolicate(stack).split('\n').slice(0, 25).join('\n');
            entry.appFrames = appFrames(stack);
        }
        this.report.errors.push(entry);
        console.log(`  ✗ [${this.scenario}/${this.scheme}] ${this.screen} ${kind}: ${entry.message.split('\n')[0].slice(0, 200)}`);
    }

    async settle(min = 600, max = 9000) {
        const t0 = Date.now();
        await this.page.waitForTimeout(min);
        while (Date.now() - t0 < max) {
            // > 600 ms: the fetch layer waits 600 ms before retrying a failed request.
            if (this.inflight <= 0 && Date.now() - this.lastNet > 900) break;
            await this.page.waitForTimeout(120);
        }
        await this.page.waitForTimeout(250);
    }

    /** Check the rendered page for error boundaries / blank screens, then screenshot. */
    async snap(name) {
        this.screen = name;
        this.visited.push(name);
        const info = await this.page.evaluate(() => {
            const t = document.body.innerText || '';
            const i = t.indexOf('Something went wrong');
            return {boundary: i >= 0 ? t.slice(Math.max(0, i - 80), i + 300).replace(/\s+/g, ' ') : null, chars: t.trim().length};
        }).catch(() => ({boundary: null, chars: -1}));
        if (info.boundary) this.error('error-boundary', info.boundary);
        if (info.chars === 0) this.error('blank', 'Page rendered no text');
        if (SHOTS) {
            const file = path.join(OUT, `${this.scenario}-${this.scheme}-${name}.png`.replace(/[^\w.@-]+/g, '_'));
            await this.page.screenshot({path: file, fullPage: true}).catch((e) => this.error('screenshot', e.message));
            this.shots++;
        }
    }

    /**
     * Elements matching `selector` that are actually on top (hit-testable) on the current screen.
     * Stack screens underneath stay in the DOM, so plain visibility isn't enough.
     */
    async candidates(selector, {maxY = VIEWPORT.height - 90, minY = 0, text, label, prefix} = {}) {
        return this.page.evaluate(({selector, maxY, minY, text, label, prefix}) => {
            window.__smokeId = window.__smokeId || 0;
            const out = [];
            for (const el of document.querySelectorAll(selector)) {
                if (!el.isConnected || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
                const txt = (el.innerText || '').trim();
                const aria = el.getAttribute('aria-label') || '';
                if (text != null && txt !== text) continue;
                if (label != null && aria !== label) continue;
                if (prefix != null && !aria.startsWith(prefix) && !txt.startsWith(prefix)) continue;
                const before = el.getBoundingClientRect();
                if (before.width < 2 || before.height < 2) continue;
                el.scrollIntoView({block: 'nearest', inline: 'nearest'});
                const r = el.getBoundingClientRect();
                const cx = r.left + Math.min(r.width / 2, 20);
                const cy = r.top + r.height / 2;
                if (cy > maxY || cy < minY || cx < 0 || cx > window.innerWidth) continue;
                const hit = document.elementFromPoint(cx, cy);
                if (!hit || !(el === hit || el.contains(hit))) continue;
                if (!el.dataset.smokeId) el.dataset.smokeId = String(++window.__smokeId);
                out.push({id: el.dataset.smokeId, text: txt.split('\n')[0].slice(0, 40), aria, selected: el.getAttribute('aria-selected') === 'true'});
            }
            return out;
        }, {selector, maxY, minY, text, label, prefix});
    }

    async click(c, {long = false} = {}) {
        const loc = this.page.locator(`[data-smoke-id="${c.id}"]`).first();
        try {
            if (long) {
                await loc.scrollIntoViewIfNeeded({timeout: 3000});
                const box = await loc.boundingBox();
                await this.page.mouse.move(box.x + Math.min(box.width / 2, 40), box.y + box.height / 2);
                await this.page.mouse.down();
                await this.page.waitForTimeout(900);
                await this.page.mouse.up();
            } else {
                await loc.click({timeout: 5000});
            }
            await this.settle();
            return true;
        } catch (e) {
            this.error('click', `Couldn't click ${c.aria || c.text}: ${e.message.split('\n')[0]}`);
            return false;
        }
    }

    /** Click the first on-top element matching; returns false (and records a miss) if none. */
    async open(selector, opts = {}, {required = true, long = false} = {}) {
        const list = await this.candidates(selector, opts);
        const c = opts.pick ? opts.pick(list) : list[0];
        if (!c) {
            if (required) this.error('missing', `No element for ${selector} ${JSON.stringify({...opts, pick: undefined})}`);
            return false;
        }
        return this.click(c, {long});
    }

    async back() {
        const ok = await this.open('[aria-label="Back"]', {}, {required: false});
        if (!ok) {
            await this.page.goBack().catch(() => {});
            await this.settle();
        }
    }

    async tabBar(label) {
        this.screen = `tab:${label}`;
        return this.open('div,a,[role="tab"],[role="button"],[role="link"]', {
            minY: VIEWPORT.height - 100, maxY: VIEWPORT.height,
            pick: (list) => list.find((c) => c.text === label || c.aria.startsWith(label)),
        });
    }

    /**
     * Segmented controls on the current screen: rows of 2-8 sibling role=button elements with
     * short text and no aria-label (react-native-web 0.21 drops accessibilityState, so there is no
     * aria-selected to go by). Clicks every option once, screenshotting each.
     */
    async segmentOptions() {
        return this.page.evaluate((maxY) => {
            window.__smokeId = window.__smokeId || 0;
            const SKIP = /recap|condensed|radio|clip|today|show all|show compact|^let/i;
            const groups = new Set();
            for (const el of document.querySelectorAll('[role="button"]')) {
                const parent = el.parentElement;
                if (!parent || groups.has(parent)) continue;
                const kids = [...parent.children].filter((k) => k.getAttribute('role') === 'button');
                if (kids.length < 2 || kids.length > 12 || kids.length < parent.children.length - 1) continue;
                if (kids.some((k) => k.getAttribute('aria-label') || !(k.innerText || '').trim() || (k.innerText || '').trim().length > 22 || SKIP.test(k.innerText))) continue;
                groups.add(parent);
            }
            const out = [];
            for (const parent of groups) {
                for (const el of [...parent.children].filter((k) => k.getAttribute('role') === 'button')) {
                    el.scrollIntoView({block: 'nearest', inline: 'nearest'});
                    const r = el.getBoundingClientRect();
                    const cx = r.left + Math.min(r.width / 2, 20);
                    const cy = r.top + r.height / 2;
                    if (r.width < 2 || cy > maxY || cy < 0 || cx < 0 || cx > window.innerWidth) continue;
                    const hit = document.elementFromPoint(cx, cy);
                    if (!hit || !el.contains(hit)) continue;
                    if (!el.dataset.smokeId) el.dataset.smokeId = String(++window.__smokeId);
                    out.push({id: el.dataset.smokeId, text: el.innerText.trim().split('\n')[0], aria: ''});
                }
            }
            return out;
        }, VIEWPORT.height - 90);
    }

    async segments(base, limit = 14) {
        const seen = new Set();
        for (let guard = 0; guard < limit; guard++) {
            const c = (await this.segmentOptions()).find((x) => !seen.has(x.text));
            if (!c) break;
            seen.add(c.text);
            this.screen = `${base}~${c.text}`;
            if (await this.click(c)) await this.snap(`${base}~${c.text}`);
        }
    }

    /** Every pill tab (role=tab, above the tab bar) on the current screen, plus its segments. */
    async pills(base, {segments = true, onTab} = {}) {
        // Re-discover after every click: some tabs swap the pill set (e.g. Skaters/Goalies sorts).
        const done = new Set();
        for (let guard = 0; guard < 40; guard++) {
            const tabs = await this.candidates('[role="tab"]');
            const c = tabs.find((t) => t.text && !done.has(t.text));
            if (!c) break;
            done.add(c.text);
            this.screen = `${base}.${c.text}`;
            if (!(await this.click(c))) continue;
            await this.snap(`${base}.${c.text}`);
            if (segments) await this.segments(`${base}.${c.text}`);
            if (onTab) await onTab(c.text);
        }
        return [...done];
    }

    want(section) {
        return !ONLY || ONLY.has(section);
    }

    /* ------------------------------------------------------------ flows */

    async onboarding() {
        await this.snap('onboarding');
        await this.open('[aria-label="Search teams"]', {}, {required: false});
        await this.page.keyboard.type('uta').catch(() => {});
        await this.settle(300);
        await this.snap('onboarding-search');
        await this.open('[aria-label="Utah Mammoth"]');
        await this.snap('onboarding-picked');
        await this.open('[role="button"]', {prefix: 'Let', maxY: VIEWPORT.height}); // no tab bar on onboarding
        await this.settle(800);
        await this.snap('onboarding-done-home');
    }

    async game(name, awayAtHome, {recap = false, long = false} = {}) {
        this.screen = `scores>${name}`;
        if (long) {
            if (!(await this.open('[aria-label]', {prefix: `${awayAtHome},`}, {long: true}))) return;
            await this.settle(800);
            await this.snap(`scores-preview-${name}`);
            // Dismiss the bottom sheet by dragging its handle down.
            const handleY = await this.page.evaluate(() => {
                const el = [...document.querySelectorAll('div')].find((d) => d.innerText === 'Win probability' || d.innerText?.startsWith('Win probability\n'));
                return el ? Math.max(40, el.getBoundingClientRect().top - 120) : 170;
            }).catch(() => 170);
            await this.page.mouse.move(VIEWPORT.width / 2, handleY);
            await this.page.mouse.down();
            await this.page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height - 20, {steps: 12});
            await this.page.mouse.up();
            await this.settle(900);
            // react-native-web fires onPress from the DOM click that ends a mouse long-press, so the
            // game screen opens underneath the sheet. Note it and go back.
            if ((await this.candidates('[aria-label="Back"]')).length) {
                this.report.notes.add('Long-press on a Scores card (mouse) opens the preview sheet AND navigates to the game (RN-web onPress fires from the click).');
                await this.back();
            }
            return;
        }
        if (!(await this.open('[aria-label]', {prefix: `${awayAtHome},`}))) return;
        await this.settle(900);
        await this.snap(`game-${name}`);
        await this.pills(`game-${name}`, {
            onTab: async (label) => {
                if (label === 'Goals' && name.startsWith('final')) {
                    // Goal detail sheet
                    if (await this.open('[aria-label*=" goal by "]', {}, {required: false})) {
                        await this.snap(`game-${name}.Goals-detail`);
                        await this.open('[aria-label="Close"]', {}, {required: false});
                    }
                }
            },
        });
        if (recap) {
            this.screen = `game-${name}>recap`;
            if (await this.open('[role="button"],div', {pick: (l) => l.find((c) => c.text === 'Recap' || c.aria === 'Recap')})) {
                await this.settle(1500);
                await this.snap(`recap-${name}`);
                await this.page.mouse.wheel(0, 1500);
                await this.settle(400);
                await this.snap(`recap-${name}-scrolled`);
                await this.back();
            }
        }
        await this.back();
    }

    async player(name) {
        await this.settle(800);
        await this.snap(`player-${name}`);
        await this.segments(`player-${name}`, 12);
        await this.page.mouse.wheel(0, 1600);
        await this.settle(300);
        await this.snap(`player-${name}-scrolled`);
        await this.back();
    }

    async full() {
        await this.snap('home');
        if (this.want('home')) {
            await this.pills('home', {
                onTab: async (label) => {
                    if (label === 'Roster') {
                        this.screen = 'home.Roster>player';
                        const rows = await this.candidates('[aria-label][role="button"],[aria-label][tabindex]');
                        const p = rows.find((r) => /^[A-ZÀ-Ž][\p{L}.' -]+ [\p{L}' -]+$/u.test(r.aria) && !/Back|Close|Choose|Switch/.test(r.aria));
                        if (p && (await this.click(p))) await this.player('from-roster');
                    }
                },
            });
            this.screen = 'home>switch-team';
            if (await this.open('[aria-label$="Switch team"]', {}, {required: false})) {
                await this.snap('home-team-picker');
                await this.open('[aria-label="Close"]', {}, {required: false});
            }
        }

        if (this.want('scores')) {
            await this.tabBar('Scores');
            await this.settle(800);
            await this.snap('scores');
            await this.page.mouse.wheel(0, 1400);
            await this.settle(300);
            await this.snap('scores-scrolled');
            await this.page.mouse.wheel(0, -3000);
            await this.game('live-pp', 'MTL at TOR');
            await this.game('final-en', 'NYR at BOS', {recap: true});
            await this.game('final-so', 'PIT at WSH', {recap: true});
            await this.game('crit-pulled', 'EDM at VGK');
            await this.game('intermission', 'UTA at COL');
            await this.game('pregame', 'SEA at LAK');
            await this.game('future', 'CHI at DAL');
            await this.game('postponed', 'CBJ at DET');
            await this.game('future', 'ANA at VAN', {long: true});
            await this.snap('scores-return');
            this.screen = 'scores>yesterday';
            const y = new Date(`${fx.TODAY}T12:00:00`);
            y.setDate(y.getDate() - 1);
            if (await this.open('[aria-label]', {label: y.toDateString()})) await this.snap('scores-yesterday');
        }

        if (this.want('standings')) {
            await this.tabBar('Standings');
            await this.settle(800);
            await this.snap('standings');
            await this.pills('standings', {
                onTab: async (label) => {
                    if (label === 'Odds') {
                        this.screen = 'standings.Odds>sheet';
                        const rows = await this.candidates('[role="button"]', {minY: 250});
                        const row = rows.find((r) => !r.aria && /\b[A-Z]{3}\b/.test(r.text));
                        if (row && (await this.click(row))) {
                            await this.snap('standings.Odds-sheet');
                            await this.open('[aria-label="Close"]', {}, {required: false});
                        }
                    }
                },
            });
            this.screen = 'standings>team';
            await this.open('[role="tab"]', {text: 'Standings'}, {required: false});
            if (await this.open('[aria-label$=" points"]', {pick: (l) => l.find((c) => !c.aria.startsWith(fx.FAV_TEAM))})) {
                await this.settle(800);
                await this.snap('team');
                await this.pills('team', {segments: false});
                await this.back();
            }
        }

        if (this.want('players')) {
            await this.tabBar('Players');
            await this.settle(800);
            await this.snap('players');
            await this.pills('players');
            this.screen = 'players>skater';
            await this.open('[role="tab"]', {text: 'Skaters'}, {required: false});
            if (await this.open('[aria-label^="1. "]')) await this.player('skater');
            this.screen = 'players>goalie';
            await this.open('[role="tab"]', {text: 'Goalies'}, {required: false});
            if (await this.open('[aria-label^="1. "]')) await this.player('goalie');
            this.screen = 'players>search';
            await this.open('[role="tab"]', {text: 'Skaters'}, {required: false});
            if (await this.open('input', {}, {required: false})) {
                await this.page.keyboard.type('stutz');
                await this.settle(1200);
                await this.snap('players-search');
                await this.open('[aria-label="Clear search"]', {}, {required: false});
            }
            this.screen = 'players>table';
            if (await this.open('[aria-label="Show all stat columns"]', {}, {required: false})) await this.snap('players-table');
        }

        if (this.want('settings')) {
            await this.tabBar('Settings');
            await this.settle(600);
            await this.snap('settings');
            for (const [title, name] of [['How the models work', 'methodology'], ['About & data sources', 'about']]) {
                this.screen = `settings>${name}`;
                if (await this.open('[aria-label]', {label: title})) {
                    await this.snap(name);
                    await this.page.mouse.wheel(0, 2000);
                    await this.settle(300);
                    await this.snap(`${name}-scrolled`);
                    await this.back();
                }
            }
            this.screen = 'settings>favorite-team';
            if (await this.open('[aria-label^="Favourite team:"]')) {
                await this.snap('favorite-team');
                await this.back();
            }
        }

        await this.tabBar('My Team');
        await this.settle(600);
        await this.snap('home-again');
    }
}

/* ------------------------------------------------------------------ main */

async function runOne(browser, base, scenario, scheme, report) {
    const team = scenario === 'onboarding' ? null : fx.FAV_TEAM;
    const data = scenario === 'degraded' ? 'degraded' : 'full';
    const context = await browser.newContext({
        viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: 'America/New_York', locale: 'en-US',
        isMobile: false, hasTouch: false,
    });
    await context.addInitScript((t) => {
        try {
            localStorage.clear();
            if (t) localStorage.setItem('team', t);
        } catch {}
        // Links (radio, video) would open new tabs; keep the tour in one page.
        window.open = () => null;
    }, team);

    const page = await context.newPage();
    await page.clock.setFixedTime(fx.NOW);
    const tour = new Tour(page, {scenario, scheme, report});

    await context.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url();
        if (url.startsWith(base)) return route.continue();
        const cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS'};
        if (req.method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
        const res = fx.resolve(url, {scenario: data});
        if (res) {
            report.requests[`${new URL(url).hostname}${res.status === 200 ? '' : ` ${res.status}`}`] = (report.requests[`${new URL(url).hostname}${res.status === 200 ? '' : ` ${res.status}`}`] ?? 0) + 1;
            return route.fulfill({status: res.status, headers: {...cors, 'content-type': res.contentType}, body: res.body});
        }
        const type = req.resourceType();
        if (type === 'image') return route.fulfill({status: 200, headers: {...cors, 'content-type': 'image/png'}, body: fx.resolve('https://assets.nhle.com/x.png').body});
        report.unmocked.add(`${req.method()} ${url.split('?')[0]}`);
        return route.fulfill({status: 404, headers: cors, body: 'unmocked'});
    });

    page.on('request', () => {
        tour.inflight++;
        tour.lastNet = Date.now();
    });
    const done = () => {
        tour.inflight--;
        tour.lastNet = Date.now();
    };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
    page.on('pageerror', (err) => tour.error('pageerror', err.message, err.stack));
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            const text = msg.text();
            // Expected: the fetch layer logs nothing, but Chromium reports 4xx/5xx fixture responses.
            if (/Failed to load resource: the server responded with a status of (404|503)/.test(text)) {
                report.httpErrorsLogged++;
                return;
            }
            tour.error('console.error', text, msg.location()?.url ? `at ${msg.location().url}:${msg.location().lineNumber + 1}:${msg.location().columnNumber + 1}` : undefined);
        } else if (VERBOSE && msg.type() === 'warning') {
            console.log(`  warn [${tour.screen}]`, msg.text().slice(0, 200));
        }
    });

    const t0 = Date.now();
    console.log(`▶ ${scenario} / ${scheme}`);
    try {
        await page.goto(base, {waitUntil: 'load'});
        await tour.settle(2000, 15000);
        if (scenario === 'onboarding') await tour.onboarding();
        else await tour.full();
    } catch (e) {
        tour.error('runner', e.message, e.stack);
    }
    report.runs.push({scenario, scheme, screens: tour.visited.length, screenshots: tour.shots, seconds: Math.round((Date.now() - t0) / 1000)});
    console.log(`  ${tour.visited.length} screens, ${tour.shots} screenshots in ${Math.round((Date.now() - t0) / 1000)}s`);
    await context.close();
}

(async () => {
    fs.mkdirSync(OUT, {recursive: true});
    // Clear old screenshots for the runs we're about to redo (other runs' shots are kept).
    const prefixes = SCENARIOS.flatMap((sc) => SCHEMES.map((sh) => `${sc}-${sh}-`));
    if (SHOTS && !ONLY) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') && prefixes.some((p) => f.startsWith(p))) fs.unlinkSync(path.join(OUT, f));
    tracer = loadTracer();
    const server = await serve();
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({executablePath: CHROME, headless: !flag('headed')});
    const report = {when: new Date().toISOString(), fixtureNow: fx.NOW.toISOString(), runs: [], errors: [], unmocked: new Set(), notes: new Set(), requests: {}, httpErrorsLogged: 0};
    try {
        for (const scenario of SCENARIOS) {
            for (const scheme of SCHEMES) await runOne(browser, base, scenario, scheme, report);
        }
    } finally {
        await browser.close();
        server.close();
    }
    const out = {...report, unmocked: [...report.unmocked], notes: [...report.notes]};
    fs.writeFileSync(path.join(OUT, SHOTS ? 'report.json' : 'report-noshots.json'), JSON.stringify(out, null, 2));

    // Group identical errors across runs.
    const groups = new Map();
    for (const e of report.errors) {
        const key = `${e.kind}|${e.message.split('\n')[0].slice(0, 160)}`;
        if (!groups.has(key)) groups.set(key, {...e, where: new Set()});
        groups.get(key).where.add(`${e.scenario}/${e.scheme}:${e.screen}`);
    }
    console.log('\n──────── summary');
    for (const r of report.runs) console.log(`${r.scenario}/${r.scheme}: ${r.screens} screens, ${r.screenshots} shots, ${r.seconds}s`);
    console.log(`requests: ${JSON.stringify(report.requests)}`);
    if (out.unmocked.length) console.log(`unmocked (served 404):\n  ${out.unmocked.join('\n  ')}`);
    for (const n of out.notes) console.log(`note: ${n}`);
    console.log(`${groups.size} distinct problem(s), ${report.errors.length} total`);
    for (const g of groups.values()) {
        console.log(`\n✗ ${g.kind}: ${g.message.split('\n')[0].slice(0, 300)}`);
        console.log(`  on: ${[...g.where].slice(0, 8).join(', ')}${g.where.size > 8 ? ` (+${g.where.size - 8})` : ''}`);
        if (g.appFrames?.length) console.log(`  app frames:\n    ${g.appFrames.join('\n    ')}`);
    }
    console.log(`\nscreenshots + report.json in ${path.relative(ROOT, OUT)}/`);
    process.exit(report.errors.some((e) => ['pageerror', 'error-boundary', 'blank', 'runner'].includes(e.kind)) ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(3);
});
