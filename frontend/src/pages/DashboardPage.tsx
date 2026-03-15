import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSwitcher from "../components/DashboardSwitcher";
import ScannerDashboard from "../components/ScannerDashboard";
import IntakeDashboard from "../components/IntakeDashboard";
import { useAuth } from "../auth/AuthProvider";
import {
  addEntryToDailyIntake,
  getTodayIntakeEntries,
  isScanLoggedToday,
  removeIntakeEntry
} from "../intake/storage";
import {
  ApiError,
  deleteStoredScan,
  fetchScanDetail,
  fetchScanHistory,
  mapStoredScanToResponse
} from "../services/api";
import type { ScanHistoryItem, ScanResponse, StoredScanDetail } from "../types";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [latestResult, setLatestResult] = useState<(ScanResponse & { scanPreview: string }) | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<StoredScanDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeDashboard, setActiveDashboard] = useState<"scanner" | "intake">("scanner");
  const [activeDetailView, setActiveDetailView] = useState<"latest" | "saved">("saved");
  const [intakeEntries, setIntakeEntries] = useState(getTodayIntakeEntries());

  const handleUnauthorized = () => {
    logout();
  };

  const refreshIntakeEntries = () => {
    setIntakeEntries(getTodayIntakeEntries());
  };

  const handleSelectHistory = async (scanId: number) => {
    setActiveDetailView("saved");
    setSelectedId(scanId);
    setDetailLoading(true);
    setDetailError("");

    try {
      const detail = await fetchScanDetail(scanId);
      setSelectedDetail(detail);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setDetailError(error instanceof Error ? error.message : "Could not load scan detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const loadHistory = async (focusId?: number | null) => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const summaryItems = await fetchScanHistory();
      setHistory(summaryItems);

      const targetId = focusId ?? selectedId ?? summaryItems[0]?.id ?? null;
      if (!targetId) {
        setSelectedId(null);
        setSelectedDetail(null);
        return;
      }

      await handleSelectHistory(targetId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setHistoryError(error instanceof Error ? error.message : "Could not load scan history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const addLatestToIntake = () => {
    if (!latestResult) {
      return;
    }

    addEntryToDailyIntake({
      source: "latest",
      sourceScanId: latestResult.scanId ?? null,
      title:
        latestResult.identifiedFood?.productName ||
        latestResult.identifiedFood?.category ||
        "Scanned food",
      summary: latestResult.plainLanguageSummary || "Scanned food logged from the latest result.",
      analysisMode: latestResult.analysisMode || null,
      healthScore: latestResult.healthScore ?? null,
      confidenceScore:
        typeof latestResult.confidence === "number"
          ? Math.round(latestResult.confidence * 100)
          : latestResult.confidence?.analysisConfidence || null,
      nutrients: {
        calories: latestResult.nutrition?.calories?.value ?? null,
        sodiumMg: latestResult.nutrition?.sodium_mg?.value ?? null,
        sugarG: latestResult.nutrition?.sugar_g?.value ?? null,
        proteinG: latestResult.nutrition?.protein_g?.value ?? null
      }
    });
    refreshIntakeEntries();
    setActiveDashboard("intake");
  };

  const addSavedToIntake = () => {
    if (!selectedDetail) {
      return;
    }

    const raw = selectedDetail.rawAiResponse;
    const identifiedFood =
      raw && typeof raw === "object" && "identifiedFood" in raw && raw.identifiedFood && typeof raw.identifiedFood === "object"
        ? (raw.identifiedFood as { productName?: string | null; category?: string | null })
        : null;

    addEntryToDailyIntake({
      source: "saved",
      sourceScanId: selectedDetail.id,
      title:
        identifiedFood?.productName ||
        identifiedFood?.category ||
        selectedDetail.summary ||
        `Saved scan #${selectedDetail.id}`,
      summary: selectedDetail.summary || "Stored scan logged into daily intake.",
      analysisMode: selectedDetail.analysisMode || null,
      healthScore: selectedDetail.healthScore ?? null,
      confidenceScore: selectedDetail.confidenceScore ?? null,
      nutrients: {
        calories: selectedDetail.nutritionFacts?.calories ?? null,
        sodiumMg: selectedDetail.nutritionFacts?.sodiumMg ?? null,
        sugarG: selectedDetail.nutritionFacts?.sugarG ?? null,
        proteinG: selectedDetail.nutritionFacts?.proteinG ?? null
      }
    });
    refreshIntakeEntries();
    setActiveDashboard("intake");
  };

  const handleDeleteHistory = async (scanId: number) => {
    setDeletingId(scanId);
    setDashboardError("");

    try {
      await deleteStoredScan(scanId);
      if (latestResult?.scanId === scanId) {
        setLatestResult(null);
      }
      const nextFocusId =
        selectedId === scanId
          ? history.find((item) => item.id !== scanId)?.id ?? null
          : selectedId;
      await loadHistory(nextFocusId);
      if (selectedId === scanId && !nextFocusId && latestResult) {
        setActiveDetailView("latest");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setDashboardError(error instanceof Error ? error.message : "Could not delete the selected scan.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="screen dashboard-screen">
      <section className="dashboard-shell dashboard-app-shell">
        <DashboardHeader
          user={user}
          onOpenClassicScanner={() => navigate("/scan")}
          onLogout={logout}
        />

        <DashboardSwitcher activeView={activeDashboard} onChangeView={setActiveDashboard} />

        {dashboardError && <div className="error-banner">{dashboardError}</div>}

        {activeDashboard === "scanner" ? (
          <ScannerDashboard
            latestResult={latestResult}
            selectedDetail={selectedDetail}
            activeDetailView={activeDetailView}
            onChangeDetailView={setActiveDetailView}
            history={history}
            historyLoading={historyLoading}
            historyError={historyError}
            selectedId={selectedId}
            deletingId={deletingId}
            detailLoading={detailLoading}
            detailError={detailError}
            onUnauthorized={handleUnauthorized}
            onAnalysisComplete={(result) => {
              setLatestResult(result);
              setActiveDetailView("latest");
              void loadHistory(result.scanId ?? null);
            }}
            onSelectHistory={(scanId) => {
              void handleSelectHistory(scanId);
            }}
            onDeleteHistory={(scanId) => {
              void handleDeleteHistory(scanId);
            }}
            onOpenLatestReport={() => {
              if (latestResult) {
                navigate("/result", { state: latestResult });
              }
            }}
            onOpenSavedReport={() => {
              if (selectedDetail) {
                navigate("/result", { state: mapStoredScanToResponse(selectedDetail) });
              }
            }}
            onAddLatestToIntake={addLatestToIntake}
            onAddSavedToIntake={addSavedToIntake}
            latestLoggedToday={isScanLoggedToday(latestResult?.scanId)}
            savedLoggedToday={isScanLoggedToday(selectedDetail?.id)}
          />
        ) : (
          <IntakeDashboard
            entries={intakeEntries}
            onRemoveEntry={(entryId) => {
              removeIntakeEntry(entryId);
              refreshIntakeEntries();
            }}
          />
        )}
      </section>
    </main>
  );
};

export default DashboardPage;
