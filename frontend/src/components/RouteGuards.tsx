import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function SessionLoader() {
  return (
    <main className="screen auth-screen">
      <section className="auth-shell auth-loading-shell">
        <div className="auth-loading-dot" />
        <p className="auth-loading-text">Restoring your FoodFacts workspace...</p>
      </section>
    </main>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <SessionLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <SessionLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
