type WarningChipsProps = {
  warnings: string[];
};

const WarningChips = ({ warnings }: WarningChipsProps) => {
  if (warnings.length === 0) {
    return <p className="muted">No strong warnings were saved for this result.</p>;
  }

  return (
    <div className="warning-chip-row">
      {warnings.slice(0, 6).map((warning, index) => (
        <span className="warning-chip" key={`${warning}-${index}`}>
          {warning}
        </span>
      ))}
    </div>
  );
};

export default WarningChips;
