"use client";

import { ChangeEvent, useMemo } from "react";
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
import { X, RotateCcw } from "lucide-react";
import type { WordStyleOverride } from "@/lib/utils";

const fontOptions = Object.values(FONT_FAMILIES);

interface WordStylePopoverProps {
  wordText: string;
  override: WordStyleOverride;
  onChange: (override: WordStyleOverride) => void;
  onReset: () => void;
  onClose: () => void;
}

export function WordStylePopover({
  wordText,
  override,
  onChange,
  onReset,
  onClose,
}: WordStylePopoverProps) {
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

  const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...override, color: e.target.value });
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

  const hasOverrides =
    override.fontFamily !== undefined ||
    override.fontSize !== undefined ||
    override.color !== undefined;

  return (
    <div
      className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-72"
      style={{
        fontFamily: "var(--font-outfit), sans-serif",
        top: "8px",
        right: "8px",
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
        {/* Font Family */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 block">Font</label>
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

        {/* Font Size */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Size</label>
            <span className="text-xs text-slate-400 tabular-nums">{sizePercent}%</span>
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

        {/* Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 block">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={override.color ?? "#FFFFFF"}
              onChange={handleColorChange}
              className="w-8 h-8 rounded cursor-pointer border border-slate-200"
            />
            {override.color ? (
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs uppercase text-slate-500">{override.color}</span>
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
