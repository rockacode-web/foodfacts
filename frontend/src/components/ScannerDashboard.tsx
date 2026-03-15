import { useState } from "react";
import ScanCapturePanel from "./ScanCapturePanel";
import HistoryList from "./HistoryList";
import AnalysisDetailPanel from "./AnalysisDetailPanel";
import CollapsibleAnalysisSection from "./CollapsibleAnalysisSection";
import AddToIntakeButton from "./AddToIntakeButton";
import type { ScanHistoryItem, ScanResponse, StoredScanDetail } from "../types";

type ScannerDashboardProps = {
  latestResult: (ScanResponse & { scanPreview: string }) | null;
  selectedDetail: StoredScanDetail | null;
  activeDetailView: "latest" | "saved";
  onChangeDetailView: (view: "latest" | "saved") => void;
  history: ScanHistoryItem[];
  historyLoading: boolean;
  historyError: string;
  selectedId: number | null;
  deletingId: number | null;
  detailLoading: boolean;
  detailError: string;
  onUnauthorized: () => void;
  onAnalysisComplete: (result: ScanResponse & { scanPreview: string }) => void;
  onSelectHistory: (scanId: number) => void;
  onDeleteHistory: (scanId: number) => void;
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

const ScannerDashboard = ({
  latestResult,
  selectedDetail,
  activeDetailView,
  onChangeDetailView,
  history,
  historyLoading,
  historyError,
  selectedId,
  deletingId,
  detailLoading,
  detailError,
  onUnauthorized,
  onAnalysisComplete,
  onSelectHistory,
  onDeleteHistory,
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
}: ScannerDashboardProps) => {
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const compactTitle =
    latestResult?.identifiedFood?.productName || latestResult?.identifiedFood?.category || "No scan yet";
  const compactSummary = latestResult?.plainLanguageSummary || "Run a scan to generate a fresh summary.";
  const compactConfidence =
    typeof latestResult?.confidence === "number"
      ? Math.round(latestResult.confidence * 100)
      : latestResult?.confidence?.analysisConfidence || null;
  const compactScore = typeof latestResult?.healthScore === "number" ? `${latestResult.healthScore}/10` : "N/A";
  const compactMode = (latestResult?.analysisMode || "scanner_ready").replace(/_/g, " ");

  return (
    <div className="scanner-dashboard">
      <section className="scanner-overview-bar">
        <div>
          <p className="dashboard-kicker">Scanner workspace</p>
          <h2 className="scanner-overview-title">Fast capture, quiet interface, detail on demand</h2>
        </div>

        <div className="scanner-overview-pills">
          <span className="scanner-overview-pill">Scanner first</span>
          <span className="scanner-overview-pill">History collapsed</span>
          <span className="scanner-overview-pill">Analysis on demand</span>
        </div>
      </section>

      <div className="scanner-primary-grid">
        <article className="dashboard-panel scanner-hero-panel">
          <div className="scanner-capture-shell">
            <div className="scanner-control-header">
              <div>
                <p className="dashboard-kicker scanner-stage-kicker">Scanner</p>
                <h2 className="scanner-stage-title">Capture and analyze</h2>
                <p className="scanner-stage-text">
                  Upload or photograph a label, then open deeper analysis only when needed.
                </p>
              </div>

              <div className="scanner-control-pills">
                <span className="scanner-control-pill">Saved automatically</span>
                <span className="scanner-control-pill">History on demand</span>
              </div>
            </div>

            <ScanCapturePanel
              layout="dashboard"
              heading="Scan a food label"
              subtitle="Use upload or camera to capture a clear nutrition label."
              buttonLabel="Analyze and Save"
              onUnauthorized={onUnauthorized}
              onAnalysisComplete={onAnalysisComplete}
            />
          </div>
        </article>

        <article className="dashboard-panel scanner-summary-panel">
          <div className="dashboard-panel-head scanner-summary-head">
            <div>
              <p className="dashboard-kicker">Latest result</p>
              <h2 className="panel-title">Quick summary</h2>
            </div>
            <span className="scanner-summary-status">
              {latestResult ? "Ready to review" : "Waiting for a scan"}
            </span>
          </div>

          {latestResult ? (
            <div className="compact-analysis-card">
              <div className="compact-analysis-hero">
                <div>
                  <p className="compact-analysis-label">Current session</p>
                  <h3>{compactTitle}</h3>
                  <p>{compactSummary}</p>
                </div>
                <div className="compact-score-orb">
                  <span>Score</span>
                  <strong>{compactScore}</strong>
                </div>
              </div>

              <div className="compact-analysis-grid">
                <div className="compact-analysis-stat">
                  <span>Confidence</span>
                  <strong>{compactConfidence != null ? `${compactConfidence}%` : "Unavailable"}</strong>
                </div>
                <div className="compact-analysis-stat">
                  <span>Mode</span>
                  <strong>{compactMode}</strong>
                </div>
                <div className="compact-analysis-stat">
                  <span>Result state</span>
                  <strong>{latestLoggedToday ? "Logged today" : "Not logged"}</strong>
                </div>
              </div>

              <div className="compact-analysis-actions">
                <button
                  type="button"
                  className="primary-action compact-primary"
                  onClick={() => setIsAnalysisOpen((current) => !current)}
                >
                  {isAnalysisOpen ? "Hide full analysis" : "View full analysis"}
                </button>
                <button type="button" className="ghost-action compact" onClick={onOpenLatestReport}>
                  Open full report
                </button>
                <AddToIntakeButton
                  onAdd={onAddLatestToIntake}
                  addedToday={latestLoggedToday}
                  isSaving={latestIntakeSaving}
                  error={latestIntakeError}
                  successMessage={latestIntakeSuccess}
                />
              </div>
            </div>
          ) : (
            <div className="compact-empty-card">
              <div className="compact-empty-orb" />
              <p className="muted">Your latest scan summary will appear here.</p>
            </div>
          )}
        </article>
      </div>

      <div className="scanner-secondary-stack">
        <CollapsibleAnalysisSection
          title="Full analysis"
          subtitle="Reveal warnings, quick nutrition, saved-record detail, alternatives, and healthier swap ideas only when you need them."
          isOpen={isAnalysisOpen}
          onToggle={() => setIsAnalysisOpen((current) => !current)}
        >
          <AnalysisDetailPanel
            activeView={activeDetailView}
            onChangeView={onChangeDetailView}
            latestResult={latestResult}
            selectedDetail={selectedDetail}
            detailLoading={detailLoading}
            detailError={detailError}
            onOpenLatestReport={onOpenLatestReport}
            onOpenSavedReport={onOpenSavedReport}
            onAddLatestToIntake={onAddLatestToIntake}
            onAddSavedToIntake={onAddSavedToIntake}
            latestLoggedToday={latestLoggedToday}
            savedLoggedToday={savedLoggedToday}
            latestIntakeError={latestIntakeError}
            savedIntakeError={savedIntakeError}
            latestIntakeSuccess={latestIntakeSuccess}
            savedIntakeSuccess={savedIntakeSuccess}
            latestIntakeSaving={latestIntakeSaving}
            savedIntakeSaving={savedIntakeSaving}
          />
        </CollapsibleAnalysisSection>

        <CollapsibleAnalysisSection
          title="Saved scan history"
          subtitle="Open history only when you want to revisit or compare stored analyses."
          isOpen={isHistoryOpen}
          onToggle={() => setIsHistoryOpen((current) => !current)}
        >
          <HistoryList
            items={history}
            loading={historyLoading}
            error={historyError}
            selectedId={selectedId}
            deletingId={deletingId}
            onSelect={onSelectHistory}
            onDelete={onDeleteHistory}
          />
        </CollapsibleAnalysisSection>
      </div>
    </div>
  );
};

export default ScannerDashboard;
