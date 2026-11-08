/** Colors and spacing from the Agri-Copra prototype (light, green accent). */
export const colors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  muted: '#F4F5F4', // input fields, chips
  border: '#ECEEEC',
  text: '#161816',
  textMuted: '#6B706B',
  textFaint: '#9A9F9A',
  green: '#4CB050', // accent: lines, active tab, buttons
  greenDark: '#2F7D33', // green text on light backgrounds
  greenSoft: '#E5F5E4', // active pill, badges
  greenFaint: 'rgba(76, 176, 80, 0.12)', // chart fill, error band
  red: '#D64545',
  redSoft: '#FCE8E8',
  amber: '#B7791F',
  amberSoft: '#FDF3E1',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
