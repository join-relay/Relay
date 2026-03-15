/** Preset 8-bit icons (fixed, not modifiable). */
export type PresetIconId = "knight" | "moon" | "star" | "heart" | "sun" | "shield";

/** Skin tone for custom character face */
export type SkinColor = "fair" | "medium" | "dark" | "warm";
/** Eye style for custom character */
export type EyesStyle = "normal" | "happy" | "tired";
/** Mouth style for custom character */
export type MouthStyle = "neutral" | "smile" | "line";

/** User-customized profile character, persisted in localStorage. */
export interface ProfileCharacter {
  displayName?: string;
  /** "custom" = build with head/torso/hair; "icon" = use a preset 8-bit icon */
  mode?: "custom" | "icon";
  /** When mode === "icon", which preset to show */
  iconId?: PresetIconId;
  /** When mode === "custom", hairstyle */
  hair?: "none" | "short" | "long" | "curly" | "spiky";
  /** When mode === "custom", skin tone */
  skinColor?: SkinColor;
  /** When mode === "custom", eye style */
  eyes?: EyesStyle;
  /** When mode === "custom", mouth style */
  mouth?: MouthStyle;
  /** When mode === "custom", torso style */
  torso?: "shirt" | "sweater" | "hoodie";
  style?: "minimal" | "friendly" | "bold";
  accentColor?: string;
}

const STORAGE_KEY = "gsuite-wellbeing-profile-character";

export function loadProfileCharacter(): ProfileCharacter {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProfileCharacter) : {};
  } catch {
    return {};
  }
}

export function saveProfileCharacter(profile: ProfileCharacter): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}
