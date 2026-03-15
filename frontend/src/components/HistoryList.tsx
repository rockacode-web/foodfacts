import type { ScanHistoryItem } from "../types";

type HistoryListProps = {
  items: ScanHistoryItem[];
  loading: boolean;
  selectedId: number | null;
  error: string;
  onSelect: (scanId: number) => void;
  onDelete: (scanId: number) => void;
  deletingId: number | null;
};

const getHistoryTitle = (item: ScanHistoryItem) => {
  if (item.summary) {
    const [firstSentence] = item.summary.split(/[.!?]/);
    if (firstSentence?.trim()) {
      return firstSentence.trim();
    }
  }

  return "Saved FoodFacts analysis";
};

const getHistorySummary = (item: ScanHistoryItem) => {
  if (!item.summary) {
    return "Open this stored scan to inspect the full analysis detail.";
  }

  const trimmed = item.summary.trim();
  const title = getHistoryTitle(item);
  const remainder = trimmed.startsWith(title) ? trimmed.slice(title.length).trim() : trimmed;

  return remainder.replace(/^[.!?\s-]+/, "") || trimmed;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

const HistoryList = ({
  items,
  loading,
  selectedId,
  error,
  onSelect,
  onDelete,
  deletingId
}: HistoryListProps) => {
  if (loading) {
    return <p className="muted">Loading scan history...</p>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  if (items.length === 0) {
    return <p className="muted">No saved scans yet. Run your first authenticated scan to populate history.</p>;
  }

  return (
    <div className="history-list">
      {items.map((item) => (
        <article
          className={`history-item ${selectedId === item.id ? "selected" : ""}`}
          key={item.id}
        >
          <button className="history-select" type="button" onClick={() => onSelect(item.id)} aria-pressed={selectedId === item.id}>
            <div className="history-item-head">
              <div>
                <h3 className="history-title">{getHistoryTitle(item)}</h3>
                <p className="history-time">{formatDate(item.createdAt)}</p>
              </div>

              <div className="history-meta-pills">
                <span className="history-pill">{String(item.analysisMode).replace(/_/g, " ")}</span>
                <span className="history-pill">
                  Score {typeof item.healthScore === "number" ? `${item.healthScore}/10` : "N/A"}
                </span>
                <span className="history-pill">
                  {item.confidenceScore != null ? `${Math.round(item.confidenceScore)}% confidence` : "Confidence N/A"}
                </span>
              </div>
            </div>

            <p className="history-summary">{getHistorySummary(item)}</p>
          </button>

          <button
            className="history-delete"
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id ? "Deleting..." : "Delete"}
          </button>
        </article>
      ))}
    </div>
  );
};

export default HistoryList;
