import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccessibilityToggle from "../components/AccessibilityToggle";
import VoiceControls from "../components/VoiceControls";
import type { AnalysisMode, ConfidenceBreakdown, NutrientMetric, NutritionMap, ScanResponse } from "../types";

const UNKNOWN_METRIC: NutrientMetric = { value: null, source: "unknown" };
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

const modeLabel = (mode: AnalysisMode | undefined) => {
  if (mode === "exact_label") {
    return "Exact label analysis";
  }
  if (mode === "partial_label") {
    return "Label-based result with limited evidence";
  }
  if (mode === "research_assisted") {
    return "Research-assisted estimate";
  }
  if (mode === "category_estimated") {
    return "Category-based estimate";
  }
  return "Insufficient data";
};

const confidenceLabelText = (label: ScanResponse["confidenceLabel"]) => {
  if (label === "very_weak") {
    return "Very weak evidence";
  }
  if (label === "weak") {
    return "Weak evidence";
  }
  if (label === "moderate") {
    return "Moderate evidence";
  }
  if (label === "strong") {
    return "Strong evidence";
  }
  if (label === "very_strong") {
    return "Very strong evidence";
  }
  return "Moderate evidence";
};

const scoreLabel = (presentation: ScanResponse["scorePresentation"]) => {
  if (presentation === "preliminary") {
    return "Preliminary Score";
  }
  if (presentation === "not_reliable") {
    return "Score Not Reliable Yet";
  }
  return "Health Score";
};

const scoreStatusText = (presentation: ScanResponse["scorePresentation"]) => {
  if (presentation === "preliminary") {
    return "Useful guidance from partial evidence";
  }
  if (presentation === "not_reliable") {
    return "More evidence is needed before scoring";
  }
  return "Built from stronger evidence";
};

const sourceBadgeLabel = (source: NutrientMetric["source"]) => {
  if (source === "label") {
    return "Exact from label";
  }
  if (source === "researched_online") {
    return "Researched online";
  }
  if (source === "estimated_category") {
    return "Estimated from category";
  }
  return "Unknown";
};

const asConfidence = (input: ScanResponse["confidence"]): ConfidenceBreakdown => {
  if (typeof input === "number") {
    const fallback = Math.round(input * 100);
    return {
      labelConfidence: fallback,
      productConfidence: fallback,
      categoryConfidence: fallback,
      researchConfidence: 0,
      analysisConfidence: fallback
    };
  }
  return {
    labelConfidence: input?.labelConfidence ?? 0,
    productConfidence: input?.productConfidence ?? 0,
    categoryConfidence: input?.categoryConfidence ?? 0,
    researchConfidence: input?.researchConfidence ?? 0,
    analysisConfidence: input?.analysisConfidence ?? 0
  };
};

const hasNutritionMap = (nutrition: ScanResponse["nutrition"]): nutrition is NutritionMap =>
  Boolean(nutrition && typeof nutrition === "object" && "calories" in nutrition);

const normalizeNutrition = (nutrition: ScanResponse["nutrition"]): NutritionMap =>
  NUTRIENT_KEYS.reduce((acc, key) => {
    if (hasNutritionMap(nutrition) && nutrition[key]) {
      acc[key] = nutrition[key];
    } else {
      acc[key] = UNKNOWN_METRIC;
    }
    return acc;
  }, {} as NutritionMap);

const getMetricText = (
  metric: NutrientMetric,
  suffix: string,
  unknownText: string,
  fallbackRange?: string | null,
  fallbackLikelihood?: string | null
) => {
  if (typeof metric.value === "number") {
    if (metric.source === "estimated_category") {
      if (fallbackRange) {
        return `~${fallbackRange}`;
      }
      return `Approx ${metric.value}${suffix}`;
    }
    return `${metric.value}${suffix}`;
  }

  if (metric.source === "estimated_category") {
    if (fallbackRange) {
      return `~${fallbackRange}`;
    }
    if (fallbackLikelihood) {
      return fallbackLikelihood;
    }
    return "Estimated from category";
  }

  if (metric.source === "researched_online") {
    return "Researched online (value unavailable)";
  }

  return unknownText;
};

const buildSpokenText = (result: ScanResponse, simpleMode: boolean) => {
  if (result.analysisMode === "insufficient_data") {
    return [
      "Analysis incomplete.",
      "The app could not confidently identify the product or read a clear label.",
      result.nextStepSuggestion || "Retake the image with better lighting and clearer text."
    ].join(" ");
  }

  const scoreLabelText =
    result.scorePresentation === "preliminary"
      ? "preliminary score"
      : result.scorePresentation === "not_reliable"
      ? "score not reliable yet"
      : "health score";
  const score = typeof result.healthScore === "number" ? `${result.healthScore} out of 10` : "unavailable";
  const warnings = (result.healthWarnings || []).slice(0, 2).join(" ");
  const alternatives = (result.recipeIdeas || []).slice(0, 2).map((item) => item.title).join(", ");

  if (simpleMode) {
    return [
      `Analysis mode: ${modeLabel(result.analysisMode)}.`,
      `${scoreLabelText}: ${score}.`,
      warnings || "Warnings are limited by available evidence.",
      alternatives ? `Alternative ideas: ${alternatives}.` : "No reliable alternative ideas available."
    ].join(" ");
  }

  return [
    `Food analysis complete in ${modeLabel(result.analysisMode)} mode.`,
    `${scoreLabelText}: ${score}.`,
    warnings || "Warnings are limited by available evidence.",
    result.plainLanguageSummary || ""
  ].join(" ");
};

const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [simpleMode, setSimpleMode] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const data = location.state as ScanResponse | undefined;

  useEffect(() => {
    console.info("[result] route state payload", data);
  }, [data]);

  if (!data || data.status !== "success") {
    return (
      <main className="screen">
        <section className="hero-card">
          <h2 className="hero-title">No scan result found</h2>
          <p className="hero-subtitle">Run a new scan to view nutrition and health insights.</p>
          <button className="primary-action" onClick={() => navigate("/")}>
            Start New Scan
          </button>
        </section>
      </main>
    );
  }

  const confidence = asConfidence(data.confidence);
  const confidenceSummary = `${confidence.analysisConfidence}% - ${confidenceLabelText(data.confidenceLabel)}`;
  const spokenSummary = buildSpokenText(data, simpleMode);
  const nutrition = normalizeNutrition(data.nutrition);
  const insufficient = data.analysisMode === "insufficient_data";
  const productName = data.identifiedFood?.productName || null;
  const category = data.identifiedFood?.category || null;
  const heading =
    data.analysisMode === "exact_label"
      ? "Exact Label Analysis"
      : data.analysisMode === "partial_label"
      ? "Partial Label Analysis"
      : data.analysisMode === "research_assisted"
      ? "Research-Assisted Food Analysis"
      : data.analysisMode === "category_estimated"
      ? "Estimated Food Analysis"
      : "Insufficient Data for Reliable Analysis";

  const productTitle = productName || category || null;
  const modeSummary =
    data.analysisMode === "exact_label"
      ? "This result comes mostly from clearly visible label facts."
      : data.analysisMode === "partial_label"
      ? "This result uses the label facts that were visible, but some details were missing."
      : data.analysisMode === "research_assisted"
      ? "This result combines visible label facts with trusted product research to fill some gaps."
      : "This result is based on the likely food category when the full label was not available.";
  const scoreTone =
    data.scorePresentation === "not_reliable"
      ? "risk"
      : typeof data.healthScore === "number" && data.healthScore >= 8
      ? "good"
      : typeof data.healthScore === "number" && data.healthScore >= 5
      ? "moderate"
      : "risk";

  if (insufficient) {
    return (
      <main className="screen">
        <section className="dashboard-shell">
          <header className="result-header">
            <div>
              <div className="eyebrow">FoodFacts AI Report</div>
              <h1 className="hero-title">{heading}</h1>
              <p className="hero-subtitle">
                {data.plainLanguageSummary ||
                  "We could not get a reliable read from this image yet."}
              </p>
            </div>
            <div className="score-pill risk">
              <span className="score-label">Analysis Confidence</span>
              <span className="score-value">{confidenceSummary}</span>
            </div>
          </header>

          <div className="top-controls">
            <AccessibilityToggle simpleMode={simpleMode} onToggle={setSimpleMode} />
            <div className="mode-chip insufficient_data">Analysis Mode: {modeLabel(data.analysisMode)}</div>
            <VoiceControls summaryText={spokenSummary} />
          </div>

          <div className="results-grid">
            <article className="result-card wide">
              <h3 className="card-title"><span className="title-icon">?</span>Why This Scan Was Limited</h3>
              <ul className="danger-list">
                <li>The nutrition label was not clear enough to read reliably.</li>
                <li>The food or product could not be identified with enough confidence.</li>
                <li>
                  {data.research?.reasonDetail ||
                    "Online research could not find a trusted match from this image."}
                </li>
              </ul>
            </article>
            <article className="result-card">
              <h3 className="card-title"><span className="title-icon">N</span>Try This Next</h3>
              <p>
                {data.nextStepSuggestion ||
                  "Retake the photo in better lighting and include both the front package and the nutrition facts panel."}
              </p>
            </article>
          </div>

          <button className="primary-action" onClick={() => navigate("/")}>
            Retake Scan
          </button>
        </section>
      </main>
    );
  }

  const unknownText = data.analysisMode === "exact_label" || data.analysisMode === "partial_label"
    ? "Unknown from visible label"
    : "Unknown";
  const swapIdeas = Array.isArray(data.recipeIdeas) ? data.recipeIdeas : [];
  const hasEstimatedContent = Boolean(
    data.estimatedInsights?.sodiumLikelihood ||
      data.estimatedInsights?.sugarLikelihood ||
      data.estimatedInsights?.processingLevel ||
      data.estimatedInsights?.generalHealthNote
  );
  const hasAlternative = Boolean(
    data.healthierAlternative &&
      ((Array.isArray(data.healthierAlternative.options) &&
        data.healthierAlternative.options.length > 0) ||
        data.healthierAlternative.reason ||
        (Array.isArray(data.healthierAlternative.options) &&
          data.healthierAlternative.options.length > 0))
  );
  const scoreReasons = Array.isArray(data.scoreReasoning) ? data.scoreReasoning.slice(0, 4) : [];
  const hasTrustContent = Boolean(
    data.research?.attempted ||
      data.research?.used ||
      data.research?.reasonNotUsed ||
      data.research?.matchedProduct
  );
  const recipeHeading =
    swapIdeas.length > 0 && swapIdeas.every((recipe) => recipe.level === "category")
      ? "Healthier Alternatives for This Type of Food"
      : "Healthier Alternatives to Try";
  const alternativeHeading =
    data.healthierAlternative?.level === "category"
      ? "Category-Based Better Options"
      : "Healthier Alternatives";

  return (
    <main className="screen">
      <section className="dashboard-shell">
        <header className="result-header">
          <div>
            <div className="eyebrow">FoodFacts AI Report</div>
            <h1 className="hero-title">{heading}</h1>
            {productTitle && <p className="muted" style={{ marginTop: "4px" }}>{productTitle}</p>}
            <p className="result-mode-summary">{modeSummary}</p>
            <p className="hero-subtitle">
              {data.plainLanguageSummary ||
                "This report combines visible label facts, research, and category guidance where appropriate."}
            </p>
          </div>

          <div className={`score-pill ${scoreTone} ${data.scorePresentation || ""}`}>
            <span className="score-label">{scoreLabel(data.scorePresentation)}</span>
            <span className="score-value">
              {typeof data.healthScore === "number" ? `${data.healthScore}/10` : "Not reliable"}
            </span>
            <span className="score-label">{scoreStatusText(data.scorePresentation)}</span>
            <span className="score-label">{confidenceSummary}</span>
            <span className="score-label">Score confidence: {data.scoreConfidence || "moderate"}</span>
            {scoreReasons.length > 0 && (
              <ul className="score-reason-list">
                {scoreReasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <div className="top-controls">
          <AccessibilityToggle simpleMode={simpleMode} onToggle={setSimpleMode} />
          <div className={`mode-chip ${data.analysisMode || "category_estimated"}`}>
            Analysis Mode: {modeLabel(data.analysisMode)}
          </div>
          <VoiceControls summaryText={spokenSummary} />
        </div>

        <p className="estimate-note">
          {data.scorePresentation === "final"
            ? "This score is supported by stronger evidence."
            : data.scorePresentation === "preliminary"
            ? "This is a preliminary score based on partial evidence."
            : "A trustworthy score could not be shown because the evidence is still too limited."}
        </p>

        <div className="results-grid">
          <article className="result-card">
            <h3 className="card-title"><span className="title-icon">!</span>Warnings</h3>
            {Array.isArray(data.healthWarnings) && data.healthWarnings.length > 0 ? (
              <ul className="danger-list">
                {data.healthWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No strong warning could be confirmed from the evidence available.</p>
            )}
          </article>

          <article className="result-card">
            <h3 className="card-title"><span className="title-icon">N</span>Nutrition Facts</h3>
            <div className="fact-list">
              <div className="nutrient-row">
                <span>Calories</span>
                <span>
                  {getMetricText(
                    nutrition.calories,
                    "",
                    unknownText,
                    data.estimatedRanges?.calories || null
                  )}
                </span>
                <span className={`source-badge ${nutrition.calories.source}`}>
                  {sourceBadgeLabel(nutrition.calories.source)}
                </span>
              </div>
              <div className="nutrient-row">
                <span>Sodium</span>
                <span>
                  {getMetricText(
                    nutrition.sodium_mg,
                    " mg",
                    unknownText,
                    data.estimatedRanges?.sodium_mg || null,
                    data.estimatedInsights?.sodiumLikelihood || null
                  )}
                </span>
                <span className={`source-badge ${nutrition.sodium_mg.source}`}>
                  {sourceBadgeLabel(nutrition.sodium_mg.source)}
                </span>
              </div>
              <div className="nutrient-row">
                <span>Sugar</span>
                <span>
                  {getMetricText(
                    nutrition.sugar_g,
                    " g",
                    unknownText,
                    data.estimatedRanges?.sugar_g || null,
                    data.estimatedInsights?.sugarLikelihood || null
                  )}
                </span>
                <span className={`source-badge ${nutrition.sugar_g.source}`}>
                  {sourceBadgeLabel(nutrition.sugar_g.source)}
                </span>
              </div>
              <div className="nutrient-row">
                <span>Saturated Fat</span>
                <span>
                  {getMetricText(
                    nutrition.saturatedFat_g,
                    " g",
                    unknownText,
                    data.estimatedRanges?.saturatedFat_g || null
                  )}
                </span>
                <span className={`source-badge ${nutrition.saturatedFat_g.source}`}>
                  {sourceBadgeLabel(nutrition.saturatedFat_g.source)}
                </span>
              </div>
              <div className="nutrient-row">
                <span>Fiber</span>
                <span>
                  {getMetricText(
                    nutrition.fiber_g,
                    " g",
                    unknownText,
                    data.estimatedRanges?.fiber_g || null,
                    data.estimatedInsights?.fiberLikelihood || null
                  )}
                </span>
                <span className={`source-badge ${nutrition.fiber_g.source}`}>
                  {sourceBadgeLabel(nutrition.fiber_g.source)}
                </span>
              </div>
            </div>
          </article>

          {hasEstimatedContent && (
            <article className="result-card">
              <h3 className="card-title"><span className="title-icon">E</span>Estimated Insights</h3>
              <p><strong>Sodium likelihood:</strong> {data.estimatedInsights?.sodiumLikelihood}</p>
              <p><strong>Sugar likelihood:</strong> {data.estimatedInsights?.sugarLikelihood}</p>
              <p><strong>Processing level:</strong> {data.estimatedInsights?.processingLevel}</p>
              <p className="muted">{data.estimatedInsights?.generalHealthNote}</p>
            </article>
          )}

          {hasAlternative && (
            <article className="result-card">
              <h3 className="card-title"><span className="title-icon">A</span>{alternativeHeading}</h3>
              {data.healthierAlternative?.title && <p className="alt-type">{data.healthierAlternative.title}</p>}
              {data.healthierAlternative?.reason && <p>{data.healthierAlternative.reason}</p>}
              {Array.isArray(data.healthierAlternative?.options) &&
                data.healthierAlternative.options.length > 0 && (
                  <ul className="danger-list">
                    {data.healthierAlternative.options.map((option, index) => (
                      <li key={`${option.name}-${index}`}>
                        <strong>{option.name}:</strong> {option.reason}
                      </li>
                    ))}
                  </ul>
                )}
              {data.healthierAlternative?.shoppingTip && (
                <p className="muted">Shopping tip: {data.healthierAlternative.shoppingTip}</p>
              )}
            </article>
          )}

          {swapIdeas.length > 0 && (
            <article className="result-card wide">
              <h3 className="card-title"><span className="title-icon">S</span>{recipeHeading}</h3>
              <div className="recipe-stack">
                {swapIdeas.map((recipe, index) => (
                  <div className="recipe-item" key={`${recipe.title}-${index}`}>
                    <p className="recipe-title">{recipe.title}</p>
                    <p>{recipe.description}</p>
                    <p className="muted">Why healthier: {recipe.whyItIsHealthier}</p>
                  </div>
                ))}
              </div>
            </article>
          )}

          {hasTrustContent && (
            <article className="result-card compact">
              <h3 className="card-title"><span className="title-icon">T</span>Why This Result Looks This Way</h3>
              <p><strong>Evidence strength:</strong> {confidenceLabelText(data.confidenceLabel)}</p>
              <p><strong>Label confidence:</strong> {confidence.labelConfidence}%</p>
              <p><strong>Product confidence:</strong> {confidence.productConfidence}%</p>
              <p><strong>Category confidence:</strong> {confidence.categoryConfidence}%</p>
              <p><strong>Online research checked:</strong> {data.research?.attempted ? "Yes" : "No"}</p>
              <p><strong>Online research contributed:</strong> {data.research?.used ? "Yes" : "No"}</p>
              {data.research?.matchedProduct && <p><strong>Closest matched item:</strong> {data.research.matchedProduct}</p>}
              {data.research?.reasonDetail && <p className="muted">{data.research.reasonDetail}</p>}
            </article>
          )}
        </div>

        {data.scanPreview && (
          <div className="preview-inline-toggle">
            <button
              type="button"
              className="ghost-action compact"
              onClick={() => setShowImage((prev) => !prev)}
            >
              {showImage ? "Hide scanned image" : "View scanned image"}
            </button>
            {showImage && (
              <img src={data.scanPreview} alt="Scanned food package" className="scan-preview-image small" />
            )}
          </div>
        )}

        <button className="primary-action" onClick={() => navigate("/")}>
          Scan Another Product
        </button>
      </section>
    </main>
  );
};

export default ResultPage;
