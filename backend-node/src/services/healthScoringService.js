const ULTRA_PROCESSED_CUES = [
  "nitrite",
  "nitrate",
  "maltodextrin",
  "monosodium glutamate",
  "msg",
  "artificial flavor",
  "artificial colour",
  "artificial color",
  "preservative",
  "hydrogenated",
  "corn syrup",
  "sodium benzoate",
  "bht",
  "bha",
  "tbhq",
  "polysorbate"
];

function clampScore(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 10) {
    return 10;
  }
  return value;
}

function valueOf(nutrition, key) {
  const item = nutrition?.[key];
  return typeof item?.value === "number" ? item.value : null;
}

function sourceOf(nutrition, key) {
  const source = nutrition?.[key]?.source;
  return source === "label" ||
    source === "researched_online" ||
    source === "estimated_category" ||
    source === "unknown"
    ? source
    : "unknown";
}

function sourceText(source) {
  if (source === "label") {
    return "from visible label";
  }
  if (source === "researched_online") {
    return "from online product data";
  }
  if (source === "estimated_category") {
    return "estimated from food type";
  }
  return "unknown from visible label";
}

function hasUltraProcessedCue(ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return false;
  }
  const text = ingredients.join(" ").toLowerCase();
  return ULTRA_PROCESSED_CUES.some((cue) => text.includes(cue));
}

function applyPenalty(current, amount, source) {
  if (source === "estimated_category") {
    return current - Math.max(1, amount - 1);
  }
  return current - amount;
}

export function evaluateHealthProfile(scan) {
  const warnings = [];
  let score = 8;

  const sodium = valueOf(scan.nutrition, "sodium_mg");
  const sodiumSource = sourceOf(scan.nutrition, "sodium_mg");
  if (typeof sodium === "number") {
    if (sodium > 700) {
      score = applyPenalty(score, 4, sodiumSource);
      warnings.push(`High sodium detected ${sourceText(sodiumSource)}.`);
    } else if (sodium > 400) {
      score = applyPenalty(score, 3, sodiumSource);
      warnings.push(`Moderately high sodium detected ${sourceText(sodiumSource)}.`);
    }
  } else if (scan.estimatedInsights?.sodiumLikelihood) {
    score -= 1;
    warnings.push(`Estimated sodium guidance: ${scan.estimatedInsights.sodiumLikelihood}`);
  }

  const satFat = valueOf(scan.nutrition, "saturatedFat_g");
  const satFatSource = sourceOf(scan.nutrition, "saturatedFat_g");
  if (typeof satFat === "number") {
    if (satFat > 8) {
      score = applyPenalty(score, 3, satFatSource);
      warnings.push(`High saturated fat detected ${sourceText(satFatSource)}.`);
    } else if (satFat > 5) {
      score = applyPenalty(score, 2, satFatSource);
      warnings.push(`Moderately high saturated fat detected ${sourceText(satFatSource)}.`);
    }
  }

  const sugar = valueOf(scan.nutrition, "sugar_g");
  const sugarSource = sourceOf(scan.nutrition, "sugar_g");
  if (typeof sugar === "number") {
    if (sugar > 30) {
      score = applyPenalty(score, 3, sugarSource);
      warnings.push(`High sugar detected ${sourceText(sugarSource)}.`);
    } else if (sugar > 22) {
      score = applyPenalty(score, 2, sugarSource);
      warnings.push(`Moderately high sugar detected ${sourceText(sugarSource)}.`);
    }
  } else if (
    typeof scan.estimatedInsights?.sugarLikelihood === "string" &&
    scan.estimatedInsights.sugarLikelihood.toLowerCase().includes("high")
  ) {
    score -= 1;
    warnings.push(`Estimated sugar guidance: ${scan.estimatedInsights.sugarLikelihood}`);
  }

  const protein = valueOf(scan.nutrition, "protein_g");
  const proteinSource = sourceOf(scan.nutrition, "protein_g");
  if (typeof protein === "number" && protein < 3) {
    score = applyPenalty(score, 1.5, proteinSource);
    warnings.push(`Low protein detected ${sourceText(proteinSource)}.`);
  }

  if (hasUltraProcessedCue(scan.ingredients)) {
    score -= 1.5;
    warnings.push("Likely ultra-processed ingredients detected.");
  } else if (
    typeof scan.estimatedInsights?.processingLevel === "string" &&
    scan.estimatedInsights.processingLevel.toLowerCase().includes("processed")
  ) {
    score -= 1;
    warnings.push(`Processing estimate: ${scan.estimatedInsights.processingLevel}`);
  }

  if (Array.isArray(scan.allergens) && scan.allergens.length > 0) {
    score -= 1;
    warnings.push(`Allergen presence: ${scan.allergens.join(", ")}.`);
  }

  const unknownCount = Object.values(scan.nutrition || {}).filter(
    (item) => item?.source === "unknown"
  ).length;
  if (unknownCount >= 6) {
    score -= 1.5;
    warnings.push("Many nutrients are unknown from the visible label.");
  } else if (unknownCount >= 4) {
    score -= 1;
    warnings.push("Several nutrients are still unknown from the visible label.");
  }

  const finalScore = clampScore(score);
  const explanation =
    warnings.length > 0
      ? `Health score ${finalScore}/10. Main concerns: ${warnings.join(" ")}`
      : `Health score ${finalScore}/10. No major risk signals were confirmed from the available evidence.`;

  return {
    score: finalScore,
    warnings,
    explanation
  };
}
