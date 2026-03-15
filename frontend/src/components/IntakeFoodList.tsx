import type { IntakeEntry } from "../types";

type IntakeFoodListProps = {
  items: IntakeEntry[];
  onRemove: (entryId: number) => void;
  removingId?: number | null;
};

const formatLoggedTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });

const IntakeFoodList = ({ items, onRemove, removingId = null }: IntakeFoodListProps) => {
  if (items.length === 0) {
    return (
      <p className="muted">
        No foods logged today yet. Use the scanner dashboard and choose <strong>Add to daily intake</strong>
        after a scan.
      </p>
    );
  }

  return (
    <div className="intake-food-list">
      {items.map((item) => (
        <article className="intake-food-item" key={item.id}>
          <div className="intake-food-copy">
            <div className="intake-food-head">
              <h3>{item.sourceFoodName || `Logged scan #${item.scanId}`}</h3>
              <span className="history-pill">{item.servings} serving{item.servings === 1 ? "" : "s"}</span>
            </div>
            <p className="intake-food-meta">Logged {formatLoggedTime(item.consumedAt)}</p>
            <p className="intake-food-summary">{item.sourceSummary || "Daily intake entry from a saved scan."}</p>
            <div className="intake-food-stats">
              <span>{typeof item.calories === "number" ? item.calories : "?"} cal</span>
              <span>{typeof item.sodiumMg === "number" ? item.sodiumMg : "?"} mg sodium</span>
              <span>{typeof item.sugarG === "number" ? item.sugarG : "?"} g sugar</span>
              <span>{typeof item.proteinG === "number" ? item.proteinG : "?"} g protein</span>
            </div>
          </div>

          <button
            type="button"
            className="history-delete"
            onClick={() => onRemove(item.id)}
            disabled={removingId === item.id}
          >
            {removingId === item.id ? "Removing..." : "Remove"}
          </button>
        </article>
      ))}
    </div>
  );
};

export default IntakeFoodList;
