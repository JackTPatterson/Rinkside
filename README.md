# Rinkside

NHL scores, standings and player stats, plus models you won't find in the official NHL app:
live and pregame win probability, win probability added per goal, a shot-quality (xG) model with
"Deserve to Win", Bayesian true-talent estimates, season projections with ranges, and a streak
detector. See [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organised, and the in-app
**Settings → How the models work** page for the math.

## Develop

```bash
npm install
npx expo start            # needs a development build (Reanimated 4 / New Architecture), not Expo Go
npx expo run:ios          # local dev build (macOS + Xcode)
npm test                  # analytics unit tests
node scripts/check.js     # parse every file + verify imports/exports
npm run bundle:check      # full production JS bundle
```

`ios/` and `android/` are generated (Continuous Native Generation) and git-ignored; config lives in
`app.json`.

## Shipping to TestFlight

The **TestFlight** GitHub Action (`.github/workflows/testflight.yml`) runs the tests, checks the
bundle, builds on EAS and auto-submits to App Store Connect. Run it from the Actions tab
("Run workflow") or push a tag like `v1.1.0`.

One-time setup:

1. **`EXPO_TOKEN` secret**: expo.dev → Account settings → Access tokens → create one, then add it
   under GitHub → Settings → Secrets and variables → Actions → *Secrets*.
2. **`ASC_APP_ID` variable**: App Store Connect → Rinkside → App Information → *Apple ID* (a
   number), added under *Variables*.
3. **App Store Connect API key on EAS**: run `npx eas-cli credentials -p ios` once on your Mac
   (or one interactive `npx eas-cli submit -p ios`) and let EAS create/store the key.

Build numbers are managed remotely by EAS (`appVersionSource: remote`, `autoIncrement`), so you
never edit `buildNumber` by hand. The marketing version is `expo.version` in `app.json`.

Alternatively, from your Mac:

```bash
npx eas-cli build -p ios --profile production --auto-submit
```
