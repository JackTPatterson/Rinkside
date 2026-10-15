import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowRight2} from '../../components/icons';
import {T, tap} from '../../components/ui';
import {useAppTheme, withAlpha} from '../../theme';

/**
 * One row in a grouped settings list. Pass `first`/`last` to round the group's outer corners,
 * `right` for a trailing value, and `chevron={false}` for action rows.
 */
export function SettingsRow({icon: Icon, iconColor, title, subtitle, right, onPress, first, last, chevron = true, accessibilityHint, destructive}) {
    const {colors} = useAppTheme();
    const tint = destructive ? colors.negative : iconColor ?? colors.text;
    const content = (
        <>
            {Icon ? (
                <View style={[styles.icon, {backgroundColor: withAlpha(tint, 0.12)}]}>
                    <Icon size={18} color={tint}/>
                </View>
            ) : null}
            <View style={styles.text}>
                <T variant="body" color={destructive ? colors.negative : undefined} numberOfLines={1}>{title}</T>
                {subtitle ? <T variant="caption" muted numberOfLines={2}>{subtitle}</T> : null}
            </View>
            {typeof right === 'string' ? <T variant="label" muted numberOfLines={1}>{right}</T> : right}
            {onPress && chevron ? <ArrowRight2 size={16} color={colors.textSecondary}/> : null}
        </>
    );
    const base = [
        styles.row,
        {backgroundColor: colors.card},
        first && styles.first,
        last && styles.last,
        !last && {borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth},
    ];
    if (!onPress) {
        return <View style={base} accessible accessibilityLabel={[title, typeof right === 'string' ? right : null].filter(Boolean).join(', ')}>{content}</View>;
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
            style={({pressed}) => [base, pressed && {backgroundColor: colors.cardAlt}]}>
            {content}
        </Pressable>
    );
}

export function SettingsGroup({children, style}) {
    return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    group: {borderRadius: 16, overflow: 'hidden'},
    row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 56, paddingVertical: 10},
    first: {borderTopLeftRadius: 16, borderTopRightRadius: 16},
    last: {borderBottomLeftRadius: 16, borderBottomRightRadius: 16},
    icon: {width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
    text: {flex: 1, gap: 2},
});
