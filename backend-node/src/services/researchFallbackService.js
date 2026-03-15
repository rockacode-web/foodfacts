const SEARCH_ENDPOINT = "https://world.openfoodfacts.org/cgi/search.pl";
const RESEARCH_TRIGGER_PRODUCT_THRESHOLD = 0.45;
const RESEARCH_TRIGGER_CATEGORY_THRESHOLD = 0.4;
const MIN_PRODUCT_MATCH_SCORE = 0.54;
const AMBIGUOUS_MATCH_DELTA = 0.08;
const REQUEST_TIMEOUT_MS = 4500;

const NUTRIENT_SPECS = {
  calories: {
    expectedUnit: "kcal",
    candidates: ["energy-kcal_serving", "energy-kcal_100g", "energy-kcal", "energy"]
  },
  totalFat_g: {
    expectedUnit: "g",
    candidates: ["fat_serving", "fat_100g", "fat"]
  },
  saturatedFat_g: {
    expectedUnit: "g",
    candidates: ["saturated-fat_serving", "saturated-fat_100g", "saturated-fat"]
  },
  transFat_g: {
    expectedUnit: "g",
    candidates: ["trans-fat_serving", "trans-fat_100g", "trans-fat"]
  },
  cholesterol_mg: {
    expectedUnit: "mg",
    candidates: ["cholesterol_serving", "cholesterol_100g", "cholesterol"]
  },
  sodium_mg: {
    expectedUnit: "mg",
    candidates: ["sodium_serving", "sodium_100g", "sodium"]
  },
  totalCarbs_g: {
    expectedUnit: "g",
    candidates: ["carbohydrates_serving", "carbohydrates_100g", "carbohydrates"]
  },
  fiber_g: {
    expectedUnit: "g",
    candidates: ["fiber_serving", "fiber_100g", "fiber"]
  },
  sugar_g: {
    expectedUnit: "g",
    candidates: ["sugars_serving", "sugars_100g", "sugars"]
  },
  addedSugar_g: {
    expectedUnit: "g",
    candidates: ["added-sugars_serving", "added-sugars_100g", "added-sugars"]
  },
  protein_g: {
    expectedUnit: "g",
    candidates: ["proteins_serving", "proteins_100g", "proteins"]
  }
};

const RESEARCH_FAILURE = {
  LOW_PRODUCT_CONFIDENCE: "LOW_PRODUCT_CONFIDENCE",
  NO_USABLE_PRODUCT_CLUES: "NO_USABLE_PRODUCT_CLUES",
  NO_TRUSTED_MATCH_FOUND: "NO_TRUSTED_MATCH_FOUND",
  SEARCH_ATTEMPT_FAILED: "SEARCH_ATTEMPT_FAILED",
  MATCH_TOO_AMBIGUOUS: "MATCH_TOO_AMBIGUOUS"
};

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function normalizeUnit(unit) {
  if (typeof unit !== "string" || !unit.trim()) {
    return "";
  }
  return unit.toLowerCase().trim();
}

function tokenSet(text) {
  if (typeof text !== "string") {
    return new Set();
  }
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
  return new Set(tokens);
}

function overlapRatio(a, b) {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(1, a.size);
}

function getUnitForKey(nutriments, key) {
  if (!nutriments || typeof nutriments !== "object") {
    return "";
  }
  const exact = normalizeUnit(nutriments[`${key}_unit`]);
  if (exact) {
    return exact;
  }
  const base = key.replace(/_(serving|100g)$/i, "");
  return normalizeUnit(nutriments[`${base}_unit`]);
}

function convertUnit(value, unit, expectedUnit) {
  const normalizedUnit = normalizeUnit(unit);

  if (expectedUnit === "kcal") {
    if (normalizedUnit.includes("kj")) {
      return value / 4.184;
    }
    return value;
  }

  if (expectedUnit === "mg") {
    if (normalizedUnit.includes("mg")) {
      return value;
    }
    if (normalizedUnit === "g" || normalizedUnit.includes("gram")) {
      return value * 1000;
    }
    if (normalizedUnit === "ug" || normalizedUnit === "mcg" || normalizedUnit === "µg") {
      return value / 1000;
    }
    return value;
  }

  if (expectedUnit === "g") {
    if (normalizedUnit.includes("mg")) {
      return value / 1000;
    }
    if (normalizedUnit === "kg") {
      return value * 1000;
    }
    return value;
  }

  return value;
}

function roundValue(key, value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (key === "calories" || key.endsWith("_mg")) {
    return Math.round(value);
  }
  return Math.round(value * 10) / 10;
}

function isPlausible(key, value) {
  if (!Number.isFinite(value) || value < 0) {
    return false;
  }

  switch (key) {
    case "calories":
      return value <= 1400;
    case "sodium_mg":
      return value <= 12000;
    case "cholesterol_mg":
      return value <= 2000;
    case "sugar_g":
    case "addedSugar_g":
    case "totalCarbs_g":
    case "protein_g":
      return value <= 180;
    default:
      return value <= 120;
  }
}

function pickNutrientValue(nutriments, key, spec) {
  for (const candidate of spec.candidates) {
    const rawValue = asNumber(nutriments?.[candidate]);
    if (rawValue === null) {
      continue;
    }
    const unit = getUnitForKey(nutriments, candidate);
    const converted = convertUnit(rawValue, unit, spec.expectedUnit);
    if (!isPlausible(key, converted)) {
      continue;
    }
    return roundValue(key, converted);
  }
  return null;
}

function deriveSodiumFromSalt(nutriments) {
  const saltValue =
    asNumber(nutriments?.["salt_serving"]) ??
    asNumber(nutriments?.["salt_100g"]) ??
    asNumber(nutriments?.salt);
  if (saltValue === null) {
    return null;
  }

  const unit =
    getUnitForKey(nutriments, "salt_serving") ||
    getUnitForKey(nutriments, "salt_100g") ||
    getUnitForKey(nutriments, "salt");

  if (unit.includes("mg")) {
    return roundValue("sodium_mg", saltValue * 0.4);
  }
  const grams = unit ? convertUnit(saltValue, unit, "g") : saltValue <= 30 ? saltValue : null;
  if (grams === null) {
    return null;
  }
  return roundValue("sodium_mg", grams * 400);
}

function extractNutritionFromProduct(product) {
  const nutriments = product?.nutriments || {};
  const values = {};

  for (const [key, spec] of Object.entries(NUTRIENT_SPECS)) {
    values[key] = pickNutrientValue(nutriments, key, spec);
  }

  if (values.sodium_mg === null) {
    values.sodium_mg = deriveSodiumFromSalt(nutriments);
  }

  return values;
}

function buildQuery(identifiedFood) {
  const terms = [
    identifiedFood?.brandName,
    identifiedFood?.productName,
    identifiedFood?.category
  ].filter((item) => typeof item === "string" && item.trim().length > 0);

  return terms.join(" ").trim();
}

function researchBase(query = null) {
  return {
    attempted: false,
    used: false,
    reasonNotUsed: null,
    reasonDetail: null,
    failureCode: null,
    query,
    matchedProduct: null,
    sources: [],
    matchScore: 0,
    filledFields: 0
  };
}

function productDisplayName(product) {
  const brand = typeof product?.brands === "string" ? product.brands.split(",")[0].trim() : "";
  const name = typeof product?.product_name === "string" ? product.product_name.trim() : "";
  return [brand, name].filter(Boolean).join(" ").trim() || null;
}

function scoreProductMatch(product, identifiedFood, queryTokens) {
  const identityText = [
    identifiedFood?.brandName || "",
    identifiedFood?.productName || "",
    identifiedFood?.category || ""
  ]
    .join(" ")
    .toLowerCase();
  const identityTokens = tokenSet(identityText);
  const candidateText = [
    product?.product_name || "",
    product?.brands || "",
    product?.categories || ""
  ]
    .join(" ")
    .toLowerCase();
  const candidateTokens = tokenSet(candidateText);

  const queryOverlap = overlapRatio(queryTokens, candidateTokens);
  const identityOverlap = overlapRatio(identityTokens, candidateTokens);
  let score = queryOverlap * 0.62 + identityOverlap * 0.38;

  const productName = (product?.product_name || "").toLowerCase();
  if (identifiedFood?.productName && productName.includes(identifiedFood.productName.toLowerCase())) {
    score += 0.14;
  }
  const brandText = (product?.brands || "").toLowerCase();
  if (identifiedFood?.brandName && brandText.includes(identifiedFood.brandName.toLowerCase())) {
    score += 0.14;
  }

  return clamp01(score);
}

function deriveIdentityConfidence(scan) {
  const base = clamp01(
    Number.isFinite(scan?.identifiedFood?.confidence) ? scan.identifiedFood.confidence : scan?.confidence
  );
  const hasBrand = Boolean(scan?.identifiedFood?.brandName);
  const hasProduct = Boolean(scan?.identifiedFood?.productName);
  const hasCategory = Boolean(scan?.identifiedFood?.category);

  let score = base;
  if (hasBrand && hasProduct) {
    score += 0.08;
  } else if (hasProduct) {
    score += 0.05;
  }
  if (!hasProduct && !hasBrand && hasCategory) {
    score = Math.min(score, 0.62);
  }
  if (!hasProduct && !hasBrand && !hasCategory) {
    score = Math.min(score, 0.2);
  }
  return clamp01(score);
}

function shouldAttemptResearch(scan) {
  const query = buildQuery(scan.identifiedFood);
  const missingCount = Object.values(scan.nutrition || {}).filter((item) => item?.value == null).length;
  const hasBrandOrProduct = Boolean(scan.identifiedFood?.brandName || scan.identifiedFood?.productName);
  const hasCategory = Boolean(scan.identifiedFood?.category);
  const identityConfidence = deriveIdentityConfidence(scan);
  const categoryConfidence = hasCategory ? Math.max(identityConfidence - 0.08, 0.35) : 0;

  if (!query) {
    return {
      ok: false,
      failureCode: RESEARCH_FAILURE.NO_USABLE_PRODUCT_CLUES,
      reasonNotUsed: RESEARCH_FAILURE.NO_USABLE_PRODUCT_CLUES,
      reasonDetail: "Research was not attempted because no product/category clues were extracted."
    };
  }

  const needsMoreData = missingCount >= 2 || !scan.labelDetected;
  if (!needsMoreData) {
    return {
      ok: false,
      failureCode: null,
      reasonNotUsed: null,
      reasonDetail: "Research was not needed because visible label coverage was already sufficient."
    };
  }

  if (identityConfidence >= RESEARCH_TRIGGER_PRODUCT_THRESHOLD) {
    return { ok: true, failureCode: null, reasonNotUsed: null };
  }

  if (hasBrandOrProduct) {
    return { ok: true, failureCode: null, reasonNotUsed: null };
  }

  if (hasCategory && categoryConfidence >= RESEARCH_TRIGGER_CATEGORY_THRESHOLD) {
    return { ok: true, failureCode: null, reasonNotUsed: null };
  }

  if (!hasBrandOrProduct && hasCategory) {
    return {
      ok: false,
      failureCode: RESEARCH_FAILURE.NO_USABLE_PRODUCT_CLUES,
      reasonNotUsed: RESEARCH_FAILURE.NO_USABLE_PRODUCT_CLUES,
      reasonDetail:
        "Research was not attempted because brand/product identity was too weak for reliable lookup."
    };
  }

  return {
    ok: false,
    failureCode: RESEARCH_FAILURE.LOW_PRODUCT_CONFIDENCE,
    reasonNotUsed: RESEARCH_FAILURE.LOW_PRODUCT_CONFIDENCE,
    reasonDetail:
      "Research was not attempted because product identity confidence was too low for reliable lookup."
  };
}

async function searchOpenFoodFacts(query) {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "8");
  url.searchParams.set("fields", "product_name,brands,categories,url,code,nutriments");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        products: [],
      errorCode: RESEARCH_FAILURE.SEARCH_ATTEMPT_FAILED,
      reasonCode: RESEARCH_FAILURE.SEARCH_ATTEMPT_FAILED,
      reason: `Search request failed with status ${response.status}.`
      };
    }
    const payload = await response.json();
    return {
      products: Array.isArray(payload?.products) ? payload.products : [],
      errorCode: null,
      reason: null
    };
  } catch (error) {
    return {
      products: [],
      errorCode: RESEARCH_FAILURE.SEARCH_ATTEMPT_FAILED,
      reasonCode: RESEARCH_FAILURE.SEARCH_ATTEMPT_FAILED,
      reason: `Research lookup failed: ${error?.name || "request_error"}.`
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function mergeResearchedNutrition(existingNutrition, researchedValues) {
  let filled = 0;
  const merged = { ...existingNutrition };

  for (const key of Object.keys(NUTRIENT_SPECS)) {
    const current = merged[key] || { value: null, source: "unknown" };
    const researched = researchedValues[key];
    const isMissing = current.value == null;
    if (!isMissing || !Number.isFinite(researched)) {
      continue;
    }
    merged[key] = {
      value: researched,
      source: "researched_online"
    };
    filled += 1;
  }

  return { merged, filled };
}

export async function enrichWithResearchFallback(scan) {
  const query = buildQuery(scan.identifiedFood);
  const base = researchBase(query || null);
  const eligibility = shouldAttemptResearch(scan);

  if (!eligibility.ok) {
    return {
      analysis: scan,
      research: {
        ...base,
        reasonNotUsed: eligibility.reasonNotUsed,
        reasonDetail: eligibility.reasonDetail || null,
        failureCode: eligibility.failureCode
      }
    };
  }

  const searchResult = await searchOpenFoodFacts(query);
  if (searchResult.errorCode) {
    return {
      analysis: scan,
      research: {
        ...base,
        attempted: true,
        reasonNotUsed: searchResult.reasonCode || RESEARCH_FAILURE.SEARCH_ATTEMPT_FAILED,
        reasonDetail: searchResult.reason,
        failureCode: searchResult.errorCode
      }
    };
  }

  if (!searchResult.products.length) {
    return {
      analysis: scan,
      research: {
        ...base,
        attempted: true,
        reasonNotUsed: RESEARCH_FAILURE.NO_TRUSTED_MATCH_FOUND,
        reasonDetail: "Research attempted but no trusted product match was found.",
        failureCode: RESEARCH_FAILURE.NO_TRUSTED_MATCH_FOUND
      }
    };
  }

  const queryTokens = tokenSet(query);
  const ranked = searchResult.products
    .map((product) => ({
      product,
      score: scoreProductMatch(product, scan.identifiedFood, queryTokens)
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score < MIN_PRODUCT_MATCH_SCORE) {
    return {
      analysis: scan,
      research: {
        ...base,
        attempted: true,
        reasonNotUsed: RESEARCH_FAILURE.NO_TRUSTED_MATCH_FOUND,
        reasonDetail: "Research attempted but no trusted match exceeded quality threshold.",
        failureCode: RESEARCH_FAILURE.NO_TRUSTED_MATCH_FOUND
      }
    };
  }

  if (second && best.score - second.score < AMBIGUOUS_MATCH_DELTA && best.score < 0.75) {
    return {
      analysis: scan,
      research: {
        ...base,
        attempted: true,
        reasonNotUsed: RESEARCH_FAILURE.MATCH_TOO_AMBIGUOUS,
        reasonDetail: "Research attempted but product match was too ambiguous.",
        failureCode: RESEARCH_FAILURE.MATCH_TOO_AMBIGUOUS
      }
    };
  }

  const researchedValues = extractNutritionFromProduct(best.product);
  const { merged, filled } = mergeResearchedNutrition(scan.nutrition, researchedValues);
  const matchedProduct = productDisplayName(best.product);
  const matchScore = Math.round(best.score * 100) / 100;

  if (filled === 0) {
    return {
      analysis: scan,
      research: {
        ...base,
        attempted: true,
        reasonNotUsed: RESEARCH_FAILURE.NO_TRUSTED_MATCH_FOUND,
        reasonDetail:
          "Trusted product match found, but no usable nutrient fields were available to fill gaps.",
        failureCode: RESEARCH_FAILURE.NO_TRUSTED_MATCH_FOUND,
        matchedProduct,
        matchScore
      }
    };
  }

  const research = {
    attempted: true,
    used: true,
    reasonNotUsed: null,
    reasonDetail: null,
    failureCode: null,
    query,
    matchedProduct,
    sources: [
      {
        name: "Open Food Facts",
        url:
          typeof best.product?.url === "string" && best.product.url.trim()
            ? best.product.url
            : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}`
      }
    ],
    filledFields: filled,
    matchScore
  };

  return {
    analysis: {
      ...scan,
      nutrition: merged
    },
    research
  };
}
