import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthFormCard from "../components/AuthFormCard";
import { ApiError } from "../services/api";
import { useAuth } from "../auth/AuthProvider";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fields = useMemo(
    () => [
      {
        id: "email",
        label: "Email",
        type: "email" as const,
        autoComplete: "email",
        placeholder: "you@example.com",
        value: email
      },
      {
        id: "password",
        label: "Password",
        type: "password" as const,
        autoComplete: "current-password",
        placeholder: "Enter your password",
        value: password
      }
    ],
    [email, password]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await login({ email, password });
      const from = (location.state as { from?: string } | undefined)?.from || "/";
      navigate(from, { replace: true });
    } catch (authError) {
      setError(authError instanceof ApiError ? authError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormCard
      eyebrow="Welcome back"
      title="Sign in to your FoodFacts dashboard"
      subtitle="Access your saved scans, re-open past analyses, and keep using the existing AI scanner with account-based persistence."
      fields={fields}
      error={error}
      loading={loading}
      submitLabel="Log In"
      alternateLabel="Need an account?"
      alternateHref="/register"
      alternateText="Create one"
      onChange={(id, value) => {
        if (id === "email") {
          setEmail(value);
        }
        if (id === "password") {
          setPassword(value);
        }
      }}
      onSubmit={handleSubmit}
    />
  );
};

export default LoginPage;
