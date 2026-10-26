import { OG_ALT, OG_SIZE, renderOgImage } from "@/lib/og-image";

// Static: rendered once at build time (no request-time APIs).
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage();
}
