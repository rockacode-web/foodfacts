import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AuthFormCard from "../components/AuthFormCard";
import { ApiError } from "../services/api";
import { useAuth } from "../auth/AuthProvider";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fields = useMemo(
    () => [
      {
        id: "name",
        label: "Name",
        type: "text" as const,
        autoComplete: "name",
        placeholder: "Your name",
        value: name
      },
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
        autoComplete: "new-password",
        placeholder: "Create a password",
        value: password
      }
    ],
    [email, name, password]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await register({ name, email, password });
      navigate("/", { replace: true });
    } catch (authError) {
      setError(authError instanceof ApiError ? authError.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormCard
      eyebrow="Create account"
      title="Set up FoodFacts for saved scan history"
      subtitle="Register once to unlock authenticated uploads, persistent AI analysis results, and a history panel you can revisit anytime."
      fields={fields}
      error={error}
      loading={loading}
      submitLabel="Register"
      alternateLabel="Already have an account?"
      alternateHref="/login"
      alternateText="Log in"
      onChange={(id, value) => {
        if (id === "name") {
          setName(value);
        }
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

export default RegisterPage;
