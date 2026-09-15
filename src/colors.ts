export interface BrandColor {
  name: string;
  hex: string;
}

// Extracted from Twitch Brand Assets/Colors/twitch_color-palette_hex.ai, grouped by hue
// (computed from each hex's HSL hue) rather than the source file's original grid order.
export const BRAND_COLORS: BrandColor[] = [
  // Neutrals + reds
  { name: "Black Ops", hex: "#000000" },
  { name: "Iron", hex: "#91919F" },
  { name: "Smoke", hex: "#D2D2E6" },
  { name: "Ice", hex: "#F0F0FF" },
  { name: "Worm", hex: "#FACDCD" },
  { name: "Peach", hex: "#EA7078" },
  { name: "Scrouge", hex: "#A91A26" },
  { name: "Barrel", hex: "#F7262C" },

  // Oranges, yellows, greens
  { name: "Crash", hex: "#FF6905" },
  { name: "Dig", hex: "#904B1C" },
  { name: "Tangy", hex: "#FDB210" },
  { name: "Star", hex: "#FAFA19" },
  { name: "Ooze", hex: "#BEFF00" },
  { name: "Junimo", hex: "#00FA05" },
  { name: "Grass", hex: "#009919" },
  { name: "Rosalina", hex: "#BEFAE1" },

  // Teals, cyans, blues
  { name: "Rune", hex: "#69FDC2" },
  { name: "Linc", hex: "#006441" },
  { name: "Surf", hex: "#00C8AF" },
  { name: "Pylon", hex: "#00FAFA" },
  { name: "Knights", hex: "#215264" },
  { name: "Mana", hex: "#57BEE6" },
  { name: "Zero", hex: "#1E69FF" },
  { name: "Sonic", hex: "#0014A5" },

  // Purples, pinks, magentas
  { name: "Widow", hex: "#BFABFF" },
  { name: "Purple", hex: "#9146FF" },
  { name: "Twilight", hex: "#41145F" },
  { name: "Dragon", hex: "#8205B4" },
  { name: "Jiggle", hex: "#FF8DFF" },
  { name: "Cuddle", hex: "#FA1ED2" },
  { name: "Edgeworth", hex: "#BE0078" },
  { name: "Overlord", hex: "#821946" },
];

// WCAG relative luminance - picks black or white text for max contrast on a given bg color
export function contrastTextColor(hex: string): "#000000" | "#FFFFFF" {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

  return luminance > 0.4 ? "#000000" : "#FFFFFF";
}
