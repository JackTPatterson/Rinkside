import React, {memo, useMemo} from 'react';
import {View} from 'react-native';
import {Card, CompareRow, EmptyState, FadeInView, Section} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {num, pct} from '../../utils/format';
import {MatchupHeading} from './common';
import {parseFraction, shotsByPeriod, teamGameStats} from './model';
import PlayoffImpact from './PlayoffImpact';

const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
};

/** Team-vs-team game stats (shots by period, faceoffs, special teams, physical play). */
function StatsTab({header, landing, box, rail, mp, xg, sims}) {
    const {teamColor} = useAppTheme();
    const {home, away} = header;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);

    const stats = useMemo(() => teamGameStats(landing, rail), [landing, rail]);
    const shots = useMemo(() => shotsByPeriod(box, rail), [box, rail]);

    const sog = {
        home: n(stats.sog?.home) ?? home.sog ?? shots.reduce((a, s) => a + s.home, 0),
        away: n(stats.sog?.away) ?? away.sog ?? shots.reduce((a, s) => a + s.away, 0),
    };
    const ppH = parseFraction(stats.powerPlay?.home);
    const ppA = parseFraction(stats.powerPlay?.away);
    const foH = n(stats.faceoffWinningPctg?.home) ?? n(mp?.last?.homeFaceoffWinPercentage);
    const foA = n(stats.faceoffWinningPctg?.away) ?? (foH != null ? 1 - foH : null);
    const oz = n(mp?.last?.homePercentOfEventsInOffensiveZone);
    const mpXH = n(mp?.last?.homeTeamExpectedGoals);
    const mpXA = n(mp?.last?.awayTeamExpectedGoals);
    const row = (label, key, extra) => (stats[key] ? (
        <CompareRow label={label} left={n(stats[key].home) ?? 0} right={n(stats[key].away) ?? 0} leftColor={hc} rightColor={ac} {...extra}/>
    ) : null);

    const hasAny = Object.keys(stats).length || shots.length || home.sog != null;

    return (
        <View>
            <FadeInView>
                <Card>
                    <MatchupHeading home={home.abbrev} away={away.abbrev}/>
                    {!hasAny ? <EmptyState message="Team stats will appear once the game is underway."/> : null}
                    <CompareRow label="Shots on goal" left={sog.home} right={sog.away} leftColor={hc} rightColor={ac}/>
                    {xg ? (
                        <CompareRow
                            label="Expected goals (Rinkside)"
                            left={xg.home.xg}
                            right={xg.away.xg}
                            leftColor={hc}
                            rightColor={ac}
                            format={(v) => num(v, 2)}
                            info="Rinkside’s model estimate of the goals each team ‘should’ have scored from the quality of its unblocked shots. See the xG tab for more."
                        />
                    ) : null}
                    {mpXH != null && mpXA != null ? (
                        <CompareRow
                            label="Expected goals (MoneyPuck)"
                            left={mpXH}
                            right={mpXA}
                            leftColor={hc}
                            rightColor={ac}
                            format={(v) => num(v, 2)}
                            info="MoneyPuck.com’s expected-goals model for this game — the goals each side would score on average from these chances."
                        />
                    ) : null}
                    {foH != null ? (
                        <CompareRow label="Faceoff win %" left={foH} right={foA} leftColor={hc} rightColor={ac} format={(v) => pct(v)}/>
                    ) : null}
                    {oz != null ? (
                        <CompareRow
                            label="Offensive zone share"
                            left={oz}
                            right={1 - oz}
                            leftColor={hc}
                            rightColor={ac}
                            format={(v) => pct(v)}
                            info="Share of the game’s events that happened in each team’s offensive zone (from MoneyPuck.com) — a rough measure of territorial control."
                        />
                    ) : null}
                    {ppH && ppA ? (
                        <CompareRow
                            label={`Power play · ${ppH.made}/${ppH.opps} vs ${ppA.made}/${ppA.opps}`}
                            left={ppH.pct}
                            right={ppA.pct}
                            leftColor={hc}
                            rightColor={ac}
                            format={(v) => pct(v)}
                        />
                    ) : null}
                    {row('Penalty minutes', 'pim', {higherIsBetter: false})}
                    {row('Hits', 'hits')}
                    {row('Blocked shots', 'blockedShots')}
                    {row('Giveaways', 'giveaways', {higherIsBetter: false})}
                    {row('Takeaways', 'takeaways')}
                </Card>
            </FadeInView>
            {!header.final ? <PlayoffImpact sims={sims} header={header}/> : null}
            {shots.length ? (
                <Section title="Shots by period">
                    <Card>
                        {shots.map((s) => (
                            <CompareRow key={s.period} label={s.period} left={s.home} right={s.away} leftColor={hc} rightColor={ac}/>
                        ))}
                    </Card>
                </Section>
            ) : null}
        </View>
    );
}

export default memo(StatsTab);
