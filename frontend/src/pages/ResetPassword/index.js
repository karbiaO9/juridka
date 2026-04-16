import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../components/Logo";
import { authAPI } from "../../services/api";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ✅ On récupère uniquement le token — plus besoin du type
  const token = searchParams.get("token");

  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!token) {
      setError(t("resetPassword.error.invalidToken", "Lien invalide ou expiré"));
      return;
    }
    if (password.length < 8) {
      setError(t("resetPassword.error.tooShort", "Minimum 8 caractères"));
      return;
    }
    if (!/\d/.test(password)) {
      setError(t("resetPassword.error.noDigit", "Le mot de passe doit contenir au moins un chiffre"));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword.error.mismatch", "Les mots de passe ne correspondent pas"));
      return;
    }

    setLoading(true);
    try {
      // ✅ On envoie juste token + nouveau mot de passe — le backend trouve le user tout seul
      await authAPI.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        t("resetPassword.error.generic", "Une erreur est survenue")
      );
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = ({ crossed }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      {crossed && (
        <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      )}
    </svg>
  );

  const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );

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
          ← {t("resetPassword.nav.backToLogin", "Retour à la connexion")}
        </button>
      </nav>

      <main className="lg-main">
        <div className="lg-header">
          <h1 className="lg-title">
            {t("resetPassword.header.title", "Nouveau")}
            <br />
            <em>{t("resetPassword.header.titleItalic", "mot de passe")}</em>
          </h1>
        </div>

        <div className="lg-card">
          <div className="lg-card-glow" />
          <div className="lg-corner-deco" />

          <div className="lg-card-header">
            <div className="lg-card-icon-wrap">
              <span className="lg-card-icon">{success ? "✅" : "🔒"}</span>
            </div>
            <div>
              <h2 className="lg-card-title">
                {success
                  ? t("resetPassword.card.titleSuccess", "Mot de passe modifié !")
                  : t("resetPassword.card.title", "Choisissez un mot de passe")}
              </h2>
              <p className="lg-card-subtitle">
                {success
                  ? t("resetPassword.card.subtitleSuccess", "Redirection en cours…")
                  : t("resetPassword.card.subtitle", "Minimum 8 caractères avec au moins un chiffre")}
              </p>
            </div>
          </div>

          <div className="lg-divider" />

          {success ? (
            <div style={{ padding: "8px 0 16px", textAlign: "center" }}>
              <p style={{ color: "#4ade80", fontSize: "0.95rem", marginBottom: "20px" }}>
                ✓ {t("resetPassword.success", "Vous allez être redirigé vers la connexion.")}
              </p>
              <div style={{ width: "100%", height: "3px", background: "rgba(74, 222, 128, 0.15)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#4ade80", borderRadius: "2px", animation: "lg-progress 3s linear forwards" }} />
              </div>
            </div>
          ) : (
            <div className="lg-fields">

              {/* ── Nouveau mot de passe ── */}
              <div className="lg-field">
                <label className="lg-label">
                  {t("resetPassword.fields.password.label", "Nouveau mot de passe")}
                </label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon" aria-hidden="true"><LockIcon /></span>
                  <input
                    className="lg-input lg-input--password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button className="lg-eye-btn" type="button" onClick={() => setShowPass((s) => !s)}
                    aria-label={showPass ? t("login.fields.password.hide", "Masquer") : t("login.fields.password.show", "Afficher")}>
                    <EyeIcon crossed={showPass} />
                  </button>
                </div>
              </div>

              {/* ── Confirmation ── */}
              <div className="lg-field">
                <label className="lg-label">
                  {t("resetPassword.fields.confirm.label", "Confirmer le mot de passe")}
                </label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon" aria-hidden="true"><LockIcon /></span>
                  <input
                    className="lg-input lg-input--password"
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    autoComplete="new-password"
                  />
                  <button className="lg-eye-btn" type="button" onClick={() => setShowConfirm((s) => !s)}
                    aria-label={showConfirm ? t("login.fields.password.hide", "Masquer") : t("login.fields.password.show", "Afficher")}>
                    <EyeIcon crossed={showConfirm} />
                  </button>
                </div>
              </div>

              {/* ── Indicateur de force ── */}
              {password.length > 0 && (
                <div style={{ marginTop: "-8px" }}>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    {[1, 2, 3, 4].map((level) => {
                      const strength =
                        password.length >= 12 && /\d/.test(password) && /[A-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 4
                        : password.length >= 10 && /\d/.test(password) && /[A-Z]/.test(password) ? 3
                        : password.length >= 8 && /\d/.test(password) ? 2
                        : 1;
                      const colors = ["#ef4444", "#f97316", "#eab308", "#4ade80"];
                      return (
                        <div key={level} style={{
                          flex: 1, height: "3px", borderRadius: "2px",
                          background: level <= strength ? colors[strength - 1] : "rgba(255,255,255,0.1)",
                          transition: "background 0.3s ease",
                        }} />
                      );
                    })}
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--lg-text-muted, #94a3b8)" }}>
                    {password.length < 8
                      ? t("resetPassword.strength.weak", "Trop court")
                      : !/\d/.test(password)
                      ? t("resetPassword.strength.noDigit", "Ajoutez un chiffre")
                      : password.length < 10
                      ? t("resetPassword.strength.fair", "Correct")
                      : password.length < 12
                      ? t("resetPassword.strength.good", "Bon")
                      : t("resetPassword.strength.strong", "Très fort")}
                  </p>
                </div>
              )}

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
                    {t("resetPassword.submit", "Enregistrer le mot de passe")}
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

      <style>{`
        @keyframes lg-progress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  );
}