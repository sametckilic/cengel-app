export const palette = {
  surface: '#FDF8F8',
  surfaceDim: '#DDD9D8',
  surfaceBright: '#FDF8F8',
  surfaceLowest: '#FFFFFF',
  surfaceLow: '#F7F3F2',
  surfaceContainer: '#F1EDEC',
  surfaceHigh: '#EBE7E6',
  surfaceHighest: '#E5E2E1',
  paper: '#F9F7F2',
  ink: '#1A1A1A',
  primary: '#000000',
  onPrimary: '#FFFFFF',
  secondary: '#255DAD',
  accentRed: '#E63946',
  selectionBlue: '#E6F0FA',
  cellLocked: '#F1EFE9',
  outline: '#747878',
  outlineVariant: '#C4C7C7',
  onSurfaceVariant: '#444748',
  mutedInk: '#868382',
  gridLine: 'rgba(26, 26, 26, 0.15)',
  gridLineSoft: 'rgba(26, 26, 26, 0.075)',
  onSurface: '#1C1B1B',
  inverseSurface: '#313030',
  inverseOnSurface: '#F4F0EF',
  surfaceTint: '#5F5E5E',
  primaryContainer: '#1C1B1B',
  onPrimaryContainer: '#858383',
  inversePrimary: '#C8C6C5',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#79A9FD',
  onSecondaryContainer: '#003C7E',
  tertiary: '#000000',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#1C1B1A',
  onTertiaryContainer: '#868382',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',
  primaryFixed: '#E5E2E1',
  primaryFixedDim: '#C8C6C5',
  onPrimaryFixed: '#1C1B1B',
  onPrimaryFixedVariant: '#474746',
  secondaryFixed: '#D7E2FF',
  secondaryFixedDim: '#ABC7FF',
  onSecondaryFixed: '#001B3F',
  onSecondaryFixedVariant: '#00458F',
  tertiaryFixed: '#E6E2DF',
  tertiaryFixedDim: '#CAC6C4',
  onTertiaryFixed: '#1C1B1A',
  onTertiaryFixedVariant: '#484645',
  background: '#FDF8F8',
  onBackground: '#1C1B1B',
  surfaceVariant: '#E5E2E1',
} as const;

export const spacing = {
  page: 24,
  section: 32,
  tight: 8,
  grid: 1,
  cell: 4,
} as const;

export const fonts = {
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
  playfairRegular: 'PlayfairDisplay_400Regular',
  playfairBold: 'PlayfairDisplay_700Bold',
} as const;

export const typography = {
  headlineLg: { fontFamily: fonts.playfairBold, fontSize: 32, lineHeight: 40 },
  headlineMd: { fontFamily: fonts.playfairBold, fontSize: 24, lineHeight: 32 },
  clueBar: {
    fontFamily: fonts.interMedium,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
  },
  bodyClue: { fontFamily: fonts.interRegular, fontSize: 14, lineHeight: 20 },
  gridInput: { fontFamily: fonts.interSemiBold, fontSize: 20, lineHeight: 24 },
  gridHint: {
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 11,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  },
} as const;

export const layout = { maxContent: 576, maxDetail: 672, maxGrid: 600 } as const;

export const radii = {
  functional: 0,
  tertiary: 4,
} as const;

export const borders = {
  hairline: 1,
  activeCell: 2,
} as const;
