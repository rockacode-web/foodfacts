import type { ReactNode } from "react";

type CollapsibleAnalysisSectionProps = {
  title: string;
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

const CollapsibleAnalysisSection = ({
  title,
  subtitle,
  isOpen,
  onToggle,
  children
}: CollapsibleAnalysisSectionProps) => (
  <section className={`collapsible-panel ${isOpen ? "open" : ""}`}>
    <button
      type="button"
      className="collapsible-trigger"
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <span className="collapsible-indicator">{isOpen ? "Hide" : "View"}</span>
    </button>

    {isOpen && <div className="collapsible-content">{children}</div>}
  </section>
);

export default CollapsibleAnalysisSection;
