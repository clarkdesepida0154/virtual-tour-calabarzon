/**
 * Design system — the single source of truth for every colour, font, size,
 * radius and shadow in the app. Screens and components import tokens from
 * here; nothing else may hardcode a colour or a font size.
 *
 * Aesthetic: heritage museum (terracotta + gold on warm cream, serif titles).
 * Light theme only.
 */
import { DefaultTheme as NavigationDefaultTheme } from 'expo-router';
import type { TextStyle, ViewStyle } from 'react-native';
import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export const colors = {
  /** Terracotta — brand, primary actions, selected states. */
  primary: '#9A3B26',
  primaryDark: '#7A2D1C',
  primarySoft: '#F5E4DD',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255, 255, 255, 0.84)',

  /** Heritage gold — accents, ornaments, category marks. */
  secondary: '#C9A227',
  secondaryDark: '#8A6D10',
  secondarySoft: '#F8F1DA',

  /** Warm cream page, white cards. */
  background: '#FAF6EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EADC',

  /** Text. */
  ink: '#2A2420',
  inkSoft: '#5C5149',
  muted: '#8A8178',

  /** Lines. */
  outline: '#E8DFD0',
  outlineStrong: '#CFC3B1',

  /** Feedback. */
  success: '#2F5D46',
  successSoft: '#DFEBE3',
  error: '#B3261E',
  errorSoft: '#FBE9E7',

  /** Overlays on photos. */
  scrim: 'rgba(42, 36, 32, 0.55)',
  photoShadeNone: 'rgba(42, 36, 32, 0)',
  photoShadeSoft: 'rgba(42, 36, 32, 0.45)',
  photoShadeStrong: 'rgba(42, 36, 32, 0.88)',
  pressed: 'rgba(42, 36, 32, 0.08)',

  /** The dark "gallery wall" behind full-bleed photos in the virtual tour. */
  exhibit: '#1C1814',
  onExhibitSoft: 'rgba(255, 255, 255, 0.64)',
  onExhibitFaint: 'rgba(255, 255, 255, 0.32)',
  /** Frosted round buttons laid over photos. */
  glass: 'rgba(28, 24, 20, 0.48)',

  /**
   * One colour per destination category, for map pins and the map legend.
   * Each sits on a clearly different hue, because Google Maps tints its
   * default pins by hue only.
   */
  categoryHistorical: '#9A3B26',
  categoryChurch: '#6B4E8C',
  categoryMuseum: '#C9A227',
  categoryNature: '#2F5D46',
  categoryHeritage: '#2E6C8E',

  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

// ---------------------------------------------------------------------------
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
  hairline: 1,
  chipHeight: 38,
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
} as const;

// ---------------------------------------------------------------------------
// Elevation (soft, warm shadows)
// ---------------------------------------------------------------------------

export const elevation = {
  none: {},
  card: { boxShadow: '0px 2px 10px rgba(42, 36, 32, 0.08)' },
  raised: { boxShadow: '0px 6px 20px rgba(42, 36, 32, 0.14)' },
  bar: { boxShadow: '0px -2px 12px rgba(42, 36, 32, 0.08)' },
} satisfies Record<string, ViewStyle>;

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
// Google Maps style (Android): warm, quiet base map so the pins carry colour
// ---------------------------------------------------------------------------

export const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#F2EADC' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5C5149' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FAF6EF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E8DFD0' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#CFC3B1' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#8A6D10' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EDE4D3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8D9DE' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5B7C86' }] },
];

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

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  dark: false,
  roundness: 4,
  fonts: buildPaperFonts(),
  colors: {
    ...MD3LightTheme.colors,
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
    shadow: colors.ink,
    scrim: colors.ink,
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

// ---------------------------------------------------------------------------
// Navigation theme (expo-router / React Navigation)
// ---------------------------------------------------------------------------

export const navigationTheme: typeof NavigationDefaultTheme = {
  ...NavigationDefaultTheme,
  dark: false,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.outline,
    notification: colors.primary,
  },
};
