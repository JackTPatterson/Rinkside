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

/** Screen side margin used by the original Rinkside layout. */
export const GUTTER = 10;
export const radius = {sm: 8, md: 12, lg: 15, xl: 24, pill: 999};

const palettes = {
    light: {
        background: '#FFFFFF',
        card: '#F7F7F7',
        cardAlt: '#ECECEE',
        text: '#1C1C1E',
        textSecondary: '#6B6B72',
        border: '#D8D8DC',
        accent: '#007AFF',
        live: '#F54242',
        positive: '#1E9E5A',
        negative: '#D93A3A',
        warning: '#D98B00',
        overlay: 'rgba(0,0,0,0.4)',
        // Sheets: iOS secondary grouped grey, with a raised tone for the cards/tracks inside them.
        sheet: '#F2F2F7',
        sheetCard: '#FFFFFF',
        sheetCardAlt: '#E5E5EA',
    },
    dark: {
        background: '#010101',
        card: '#121212',
        cardAlt: '#1F1F21',
        text: '#E5E5E7',
        textSecondary: '#9A9AA1',
        border: '#272729',
        accent: '#0A84FF',
        live: '#F54242',
        positive: '#32D07A',
        negative: '#FF5A52',
        warning: '#FFB020',
        overlay: 'rgba(0,0,0,0.6)',
        sheet: '#1C1C1E',
        sheetCard: '#2C2C2E',
        sheetCardAlt: '#3A3A3C',
    },
};

// Relative luminance → pick black or white text for a background.
export function readableOn(hex) {
    const h = String(hex).replace('#', '');
    if (h.length < 6) return '#FFFFFF';
    const [r, g, b] = [0, 2, 4].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.4 ? '#111111' : '#FFFFFF';
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

/**
 * Wraps sheet content: inside it `colors.background` is the sheet grey and cards/tracks use the
 * raised tones, so components written for the black page stay visible on the grey sheet.
 */
export function SheetSurface({children}) {
    const ctx = useContext(ThemeContext);
    const value = useMemo(() => {
        const c = ctx.colors;
        return {...ctx, colors: {...c, background: c.sheet, card: c.sheetCard, cardAlt: c.sheetCardAlt, border: c.sheetCardAlt}};
    }, [ctx]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** {dark, colors, fonts, spacing, radius, teamColor(abbrev), navigation} */
export function useAppTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useAppTheme must be used inside ThemeProvider');
    return ctx;
}
