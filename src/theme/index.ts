/**
 * Design system — the single source of truth for every colour, font, size,
 * radius and shadow in the app. Screens and components never hardcode a
 * colour or a font size.
 *
 * Static tokens (spacing, radius, sizes, motion, typography) are plain
 * exports. Colours, shadows, the map style and the Paper / navigation themes
 * depend on the active theme (light or dark): read them with `useAppTheme()`
 * or build styles with `makeStyles()` from `@/theme/ThemeProvider`.
 *
 * Aesthetic: heritage museum (terracotta + gold on warm cream; deep warm
 * browns in dark mode, serif titles).
 */
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from 'expo-router';
import type { TextStyle, ViewStyle } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { darkMapStyle, lightMapStyle } from '@/theme/mapStyles';
import type { MapStyleElement } from '@/theme/mapStyles';
import { darkPalette, lightPalette } from '@/theme/palettes';
import type { Palette } from '@/theme/palettes';

export type { ColorToken, Palette } from '@/theme/palettes';
export type ColorScheme = 'light' | 'dark';

// Spacing (4/8pt scale), radius, sizes
// ---------------------------------------------------------------------------

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 8,
  /** Cards. */
  md: 12,
  lg: 16,
  /** Sheets and the home hero. */
  xl: 28,
  pill: 999,
} as const;

export const iconSize = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 40,
  xxl: 56,
  /** Decorative watermark in the Home hero. */
  watermark: 176,
} as const;

export type IconSizeToken = keyof typeof iconSize;

export const layout = {
  /** Minimum comfortable touch target. */
  touchTarget: 48,
  /** Smallest allowed touch target (WCAG 2.5.8 / Apple HIG 44 pt). */
  touchTargetCompact: 44,
  hairline: 1,
  /** Filter / legend chips: at least the compact touch target. */
  chipHeight: 44,
  searchBarHeight: 56,
  tabBarHeight: 64,
  topBarHeight: 56,
  actionBarHeight: 72,
  featuredCardWidth: 248,
  featuredCardHeight: 320,
  listCardImageHeight: 176,
  /** Share of the screen height used by the Details cover photo. */
  detailCoverRatio: 0.42,
  detailCoverMinHeight: 280,
  /** 16:10 preview in the form's photo picker. */
  coverAspectRatio: 16 / 10,
  ornamentWidth: 40,
  ornamentHeight: 3,
  iconBadge: 44,
  /** Space kept clear at the bottom of scroll views for the snackbar. */
  snackbarOffset: 80,
  progressBarHeight: 4,
  /** Gap Paper leaves above an outlined input for its floating label. */
  outlinedInputLabelInset: 6,
  textAreaMinHeight: 128,
  /** Height of the dark fade behind the status bar on the Details cover. */
  coverFadeHeight: 128,
  /** Width of content on very wide screens (tablets, web preview). */
  maxContentWidth: 640,
  /** Dialogs never grow taller than this share of the screen. */
  dialogMaxHeightRatio: 0.6,
  pressedOpacity: 0.86,
  /** Custom map pins: head diameter (normal / selected), rim, pointer, shadow room. */
  pinHead: 30,
  pinHeadSelected: 40,
  pinRimWidth: 2,
  pinPointer: 8,
  pinShadowRoom: 4,
  /** Category swatch (with icon) and count badge on the map legend chips. */
  legendSwatch: 24,
  /** Small map card on the Details screen. */
  mapPreviewHeight: 168,
  /** Diameter and stroke of the Progress tab's completion ring. */
  progressRingSize: 136,
  progressRingStroke: 10,
  /** Gallery page dots in the virtual tour. */
  pageDot: 8,
  pageDotActive: 22,
  /** Thin segments of the virtual tour's step indicator. */
  stepSegmentHeight: 3,
  /** Letter badge (A–D) on a quiz option. */
  optionBadge: 34,
  /** Round emblem on the Welcome screen and the tour's completion step. */
  emblem: 88,
  /** Share of the screen height used by the Welcome photo. */
  welcomePhotoRatio: 0.5,
  /** Space kept clear at the bottom of the Explore list for the add button. */
  fabClearance: 96,
  /** Province completion bars on the Progress tab. */
  meterHeight: 8,
  /** Width of the "Cover" / "Gallery 2" label column on the Photo Credits screen. */
  creditLabelWidth: 84,
  /** Icon box and pulse ring of the narration ("Listen") button. */
  narrationIcon: 28,
  narrationRingWidth: 2,
  /** From this OS font scale on, the Details action buttons stack vertically. */
  stackActionsFontScale: 1.15,
  /** Narrowest the Progress overview text may get before it wraps under the ring. */
  overviewTextMinWidth: 184,
  /** The framed plate on each onboarding slide. */
  onboardingPlate: 184,
  /** Gold ring drawn just inside the onboarding plate. */
  onboardingRingInset: 12,
} as const;

export const motion = {
  fast: 150,
  normal: 250,
  skeletonPulse: 750,
  searchDebounce: 300,
  toast: 3200,
  /** Step-to-step transition in the virtual tour and the quiz. */
  step: 320,
  /** Map camera moves. */
  camera: 600,
  /** How long a custom map marker keeps re-rendering after it changes (then it is frozen). */
  markerSettle: 400,
  /** One beat of the narration button's pulse while it speaks. */
  narrationPulse: 900,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** Family names match the keys passed to `useFonts` in the root layout. */
export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  displaySemiBold: 'PlayfairDisplay_600SemiBold',
  displayItalic: 'PlayfairDisplay_400Regular_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

/** Playfair Display for titles and destination names, Inter for everything else. */
export const typography = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42 },
  detailTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  screenTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36 },
  sectionTitle: { fontFamily: fonts.displaySemiBold, fontSize: 22, lineHeight: 30 },
  cardTitle: { fontFamily: fonts.displaySemiBold, fontSize: 20, lineHeight: 27 },
  cardTitleSmall: { fontFamily: fonts.displaySemiBold, fontSize: 17, lineHeight: 23 },
  tagline: { fontFamily: fonts.displayItalic, fontSize: 16, lineHeight: 24 },
  subtitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22 },
  bodyLarge: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  overline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  tabLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  /** Text inputs: no lineHeight, so the caret stays vertically centred. */
  input: { fontFamily: fonts.body, fontSize: 16 },
  /** Serif initial inside the round province badge. */
  monogram: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  /** Virtual tour: the destination name on the intro plate. */
  exhibitTitle: { fontFamily: fonts.display, fontSize: 38, lineHeight: 46 },
  /** Virtual tour: chapter headings (History, Cultural Significance). */
  chapterTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40 },
  /** Virtual tour: the opening sentence of a chapter, set like a museum label lead. */
  lead: { fontFamily: fonts.displayItalic, fontSize: 20, lineHeight: 31 },
  /** Body text of the tour chapters: a touch larger and airier than bodyLarge. */
  reading: { fontFamily: fonts.body, fontSize: 17, lineHeight: 29 },
  /** The question on a quiz card. */
  question: { fontFamily: fonts.displaySemiBold, fontSize: 24, lineHeight: 32 },
  /** Big numbers: quiz score, progress ring. */
  score: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60 },
  stat: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

/** Largest OS font-scale the layouts are designed to absorb. */
export const maxFontScale = 1.3;

// ---------------------------------------------------------------------------
// react-native-paper (Material Design 3) theme
// ---------------------------------------------------------------------------

type PaperFontVariant = keyof typeof MD3LightTheme.fonts;

/**
 * Map every MD3 type variant onto our two families. Each weight is its own
 * font file, so `fontWeight` is pinned to 400 to stop Android from applying a
 * synthetic bold on top of it.
 */
function buildPaperFonts(): MD3Theme['fonts'] {
  const base = MD3LightTheme.fonts;
  const config: Record<string, object> = {};

  for (const variant of Object.keys(base) as PaperFontVariant[]) {
    const style = base[variant];
    const isDisplay = variant.startsWith('display') || variant.startsWith('headline');
    const isMedium = 'fontWeight' in style && style.fontWeight === '500';
    config[variant] = {
      ...style,
      fontFamily: isDisplay ? fonts.display : isMedium ? fonts.bodyMedium : fonts.body,
      fontWeight: '400',
    };
  }

  return configureFonts({ config });
}

// ---------------------------------------------------------------------------
// Theme-dependent tokens
// ---------------------------------------------------------------------------

export type Elevation = {
  none: ViewStyle;
  card: ViewStyle;
  raised: ViewStyle;
  bar: ViewStyle;
};

/** Soft, warm shadows; deeper on dark surfaces so cards still lift. */
function buildElevation(palette: Palette): Elevation {
  return {
    none: {},
    card: { boxShadow: `0px 2px 10px ${palette.shadow}` },
    raised: { boxShadow: `0px 6px 20px ${palette.shadowStrong}` },
    bar: { boxShadow: `0px -2px 12px ${palette.shadow}` },
  };
}

function buildPaperTheme(colors: Palette, scheme: ColorScheme): MD3Theme {
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark: scheme === 'dark',
    roundness: 4,
    fonts: buildPaperFonts(),
    colors: {
      ...base.colors,
      primary: colors.primary,
      onPrimary: colors.onPrimary,
      primaryContainer: colors.primarySoft,
      onPrimaryContainer: colors.primaryDark,
      secondary: colors.secondaryDark,
      onSecondary: colors.onPrimary,
      secondaryContainer: colors.secondarySoft,
      onSecondaryContainer: colors.ink,
      tertiary: colors.success,
      onTertiary: colors.onPrimary,
      tertiaryContainer: colors.successSoft,
      onTertiaryContainer: colors.success,
      error: colors.error,
      onError: colors.onPrimary,
      errorContainer: colors.errorSoft,
      onErrorContainer: colors.error,
      background: colors.background,
      onBackground: colors.ink,
      surface: colors.surface,
      onSurface: colors.ink,
      surfaceVariant: colors.surfaceMuted,
      onSurfaceVariant: colors.inkSoft,
      outline: colors.outlineStrong,
      outlineVariant: colors.outline,
      shadow: colors.shadowStrong,
      scrim: colors.scrim,
      inverseSurface: colors.ink,
      inverseOnSurface: colors.background,
      inversePrimary: colors.secondary,
      surfaceDisabled: colors.pressed,
      onSurfaceDisabled: colors.muted,
      backdrop: colors.scrim,
      elevation: {
        level0: colors.transparent,
        level1: colors.surface,
        level2: colors.surface,
        level3: colors.surface,
        level4: colors.surface,
        level5: colors.surface,
      },
    },
  };
}

type NavigationTheme = typeof NavigationDefaultTheme;

function buildNavigationTheme(colors: Palette, scheme: ColorScheme): NavigationTheme {
  const base = scheme === 'dark' ? NavigationDarkTheme : NavigationDefaultTheme;
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.outline,
      notification: colors.primary,
    },
  };
}

/** Everything that changes with the theme. */
export type AppTheme = {
  scheme: ColorScheme;
  colors: Palette;
  elevation: Elevation;
  /** Google Maps style JSON for this theme. */
  mapStyle: MapStyleElement[];
  /** expo-status-bar style for content drawn on `colors.background`. */
  statusBarStyle: 'light' | 'dark';
  paper: MD3Theme;
  navigation: NavigationTheme;
};

export function buildTheme(scheme: ColorScheme): AppTheme {
  const colors = scheme === 'dark' ? darkPalette : lightPalette;
  return {
    scheme,
    colors,
    elevation: buildElevation(colors),
    mapStyle: scheme === 'dark' ? darkMapStyle : lightMapStyle,
    statusBarStyle: scheme === 'dark' ? 'light' : 'dark',
    paper: buildPaperTheme(colors, scheme),
    navigation: buildNavigationTheme(colors, scheme),
  };
}

/** Built once; switching themes swaps between these two objects. */
export const THEMES: Record<ColorScheme, AppTheme> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};
