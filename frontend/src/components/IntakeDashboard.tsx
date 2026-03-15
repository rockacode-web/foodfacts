import NutrientSummaryCards from "./NutrientSummaryCards";
import IntakeFoodList from "./IntakeFoodList";
import type { DailyIntakeResponse } from "../types";

type IntakeDashboardProps = {
  intake: DailyIntakeResponse | null;
  loading: boolean;
  error: string;
  removingId?: number | null;
  onRemoveEntry: (entryId: number) => void;
};

const formatMetric = (value: number, suffix: string) => `${Math.round(value * 10) / 10}${suffix}`;

const formatDateLabel = (value: string | undefined) => {
  if (!value) {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
};

const IntakeDashboard = ({
  intake,
  loading,
  error,
  removingId = null,
  onRemoveEntry
}: IntakeDashboardProps) => {
  const entries = intake?.entries || [];
  const totals = intake?.totals || {
    calories: 0,
    sodiumMg: 0,
    sugarG: 0,
    saturatedFatG: 0,
    fiberG: 0,
    proteinG: 0
  };
  const insights = intake?.insights || [];
  const todayLabel = formatDateLabel(intake?.date);
  const topSodiumContributors = [...entries]
    .sort((a, b) => (b.sodiumMg || 0) - (a.sodiumMg || 0))
    .slice(0, 3);

  return (
    <div className="intake-dashboard">
      <section className="dashboard-panel intake-hero-panel">
        <div className="dashboard-panel-head">
          <div>
            <p className="dashboard-kicker">Daily intake</p>
            <h2 className="panel-title">Today's nutrient picture</h2>
            <p className="muted">{todayLabel}</p>
          </div>
        </div>

        <p className="intake-hero-copy">
          This dashboard summarizes foods you explicitly logged as consumed. Nutrient totals come from
          the saved snapshot stored when each intake entry is created.
        </p>

        {error ? <div className="error-banner">{error}</div> : null}

        <NutrientSummaryCards
          metrics={[
            {
              label: "Calories today",
              value: formatMetric(totals.calories, ""),
              note: entries.length > 0 ? "Estimated from logged intake entries." : "No foods logged yet."
            },
            {
              label: "Sodium today",
              value: formatMetric(totals.sodiumMg, " mg"),
              note: totals.sodiumMg > 2300 ? "Above common limit." : "Within tracked range so far."
            },
            {
              label: "Sugar today",
              value: formatMetric(totals.sugarG, " g"),
              note: entries.length > 0 ? "Tracked from stored nutrient snapshots." : "Will update after logging foods."
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

          {loading ? (
            <p className="muted">Loading today's intake...</p>
          ) : insights.length > 0 ? (
            <div className="warning-chip-row">
              {insights.map((insight) => (
                <span className="warning-chip" key={insight}>
                  {insight}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">
              No major intake signals yet. Log foods from the scanner dashboard to build this view.
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

          {loading ? (
            <p className="muted">Loading contributor data...</p>
          ) : topSodiumContributors.length > 0 ? (
            <div className="swap-ideas-list">
              {topSodiumContributors.map((entry) => (
                <article className="swap-idea-card" key={entry.id}>
                  <strong>{entry.sourceFoodName || `Logged scan #${entry.scanId}`}</strong>
                  <p>
                    {Math.round((entry.sodiumMg || 0) * 10) / 10} mg sodium from {entry.servings} serving
                    {entry.servings === 1 ? "" : "s"}.
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

        {loading ? (
          <p className="muted">Loading intake entries...</p>
        ) : (
          <IntakeFoodList items={entries} onRemove={onRemoveEntry} removingId={removingId} />
        )}
      </section>
    </div>
  );
};

export default IntakeDashboard;
