type DashboardSwitcherProps = {
  activeView: "scanner" | "intake";
  onChangeView: (view: "scanner" | "intake") => void;
};

const DashboardSwitcher = ({ activeView, onChangeView }: DashboardSwitcherProps) => (
  <div className="dashboard-switcher" role="tablist" aria-label="Dashboard views">
    <button
      type="button"
      className={`dashboard-switch-tab ${activeView === "scanner" ? "active" : ""}`}
      onClick={() => onChangeView("scanner")}
    >
      Scanner
    </button>
    <button
      type="button"
      className={`dashboard-switch-tab ${activeView === "intake" ? "active" : ""}`}
      onClick={() => onChangeView("intake")}
    >
      Daily intake
    </button>
  </div>
);

export default DashboardSwitcher;
