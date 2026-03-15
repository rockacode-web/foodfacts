import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSwitcher from "../components/DashboardSwitcher";
import ScannerDashboard from "../components/ScannerDashboard";
import IntakeDashboard from "../components/IntakeDashboard";
import { useAuth } from "../auth/AuthProvider";
import {
  ApiError,
  createIntakeEntry,
  deleteIntakeEntry,
  deleteStoredScan,
  fetchScanDetail,
  fetchScanHistory,
  fetchTodayIntake,
  mapStoredScanToResponse
} from "../services/api";
import type { DailyIntakeResponse, ScanHistoryItem, ScanResponse, StoredScanDetail } from "../types";

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
  const [intakeData, setIntakeData] = useState<DailyIntakeResponse | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(true);
  const [intakeError, setIntakeError] = useState("");
  const [intakeRemovingId, setIntakeRemovingId] = useState<number | null>(null);
  const [latestIntakeError, setLatestIntakeError] = useState("");
  const [savedIntakeError, setSavedIntakeError] = useState("");
  const [latestIntakeSuccess, setLatestIntakeSuccess] = useState("");
  const [savedIntakeSuccess, setSavedIntakeSuccess] = useState("");
  const [savingIntakeTarget, setSavingIntakeTarget] = useState<"latest" | "saved" | null>(null);

  const handleUnauthorized = () => {
    logout();
  };

  const clearLatestIntakeFeedback = () => {
    setLatestIntakeError("");
    setLatestIntakeSuccess("");
  };

  const clearSavedIntakeFeedback = () => {
    setSavedIntakeError("");
    setSavedIntakeSuccess("");
  };

  const loadTodayIntake = async () => {
    setIntakeLoading(true);
    setIntakeError("");

    try {
      const intake = await fetchTodayIntake();
      setIntakeData(intake);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setIntakeError(error instanceof Error ? error.message : "Could not load today's intake.");
    } finally {
      setIntakeLoading(false);
    }
  };

  const isScanLoggedToday = (scanId: number | null | undefined) =>
    scanId != null ? (intakeData?.entries || []).some((entry) => entry.scanId === scanId) : false;

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
    void loadTodayIntake();
  }, []);

  const addLatestToIntake = async (servings: number) => {
    clearLatestIntakeFeedback();
    if (!latestResult?.scanId) {
      setLatestIntakeError("This scan is not ready to log yet.");
      return;
    }

    setSavingIntakeTarget("latest");
    try {
      await createIntakeEntry({
        scanId: latestResult.scanId,
        servings
      });
      setLatestIntakeSuccess("Added to today's intake.");
      await loadTodayIntake();
      setActiveDashboard("intake");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLatestIntakeError(error instanceof Error ? error.message : "Could not add this scan to daily intake.");
    } finally {
      setSavingIntakeTarget(null);
    }
  };

  const addSavedToIntake = async (servings: number) => {
    clearSavedIntakeFeedback();
    if (!selectedDetail?.id) {
      setSavedIntakeError("Select a saved scan before logging intake.");
      return;
    }

    setSavingIntakeTarget("saved");
    try {
      await createIntakeEntry({
        scanId: selectedDetail.id,
        servings
      });
      setSavedIntakeSuccess("Saved scan added to today's intake.");
      await loadTodayIntake();
      setActiveDashboard("intake");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setSavedIntakeError(error instanceof Error ? error.message : "Could not add this saved scan to daily intake.");
    } finally {
      setSavingIntakeTarget(null);
    }
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
        selectedId === scanId ? history.find((item) => item.id !== scanId)?.id ?? null : selectedId;
      await loadHistory(nextFocusId);
      await loadTodayIntake();
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

  const handleRemoveIntakeEntry = async (entryId: number) => {
    setIntakeRemovingId(entryId);
    setIntakeError("");

    try {
      await deleteIntakeEntry(entryId);
      await loadTodayIntake();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setIntakeError(error instanceof Error ? error.message : "Could not remove intake entry.");
    } finally {
      setIntakeRemovingId(null);
    }
  };

  return (
    <main className="screen dashboard-screen">
      <section className="dashboard-shell dashboard-app-shell">
        <DashboardHeader user={user} onOpenClassicScanner={() => navigate("/scan")} onLogout={logout} />

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
              clearLatestIntakeFeedback();
              setActiveDetailView("latest");
              void loadHistory(result.scanId ?? null);
            }}
            onSelectHistory={(scanId) => {
              clearSavedIntakeFeedback();
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
            latestIntakeError={latestIntakeError}
            savedIntakeError={savedIntakeError}
            latestIntakeSuccess={latestIntakeSuccess}
            savedIntakeSuccess={savedIntakeSuccess}
            latestIntakeSaving={savingIntakeTarget === "latest"}
            savedIntakeSaving={savingIntakeTarget === "saved"}
          />
        ) : (
          <IntakeDashboard
            intake={intakeData}
            loading={intakeLoading}
            error={intakeError}
            removingId={intakeRemovingId}
            onRemoveEntry={(entryId) => {
              void handleRemoveIntakeEntry(entryId);
            }}
          />
        )}
      </section>
    </main>
  );
};

export default DashboardPage;
