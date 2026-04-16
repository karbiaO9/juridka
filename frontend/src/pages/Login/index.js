import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import Logo from "../../components/Logo";
import { useAuth } from "../../contexts/AuthContext";

export default function Login({ onGoRegister }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError(t("login.error.required"));
      return;
    }
    setLoading(true);
    try {
      const data = await login({ email, password });
      navigate(data.redirectUrl || "/", { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        t("login.error.invalid");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="lg-page">
      <div className="lg-bg-orb lg-orb-1" />
      <div className="lg-bg-orb lg-orb-2" />
      <div className="lg-bg-grid" />

      <nav className="lg-nav">
        <div className="lg-logo"><Logo /></div>
        <button className="lg-nav-link" onClick={onGoRegister}>
          {t("login.nav.noAccount")}{" "}
          <span><a href="/signup">{t("login.nav.register")}</a></span>
        </button>
      </nav>

      <main className="lg-main">
        <div className="lg-header">
          <h1 className="lg-title">
            {t("login.header.title")}
            <br />
            <em>{t("login.header.titleItalic")}</em>
          </h1>
        </div>

        <div className="lg-card">
          <div className="lg-card-glow" />
          <div className="lg-corner-deco" />

          <div className="lg-card-header">
            <div className="lg-card-icon-wrap">
              <span className="lg-card-icon">🔐</span>
            </div>
            <div>
              <h2 className="lg-card-title">{t("login.card.title")}</h2>
              <p className="lg-card-subtitle">{t("login.card.subtitle")}</p>
            </div>
          </div>

          <div className="lg-divider" />

          <div className="lg-fields">

            {/* ── Email ── */}
            <div className="lg-field">
              <label className="lg-label">{t("login.fields.email.label")}</label>
              <div className="lg-input-wrap">
                {/* icône positionnée en absolu à gauche */}
                <span className="lg-input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12v9H2V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  className="lg-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* ── Password ── */}
            <div className="lg-field">
              <div className="lg-label-row">
                <label className="lg-label">{t("login.fields.password.label")}</label>
                <button className="lg-forgot" type="button" onClick={() => navigate("/forgot-password")}>
                  {t("login.fields.password.forgot")}
                </button>
              </div>
              <div className="lg-input-wrap">
                <span className="lg-input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  className="lg-input lg-input--password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />
                <button
                  className="lg-eye-btn"
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? t("login.fields.password.hide") : t("login.fields.password.show")}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ── Error ── */}
            {error && (
              <div className="lg-error" role="alert">
                <span className="lg-error-icon">⚠</span>
                {error}
              </div>
            )}

            {/* ── Remember me ── */}
            <label className="lg-remember">
              <input type="checkbox" className="lg-checkbox" />
              <span className="lg-checkbox-custom" />
              <span className="lg-remember-label">{t("login.fields.rememberMe")}</span>
            </label>
          </div>

          {/* ── Submit ── */}
          <button
            className={`lg-submit ${loading ? "lg-submit--loading" : ""}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span className="lg-spinner" />
            ) : (
              <>
                {t("login.submit")}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>

          <div className="lg-or">
            <span className="lg-or-line" />
            <span className="lg-or-text">{t("login.or")}</span>
            <span className="lg-or-line" />
          </div>

          <p className="lg-register-prompt">
            {t("login.registerPrompt")}{" "}
            <a className="lg-register-link" href="/signup">
              {t("login.registerLink")}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}