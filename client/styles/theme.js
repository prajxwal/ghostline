export const theme = {
    colors: {
        bgPrimary: '#0a0a0f',
        bgSecondary: '#12121a',
        bgCard: 'rgba(255, 255, 255, 0.03)',
        accent: '#7c5cfc',
        accentGlow: '#a78bfa',
        textPrimary: '#e4e4e7',
        textMuted: '#71717a',
        border: 'rgba(255, 255, 255, 0.06)',
        danger: '#ef4444',
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
        sm: 6,
        md: 12,
        lg: 20,
        full: 9999,
    },
    typography: {
        // using system fonts since we aren't loading custom fonts yet, 
        // but these mimic Inter / JetBrains Mono vibes
        fontFamily: 'System',
        fontFamilyMono: 'monospace',
        h1: { fontSize: 32, fontWeight: '700', color: '#e4e4e7' },
        h2: { fontSize: 24, fontWeight: '600', color: '#e4e4e7' },
        body: { fontSize: 16, color: '#e4e4e7' },
        caption: { fontSize: 12, color: '#71717a' },
    }
};
