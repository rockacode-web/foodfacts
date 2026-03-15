export const ANALYSIS_THRESHOLDS = {
  EXACT_LABEL_CONFIDENCE: 75,
  EXACT_LABEL_MIN_NUTRIENTS: 4,
  PARTIAL_LABEL_CONFIDENCE: 35,
  PARTIAL_LABEL_MIN_NUTRIENTS: 2,
  RESEARCH_TRIGGER_CONFIDENCE: 45,
  CATEGORY_TRIGGER_CONFIDENCE: 40,
  RECIPE_PRODUCT_CONFIDENCE: 50,
  RECIPE_CATEGORY_CONFIDENCE: 40,
  STRONG_WARNING_CONFIDENCE: 70,
  PRELIMINARY_SCORE_CONFIDENCE: 60,
  HIDE_SCORE_CONFIDENCE: 40
};

export function clampPercent(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

export function percentToRatio(value) {
  return clampPercent(value) / 100;
}

export function confidenceLabel(percent) {
  if (percent <= 29) {
    return "very_weak";
  }
  if (percent <= 49) {
    return "weak";
  }
  if (percent <= 69) {
    return "moderate";
  }
  if (percent <= 84) {
    return "strong";
  }
  return "very_strong";
}
