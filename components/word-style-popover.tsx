"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONT_FAMILIES } from "@/components/subtitle-styling";
import {
  X,
  RotateCcw,
  Type,
  Palette,
  Zap,
  Smile,
  ALargeSmall,
} from "lucide-react";
import { cn, type WordStyleOverride } from "@/lib/utils";
import { DebouncedColorInput } from "@/components/ui/debounced-color-input";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const fontOptions = Object.values(FONT_FAMILIES);

type Section = "font" | "size" | "color" | "effect" | "emoji";

interface WordStylePopoverProps {
  wordText: string;
  override: WordStyleOverride;
  onChange: (override: WordStyleOverride) => void;
  onReset: () => void;
  onClose: () => void;
  className?: string;
  compact?: boolean;
}

export function WordStylePopover({
  wordText,
  override,
  onChange,
  onReset,
  onClose,
  className,
  compact = false,
}: WordStylePopoverProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState<
    "replace" | "overlay" | null
  >(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  const currentFontCss = useMemo(() => {
    if (!override.fontFamily) return undefined;
    const match = fontOptions.find((f) => f.value === override.fontFamily);
    return match?.cssFont ?? override.fontFamily;
  }, [override.fontFamily]);

  const handleFontFamilyChange = (value: string) => {
    if (value === "__none__") {
      const next = { ...override };
      delete next.fontFamily;
      onChange(next);
    } else {
      onChange({ ...override, fontFamily: value });
    }
  };

  const handleColorChange = (color: string) => {
    onChange({ ...override, color });
  };

  const handleClearColor = () => {
    const next = { ...override };
    delete next.color;
    onChange(next);
  };

  const handleSizeChange = (values: number[]) => {
    const val = values[0] / 100;
    if (val === 1) {
      const next = { ...override };
      delete next.fontSize;
      onChange(next);
    } else {
      onChange({ ...override, fontSize: val });
    }
  };

  const sizePercent = Math.round((override.fontSize ?? 1) * 100);

  const handleToggleKnockout = () => {
    if (override.effect === "knockout") {
      const next = { ...override };
      delete next.effect;
      onChange(next);
    } else {
      onChange({ ...override, effect: "knockout" });
    }
  };

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    if (showEmojiPicker === "replace") {
      onChange({ ...override, emoji: emojiData.emoji });
    } else if (showEmojiPicker === "overlay") {
      onChange({ ...override, emojiOverlay: emojiData.emoji });
    }
    setShowEmojiPicker(null);
  };

  const handleClearEmoji = () => {
    const next = { ...override };
    delete next.emoji;
    onChange(next);
  };

  const handleClearEmojiOverlay = () => {
    const next = { ...override };
    delete next.emojiOverlay;
    onChange(next);
  };

  const handleEmojiScaleChange = (values: number[]) => {
    const val = values[0] / 100;
    if (val === 1) {
      const next = { ...override };
      delete next.emojiScale;
      onChange(next);
    } else {
      onChange({ ...override, emojiScale: val });
    }
  };

  const emojiScalePercent = Math.round((override.emojiScale ?? 1) * 100);
  const hasEmoji = override.emoji || override.emojiOverlay;

  const hasOverrides =
    override.fontFamily !== undefined ||
    override.fontSize !== undefined ||
    override.color !== undefined ||
    override.effect !== undefined ||
    override.emoji !== undefined ||
    override.emojiOverlay !== undefined ||
    override.emojiScale !== undefined;

  // --- Section content renderers ---

  const renderFontSection = () => (
    <div className="space-y-1.5">
      {!compact && (
        <label className="text-xs font-medium text-slate-600 block">Font</label>
      )}
      <Select
        value={override.fontFamily ?? "__none__"}
        onValueChange={handleFontFamilyChange}
      >
        <SelectTrigger
          className="w-full rounded-md border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm"
          style={currentFontCss ? { fontFamily: currentFontCss } : undefined}
        >
          <SelectValue placeholder="Same as global" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="__none__" className="text-xs">
              Same as global
            </SelectItem>
            {fontOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-xs"
                style={{ fontFamily: option.cssFont }}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );

  const renderSizeSection = () => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {!compact && (
          <label className="text-xs font-medium text-slate-600">Size</label>
        )}
        <span className="text-xs text-slate-400 tabular-nums">
          {sizePercent}%
        </span>
      </div>
      <Slider
        value={[sizePercent]}
        onValueChange={handleSizeChange}
        min={50}
        max={200}
        step={10}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>50%</span>
        <span>100%</span>
        <span>200%</span>
      </div>
    </div>
  );

  const renderColorSection = () => (
    <div className="space-y-1.5">
      {!compact && (
        <label className="text-xs font-medium text-slate-600 block">
          Color
        </label>
      )}
      <div className="flex items-center gap-2">
        <DebouncedColorInput
          value={override.color ?? "#FFFFFF"}
          onChange={handleColorChange}
          className="w-8 h-8 rounded cursor-pointer border border-slate-200"
        />
        {override.color ? (
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs uppercase text-slate-500">
              {override.color}
            </span>
            <button
              onClick={handleClearColor}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              reset
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Same as global</span>
        )}
      </div>
    </div>
  );

  const renderEffectSection = () => (
    <div className="space-y-1.5">
      {!compact && (
        <label className="text-xs font-medium text-slate-600 block">
          Effect
        </label>
      )}
      <button
        onClick={handleToggleKnockout}
        className={cn(
          "w-full text-xs px-3 py-1.5 rounded-md border transition-colors text-left",
          override.effect === "knockout"
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
        )}
      >
        Knockout
      </button>
    </div>
  );

  const renderEmojiSection = () => (
    <div className="space-y-2">
      {/* Emoji Replace */}
      <div className="space-y-1.5">
        {!compact && (
          <label className="text-xs font-medium text-slate-600 block">
            Emoji Replace
          </label>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setShowEmojiPicker(
                showEmojiPicker === "replace" ? null : "replace",
              )
            }
            className={cn(
              "flex-1 text-xs px-3 py-1.5 rounded-md border transition-colors text-left",
              override.emoji
                ? "bg-slate-50 border-slate-300"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
            )}
          >
            {override.emoji ? (
              <span className="text-base">
                {override.emoji}{" "}
                <span className="text-xs text-slate-500">replacing text</span>
              </span>
            ) : (
              "Replace with emoji..."
            )}
          </button>
          {override.emoji && (
            <button
              onClick={handleClearEmoji}
              className="text-xs text-slate-400 hover:text-slate-600 underline shrink-0"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Emoji Overlay */}
      <div className="space-y-1.5">
        {!compact && (
          <label className="text-xs font-medium text-slate-600 block">
            Emoji Overlay
          </label>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setShowEmojiPicker(
                showEmojiPicker === "overlay" ? null : "overlay",
              )
            }
            className={cn(
              "flex-1 text-xs px-3 py-1.5 rounded-md border transition-colors text-left",
              override.emojiOverlay
                ? "bg-slate-50 border-slate-300"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
            )}
          >
            {override.emojiOverlay ? (
              <span className="text-base">
                {override.emojiOverlay}{" "}
                <span className="text-xs text-slate-500">above word</span>
              </span>
            ) : (
              "Add emoji above..."
            )}
          </button>
          {override.emojiOverlay && (
            <button
              onClick={handleClearEmojiOverlay}
              className="text-xs text-slate-400 hover:text-slate-600 underline shrink-0"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Emoji Size */}
      {hasEmoji && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              Emoji Size
            </label>
            <span className="text-xs text-slate-400 tabular-nums">
              {emojiScalePercent}%
            </span>
          </div>
          <Slider
            value={[emojiScalePercent]}
            onValueChange={handleEmojiScaleChange}
            min={50}
            max={200}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>50%</span>
            <span>100%</span>
            <span>200%</span>
          </div>
        </div>
      )}

      {/* Emoji Picker Dropdown */}
      {showEmojiPicker && (
        <div ref={pickerRef} className="relative">
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            width="100%"
            height={compact ? 280 : 350}
            skinTonesDisabled
            searchPlaceHolder="Search emoji..."
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );

  // --- Compact (mobile) layout ---

  if (compact) {
    const sections: {
      key: Section;
      icon: React.ReactNode;
      label: string;
      hasValue: boolean;
    }[] = [
      {
        key: "font",
        icon: <Type className="h-3.5 w-3.5" />,
        label: "Font",
        hasValue: !!override.fontFamily,
      },
      {
        key: "size",
        icon: <ALargeSmall className="h-3.5 w-3.5" />,
        label: "Size",
        hasValue: !!override.fontSize,
      },
      {
        key: "color",
        icon: <Palette className="h-3.5 w-3.5" />,
        label: "Color",
        hasValue: !!override.color,
      },
      {
        key: "effect",
        icon: <Zap className="h-3.5 w-3.5" />,
        label: "FX",
        hasValue: !!override.effect,
      },
      {
        key: "emoji",
        icon: <Smile className="h-3.5 w-3.5" />,
        label: "Emoji",
        hasValue: !!(override.emoji || override.emojiOverlay),
      },
    ];

    const toggleSection = (key: Section) => {
      setActiveSection((prev) => (prev === key ? null : key));
      if (key !== "emoji") setShowEmojiPicker(null);
    };

    return (
      <div
        className={cn(
          "bg-white border border-slate-200 rounded-xl shadow-xl p-3",
          className,
        )}
        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-900 truncate flex-1 mr-2">
            &ldquo;{wordText}&rdquo;
          </h4>
          <div className="flex items-center gap-1">
            {hasOverrides && (
              <button
                onClick={onReset}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Reset to global"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mb-2">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSection(s.key)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[10px] font-medium transition-colors",
                activeSection === s.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : s.hasValue
                    ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Expanded section */}
        {activeSection === "font" && renderFontSection()}
        {activeSection === "size" && renderSizeSection()}
        {activeSection === "color" && renderColorSection()}
        {activeSection === "effect" && renderEffectSection()}
        {activeSection === "emoji" && renderEmojiSection()}
      </div>
    );
  }

  // --- Full (desktop) layout ---

  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-72",
        className,
      )}
      style={{
        fontFamily: "var(--font-outfit), sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-900 truncate flex-1 mr-2">
          Style: &ldquo;{wordText}&rdquo;
        </h4>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {renderFontSection()}
        {renderSizeSection()}
        {renderColorSection()}
        {renderEffectSection()}
        {renderEmojiSection()}

        {/* Reset All */}
        {hasOverrides && (
          <Button
            onClick={onReset}
            variant="outline"
            size="sm"
            className="w-full text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Global Style
          </Button>
        )}
      </div>
    </div>
  );
}
