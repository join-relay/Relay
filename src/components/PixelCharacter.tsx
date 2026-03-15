"use client";

import type { ProfileCharacter } from "@/lib/profile-character";

/**
 * Profile avatar that reflects energy (1-5) and overwhelm (1-5).
 * Supports custom style and accent color from profile.
 */
type Props = {
  energy?: number; // 1-5, 5 = full
  overwhelm?: number; // 1-5, 5 = max stress
  size?: "sm" | "md";
  profile?: ProfileCharacter | null;
};

const SIZE_MAP = { sm: 40, md: 56 };

const STYLE_RING_WIDTH = { minimal: 3, friendly: 3, bold: 4 } as const;

export default function PixelCharacter({ energy = 3, overwhelm = 2, size = "md", profile }: Props) {
  const px = SIZE_MAP[size];
  const tired = (energy ?? 3) <= 2;
  const stressed = (overwhelm ?? 2) >= 4;
  const style = profile?.style ?? "minimal";
  const ringWidth = STYLE_RING_WIDTH[style] ?? 3;
  // Ring: custom accent, or teal / amber / red by state
  const ringColor =
    profile?.accentColor ||
    (stressed ? "var(--pixel-stress)" : tired ? "#d97706" : "var(--pixel-highlight)");
  const bgColor = profile?.accentColor ? `${profile.accentColor}40` : "var(--pixel-highlight)";

  return (
    <div
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full transition-colors"
      style={{
        width: px,
        height: px,
        borderWidth: ringWidth,
        borderStyle: "solid",
        borderColor: ringColor,
        backgroundColor: bgColor,
        color: "var(--pixel-panel-dark)",
      }}
      aria-hidden
    >
      <svg
        width={px * 0.5}
        height={px * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={style === "bold" ? 2.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-90"
      >
        {/* Head */}
        <circle cx="12" cy="8" r="3.5" />
        {/* Shoulders / body; friendly = slight curve for smile feel */}
        {style === "friendly" ? (
          <path d="M8 22c0-3 2-5 4-6s4 1 4 6" />
        ) : (
          <path d="M5 22c0-4 3-7 7-7s7 3 7 7" />
        )}
      </svg>
    </div>
  );
}
