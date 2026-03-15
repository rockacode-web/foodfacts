import type { IntakeLogEntry, IntakeNutrients } from "../types";

const INTAKE_STORAGE_KEY = "foodfacts.intake.entries";

type IntakeEntryInput = {
  source: "latest" | "saved";
  sourceScanId?: number | null;
  title: string;
  summary: string;
  analysisMode?: string | null;
  healthScore?: number | null;
  confidenceScore?: number | null;
  nutrients: IntakeNutrients;
};

const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const safeParseEntries = (rawValue: string | null): IntakeLogEntry[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as IntakeLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistEntries = (entries: IntakeLogEntry[]) => {
  window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(entries));
};

const buildFingerprint = (entry: IntakeEntryInput) => {
  if (entry.sourceScanId != null) {
    return `scan:${entry.sourceScanId}`;
  }

  return `title:${entry.title.trim().toLowerCase()}`;
};

export const getStoredIntakeEntries = () =>
  safeParseEntries(window.localStorage.getItem(INTAKE_STORAGE_KEY));

export const getTodayIntakeEntries = () => {
  const key = todayKey();
  return getStoredIntakeEntries().filter((entry) => entry.dateKey === key);
};

export const isScanLoggedToday = (sourceScanId: number | null | undefined) => {
  if (sourceScanId == null) {
    return false;
  }

  return getTodayIntakeEntries().some((entry) => entry.sourceScanId === sourceScanId);
};

export const addEntryToDailyIntake = (entry: IntakeEntryInput) => {
  const entries = getStoredIntakeEntries();
  const dateKey = todayKey();
  const fingerprint = buildFingerprint(entry);

  const existing = entries.find((item) => {
    const itemFingerprint =
      item.sourceScanId != null ? `scan:${item.sourceScanId}` : `title:${item.title.trim().toLowerCase()}`;
    return item.dateKey === dateKey && itemFingerprint === fingerprint;
  });

  if (existing) {
    existing.servings += 1;
    existing.loggedAt = new Date().toISOString();
    persistEntries(entries);
    return existing;
  }

  const createdEntry: IntakeLogEntry = {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    dateKey,
    loggedAt: new Date().toISOString(),
    source: entry.source,
    sourceScanId: entry.sourceScanId ?? null,
    title: entry.title,
    summary: entry.summary,
    servings: 1,
    analysisMode: entry.analysisMode ?? null,
    healthScore: entry.healthScore ?? null,
    confidenceScore: entry.confidenceScore ?? null,
    nutrients: entry.nutrients
  };

  entries.unshift(createdEntry);
  persistEntries(entries);
  return createdEntry;
};

export const removeIntakeEntry = (entryId: string) => {
  const nextEntries = getStoredIntakeEntries().filter((entry) => entry.id !== entryId);
  persistEntries(nextEntries);
};
