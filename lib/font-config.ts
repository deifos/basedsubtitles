/**
 * Shared font configuration for Canvas rendering.
 *
 * CSS custom properties (var(--font-*)) used in DOM/Tailwind styling cannot be
 * read by CanvasRenderingContext2D. This map resolves them to actual font names
 * for use in canvas.font assignments. Used by both the preview renderer and the
 * export pipeline.
 */
export const FONT_MAPPINGS: Record<string, string> = {
  "var(--font-bangers)": "Bangers",
  "var(--font-montserrat)": "Montserrat",
  "var(--font-inter)": "Inter",
  "var(--font-bebas-neue)": "Bebas Neue",
  "var(--font-poppins)": "Poppins",
  "var(--font-open-sans)": "Open Sans",
  "var(--font-oswald)": "Oswald",
  "var(--font-anton)": "Anton",
  "var(--font-fredoka)": "Fredoka",
  "var(--font-righteous)": "Righteous",
  "var(--font-nunito)": "Nunito",
  "var(--font-roboto)": "Roboto",
  "var(--font-permanent-marker)": "Permanent Marker",
  "var(--font-pacifico)": "Pacifico",
  "var(--font-lobster)": "Lobster",
  "var(--font-alfa-slab-one)": "Alfa Slab One",
  "var(--font-staatliches)": "Staatliches",
  "var(--font-fugaz-one)": "Fugaz One",
  "var(--font-chewy)": "Chewy",
  "var(--font-playfair-display)": "Playfair Display",
  "var(--font-lora)": "Lora",
  "var(--font-plus-jakarta-sans)": "Plus Jakarta Sans",
  "var(--font-outfit)": "Outfit",
  "var(--font-lilita-one)": "Lilita One",
};

/** Resolve a CSS var(--font-*) font family string to an actual font name for Canvas. */
export function resolveFontFamily(fontFamily: string): string {
  if (!fontFamily.includes("var(")) return fontFamily;

  for (const [cssVar, actualFont] of Object.entries(FONT_MAPPINGS)) {
    if (fontFamily.includes(cssVar)) {
      return fontFamily.replace(cssVar, actualFont);
    }
  }

  const fallbackMatch = fontFamily.match(/,\s*(.+)$/);
  return fallbackMatch ? fallbackMatch[1] : "Arial, sans-serif";
}
