import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../components/Logo";
import { authAPI } from "../../services/api";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email) {
      setError(t("forgotPassword.error.required", "Email requis"));
      return;
    }

    setLoading(true);
    try {
      // ✅ On envoie juste l'email — le backend détecte client ou avocat tout seul
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        t("forgotPassword.error.generic", "Une erreur est survenue")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <div className="lg-bg-orb lg-orb-1" />
      <div className="lg-bg-orb lg-orb-2" />
      <div className="lg-bg-grid" />

      <nav className="lg-nav">
        <div className="lg-logo">
          <Logo />
        </div>
        <button className="lg-nav-link" onClick={() => navigate("/login")}>
          ← {t("forgotPassword.nav.backToLogin", "Retour à la connexion")}
        </button>
      </nav>

      <main className="lg-main">
        <div className="lg-header">
          <h1 className="lg-title">
            {t("forgotPassword.header.title", "Mot de passe")}
            <br />
            <em>{t("forgotPassword.header.titleItalic", "oublié ?")}</em>
          </h1>
        </div>

        <div className="lg-card">
          <div className="lg-card-glow" />
          <div className="lg-corner-deco" />

          <div className="lg-card-header">
            <div className="lg-card-icon-wrap">
              <span className="lg-card-icon">{sent ? "📬" : "🔑"}</span>
            </div>
            <div>
              <h2 className="lg-card-title">
                {sent
                  ? t("forgotPassword.card.titleSent", "Email envoyé !")
                  : t("forgotPassword.card.title", "Réinitialisation")}
              </h2>
              <p className="lg-card-subtitle">
                {sent
                  ? t("forgotPassword.card.subtitleSent", "Vérifiez votre boîte mail")
                  : t("forgotPassword.card.subtitle", "On vous envoie un lien de réinitialisation")}
              </p>
            </div>
          </div>

          <div className="lg-divider" />

          {sent ? (
            <div style={{ padding: "8px 0 16px", textAlign: "center" }}>
              <p style={{
                color: "var(--lg-text-muted, #94a3b8)",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                marginBottom: "24px",
              }}>
                {t("forgotPassword.sent.description", "Un lien de réinitialisation a été envoyé à")}{" "}
                <strong style={{ color: "var(--lg-text, #e2e8f0)" }}>{email}</strong>.{" "}
                {t("forgotPassword.sent.checkSpam", "Pensez à vérifier vos spams.")}
              </p>
              <button className="lg-submit" onClick={() => navigate("/login")}>
                {t("forgotPassword.sent.backToLogin", "Retour à la connexion")}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="lg-fields">
              <div className="lg-field">
                <label className="lg-label">
                  {t("forgotPassword.fields.email.label", "Adresse email")}
                </label>
                <div className="lg-input-wrap">
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
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    autoComplete="email"
                    autoFocus
                    placeholder={t("forgotPassword.fields.email.placeholder", "votre@email.com")}
                  />
                </div>
              </div>

              {error && (
                <div className="lg-error" role="alert">
                  <span className="lg-error-icon">⚠</span>
                  {error}
                </div>
              )}

              <button
                className={`lg-submit ${loading ? "lg-submit--loading" : ""}`}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <span className="lg-spinner" />
                ) : (
                  <>
                    {t("forgotPassword.submit", "Envoyer le lien")}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}