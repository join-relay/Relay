import path from "path";
import fs from "fs";
import type {
  CalendarEvent,
  EmailMessage,
  DocSummary,
  WellbeingCheckIn,
  WorkLifeContext,
} from "@/types/context";
import { buildWorkLifeContext } from "./analysis";

const DATA_DIR = path.join(process.cwd(), "data");
const TOKENS_FILE = path.join(DATA_DIR, "tokens.json");
const CONTEXT_FILE = path.join(DATA_DIR, "context.json");
const WELLBEING_FILE = path.join(DATA_DIR, "wellbeing.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export type AuthProvider = "google" | "microsoft";

export interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

export interface TokenStore {
  provider: AuthProvider;
  google?: StoredTokens;
  microsoft?: StoredTokens;
}

function loadRawTokenStore(): TokenStore | null {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data.provider && (data.provider === "google" || data.provider === "microsoft"))
      return data as TokenStore;
    if (data.access_token) {
      return { provider: "google", google: data as StoredTokens };
    }
    return null;
  } catch {
    return null;
  }
}

export function getProvider(): AuthProvider | null {
  const store = loadRawTokenStore();
  return store?.provider ?? null;
}

export function saveTokensForProvider(provider: AuthProvider, tokens: StoredTokens): void {
  ensureDataDir();
  const store = loadRawTokenStore() || { provider, google: undefined, microsoft: undefined };
  store.provider = provider;
  if (provider === "google") store.google = tokens;
  else store.microsoft = tokens;
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function saveTokens(tokens: StoredTokens): void {
  saveTokensForProvider("google", tokens);
}

export function loadTokens(): StoredTokens | null {
  const store = loadRawTokenStore();
  if (!store) return null;
  return store.provider === "google" ? store.google ?? null : store.microsoft ?? null;
}

export function loadTokensForProvider(provider: AuthProvider): StoredTokens | null {
  const store = loadRawTokenStore();
  if (!store) return null;
  return provider === "google" ? store.google ?? null : store.microsoft ?? null;
}

export interface RawContextStore {
  lastSyncedAt: string | null;
  calendarEvents: CalendarEvent[];
  emailMessages: EmailMessage[];
  docSummaries: DocSummary[];
}

export function saveContextStore(store: RawContextStore): void {
  ensureDataDir();
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function loadContextStore(): RawContextStore {
  if (!fs.existsSync(CONTEXT_FILE)) {
    return {
      lastSyncedAt: null,
      calendarEvents: [],
      emailMessages: [],
      docSummaries: [],
    };
  }
  try {
    const raw = fs.readFileSync(CONTEXT_FILE, "utf-8");
    return JSON.parse(raw) as RawContextStore;
  } catch {
    return {
      lastSyncedAt: null,
      calendarEvents: [],
      emailMessages: [],
      docSummaries: [],
    };
  }
}

export function saveWellbeingCheckIns(checkIns: WellbeingCheckIn[]): void {
  ensureDataDir();
  fs.writeFileSync(WELLBEING_FILE, JSON.stringify(checkIns, null, 2), "utf-8");
}

export function loadWellbeingCheckIns(): WellbeingCheckIn[] {
  if (!fs.existsSync(WELLBEING_FILE)) return [];
  try {
    const raw = fs.readFileSync(WELLBEING_FILE, "utf-8");
    return JSON.parse(raw) as WellbeingCheckIn[];
  } catch {
    return [];
  }
}

export function appendWellbeingCheckIn(checkIn: WellbeingCheckIn): void {
  const list = loadWellbeingCheckIns();
  list.push(checkIn);
  saveWellbeingCheckIns(list);
}

export function getWorkLifeContext(): WorkLifeContext | null {
  const store = loadContextStore();
  const wellbeing = loadWellbeingCheckIns();
  const hasData =
    store.lastSyncedAt ||
    store.calendarEvents.length > 0 ||
    store.emailMessages.length > 0 ||
    store.docSummaries.length > 0;
  if (!hasData) return null;
  const latest = wellbeing.length > 0 ? wellbeing[wellbeing.length - 1] : null;
  const trend = wellbeing.slice(-10);
  return buildWorkLifeContext(store, latest, trend);
}
