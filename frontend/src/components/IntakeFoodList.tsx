import type { IntakeLogEntry } from "../types";

type IntakeFoodListProps = {
  items: IntakeLogEntry[];
  onRemove: (entryId: string) => void;
};

const formatLoggedTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });

const IntakeFoodList = ({ items, onRemove }: IntakeFoodListProps) => {
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
              <h3>{item.title}</h3>
              <span className="history-pill">{item.servings} serving{item.servings === 1 ? "" : "s"}</span>
            </div>
            <p className="intake-food-meta">
              Logged {formatLoggedTime(item.loggedAt)} {item.analysisMode ? `• ${item.analysisMode.replace(/_/g, " ")}` : ""}
            </p>
            <p className="intake-food-summary">{item.summary}</p>
            <div className="intake-food-stats">
              <span>{typeof item.nutrients.calories === "number" ? item.nutrients.calories * item.servings : "?"} cal</span>
              <span>{typeof item.nutrients.sodiumMg === "number" ? item.nutrients.sodiumMg * item.servings : "?"} mg sodium</span>
              <span>{typeof item.nutrients.sugarG === "number" ? item.nutrients.sugarG * item.servings : "?"} g sugar</span>
              <span>{typeof item.nutrients.proteinG === "number" ? item.nutrients.proteinG * item.servings : "?"} g protein</span>
            </div>
          </div>

          <button type="button" className="history-delete" onClick={() => onRemove(item.id)}>
            Remove
          </button>
        </article>
      ))}
    </div>
  );
};

export default IntakeFoodList;
