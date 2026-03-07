import { Platform } from 'react-native';

const mono = Platform.OS === 'ios' ? 'Courier' : 'monospace';

export const theme = {
    colors: {
        bgPrimary: '#000000',
        bgSecondary: '#050505',
        bgCard: 'rgba(0, 255, 0, 0.05)',
        accent: '#00ff00',
        accentGlow: '#39ff14',
        textPrimary: '#00ff00',
        textMuted: '#008f11',
        border: '#003300',
        danger: '#ff003c',
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 0,
        md: 2,
        lg: 4,
        full: 9999,
    },
    typography: {
        fontFamily: mono,
        fontFamilyMono: mono,
        h1: { fontSize: 32, fontWeight: '700', color: '#00ff00', fontFamily: mono },
        h2: { fontSize: 24, fontWeight: '600', color: '#00ff00', fontFamily: mono },
        body: { fontSize: 16, color: '#00ff00', fontFamily: mono },
        caption: { fontSize: 12, color: '#008f11', fontFamily: mono },
    }
};
