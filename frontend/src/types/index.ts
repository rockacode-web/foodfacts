export type NutrientSource =
  | "label"
  | "researched_online"
  | "estimated_category"
  | "unknown";
export type AnalysisMode =
  | "exact_label"
  | "partial_label"
  | "research_assisted"
  | "category_estimated"
  | "insufficient_data";

export interface NutrientMetric {
  value: number | null;
  source: NutrientSource;
}

export interface RecipeIdea {
  level?: "product" | "category";
  title: string;
  description: string;
  whyItIsHealthier: string;
}

export interface HealthierAlternative {
  level?: "product" | "category";
  title?: string | null;
  type: string | null;
  reason: string | null;
  options?: Array<{ name: string; reason: string }>;
  shoppingTip?: string | null;
}

export interface IdentifiedFood {
  brandName: string | null;
  productName: string | null;
  category: string | null;
  confidence: number;
}

export interface NutritionMap {
  calories: NutrientMetric;
  totalFat_g: NutrientMetric;
  saturatedFat_g: NutrientMetric;
  transFat_g: NutrientMetric;
  cholesterol_mg: NutrientMetric;
  sodium_mg: NutrientMetric;
  totalCarbs_g: NutrientMetric;
  fiber_g: NutrientMetric;
  sugar_g: NutrientMetric;
  addedSugar_g: NutrientMetric;
  protein_g: NutrientMetric;
}

export interface EstimatedInsights {
  sodiumLikelihood: string | null;
  processingLevel: string | null;
  generalHealthNote: string | null;
  sugarLikelihood?: string | null;
  fiberLikelihood?: string | null;
}

export interface EstimatedRanges {
  calories?: string | null;
  sodium_mg?: string | null;
  saturatedFat_g?: string | null;
  sugar_g?: string | null;
  fiber_g?: string | null;
}

export interface ResearchSource {
  name: string;
  url: string;
}

export interface ResearchTrace {
  attempted?: boolean;
  used: boolean;
  reasonNotUsed?: string | null;
  reasonDetail?: string | null;
  failureCode?: string | null;
  query: string | null;
  matchedProduct: string | null;
  sources: ResearchSource[];
  filledFields?: number;
  matchScore?: number;
}

export interface ConfidenceBreakdown {
  labelConfidence: number;
  productConfidence: number;
  categoryConfidence: number;
  researchConfidence: number;
  analysisConfidence: number;
}

export interface AnalysisReasoningSummary {
  labelDetected: boolean;
  productIdentified: boolean;
  researchAttempted: boolean;
  researchOutcome: string;
  primaryEvidenceSource: "label" | "researched_online" | "estimated_category" | "insufficient_data";
}

export interface ScanResponse {
  status: "success" | "error";
  scanMethod?: string;
  scanId?: number;
  imagePath?: string;
  persistedAt?: string;
  analysisMode?: AnalysisMode;
  confidence?: number | ConfidenceBreakdown;
  confidenceLabel?: "very_weak" | "weak" | "moderate" | "strong" | "very_strong";
  analysisReasoningSummary?: AnalysisReasoningSummary;
  identifiedFood?: IdentifiedFood;
  nutrition?: NutritionMap | Record<string, never>;
  estimatedInsights?: EstimatedInsights | Record<string, never>;
  estimatedRanges?: EstimatedRanges | Record<string, never>;
  research?: ResearchTrace;
  warningsStatus?: "determined" | "limited_confidence" | "insufficient_data";
  healthScore?: number | null;
  scorePresentation?: "final" | "preliminary" | "not_reliable";
  scoreConfidence?: "low" | "moderate" | "high";
  scoreReasoning?: string[];
  healthWarnings?: string[];
  plainLanguageSummary?: string;
  healthierAlternative?: HealthierAlternative | null;
  recipeIdeas?: RecipeIdea[];
  nextStepSuggestion?: string | null;
  ingredients?: string[];
  allergens?: string[];
  unreadableFields?: string[];
  message?: string;
  code?: string;
  scanPreview?: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSuccessResponse {
  status: "success";
  token: string;
  user: AuthUser;
}

export interface ScanHistoryItem {
  id: number;
  imagePath: string;
  analysisMode: AnalysisMode | string;
  summary: string | null;
  healthScore: number | null;
  confidenceScore: number | null;
  createdAt: string;
}

export interface StoredNutritionFacts {
  calories: number | null;
  sodiumMg: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  fiberG: number | null;
  proteinG: number | null;
  sourceType: NutrientSource | string;
  confidence: number | null;
}

export interface StoredWarning {
  id: number;
  warningType: string;
  warningText: string;
}

export interface StoredAlternative {
  id: number;
  title: string;
  description: string;
}

export interface StoredRecipeIdea {
  id: number;
  title: string;
  description: string;
  reason: string;
}

export interface StoredScanDetail extends ScanHistoryItem {
  rawAiResponse?: Record<string, unknown> | null;
  nutritionFacts?: StoredNutritionFacts | null;
  warnings?: StoredWarning[];
  alternatives?: StoredAlternative[];
  recipeIdeas?: StoredRecipeIdea[];
}

export interface IntakeNutrients {
  calories: number | null;
  sodiumMg: number | null;
  sugarG: number | null;
  proteinG: number | null;
}

export interface IntakeLogEntry {
  id: string;
  dateKey: string;
  loggedAt: string;
  source: "latest" | "saved";
  sourceScanId: number | null;
  title: string;
  summary: string;
  servings: number;
  analysisMode: string | null;
  healthScore: number | null;
  confidenceScore: number | null;
  nutrients: IntakeNutrients;
}
