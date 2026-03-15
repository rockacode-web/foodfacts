import OpenAI from "openai";
import { foodAnalysisSchema } from "../schemas/foodAnalysisSchema.js";

const SYSTEM_PROMPT = `
You are a food intelligence assistant analyzing one food/package image.

You must support two analysis paths:
1) Label-based analysis (preferred): if a nutrition label is visible, extract visible values only.
2) Food-identification analysis: if label is missing/incomplete, identify the product/category and provide estimated guidance.

Rules:
- Never invent exact values not visible on label.
- Never treat missing label values as zero.
- If product/category is recognizable, generate 2-3 practical healthier alternative ideas even when label is missing.
- For each nutrient return:
  - source = "label" when value is clearly visible from label
  - source = "estimated_category" when value or likely direction is category-based estimate
  - source = "researched_online" must not be used by you (reserved for backend enrichment)
  - source = "unknown" when no reliable value can be provided
- If a field is unknown, set value to null.
- If no nutrition label is visible but product is recognizable, still provide estimated insights and healthier alternative ideas.
- Extract product identity as:
  - identifiedFood.brandName
  - identifiedFood.productName
  - identifiedFood.category
  - identifiedFood.confidence (0 to 1)
- Return ocrSignals describing how trustworthy the visible label text is:
  - hasStructuredNutritionTable
  - hasServingSize
  - hasPercentDailyValues
  - ingredientsVisible
  - readableFieldCount
  - keyNutrientCount
  - textClarity = poor|fair|good|excellent
  - noiseLevel = high|medium|low
- The recipeIdeas array is still used by the app, but it must contain healthier swaps or replacement meal ideas, not ways to keep using the scanned item itself.
- Each recipeIdeas item should be short, practical, beginner-friendly, and clearly framed as an alternative to the scanned food/category.
- Return strict JSON only matching the schema.
`.trim();

const USER_PROMPT = `
Analyze this food/package image for health guidance.
First determine whether a nutrition label is visible.
If visible, extract visible label values only.
If not visible or incomplete, identify the food/product and provide estimated nutrition insights.
Do not imply missing equals zero.
`.trim();

const NUTRIENT_KEYS = [
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

let cachedClient = null;

export class OpenAiScannerError extends Error {
  constructor(message, statusCode = 500, code = "scanner_error") {
    super(message);
    this.name = "OpenAiScannerError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new OpenAiScannerError(
      "OPENAI_API_KEY is missing. Add it to your environment before scanning.",
      500,
      "missing_api_key"
    );
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return cachedClient;
}

function safeArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
}

function safeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampConfidence(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function safeSource(value) {
  if (
    value === "label" ||
    value === "researched_online" ||
    value === "estimated_category" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeNutrient(rawItem) {
  if (!rawItem || typeof rawItem !== "object") {
    return { value: null, source: "unknown" };
  }

  return {
    value: safeNumber(rawItem.value),
    source: safeSource(rawItem.source)
  };
}

function normalizeRecipeIdeas(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => ({
      title: typeof item?.title === "string" ? item.title.trim() : "",
      description: typeof item?.description === "string" ? item.description.trim() : "",
      whyItIsHealthier:
        typeof item?.whyItIsHealthier === "string" ? item.whyItIsHealthier.trim() : ""
    }))
    .filter((item) => item.title && item.description && item.whyItIsHealthier)
    .slice(0, 3);
}

function normalizeNutrition(rawNutrition) {
  const nutrition = {};
  for (const key of NUTRIENT_KEYS) {
    nutrition[key] = normalizeNutrient(rawNutrition?.[key]);
  }
  return nutrition;
}

function normalizeOcrSignals(raw) {
  const readableFieldCount =
    typeof raw?.readableFieldCount === "number" && Number.isFinite(raw.readableFieldCount)
      ? Math.max(0, Math.min(20, Math.round(raw.readableFieldCount)))
      : 0;
  const keyNutrientCount =
    typeof raw?.keyNutrientCount === "number" && Number.isFinite(raw.keyNutrientCount)
      ? Math.max(0, Math.min(8, Math.round(raw.keyNutrientCount)))
      : 0;
  const textClarity =
    raw?.textClarity === "poor" ||
    raw?.textClarity === "fair" ||
    raw?.textClarity === "good" ||
    raw?.textClarity === "excellent"
      ? raw.textClarity
      : "fair";
  const noiseLevel =
    raw?.noiseLevel === "high" || raw?.noiseLevel === "medium" || raw?.noiseLevel === "low"
      ? raw.noiseLevel
      : "medium";

  return {
    hasStructuredNutritionTable: Boolean(raw?.hasStructuredNutritionTable),
    hasServingSize: Boolean(raw?.hasServingSize),
    hasPercentDailyValues: Boolean(raw?.hasPercentDailyValues),
    ingredientsVisible: Boolean(raw?.ingredientsVisible),
    readableFieldCount,
    keyNutrientCount,
    textClarity,
    noiseLevel
  };
}

function normalizeAnalysis(raw) {
  if (!raw || typeof raw !== "object") {
    throw new OpenAiScannerError(
      "Model response was malformed and could not be normalized.",
      502,
      "malformed_model_response"
    );
  }

  return {
    labelDetected: Boolean(raw.labelDetected),
    identifiedFood: {
      brandName: safeString(raw.identifiedFood?.brandName),
      productName: safeString(raw.identifiedFood?.productName),
      category: safeString(raw.identifiedFood?.category),
      confidence: clampConfidence(
        typeof raw.identifiedFood?.confidence === "number"
          ? raw.identifiedFood.confidence
          : raw.confidence
      )
    },
    nutrition: normalizeNutrition(raw.nutrition),
    ocrSignals: normalizeOcrSignals(raw.ocrSignals),
    estimatedInsights: {
      sodiumLikelihood: safeString(raw.estimatedInsights?.sodiumLikelihood),
      processingLevel: safeString(raw.estimatedInsights?.processingLevel),
      generalHealthNote: safeString(raw.estimatedInsights?.generalHealthNote),
      sugarLikelihood: safeString(raw.estimatedInsights?.sugarLikelihood),
      fiberLikelihood: safeString(raw.estimatedInsights?.fiberLikelihood)
    },
    ingredients: safeArray(raw.ingredients),
    allergens: safeArray(raw.allergens),
    confidence: clampConfidence(raw.confidence),
    unreadableFields: safeArray(raw.unreadableFields),
    plainLanguageSummary:
      typeof raw.plainLanguageSummary === "string"
        ? raw.plainLanguageSummary.trim()
        : "The image was analyzed, but some details are still uncertain.",
    healthWarnings: safeArray(raw.healthWarnings),
    healthBenefits: safeArray(raw.healthBenefits),
    recommendedFor: safeArray(raw.recommendedFor),
    cautionFor: safeArray(raw.cautionFor),
    healthierAlternative: {
      type: safeString(raw.healthierAlternative?.type),
      reason: safeString(raw.healthierAlternative?.reason)
    },
    recipeIdeas: normalizeRecipeIdeas(raw.recipeIdeas)
  };
}

function extractJsonText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) {
    return "";
  }

  const chunks = [];
  for (const item of response.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export async function scanFoodLabelImage({ buffer, mimeType }) {
  if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
    throw new OpenAiScannerError("Uploaded image is empty or invalid.", 400, "invalid_upload");
  }

  if (!mimeType || !mimeType.startsWith("image/")) {
    throw new OpenAiScannerError("Only image uploads are supported.", 400, "invalid_upload");
  }

  const client = getClient();
  const imageDataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: SYSTEM_PROMPT }]
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: USER_PROMPT },
            { type: "input_image", image_url: imageDataUrl }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "food_label_analysis_v2",
          schema: foodAnalysisSchema,
          strict: true
        }
      }
    });

    const jsonText = extractJsonText(response);
    if (!jsonText) {
      throw new OpenAiScannerError(
        "OpenAI returned an empty response for this image.",
        502,
        "empty_model_response"
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new OpenAiScannerError(
        "OpenAI returned malformed JSON for image analysis.",
        502,
        "malformed_model_response"
      );
    }

    return {
      analysis: normalizeAnalysis(parsed),
      rawAiResponse: parsed
    };
  } catch (error) {
    const apiMessage =
      typeof error?.error?.message === "string"
        ? error.error.message
        : typeof error?.message === "string"
        ? error.message
        : null;

    console.error("[openAiFoodScanner] OpenAI request failed", {
      status: error?.status || null,
      code: error?.code || error?.error?.code || null,
      type: error?.type || error?.error?.type || null,
      message: apiMessage
    });

    if (error instanceof OpenAiScannerError) {
      throw error;
    }

    if (error?.status === 401) {
      throw new OpenAiScannerError(
        "OpenAI authentication failed. Verify OPENAI_API_KEY.",
        500,
        "openai_auth_error"
      );
    }

    if (error?.status === 400 && apiMessage) {
      throw new OpenAiScannerError(
        `OpenAI rejected the scan request: ${apiMessage}`,
        502,
        "openai_bad_request"
      );
    }

    if (error?.status === 429) {
      throw new OpenAiScannerError(
        "OpenAI rate limited the scan request. Try again in a moment.",
        502,
        "openai_rate_limited"
      );
    }

    throw new OpenAiScannerError(
      apiMessage
        ? `Failed to analyze the uploaded image with OpenAI. ${apiMessage}`
        : "Failed to analyze the uploaded image with OpenAI.",
      502,
      "openai_request_failed"
    );
  }
}
