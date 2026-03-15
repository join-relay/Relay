"use client";

import type { ProfileCharacter, PresetIconId, SkinColor, EyesStyle, MouthStyle } from "@/lib/profile-character";

const SKIN_COLORS: Record<SkinColor, string> = {
  fair: "#fef3c7",
  medium: "#d4a574",
  dark: "#8d5524",
  warm: "#e8b4a0",
};

const PIXEL = 2;
const W = 16;
const H = 24;
const VIEW_W = W * PIXEL;
const VIEW_H = H * PIXEL;

type Props = {
  profile?: ProfileCharacter | null;
  energy?: number;
  overwhelm?: number;
  size?: "sm" | "md" | "lg" | "xl";
};

const SIZE_MAP = { sm: 40, md: 56, lg: 112, xl: 176 };

/** 8-bit preset icons: knight, moon, star, heart, sun, shield. Fixed design, not modifiable. */
function PresetIcon({ iconId, size }: { iconId: PresetIconId; size: number }) {
  const vb = "0 0 32 32";
  const color = "var(--pixel-text)";
  const light = "var(--pixel-text-light)";
  const accent = "var(--pixel-highlight)";

  switch (iconId) {
    case "knight":
      return (
        <svg viewBox={vb} width={size} height={size} className="block" style={{ imageRendering: "pixelated" }}>
          <rect width="32" height="32" fill="var(--pixel-panel)" />
          {/* Helmet */}
          <rect x="8" y="4" width="16" height="8" fill={color} />
          <rect x="10" y="6" width="12" height="4" fill={light} />
          <rect x="12" y="10" width="8" height="4" fill={color} />
          {/* Visor */}
          <rect x="11" y="8" width="10" height="2" fill="var(--pixel-panel-dark)" />
          {/* Shoulders / armor */}
          <rect x="6" y="14" width="20" height="6" fill={color} />
          <rect x="8" y="16" width="16" height="2" fill={light} />
          <rect x="10" y="18" width="12" height="10" fill={color} />
          <rect x="12" y="20" width="8" height="6" fill={light} />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox={vb} width={size} height={size} className="block" style={{ imageRendering: "pixelated" }}>
          <rect width="32" height="32" fill="var(--pixel-panel)" />
          <circle cx="16" cy="16" r="12" fill={color} />
          <circle cx="22" cy="10" r="8" fill="var(--pixel-panel)" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox={vb} width={size} height={size} className="block" style={{ imageRendering: "pixelated" }}>
          <rect width="32" height="32" fill="var(--pixel-panel)" />
          <polygon
            points="16,4 18,12 26,12 20,17 22,26 16,21 10,26 12,17 6,12 14,12"
            fill={accent}
            stroke={color}
            strokeWidth="1"
          />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox={vb} width={size} height={size} className="block" style={{ imageRendering: "pixelated" }}>
          <rect width="32" height="32" fill="var(--pixel-panel)" />
          <rect x="12" y="6" width="8" height="8" fill="var(--pixel-stress)" />
          <rect x="8" y="10" width="8" height="8" fill="var(--pixel-stress)" />
          <rect x="16" y="10" width="8" height="8" fill="var(--pixel-stress)" />
          <rect x="10" y="14" width="4" height="8" fill="var(--pixel-stress)" />
          <rect x="18" y="14" width="4" height="8" fill="var(--pixel-stress)" />
          <rect x="12" y="18" width="8" height="8" fill="var(--pixel-stress)" />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox={vb} width={size} height={size} className="block" style={{ imageRendering: "pixelated" }}>
          <rect width="32" height="32" fill="var(--pixel-panel)" />
          <circle cx="16" cy="16" r="6" fill="#d97706" />
          <rect x="15" y="4" width="2" height="4" fill="#d97706" />
          <rect x="15" y="24" width="2" height="4" fill="#d97706" />
          <rect x="4" y="15" width="4" height="2" fill="#d97706" />
          <rect x="24" y="15" width="4" height="2" fill="#d97706" />
          <rect x="8" y="8" width="2" height="2" fill="#d97706" transform="rotate(45 9 9)" />
          <rect x="22" y="22" width="2" height="2" fill="#d97706" transform="rotate(45 23 23)" />
          <rect x="22" y="8" width="2" height="2" fill="#d97706" transform="rotate(-45 23 9)" />
          <rect x="8" y="22" width="2" height="2" fill="#d97706" transform="rotate(-45 9 23)" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox={vb} width={size} height={size} className="block" style={{ imageRendering: "pixelated" }}>
          <rect width="32" height="32" fill="var(--pixel-panel)" />
          <rect x="10" y="2" width="12" height="4" fill={color} />
          <rect x="8" y="6" width="16" height="4" fill={color} />
          <rect x="6" y="10" width="20" height="4" fill={color} />
          <rect x="4" y="14" width="24" height="4" fill={color} />
          <rect x="6" y="18" width="20" height="4" fill={color} />
          <rect x="10" y="22" width="12" height="6" fill={color} />
          <rect x="12" y="10" width="8" height="10" fill={light} />
        </svg>
      );
    default:
      return null;
  }
}

/** Custom character: head + torso + hair (8-bit pixel style). */
function CustomCharacter({
  hair,
  skinColor,
  eyes,
  mouth,
  torso,
  accentColor,
  size,
}: {
  hair: NonNullable<ProfileCharacter["hair"]>;
  skinColor: SkinColor;
  eyes: EyesStyle;
  mouth: MouthStyle;
  torso: NonNullable<ProfileCharacter["torso"]>;
  accentColor?: string;
  size: number;
}) {
  const skin = SKIN_COLORS[skinColor] ?? SKIN_COLORS.fair;
  const shirt = accentColor || "var(--pixel-highlight)";
  const hairColor = "#5c4033";
  const eyeColor = "var(--pixel-text)";

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={size}
      height={size}
      className="block"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Torso (drawn first, behind head) */}
      {torso === "shirt" && (
        <>
          <rect x={4 * PIXEL} y={10 * PIXEL} width={8 * PIXEL} height={12 * PIXEL} fill={shirt} />
          <rect x={2 * PIXEL} y={12 * PIXEL} width={4 * PIXEL} height={2 * PIXEL} fill={shirt} />
          <rect x={10 * PIXEL} y={12 * PIXEL} width={4 * PIXEL} height={2 * PIXEL} fill={shirt} />
        </>
      )}
      {torso === "sweater" && (
        <>
          <rect x={4 * PIXEL} y={10 * PIXEL} width={8 * PIXEL} height={12 * PIXEL} fill={shirt} />
          <rect x={4 * PIXEL} y={10 * PIXEL} width={8 * PIXEL} height={2 * PIXEL} fill="var(--pixel-text-light)" />
          <rect x={2 * PIXEL} y={12 * PIXEL} width={12 * PIXEL} height={2 * PIXEL} fill={shirt} />
        </>
      )}
      {torso === "hoodie" && (
        <>
          <rect x={4 * PIXEL} y={10 * PIXEL} width={8 * PIXEL} height={12 * PIXEL} fill={shirt} />
          <rect x={2 * PIXEL} y={8 * PIXEL} width={12 * PIXEL} height={4 * PIXEL} fill={shirt} />
          <rect x={2 * PIXEL} y={12 * PIXEL} width={2 * PIXEL} height={2 * PIXEL} fill={shirt} />
          <rect x={12 * PIXEL} y={12 * PIXEL} width={2 * PIXEL} height={2 * PIXEL} fill={shirt} />
        </>
      )}

      {/* Head (skin) */}
      <rect x={4 * PIXEL} y={0} width={8 * PIXEL} height={6 * PIXEL} fill={skin} />
      <rect x={3 * PIXEL} y={2 * PIXEL} width={10 * PIXEL} height={6 * PIXEL} fill={skin} />
      <rect x={4 * PIXEL} y={6 * PIXEL} width={8 * PIXEL} height={4 * PIXEL} fill={skin} />
      {/* Eyes */}
      {eyes === "normal" && (
        <>
          <rect x={5 * PIXEL} y={3 * PIXEL} width={PIXEL} height={PIXEL} fill={eyeColor} />
          <rect x={9 * PIXEL} y={3 * PIXEL} width={PIXEL} height={PIXEL} fill={eyeColor} />
        </>
      )}
      {eyes === "happy" && (
        <>
          <rect x={5 * PIXEL} y={2 * PIXEL} width={PIXEL} height={PIXEL} fill={eyeColor} />
          <rect x={9 * PIXEL} y={2 * PIXEL} width={PIXEL} height={PIXEL} fill={eyeColor} />
          <rect x={4 * PIXEL} y={4 * PIXEL} width={3 * PIXEL} height={PIXEL} fill={eyeColor} />
          <rect x={8 * PIXEL} y={4 * PIXEL} width={3 * PIXEL} height={PIXEL} fill={eyeColor} />
        </>
      )}
      {eyes === "tired" && (
        <>
          <rect x={5 * PIXEL} y={3 * PIXEL} width={2 * PIXEL} height={PIXEL} fill={eyeColor} />
          <rect x={9 * PIXEL} y={3 * PIXEL} width={2 * PIXEL} height={PIXEL} fill={eyeColor} />
        </>
      )}
      {/* Mouth */}
      {mouth === "neutral" && (
        <rect x={7 * PIXEL} y={5 * PIXEL} width={2 * PIXEL} height={PIXEL} fill={eyeColor} />
      )}
      {mouth === "smile" && (
        <>
          <rect x={6 * PIXEL} y={5 * PIXEL} width={PIXEL} height={PIXEL} fill={eyeColor} />
          <rect x={7 * PIXEL} y={6 * PIXEL} width={2 * PIXEL} height={PIXEL} fill={eyeColor} />
          <rect x={9 * PIXEL} y={5 * PIXEL} width={PIXEL} height={PIXEL} fill={eyeColor} />
        </>
      )}
      {mouth === "line" && (
        <rect x={6 * PIXEL} y={6 * PIXEL} width={4 * PIXEL} height={PIXEL} fill={eyeColor} />
      )}

      {/* Hair overlay */}
      {hair === "short" && (
        <>
          <rect x={4 * PIXEL} y={0} width={2 * PIXEL} height={2 * PIXEL} fill={hairColor} />
          <rect x={8 * PIXEL} y={0} width={2 * PIXEL} height={2 * PIXEL} fill={hairColor} />
          <rect x={10 * PIXEL} y={0} width={2 * PIXEL} height={2 * PIXEL} fill={hairColor} />
          <rect x={3 * PIXEL} y={2 * PIXEL} width={2 * PIXEL} height={2 * PIXEL} fill={hairColor} />
          <rect x={11 * PIXEL} y={2 * PIXEL} width={2 * PIXEL} height={2 * PIXEL} fill={hairColor} />
        </>
      )}
      {hair === "long" && (
        <>
          <rect x={3 * PIXEL} y={0} width={10 * PIXEL} height={6 * PIXEL} fill={hairColor} />
          <rect x={4 * PIXEL} y={6 * PIXEL} width={2 * PIXEL} height={6 * PIXEL} fill={hairColor} />
          <rect x={8 * PIXEL} y={6 * PIXEL} width={2 * PIXEL} height={6 * PIXEL} fill={hairColor} />
          <rect x={10 * PIXEL} y={6 * PIXEL} width={2 * PIXEL} height={6 * PIXEL} fill={hairColor} />
          <rect x={3 * PIXEL} y={4 * PIXEL} width={2 * PIXEL} height={8 * PIXEL} fill={hairColor} />
          <rect x={11 * PIXEL} y={4 * PIXEL} width={2 * PIXEL} height={8 * PIXEL} fill={hairColor} />
        </>
      )}
      {hair === "curly" && (
        <>
          <rect x={3 * PIXEL} y={0} width={10 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={2 * PIXEL} y={2 * PIXEL} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={12 * PIXEL} y={2 * PIXEL} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={4 * PIXEL} y={4 * PIXEL} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={8 * PIXEL} y={4 * PIXEL} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={10 * PIXEL} y={4 * PIXEL} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
        </>
      )}
      {hair === "spiky" && (
        <>
          <rect x={4 * PIXEL} y={0} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={8 * PIXEL} y={0} width={2 * PIXEL} height={6 * PIXEL} fill={hairColor} />
          <rect x={10 * PIXEL} y={0} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={2 * PIXEL} y={2 * PIXEL} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={12 * PIXEL} y={2 * PIXEL} width={2 * PIXEL} height={4 * PIXEL} fill={hairColor} />
          <rect x={6 * PIXEL} y={0} width={2 * PIXEL} height={2 * PIXEL} fill={hairColor} />
        </>
      )}
    </svg>
  );
}

/** Fallback: simple circle avatar (original PixelCharacter style) when no custom/icon chosen. */
function DefaultAvatar({ accentColor, size }: { accentColor?: string; size: number }) {
  const ring = accentColor || "var(--pixel-highlight)";
  return (
    <div
      className="inline-flex items-center justify-center rounded-full border-[3px] flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderColor: ring,
        backgroundColor: accentColor ? `${accentColor}40` : "var(--pixel-highlight)",
        color: "var(--pixel-panel-dark)",
      }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 22c0-4 3-7 7-7s7 3 7 7" />
      </svg>
    </div>
  );
}

export default function CharacterDisplay({ profile, energy = 3, overwhelm = 2, size = "md" }: Props) {
  const px = SIZE_MAP[size];
  const stressed = (overwhelm ?? 2) >= 4;
  const tired = (energy ?? 3) <= 2;
  const ringColor =
    profile?.accentColor ||
    (stressed ? "var(--pixel-stress)" : tired ? "#d97706" : "var(--pixel-highlight)");

  if (profile?.mode === "icon" && profile.iconId) {
    return (
      <div
        className="inline-flex flex-shrink-0 items-center justify-center rounded-lg border-2 overflow-hidden"
        style={{
          width: px,
          height: px,
          borderColor: ringColor,
          backgroundColor: "var(--pixel-panel)",
        }}
      >
        <PresetIcon iconId={profile.iconId} size={px - 8} />
      </div>
    );
  }

  if (profile?.mode === "custom") {
    const hair = profile.hair ?? "none";
    const skinColor = profile.skinColor ?? "fair";
    const eyes = profile.eyes ?? "normal";
    const mouth = profile.mouth ?? "neutral";
    const torso = profile.torso ?? "shirt";
    return (
      <div
        className="inline-flex flex-shrink-0 items-center justify-center rounded-lg border-2 overflow-hidden"
        style={{
          width: px,
          height: px,
          borderColor: ringColor,
          backgroundColor: "var(--pixel-panel)",
        }}
      >
        <CustomCharacter
          hair={hair}
          skinColor={skinColor}
          eyes={eyes}
          mouth={mouth}
          torso={torso}
          accentColor={profile.accentColor}
          size={px - 8}
        />
      </div>
    );
  }

  return <DefaultAvatar accentColor={profile?.accentColor} size={px} />;
}
