import React, {memo, useMemo, useState} from 'react';
import {View} from 'react-native';
import {Card, Row, Section, Segmented, SplitBar, T} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {pct, signed} from '../../utils/format';
import {playoffImpact} from './model';

const ImpactRow = memo(function ImpactRow({label, home, away, homeColor, awayColor}) {
    const {colors} = useAppTheme();
    return (
        <View style={{marginBottom: 14}}>
            <Row style={{justifyContent: 'space-between', marginBottom: 6}}>
                <T variant="label" color={homeColor}>{pct(home)}</T>
                <T variant="caption" muted>{label}</T>
                <T variant="label" color={awayColor}>{pct(away)}</T>
            </Row>
            <Row gap={4}>
                <SplitBar left={1 - (home ?? 0)} leftColor={colors.cardAlt} rightColor={homeColor} height={6} style={{flex: 1}}/>
                <SplitBar left={away ?? 0} leftColor={awayColor} rightColor={colors.cardAlt} height={6} style={{flex: 1}}/>
            </Row>
        </View>
    );
});

/** MoneyPuck season simulations: how a win or a loss tonight moves each team's odds. */
function PlayoffImpact({sims, header}) {
    const {teamColor} = useAppTheme();
    const [scenario, setScenario] = useState('REG');
    const {home, away} = header;
    const impact = useMemo(() => playoffImpact(sims, home.abbrev, away.abbrev, scenario), [sims, home.abbrev, away.abbrev, scenario]);
    if (!impact) return null;
    const hc = teamColor(home.abbrev);
    const ac = teamColor(away.abbrev);
    const swingH = impact.home.win - impact.home.loss;
    const swingA = impact.away.win - impact.away.loss;
    return (
        <Section
            title="What’s at stake"
            info="MoneyPuck.com simulates the rest of the season thousands of times. These are each team’s odds to reach the next stage if they win or lose tonight, in regulation or in overtime/shootout. Model estimates.">
            <Card>
                <Segmented
                    options={[{key: 'REG', label: 'Regulation'}, {key: 'OT', label: 'OT / Shootout'}]}
                    value={scenario}
                    onChange={setScenario}
                    style={{marginBottom: 14}}
                />
                <T variant="label" muted style={{textAlign: 'center', marginBottom: 10}}>{impact.label}</T>
                <ImpactRow label="With a win" home={impact.home.win} away={impact.away.win} homeColor={hc} awayColor={ac}/>
                <ImpactRow label="With a loss" home={impact.home.loss} away={impact.away.loss} homeColor={hc} awayColor={ac}/>
                <T variant="caption" muted>
                    Swing: {home.abbrev} {signed(swingH * 100, 0)} pts · {away.abbrev} {signed(swingA * 100, 0)} pts
                    {Math.max(Math.abs(swingH), Math.abs(swingA)) >= 0.05 ? ' — a big one.' : ''}
                </T>
            </Card>
        </Section>
    );
}

export default memo(PlayoffImpact);
