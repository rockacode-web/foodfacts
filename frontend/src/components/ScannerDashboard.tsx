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
  onAddLatestToIntake: () => void;
  onAddSavedToIntake: () => void;
  latestLoggedToday: boolean;
  savedLoggedToday: boolean;
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
  savedLoggedToday
}: ScannerDashboardProps) => {
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const compactTitle =
    latestResult?.identifiedFood?.productName ||
    latestResult?.identifiedFood?.category ||
    "No scan yet";
  const compactSummary = latestResult?.plainLanguageSummary || "Run a scan to generate a fresh summary.";
  const compactConfidence =
    typeof latestResult?.confidence === "number"
      ? Math.round(latestResult.confidence * 100)
      : latestResult?.confidence?.analysisConfidence || null;

  return (
    <div className="scanner-dashboard">
      <div className="scanner-primary-grid">
        <article className="dashboard-panel scanner-hero-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="dashboard-kicker">Scanner</p>
              <h2 className="panel-title">Capture and analyze</h2>
            </div>
          </div>

          <ScanCapturePanel
            layout="dashboard"
            heading="Scan a food label with less noise"
            subtitle="Keep the scanner front and center. Full analysis, warnings, and history stay collapsed until you choose to open them."
            buttonLabel="Analyze and Save"
            onUnauthorized={onUnauthorized}
            onAnalysisComplete={onAnalysisComplete}
          />
        </article>

        <article className="dashboard-panel scanner-summary-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="dashboard-kicker">Latest result</p>
              <h2 className="panel-title">Quick summary</h2>
            </div>
          </div>

          {latestResult ? (
            <div className="compact-analysis-card">
              <div className="compact-analysis-head">
                <div>
                  <h3>{compactTitle}</h3>
                  <p>{compactSummary}</p>
                </div>
              </div>

              <div className="compact-analysis-badges">
                <span className="history-pill">
                  Score {typeof latestResult.healthScore === "number" ? `${latestResult.healthScore}/10` : "N/A"}
                </span>
                <span className="history-pill">
                  {compactConfidence != null ? `${compactConfidence}% confidence` : "Confidence unavailable"}
                </span>
                <span className="history-pill">
                  {(latestResult.analysisMode || "partial_label").replace(/_/g, " ")}
                </span>
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
                <AddToIntakeButton onAdd={onAddLatestToIntake} addedToday={latestLoggedToday} />
              </div>
            </div>
          ) : (
            <div className="compact-empty-card">
              <p className="muted">
                Your newest scan will appear here as a compact summary. Detailed warnings, nutrition, and swaps stay tucked away until you open them.
              </p>
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
          />
        </CollapsibleAnalysisSection>

        <CollapsibleAnalysisSection
          title="Saved scan history"
          subtitle="Keep history collapsed by default. Open it when you want to revisit or delete saved records."
          isOpen={isHistoryOpen}
          onToggle={() => setIsHistoryOpen((current) => !current)}
        >
          <HistoryList
            items={history}
            loading={historyLoading}
            selectedId={selectedId}
            error={historyError}
            onSelect={(scanId) => {
              setIsAnalysisOpen(true);
              onSelectHistory(scanId);
            }}
            onDelete={onDeleteHistory}
            deletingId={deletingId}
          />
        </CollapsibleAnalysisSection>
      </div>
    </div>
  );
};

export default ScannerDashboard;
