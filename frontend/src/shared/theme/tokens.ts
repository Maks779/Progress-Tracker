/** Design tokens from the Figma file (design system "Ember"). Names follow the Figma variables. */

export type Palette = {
  bg: { base: string; surface: string; surfaceRaised: string };
  border: { default: string };
  text: { primary: string; muted: string };
  accent: { fill: string; fillPressed: string; onFill: string; text: string; subtle: string };
  state: { success: string; warning: string; error: string };
  tracker: { strength: string; cardio: string; reading: string; general: string };
};

export const palettes: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: { base: '#0B0D0C', surface: '#141816', surfaceRaised: '#1B201E' },
    border: { default: '#232826' },
    text: { primary: '#F4F6F5', muted: '#8B938F' },
    accent: {
      fill: '#FF5A36',
      fillPressed: '#E84A27',
      onFill: '#0B0D0C',
      text: '#FF5A36',
      subtle: '#2A1812',
    },
    state: { success: '#3DD68C', warning: '#F5B73B', error: '#F0405E' },
    tracker: { strength: '#FF5A36', cardio: '#4DA3FF', reading: '#9B7BFF', general: '#3FC9B5' },
  },
  light: {
    bg: { base: '#FAFAF7', surface: '#FFFFFF', surfaceRaised: '#F3F3EF' },
    border: { default: '#E7E7E2' },
    text: { primary: '#0B0D0C', muted: '#6B716E' },
    accent: {
      fill: '#FF5A36',
      fillPressed: '#E84A27',
      onFill: '#0B0D0C',
      text: '#D93A14',
      subtle: '#FFEDE7',
    },
    state: { success: '#1F9D5C', warning: '#B7791F', error: '#D12B4A' },
    tracker: { strength: '#D93A14', cardio: '#1F6FD1', reading: '#6B4FD6', general: '#1A9A88' },
  },
};

export const space = { 0: 0, 4: 4, 8: 8, 16: 16, 24: 24, 32: 32, 40: 40, 48: 48, 64: 64 } as const;

export const radius = { 8: 8, 12: 12, 16: 16, 24: 24, full: 999 } as const;

/** Each Inter weight is its own font family: Android ignores fontWeight for loaded fonts. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

const style = (fontFamily: string, fontSize: number, lineHeight: number) => ({
  fontFamily,
  fontSize,
  lineHeight,
});

export const typography = {
  display: style(fonts.semibold, 40, 44),
  h1: style(fonts.semibold, 28, 34),
  h2: style(fonts.semibold, 22, 28),
  h3: style(fonts.semibold, 18, 24),
  body: style(fonts.regular, 16, 24),
  bodyStrong: style(fonts.semibold, 16, 24),
  small: style(fonts.regular, 14, 20),
  smallStrong: style(fonts.semibold, 14, 20),
  caption: style(fonts.regular, 12, 16),
  captionStrong: style(fonts.semibold, 12, 16),
} as const;

export type TypographyVariant = keyof typeof typography;

export const controlHeight = { regular: 48, compact: 44 } as const;
