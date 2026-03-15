import NutritionStats from "./NutritionStats";
import SwapIdeasList from "./SwapIdeasList";
import WarningChips from "./WarningChips";
import AddToIntakeButton from "./AddToIntakeButton";
import type { ScanResponse, StoredScanDetail } from "../types";

type DetailView = "latest" | "saved";

type DetailBadge = {
  label: string;
  value: string;
  tone?: "default" | "score";
};

type DetailPanelData = {
  title: string;
  summary: string;
  badges: DetailBadge[];
  warnings: string[];
  nutrition: Array<{ label: string; value: string }>;
  alternatives: Array<{ title: string; description: string }>;
  ideas: Array<{ title: string; description: string; reason?: string }>;
  actionLabel: string;
  actionEmptyLabel?: string;
  onAction?: () => void;
};

type AnalysisDetailPanelProps = {
  activeView: DetailView;
  onChangeView: (view: DetailView) => void;
  latestResult: (ScanResponse & { scanPreview: string }) | null;
  selectedDetail: StoredScanDetail | null;
  detailLoading: boolean;
  detailError: string;
  onOpenLatestReport: () => void;
  onOpenSavedReport: () => void;
  onAddLatestToIntake: (servings: number) => void | Promise<void>;
  onAddSavedToIntake: (servings: number) => void | Promise<void>;
  latestLoggedToday: boolean;
  savedLoggedToday: boolean;
  latestIntakeError: string;
  savedIntakeError: string;
  latestIntakeSuccess: string;
  savedIntakeSuccess: string;
  latestIntakeSaving: boolean;
  savedIntakeSaving: boolean;
};

const formatStoredValue = (value: number | null | undefined, suffix: string) =>
  typeof value === "number" ? `${value}${suffix}` : "Unknown";

const formatMode = (value: string | undefined) => (value ? value.replace(/_/g, " ") : "unknown");

const extractSavedIdentity = (scan: StoredScanDetail | null) => {
  const raw = scan?.rawAiResponse;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const identifiedFood =
    "identifiedFood" in raw && raw.identifiedFood && typeof raw.identifiedFood === "object"
      ? (raw.identifiedFood as { productName?: string | null; category?: string | null })
      : null;

  return identifiedFood;
};

const buildLatestPanelData = (
  latestResult: (ScanResponse & { scanPreview: string }) | null,
  onOpenLatestReport: () => void
): DetailPanelData | null => {
  if (!latestResult) {
    return null;
  }

  const confidenceScore =
    typeof latestResult.confidence === "number"
      ? latestResult.confidence * 100
      : latestResult.confidence?.analysisConfidence || null;

  const alternatives = Array.isArray(latestResult.healthierAlternative?.options)
    ? latestResult.healthierAlternative.options.map((option) => ({
        title: option.name,
        description: option.reason
      }))
    : latestResult.healthierAlternative?.reason
    ? [
        {
          title: latestResult.healthierAlternative.type || "Healthier alternative",
          description: latestResult.healthierAlternative.reason
        }
      ]
    : [];

  return {
    title:
      latestResult.identifiedFood?.productName ||
      latestResult.identifiedFood?.category ||
      "Latest session analysis",
    summary: latestResult.plainLanguageSummary || "Scan completed successfully.",
    badges: [
      {
        label: "Health score",
        value: typeof latestResult.healthScore === "number" ? `${latestResult.healthScore}/10` : "N/A",
        tone: "score"
      },
      {
        label: "Confidence",
        value: confidenceScore != null ? `${Math.round(confidenceScore)}%` : "Unavailable"
      },
      {
        label: "Mode",
        value: formatMode(latestResult.analysisMode)
      }
    ],
    warnings: latestResult.healthWarnings || [],
    nutrition: [
      { label: "Calories", value: formatStoredValue(latestResult.nutrition?.calories?.value, "") },
      { label: "Sodium", value: formatStoredValue(latestResult.nutrition?.sodium_mg?.value, " mg") },
      { label: "Sugar", value: formatStoredValue(latestResult.nutrition?.sugar_g?.value, " g") },
      { label: "Protein", value: formatStoredValue(latestResult.nutrition?.protein_g?.value, " g") }
    ],
    alternatives,
    ideas:
      latestResult.recipeIdeas?.map((idea) => ({
        title: idea.title,
        description: idea.description,
        reason: idea.whyItIsHealthier
      })) || [],
    actionLabel: "Open full report",
    onAction: onOpenLatestReport
  };
};

const buildSavedPanelData = (
  selectedDetail: StoredScanDetail | null,
  onOpenSavedReport: () => void
): DetailPanelData | null => {
  if (!selectedDetail) {
    return null;
  }

  const identity = extractSavedIdentity(selectedDetail);

  return {
    title:
      identity?.productName ||
      identity?.category ||
      selectedDetail.summary ||
      `Saved scan #${selectedDetail.id}`,
    summary: selectedDetail.summary || "Saved scan detail.",
    badges: [
      {
        label: "Health score",
        value: typeof selectedDetail.healthScore === "number" ? `${selectedDetail.healthScore}/10` : "N/A",
        tone: "score"
      },
      {
        label: "Confidence",
        value:
          selectedDetail.confidenceScore != null ? `${Math.round(selectedDetail.confidenceScore)}%` : "Unavailable"
      },
      {
        label: "Mode",
        value: formatMode(selectedDetail.analysisMode)
      }
    ],
    warnings: (selectedDetail.warnings || []).map((warning) => warning.warningText),
    nutrition: [
      { label: "Calories", value: formatStoredValue(selectedDetail.nutritionFacts?.calories, "") },
      { label: "Sodium", value: formatStoredValue(selectedDetail.nutritionFacts?.sodiumMg, " mg") },
      { label: "Sugar", value: formatStoredValue(selectedDetail.nutritionFacts?.sugarG, " g") },
      { label: "Protein", value: formatStoredValue(selectedDetail.nutritionFacts?.proteinG, " g") }
    ],
    alternatives: (selectedDetail.alternatives || []).map((item) => ({
      title: item.title,
      description: item.description
    })),
    ideas: (selectedDetail.recipeIdeas || []).map((item) => ({
      title: item.title,
      description: item.description,
      reason: item.reason
    })),
    actionLabel: "Open as full report",
    onAction: onOpenSavedReport
  };
};

const EmptyDetailState = ({
  title,
  text
}: {
  title: string;
  text: string;
}) => (
  <div className="detail-empty-state">
    <div className="detail-empty-orb" />
    <h3>{title}</h3>
    <p>{text}</p>
  </div>
);

const AnalysisDetailPanel = ({
  activeView,
  onChangeView,
  latestResult,
  selectedDetail,
  detailLoading,
  detailError,
  onOpenLatestReport,
  onOpenSavedReport,
  onAddLatestToIntake,
  onAddSavedToIntake,
  latestLoggedToday,
  savedLoggedToday,
  latestIntakeError,
  savedIntakeError,
  latestIntakeSuccess,
  savedIntakeSuccess,
  latestIntakeSaving,
  savedIntakeSaving
}: AnalysisDetailPanelProps) => {
  const latestData = buildLatestPanelData(latestResult, onOpenLatestReport);
  const savedData = buildSavedPanelData(selectedDetail, onOpenSavedReport);
  const hasLatest = Boolean(latestData);
  const hasSaved = Boolean(savedData);
  const panelData = activeView === "latest" ? latestData : savedData;

  return (
    <div className="detail-viewer">
      <div className="dashboard-panel-head detail-viewer-head">
        <div>
          <p className="dashboard-kicker">Detail viewer</p>
          <h2 className="panel-title">Analysis reader</h2>
        </div>

        {(hasLatest || hasSaved) && (
          <div className="detail-tabs" role="tablist" aria-label="Analysis views">
            <button
              type="button"
              className={`detail-tab ${activeView === "latest" ? "active" : ""}`}
              onClick={() => onChangeView("latest")}
              disabled={!hasLatest}
            >
              Latest result
            </button>
            <button
              type="button"
              className={`detail-tab ${activeView === "saved" ? "active" : ""}`}
              onClick={() => onChangeView("saved")}
              disabled={!hasSaved}
            >
              Saved record
            </button>
          </div>
        )}
      </div>

      {activeView === "saved" && detailLoading ? (
        <p className="muted">Loading stored scan detail...</p>
      ) : detailError && activeView === "saved" ? (
        <div className="error-banner">{detailError}</div>
      ) : !panelData ? (
        activeView === "latest" ? (
          <EmptyDetailState
            title="No current analysis yet"
            text="Run a new scan to populate the latest-result view. The detail viewer will organize the summary, warnings, nutrition metrics, and swap ideas here."
          />
        ) : (
          <EmptyDetailState
            title="No saved record selected"
            text="Choose a scan from the history panel to inspect its saved detail, nutrition metrics, and alternatives."
          />
        )
      ) : (
        <div className="detail-content">
          <div className="detail-hero">
            <div>
              <p className="detail-eyebrow">
                {activeView === "latest" ? "Current session result" : "Stored scan detail"}
              </p>
              <h3 className="detail-title">{panelData.title}</h3>
            </div>

            {panelData.onAction && (
              <div className="detail-hero-actions">
                <button type="button" className="ghost-action compact" onClick={panelData.onAction}>
                  {panelData.actionLabel}
                </button>
                <AddToIntakeButton
                  onAdd={activeView === "latest" ? onAddLatestToIntake : onAddSavedToIntake}
                  addedToday={activeView === "latest" ? latestLoggedToday : savedLoggedToday}
                  isSaving={activeView === "latest" ? latestIntakeSaving : savedIntakeSaving}
                  error={activeView === "latest" ? latestIntakeError : savedIntakeError}
                  successMessage={activeView === "latest" ? latestIntakeSuccess : savedIntakeSuccess}
                />
              </div>
            )}
          </div>

          <div className="detail-badge-row">
            {panelData.badges.map((badge) => (
              <div className={`detail-badge ${badge.tone === "score" ? "score" : ""}`} key={badge.label}>
                <span>{badge.label}</span>
                <strong>{badge.value}</strong>
              </div>
            ))}
          </div>

          <section className="detail-section detail-summary-card">
            <p className="detail-section-label">Summary</p>
            <p className="detail-summary-text">{panelData.summary}</p>
          </section>

          <section className="detail-section">
            <p className="detail-section-label">Warnings</p>
            <WarningChips warnings={panelData.warnings} />
          </section>

          <section className="detail-section">
            <div className="detail-section-head">
              <p className="detail-section-label">Quick nutrition</p>
              <span className="muted">Four key metrics from the saved analysis</span>
            </div>
            <NutritionStats items={panelData.nutrition} />
          </section>

          <div className="detail-card-grid">
            <section className="detail-section detail-card">
              <p className="detail-section-label">Alternatives</p>
              <SwapIdeasList
                items={panelData.alternatives}
                emptyText="No saved alternatives were returned for this result."
              />
            </section>

            <section className="detail-section detail-card">
              <p className="detail-section-label">Healthy swap ideas</p>
              <SwapIdeasList
                items={panelData.ideas}
                emptyText="No saved healthy swap ideas were returned for this result."
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisDetailPanel;
