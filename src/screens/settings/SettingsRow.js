import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowRight} from '../../components/icons';
import {T, tap} from '../../components/ui';
import {useAppTheme} from '../../theme';

/**
 * One settings row in the original Rinkside look: no card, a plain text-coloured icon, a 20pt SemiBold
 * title and, for navigation rows, the round arrow button on colors.card. Rows sit 20px apart.
 * `first`/`last`/`iconColor` are accepted for API compatibility and ignored.
 * `right` is a trailing value, and `chevron={false}` hides the arrow for action rows.
 */
export function SettingsRow({icon: Icon, title, subtitle, right, onPress, chevron = true, accessibilityHint, destructive}) {
    const {colors} = useAppTheme();
    const tint = destructive ? colors.negative : colors.text;
    const content = (
        <>
            <View style={styles.left}>
                {Icon ? <Icon size={24} color={tint}/> : null}
                <View style={styles.text}>
                    <T variant="body" color={tint} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.title}>{title}</T>
                    {subtitle ? <T variant="caption" muted numberOfLines={2}>{subtitle}</T> : null}
                </View>
            </View>
            {typeof right === 'string' ? <T variant="body" muted numberOfLines={1} style={styles.right}>{right}</T> : right}
            {onPress && chevron ? (
                <View style={[styles.arrow, {backgroundColor: colors.card}]}>
                    <ArrowRight size={24} color={colors.text}/>
                </View>
            ) : null}
        </>
    );
    if (!onPress) {
        return <View style={styles.row} accessible accessibilityLabel={[title, typeof right === 'string' ? right : null].filter(Boolean).join(', ')}>{content}</View>;
    }
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={accessibilityHint}
            onPress={() => {
                tap();
                onPress();
            }}
            style={({pressed}) => [styles.row, pressed && styles.pressed]}>
            {content}
        </Pressable>
    );
}

export function SettingsGroup({children, style}) {
    return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    group: {gap: 20},
    row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 44},
    left: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10},
    text: {flex: 1},
    title: {fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 26},
    right: {fontSize: 14},
    arrow: {width: 44, height: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center'},
    pressed: {opacity: 0.6},
});
