function textParts(scan) {
  return [
    scan.identifiedFood?.brandName || "",
    scan.identifiedFood?.productName || "",
    scan.identifiedFood?.category || "",
    scan.plainLanguageSummary || "",
    ...(scan.ingredients || [])
  ]
    .join(" ")
    .toLowerCase();
}

function valueOf(nutrition, key) {
  return typeof nutrition?.[key]?.value === "number" ? nutrition[key].value : null;
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function inferCategory(scan) {
  const text = textParts(scan);
  const sodium = valueOf(scan.nutrition, "sodium_mg");
  const protein = valueOf(scan.nutrition, "protein_g");
  const sugar = valueOf(scan.nutrition, "sugar_g");
  const calories = valueOf(scan.nutrition, "calories");

  if (
    hasAny(text, ["corned beef", "sausage", "ham", "deli", "cured", "beef", "pork", "nitrite"]) ||
    ((sodium ?? 0) >= 500 && (protein ?? 0) >= 8 && (sugar ?? 0) <= 5)
  ) {
    return {
      category: "processed canned meat",
      categoryConfidence: 0.62,
      productConfidenceFloor: 0.45,
      reason: "High-sodium, high-protein meat cues suggest processed canned meat."
    };
  }

  if (
    hasAny(text, ["cereal", "granola", "breakfast"]) ||
    ((sugar ?? 0) >= 8 && (protein ?? 0) <= 5 && (calories ?? 0) >= 100)
  ) {
    return {
      category: "sweetened cereal",
      categoryConfidence: 0.58,
      productConfidenceFloor: 0.42,
      reason: "Sugar-forward breakfast cues suggest sweetened cereal."
    };
  }

  if (
    hasAny(text, ["chips", "crisps", "cracker", "snack"]) ||
    ((calories ?? 0) >= 140 && (protein ?? 0) <= 4 && (sodium ?? 0) >= 120)
  ) {
    return {
      category: "salty packaged snack",
      categoryConfidence: 0.56,
      productConfidenceFloor: 0.4,
      reason: "Snack cues and salty nutrient profile suggest a packaged salty snack."
    };
  }

  if (
    hasAny(text, ["noodle", "ramen", "cup noodle"]) ||
    ((sodium ?? 0) >= 700 && (calories ?? 0) >= 160 && (protein ?? 0) >= 4)
  ) {
    return {
      category: "instant noodles",
      categoryConfidence: 0.58,
      productConfidenceFloor: 0.42,
      reason: "High-sodium convenience-food pattern suggests instant noodles."
    };
  }

  if (
    hasAny(text, ["soda", "cola", "soft drink", "beverage"]) ||
    ((sugar ?? 0) >= 25 && (protein ?? 0) <= 1)
  ) {
    return {
      category: "sweetened beverage",
      categoryConfidence: 0.58,
      productConfidenceFloor: 0.4,
      reason: "High sugar with beverage cues suggests a sweetened drink."
    };
  }

  if (hasAny(text, ["canned", "packaged", "processed", "preservative"])) {
    return {
      category: "processed packaged food",
      categoryConfidence: 0.46,
      productConfidenceFloor: 0.36,
      reason: "General processed-food cues were detected."
    };
  }

  return null;
}

export function enrichIdentityFromSignals(scan) {
  const inferred = inferCategory(scan);
  if (!inferred) {
    return {
      analysis: scan,
      inferredIdentity: {
        used: false,
        category: null,
        reason: null
      }
    };
  }

  const existingCategory = scan.identifiedFood?.category || null;
  const existingConfidence =
    typeof scan.identifiedFood?.confidence === "number" ? scan.identifiedFood.confidence : scan.confidence;

  return {
    analysis: {
      ...scan,
      identifiedFood: {
        ...scan.identifiedFood,
        category: existingCategory || inferred.category,
        confidence: Math.max(existingConfidence || 0, inferred.productConfidenceFloor)
      }
    },
    inferredIdentity: {
      used: !existingCategory,
      category: existingCategory || inferred.category,
      categoryConfidence: inferred.categoryConfidence,
      reason: inferred.reason
    }
  };
}
