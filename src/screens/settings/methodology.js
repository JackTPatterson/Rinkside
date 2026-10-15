// Plain-English explainers for every model in src/analytics. Keep the numbers here in sync with
// the constants in gameModel.js, xg.js, playerModel.js and teamMetrics.js.
import {Activity, Chart2, Diagram, Flash, Graph, Hierarchy, Radar, Ranking, Speedometer, Status, Timer1, TrendUp, User} from '../../components/icons';

export const METHOD_SECTIONS = [
    {
        key: 'games',
        title: 'Predicting games',
        intro: 'One model powers every pregame forecast, live win probability and goal value in the app, so the numbers always agree with each other.',
        models: [
            {
                key: 'ratings',
                icon: Ranking,
                title: 'Team ratings',
                plain: [
                    'Every team gets an attack rating (how many goals it scores compared with an average team) and a defence rating (how many it allows).',
                    'Early in the season these are pulled hard toward league average, as if every team had already played 12 extra perfectly average games, so a hot first week doesn’t turn a team into a juggernaut. The pull fades as real games pile up. Home ice is measured from this season’s home and road scoring, also blended with a long-run norm.',
                    'Combine the two teams’ ratings and you get each side’s expected goals for the night.',
                ],
                math: [
                    'attack = (GF + 12 × league rate) / (GP + 12) / league rate   (defence: same with GA)',
                    'league rate = (league GF + 300 × 3.05) / (team games + 300)',
                    'home edge = √(home goal rate / road goal rate), each shrunk toward 3.12 / 2.98',
                    'λ home = league rate × 0.975 × attack(home) × defence(away) × home edge',
                    'λ away = league rate × 0.975 × attack(away) × defence(home) ÷ home edge',
                ],
            },
            {
                key: 'markov',
                icon: Diagram,
                title: 'The game simulator',
                plain: [
                    'Instead of rolling dice thousands of times, Rinkside works out the exact probability of every possible score. It walks through the game in 10-second steps and, in each one, either team might score, with chances that depend on the situation.',
                    'Power plays boost the team with the extra skater and cut the other’s chances. In the last 100 seconds a team down by one or two pulls its goalie, which makes goals much more likely at both ends. And when a game is tied in the third period, both teams tighten up to protect the point for reaching overtime.',
                    'That last effect matters: simple models send about 17% of games to overtime, but the real NHL rate is around 22–24%. Rinkside measures how often games actually go to overtime this season and tunes the tied-late caution until an average matchup matches it.',
                    'Games that reach overtime are settled by the 3-on-3 (a goal in about 60% of them, favouring the stronger attack) or a near coin-flip shootout. In the playoffs it’s sudden death.',
                ],
                math: [
                    'P(goal in a 10 s step) = 1 − e^(−λ × m × 10 / 3600), at most one goal per step',
                    'm: power play × 2.4, short-handed × 0.3; goalie pulled (≤ 100 s, down 1–2): trailing × 2.5, leading × 4.7',
                    'tied in the 3rd: both × k, with k ∈ [0.3, 1.3] found by bisection so P(OT) = league OT rate',
                    'league OT rate = (OT/SO losses + 200 × 0.225) / (games + 200)',
                    'P(home wins OT) = 0.6 × r + 0.4 × (0.5 + 0.2 × (r − 0.5)), r = λh / (λh + λa); playoffs: r',
                ],
            },
            {
                key: 'live',
                icon: Activity,
                title: 'Live win probability',
                plain: [
                    'During a game the same simulator restarts from the current moment: the score, the time left and whether anyone is on the power play. That gives an up-to-the-second win probability and a projected final score (the current score plus the goals each team is still expected to add).',
                    'Once a goal ends overtime the result is certain.',
                ],
                math: [
                    'same chain from (score difference, seconds left, manpower from the NHL situation code)',
                    'a power play is assumed to have 75 s left unless known',
                    'projected final = current score + expected remaining regulation goals',
                ],
            },
            {
                key: 'wpa',
                icon: TrendUp,
                title: 'Win probability added',
                plain: [
                    'How much did a goal matter? Rinkside compares the scoring team’s win probability just before and just after it, at the same moment on the clock. A tying goal late in the third can be worth +30% or more; a fifth goal in a blowout is worth almost nothing.',
                ],
                math: ['WPA = WP(after the goal) − WP(same moment, one goal fewer), from the scorer’s side'],
            },
            {
                key: 'excitement',
                icon: Flash,
                title: 'Excitement index',
                plain: [
                    'A great game is one where the outcome kept changing. The excitement index adds up every move of the win-probability line, up or down. Rinkside also counts how many times the favourite flipped and how low the eventual winner’s chances dropped (the comeback).',
                ],
                math: [
                    'index = Σ |WP(t) − WP(t − 1)| for the home team',
                    '≥ 4 Instant classic · ≥ 2.5 Thriller · ≥ 1.3 Competitive · ≥ 0.7 Steady · otherwise Snoozer',
                    'swings = times WP crossed 50%; comeback = winner’s lowest WP',
                ],
            },
        ],
    },
    {
        key: 'shots',
        title: 'Shot quality',
        intro: 'Goals are rare and noisy. Looking at the quality of every chance tells you more about who played better.',
        models: [
            {
                key: 'xg',
                icon: Radar,
                title: 'Rinkside xG',
                plain: [
                    'Expected goals (xG) is the chance that a shot becomes a goal. Every unblocked attempt in the NHL play-by-play gets a value based on how far out it was, the angle, the type of shot, whether it was a rebound (same team, within 3 seconds) or a rush chance (within 4 seconds of play outside the offensive zone), and the manpower. Shots at an empty net are scored separately.',
                    'An average attempt is worth about 0.065 goals; a tap-in rebound can be worth 0.4 or more.',
                    'Honesty note: this is a lightweight heuristic whose weights follow the shape of published public xG models. It hasn’t been fitted to NHL data, so treat it as a good guide rather than a precise number.',
                ],
                math: [
                    'xG = 1 / (1 + e^(−z)), clamped to 0.005–0.85',
                    'z = −0.85 − 0.058 × distance (ft) − 0.011 × angle (°) + shot type + 0.95 rebound + 0.35 rush + 0.3 power play (−0.15 short-handed)',
                    'shot type: tip-in +0.25, deflection +0.2, snap +0.08, slap +0.05, backhand −0.12, wrap-around −0.55',
                    'empty net: 0.95 − 0.004 × distance, clamped to 0.5–0.95; shootouts excluded',
                ],
            },
            {
                key: 'dtw',
                icon: Chart2,
                title: 'Deserve to win',
                plain: [
                    'If both teams got exactly the same chances again, how often would each one win? Rinkside treats every shot as its own weighted coin flip and works out the exact chances of every goal total for each team (no simulation), then compares them.',
                    'Empty-net shots are left out because they come from the score, not from how the game was played. Ties are split by each team’s share of total xG.',
                ],
                math: [
                    'goals ~ Poisson-binomial(xG₁, xG₂, …), computed exactly by dynamic programming',
                    'P(home deserved) = P(home > away) + P(tie) × xG home / (xG home + xG away)',
                ],
            },
        ],
    },
    {
        key: 'players',
        title: 'Players',
        intro: 'Small samples lie. These models separate how good someone really is from how lucky they’ve been.',
        models: [
            {
                key: 'talent',
                icon: User,
                title: 'True talent (shooting % and save %)',
                plain: [
                    'A forward who scores on 25% of his shots over 20 games probably isn’t a 25% shooter. Rinkside starts from what’s typical for the league, then lets the player’s own shots move the estimate. The more shots, the more the estimate trusts the player.',
                    'How strong the starting point is depends on how much real talent varies. Shooters differ a lot, so about 90 shots (forwards) or 160 (defencemen) carry as much weight as the league average. Goalies are far more alike, so it takes about 2,450 shots, most of a season, before a save percentage says much.',
                    'You also see an 80% range for the true rate, goals saved above an average goalie, and how many goals a shooter is running above or below what their talent suggests.',
                ],
                math: [
                    'prior Beta(α, β) with mean m and talent SD s: α + β = m(1 − m) / s² − 1',
                    'forwards m = .105, s = .032 · defence m = .050, s = .017 · goalies m = .902, s = .006',
                    'estimate = (α + successes) / (α + β + attempts); 80% range = 10th–90th percentile of the posterior Beta',
                    'goals saved above average = saves − shots against × .902 · shooting luck = goals − shots × estimate',
                ],
            },
            {
                key: 'projection',
                icon: Graph,
                title: 'Season projections',
                plain: [
                    'Projections blend a player’s scoring rate so far with a sensible starting rate (as if they’d already played 20 typical games), then add up what to expect over the games that are left. Because nobody knows the exact rate, the range widens to cover both that uncertainty and ordinary game-to-game randomness.',
                    'The range is an 80% interval: the final number should land outside it about one season in five.',
                ],
                math: [
                    'rate ~ Gamma(prior rate × 20, 20) → after GP games with N events: Gamma(α + N, β + GP)',
                    'remaining ~ NegBin(r = α′, p = β′ / (β′ + games left))',
                    'projection = N + (α′ / β′) × games left; 80% range = N + 10th / 90th percentile',
                ],
            },
            {
                key: 'streaks',
                icon: Timer1,
                title: 'Hot and cold streaks',
                plain: [
                    'Is a player’s last 10 games a real hot streak or just noise? Rinkside asks how likely a run at least this extreme would be if the player were performing at their usual rate from the rest of the season. If it would happen less than 10% of the time, it’s flagged hot or cold.',
                    'The form line weights recent games more heavily: each game counts half as much as one five games newer.',
                ],
                math: [
                    'expected = usual rate × 10 (usual rate from the other games, or all games if fewer than 5)',
                    'hot if P(X ≥ actual) < 0.10, cold if P(X ≤ actual) < 0.10, X ~ Poisson(expected)',
                    'form = exponentially weighted average, half-life 5 games',
                ],
            },
        ],
    },
    {
        key: 'teams',
        title: 'Teams and standings',
        intro: 'Standings points tell you what happened. These tell you what is likely to happen next.',
        models: [
            {
                key: 'pythag',
                icon: Speedometer,
                title: 'Pythagorean luck',
                plain: [
                    'Goal differential predicts future results better than the win–loss record. From goals for and against, Rinkside estimates the points a team “should” have; the gap to its real points is luck, often from close games and shootouts. Expect it to shrink.',
                ],
                math: [
                    'expected win share = GF^2.05 / (GF^2.05 + GA^2.05)',
                    'expected points = (expected win share + league points % − 0.5) × 2 × GP; luck = points − expected',
                ],
            },
            {
                key: 'pdo',
                icon: Status,
                title: 'PDO',
                plain: [
                    'Add a team’s shooting percentage to its save percentage. Over time almost every team ends up near 1000, so a team far above it has probably been riding hot shooting or goaltending, and one far below it is likely to bounce back.',
                ],
                math: ['PDO = (goals for / shots for + 1 − goals against / shots against) × 1000, all strengths'],
            },
            {
                key: 'playoff',
                icon: Hierarchy,
                title: 'Playoff line',
                plain: [
                    'Every team’s final points are projected with the same method used for players, starting from a league-average pace (as if 15 average games had already been played). The projected eighth-best total in each conference is the playoff line. Rinkside shows each team’s cushion above or below it and the pace it needs from here to reach it.',
                ],
                math: [
                    'projected points: Gamma-Poisson, prior = league points per game over 15 games',
                    'line = 8th-highest projected total in the conference; cushion = projected − line',
                    'needed per game = (line − points) / games left',
                ],
            },
        ],
    },
];
