"use client";

import { useState, useRef, useEffect } from "react";

interface DebouncedColorInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (value: string) => void;
  delay?: number;
}

/**
 * Color input that debounces onChange to prevent rapid state updates
 * while dragging in the color picker. The swatch updates immediately
 * via local state; the parent only receives updates after the delay.
 */
export function DebouncedColorInput({
  value,
  onChange,
  delay = 150,
  ...props
}: DebouncedColorInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync from parent when value changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, delay);
  };

  return (
    <input type="color" value={localValue} onChange={handleChange} {...props} />
  );
}
