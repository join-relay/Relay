import path from "path";
import fs from "fs";
import type { YouModel } from "../../types";

const DATA_DIR = path.join(process.cwd(), "data");
const YOU_MODEL_FILE = path.join(DATA_DIR, "you-model.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadYouModel(): YouModel | null {
  if (!fs.existsSync(YOU_MODEL_FILE)) return null;
  try {
    const raw = fs.readFileSync(YOU_MODEL_FILE, "utf-8");
    return JSON.parse(raw) as YouModel;
  } catch {
    return null;
  }
}

export function saveYouModel(model: YouModel): void {
  ensureDataDir();
  fs.writeFileSync(YOU_MODEL_FILE, JSON.stringify(model, null, 2), "utf-8");
}
