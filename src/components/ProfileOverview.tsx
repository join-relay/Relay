"use client";

import { useState, useEffect } from "react";
import CharacterDisplay from "./CharacterDisplay";
import type { WorkLifeContext } from "@/types/context";
import type { ProfileCharacter, PresetIconId, SkinColor, EyesStyle, MouthStyle } from "@/lib/profile-character";
import { loadProfileCharacter, saveProfileCharacter } from "@/lib/profile-character";
import { getScheduleSummary } from "@/lib/schedule-summary";

const PRESET_ICONS: { id: PresetIconId; label: string }[] = [
  { id: "knight", label: "Knight" },
  { id: "moon", label: "Moon" },
  { id: "star", label: "Star" },
  { id: "heart", label: "Heart" },
  { id: "sun", label: "Sun" },
  { id: "shield", label: "Shield" },
];

const HAIR_OPTIONS: { value: NonNullable<ProfileCharacter["hair"]>; label: string }[] = [
  { value: "none", label: "None" },
  { value: "short", label: "Short" },
  { value: "long", label: "Long" },
  { value: "curly", label: "Curly" },
  { value: "spiky", label: "Spiky" },
];

const SKIN_OPTIONS: { value: SkinColor; label: string }[] = [
  { value: "fair", label: "Fair" },
  { value: "medium", label: "Medium" },
  { value: "dark", label: "Dark" },
  { value: "warm", label: "Warm" },
];

const EYES_OPTIONS: { value: EyesStyle; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "happy", label: "Happy" },
  { value: "tired", label: "Tired" },
];

const MOUTH_OPTIONS: { value: MouthStyle; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "smile", label: "Smile" },
  { value: "line", label: "Line" },
];

const TORSO_OPTIONS: { value: NonNullable<ProfileCharacter["torso"]>; label: string }[] = [
  { value: "shirt", label: "Shirt" },
  { value: "sweater", label: "Sweater" },
  { value: "hoodie", label: "Hoodie" },
];

/** Single arrow button — left (prev) or right (next), no text. For spatial layout by character. */
function WardrobeArrow<T extends string>({
  direction,
  options,
  value,
  onChange,
  ariaLabel,
}: {
  direction: "prev" | "next";
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const idx = options.findIndex((o) => o.value === value);
  const delta = direction === "prev" ? -1 : 1;
  const go = () => {
    const next = options[(idx + delta + options.length) % options.length];
    onChange(next.value);
  };
  return (
    <button
      type="button"
      onClick={go}
      className="w-9 h-9 flex items-center justify-center rounded border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] hover:bg-[var(--pixel-highlight)]/20 text-[var(--pixel-text)] text-xl font-bold leading-none transition-colors"
      aria-label={direction === "prev" ? `Previous ${ariaLabel}` : `Next ${ariaLabel}`}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

type Props = {
  context: WorkLifeContext | null | "loading";
};

export default function ProfileOverview({ context }: Props) {
  const loading = context === "loading";
  const noData = !context || (!loading && !context.wellbeing?.latest && !context.lastSyncedAt);

  const energy = context && context !== "loading" ? context.wellbeing?.latest?.energyScore : undefined;
  const overwhelm = context && context !== "loading" ? context.wellbeing?.latest?.overwhelmScore : undefined;
  const derivedStress = context && context !== "loading" ? context.derivedStress : undefined;
  const loadForDisplay = overwhelm ?? derivedStress?.score;
  const feelingFromData = !context?.wellbeing?.latest && derivedStress;

  const summaryText =
    context && context !== "loading"
      ? getScheduleSummary(context)
      : loading
        ? "Loading…"
        : "Sync your calendar to see a summary of your day.";

  const [profile, setProfile] = useState<ProfileCharacter>({});
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMode, setEditMode] = useState<"custom" | "icon">("custom");
  const [editIconId, setEditIconId] = useState<PresetIconId>("knight");
  const [editHair, setEditHair] = useState<NonNullable<ProfileCharacter["hair"]>>("none");
  const [editSkin, setEditSkin] = useState<SkinColor>("fair");
  const [editEyes, setEditEyes] = useState<EyesStyle>("normal");
  const [editMouth, setEditMouth] = useState<MouthStyle>("neutral");
  const [editTorso, setEditTorso] = useState<NonNullable<ProfileCharacter["torso"]>>("shirt");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    setProfile(loadProfileCharacter());
  }, []);

  useEffect(() => {
    setEditName(profile.displayName ?? "");
    setEditMode(profile.mode ?? "custom");
    setEditIconId(profile.iconId ?? "knight");
    setEditHair(profile.hair ?? "none");
    setEditSkin(profile.skinColor ?? "fair");
    setEditEyes(profile.eyes ?? "normal");
    setEditMouth(profile.mouth ?? "neutral");
    setEditTorso(profile.torso ?? "shirt");
    setEditColor(profile.accentColor ?? "");
  }, [profile.displayName, profile.mode, profile.iconId, profile.hair, profile.skinColor, profile.eyes, profile.mouth, profile.torso, profile.accentColor]);

  function saveCustomize() {
    const next: ProfileCharacter = {
      displayName: editName.trim() || undefined,
      mode: editMode,
      iconId: editMode === "icon" ? editIconId : undefined,
      hair: editMode === "custom" ? editHair : undefined,
      skinColor: editMode === "custom" ? editSkin : undefined,
      eyes: editMode === "custom" ? editEyes : undefined,
      mouth: editMode === "custom" ? editMouth : undefined,
      torso: editMode === "custom" ? editTorso : undefined,
      accentColor: editColor.trim() || undefined,
    };
    saveProfileCharacter(next);
    setProfile(next);
    setCustomizeOpen(false);
  }

  return (
    <section
      className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-5 shadow-md"
    >
      <div className="flex flex-wrap items-start gap-5">
        {/* Profile avatar + optional name */}
        <div className="flex flex-col items-center gap-2">
          <CharacterDisplay
            profile={Object.keys(profile).length > 0 ? profile : null}
            energy={energy ?? 3}
            overwhelm={overwhelm ?? 2}
            size="md"
          />
          <span className="text-[10px] text-[var(--pixel-text-light)] uppercase tracking-wider font-medium">
            {profile.displayName?.trim() || "You"}
          </span>
        </div>

        {/* Stats + summary */}
        <div className="flex-1 min-w-[200px] space-y-3">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[var(--pixel-text-light)]">ENERGY</span>
              <div className="h-3 w-24 rounded-full border border-[var(--pixel-shadow)] bg-[var(--pixel-hp-bg)] overflow-hidden">
                <div
                  className="h-full bg-[var(--pixel-hp)] transition-all"
                  style={{ width: `${((energy ?? 3) / 5) * 100}%` }}
                />
              </div>
              <span className="text-[var(--pixel-text)]">{(energy ?? "—")}/5</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[var(--pixel-text-light)]">LOAD</span>
              <div className="h-3 w-24 rounded-full border border-[var(--pixel-shadow)] bg-[var(--pixel-hp-bg)] overflow-hidden">
                <div
                  className="h-full bg-[var(--pixel-stress)] transition-all"
                  style={{ width: `${((loadForDisplay ?? 0) / 5) * 100}%` }}
                />
              </div>
              <span className="text-[var(--pixel-text)]">
                {(loadForDisplay ?? "—")}/5
                {feelingFromData && (
                  <span className="text-[10px] text-[var(--pixel-text-light)] ml-0.5">(from data)</span>
                )}
              </span>
            </div>
          </div>

          {/* Single natural-language summary */}
          <div className="rounded-lg border border-[var(--pixel-shadow)] bg-[var(--pixel-highlight)]/10 p-3 text-xs leading-relaxed">
            <span className="text-[var(--pixel-text-light)] block mb-0.5 font-medium">Summary</span>
            <p className="text-[var(--pixel-text)]">{summaryText}</p>
          </div>
        </div>
      </div>

      {/* Customize profile / character */}
      <div className="mt-4 pt-4 border-t border-[var(--pixel-shadow)]">
        <button
          type="button"
          onClick={() => setCustomizeOpen((o) => !o)}
          className="text-[10px] uppercase tracking-wider font-medium text-[var(--pixel-highlight)] hover:underline"
        >
          {customizeOpen ? "Hide customizer" : "Customize character"}
        </button>
        {customizeOpen && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--pixel-bg)]/50 space-y-4 text-xs">
            <div>
              <label className="block text-[var(--pixel-text-light)] mb-1">Display name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="You"
                className="w-full max-w-[200px] border border-[var(--pixel-shadow)] rounded px-2 py-1 bg-[var(--pixel-panel)] text-[var(--pixel-text)]"
              />
            </div>

            <div>
              <label className="block text-[var(--pixel-text-light)] mb-1">Character type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditMode("custom")}
                  className={`px-2 py-1 rounded border ${editMode === "custom" ? "bg-[var(--pixel-highlight)]/30 border-[var(--pixel-highlight)]" : "border-[var(--pixel-shadow)]"}`}
                >
                  Custom (head + torso + hair)
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode("icon")}
                  className={`px-2 py-1 rounded border ${editMode === "icon" ? "bg-[var(--pixel-highlight)]/30 border-[var(--pixel-highlight)]" : "border-[var(--pixel-shadow)]"}`}
                >
                  Preset icon
                </button>
              </div>
            </div>

            {editMode === "custom" && (
              <div className="flex items-center justify-center gap-1 min-h-[200px]">
                {/* Left arrows — tight to icon */}
                <div className="flex flex-col justify-between gap-0.5 shrink-0" style={{ height: 176 }}>
                  <WardrobeArrow direction="prev" options={HAIR_OPTIONS} value={editHair} onChange={setEditHair} ariaLabel="hair" />
                  <WardrobeArrow direction="prev" options={SKIN_OPTIONS} value={editSkin} onChange={setEditSkin} ariaLabel="skin" />
                  <WardrobeArrow direction="prev" options={EYES_OPTIONS} value={editEyes} onChange={setEditEyes} ariaLabel="eyes" />
                  <WardrobeArrow direction="prev" options={MOUTH_OPTIONS} value={editMouth} onChange={setEditMouth} ariaLabel="mouth" />
                  <WardrobeArrow direction="prev" options={TORSO_OPTIONS} value={editTorso} onChange={setEditTorso} ariaLabel="shirt" />
                </div>
                {/* Character preview — larger, minimal wrapper so arrows sit right next to it */}
                <div className="shrink-0 flex items-center justify-center rounded-xl border-2 border-[var(--pixel-shadow)] p-1 bg-[var(--pixel-panel)]/50">
                  <CharacterDisplay
                    profile={{
                      mode: "custom",
                      hair: editHair,
                      skinColor: editSkin,
                      eyes: editEyes,
                      mouth: editMouth,
                      torso: editTorso,
                      accentColor: editColor.trim() || undefined,
                    }}
                    size="xl"
                  />
                </div>
                {/* Right arrows — tight to icon */}
                <div className="flex flex-col justify-between gap-0.5 shrink-0" style={{ height: 176 }}>
                  <WardrobeArrow direction="next" options={HAIR_OPTIONS} value={editHair} onChange={setEditHair} ariaLabel="hair" />
                  <WardrobeArrow direction="next" options={SKIN_OPTIONS} value={editSkin} onChange={setEditSkin} ariaLabel="skin" />
                  <WardrobeArrow direction="next" options={EYES_OPTIONS} value={editEyes} onChange={setEditEyes} ariaLabel="eyes" />
                  <WardrobeArrow direction="next" options={MOUTH_OPTIONS} value={editMouth} onChange={setEditMouth} ariaLabel="mouth" />
                  <WardrobeArrow direction="next" options={TORSO_OPTIONS} value={editTorso} onChange={setEditTorso} ariaLabel="shirt" />
                </div>
              </div>
            )}

            {editMode === "icon" && (
              <div>
                <label className="block text-[var(--pixel-text-light)] mb-1">Preset icon (8-bit, fixed design)</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setEditIconId(id)}
                      title={label}
                      className={`p-1.5 rounded border transition-colors ${editIconId === id ? "border-[var(--pixel-highlight)] bg-[var(--pixel-highlight)]/20" : "border-[var(--pixel-shadow)] hover:bg-[var(--pixel-bg)]"}`}
                    >
                      <CharacterDisplay profile={{ mode: "icon", iconId: id }} size="sm" />
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--pixel-text-light)] mt-1">Knight, Moon, Star, Heart, Sun, Shield</p>
              </div>
            )}

            <div>
              <label className="block text-[var(--pixel-text-light)] mb-1">Accent / ring color (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editColor || "#0d9488"}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer border border-[var(--pixel-shadow)] rounded"
                />
                <input
                  type="text"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="#0d9488"
                  className="w-24 border border-[var(--pixel-shadow)] rounded px-2 py-1 bg-[var(--pixel-panel)] text-[var(--pixel-text)] font-mono text-[10px]"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={saveCustomize}
              className="px-3 py-1.5 rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-panel-dark)] text-[var(--pixel-highlight)] font-medium"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {noData && !loading && (
        <p className="mt-3 text-[10px] text-[var(--pixel-text-light)]">
          Do a wellbeing check-in and sync G Suite to fill your profile.
        </p>
      )}
    </section>
  );
}
