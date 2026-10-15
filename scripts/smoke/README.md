# Render smoke test

Builds the web bundle, then walks every screen in headless Chromium. Every external request
(api-web.nhle.com, api.nhle.com, moneypuck.com, rotowire.com, assets.nhle.com, any other image) is answered
from deterministic fixtures, so nothing needs the network. It reports page errors, `console.error`s,
error-boundary screens ("Something went wrong") and blank screens, and screenshots every state.

```sh
# 1. build (re-run after app changes)
EXPO_OFFLINE=1 npx expo export --platform web --output-dir scripts/smoke/dist --source-maps

# 2. run: onboarding, full and degraded scenarios, each in light and dark
node scripts/smoke/run.js

# subsets / options
node scripts/smoke/run.js --scenario full --scheme dark
node scripts/smoke/run.js --only scores,standings     # home, scores, standings, players, settings
node scripts/smoke/run.js --no-shots --verbose
node scripts/smoke/fixtures.js                        # fixture self-check (lists every endpoint)
```

Output goes to `scripts/smoke/out/`: `<scenario>-<scheme>-<screen>.png` (390×844 @2x) and `report.json`.
Stacks are symbolicated with the bundle's source map when `--source-maps` was used. The exit code is 1
if any page error, error boundary or blank screen was found.
Chromium comes from `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; override it with `CHROME_PATH`.

## Scenarios

| scenario | favourite team | data |
|---|---|---|
| `onboarding` | none | full. Searches, picks Utah and lands on My Team |
| `full` | TOR | every endpoint answers |
| `degraded` | TOR | MoneyPuck predictions, gameData, starting goalies, goalie season stats, simulations and power rankings return 404. The current-season teamGameByGame file 404s too, so the app falls back to last season. RotoWire returns 503 |

## Fixture world (`fixtures.js`)

The browser clock is frozen at **2026-11-12 01:15 UTC (8:15 pm ET, Wed Nov 11)** in `America/New_York`, so
the season is 20262027 and MoneyPuck's year is 2026. A seeded schedule runs from Oct 7. Standings, score
feeds, club schedules, box scores, play-by-play, player game logs, stats summaries and MoneyPuck CSVs are all
derived from it, so the numbers agree across screens. Today's slate is scripted:

| game | state |
|---|---|
| NYR @ BOS | OFF 2–4, NYR pulls the goalie and BOS scores into the empty net |
| PIT @ WSH | FINAL 3–2 after a shootout |
| MTL @ TOR | LIVE, 2nd 08:34, TOR on the power play (situation 1451) |
| UTA @ COL | LIVE, 1st intermission |
| EDM @ VGK | CRIT, 3rd 01:47, EDM net empty (0651) |
| SEA @ LAK | PRE. Starting goalies are confirmed and MoneyPuck uses the `L.A` team code |
| CHI @ DAL, ANA @ VAN, NSH @ SJS | FUT |
| CBJ @ DET | FUT, postponed (`gameScheduleState: PPD`) |

The fixtures also cover a few edge cases on purpose:

- MoneyPuck spells LAK, NJD, SJS and TBL with dots, so the NHL-code teamGameByGame URL 404s for them.
- Power-ranking snapshots exist only for the date a week ago.
- One player was traded mid-season last year, so he has two seasonTotals rows.
- Names use accents (Stützle-style).
- One penalty is a bench minor with only `servedBy`.
- SEA has no injuries.

To add an endpoint, extend `resolve()` in `fixtures.js`. Unknown external URLs are served a 404 and listed
under "unmocked" in the summary.
