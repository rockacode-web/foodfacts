import axios from "axios";
import { clearStoredSession, getStoredToken } from "../auth/storage";
import type {
  AuthSuccessResponse,
  AuthUser,
  DailyIntakeResponse,
  IntakeEntry,
  NutrientSource,
  NutritionMap,
  ScanHistoryItem,
  ScanResponse,
  StoredScanDetail
} from "../types";

function normalizeApiBaseUrl(rawBaseUrl?: string) {
  const fallbackBaseUrl = "http://localhost:5000/api";
  const trimmedBaseUrl = rawBaseUrl?.trim();

  if (!trimmedBaseUrl) {
    return fallbackBaseUrl;
  }

  return trimmedBaseUrl.endsWith("/api") ? trimmedBaseUrl : `${trimmedBaseUrl.replace(/\/+$/, "")}/api`;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

type LegacyScanResponse = {
  message?: string;
  score?: number | null;
  explanation?: string;
  warnings?: string[];
  nutrition?: {
    calories?: number | null;
    sugar?: number | null;
    sodium?: number | null;
    saturatedFat?: number | null;
    protein?: number | null;
    ingredients?: string | null;
  };
  alternatives?: Array<{ name?: string; reason?: string; category?: string }>;
  recipes?: Array<{ name?: string; description?: string; keyIngredients?: string[] }>;
  healthierAlternative?: string | null;
};

type PreviousOpenAiShape = {
  status?: "success" | "error";
  scanMethod?: string;
  healthScore?: number;
  analysis?: {
    productName?: string | null;
    brandName?: string | null;
    calories?: number | null;
    totalFat_g?: number | null;
    saturatedFat_g?: number | null;
    transFat_g?: number | null;
    cholesterol_mg?: number | null;
    sodium_mg?: number | null;
    totalCarbs_g?: number | null;
    fiber_g?: number | null;
    sugar_g?: number | null;
    addedSugar_g?: number | null;
    protein_g?: number | null;
    ingredients?: string[];
    allergens?: string[];
    confidence?: number;
    unreadableFields?: string[];
    plainLanguageSummary?: string;
    healthWarnings?: string[];
    healthierAlternative?: { type?: string | null; reason?: string | null };
    recipeIdeas?: Array<{ title?: string; description?: string; whyItIsHealthier?: string }>;
  };
  message?: string;
  code?: string;
};

type AuthEnvelope = {
  status: "success" | "error";
  token?: string;
  user?: AuthUser;
  message?: string;
};

type MeEnvelope = {
  status: "success" | "error";
  user?: AuthUser;
  message?: string;
};

type HistoryEnvelope = {
  status: "success" | "error";
  scans?: ScanHistoryItem[];
  message?: string;
};

type DetailEnvelope = {
  status: "success" | "error";
  scan?: StoredScanDetail;
  message?: string;
};

type DeleteEnvelope = {
  status: "success" | "error";
  deleted?: boolean;
  id?: number;
  message?: string;
};

type IntakeEntryEnvelope = {
  status: "success" | "error";
  entry?: IntakeEntry;
  message?: string;
};

type TodayIntakeEnvelope = {
  status: "success" | "error";
  date?: string;
  totals?: DailyIntakeResponse["totals"];
  entries?: IntakeEntry[];
  insights?: string[];
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const apiClient = axios.create({
  baseURL: API_BASE_URL
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const metric = (value: number | null | undefined, source: NutrientSource) => ({
  value: typeof value === "number" ? value : null,
  source
});

const defaultIdentifiedFood = {
  brandName: null,
  productName: null,
  category: null,
  confidence: 0.5
} as const;

const defaultEstimatedInsights = {
  sodiumLikelihood: null,
  processingLevel: null,
  generalHealthNote: null,
  sugarLikelihood: null,
  fiberLikelihood: null
} as const;

const defaultEstimatedRanges = {
  calories: null,
  sodium_mg: null,
  saturatedFat_g: null,
  sugar_g: null,
  fiber_g: null
} as const;

const defaultResearch = {
  attempted: false,
  used: false,
  reasonNotUsed: null,
  reasonDetail: null,
  failureCode: null,
  query: null,
  matchedProduct: null,
  sources: []
};

const NUTRIENT_KEYS: Array<keyof NutritionMap> = [
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

const normalizeSource = (source: unknown): NutrientSource => {
  if (source === "label") {
    return "label";
  }
  if (source === "researched_online") {
    return "researched_online";
  }
  if (source === "estimated_category" || source === "estimated") {
    return "estimated_category";
  }
  return "unknown";
};

const normalizeMode = (mode: unknown): ScanResponse["analysisMode"] => {
  if (
    mode === "exact_label" ||
    mode === "partial_label" ||
    mode === "research_assisted" ||
    mode === "category_estimated" ||
    mode === "insufficient_data"
  ) {
    return mode;
  }
  if (mode === "label") {
    return "partial_label";
  }
  if (mode === "research") {
    return "research_assisted";
  }
  if (mode === "estimated") {
    return "category_estimated";
  }
  if (mode === "hybrid") {
    return "partial_label";
  }
  return "insufficient_data";
};

const toIngredientsArray = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toApiError = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError(error)) {
    const message =
      typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : error.message || fallbackMessage;
    const status = error.response?.status || 500;
    const code =
      typeof error.response?.data?.code === "string"
        ? error.response.data.code
        : undefined;

    if (status === 401) {
      clearStoredSession();
    }

    return new ApiError(message, status, code);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError(fallbackMessage, 500);
};

const normalizeLegacyResponse = (raw: LegacyScanResponse): ScanResponse => {
  const primaryAlternative = raw.alternatives?.[0];
  const altType = primaryAlternative?.category || (raw.healthierAlternative ? "Suggested swap" : null);
  const altReason =
    primaryAlternative?.reason || (raw.healthierAlternative ? raw.healthierAlternative : null);

  return {
    status: "success",
    scanMethod: "legacy-backend",
    analysisMode: "partial_label",
    confidence: 0.45,
    identifiedFood: { ...defaultIdentifiedFood },
    nutrition: {
      calories: metric(raw.nutrition?.calories, raw.nutrition?.calories != null ? "label" : "unknown"),
      totalFat_g: metric(null, "unknown"),
      saturatedFat_g: metric(
        raw.nutrition?.saturatedFat,
        raw.nutrition?.saturatedFat != null ? "label" : "unknown"
      ),
      transFat_g: metric(null, "unknown"),
      cholesterol_mg: metric(null, "unknown"),
      sodium_mg: metric(raw.nutrition?.sodium, raw.nutrition?.sodium != null ? "label" : "unknown"),
      totalCarbs_g: metric(null, "unknown"),
      fiber_g: metric(null, "unknown"),
      sugar_g: metric(raw.nutrition?.sugar, raw.nutrition?.sugar != null ? "label" : "unknown"),
      addedSugar_g: metric(null, "unknown"),
      protein_g: metric(raw.nutrition?.protein, raw.nutrition?.protein != null ? "label" : "unknown")
    },
    estimatedInsights: {
      sodiumLikelihood: null,
      processingLevel: null,
      generalHealthNote: raw.explanation || raw.message || null,
      sugarLikelihood: null,
      fiberLikelihood: null
    },
    estimatedRanges: { ...defaultEstimatedRanges },
    research: { ...defaultResearch },
    healthScore: typeof raw.score === "number" ? raw.score : 0,
    healthWarnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    plainLanguageSummary:
      raw.explanation || raw.message || "Scan completed, but detailed analysis is limited.",
    healthierAlternative: {
      type: altType,
      reason: altReason
    },
    recipeIdeas: Array.isArray(raw.recipes)
      ? raw.recipes.slice(0, 3).map((recipe) => ({
          title: recipe.name || "Alternative idea",
          description:
            recipe.description || "Healthier alternative idea based on the scanned product.",
          whyItIsHealthier:
            "Uses a lighter approach compared with heavily processed or high-sodium options."
        }))
      : [],
    ingredients: toIngredientsArray(raw.nutrition?.ingredients),
    allergens: [],
    unreadableFields: []
  };
};

const normalizePreviousOpenAiShape = (raw: PreviousOpenAiShape): ScanResponse => {
  const analysis = raw.analysis;
  if (!analysis) {
    return {
      status: raw.status || "error",
      message: raw.message || "Scan completed but no analysis data was returned.",
      code: raw.code || "invalid_response_shape"
    };
  }

  return {
    status: raw.status || "success",
    scanMethod: raw.scanMethod || "openai-vision",
    analysisMode: "partial_label",
    confidence: typeof analysis.confidence === "number" ? analysis.confidence : 0.6,
    identifiedFood: {
      brandName: analysis.brandName || null,
      productName: analysis.productName || null,
      category: null,
      confidence: typeof analysis.confidence === "number" ? analysis.confidence : 0.6
    },
    nutrition: {
      calories: metric(analysis.calories, analysis.calories != null ? "label" : "unknown"),
      totalFat_g: metric(analysis.totalFat_g, analysis.totalFat_g != null ? "label" : "unknown"),
      saturatedFat_g: metric(
        analysis.saturatedFat_g,
        analysis.saturatedFat_g != null ? "label" : "unknown"
      ),
      transFat_g: metric(analysis.transFat_g, analysis.transFat_g != null ? "label" : "unknown"),
      cholesterol_mg: metric(
        analysis.cholesterol_mg,
        analysis.cholesterol_mg != null ? "label" : "unknown"
      ),
      sodium_mg: metric(analysis.sodium_mg, analysis.sodium_mg != null ? "label" : "unknown"),
      totalCarbs_g: metric(
        analysis.totalCarbs_g,
        analysis.totalCarbs_g != null ? "label" : "unknown"
      ),
      fiber_g: metric(analysis.fiber_g, analysis.fiber_g != null ? "label" : "unknown"),
      sugar_g: metric(analysis.sugar_g, analysis.sugar_g != null ? "label" : "unknown"),
      addedSugar_g: metric(
        analysis.addedSugar_g,
        analysis.addedSugar_g != null ? "label" : "unknown"
      ),
      protein_g: metric(analysis.protein_g, analysis.protein_g != null ? "label" : "unknown")
    },
    estimatedInsights: {
      sodiumLikelihood: null,
      processingLevel: null,
      generalHealthNote: analysis.plainLanguageSummary || null,
      sugarLikelihood: null,
      fiberLikelihood: null
    },
    estimatedRanges: { ...defaultEstimatedRanges },
    research: { ...defaultResearch },
    healthScore: typeof raw.healthScore === "number" ? raw.healthScore : 0,
    healthWarnings: Array.isArray(analysis.healthWarnings) ? analysis.healthWarnings : [],
    plainLanguageSummary:
      analysis.plainLanguageSummary || raw.message || "Analysis completed with limited details.",
    healthierAlternative: {
      type: analysis.healthierAlternative?.type || null,
      reason: analysis.healthierAlternative?.reason || null
    },
    recipeIdeas: Array.isArray(analysis.recipeIdeas)
      ? analysis.recipeIdeas
          .filter((item) => item?.title && item?.description && item?.whyItIsHealthier)
          .map((item) => ({
            title: item.title as string,
            description: item.description as string,
            whyItIsHealthier: item.whyItIsHealthier as string
          }))
      : [],
    ingredients: Array.isArray(analysis.ingredients) ? analysis.ingredients : [],
    allergens: Array.isArray(analysis.allergens) ? analysis.allergens : [],
    unreadableFields: Array.isArray(analysis.unreadableFields) ? analysis.unreadableFields : []
  };
};

const normalizeCurrentShape = (raw: ScanResponse): ScanResponse => ({
  ...raw,
  analysisMode: normalizeMode(raw.analysisMode),
  identifiedFood: {
    ...defaultIdentifiedFood,
    ...(raw.identifiedFood || {}),
    productName:
      (raw.identifiedFood as { productName?: string | null; name?: string | null } | undefined)
        ?.productName ??
      (raw.identifiedFood as { productName?: string | null; name?: string | null } | undefined)
        ?.name ??
      null
  },
  nutrition: raw.nutrition
    ? NUTRIENT_KEYS.reduce((acc, key) => {
        const value = raw.nutrition?.[key];
        acc[key] = {
          value: typeof value?.value === "number" ? value.value : null,
          source: normalizeSource(value?.source)
        };
        return acc;
      }, {} as NutritionMap)
    : raw.nutrition,
  estimatedInsights: {
    ...defaultEstimatedInsights,
    ...(raw.estimatedInsights || {})
  },
  estimatedRanges: {
    ...defaultEstimatedRanges,
    ...(raw.estimatedRanges || {})
  },
  research: {
    ...defaultResearch,
    ...(raw.research || {}),
    sources: Array.isArray(raw.research?.sources) ? raw.research.sources : []
  },
  warningsStatus: raw.warningsStatus || "determined"
});

const normalizeScanResponse = (raw: unknown): ScanResponse => {
  if (raw && typeof raw === "object") {
    const candidate = raw as ScanResponse;
    if (candidate.status && candidate.nutrition && candidate.identifiedFood) {
      return normalizeCurrentShape(candidate);
    }

    const maybePrevious = raw as PreviousOpenAiShape;
    if (maybePrevious.analysis) {
      return normalizePreviousOpenAiShape(maybePrevious);
    }

    const legacy = raw as LegacyScanResponse;
    if (legacy.message || legacy.nutrition || legacy.explanation || legacy.warnings) {
      return normalizeLegacyResponse(legacy);
    }
  }

  return {
    status: "error",
    message: "Scan completed but no analysis data was returned.",
    code: "invalid_response_shape"
  };
};

const normalizeStoredScan = (raw: StoredScanDetail): StoredScanDetail => ({
  ...raw,
  analysisMode: normalizeMode(raw.analysisMode) || raw.analysisMode || "insufficient_data",
  warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  alternatives: Array.isArray(raw.alternatives) ? raw.alternatives : [],
  recipeIdeas: Array.isArray(raw.recipeIdeas) ? raw.recipeIdeas : []
});

const normalizeIntakeEntry = (raw: IntakeEntry): IntakeEntry => ({
  id: raw.id,
  userId: raw.userId,
  scanId: raw.scanId,
  servings: typeof raw.servings === "number" ? raw.servings : 1,
  consumedAt: raw.consumedAt,
  createdAt: raw.createdAt,
  calories: typeof raw.calories === "number" ? raw.calories : null,
  sodiumMg: typeof raw.sodiumMg === "number" ? raw.sodiumMg : null,
  sugarG: typeof raw.sugarG === "number" ? raw.sugarG : null,
  saturatedFatG: typeof raw.saturatedFatG === "number" ? raw.saturatedFatG : null,
  fiberG: typeof raw.fiberG === "number" ? raw.fiberG : null,
  proteinG: typeof raw.proteinG === "number" ? raw.proteinG : null,
  sourceSummary: typeof raw.sourceSummary === "string" ? raw.sourceSummary : null,
  sourceFoodName: typeof raw.sourceFoodName === "string" ? raw.sourceFoodName : null
});

export const mapStoredScanToResponse = (scan: StoredScanDetail): ScanResponse => {
  const source = normalizeSource(scan.nutritionFacts?.sourceType);
  const rawAiResponse = scan.rawAiResponse || {};
  const rawIdentifiedFood =
    rawAiResponse && typeof rawAiResponse === "object" && "identifiedFood" in rawAiResponse
      ? (rawAiResponse.identifiedFood as {
          brandName?: string | null;
          productName?: string | null;
          category?: string | null;
          confidence?: number;
        })
      : undefined;
  const rawEstimatedInsights =
    rawAiResponse && typeof rawAiResponse === "object" && "estimatedInsights" in rawAiResponse
      ? (rawAiResponse.estimatedInsights as {
          sodiumLikelihood?: string | null;
          sugarLikelihood?: string | null;
          fiberLikelihood?: string | null;
          processingLevel?: string | null;
          generalHealthNote?: string | null;
        })
      : undefined;

  return normalizeCurrentShape({
    status: "success",
    scanId: scan.id,
    imagePath: scan.imagePath,
    persistedAt: scan.createdAt,
    analysisMode: normalizeMode(scan.analysisMode),
    confidence: {
      labelConfidence: 0,
      productConfidence: 0,
      categoryConfidence: 0,
      researchConfidence: 0,
      analysisConfidence: Math.round(scan.confidenceScore || 0)
    },
    confidenceLabel: "moderate",
    identifiedFood: {
      brandName: rawIdentifiedFood?.brandName || null,
      productName: rawIdentifiedFood?.productName || null,
      category: rawIdentifiedFood?.category || null,
      confidence: typeof rawIdentifiedFood?.confidence === "number" ? rawIdentifiedFood.confidence : 0.5
    },
    nutrition: {
      calories: metric(scan.nutritionFacts?.calories, source),
      totalFat_g: metric(null, source),
      saturatedFat_g: metric(scan.nutritionFacts?.saturatedFatG, source),
      transFat_g: metric(null, source),
      cholesterol_mg: metric(null, source),
      sodium_mg: metric(scan.nutritionFacts?.sodiumMg, source),
      totalCarbs_g: metric(null, source),
      fiber_g: metric(scan.nutritionFacts?.fiberG, source),
      sugar_g: metric(scan.nutritionFacts?.sugarG, source),
      addedSugar_g: metric(null, source),
      protein_g: metric(scan.nutritionFacts?.proteinG, source)
    },
    estimatedInsights: {
      ...defaultEstimatedInsights,
      ...(rawEstimatedInsights || {})
    },
    estimatedRanges: { ...defaultEstimatedRanges },
    research: { ...defaultResearch },
    healthScore: scan.healthScore,
    healthWarnings: (scan.warnings || []).map((warning) => warning.warningText),
    plainLanguageSummary: scan.summary || "Stored scan result.",
    healthierAlternative:
      scan.alternatives && scan.alternatives.length > 0
        ? {
            type: "Saved healthier alternatives",
            reason: "These alternatives were stored with the original scan result.",
            options: scan.alternatives.map((alternative) => ({
              name: alternative.title,
              reason: alternative.description
            }))
          }
        : null,
    recipeIdeas: (scan.recipeIdeas || []).map((idea) => ({
      title: idea.title,
      description: idea.description,
      whyItIsHealthier: idea.reason
    })),
    ingredients: [],
    allergens: [],
    unreadableFields: []
  });
};

export const registerUser = async (payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> => {
  try {
    const response = await apiClient.post<AuthEnvelope>("/auth/register", payload);
    if (response.data.status !== "success" || !response.data.token || !response.data.user) {
      throw new ApiError(response.data.message || "Registration failed.", 400);
    }
    return response.data as AuthSuccessResponse;
  } catch (error) {
    throw toApiError(error, "Registration failed.");
  }
};

export const loginUser = async (payload: {
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> => {
  try {
    const response = await apiClient.post<AuthEnvelope>("/auth/login", payload);
    if (response.data.status !== "success" || !response.data.token || !response.data.user) {
      throw new ApiError(response.data.message || "Login failed.", 401);
    }
    return response.data as AuthSuccessResponse;
  } catch (error) {
    throw toApiError(error, "Login failed.");
  }
};

export const getCurrentUser = async (): Promise<AuthUser> => {
  try {
    const response = await apiClient.get<MeEnvelope>("/auth/me");
    if (response.data.status !== "success" || !response.data.user) {
      throw new ApiError(response.data.message || "Could not restore session.", 401);
    }
    return response.data.user;
  } catch (error) {
    throw toApiError(error, "Could not restore session.");
  }
};

export const analyzeScan = async (file: File): Promise<ScanResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await apiClient.post<ScanResponse>("/scans/analyze", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    return normalizeScanResponse(response.data);
  } catch (error) {
    throw toApiError(error, "Failed to analyze image.");
  }
};

export const fetchScanHistory = async (): Promise<ScanHistoryItem[]> => {
  try {
    const response = await apiClient.get<HistoryEnvelope>("/scans/history");
    if (response.data.status !== "success" || !Array.isArray(response.data.scans)) {
      throw new ApiError(response.data.message || "Could not load scan history.", 500);
    }
    return response.data.scans;
  } catch (error) {
    throw toApiError(error, "Could not load scan history.");
  }
};

export const fetchScanDetail = async (scanId: number): Promise<StoredScanDetail> => {
  try {
    const response = await apiClient.get<DetailEnvelope>(`/scans/${scanId}`);
    if (response.data.status !== "success" || !response.data.scan) {
      throw new ApiError(response.data.message || "Could not load scan detail.", 404);
    }
    return normalizeStoredScan(response.data.scan);
  } catch (error) {
    throw toApiError(error, "Could not load scan detail.");
  }
};

export const deleteStoredScan = async (scanId: number): Promise<void> => {
  try {
    const response = await apiClient.delete<DeleteEnvelope>(`/scans/${scanId}`);
    if (response.data.status !== "success") {
      throw new ApiError(response.data.message || "Could not delete scan.", 500);
    }
  } catch (error) {
    throw toApiError(error, "Could not delete scan.");
  }
};

export const createIntakeEntry = async (payload: {
  scanId: number;
  servings: number;
}): Promise<IntakeEntry> => {
  try {
    const response = await apiClient.post<IntakeEntryEnvelope>("/intake", payload);
    if (response.data.status !== "success" || !response.data.entry) {
      throw new ApiError(response.data.message || "Could not log intake entry.", 400);
    }
    return normalizeIntakeEntry(response.data.entry);
  } catch (error) {
    throw toApiError(error, "Could not log intake entry.");
  }
};

export const fetchTodayIntake = async (): Promise<DailyIntakeResponse> => {
  try {
    const response = await apiClient.get<TodayIntakeEnvelope>("/intake/today");
    if (
      response.data.status !== "success" ||
      typeof response.data.date !== "string" ||
      !response.data.totals ||
      !Array.isArray(response.data.entries) ||
      !Array.isArray(response.data.insights)
    ) {
      throw new ApiError(response.data.message || "Could not load today's intake.", 500);
    }

    return {
      date: response.data.date,
      totals: response.data.totals,
      entries: response.data.entries.map(normalizeIntakeEntry),
      insights: response.data.insights
    };
  } catch (error) {
    throw toApiError(error, "Could not load today's intake.");
  }
};

export const deleteIntakeEntry = async (entryId: number): Promise<void> => {
  try {
    const response = await apiClient.delete<DeleteEnvelope>(`/intake/${entryId}`);
    if (response.data.status !== "success") {
      throw new ApiError(response.data.message || "Could not remove intake entry.", 500);
    }
  } catch (error) {
    throw toApiError(error, "Could not remove intake entry.");
  }
};
