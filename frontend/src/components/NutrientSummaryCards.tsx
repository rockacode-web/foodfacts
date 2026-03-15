type SummaryMetric = {
  label: string;
  value: string;
  note: string;
};

type NutrientSummaryCardsProps = {
  metrics: SummaryMetric[];
};

const NutrientSummaryCards = ({ metrics }: NutrientSummaryCardsProps) => (
  <div className="intake-summary-grid">
    {metrics.map((metric) => (
      <article className="intake-summary-card" key={metric.label}>
        <span className="intake-summary-label">{metric.label}</span>
        <strong className="intake-summary-value">{metric.value}</strong>
        <p className="intake-summary-note">{metric.note}</p>
      </article>
    ))}
  </div>
);

export default NutrientSummaryCards;
