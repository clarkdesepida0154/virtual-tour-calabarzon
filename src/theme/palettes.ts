/**
 * The two colour palettes. Both have exactly the same keys (the `Palette`
 * type enforces it), so every component works in either theme.
 *
 * Light is the original heritage-museum palette (terracotta + gold on warm
 * cream). Dark keeps the same identity on deep, warm browns — never pure
 * black — with terracotta and gold lifted so they stay readable on dark
 * surfaces. On dark, filled buttons turn light terracotta with dark text
 * (`onPrimary`), as in Material 3.
 *
 * Some tokens are DESIGN CONSTANTS and are identical in both palettes:
 *   - the virtual tour's "gallery wall" (`exhibit`, `onExhibit*`, `glass`);
 *   - text and scrims over photographs (`onPhoto*`, `photoShade*`).
 *
 * Pure: no React Native imports.
 */

export type Palette = {
  /** Terracotta — brand, links, icons, selected states, filled buttons. */
  primary: string;
  /** Text / icons on `primarySoft`, and pressed states. */
  primaryDark: string;
  primarySoft: string;
  /** Text and icons on a `primary` fill. */
  onPrimary: string;

  /** Heritage gold — accents, ornaments. */
  secondary: string;
  /** Gold that is readable as text on the page background. */
  secondaryDark: string;
  secondarySoft: string;

  background: string;
  surface: string;
  surfaceMuted: string;

  ink: string;
  inkSoft: string;
  muted: string;

  outline: string;
  outlineStrong: string;

  success: string;
  successSoft: string;
  error: string;
  errorSoft: string;

  /** Home hero band: a deep terracotta field with white type. */
  heroBackground: string;
  heroWatermark: string;
  /** Gold overline on the hero band. */
  heroAccent: string;

  /** Text and icons over photographs and the exhibit wall (always white). */
  onPhoto: string;
  onPhotoMuted: string;

  /** Overlays. */
  scrim: string;
  photoShadeNone: string;
  photoShadeSoft: string;
  photoShadeStrong: string;
  pressed: string;

  /** The dark "gallery wall" of the virtual tour — the same in both themes. */
  exhibit: string;
  onExhibitSoft: string;
  onExhibitFaint: string;
  glass: string;

  /** Map pins and legend dots: one clearly different hue per category. */
  categoryHistorical: string;
  categoryChurch: string;
  categoryMuseum: string;
  categoryNature: string;
  categoryHeritage: string;
  /** Rim around a map pin, so it separates from the base map. */
  pinRim: string;

  /** Soft shadows (CSS box-shadow colour). */
  shadow: string;
  shadowStrong: string;

  transparent: string;
};

/** Design constants shared by both palettes. */
const CONSTANTS = {
  onPhoto: '#FFFFFF',
  onPhotoMuted: 'rgba(255, 255, 255, 0.86)',
  photoShadeNone: 'rgba(28, 22, 18, 0)',
  photoShadeSoft: 'rgba(28, 22, 18, 0.45)',
  photoShadeStrong: 'rgba(28, 22, 18, 0.88)',
  exhibit: '#1C1814',
  onExhibitSoft: 'rgba(255, 255, 255, 0.72)',
  onExhibitFaint: 'rgba(255, 255, 255, 0.32)',
  glass: 'rgba(28, 24, 20, 0.48)',
  transparent: 'transparent',
} as const;

export const lightPalette: Palette = {
  ...CONSTANTS,
  primary: '#9A3B26',
  primaryDark: '#7A2D1C',
  primarySoft: '#F5E4DD',
  onPrimary: '#FFFFFF',

  secondary: '#C9A227',
  secondaryDark: '#7A600E',
  secondarySoft: '#F8F1DA',

  background: '#FAF6EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EADC',

  ink: '#2A2420',
  inkSoft: '#5C5149',
  muted: '#6E655D',

  outline: '#E8DFD0',
  outlineStrong: '#CFC3B1',

  success: '#2F5D46',
  successSoft: '#DFEBE3',
  error: '#B3261E',
  errorSoft: '#FBE9E7',

  heroBackground: '#9A3B26',
  heroWatermark: '#7A2D1C',
  heroAccent: '#F3D88C',

  scrim: 'rgba(42, 36, 32, 0.55)',
  pressed: 'rgba(42, 36, 32, 0.08)',

  categoryHistorical: '#9A3B26',
  categoryChurch: '#6B4E8C',
  categoryMuseum: '#B08A14',
  categoryNature: '#2F5D46',
  categoryHeritage: '#2E6C8E',
  pinRim: '#FFFFFF',

  shadow: 'rgba(42, 36, 32, 0.08)',
  shadowStrong: 'rgba(42, 36, 32, 0.16)',
};

export const darkPalette: Palette = {
  ...CONSTANTS,
  primary: '#E8957C',
  primaryDark: '#F4B9A6',
  primarySoft: '#3D231A',
  onPrimary: '#2A120B',

  secondary: '#D8B550',
  secondaryDark: '#E6C86E',
  secondarySoft: '#342B17',

  background: '#16110E',
  surface: '#221B17',
  surfaceMuted: '#2D2520',

  ink: '#F2EAE0',
  inkSoft: '#CDBFB2',
  muted: '#A99D92',

  outline: '#3A302A',
  outlineStrong: '#5A4C43',

  success: '#8CC7A6',
  successSoft: '#1D3328',
  error: '#F2A49B',
  errorSoft: '#3E1F1B',

  heroBackground: '#5C2618',
  heroWatermark: '#4A1C11',
  heroAccent: '#E9C870',

  scrim: 'rgba(0, 0, 0, 0.62)',
  pressed: 'rgba(255, 255, 255, 0.08)',

  categoryHistorical: '#E0876D',
  categoryChurch: '#B196D6',
  categoryMuseum: '#D8B550',
  categoryNature: '#74B793',
  categoryHeritage: '#72AED0',
  pinRim: '#16110E',

  shadow: 'rgba(0, 0, 0, 0.35)',
  shadowStrong: 'rgba(0, 0, 0, 0.55)',
};

export type ColorToken = keyof Palette;

/** The light palette before the Run 5 accessibility audit, kept for the report and tests. */
export const LIGHT_BEFORE_AUDIT = {
  muted: '#8A8178',
  secondaryDark: '#8A6D10',
  heroAccent: '#C9A227',
  categoryMuseum: '#C9A227',
} as const;
