/**
 * Every foreground / background token pair that carries text or an essential
 * icon somewhere in the app, with the WCAG AA level it must meet. The unit
 * tests check these in BOTH palettes, so a new token value cannot quietly
 * break readability. Pure.
 */
import { AA_LARGE, AA_TEXT } from '@/theme/contrast';
import type { ColorToken } from '@/theme/palettes';

export type ContrastPair = {
  fg: ColorToken;
  bg: ColorToken;
  min: number;
  where: string;
};

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: 'ink', bg: 'background', min: AA_TEXT, where: 'body text on the page' },
  { fg: 'ink', bg: 'surface', min: AA_TEXT, where: 'body text on cards' },
  { fg: 'inkSoft', bg: 'background', min: AA_TEXT, where: 'secondary text on the page' },
  { fg: 'inkSoft', bg: 'surface', min: AA_TEXT, where: 'secondary text on cards' },
  { fg: 'inkSoft', bg: 'surfaceMuted', min: AA_TEXT, where: 'text on muted tiles' },
  { fg: 'muted', bg: 'background', min: AA_TEXT, where: 'captions, credits on the page' },
  { fg: 'muted', bg: 'surface', min: AA_TEXT, where: 'captions on cards' },
  { fg: 'primary', bg: 'background', min: AA_TEXT, where: 'text links, icons on the page' },
  { fg: 'primary', bg: 'surface', min: AA_TEXT, where: 'text links on cards' },
  { fg: 'onPrimary', bg: 'primary', min: AA_TEXT, where: 'filled buttons, selected chips, FAB' },
  { fg: 'primaryDark', bg: 'primarySoft', min: AA_TEXT, where: 'terracotta badges, wrong-answer text' },
  { fg: 'secondaryDark', bg: 'background', min: AA_TEXT, where: 'gold overlines on the page' },
  { fg: 'secondaryDark', bg: 'surface', min: AA_TEXT, where: 'gold overlines on cards' },
  { fg: 'secondaryDark', bg: 'secondarySoft', min: AA_TEXT, where: 'gold badges' },
  { fg: 'success', bg: 'successSoft', min: AA_TEXT, where: 'Visited badge, correct answer' },
  { fg: 'success', bg: 'surface', min: AA_TEXT, where: 'success text on cards' },
  { fg: 'onPrimary', bg: 'success', min: AA_TEXT, where: 'correct-answer letter badge' },
  { fg: 'error', bg: 'errorSoft', min: AA_TEXT, where: 'error banners' },
  { fg: 'error', bg: 'background', min: AA_TEXT, where: 'field errors' },
  { fg: 'onPhoto', bg: 'heroBackground', min: AA_TEXT, where: 'Home hero title' },
  { fg: 'onPhotoMuted', bg: 'heroBackground', min: AA_TEXT, where: 'Home hero tagline' },
  { fg: 'heroAccent', bg: 'heroBackground', min: AA_TEXT, where: 'Home hero overline' },
  { fg: 'onPhoto', bg: 'exhibit', min: AA_TEXT, where: 'tour titles on the gallery wall' },
  { fg: 'onParchment', bg: 'parchment', min: AA_TEXT, where: 'certificate text' },
  { fg: 'onParchmentSoft', bg: 'parchment', min: AA_TEXT, where: 'certificate secondary lines' },
  { fg: 'parchmentGold', bg: 'parchment', min: AA_TEXT, where: 'certificate gold overline and date' },
  { fg: 'onParchment', bg: 'parchmentDeep', min: AA_TEXT, where: 'certificate text on the deeper border band' },
  { fg: 'onExhibitSoft', bg: 'exhibit', min: AA_TEXT, where: 'tour body text on the gallery wall' },
  { fg: 'secondary', bg: 'exhibit', min: AA_TEXT, where: 'gold overline on the gallery wall' },
  { fg: 'onPhoto', bg: 'photoShadeStrong', min: AA_TEXT, where: 'text over a darkened photo' },
  { fg: 'outlineStrong', bg: 'background', min: 1.5, where: 'decorative outlines (non-text)' },
  { fg: 'categoryHistorical', bg: 'surface', min: AA_LARGE, where: 'legend dot / pin (graphic)' },
  { fg: 'categoryChurch', bg: 'surface', min: AA_LARGE, where: 'legend dot / pin (graphic)' },
  { fg: 'categoryMuseum', bg: 'surface', min: AA_LARGE, where: 'legend dot / pin (graphic)' },
  { fg: 'categoryNature', bg: 'surface', min: AA_LARGE, where: 'legend dot / pin (graphic)' },
  { fg: 'categoryHeritage', bg: 'surface', min: AA_LARGE, where: 'legend dot / pin (graphic)' },
];
