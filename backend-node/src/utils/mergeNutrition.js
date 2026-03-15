export const NUTRIENT_KEYS = [
  "calories",
  "totalFat_g",
  "saturatedFat_g",
  "transFat_g",
  "cholesterol_mg",
  "sodium_mg",
  "totalCarbs_g",
  "fiber_g",
  "sugar_g",
  "addedSugar_g",
  "protein_g"
];

export function emptyNutritionMap() {
  return NUTRIENT_KEYS.reduce((acc, key) => {
    acc[key] = { value: null, source: "unknown" };
    return acc;
  }, {});
}

export function metric(value, source) {
  return {
    value: typeof value === "number" && Number.isFinite(value) ? value : null,
    source: value == null ? "unknown" : source
  };
}

export function createLabelNutritionMap(visibleNutrition = {}) {
  return NUTRIENT_KEYS.reduce((acc, key) => {
    const value = visibleNutrition[key];
    acc[key] = metric(value, "label");
    return acc;
  }, {});
}

export function applySourceValues(nutrition, values = {}, source) {
  const next = { ...(nutrition || emptyNutritionMap()) };

  for (const key of NUTRIENT_KEYS) {
    const current = next[key] || { value: null, source: "unknown" };
    const incoming = values[key];
    if (current.value != null || typeof incoming !== "number" || !Number.isFinite(incoming)) {
      continue;
    }
    next[key] = {
      value: incoming,
      source
    };
  }

  return next;
}

export function countKnownValues(sourceMap = {}, sources = null) {
  const allowed = Array.isArray(sources) ? new Set(sources) : null;
  return NUTRIENT_KEYS.filter((key) => {
    const entry = sourceMap[key];
    if (entry?.value == null) {
      return false;
    }
    if (!allowed) {
      return true;
    }
    return allowed.has(entry.source);
  }).length;
}

export function countUnknownValues(sourceMap = {}) {
  return NUTRIENT_KEYS.filter((key) => sourceMap[key]?.value == null).length;
}

export function countBySource(sourceMap = {}, source) {
  return NUTRIENT_KEYS.filter((key) => sourceMap[key]?.source === source && sourceMap[key]?.value != null).length;
}

export function buildSourcePrioritySummary(nutrition = {}) {
  return {
    label: countBySource(nutrition, "label"),
    researched_online: countBySource(nutrition, "researched_online"),
    estimated_category: countBySource(nutrition, "estimated_category"),
    unknown: countUnknownValues(nutrition)
  };
}
