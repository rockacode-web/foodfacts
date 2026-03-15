import NutrientSummaryCards from "./NutrientSummaryCards";
import IntakeFoodList from "./IntakeFoodList";
import type { IntakeLogEntry } from "../types";

type IntakeDashboardProps = {
  entries: IntakeLogEntry[];
  onRemoveEntry: (entryId: string) => void;
};

const formatMetric = (value: number, suffix: string) =>
  `${Math.round(value * 10) / 10}${suffix}`;

const IntakeDashboard = ({ entries, onRemoveEntry }: IntakeDashboardProps) => {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.calories += (entry.nutrients.calories || 0) * entry.servings;
      acc.sodiumMg += (entry.nutrients.sodiumMg || 0) * entry.servings;
      acc.sugarG += (entry.nutrients.sugarG || 0) * entry.servings;
      acc.proteinG += (entry.nutrients.proteinG || 0) * entry.servings;
      return acc;
    },
    { calories: 0, sodiumMg: 0, sugarG: 0, proteinG: 0 }
  );

  const warnings = [
    totals.sodiumMg > 2300 ? "Sodium is above the common 2,300 mg daily limit." : null,
    totals.sugarG > 50 ? "Added/free sugar exposure appears high for the day." : null,
    entries.length > 0 && totals.proteinG < 40 ? "Protein is still low relative to a typical full day." : null
  ].filter(Boolean) as string[];

  const topSodiumContributors = [...entries]
    .sort(
      (a, b) =>
        ((b.nutrients.sodiumMg || 0) * b.servings) - ((a.nutrients.sodiumMg || 0) * a.servings)
    )
    .slice(0, 3);

  return (
    <div className="intake-dashboard">
      <section className="dashboard-panel intake-hero-panel">
        <div className="dashboard-panel-head">
          <div>
            <p className="dashboard-kicker">Daily intake</p>
            <h2 className="panel-title">Today’s nutrient picture</h2>
          </div>
        </div>

        <p className="intake-hero-copy">
          This dashboard summarizes foods you explicitly logged as consumed. Until a dedicated intake API is connected, these entries are stored locally in your browser for UI flow testing.
        </p>

        <NutrientSummaryCards
          metrics={[
            {
              label: "Calories today",
              value: formatMetric(totals.calories, ""),
              note: entries.length > 0 ? "Estimated from logged scans." : "No foods logged yet."
            },
            {
              label: "Sodium today",
              value: formatMetric(totals.sodiumMg, " mg"),
              note: totals.sodiumMg > 2300 ? "Above common limit." : "Within tracked range so far."
            },
            {
              label: "Sugar today",
              value: formatMetric(totals.sugarG, " g"),
              note: totals.sugarG > 50 ? "High for one day." : "Tracked from logged items."
            },
            {
              label: "Protein today",
              value: formatMetric(totals.proteinG, " g"),
              note: entries.length > 0 ? "Accumulated from logged items." : "Will update after logging foods."
            }
          ]}
        />
      </section>

      <div className="intake-grid">
        <section className="dashboard-panel intake-insights-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="dashboard-kicker">Insights</p>
              <h2 className="panel-title">Daily warnings and signals</h2>
            </div>
          </div>

          {warnings.length > 0 ? (
            <div className="warning-chip-row">
              {warnings.map((warning) => (
                <span className="warning-chip" key={warning}>
                  {warning}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">
              No major warning thresholds have been crossed yet. Keep logging foods to make this view more useful.
            </p>
          )}
        </section>

        <section className="dashboard-panel intake-contributors-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="dashboard-kicker">Top contributors</p>
              <h2 className="panel-title">Sodium drivers</h2>
            </div>
          </div>

          {topSodiumContributors.length > 0 ? (
            <div className="swap-ideas-list">
              {topSodiumContributors.map((entry) => (
                <article className="swap-idea-card" key={entry.id}>
                  <strong>{entry.title}</strong>
                  <p>
                    {Math.round(((entry.nutrients.sodiumMg || 0) * entry.servings) * 10) / 10} mg sodium
                    from {entry.servings} serving{entry.servings === 1 ? "" : "s"}.
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Sodium contributors will appear once foods are logged into daily intake.</p>
          )}
        </section>
      </div>

      <section className="dashboard-panel intake-foods-panel">
        <div className="dashboard-panel-head">
          <div>
            <p className="dashboard-kicker">Logged foods</p>
            <h2 className="panel-title">Foods logged today</h2>
          </div>
        </div>

        <IntakeFoodList items={entries} onRemove={onRemoveEntry} />
      </section>
    </div>
  );
};

export default IntakeDashboard;
