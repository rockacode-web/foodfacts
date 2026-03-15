type InsightItem = {
  label: string;
  value: string;
};

type SuggestionItem = {
  title: string;
  description: string;
  reason?: string;
};

type AnalysisSnapshotProps = {
  title: string;
  subtitle: string;
  summary: string;
  analysisMode: string;
  healthScore: number | null;
  confidenceScore: number | null;
  warnings: string[];
  nutrition: InsightItem[];
  alternatives: SuggestionItem[];
  ideas: SuggestionItem[];
  actionLabel?: string;
  onAction?: () => void;
};

const AnalysisSnapshot = ({
  title,
  subtitle,
  summary,
  analysisMode,
  healthScore,
  confidenceScore,
  warnings,
  nutrition,
  alternatives,
  ideas,
  actionLabel,
  onAction
}: AnalysisSnapshotProps) => (
  <div className="analysis-snapshot">
    <div className="analysis-snapshot-head">
      <div>
        <p className="snapshot-kicker">{title}</p>
        <h3 className="panel-title">{subtitle}</h3>
      </div>
      <div className="snapshot-score">
        <span className="snapshot-score-label">Health score</span>
        <strong>{typeof healthScore === "number" ? `${healthScore}/10` : "N/A"}</strong>
        <span className="snapshot-score-meta">
          {confidenceScore != null ? `${Math.round(confidenceScore)}% confidence` : "Confidence unavailable"}
        </span>
      </div>
    </div>

    <p className="snapshot-summary">{summary}</p>
    <p className="muted">Mode: {analysisMode.replace(/_/g, " ")}</p>

    <div className="snapshot-grid">
      <div className="snapshot-card">
        <h4>Warnings</h4>
        {warnings.length > 0 ? (
          <ul className="danger-list">
            {warnings.slice(0, 4).map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No strong warnings were saved for this result.</p>
        )}
      </div>

      <div className="snapshot-card">
        <h4>Quick nutrition</h4>
        <div className="snapshot-facts">
          {nutrition.map((item) => (
            <div className="snapshot-fact" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="snapshot-grid">
      <div className="snapshot-card">
        <h4>Alternatives</h4>
        {alternatives.length > 0 ? (
          <div className="snapshot-list">
            {alternatives.slice(0, 3).map((item) => (
              <article key={`${item.title}-${item.description}`}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No saved alternatives for this item yet.</p>
        )}
      </div>

      <div className="snapshot-card">
        <h4>Healthy swap ideas</h4>
        {ideas.length > 0 ? (
          <div className="snapshot-list">
            {ideas.slice(0, 3).map((item) => (
              <article key={`${item.title}-${item.description}`}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                {item.reason && <p className="muted">{item.reason}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No saved ideas were returned for this scan.</p>
        )}
      </div>
    </div>

    {actionLabel && onAction && (
      <button type="button" className="ghost-action dashboard-inline-action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default AnalysisSnapshot;
