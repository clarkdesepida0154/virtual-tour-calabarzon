/**
 * WCAG 2.x contrast maths for the design tokens. Pure — used by the unit
 * tests (and the token audit) to keep both palettes readable.
 */

type Rgb = { r: number; g: number; b: number; a: number };

/** Parses `#RGB`, `#RRGGBB` or `rgba(r, g, b, a)`. */
export function parseColor(value: string): Rgb {
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  }
  throw new Error(`Unsupported colour: ${value}`);
}

/** Composites a (possibly translucent) colour over an opaque background. */
export function flatten(foreground: string, background: string): Rgb {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio (1–21) of text `foreground` on `background`. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(flatten(foreground, background));
  const bg = relativeLuminance(parseColor(background));
  const [light, dark] = fg > bg ? [fg, bg] : [bg, fg];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA: 4.5:1 for normal text, 3:1 for large text (≥ 18.66 px bold / 24 px) and UI parts. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;
