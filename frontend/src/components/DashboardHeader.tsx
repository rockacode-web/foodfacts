import type { AuthUser } from "../types";

type DashboardHeaderProps = {
  user: AuthUser | null;
  onOpenClassicScanner: () => void;
  onLogout: () => void;
};

const DashboardHeader = ({
  user,
  onOpenClassicScanner,
  onLogout
}: DashboardHeaderProps) => (
  <header className="dashboard-topbar">
    <div className="dashboard-topbar-copy">
      <div className="eyebrow">Authenticated Workspace</div>
      <h1 className="dashboard-title">FoodFacts dashboard</h1>
      <p className="dashboard-subtitle">
        Signed in as <strong>{user?.name || user?.email || "FoodFacts user"}</strong>. Scan new items,
        review saved analyses, and reopen full reports without leaving the protected workspace.
      </p>
    </div>

    <div className="dashboard-actions">
      <button type="button" className="ghost-action compact" onClick={onOpenClassicScanner}>
        Open classic scanner
      </button>
      <button type="button" className="ghost-action compact dashboard-logout" onClick={onLogout}>
        Log out
      </button>
    </div>
  </header>
);

export default DashboardHeader;
