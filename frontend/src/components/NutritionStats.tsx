type NutritionStat = {
  label: string;
  value: string;
};

type NutritionStatsProps = {
  items: NutritionStat[];
};

const NutritionStats = ({ items }: NutritionStatsProps) => {
  if (items.length === 0) {
    return <p className="muted">No nutrition metrics were saved for this item.</p>;
  }

  return (
    <div className="nutrition-stats-grid">
      {items.map((item) => (
        <article className="nutrition-stat" key={item.label}>
          <span className="nutrition-stat-label">{item.label}</span>
          <strong className="nutrition-stat-value">{item.value}</strong>
        </article>
      ))}
    </div>
  );
};

export default NutritionStats;
