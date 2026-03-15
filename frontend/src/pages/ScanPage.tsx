import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import ScanCapturePanel from "../components/ScanCapturePanel";

const ScanPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <main className="screen">
      <section className="hero-card">
        <ScanCapturePanel
          onUnauthorized={logout}
          onAnalysisComplete={(result) => {
            navigate("/result", { state: result });
          }}
        />
      </section>
    </main>
  );
};

export default ScanPage;
