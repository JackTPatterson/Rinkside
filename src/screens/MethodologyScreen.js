import React, {memo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Danger, Lamp} from '../components/icons';
import {BackButton, Card, FadeInView, Header, Screen, Section, T} from '../components/ui';
import {useAppTheme, withAlpha} from '../theme';
import {METHOD_SECTIONS} from './settings/methodology';

const ModelCard = memo(function ModelCard({model}) {
    const {colors} = useAppTheme();
    const Icon = model.icon;
    return (
        <Card style={styles.card}>
            <View style={styles.cardHead}>
                <View style={[styles.icon, {backgroundColor: withAlpha(colors.accent, 0.12)}]}>
                    <Icon size={18} color={colors.accent}/>
                </View>
                <T variant="heading" accessibilityRole="header" style={styles.flex}>{model.title}</T>
            </View>
            {model.plain.map((p, i) => (
                <T key={i} variant="body" style={styles.para}>{p}</T>
            ))}
            <View
                accessible
                accessibilityLabel={`The math. ${model.math.join('. ')}`}
                style={[styles.math, {backgroundColor: colors.cardAlt, borderLeftColor: colors.accent}]}>
                <T variant="caption" muted style={styles.mathLabel}>THE MATH</T>
                {model.math.map((line, i) => (
                    <T key={i} variant="caption" style={styles.mathLine} selectable>{line}</T>
                ))}
            </View>
        </Card>
    );
});

export default function MethodologyScreen({navigation}) {
    const {colors} = useAppTheme();
    const insets = useSafeAreaInsets();
    return (
        <Screen>
            <Header title="How the models work" subtitle="Plain English first, then the math" left={<BackButton onPress={() => navigation.goBack()}/>}/>
            <ScrollView contentContainerStyle={[styles.content, {paddingBottom: 32 + insets.bottom}]} showsVerticalScrollIndicator={false}>
                <FadeInView>
                    <Card style={styles.intro}>
                        <View style={styles.cardHead}>
                            <Lamp size={20} color={colors.warning} variant="Bold"/>
                            <T variant="label">Estimates, not certainties</T>
                        </View>
                        <T variant="body" muted>
                            Every probability, projection and “true talent” number in Rinkside comes from a statistical
                            model built on public NHL data. Models are useful because they’re honest about uncertainty:
                            a 70% favourite still loses three games in ten.
                        </T>
                    </Card>
                </FadeInView>

                {METHOD_SECTIONS.map((section) => (
                    <Section key={section.key} title={section.title}>
                        <T variant="body" muted style={styles.sectionIntro}>{section.intro}</T>
                        <View style={styles.stack}>
                            {section.models.map((m) => <ModelCard key={m.key} model={m}/>)}
                        </View>
                    </Section>
                ))}

                <Card style={[styles.caveat, {backgroundColor: withAlpha(colors.warning, 0.1)}]}>
                    <View style={styles.cardHead}>
                        <Danger size={18} color={colors.warning}/>
                        <T variant="label">Limits worth knowing</T>
                    </View>
                    <T variant="caption" muted>
                        The game model knows team scoring rates, home ice, manpower and the clock, but not injuries,
                        starting goalies, back-to-backs or trades until they show up in results. Rinkside xG is a
                        lightweight heuristic rather than a model fitted to NHL data. All outputs are model estimates
                        for fun and insight, not betting advice.
                    </T>
                </Card>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    content: {paddingHorizontal: 16},
    intro: {gap: 8, padding: 16},
    sectionIntro: {marginTop: -4, marginBottom: 12},
    stack: {gap: 12},
    card: {gap: 10, padding: 16},
    cardHead: {flexDirection: 'row', alignItems: 'center', gap: 10},
    icon: {width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
    para: {lineHeight: 22},
    math: {borderLeftWidth: 3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 6, marginTop: 2},
    mathLabel: {letterSpacing: 1, fontSize: 10},
    mathLine: {lineHeight: 18, fontVariant: ['tabular-nums']},
    caveat: {gap: 8, marginTop: 24, padding: 16},
});
