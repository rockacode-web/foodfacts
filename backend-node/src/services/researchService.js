import { applySourceValues, NUTRIENT_KEYS } from "../utils/mergeNutrition.js";

const SEARCH_ENDPOINT = "https://world.openfoodfacts.org/cgi/search.pl";
const PRODUCT_RESEARCH_THRESHOLD = 0.45;
const CATEGORY_RESEARCH_THRESHOLD = 0.4;
const EXACT_MATCH_THRESHOLD = 0.54;
const CATEGORY_MATCH_THRESHOLD = 0.38;
const AMBIGUOUS_MATCH_DELTA = 0.08;
const REQUEST_TIMEOUT_MS = 4500;

export const RESEARCH_REASON = {
  LOW_PRODUCT_CONFIDENCE: "LOW_PRODUCT_CONFIDENCE",
  NO_USABLE_PRODUCT_CLUES: "NO_USABLE_PRODUCT_CLUES",
  NO_TRUSTED_MATCH_FOUND: "NO_TRUSTED_MATCH_FOUND",
  SEARCH_ATTEMPT_FAILED: "SEARCH_ATTEMPT_FAILED",
  MATCH_TOO_AMBIGUOUS: "MATCH_TOO_AMBIGUOUS"
};

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
  return typeof unit === "string" && unit.trim() ? unit.toLowerCase().trim() : "";
}

function tokenSet(text) {
  if (typeof text !== "string") {
    return new Set();
  }
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
  );
}

function overlapRatio(a, b) {
  if (!a.size || !b.size) {
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
    score = Math.max(score, CATEGORY_RESEARCH_THRESHOLD);
  }
  return clamp01(score);
}

function buildQueryPlan(scan) {
  const brand = scan.identifiedFood?.brandName?.trim();
  const product = scan.identifiedFood?.productName?.trim();
  const category = scan.identifiedFood?.category?.trim();
  const seen = new Set();
  const queries = [];

  const pushQuery = (query, strategy) => {
    if (!query) {
      return;
    }
    const normalized = query.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    queries.push({ query, strategy });
  };

  pushQuery([brand, product, category, "nutrition facts"].filter(Boolean).join(" "), "exact");
  pushQuery([product, category, "nutrition facts"].filter(Boolean).join(" "), "product");
  pushQuery([category, "nutrition facts"].filter(Boolean).join(" "), "category");

  return queries;
}

function createResearchResult(overrides = {}) {
  return {
    attempted: false,
    used: false,
    reasonNotUsed: null,
    reasonDetail: null,
    query: null,
    matchedProduct: null,
    nutrition: {},
    sources: [],
    failureCode: null,
    matchScore: 0,
    filledFields: 0,
    ...overrides
  };
}

function shouldRunResearch(scan) {
  const missingCount = Object.values(scan.nutrition || {}).filter((item) => item?.value == null).length;
  const hasBrandOrProduct = Boolean(scan.identifiedFood?.brandName || scan.identifiedFood?.productName);
  const hasCategory = Boolean(scan.identifiedFood?.category);
  const identityConfidence = deriveIdentityConfidence(scan);
  const categoryConfidence = hasCategory ? Math.max(identityConfidence, CATEGORY_RESEARCH_THRESHOLD) : 0;

  if (missingCount < 2 && scan.labelDetected) {
    return {
      allowed: false,
      result: createResearchResult({
        reasonDetail: "Research was not needed because visible label coverage was already sufficient."
      })
    };
  }

  if (identityConfidence >= PRODUCT_RESEARCH_THRESHOLD || hasBrandOrProduct) {
    return { allowed: true, result: null };
  }

  if (hasCategory && categoryConfidence >= CATEGORY_RESEARCH_THRESHOLD) {
    return { allowed: true, result: null };
  }

  if (!hasBrandOrProduct && !hasCategory) {
    return {
      allowed: false,
      result: createResearchResult({
        reasonNotUsed: RESEARCH_REASON.NO_USABLE_PRODUCT_CLUES,
        reasonDetail: "Research was not attempted because no product or category clues were available.",
        failureCode: RESEARCH_REASON.NO_USABLE_PRODUCT_CLUES
      })
    };
  }

  return {
    allowed: false,
    result: createResearchResult({
      reasonNotUsed: RESEARCH_REASON.LOW_PRODUCT_CONFIDENCE,
      reasonDetail: "Research was not attempted because the available product clues were too weak.",
      failureCode: RESEARCH_REASON.LOW_PRODUCT_CONFIDENCE
    })
  };
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
    return normalizedUnit.includes("kj") ? value / 4.184 : value;
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
  }
  return value;
}

function roundValue(key, value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return key === "calories" || key.endsWith("_mg") ? Math.round(value) : Math.round(value * 10) / 10;
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
  return grams == null ? null : roundValue("sodium_mg", grams * 400);
}

function extractNutritionFromProduct(product) {
  const nutriments = product?.nutriments || {};
  const values = {};

  for (const [key, spec] of Object.entries(NUTRIENT_SPECS)) {
    values[key] = pickNutrientValue(nutriments, key, spec);
  }
  if (values.sodium_mg == null) {
    values.sodium_mg = deriveSodiumFromSalt(nutriments);
  }

  return values;
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
        errorCode: RESEARCH_REASON.SEARCH_ATTEMPT_FAILED,
        reasonCode: RESEARCH_REASON.SEARCH_ATTEMPT_FAILED,
        reason: `Search request failed with status ${response.status}.`
      };
    }

    const payload = await response.json();
    return {
      products: Array.isArray(payload?.products) ? payload.products : [],
      errorCode: null,
      reasonCode: null,
      reason: null
    };
  } catch (error) {
    return {
      products: [],
      errorCode: RESEARCH_REASON.SEARCH_ATTEMPT_FAILED,
      reasonCode: RESEARCH_REASON.SEARCH_ATTEMPT_FAILED,
      reason: `Research lookup failed: ${error?.name || "request_error"}.`
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function scoreProductMatch(product, scan, queryTokens, strategy) {
  const identityTokens = tokenSet(
    [scan.identifiedFood?.brandName || "", scan.identifiedFood?.productName || "", scan.identifiedFood?.category || ""]
      .join(" ")
      .toLowerCase()
  );
  const candidateText = [product?.product_name || "", product?.brands || "", product?.categories || ""]
    .join(" ")
    .toLowerCase();
  const candidateTokens = tokenSet(candidateText);
  const queryOverlap = overlapRatio(queryTokens, candidateTokens);
  const identityOverlap = overlapRatio(identityTokens, candidateTokens);
  let score = queryOverlap * 0.62 + identityOverlap * 0.38;

  const productName = (product?.product_name || "").toLowerCase();
  const brandText = (product?.brands || "").toLowerCase();
  const categoryText = (product?.categories || "").toLowerCase();

  if (scan.identifiedFood?.productName && productName.includes(scan.identifiedFood.productName.toLowerCase())) {
    score += 0.14;
  }
  if (scan.identifiedFood?.brandName && brandText.includes(scan.identifiedFood.brandName.toLowerCase())) {
    score += 0.14;
  }
  if (strategy === "category" && scan.identifiedFood?.category && categoryText.includes(scan.identifiedFood.category.toLowerCase())) {
    score += 0.18;
  }

  return clamp01(score);
}

function productDisplayName(product) {
  const brand = typeof product?.brands === "string" ? product.brands.split(",")[0].trim() : "";
  const name = typeof product?.product_name === "string" ? product.product_name.trim() : "";
  return [brand, name].filter(Boolean).join(" ").trim() || null;
}

function mergeResearchedNutrition(existingNutrition, researchedValues) {
  const filledNutrition = {};
  let filledFields = 0;

  for (const key of NUTRIENT_KEYS) {
    const current = existingNutrition?.[key];
    const researched = researchedValues[key];
    if (current?.value != null || !Number.isFinite(researched)) {
      continue;
    }
    filledNutrition[key] = researched;
    filledFields += 1;
  }

  return {
    merged: applySourceValues(existingNutrition, filledNutrition, "researched_online"),
    filledNutrition,
    filledFields
  };
}

export async function runResearchFallback(scan) {
  const trigger = shouldRunResearch(scan);
  if (!trigger.allowed) {
    return {
      analysis: scan,
      research: trigger.result
    };
  }

  const queryPlan = buildQueryPlan(scan);
  if (!queryPlan.length) {
    return {
      analysis: scan,
      research: createResearchResult({
        reasonNotUsed: RESEARCH_REASON.NO_USABLE_PRODUCT_CLUES,
        reasonDetail: "Research was not attempted because no usable product or category clues were available.",
        failureCode: RESEARCH_REASON.NO_USABLE_PRODUCT_CLUES
      })
    };
  }

  let lastFailure = createResearchResult({
    attempted: true,
    query: queryPlan[0].query,
    reasonNotUsed: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND,
    reasonDetail: "Research attempted but no trusted match was found.",
    failureCode: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND
  });

  for (const querySpec of queryPlan) {
    const searchResult = await searchOpenFoodFacts(querySpec.query);
    if (searchResult.errorCode) {
      lastFailure = createResearchResult({
        attempted: true,
        query: querySpec.query,
        reasonNotUsed: searchResult.reasonCode || RESEARCH_REASON.SEARCH_ATTEMPT_FAILED,
        reasonDetail: searchResult.reason,
        failureCode: searchResult.errorCode
      });
      continue;
    }

    if (!searchResult.products.length) {
      lastFailure = createResearchResult({
        attempted: true,
        query: querySpec.query,
        reasonNotUsed: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND,
        reasonDetail: "Research attempted but no candidate products were returned.",
        failureCode: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND
      });
      continue;
    }

    const queryTokens = tokenSet(querySpec.query);
    const ranked = searchResult.products
      .map((product) => ({
        product,
        score: scoreProductMatch(product, scan, queryTokens, querySpec.strategy)
      }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    const second = ranked[1];
    const minScore = querySpec.strategy === "category" ? CATEGORY_MATCH_THRESHOLD : EXACT_MATCH_THRESHOLD;

    if (!best || best.score < minScore) {
      lastFailure = createResearchResult({
        attempted: true,
        query: querySpec.query,
        reasonNotUsed: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND,
        reasonDetail: "Research attempted but no candidate exceeded the trust threshold.",
        failureCode: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND
      });
      continue;
    }

    if (second && best.score - second.score < AMBIGUOUS_MATCH_DELTA && best.score < 0.75) {
      lastFailure = createResearchResult({
        attempted: true,
        query: querySpec.query,
        reasonNotUsed: RESEARCH_REASON.MATCH_TOO_AMBIGUOUS,
        reasonDetail: "Research attempted but the top product matches were too ambiguous.",
        failureCode: RESEARCH_REASON.MATCH_TOO_AMBIGUOUS
      });
      continue;
    }

    const researchedValues = extractNutritionFromProduct(best.product);
    const { merged, filledNutrition, filledFields } = mergeResearchedNutrition(scan.nutrition, researchedValues);
    const matchedProduct = productDisplayName(best.product);
    const matchScore = Math.round(best.score * 100) / 100;

    if (!filledFields) {
      lastFailure = createResearchResult({
        attempted: true,
        query: querySpec.query,
        matchedProduct,
        reasonNotUsed: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND,
        reasonDetail: "A product match was found, but it did not add any missing nutrient fields.",
        failureCode: RESEARCH_REASON.NO_TRUSTED_MATCH_FOUND,
        matchScore
      });
      continue;
    }

    return {
      analysis: {
        ...scan,
        nutrition: merged
      },
      research: createResearchResult({
        attempted: true,
        used: true,
        query: querySpec.query,
        matchedProduct,
        nutrition: filledNutrition,
        sources: [
          {
            name: "Open Food Facts",
            url:
              typeof best.product?.url === "string" && best.product.url.trim()
                ? best.product.url
                : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(querySpec.query)}`
          }
        ],
        matchScore,
        filledFields
      })
    };
  }

  return {
    analysis: scan,
    research: lastFailure
  };
}
