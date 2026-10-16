import React, {memo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Danger, Lamp} from '../components/icons';
import {BackButton, FadeInView, Header, Screen, Section, T} from '../components/ui';
import {GUTTER, useAppTheme, withAlpha} from '../theme';
import {METHOD_SECTIONS} from './settings/methodology';

const ModelCard = memo(function ModelCard({model}) {
    const {colors} = useAppTheme();
    const Icon = model.icon;
    return (
        <View style={styles.card}>
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
                style={styles.math}>
                <T variant="caption" muted style={styles.mathLabel}>THE MATH</T>
                {model.math.map((line, i) => (
                    <T key={i} variant="caption" style={styles.mathLine} selectable>{line}</T>
                ))}
            </View>
        </View>
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
                    <View style={styles.intro}>
                        <View style={styles.cardHead}>
                            <Lamp size={20} color={colors.warning} variant="Bold"/>
                            <T variant="heading">Estimates, not certainties</T>
                        </View>
                        <T variant="body" muted style={styles.para}>
                            Every probability, projection and “true talent” number in Rinkside comes from a statistical
                            model built on public NHL data. Models are useful because they’re honest about uncertainty:
                            a 70% favourite still loses three games in ten.
                        </T>
                    </View>
                </FadeInView>

                {METHOD_SECTIONS.map((section) => (
                    <Section key={section.key} title={section.title}>
                        <T variant="body" muted style={styles.sectionIntro}>{section.intro}</T>
                        <View style={styles.stack}>
                            {section.models.map((m, i) => (
                                <React.Fragment key={m.key}>
                                    {i > 0 ? <View style={[styles.divider, {backgroundColor: colors.text}]}/> : null}
                                    <ModelCard model={m}/>
                                </React.Fragment>
                            ))}
                        </View>
                    </Section>
                ))}

                <View style={styles.caveat}>
                    <View style={styles.cardHead}>
                        <Danger size={20} color={colors.warning}/>
                        <T variant="heading">Limits worth knowing</T>
                    </View>
                    <T variant="caption" muted style={styles.caveatText}>
                        The game model knows team scoring rates, home ice, manpower and the clock, but not injuries,
                        starting goalies, back-to-backs or trades until they show up in results. Rinkside xG is a
                        lightweight heuristic rather than a model fitted to NHL data. All outputs are model estimates
                        for fun and insight, not betting advice.
                    </T>
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: {flex: 1},
    content: {paddingHorizontal: GUTTER},
    intro: {gap: 10},
    sectionIntro: {marginTop: -4, marginBottom: 10, lineHeight: 25},
    stack: {},
    divider: {height: 2, opacity: 0.2, marginVertical: 10},
    card: {gap: 10},
    cardHead: {flexDirection: 'row', alignItems: 'center', gap: 10},
    icon: {width: 36, height: 36, borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    para: {lineHeight: 25},
    // "The math" follows the plain-English copy directly on the page background (no inset well).
    math: {gap: 6, marginTop: 2},
    mathLabel: {letterSpacing: 1, fontSize: 10},
    mathLine: {lineHeight: 18, fontVariant: ['tabular-nums']},
    caveat: {gap: 10, marginTop: 20},
    caveatText: {fontSize: 14, lineHeight: 20},
});
