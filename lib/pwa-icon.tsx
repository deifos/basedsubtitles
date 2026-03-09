import { ImageResponse } from "next/og";

interface PwaIconResponseOptions {
  size: number;
}

export function createPwaIconResponse({
  size,
}: PwaIconResponseOptions): ImageResponse {
  const iconRadius = Math.round(size * 0.22);
  const monogramFontSize = Math.round(size * 0.42);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        borderRadius: iconRadius,
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#ffffff",
          fontSize: monogramFontSize,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          paddingLeft: Math.round(size * 0.01),
          fontFamily: "system-ui, sans-serif",
        }}
      >
        BS
      </div>
    </div>,
    {
      width: size,
      height: size,
    },
  );
}
