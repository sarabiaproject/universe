import { ImageResponse } from "next/og";

// Home screen icon, rendered at build time. Same mark as icon.svg (named colors: see og-image.tsx).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="black" />
        <path d="M7 13h18M16 13l5 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="7" cy="13" r="3" fill="white" />
        <circle cx="16" cy="13" r="3" fill="royalblue" />
        <circle cx="25" cy="13" r="3" fill="white" />
        <circle cx="21" cy="21" r="2.5" fill="white" />
      </svg>
    ),
    size,
  );
}
