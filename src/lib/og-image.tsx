import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/*
 * Social card (Open Graph / Twitter), rendered once at build time by `next/og`.
 * Satori can't read the theme's CSS variables, so this file uses CSS named colors that match
 * the light theme: white ≈ --background, black ≈ --foreground, gray ≈ --muted-foreground,
 * gainsboro ≈ --border and royalblue ≈ --highlight.
 */

// next/og only bundles one regular font, so `fontWeight` did nothing (review slice 3, O3).
// Geist (the app's font, OFL, from the `geist` package) in the three weights used here.
// Read once at module scope: it doesn't depend on the request, so the images stay static.
const GEIST = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
const FONTS = await Promise.all(
  ([
    [400, "Geist-Regular.ttf"],
    [600, "Geist-SemiBold.ttf"],
    [700, "Geist-Bold.ttf"],
  ] as const).map(async ([weight, file]) => ({
    name: "Geist",
    data: await readFile(join(GEIST, file)),
    weight,
    style: "normal" as const,
  })),
);

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "universe: un mapa de nodos conectados, cada uno con su explicación.";

const CARD = { width: 206, height: 92 };
const ROW_Y = 330;
const COLUMNS = [64, 304, 544, 784];
const STEPS = [
  { title: "Problema", summary: "Qué duele y a quién." },
  { title: "Versión mínima", summary: "Lo más chico que funciona." },
  { title: "README", summary: "Qué es y cómo probarlo." },
  { title: "Lanzamiento", summary: "Demo, anuncio y feedback." },
];

function Card({ x, y, title, summary, selected }: { x: number; y: number; title: string; summary: string; selected?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: CARD.width,
        height: CARD.height,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 12,
        background: "white",
        border: selected ? "2px solid royalblue" : "1px solid gainsboro",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 600, color: "black" }}>{title}</div>
      <div style={{ fontSize: 16, color: "gray" }}>{summary}</div>
    </div>
  );
}

export function renderOgImage() {
  const mid = ROW_Y + CARD.height / 2;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "white",
          fontFamily: "Geist",
        }}
      >
        <div style={{ position: "absolute", left: 64, top: 64, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: "black", letterSpacing: -2 }}>universe</div>
          <div style={{ fontSize: 34, color: "black" }}>Mapea cualquier sistema como un mapa explorable.</div>
          <div style={{ fontSize: 24, color: "gray" }}>
            Nodos conectados, cada uno con su explicación. Sin backend, sin IA, código abierto.
          </div>
        </div>

        {/* Main path: solid lines between the cards. */}
        {COLUMNS.slice(1).map((x, i) => (
          <div
            key={x}
            style={{
              position: "absolute",
              left: COLUMNS[i] + CARD.width,
              top: mid,
              width: x - COLUMNS[i] - CARD.width,
              height: 2,
              background: i === 0 ? "royalblue" : "black",
            }}
          />
        ))}
        {STEPS.map((step, i) => (
          <Card key={step.title} x={COLUMNS[i]} y={ROW_Y} {...step} selected={i === 1} />
        ))}

        {/* A branch below the second step and an edge case below the last one. */}
        <div
          style={{
            position: "absolute",
            left: COLUMNS[1] + CARD.width / 2,
            top: ROW_Y + CARD.height,
            width: 2,
            height: 52,
            borderLeft: "2px dashed royalblue",
          }}
        />
        <Card x={COLUMNS[1]} y={ROW_Y + CARD.height + 52} title="El alcance crece" summary="Cortar a un slice." />
        <div
          style={{
            position: "absolute",
            left: COLUMNS[3] + CARD.width / 2,
            top: ROW_Y + CARD.height,
            width: 2,
            height: 52,
            borderLeft: "2px dashed gray",
          }}
        />
        <Card x={COLUMNS[3]} y={ROW_Y + CARD.height + 52} title="Nadie responde" summary="Probar en otro lugar." />
      </div>
    ),
    { ...OG_SIZE, fonts: FONTS },
  );
}
