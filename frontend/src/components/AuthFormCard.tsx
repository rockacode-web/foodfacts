import type { FormEvent } from "react";
import { Link } from "react-router-dom";

type FieldConfig = {
  id: string;
  label: string;
  type: "text" | "email" | "password";
  value: string;
  autoComplete: string;
  placeholder: string;
};

type AuthFormCardProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  fields: FieldConfig[];
  error: string;
  loading: boolean;
  submitLabel: string;
  alternateLabel: string;
  alternateHref: string;
  alternateText: string;
  onChange: (id: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const AuthFormCard = ({
  eyebrow,
  title,
  subtitle,
  fields,
  error,
  loading,
  submitLabel,
  alternateLabel,
  alternateHref,
  alternateText,
  onChange,
  onSubmit
}: AuthFormCardProps) => (
  <main className="screen auth-screen">
    <section className="auth-shell">
      <aside className="auth-showcase">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-copy">{subtitle}</p>
        <div className="auth-feature-list">
          <div className="auth-feature-item">
            <span className="auth-feature-badge">A</span>
            <div>
              <strong>Authenticated scans</strong>
              <p>Every upload is tied to your account and saved for later review.</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-badge">H</span>
            <div>
              <strong>Scan history</strong>
              <p>Open past results instantly, compare them, or delete what you no longer need.</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-badge">R</span>
            <div>
              <strong>Readable reports</strong>
              <p>Keep the same label analysis flow, now inside a protected dashboard.</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="auth-card">
        <div className="eyebrow">FoodFacts Account</div>
        <h2 className="auth-card-title">{submitLabel}</h2>
        <p className="auth-card-copy">Use your email to access your scanner dashboard and saved results.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          {fields.map((field) => (
            <label className="auth-field" key={field.id} htmlFor={field.id}>
              <span>{field.label}</span>
              <input
                id={field.id}
                type={field.type}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                value={field.value}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
            </label>
          ))}

          {error && <div className="error-banner">{error}</div>}

          <button className="primary-action auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait..." : submitLabel}
          </button>
        </form>

        <p className="auth-footer">
          {alternateLabel}{" "}
          <Link className="auth-link" to={alternateHref}>
            {alternateText}
          </Link>
        </p>
      </div>
    </section>
  </main>
);

export default AuthFormCard;
