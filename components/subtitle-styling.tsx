"use client";

import { CSSProperties, ChangeEvent, useMemo } from "react";

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

// Helper to check if a color is effectively transparent
function isTransparentColor(color: string): boolean {
  return color === "transparent" || color === "rgba(0, 0, 0, 0)" || color === "";
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
  // Removed: animated, wordHighlightEnabled, wordHighlightColor, wordHighlightAnimation, wordHighlightIntensity
  // FFmpeg drawtext doesn't support animations or word highlighting
}

interface SubtitleStylingProps {
  style: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  mode?: "word" | "phrase";
  className?: string;
}

const FONT_FAMILIES = {
  arial: {
    label: "Arial",
    value: "Arial, sans-serif",
  },
  roboto: {
    label: "Roboto",
    value: "Roboto, sans-serif",
  },
  verdana: {
    label: "Verdana",
    value: "Verdana, sans-serif",
  },
  helvetica: {
    label: "Helvetica",
    value: "Helvetica, Arial, sans-serif",
  },
  openSans: {
    label: "Open Sans",
    value: "var(--font-open-sans), 'Open Sans', sans-serif",
  },
} satisfies Record<string, { label: string; value: string }>;

const fontOptions = Object.values(FONT_FAMILIES);

const fontSizeOptions = [
  { value: 12, label: "Extra Small" },
  { value: 16, label: "Small" },
  { value: 20, label: "Medium" },
  { value: 24, label: "Large" },
  { value: 28, label: "Extra Large" },
];

const fontWeightOptions = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
];

const borderWidthOptions = [
  { value: 0, label: "None" },
  { value: 1, label: "Thin" },
  { value: 2, label: "Medium" },
  { value: 4, label: "Thick" },
];

type SubtitlePresetName =
  | "green"
  | "gold"
  | "subtitle"
  | "gamer";

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
      fontFamily: FONT_FAMILIES.roboto.value,
      fontSize: 20,
      fontWeight: "600",
      color: "#00FF41",
      backgroundColor: "#0B0B0B",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.4,
    },
    inactiveStyles: {
      color: "#00FF41",
      backgroundColor: "#0B0B0B",
      borderRadius: "9999px",
      paddingInline: "0.75rem",
      paddingBlock: "0.35rem",
    },
  },
  {
    name: "gold",
    label: "Gold",
    previewText: "GOLD",
    style: {
      fontFamily: FONT_FAMILIES.openSans.value,
      fontSize: 20,
      fontWeight: "600",
      color: "#F4D35E",
      backgroundColor: "#1F1300",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.4,
    },
    inactiveStyles: {
      color: "#F4D35E",
      backgroundColor: "#1F1300",
      borderRadius: "0.75rem",
      paddingInline: "0.75rem",
      paddingBlock: "0.35rem",
    },
  },
  {
    name: "subtitle",
    label: "Subtitle",
    previewText: "SUBTITLE",
    style: {
      fontFamily: FONT_FAMILIES.arial.value,
      fontSize: 20,
      fontWeight: "500",
      color: "#FFFFFF",
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      borderWidth: 0,
      borderColor: "#000000",
      dropShadowIntensity: 0.3,
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
      fontFamily: FONT_FAMILIES.verdana.value,
      fontSize: 24,
      fontWeight: "700",
      color: "#94FBAB",
      backgroundColor: "#141414",
      borderWidth: 0,
      borderColor: "#FF00FF",
      dropShadowIntensity: 0.6,
    },
    inactiveStyles: {
      color: "#94FBAB",
      backgroundColor: "#141414",
      borderRadius: "9999px",
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
  return (
    <Button
      onClick={onApply}
      variant={isActive ? "default" : "ghost"}
      className="group relative h-10 w-full rounded-full text-xs font-semibold transition-all"
      style={
        isActive
          ? {
              backgroundColor: preset.style.backgroundColor || "var(--primary)",
              color: preset.style.color,
              boxShadow:
                preset.style.borderWidth && preset.style.borderWidth > 0
                  ? `0 0 0 ${preset.style.borderWidth}px ${preset.style.borderColor}`
                  : "0 0 0 2px rgba(255,255,255,0.7)",
            }
          : preset.inactiveStyles
      }
    >
      {preset.label.toUpperCase()}
      <span
        className={`pointer-events-none absolute inset-0 rounded-full border-2 transition-colors ${
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

export function SubtitleStyling({
  style,
  onChange,
  mode = "phrase",
  className = "",
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

  const handleFontSizeChange = (value: string) => {
    onChange({ ...style, fontSize: Number(value) });
  };

  const handleFontWeightChange = (value: string) => {
    onChange({ ...style, fontWeight: value });
  };

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, color: event.target.value });
  };

  const handleBackgroundColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, backgroundColor: event.target.value });
  };

  const handleBorderWidthChange = (value: string) => {
    onChange({ ...style, borderWidth: Number(value) });
  };

  const handleBorderColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...style, borderColor: event.target.value });
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

  const previewStyles = useMemo(() => {
    const base: CSSProperties = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      color: style.color,
      WebkitTextStroke:
        style.borderWidth > 0 ? `${Math.max(0.5, style.borderWidth)}px ${style.borderColor}` : "none",
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

  const wordEmphasisEnabled = style.wordEmphasisEnabled ?? true;

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      <div className="px-4 mb-2">
        <h3 className="font-medium text-lg">Subtitle Styling</h3>
      </div>

      <div className="p-2 space-y-3 flex-1 overflow-y-auto">
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

        <div className="space-y-2 rounded-lg border border-border/40 bg-muted/40 p-3">
          <Select value={style.fontFamily} onValueChange={handleFontFamilyChange}>
            <SelectTrigger className="w-full rounded-md border-none bg-background px-3 py-2 text-sm shadow-sm">
              <SelectValue placeholder="Select a font" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Size</label>
          <Select value={style.fontSize.toString()} onValueChange={handleFontSizeChange}>
            <SelectTrigger className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm shadow-sm">
              <SelectValue placeholder="Select a size" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fontSizeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Font Weight</label>
          <Select value={style.fontWeight} onValueChange={handleFontWeightChange}>
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

        <div className="space-y-2">
          <label className="text-sm font-medium block">Text Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.color}
              onChange={handleColorChange}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <span className="text-sm uppercase">{style.color}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Background Color</label>
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
              <input
                type="color"
                value={rgbaToHex(style.backgroundColor)}
                onChange={handleBackgroundColorChange}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm uppercase">{rgbaToHex(style.backgroundColor)}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Border Width</label>
          <Select value={style.borderWidth.toString()} onValueChange={handleBorderWidthChange}>
            <SelectTrigger className="w-full p-2 border rounded-md bg-background">
              <SelectValue placeholder="Select a border width" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {borderWidthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {style.borderWidth > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium block">Border Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.borderColor}
                onChange={handleBorderColorChange}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm uppercase">{style.borderColor}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium block">Drop Shadow Intensity</label>
          <Slider
            value={[Math.round(style.dropShadowIntensity * 100)]}
            onValueChange={(values) => handleDropShadowIntensityChange(values[0] / 100)}
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

        <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Active word emphasis</p>
            <p className="text-xs text-muted-foreground">
              {mode === "word" 
                ? "Only available in phrase mode"
                : "Scale the spoken word and add a subtle dark backdrop."
              }
            </p>
          </div>
          <Switch
            checked={wordEmphasisEnabled}
            onCheckedChange={handleWordEmphasisToggle}
            disabled={mode === "word"}
            aria-label="Toggle active word emphasis"
          />
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Preview</h4>
        <div className="p-4 rounded-md text-center" style={previewStyles}>
          {previewText}
        </div>
      </div>
    </div>
  );
}
