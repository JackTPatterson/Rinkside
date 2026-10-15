import {DarkTheme as NavDark, DefaultTheme as NavLight} from '@react-navigation/native';
import React, {createContext, useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {getTeam} from '../data/teams';

export const fonts = {
    thin: 'Sora_100Thin',
    light: 'Sora_300Light',
    regular: 'Sora_400Regular',
    medium: 'Sora_500Medium',
    semibold: 'Sora_600SemiBold',
    bold: 'Sora_700Bold',
    extrabold: 'Sora_800ExtraBold',
};

export const spacing = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32};
export const radius = {sm: 8, md: 12, lg: 16, xl: 24, pill: 999};

const palettes = {
    light: {
        background: '#FFFFFF',
        card: '#F4F4F6',
        cardAlt: '#E9E9EC',
        text: '#1C1C1E',
        textSecondary: '#6B6B72',
        border: '#D8D8DC',
        accent: '#007AFF',
        live: '#E5353B',
        positive: '#1E9E5A',
        negative: '#D93A3A',
        warning: '#D98B00',
        overlay: 'rgba(0,0,0,0.4)',
    },
    dark: {
        background: '#010101',
        card: '#151517',
        cardAlt: '#232326',
        text: '#E5E5E7',
        textSecondary: '#9A9AA1',
        border: '#2A2A2D',
        accent: '#0A84FF',
        live: '#FF453A',
        positive: '#32D07A',
        negative: '#FF5A52',
        warning: '#FFB020',
        overlay: 'rgba(0,0,0,0.6)',
    },
};

// Pick black or white text for a background by WCAG contrast ratio.
function luminance(hex) {
    const h = String(hex).replace('#', '');
    if (h.length < 6) return 0;
    const [r, g, b] = [0, 2, 4].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readableOn(hex) {
    const L = luminance(hex);
    const vsWhite = 1.05 / (L + 0.05);
    const vsDark = (L + 0.05) / (luminance('#111111') + 0.05);
    return vsDark > vsWhite ? '#111111' : '#FFFFFF';
}

export function withAlpha(hex, alpha) {
    const h = String(hex).replace('#', '');
    if (h.length !== 6) return hex;
    return `#${h}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

const ThemeContext = createContext(null);

export function ThemeProvider({children}) {
    const scheme = useColorScheme();
    const value = useMemo(() => {
        const dark = scheme === 'dark';
        const colors = palettes[dark ? 'dark' : 'light'];
        const teamColor = (abbrev) => {
            const t = getTeam(abbrev);
            if (!t) return colors.text;
            return dark ? t.dark : t.primary;
        };
        const navigation = {
            ...(dark ? NavDark : NavLight),
            colors: {
                ...(dark ? NavDark : NavLight).colors,
                primary: colors.accent,
                background: colors.background,
                card: colors.background,
                text: colors.text,
                border: colors.border,
                notification: colors.live,
            },
        };
        return {dark, colors, fonts, spacing, radius, teamColor, navigation};
    }, [scheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** {dark, colors, fonts, spacing, radius, teamColor(abbrev), navigation} */
export function useAppTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useAppTheme must be used inside ThemeProvider');
    return ctx;
}
