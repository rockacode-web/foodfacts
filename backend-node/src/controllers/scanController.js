import { scanFoodLabelImage, OpenAiScannerError } from "../services/openAiFoodScanner.js";
import { evaluateHealthProfile } from "../services/healthScoringService.js";
import { buildRecommendations } from "../services/recommendationService.js";
import { runResearchFallback } from "../services/researchService.js";
import { applyCategoryEstimates } from "../services/categoryEstimateService.js";
import { enrichIdentityFromSignals } from "../services/identityInferenceService.js";
import { persistScanResult } from "../services/scanPersistenceService.js";

const THRESHOLDS = {
  labelConfidenceMin: 0.68,
  exactLabelMinFacts: 4,
  partialLabelMinFacts: 2,
  productConfidenceMin: 0.45,
  categoryConfidenceMin: 0.4,
  researchConfidenceMin: 0.45,
  recipeProductMin: 0.5,
  recipeCategoryMin: 0.4,
  analysisMinActionable: 0.42,
  strongClaimMin: 0.7,
  exactClaimMin: 0.75,
  moderateClaimMin: 0.45,
  hideScoreMax: 0.4
};

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

function uniqueStrings(items) {
  const output = [];
  const seen = new Set();

  for (const item of items) {
    if (typeof item !== "string" || !item.trim()) {
      continue;
    }
    const normalized = item.trim();
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function countNutrientsBySource(nutrition, source) {
  return Object.values(nutrition || {}).filter((item) => item?.source === source && item?.value != null).length;
}

const KEY_NUTRIENT_FIELDS = [
  "calories",
  "sodium_mg",
  "sugar_g",
  "protein_g",
  "totalFat_g",
  "saturatedFat_g"
];

function countVisibleKeyNutrients(nutrition, source = "label") {
  return KEY_NUTRIENT_FIELDS.filter((key) => nutrition?.[key]?.source === source && nutrition?.[key]?.value != null).length;
}

function scoreTextClarity(value) {
  if (value === "excellent") {
    return 1;
  }
  if (value === "good") {
    return 0.82;
  }
  if (value === "fair") {
    return 0.55;
  }
  return 0.28;
}

function scoreNoiseLevel(value) {
  if (value === "low") {
    return 1;
  }
  if (value === "medium") {
    return 0.6;
  }
  return 0.22;
}

function deriveOcrSignals(scan) {
  const rawSignals = scan.ocrSignals || {};
  const labelKeyNutrients = countVisibleKeyNutrients(scan.nutrition, "label");
  const readableFieldBaseline = countNutrientsBySource(scan.nutrition, "label") + Math.min((scan.ingredients || []).length, 4);
  const hasStructuredNutritionTable =
    Boolean(rawSignals.hasStructuredNutritionTable) ||
    (Boolean(scan.labelDetected) && countNutrientsBySource(scan.nutrition, "label") >= 3);
  const hasServingSize = Boolean(rawSignals.hasServingSize);
  const hasPercentDailyValues = Boolean(rawSignals.hasPercentDailyValues);
  const ingredientsVisible = Boolean(rawSignals.ingredientsVisible) || (scan.ingredients || []).length > 0;
  const readableFieldCount = Math.max(
    readableFieldBaseline,
    Number.isFinite(rawSignals.readableFieldCount) ? rawSignals.readableFieldCount : 0
  );
  const keyNutrientCount = Math.max(
    labelKeyNutrients,
    Number.isFinite(rawSignals.keyNutrientCount) ? rawSignals.keyNutrientCount : 0
  );
  const textClarity = rawSignals.textClarity || "fair";
  const noiseLevel = rawSignals.noiseLevel || "medium";

  return {
    hasStructuredNutritionTable,
    hasServingSize,
    hasPercentDailyValues,
    ingredientsVisible,
    readableFieldCount,
    keyNutrientCount,
    textClarity,
    noiseLevel
  };
}

function buildConfidence(scan, research) {
  const nutritionValues = Object.values(scan.nutrition || {});
  const total = nutritionValues.length || 1;
  const labelCount = countNutrientsBySource(scan.nutrition, "label");
  const researchCount = countNutrientsBySource(scan.nutrition, "researched_online");
  const estimatedCount = countNutrientsBySource(scan.nutrition, "estimated_category");
  const unknownCount = countNutrientsBySource(scan.nutrition, "unknown");
  const coverage = (labelCount + researchCount + estimatedCount) / total;
  const ocrSignals = deriveOcrSignals(scan);
  const labelCoverage = labelCount / total;
  const readableFieldScore = clamp01(ocrSignals.readableFieldCount / 8);
  const keyNutrientScore = clamp01(ocrSignals.keyNutrientCount / 5);
  const completenessScore = clamp01(
    countVisibleKeyNutrients(scan.nutrition, "label") / KEY_NUTRIENT_FIELDS.length
  );
  const structureScore = clamp01(
    (Number(ocrSignals.hasStructuredNutritionTable) * 0.42) +
      (Number(ocrSignals.hasServingSize) * 0.28) +
      (Number(ocrSignals.hasPercentDailyValues) * 0.3)
  );
  const clarityScore = clamp01(
    scoreTextClarity(ocrSignals.textClarity) * 0.7 + scoreNoiseLevel(ocrSignals.noiseLevel) * 0.3
  );
  const ingredientDetectionScore = ocrSignals.ingredientsVisible ? 1 : 0.2;
  const ocrReliability = clamp01(
    completenessScore * 0.38 +
      structureScore * 0.26 +
      clarityScore * 0.24 +
      ingredientDetectionScore * 0.12
  );

  const baseScanConfidence = clamp01(scan.confidence);
  const rawIdentityConfidence = clamp01(scan.identifiedFood?.confidence ?? baseScanConfidence);
  const hasBrand = Boolean(scan.identifiedFood?.brandName);
  const hasProduct = Boolean(scan.identifiedFood?.productName);
  const hasCategory = Boolean(scan.identifiedFood?.category);

  let productConfidence = rawIdentityConfidence;
  if (hasBrand && hasProduct) {
    productConfidence += 0.08;
  } else if (hasProduct) {
    productConfidence += 0.05;
  }
  if (!hasBrand && !hasProduct && hasCategory) {
    productConfidence = Math.min(productConfidence, 0.62);
  }
  if (!hasBrand && !hasProduct && !hasCategory) {
    productConfidence = Math.min(productConfidence, 0.2);
  }
  productConfidence = clamp01(productConfidence);

  const categoryConfidence = hasCategory
    ? clamp01(Math.max(productConfidence - 0.06, rawIdentityConfidence * 0.9, 0.35))
    : 0.12;

  const labelConfidence = scan.labelDetected
    ? clamp01(
        ocrReliability * 0.56 +
          labelCoverage * 0.18 +
          readableFieldScore * 0.14 +
          keyNutrientScore * 0.12
      )
    : clamp01(labelCoverage * 0.45 + clarityScore * 0.1);

  const researchConfidence = research?.used
    ? clamp01((research.matchScore || 0) * 0.8 + Math.min((research.filledFields || 0) / 5, 1) * 0.2)
    : 0;

  let analysisConfidence = 0;
  if (scan.labelDetected && labelCount >= 2) {
    analysisConfidence = clamp01(
      ocrReliability * 0.42 +
        labelConfidence * 0.2 +
        researchConfidence * 0.12 +
        categoryConfidence * 0.1 +
        coverage * 0.08 +
        completenessScore * 0.08
    );
  } else if (research?.used) {
    analysisConfidence = clamp01(
      researchConfidence * 0.46 +
        productConfidence * 0.18 +
        categoryConfidence * 0.14 +
        coverage * 0.12 +
        clarityScore * 0.1
    );
  } else if (estimatedCount >= 2 && categoryConfidence >= THRESHOLDS.categoryConfidenceMin) {
    analysisConfidence = clamp01(
      categoryConfidence * 0.42 + coverage * 0.28 + productConfidence * 0.2 + clarityScore * 0.1
    );
  } else {
    analysisConfidence = clamp01(
      coverage * 0.22 +
        categoryConfidence * 0.24 +
        productConfidence * 0.16 +
        (1 - unknownCount / total) * 0.12 +
        clarityScore * 0.14 +
        structureScore * 0.12
    );
  }

  return {
    labelConfidence,
    productConfidence,
    categoryConfidence,
    researchConfidence,
    analysisConfidence,
    ocrReliability,
    nutritionCompleteness: completenessScore,
    labelStructure: structureScore,
    ingredientDetection: ingredientDetectionScore,
    ocrQuality: clarityScore
  };
}

function confidenceLabel(score) {
  if (score <= 0.29) {
    return "very_weak";
  }
  if (score <= 0.49) {
    return "weak";
  }
  if (score <= 0.69) {
    return "moderate";
  }
  if (score <= 0.84) {
    return "strong";
  }
  return "very_strong";
}

function toPercent(score) {
  return Math.round(clamp01(score) * 100);
}

function scoreConfidenceLabel(confidenceScore) {
  const label = confidenceLabel(confidenceScore);
  if (label === "very_weak" || label === "weak") {
    return "low";
  }
  if (label === "moderate") {
    return "moderate";
  }
  return "high";
}

function softenWarningsByConfidence(warnings, confidenceScore) {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return [];
  }

  if (confidenceScore >= THRESHOLDS.strongClaimMin) {
    return warnings;
  }

  if (confidenceScore >= THRESHOLDS.moderateClaimMin) {
    return warnings.map((warning) =>
      warning
        .replace(/^High/i, "Likely high")
        .replace(/^Moderately high/i, "Possibly moderately high")
        .replace(/^Low protein/i, "Protein may be low")
    );
  }

  return [];
}

function calculateFinalScore(healthScore, analysis, confidence, warnings) {
  const reasons = [];
  let finalScore = Number.isFinite(healthScore) ? healthScore : 0;
  const total = Object.keys(analysis.nutrition || {}).length || 1;
  const unknownCount = countNutrientsBySource(analysis.nutrition, "unknown");
  const labelCount = countNutrientsBySource(analysis.nutrition, "label");
  const researchedCount = countNutrientsBySource(analysis.nutrition, "researched_online");
  const unknownRatio = unknownCount / total;
  const hasHighSodium = warnings.some((warning) => /high sodium/i.test(warning));
  const hasHighSugar = warnings.some((warning) => /high sugar/i.test(warning));
  const hasHighSatFat = warnings.some((warning) => /high saturated fat/i.test(warning));

  if (hasHighSodium) {
    finalScore -= confidence.analysisConfidence >= THRESHOLDS.strongClaimMin ? 3.5 : 3;
    reasons.push("High sodium reduced the score.");
  }
  if (hasHighSugar || hasHighSatFat) {
    finalScore -= 1.5;
    reasons.push("Elevated risk nutrients reduced the score.");
  }

  if (unknownRatio >= 0.6) {
    finalScore -= 3;
    reasons.push("Many nutrients were unknown, so score confidence was reduced.");
  } else if (unknownRatio >= 0.35) {
    finalScore -= 2;
    reasons.push("Several nutrients were unknown.");
  }

  if (confidence.analysisConfidence <= THRESHOLDS.hideScoreMax) {
    finalScore -= 2.5;
    reasons.push("Limited analysis confidence reduced score reliability.");
  } else if (confidence.analysisConfidence < 0.6) {
    finalScore -= 2;
    reasons.push("Moderate evidence lowered the score because the analysis is still preliminary.");
  } else if (confidence.analysisConfidence < THRESHOLDS.strongClaimMin) {
    finalScore -= 1.2;
    reasons.push("Moderate confidence produced a preliminary score.");
  }

  if (labelCount === 0) {
    reasons.push("No direct label nutrients were available; score used estimated/researched evidence.");
  } else {
    reasons.push("Label-visible nutrients were used where available.");
  }
  if (labelCount + researchedCount <= 2) {
    finalScore -= 1.5;
    reasons.push("Only a small number of nutrient facts were available.");
  }

  if (hasHighSodium && confidence.analysisConfidence < THRESHOLDS.strongClaimMin && finalScore > 5) {
    finalScore = 5;
    reasons.push("The score was capped because a serious sodium warning was found under limited evidence.");
  }
  if ((hasHighSugar || hasHighSatFat) && confidence.analysisConfidence < THRESHOLDS.strongClaimMin && finalScore > 6) {
    finalScore = 6;
    reasons.push("The score was capped because a serious nutrient warning was found under limited evidence.");
  }

  finalScore = Math.max(0, Math.min(10, Math.round(finalScore)));

  let scorePresentation = "final";
  if (confidence.analysisConfidence <= THRESHOLDS.hideScoreMax) {
    scorePresentation = "not_reliable";
  } else if (confidence.analysisConfidence < THRESHOLDS.strongClaimMin || unknownRatio >= 0.35) {
    scorePresentation = "preliminary";
  }

  return {
    finalScore,
    scorePresentation,
    scoreConfidence: scoreConfidenceLabel(confidence.analysisConfidence),
    scoreReasoning: reasons
  };
}

function hasActionableEvidence(scan, confidence, research) {
  const labelCount = countNutrientsBySource(scan.nutrition, "label");
  const researchedCount = countNutrientsBySource(scan.nutrition, "researched_online");
  const estimatedCount = countNutrientsBySource(scan.nutrition, "estimated_category");
  const hasCategory = Boolean(scan.identifiedFood?.category);
  const hasCategoryInsights = Boolean(
    scan.estimatedInsights?.processingLevel ||
      scan.estimatedInsights?.sodiumLikelihood ||
      scan.estimatedInsights?.sugarLikelihood ||
      scan.estimatedInsights?.fiberLikelihood
  );
  const hasLabelBasis =
    scan.labelDetected &&
    labelCount >= THRESHOLDS.partialLabelMinFacts;
  const hasResearchBasis =
    research?.used &&
    researchedCount >= 1 &&
    confidence.researchConfidence >= THRESHOLDS.researchConfidenceMin;
  const hasCategoryBasis =
    hasCategory &&
    (estimatedCount >= 1 || hasCategoryInsights) &&
    confidence.categoryConfidence >= THRESHOLDS.categoryConfidenceMin;

  const insufficient =
    !scan.labelDetected &&
    !hasResearchBasis &&
    !hasCategoryBasis &&
    confidence.productConfidence < THRESHOLDS.productConfidenceMin &&
    confidence.categoryConfidence < THRESHOLDS.categoryConfidenceMin &&
    confidence.analysisConfidence < THRESHOLDS.analysisMinActionable;

  return {
    insufficient,
    hasLabelBasis,
    hasResearchBasis,
    hasCategoryBasis
  };
}

function detectAnalysisMode(evidence) {
  if (evidence.insufficient) {
    return "insufficient_data";
  }
  if (evidence.hasResearchBasis) {
    return "research_assisted";
  }
  if (evidence.hasLabelBasis && evidence.hasCategoryBasis) {
    return "partial_label";
  }
  if (evidence.hasLabelBasis) {
    return "exact_label";
  }
  if (evidence.hasCategoryBasis) {
    return "category_estimated";
  }
  return "insufficient_data";
}

function refineAnalysisMode(scan, confidence, evidence, research) {
  const labelCount = countNutrientsBySource(scan.nutrition, "label");
  const unknownCount = countNutrientsBySource(scan.nutrition, "unknown");
  if (evidence.insufficient) {
    return "insufficient_data";
  }
  if (research?.used && evidence.hasResearchBasis) {
    return "research_assisted";
  }
  if (
    scan.labelDetected &&
    labelCount >= THRESHOLDS.exactLabelMinFacts &&
    confidence.labelConfidence >= THRESHOLDS.labelConfidenceMin &&
    unknownCount <= 3
  ) {
    return "exact_label";
  }
  if (scan.labelDetected && labelCount >= THRESHOLDS.partialLabelMinFacts) {
    return "partial_label";
  }
  if (evidence.hasCategoryBasis) {
    return "category_estimated";
  }
  return "insufficient_data";
}

function reasoningSummary(scan, research, evidence, mode) {
  const productIdentified = Boolean(scan.identifiedFood?.productName || scan.identifiedFood?.brandName);
  let researchOutcome = "not_attempted";
  if (research?.attempted && research?.used) {
    researchOutcome = "match_used";
  } else if (research?.attempted && !research?.used) {
    researchOutcome = research.failureCode || "attempted_no_match";
  } else if (!research?.attempted && research?.failureCode) {
    researchOutcome = research.failureCode;
  }

  const primaryEvidenceSource =
    mode === "exact_label" || mode === "partial_label"
      ? "label"
      : mode === "research_assisted"
      ? "researched_online"
      : mode === "category_estimated"
      ? "estimated_category"
      : "insufficient_data";

  return {
    labelDetected: Boolean(scan.labelDetected),
    productIdentified,
    researchAttempted: Boolean(research?.attempted),
    researchOutcome,
    primaryEvidenceSource,
    readableLabelSignals: {
      servingSize: Boolean(scan.ocrSignals?.hasServingSize),
      percentDailyValues: Boolean(scan.ocrSignals?.hasPercentDailyValues),
      ingredientsDetected: Boolean(scan.ocrSignals?.ingredientsVisible || (scan.ingredients || []).length > 0)
    }
  };
}

function defaultEstimatedInsights() {
  return {
    sodiumLikelihood: null,
    processingLevel: null,
    generalHealthNote: null,
    sugarLikelihood: null,
    fiberLikelihood: null
  };
}

function defaultEstimatedRanges() {
  return {
    calories: null,
    sodium_mg: null,
    saturatedFat_g: null,
    sugar_g: null,
    fiber_g: null
  };
}

function moderateConfidenceSwapIdeas(recipes) {
  return recipes.slice(0, 3).map((recipe) => ({
    level: recipe.level || "category",
    title: `Possible healthier alternative: ${recipe.title}`,
    description: recipe.description,
    whyItIsHealthier: recipe.whyItIsHealthier
  }));
}

function genericCategorySwapIdeas(scan) {
  const category = (scan.identifiedFood?.category || "").toLowerCase();
  if (!category) {
    return [];
  }

  if (category.includes("cereal")) {
    return [
      {
        level: "category",
        title: "Plain oats with fruit",
        description: "Replace sweeter cereal with plain oats, fruit, and nuts.",
        whyItIsHealthier: "Usually lowers added sugar and improves fiber."
      }
    ];
  }
  if (category.includes("chips") || category.includes("snack")) {
    return [
      {
        level: "category",
        title: "Air-popped popcorn or roasted chickpeas",
        description: "Swap the packaged snack for air-popped popcorn or roasted chickpeas.",
        whyItIsHealthier: "Usually gives better fiber, protein, and lower sodium."
      }
    ];
  }
  if (category.includes("noodle")) {
    return [
      {
        level: "category",
        title: "Vegetable rice bowl",
        description: "Replace instant noodles with rice, vegetables, and egg or beans.",
        whyItIsHealthier: "Usually lowers sodium and adds more real-food ingredients."
      }
    ];
  }
  if (category.includes("meat") || category.includes("processed")) {
    return [
      {
        level: "category",
        title: "Lean protein or beans instead",
        description: "Swap processed meat for grilled chicken, fish, beans, or lentils with vegetables.",
        whyItIsHealthier: "Cuts back on sodium, saturated fat, and heavy processing."
      }
    ];
  }

  return [
    {
      level: "category",
      title: "Possible healthier alternative",
      description: "Choose a less-processed option in the same category with vegetables or whole foods.",
      whyItIsHealthier: "Usually improves nutrient quality when certainty is moderate."
    }
  ];
}

function buildInsufficientResponse(scan, research, confidence, reasoning) {
  const nextStepSuggestion =
    "Please retake the image with better lighting and include the front package plus nutrition facts label.";
  return {
    status: "success",
    scanMethod: "openai-vision",
    analysisMode: "insufficient_data",
    confidence: {
      labelConfidence: toPercent(confidence.labelConfidence),
      productConfidence: toPercent(confidence.productConfidence),
      categoryConfidence: toPercent(confidence.categoryConfidence),
      researchConfidence: toPercent(confidence.researchConfidence),
      analysisConfidence: toPercent(confidence.analysisConfidence)
    },
    confidenceLabel: confidenceLabel(confidence.analysisConfidence),
    analysisReasoningSummary: reasoning,
    identifiedFood: {
      brandName: scan.identifiedFood?.brandName || null,
      productName: scan.identifiedFood?.productName || null,
      category: scan.identifiedFood?.category || null
    },
    research: {
      attempted: Boolean(research?.attempted),
      used: Boolean(research?.used),
      reasonNotUsed: research?.reasonNotUsed || "LOW_PRODUCT_CONFIDENCE",
      reasonDetail:
        research?.reasonDetail ||
        "Research was not attempted because product identity confidence was too low for reliable lookup.",
      failureCode: research?.failureCode || "LOW_PRODUCT_CONFIDENCE",
      query: research?.query || null,
      matchedProduct: research?.matchedProduct || null,
      nutrition: research?.nutrition || {},
      sources: Array.isArray(research?.sources) ? research.sources : []
    },
    nutrition: {},
    estimatedInsights: {},
    estimatedRanges: {},
    warningsStatus: "insufficient_data",
    healthScore: null,
    scorePresentation: "not_reliable",
    scoreConfidence: "low",
    scoreReasoning: [
      "Not enough reliable evidence to compute a trustworthy health score."
    ],
    healthWarnings: [],
    plainLanguageSummary:
      "The app could not confidently identify the product or read a nutrition label from this image.",
    healthierAlternative: null,
    recipeIdeas: [],
    nextStepSuggestion
  };
}

export async function analyzeScan(req, res, next) {
  try {
    console.info("[scanController] /api/scans/analyze hit");

    if (!req.file) {
      console.warn("[scanController] missing file upload");
      return res.status(400).json({
        status: "error",
        message: "No image uploaded. Please upload a file with the 'file' field."
      });
    }

    if (!req.file.mimetype?.startsWith("image/")) {
      console.warn("[scanController] invalid mimetype", req.file.mimetype);
      return res.status(400).json({
        status: "error",
        message: "Invalid upload. Please send a valid image file."
      });
    }

    console.info("[scanController] file received", {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: Boolean(req.file.buffer?.length)
    });

    const scannerResult = await scanFoodLabelImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype
    });
    let analysis = scannerResult.analysis;
    const rawAiResponse = scannerResult.rawAiResponse;
    const identityResolved = enrichIdentityFromSignals(analysis);
    analysis = identityResolved.analysis;
    console.info("[scanController] model analysis received", {
      labelDetected: analysis.labelDetected,
      identifiedBrand: analysis.identifiedFood?.brandName,
      identifiedName: analysis.identifiedFood?.productName,
      identifiedCategory: analysis.identifiedFood?.category,
      identityConfidence: analysis.identifiedFood?.confidence,
      scanConfidence: analysis.confidence,
      inferredCategory: identityResolved.inferredIdentity.category
    });

    const researched = await runResearchFallback(analysis);
    const preConfidence = buildConfidence(researched.analysis, researched.research);
    analysis = applyCategoryEstimates(researched.analysis, {
      allowEstimates: true,
      categoryConfidence: preConfidence.categoryConfidence,
      threshold: THRESHOLDS.categoryConfidenceMin
    });

    const confidence = buildConfidence(analysis, researched.research);
    const evidence = hasActionableEvidence(analysis, confidence, researched.research);
    const coarseMode = detectAnalysisMode(evidence);
    const mode = refineAnalysisMode(analysis, confidence, evidence, researched.research);
    const reasoning = reasoningSummary(analysis, researched.research, evidence, mode);
    console.info("[scanController] confidence + gating", {
      mode,
      coarseMode,
      confidence: {
        label: toPercent(confidence.labelConfidence),
        product: toPercent(confidence.productConfidence),
        category: toPercent(confidence.categoryConfidence),
        research: toPercent(confidence.researchConfidence),
        analysis: toPercent(confidence.analysisConfidence),
        ocrReliability: toPercent(confidence.ocrReliability),
        completeness: toPercent(confidence.nutritionCompleteness),
        structure: toPercent(confidence.labelStructure),
        clarity: toPercent(confidence.ocrQuality)
      },
      research: {
        attempted: researched.research.attempted,
        used: researched.research.used,
        failureCode: researched.research.failureCode
      }
    });

    if (mode === "insufficient_data") {
      const responsePayload = buildInsufficientResponse(analysis, researched.research, confidence, reasoning);
      const persistedPayload = await persistScanResult({
        userId: req.auth.userId,
        file: req.file,
        analysisResult: responsePayload,
        rawAiResponse
      });
      return res.json(persistedPayload);
    }

    const health = evaluateHealthProfile(analysis);
    const softenedWarnings = softenWarningsByConfidence(health.warnings, confidence.analysisConfidence);
    const mergedWarnings = uniqueStrings([...(analysis.healthWarnings || []), ...softenedWarnings]);
    const warningsStatus =
      confidence.analysisConfidence >= THRESHOLDS.strongClaimMin
        ? "determined"
        : "limited_confidence";

    const recommendations = buildRecommendations(analysis, mergedWarnings);
    const allowRecipes =
      confidence.productConfidence >= THRESHOLDS.recipeProductMin ||
      confidence.categoryConfidence >= THRESHOLDS.recipeCategoryMin;
    const allowAlternative =
      confidence.productConfidence >= THRESHOLDS.categoryConfidenceMin ||
      confidence.categoryConfidence >= THRESHOLDS.categoryConfidenceMin;

    let finalRecipes = allowRecipes ? recommendations.recipeIdeas.slice(0, 3) : [];
    if (
      allowRecipes &&
      confidence.productConfidence < THRESHOLDS.recipeProductMin &&
      confidence.categoryConfidence < THRESHOLDS.strongClaimMin
    ) {
      finalRecipes = moderateConfidenceSwapIdeas(finalRecipes);
    }
    if (allowRecipes && finalRecipes.length === 0) {
      finalRecipes = genericCategorySwapIdeas(analysis);
    }

    const finalAlternative = allowAlternative
      ? recommendations.healthierAlternative || (analysis.identifiedFood?.category
          ? {
              level: "category",
              title: "Try a less-processed option in the same category",
              type: "Category-level healthier swap",
              reason:
                "This appears to be a processed packaged food and lower-sodium, less-processed options may be better."
            }
          : null)
      : null;

    const warningFallback =
      warningsStatus === "limited_confidence" && mergedWarnings.length === 0
        ? ["Warnings could not be determined reliably because nutrition data was insufficient."]
        : mergedWarnings;

    const scoreOutput = calculateFinalScore(health.score, analysis, confidence, warningFallback);

    const plainSummary =
      confidence.analysisConfidence >= THRESHOLDS.strongClaimMin
        ? analysis.plainLanguageSummary
        : confidence.analysisConfidence >= THRESHOLDS.moderateClaimMin
        ? `This is a moderate-confidence analysis. ${analysis.plainLanguageSummary}`
        : "Evidence is limited. The app could only provide partial guidance from this image.";

    const nextStepSuggestion =
      confidence.analysisConfidence >= THRESHOLDS.moderateClaimMin
        ? null
        : "Retake the image with clearer front-package text and nutrition facts to improve confidence.";

    const responsePayload = {
      status: "success",
      scanMethod: "openai-vision",
      analysisMode: mode,
      confidence: {
        labelConfidence: toPercent(confidence.labelConfidence),
        productConfidence: toPercent(confidence.productConfidence),
        categoryConfidence: toPercent(confidence.categoryConfidence),
        researchConfidence: toPercent(confidence.researchConfidence),
        analysisConfidence: toPercent(confidence.analysisConfidence),
        ocrReliability: toPercent(confidence.ocrReliability),
        nutritionCompleteness: toPercent(confidence.nutritionCompleteness),
        labelStructure: toPercent(confidence.labelStructure),
        ocrQuality: toPercent(confidence.ocrQuality),
        ingredientDetection: toPercent(confidence.ingredientDetection)
      },
      confidenceLabel: confidenceLabel(confidence.analysisConfidence),
      analysisReasoningSummary: reasoning,
      identifiedFood: {
        brandName: analysis.identifiedFood?.brandName || null,
        productName: analysis.identifiedFood?.productName || null,
        category: analysis.identifiedFood?.category || null
      },
      research: {
        attempted: Boolean(researched.research.attempted),
        used: Boolean(researched.research.used),
        reasonNotUsed: researched.research.reasonNotUsed || null,
        reasonDetail: researched.research.reasonDetail || null,
        failureCode: researched.research.failureCode || null,
        query: researched.research.query || null,
        matchedProduct: researched.research.matchedProduct || null,
        nutrition: researched.research.nutrition || {},
        sources: Array.isArray(researched.research.sources) ? researched.research.sources : [],
        matchScore: toPercent(researched.research.matchScore || 0),
        filledFields: researched.research.filledFields || 0
      },
      nutrition: analysis.nutrition,
      ocrSignals: analysis.ocrSignals,
      estimatedInsights: analysis.estimatedInsights || defaultEstimatedInsights(),
      estimatedRanges: analysis.estimatedRanges || defaultEstimatedRanges(),
      warningsStatus,
      healthScore:
        scoreOutput.scorePresentation === "not_reliable"
          ? null
          : scoreOutput.finalScore,
      scorePresentation: scoreOutput.scorePresentation,
      scoreConfidence: scoreOutput.scoreConfidence,
      scoreReasoning: scoreOutput.scoreReasoning,
      healthWarnings: warningFallback,
      plainLanguageSummary: plainSummary,
      healthierAlternative: finalAlternative,
      recipeIdeas: finalRecipes,
      nextStepSuggestion,
      ingredients: analysis.ingredients || [],
      allergens: analysis.allergens || [],
      unreadableFields: analysis.unreadableFields || []
    };

    const persistedPayload = await persistScanResult({
      userId: req.auth.userId,
      file: req.file,
      analysisResult: responsePayload,
      rawAiResponse
    });

    return res.json(persistedPayload);
  } catch (error) {
    if (error instanceof OpenAiScannerError) {
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.message,
        code: error.code
      });
    }

    console.error("[scanController] unhandled error", error);
    return next(error);
  }
}
