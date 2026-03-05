"use client";

import { CSSProperties, useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DebouncedColorInput } from "@/components/ui/debounced-color-input";

// Helper to check if a color is effectively transparent
function isTransparentColor(color: string): boolean {
  return (
    color === "transparent" || color === "rgba(0, 0, 0, 0)" || color === ""
  );
}

// Helper to convert rgba to hex (for display in color input)
function rgbaToHex(rgba: string): string {
  // If it's already hex, return as-is
  if (rgba.startsWith("#")) return rgba;

  // If it's transparent, return a default color
  if (isTransparentColor(rgba)) return "#000000";

  // Parse rgba(r, g, b, a) format
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  return "#000000";
}

export interface SubtitleStyle {
  fontFamily: string; // Note: FFmpeg uses single font file, family switching limited
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  dropShadowIntensity: number;
  wordEmphasisEnabled: boolean;
  position: "top" | "middle" | "bottom";
  maxWordsPerLine: number;
  backgroundRemovalEnabled: boolean;
  backgroundType: "solid" | "blur";
  solidBackgroundColor: string;
  // Dynamic subtitle controls
  dynamicEnabled: boolean; // toggle for behind/front 3D depth effect
  dynamicFontSize: number; // behind text font size in px at 500px preview height (default 80)
  dynamicYPosition: number; // behind text vertical position 0-100 (0=top, 100=bottom, default 35)
  dynamicFrontFontSize: number; // front text font size at 500px preview height (default 40)
  dynamicFrontYPosition: number; // front text fallback Y position 0-100 (default 75)
  dynamicFollowWord: boolean; // highlight spoken word in front text (phrase mode only)
  textFadeIn: boolean; // letter-by-letter fade-in effect
  brandingWatermark: boolean; // show "basedsubs.getbasedapps.com" watermark
}

interface SubtitleStylingProps {
  style: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  mode?: "word" | "phrase";
  onModeChange?: (mode: "word" | "phrase") => void;
  className?: string;
  bgRemovalReady?: boolean;
}

export const FONT_FAMILIES = {
  plusJakartaSans: {
    label: "Plus Jakarta Sans",
    value: "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif",
    cssFont: "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif",
  },
  outfit: {
    label: "Outfit",
    value: "var(--font-outfit), 'Outfit', sans-serif",
    cssFont: "var(--font-outfit), Outfit, sans-serif",
  },
  inter: {
    label: "Inter",
    value: "var(--font-inter), 'Inter', sans-serif",
    cssFont: "var(--font-inter), Inter, sans-serif",
  },
  roboto: {
    label: "Roboto",
    value: "var(--font-roboto), 'Roboto', sans-serif",
    cssFont: "var(--font-roboto), Roboto, sans-serif",
  },
  openSans: {
    label: "Open Sans",
    value: "var(--font-open-sans), 'Open Sans', sans-serif",
    cssFont: "var(--font-open-sans), 'Open Sans', sans-serif",
  },
  nunito: {
    label: "Nunito",
    value: "var(--font-nunito), 'Nunito', sans-serif",
    cssFont: "var(--font-nunito), Nunito, sans-serif",
  },
  montserrat: {
    label: "Montserrat",
    value: "var(--font-montserrat), 'Montserrat', sans-serif",
    cssFont: "var(--font-montserrat), Montserrat, sans-serif",
  },
  poppins: {
    label: "Poppins",
    value: "var(--font-poppins), 'Poppins', sans-serif",
    cssFont: "var(--font-poppins), Poppins, sans-serif",
  },
  fredoka: {
    label: "Fredoka",
    value: "var(--font-fredoka), 'Fredoka', sans-serif",
    cssFont: "var(--font-fredoka), Fredoka, sans-serif",
  },
  righteous: {
    label: "Righteous",
    value: "var(--font-righteous), 'Righteous', sans-serif",
    cssFont: "var(--font-righteous), Righteous, sans-serif",
  },
  anton: {
    label: "Anton",
    value: "var(--font-anton), 'Anton', sans-serif",
    cssFont: "var(--font-anton), Anton, sans-serif",
  },
  bangers: {
    label: "Bangers",
    value: "var(--font-bangers), 'Bangers', cursive",
    cssFont: "var(--font-bangers), Bangers, cursive",
  },
  oswald: {
    label: "Oswald",
    value: "var(--font-oswald), 'Oswald', sans-serif",
    cssFont: "var(--font-oswald), Oswald, sans-serif",
  },
  bebasNeue: {
    label: "Bebas Neue",
    value: "var(--font-bebas-neue), 'Bebas Neue', sans-serif",
    cssFont: "var(--font-bebas-neue), 'Bebas Neue', sans-serif",
  },
  permanentMarker: {
    label: "Permanent Marker",
    value: "var(--font-permanent-marker), 'Permanent Marker', cursive",
    cssFont: "var(--font-permanent-marker), 'Permanent Marker', cursive",
  },
  pacifico: {
    label: "Pacifico",
    value: "var(--font-pacifico), 'Pacifico', cursive",
    cssFont: "var(--font-pacifico), Pacifico, cursive",
  },
  lobster: {
    label: "Lobster",
    value: "var(--font-lobster), 'Lobster', cursive",
    cssFont: "var(--font-lobster), Lobster, cursive",
  },
  alfaSlabOne: {
    label: "Alfa Slab One",
    value: "var(--font-alfa-slab-one), 'Alfa Slab One', serif",
    cssFont: "var(--font-alfa-slab-one), 'Alfa Slab One', serif",
  },
  staatliches: {
    label: "Staatliches",
    value: "var(--font-staatliches), 'Staatliches', sans-serif",
    cssFont: "var(--font-staatliches), Staatliches, sans-serif",
  },
  fugazOne: {
    label: "Fugaz One",
    value: "var(--font-fugaz-one), 'Fugaz One', cursive",
    cssFont: "var(--font-fugaz-one), 'Fugaz One', cursive",
  },
  chewy: {
    label: "Chewy",
    value: "var(--font-chewy), 'Chewy', cursive",
    cssFont: "var(--font-chewy), Chewy, cursive",
  },
  playfairDisplay: {
    label: "Playfair Display",
    value: "var(--font-playfair-display), 'Playfair Display', serif",
    cssFont: "var(--font-playfair-display), 'Playfair Display', serif",
  },
  lora: {
    label: "Lora",
    value: "var(--font-lora), 'Lora', serif",
    cssFont: "var(--font-lora), Lora, serif",
  },
  lilitaOne: {
    label: "Lilita One",
    value: "var(--font-lilita-one), 'Lilita One', sans-serif",
    cssFont: "var(--font-lilita-one), 'Lilita One', sans-serif",
  },
  arial: {
    label: "Arial",
    value: "Arial, sans-serif",
    cssFont: "Arial, sans-serif",
  },
  verdana: {
    label: "Verdana",
    value: "Verdana, sans-serif",
    cssFont: "Verdana, sans-serif",
  },
  helvetica: {
    label: "Helvetica",
    value: "Helvetica, Arial, sans-serif",
    cssFont: "Helvetica, Arial, sans-serif",
  },
} satisfies Record<string, { label: string; value: string; cssFont: string }>;

const fontOptions = Object.values(FONT_FAMILIES);

const FONT_SIZE_STOPS = [
  { value: 16, label: "Small" },
  { value: 22, label: "Medium" },
  { value: 28, label: "Big" },
] as const;

// Map slider index (0, 1, 2) to font size values
function sliderIndexToFontSize(index: number): number {
  return FONT_SIZE_STOPS[index]?.value ?? 22;
}

function fontSizeToSliderIndex(fontSize: number): number {
  // Find closest stop
  let closestIndex = 1;
  let closestDist = Infinity;
  FONT_SIZE_STOPS.forEach((stop, i) => {
    const dist = Math.abs(stop.value - fontSize);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = i;
    }
  });
  return closestIndex;
}

const fontWeightOptions = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
];

type SubtitlePresetName = "green" | "gold" | "subtitle" | "gamer";

interface SubtitlePreset {
  name: SubtitlePresetName;
  label: string;
  previewText: string;
  style: Partial<SubtitleStyle>;
  inactiveStyles?: CSSProperties;
}

const PRESETS: SubtitlePreset[] = [
  {
    name: "green",
    label: "Green",
    previewText: "GREEN",
    style: {
      fontFamily: FONT_FAMILIES.bangers.value,
      fontSize: 16,
      fontWeight: "600",
      color: "#00FF41",
      backgroundColor: "#0B0B0B",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.4,
      position: "bottom",
      maxWordsPerLine: 6,
    },
    inactiveStyles: {
      color: "#00FF41",
      backgroundColor: "#0B0B0B",
      borderRadius: "0.5rem",
      paddingInline: "0.75rem",
      paddingBlock: "0.35rem",
    },
  },
  {
    name: "gold",
    label: "Gold",
    previewText: "GOLD",
    style: {
      fontFamily: FONT_FAMILIES.permanentMarker.value,
      fontSize: 16,
      fontWeight: "600",
      color: "#F4D35E",
      backgroundColor: "#1F1300",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.4,
      position: "bottom",
      maxWordsPerLine: 6,
    },
    inactiveStyles: {
      color: "#F4D35E",
      backgroundColor: "#1F1300",
      borderRadius: "0.5rem",
      paddingInline: "0.75rem",
      paddingBlock: "0.35rem",
    },
  },
  {
    name: "subtitle",
    label: "Subtitle",
    previewText: "SUBTITLE",
    style: {
      fontFamily: FONT_FAMILIES.outfit.value,
      fontSize: 16,
      fontWeight: "500",
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.3,
      position: "bottom",
      maxWordsPerLine: 6,
    },
    inactiveStyles: {
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      borderRadius: "0.5rem",
      paddingInline: "0.75rem",
      paddingBlock: "0.35rem",
    },
  },
  {
    name: "gamer",
    label: "Gamer",
    previewText: "GAMER",
    style: {
      fontFamily: FONT_FAMILIES.bebasNeue.value,
      fontSize: 16,
      fontWeight: "700",
      color: "#94FBAB",
      backgroundColor: "#141414",
      borderWidth: 0,
      borderColor: "#FF00FF",
      dropShadowIntensity: 0.6,
      position: "bottom",
      maxWordsPerLine: 6,
    },
    inactiveStyles: {
      color: "#94FBAB",
      backgroundColor: "#141414",
      borderRadius: "0.5rem",
      paddingInline: "0.75rem",
      paddingBlock: "0.35rem",
      boxShadow: "0 0 0 2px #FF00FF",
    },
  },
];

interface PresetButtonProps {
  preset: SubtitlePreset;
  isActive: boolean;
  onApply: () => void;
}

function PresetButton({ preset, isActive, onApply }: PresetButtonProps) {
  // Look up the cssFont value so the button renders with the actual Google Font
  const presetCssFont = useMemo(() => {
    const match = fontOptions.find((f) => f.value === preset.style.fontFamily);
    return match?.cssFont ?? preset.style.fontFamily;
  }, [preset.style.fontFamily]);

  const fontStyles: CSSProperties = {
    fontFamily: presetCssFont,
    fontWeight: preset.style.fontWeight as CSSProperties["fontWeight"],
  };

  return (
    <Button
      onClick={onApply}
      variant={isActive ? "default" : "ghost"}
      className="group relative h-10 w-full rounded-lg text-xs transition-all"
      style={
        isActive
          ? {
              backgroundColor: preset.style.backgroundColor || "var(--primary)",
              color: preset.style.color,
              boxShadow:
                preset.style.borderWidth && preset.style.borderWidth > 0
                  ? `0 0 0 ${preset.style.borderWidth}px ${preset.style.borderColor}`
                  : "0 0 0 2px rgba(255,255,255,0.7)",
              ...fontStyles,
            }
          : { ...preset.inactiveStyles, ...fontStyles }
      }
    >
      {preset.label.toUpperCase()}
      <span
        className={`pointer-events-none absolute inset-0 rounded-lg border-2 transition-colors ${
          isActive
            ? "border-yellow-400"
            : "border-transparent group-hover:border-border/60"
        }`}
      />
    </Button>
  );
}

function isPresetActive(style: SubtitleStyle, preset: SubtitlePreset) {
  return Object.entries(preset.style).every(([key, value]) => {
    const styleValue = style[key as keyof SubtitleStyle];
    return styleValue === value;
  });
}

function PositionIcon({
  position,
  isActive,
}: {
  position: "top" | "middle" | "bottom";
  isActive: boolean;
}) {
  const lineColor = isActive ? "currentColor" : "currentColor";
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      className="shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="18"
        height="22"
        rx="2"
        stroke={lineColor}
        strokeWidth="1.5"
        fill="none"
        opacity={0.4}
      />
      {position === "top" && (
        <rect x="5" y="4" width="10" height="2.5" rx="1" fill={lineColor} />
      )}
      {position === "middle" && (
        <rect x="5" y="10.75" width="10" height="2.5" rx="1" fill={lineColor} />
      )}
      {position === "bottom" && (
        <rect x="5" y="17.5" width="10" height="2.5" rx="1" fill={lineColor} />
      )}
    </svg>
  );
}

export function SubtitleStyling({
  style,
  onChange,
  mode = "phrase",
  onModeChange,
  className = "",
  bgRemovalReady = false,
}: SubtitleStylingProps) {
  const activePresetName = useMemo<SubtitlePresetName | null>(() => {
    const match = PRESETS.find((preset) => isPresetActive(style, preset));
    return match ? match.name : null;
  }, [style]);

  const previewText = useMemo(() => {
    const match = PRESETS.find((preset) => preset.name === activePresetName);
    return match?.previewText ?? "PREVIEW";
  }, [activePresetName]);

  const handleFontFamilyChange = (value: string) => {
    onChange({ ...style, fontFamily: value });
  };

  const handleFontWeightChange = (value: string) => {
    onChange({ ...style, fontWeight: value });
  };

  const handleColorChange = (color: string) => {
    onChange({ ...style, color });
  };

  const handleBackgroundColorChange = (color: string) => {
    onChange({ ...style, backgroundColor: color });
  };

  const handleBorderColorChange = (color: string) => {
    onChange({ ...style, borderColor: color });
  };

  const handleDropShadowIntensityChange = (value: number) => {
    onChange({ ...style, dropShadowIntensity: value });
  };

  const handleWordEmphasisToggle = (value: boolean) => {
    onChange({ ...style, wordEmphasisEnabled: value });
  };

  const applyPreset = (preset: SubtitlePreset) => {
    onChange({ ...style, ...preset.style });
  };

  // Find the current font's cssFont value for the trigger preview
  const currentFontCss = useMemo(() => {
    const match = fontOptions.find((f) => f.value === style.fontFamily);
    return match?.cssFont ?? style.fontFamily;
  }, [style.fontFamily]);

  const previewStyles = useMemo(() => {
    const base: CSSProperties = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      color: style.color,
      WebkitTextStroke:
        style.borderWidth > 0
          ? `${Math.max(0.5, style.borderWidth)}px ${style.borderColor}`
          : "none",
      paintOrder: "stroke fill",
      letterSpacing: "0.05em",
      filter: `drop-shadow(2px 2px ${Math.max(2, style.dropShadowIntensity * 4)}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`,
      borderRadius: "0.5rem",
      transition: "all 0.2s ease",
    };

    return {
      ...base,
      backgroundColor: style.backgroundColor,
    };
  }, [style]);

  const wordEmphasisEnabled = style.wordEmphasisEnabled ?? false;
  const fontSizeSliderIndex = fontSizeToSliderIndex(style.fontSize);

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${className}`}
      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
    >
      {/* Mode Toggle at top */}
      {onModeChange && (
        <div className="px-4 mb-3">
          <Tabs
            value={mode}
            onValueChange={(value) => onModeChange(value as "word" | "phrase")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="word">Word</TabsTrigger>
              <TabsTrigger value="phrase">Phrases</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="px-4 mb-2">
        <h3 className="font-semibold text-base tracking-tight">
          Subtitle Styling
        </h3>
      </div>

      {/* Preview — pinned above scroll area */}
      <div className="px-4 pb-3">
        <div
          className="p-3 rounded-lg text-center border border-border/40 bg-muted/30"
          style={previewStyles}
        >
          {previewText}
        </div>
      </div>

      <div className="p-2 space-y-3 flex-1 overflow-y-auto">
        {/* Style presets */}
        <div className="space-y-2 mb-2">
          <label className="text-sm font-medium block">Style Presets</label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <PresetButton
                key={preset.name}
                preset={preset}
                isActive={activePresetName === preset.name}
                onApply={() => applyPreset(preset)}
              />
            ))}
          </div>
        </div>

        {/* Font Family with preview */}
        <div className="space-y-2 rounded-lg border border-border/40 bg-muted/40 p-3">
          <Select
            value={style.fontFamily}
            onValueChange={handleFontFamilyChange}
          >
            <SelectTrigger
              className="w-full rounded-md border-none bg-background px-3 py-2 text-sm shadow-sm"
              style={{ fontFamily: currentFontCss }}
            >
              <SelectValue placeholder="Select a font" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm"
                    style={{ fontFamily: option.cssFont }}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Font Size - only when dynamic is off (dynamic has its own size controls) */}
        {!style.dynamicEnabled && (
          <div className="space-y-2">
            <label className="text-sm font-medium block">Font Size</label>
            <Slider
              value={[fontSizeSliderIndex]}
              onValueChange={(values) => {
                onChange({
                  ...style,
                  fontSize: sliderIndexToFontSize(values[0]),
                });
              }}
              min={0}
              max={2}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs mt-1">
              {FONT_SIZE_STOPS.map((stop, i) => (
                <span
                  key={stop.value}
                  className={
                    fontSizeSliderIndex === i
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  }
                >
                  {stop.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Weight</label>
          <Select
            value={style.fontWeight}
            onValueChange={handleFontWeightChange}
          >
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a weight" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontWeightOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic controls: behind text size + position, front text, follow-word */}
        {style.dynamicEnabled && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Behind Text Size</label>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {style.dynamicFontSize}px
                </span>
              </div>
              <Slider
                value={[style.dynamicFontSize]}
                onValueChange={(values) => {
                  onChange({ ...style, dynamicFontSize: values[0] });
                }}
                min={30}
                max={160}
                step={2}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Vertical Position</label>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {style.dynamicYPosition}%
                </span>
              </div>
              <Slider
                value={[style.dynamicYPosition]}
                onValueChange={(values) => {
                  onChange({ ...style, dynamicYPosition: values[0] });
                }}
                min={5}
                max={95}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Top</span>
                <span>Bottom</span>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/40 bg-muted/40 p-3">
              <h4 className="text-sm font-medium">Front Text</h4>
              <p className="text-xs text-muted-foreground">
                Smaller text rendered in front of the person
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Front Text Size</label>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {style.dynamicFrontFontSize}px
                  </span>
                </div>
                <Slider
                  value={[style.dynamicFrontFontSize]}
                  onValueChange={(values) => {
                    onChange({ ...style, dynamicFrontFontSize: values[0] });
                  }}
                  min={16}
                  max={80}
                  step={2}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Front Text Position
                  </label>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {style.dynamicFrontYPosition}%
                  </span>
                </div>
                <Slider
                  value={[style.dynamicFrontYPosition]}
                  onValueChange={(values) => {
                    onChange({ ...style, dynamicFrontYPosition: values[0] });
                  }}
                  min={30}
                  max={95}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Top</span>
                  <span>Bottom</span>
                </div>
              </div>
            </div>

            {/* Follow-up word display - phrase mode only */}
            {mode === "phrase" && (
              <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Follow-up word display</p>
                  <p className="text-xs text-muted-foreground">
                    Reveal words one by one as they are spoken
                  </p>
                </div>
                <Switch
                  checked={style.dynamicFollowWord}
                  onCheckedChange={(checked) =>
                    onChange({ ...style, dynamicFollowWord: checked })
                  }
                  aria-label="Toggle follow-up word display"
                />
              </div>
            )}
          </>
        )}

        {/* Position selector - hidden when dynamic is active */}
        {!style.dynamicEnabled && (
          <div className="space-y-2">
            <label className="text-sm font-medium block">Position</label>
            <div className="grid grid-cols-3 gap-2">
              {(["top", "middle", "bottom"] as const).map((pos) => {
                const isActive = style.position === pos;
                return (
                  <button
                    key={pos}
                    onClick={() => onChange({ ...style, position: pos })}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? "border-amber-500/70 bg-amber-50 text-amber-700"
                        : "border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    <PositionIcon position={pos} isActive={isActive} />
                    <span className="capitalize">{pos}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Max Words Per Line slider - phrase mode only */}
        {mode === "phrase" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Max Words/Line</label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {style.maxWordsPerLine}
              </span>
            </div>
            <Slider
              value={[style.maxWordsPerLine]}
              onValueChange={(values) => {
                onChange({ ...style, maxWordsPerLine: values[0] });
              }}
              min={1}
              max={8}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1</span>
              <span>8</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium block">Text Color</label>
          <div className="flex items-center gap-2">
            <DebouncedColorInput
              value={style.color}
              onChange={handleColorChange}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <span className="text-sm uppercase">{style.color}</span>
          </div>
        </div>

        {/* Background color - hidden when dynamic is active */}
        {!style.dynamicEnabled && (
          <div className="space-y-2">
            <label className="text-sm font-medium block">
              Background Color
            </label>
            <div className="flex items-center justify-between">
              <span className="text-sm">No background</span>
              <Switch
                checked={isTransparentColor(style.backgroundColor)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange({ ...style, backgroundColor: "transparent" });
                  } else {
                    onChange({ ...style, backgroundColor: "#000000" });
                  }
                }}
              />
            </div>
            {!isTransparentColor(style.backgroundColor) && (
              <div className="flex items-center gap-2">
                <DebouncedColorInput
                  value={rgbaToHex(style.backgroundColor)}
                  onChange={handleBackgroundColorChange}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <span className="text-sm uppercase">
                  {rgbaToHex(style.backgroundColor)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium block">
            Border Width ({style.borderWidth}px)
          </label>
          <Slider
            value={[style.borderWidth]}
            onValueChange={(values) =>
              onChange({ ...style, borderWidth: values[0] })
            }
            min={0}
            max={20}
            step={1}
          />
        </div>

        {style.borderWidth > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium block">Border Color</label>
            <div className="flex items-center gap-2">
              <DebouncedColorInput
                value={style.borderColor}
                onChange={handleBorderColorChange}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm uppercase">{style.borderColor}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium block">
            Drop Shadow Intensity
          </label>
          <Slider
            value={[Math.round(style.dropShadowIntensity * 100)]}
            onValueChange={(values) =>
              handleDropShadowIntensityChange(values[0] / 100)
            }
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Subtle</span>
            <span>Strong</span>
          </div>
        </div>

        {/* Word emphasis - hidden when dynamic is active */}
        {!style.dynamicEnabled && (
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Active word emphasis</p>
              <p className="text-xs text-muted-foreground">
                {mode === "word"
                  ? "Only available in phrase mode"
                  : "Scale the spoken word and add a subtle dark backdrop."}
              </p>
            </div>
            <Switch
              checked={wordEmphasisEnabled}
              onCheckedChange={handleWordEmphasisToggle}
              disabled={mode === "word"}
              aria-label="Toggle active word emphasis"
            />
          </div>
        )}

        {/* Background Removal Section - only when masks are ready */}
        {bgRemovalReady && (
          <div className="space-y-3 rounded-lg border border-border/40 bg-muted/40 p-3">
            <h4 className="text-sm font-medium">Background</h4>

            {/* Dynamic (3D depth) toggle */}
            <div className="flex items-center justify-between rounded-lg border border-amber-300/50 bg-amber-50/50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Dynamic (3D depth)</p>
                <p className="text-xs text-muted-foreground">
                  Split text behind &amp; in front of the person
                </p>
              </div>
              <Switch
                checked={style.dynamicEnabled}
                onCheckedChange={(checked) =>
                  onChange({ ...style, dynamicEnabled: checked })
                }
                aria-label="Toggle dynamic 3D depth subtitles"
              />
            </div>

            {!style.dynamicEnabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium block">
                    Background Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["solid", "blur"] as const).map((bgType) => {
                      const isActive = style.backgroundType === bgType;
                      return (
                        <button
                          key={bgType}
                          onClick={() =>
                            onChange({ ...style, backgroundType: bgType })
                          }
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            isActive
                              ? "border-amber-500/70 bg-amber-50 text-amber-700"
                              : "border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                        >
                          {bgType === "solid" ? "Solid Color" : "Blurred"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {style.backgroundType === "solid" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">
                      Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <DebouncedColorInput
                        value={style.solidBackgroundColor}
                        onChange={(color) =>
                          onChange({ ...style, solidBackgroundColor: color })
                        }
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <span className="text-sm uppercase">
                        {style.solidBackgroundColor}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Branding watermark toggle */}
      <div className="relative overflow-hidden border-2 border-amber-400 bg-amber-50 rounded-lg p-2.5">
        <div className="flex items-start gap-2.5">
          <Switch
            id="branding-watermark"
            checked={style.brandingWatermark}
            onCheckedChange={(checked) =>
              onChange({ ...style, brandingWatermark: checked })
            }
            className="mt-0.5 flex-shrink-0"
          />
          <div className="space-y-1 min-w-0">
            <label
              htmlFor="branding-watermark"
              className="text-xs font-bold uppercase tracking-wider leading-tight block cursor-pointer"
            >
              basedsubs.getbasedapps.com
            </label>
            <p className="text-[11px] text-black/60 leading-snug">
              Support my work by keeping the watermark on your exports
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
