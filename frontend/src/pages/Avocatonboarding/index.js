import { useState } from "react";
import { useTranslation } from "react-i18next";
import OtpInput from "../../components/OtpInput";
import {
  API, ONAT_REGEX, DAYS_KEYS, HOURS, WILAYAS, REQUIRED_DOCS,
  getIcon, resolveLabel, resolveAction,
  buildPlans, buildSpecialties, buildLanguages,
} from "./Avocatonboardinghelpers";
import "./Avocatonboarding.css"
import MapPicker from '../../components/MapPicker';
import { useNavigate } from "react-router-dom";
// ── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = "text" }) {

  return (
    <div>
      {label && <label className="ao-label">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ao-input"
      />
    </div>
  );
}

function Btn({ onClick, loading, children }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`ao-btn${loading ? " ao-btn--loading" : ""}`}
    >
      {loading ? "…" : children}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AvocatOnboarding() {
  const { t } = useTranslation();

  const SPECIALTIES = buildSpecialties(t);
  const LANGUAGES = buildLanguages(t);
  const PLANS = buildPlans(t);

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [avocatId, setAvocatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  // Step 1 — account
  const [s1, setS1] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    whatsappSame: true,
    whatsapp: "",   // numéro différent si whatsappSame = false
    password: "",
    lang: "fr",
  });

  // Step 2 — OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  // Step 3 — identity
  const [s3, setS3] = useState({
    barNumber: "",
    barRegion: "",
    graduationYear: "",
    practiceStatus: "",
    firmName: "",
    specialties: [],
    languages: [],
  });

  // Step 4 — docs
  const [docs, setDocs] = useState({
    carteBarreauFront: null,
    carteBarreauBack: null,
    diplome: null,
    patente: null,
    casierJudiciaire: null,
  });

  // Step 5 — photo
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState({ original: "", enhanced: "" });
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [geminiConsent, setGeminiConsent] = useState(null);

  // Step 6 — availability + location (→ /register/step8 backend)
  const [slots, setSlots] = useState({});
  const [emergency, setEmergency] = useState(false);
  const [mapPin, setMapPin] = useState(null); // ← ici

  const [location, setLocation] = useState({
    wilaya: "", quartier: "", address: "", lat: "", lng: "",
  });
  // Step 8 — plan
  const [selectedPlan, setSelectedPlan] = useState("essentiel");

  // Step 9 — payment
  const [payMode, setPayMode] = useState("online");
  const [justif, setJustif] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCd, setResendCd] = useState(0);
  // ── API helpers ────────────────────────────────────────────────────────────

  /**
   * hardApi — bloque la progression si l'API échoue
   */
  const hardApi = async (path, method, body, isForm = false) => {
    setError("");
    setLoading(true);
    try {
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (!isForm) headers["Content-Type"] = "application/json";

      const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: isForm ? body : (body ? JSON.stringify(body) : undefined),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("avocatOnboarding.error.server"));
      return data;
    } catch (e) {
      if (e.name === "TypeError" || e.message === "Failed to fetch") {
        console.warn("[demo] API unreachable, continuing locally");
        return { avocatId: "DEMO-ID", token: "DEMO-TOKEN" };
      }
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  /**
   * softApi — n'interrompt pas le flow si l'API échoue
   */
  const softApi = async (path, method, body, isForm = false) => {
    try {
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (!isForm) headers["Content-Type"] = "application/json";

      const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: isForm ? body : (body ? JSON.stringify(body) : undefined),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) console.warn(`[softApi] ${path}:`, data.error || res.status);
      return data;
    } catch (e) {
      console.warn(`[softApi] ${path} unreachable:`, e.message);
      return {};
    }
  };

  const next = () => { setError(""); setStep((s) => s + 1); };
  const back = () => { setError(""); setStep((s) => s - 1); };
  const fail = (msg) => setError(msg);

  // ── Step handlers ──────────────────────────────────────────────────────────

  // ── Étape 1 — Infos de base ───────────────────────────────────────────────
  const handleStep1 = async () => {
    if (!s1.firstName.trim()) { fail(t("avocatOnboarding.validation.firstName")); return; }
    if (!s1.lastName.trim()) { fail(t("avocatOnboarding.validation.lastName")); return; }
    if (!s1.email.includes("@")) { fail(t("avocatOnboarding.validation.email")); return; }
    if (!/^\d{8}$/.test(s1.phone)) { fail(t("avocatOnboarding.validation.phone")); return; }
    if (s1.password.length < 8) { fail(t("avocatOnboarding.validation.password")); return; }
    if (!/\d/.test(s1.password)) { fail(t("avocatOnboarding.validation.passwordNum")); return; }

    // Résoudre le numéro WhatsApp avant d'envoyer
    // sameWhatsapp true  → même numéro que phone
    // sameWhatsapp false + whatsapp renseigné → numéro différent
    // sameWhatsapp false + whatsapp vide       → pas de WhatsApp (null)
    let whatsappPhone = null;
    if (s1.whatsappSame) {
      whatsappPhone = `+216${s1.phone}`;
    } else if (s1.whatsapp.trim()) {
      whatsappPhone = `+216${s1.whatsapp.trim()}`;
    }

    try {
      const data = await hardApi("/register/step1", "POST", {
        firstName: s1.firstName.trim(),
        lastName: s1.lastName.trim(),
        email: s1.email.trim(),
        phone: `+216${s1.phone}`,
        sameWhatsapp: s1.whatsappSame,
        whatsappPhone,
        password: s1.password,
        languagePreference: s1.lang,
      });
      setAvocatId(data.avocatId || "DEMO-ID");
      next();
    } catch (_) { }
  };

  // ── Étape 2 — Vérification OTP ────────────────────────────────────────────
  const handleVerifyOtp = async (code) => {
    const otpCode = code ?? otp.join("");
    if (otpCode.length !== 6) {
      setOtpError(t("avocatOnboarding.validation.otp"));
      return;
    }
    try {
      const data = await hardApi("/verify-email", "POST", { avocatId, otp: otpCode });
      setToken(data.token || "DEMO-TOKEN");
      next();
    } catch (_) {
      setOtpError(t("avocatOnboarding.validation.otp"));
      setOtp(Array(6).fill(""));
    }
  };
  const handleResendOtp = async () => {
    try {
      await hardApi("/resend-otp", "POST", { avocatId });
      setOtpError("");
      setResendCd(60);
      const interval = setInterval(() => {
        setResendCd(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setOtpError(err.message || "Erreur lors du renvoi");
    }
  };
  // ── Étape 3 — Identité professionnelle ───────────────────────────────────
  const toggleSpecialty = (sp) => setS3((p) => ({
    ...p,
    specialties: p.specialties.includes(sp)
      ? p.specialties.filter((x) => x !== sp)
      : p.specialties.length < 3 ? [...p.specialties, sp] : p.specialties,
  }));

  const toggleLang = (l) => setS3((p) => ({
    ...p,
    languages: p.languages.includes(l)
      ? p.languages.filter((x) => x !== l)
      : [...p.languages, l],
  }));

  const handleStep3 = async () => {
    if (!s3.barNumber.trim()) { fail(t("avocatOnboarding.validation.barNumber")); return; }
    if (!ONAT_REGEX.test(s3.barNumber.trim())) { fail(t("avocatOnboarding.validation.barNumberFormat")); return; }
    if (!s3.barRegion) { fail(t("avocatOnboarding.validation.university")); return; }
    if (!s3.graduationYear) { fail(t("avocatOnboarding.validation.graduationYear")); return; }
    if (!s3.practiceStatus) { fail(t("avocatOnboarding.validation.practiceStatus")); return; }
    if (s3.specialties.length === 0) { fail(t("avocatOnboarding.validation.specialties")); return; }

    setLoading(true);
    await softApi("/register/step3", "POST", {        // ← corrigé : step3
      barNumber: s3.barNumber.trim(),
      barRegion: s3.barRegion,                  // ← corrigé : barRegion (était university)
      graduationYear: Number(s3.graduationYear),
      practiceStatus: s3.practiceStatus,
      firmName: s3.firmName || "",
      specialties: s3.specialties,
      spokenLanguages: s3.languages,
    });
    setLoading(false);
    next();
  };

  // ── Étape 4 — Documents ───────────────────────────────────────────────────
  const handleStep4 = async () => {
    const missing = REQUIRED_DOCS.filter((k) => !docs[k]);
    if (missing.length > 0) {
      fail(t("avocatOnboarding.validation.docs", { count: missing.length }));
      return;
    }
    setLoading(true);
    const fd = new FormData();
    REQUIRED_DOCS.forEach((k) => { if (docs[k]) fd.append(k, docs[k]); });
    await softApi("/register/step4", "POST", fd, true); // ← corrigé : step4
    setLoading(false);
    next();
  };

  // ── Étape 5 — Photo ───────────────────────────────────────────────────────
  const handlePhotoUpload = () => {
    if (!photo) { fail(t("avocatOnboarding.validation.photo")); return; }
    setShowConsentModal(true);
  };

  const executePhotoUpload = async (useGeminiFlag) => {
    setShowConsentModal(false);
    setGeminiConsent(useGeminiFlag ? 'accepted' : 'declined');
    setLoading(true);
    const fd = new FormData();
    fd.append("photo", photo);
    fd.append("useGemini", useGeminiFlag.toString());
    const data = await softApi("/register/step5/upload", "POST", fd, true); // ← corrigé : step5
    setLoading(false);
    setPhotoPreview({
      original: data.original || URL.createObjectURL(photo),
      enhanced: data.enhanced || URL.createObjectURL(photo),
    });
  };

  const handleApprovePhoto = async () => {
    setLoading(true);
    await softApi("/register/step5/approve", "POST", {}); // ← corrigé : step5
    setLoading(false);
    next();
  };

  // ── Étape 6 — Disponibilités + Localisation → /register/step8 ────────────
  const toggleSlot = (day, hour) => {
    const key = `${day}-${hour}`;
    setSlots((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleStep6 = async () => {
    if (!location.wilaya) { fail(t("avocatOnboarding.validation.wilaya")); return; }
    if (!location.address) { fail(t("avocatOnboarding.validation.address")); return; }
    if (!mapPin) { fail("Veuillez épingler votre cabinet sur la carte"); return; }

    setLoading(true);

    const slotList = Object.entries(slots)
      .filter(([, active]) => active)
      .map(([key]) => {
        const [day, time] = key.split("-");
        return { day, time };
      });

    await softApi("/register/step8", "POST", {
      slots: slotList,
      emergencyEnabled: emergency,
      gouvernorat: location.wilaya,
      quartier: location.quartier || "",
      address: location.address,
      lat: mapPin.lat.toString(),   // ← from map, plus de fallback
      lng: mapPin.lng.toString(),   // ← from map, plus de fallback
    });

    setLoading(false);
    next();
  };

  // ── Étape 8 — Plans ───────────────────────────────────────────────────────
  const handleStep8 = () => next();

  // ── Étape 9 — Paiement + Soumission ──────────────────────────────────────
  const handleSubmit = async () => {
    if (payMode === "online") {
      if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
        fail(t("avocatOnboarding.validation.cardIncomplete", "Veuillez remplir tous les champs de la carte."));
        return;
      }
    }
    if (payMode === "virement" && !justif) {
      fail(t("avocatOnboarding.validation.justif"));
      return;
    }

    setLoading(true);

    if (justif) {
      const fd = new FormData();
      fd.append("justif", justif);
      fd.append("amount", String(planInfo?.price ?? 0));
      await softApi("/register/payment-proof", "POST", fd, true);
    }

    await softApi("/register/submit", "POST", { declarationAccepted: true });
    setLoading(false);
    setSubmitted(true);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const planInfo = PLANS.find((p) => p.id === selectedPlan);
  const payRef = `JRD-${selectedPlan.toUpperCase().slice(0, 3)}-2026-6205`;

  const displayCardNumber = (() => {
    const raw = cardNumber.replace(/\s/g, "");
    if (!raw) return "•••• •••• •••• ••••";
    const padded = raw.padEnd(16, "•");
    return padded.match(/.{1,4}/g).join(" ");
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="ao-page">

      {/* Progress bubbles */}
      <div className="ao-nav-steps">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <div
            key={n}
            className={[
              "ao-bubble",
              step === n ? "ao-bubble--active" : "",
              step > n ? "ao-bubble--done" : "",
            ].join(" ")}
          >
            {step > n ? "✓" : n}
          </div>
        ))}
      </div>

      <div className="ao-container">
        <div className="ao-card">

          {/* Card header */}
          {!(step === 9 && submitted) && (
            <div className="ao-card-header">
              <div>
                <div className="ao-step-tag">
                  {t("avocatOnboarding.step.label", { current: step, total: 9 })}
                </div>
                <h1 className="ao-card-title">{t(`avocatOnboarding.step${step}.title`)}</h1>
                <p className="ao-card-sub">{t(`avocatOnboarding.step${step}.sub`)}</p>
              </div>
              <div className="ao-step-circle">{getIcon(step)}</div>
            </div>
          )}

          {/* Error banner */}
          {error && <div className="ao-alert-box">⚠️ {error}</div>}

          <div className="ao-card-body">

            {/* ════ 1 — Compte ════ */}
            {step === 1 && (
              <div className="ao-form">
                <div className="ao-grid2">
                  <Field
                    label={t("avocatOnboarding.field.firstName")}
                    value={s1.firstName}
                    onChange={(v) => setS1((p) => ({ ...p, firstName: v }))}
                    placeholder={t("avocatOnboarding.ph.firstName")}
                  />
                  <Field
                    label={t("avocatOnboarding.field.lastName")}
                    value={s1.lastName}
                    onChange={(v) => setS1((p) => ({ ...p, lastName: v }))}
                    placeholder={t("avocatOnboarding.ph.lastName")}
                  />
                </div>

                <Field
                  label={t("avocatOnboarding.field.email")}
                  value={s1.email}
                  onChange={(v) => setS1((p) => ({ ...p, email: v }))}
                  placeholder={t("avocatOnboarding.ph.email")}
                  type="email"
                />

                {/* Téléphone */}
                <div>
                  <label className="ao-label">{t("avocatOnboarding.field.phone")}</label>
                  <div className="ao-phone-row">
                    <div className="ao-phone-prefix">+216</div>
                    <input
                      className="ao-input ao-input--phone"
                      value={s1.phone}
                      onChange={(e) => setS1((p) => ({
                        ...p,
                        phone: e.target.value,
                        // Si "même numéro" coché, synchroniser whatsapp
                        whatsapp: p.whatsappSame ? e.target.value : p.whatsapp,
                      }))}
                      placeholder="50123456"
                      maxLength={8}
                    />
                  </div>
                  <div className="ao-hint">{t("avocatOnboarding.field.phoneHint")}</div>
                </div>

                {/* WhatsApp */}
                <div>
                  <div className="ao-whatsapp-header">
                    <label className="ao-label">{t("avocatOnboarding.field.whatsapp")}</label>
                    <label className="ao-check-label">
                      <input
                        type="checkbox"
                        className="ao-cb"
                        checked={s1.whatsappSame}
                        onChange={(e) => setS1((p) => ({
                          ...p,
                          whatsappSame: e.target.checked,
                          // Si on coche "même numéro", copier phone dans whatsapp
                          whatsapp: e.target.checked ? p.phone : p.whatsapp,
                        }))}
                      />
                      {t("avocatOnboarding.field.whatsappSame")}
                    </label>
                  </div>
                  <div className={`ao-phone-row${s1.whatsappSame ? " ao-input--phone-disabled" : ""}`}>
                    <div className="ao-phone-prefix" style={{ fontSize: 16 }}>📱</div>
                    <input
                      className="ao-input ao-input--phone"
                      value={s1.whatsappSame ? s1.phone : s1.whatsapp}
                      onChange={(e) => setS1((p) => ({ ...p, whatsapp: e.target.value }))}
                      disabled={s1.whatsappSame}
                      placeholder="50123456"
                    />
                  </div>
                  {s1.whatsappSame && (
                    <div className="ao-whatsapp-hint">
                      ✓ {t("avocatOnboarding.field.whatsappActive")}
                    </div>
                  )}
                </div>

                <Field
                  label={t("avocatOnboarding.field.password")}
                  value={s1.password}
                  onChange={(v) => setS1((p) => ({ ...p, password: v }))}
                  placeholder={t("avocatOnboarding.ph.password")}
                  type="password"
                />
                <div className="ao-info-box">🔒 {t("avocatOnboarding.info.aes")}</div>
              </div>
            )}

            {/* ════ 2 — OTP ════ */}
            {step === 2 && (
              <div className="ao-form">
                <p
                  className="ao-text"
                  dangerouslySetInnerHTML={{
                    __html: t("avocatOnboarding.otp.sent", { email: `<strong>${s1.email}</strong>` }),
                  }}
                />
                <OtpInput
                  value={otp}
                  onChange={(next) => { setOtp(next); setOtpError(""); }}
                  onComplete={(code) => handleVerifyOtp(code)}
                  error={otpError}
                  disabled={loading}
                  label={t("otp.label")}
                  resendLabel={t("otp.resend")}
                  onResend={handleResendOtp}
                  resendCooldown={resendCd}
                />
              </div>
            )}

            {/* ════ 3 — Identité professionnelle ════ */}
            {step === 3 && (
              <div className="ao-form">
                <div className="ao-onat-banner">🏛️ {t("avocatOnboarding.identity.onatBanner")}</div>
                <div className="ao-grid2">
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.barNumber")}</label>
                    <input
                      className="ao-input"
                      value={s3.barNumber}
                      onChange={(e) => setS3((p) => ({ ...p, barNumber: e.target.value.toUpperCase() }))}
                      placeholder="TN-2015-1234"
                    />
                    <div className="ao-hint">{t("avocatOnboarding.field.barNumberHint")}</div>
                  </div>
                  {/* ← corrigé : barRegion (était barreau → university) */}
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.university")}</label>
                    <select
                      className="ao-input"
                      value={s3.barRegion}
                      onChange={(e) => setS3((p) => ({ ...p, barRegion: e.target.value }))}
                    >
                      <option value="">{t("avocatOnboarding.ph.select")}</option>
                      {WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <Field
                    label={t("avocatOnboarding.field.graduationYear")}
                    value={s3.graduationYear}
                    onChange={(v) => setS3((p) => ({ ...p, graduationYear: v }))}
                    placeholder="2010"
                    type="number"
                  />
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.practiceStatus")}</label>
                    <select
                      className="ao-input"
                      value={s3.practiceStatus}
                      onChange={(e) => setS3((p) => ({ ...p, practiceStatus: e.target.value }))}
                    >
                      <option value="">{t("avocatOnboarding.ph.select")}</option>
                      <option value="independant">{t("avocatOnboarding.status.independant")}</option>
                      <option value="associated">{t("avocatOnboarding.status.associated")}</option>
                      <option value="member">{t("avocatOnboarding.status.member")}</option>
                    </select>
                  </div>
                </div>
                <Field
                  label={`${t("avocatOnboarding.field.firmName")} (${t("avocatOnboarding.field.optional")})`}
                  value={s3.firmName}
                  onChange={(v) => setS3((p) => ({ ...p, firmName: v }))}
                  placeholder={t("avocatOnboarding.ph.firmName")}
                />
                <div>
                  <label className="ao-label">
                    {t("avocatOnboarding.field.specialties")}{" "}
                    <span style={{ fontWeight: 400, color: "#aaa", textTransform: "none", letterSpacing: 0 }}>
                      ({t("avocatOnboarding.field.max3")})
                    </span>
                  </label>
                  <div className="ao-tags">
                    {SPECIALTIES.map((sp) => (
                      <button
                        key={sp}
                        onClick={() => toggleSpecialty(sp)}
                        className={`ao-tag${s3.specialties.includes(sp) ? " ao-tag--on" : ""}`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                  <div className="ao-hint">
                    {t("avocatOnboarding.field.specialtiesCount", { count: s3.specialties.length })}
                  </div>
                </div>
                <div>
                  <label className="ao-label">{t("avocatOnboarding.field.languages")}</label>
                  <div className="ao-tags">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        onClick={() => toggleLang(l)}
                        className={`ao-tag${s3.languages.includes(l) ? " ao-tag--on" : ""}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════ 4 — Documents ════ */}
            {step === 4 && (
              <div className="ao-form">
                <div className="ao-info-box">{t("avocatOnboarding.docs.info")}</div>
                {[
                  { key: "carteBarreauFront", labelKey: "avocatOnboarding.docs.carteBarreFront", subKey: "avocatOnboarding.docs.carteBarreFrontSub" },
                  { key: "carteBarreauBack", labelKey: "avocatOnboarding.docs.carteBarreBack", subKey: "avocatOnboarding.docs.carteBarreBackSub" },
                  { key: "diplome", labelKey: "avocatOnboarding.docs.diplome", subKey: "avocatOnboarding.docs.diplomeSub" },
                  { key: "patente", labelKey: "avocatOnboarding.docs.patente", subKey: "avocatOnboarding.docs.patenteSub" },
                  { key: "casierJudiciaire", labelKey: "avocatOnboarding.docs.casier", subKey: "avocatOnboarding.docs.casierSub" },
                ].map(({ key, labelKey, subKey }) => (
                  <label key={key} className={`ao-doc-card${docs[key] ? " ao-doc-card--done" : ""}`}>
                    <span style={{ fontSize: 22 }}>📎</span>
                    <div style={{ flex: 1 }}>
                      <div className="ao-doc-label">{t(labelKey)}</div>
                      <div className="ao-doc-sub">{t(subKey)}</div>
                    </div>
                    {docs[key]
                      ? <span className="ao-doc-done-name">✓ {docs[key].name}</span>
                      : <span className="ao-doc-placeholder">{t("avocatOnboarding.docs.clickUpload")}</span>
                    }
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: "none" }}
                      onChange={(e) => setDocs((p) => ({ ...p, [key]: e.target.files[0] }))}
                    />
                  </label>
                ))}
                <div className="ao-doc-count">
                  {t("avocatOnboarding.docs.count", {
                    done: Object.values(docs).filter(Boolean).length,
                    total: 5,
                  })}
                </div>
              </div>
            )}

            {/* ════ 5 — Photo ════ */}
            {step === 5 && (
              <div className="ao-form">
                <div className="ao-photo-area">
                  <div className="ao-photo-avatar">
                    {photo
                      ? <img src={URL.createObjectURL(photo)} alt="preview" />
                      : <span style={{ fontSize: 36, color: "#aaa" }}>👤</span>
                    }
                  </div>
                  <label className="ao-photo-upload-btn">
                    <span style={{ fontSize: 18 }}>📷</span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#1e3a5f" }}>{t("avocatOnboarding.photo.upload")}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{t("avocatOnboarding.photo.formats")}</div>
                    </div>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        setPhoto(e.target.files[0]);
                        setPhotoPreview({ original: "", enhanced: "" });
                      }}
                    />
                  </label>
                </div>
                <div className="ao-photo-rules">
                  <div className="ao-photo-rule--ok">✓ {t("avocatOnboarding.photo.rule1")}</div>
                  <div className="ao-photo-rule--ok">✓ {t("avocatOnboarding.photo.rule2")}</div>
                  <div className="ao-photo-rule--ko">✗ {t("avocatOnboarding.photo.rule3")}</div>
                </div>
                <div className="ao-info-box">🤖 {t("avocatOnboarding.photo.aiInfo")}</div>
                {photo && !photoPreview.original && (
                  <Btn onClick={handlePhotoUpload} loading={loading}>
                    {t("avocatOnboarding.photo.analyze", "Analyze / Enhance")}
                  </Btn>
                )}
                {photoPreview.original && (
                  <>
                    <div className="ao-photo-grid">
                      <div className="ao-photo-preview">
                        <div className="ao-photo-preview-label">{t("avocatOnboarding.photo.original")}</div>
                        <img src={photoPreview.original} alt="original" />
                      </div>
                      <div className="ao-photo-preview ao-photo-preview--enhanced">
                        <div className="ao-photo-preview-label ao-photo-preview-label--enhanced">
                          ✨ {t("avocatOnboarding.photo.enhanced")}
                        </div>
                        <img src={photoPreview.enhanced} alt="enhanced" />
                      </div>
                    </div>
                    <Btn onClick={handleApprovePhoto} loading={loading}>
                      {t("avocatOnboarding.photo.approve")}
                    </Btn>
                  </>
                )}

                {/* Consent Modal for Gemini AI */}
                {showConsentModal && (
                  <div className="ao-modal-overlay">
                    <div className="ao-modal-card">
                      <h3 style={{ marginTop: 0, color: "#1e3a5f" }}>✨ Enhance your photo with AI</h3>
                      <p style={{ color: "#555", lineHeight: "1.5" }}>
                        We'd like to send your photo to Google Gemini AI to generate a professional headshot. Your image is processed securely and not stored by Google.
                      </p>
                      <div className="ao-modal-actions">
                        <button className="ao-btn" onClick={() => executePhotoUpload(true)}>
                          Yes, enhance with AI
                        </button>
                        <button className="ao-btn ao-btn--secondary" onClick={() => executePhotoUpload(false)}>
                          No, use standard enhancement
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ 6 — Disponibilités & Cabinet ════ */}
            {step === 6 && (
              <div className="ao-form">
                <h3 className="ao-section-title">{t("avocatOnboarding.avail.slotsTitle")}</h3>
                <div className="ao-info-box">{t("avocatOnboarding.avail.slotsInfo")}</div>

                {/* Grille horaire */}
                <div className="ao-avail-table-wrap">
                  <table className="ao-avail-table">
                    <thead>
                      <tr>
                        <th className="ao-th"></th>
                        {DAYS_KEYS.map((d) => (
                          <th key={d} className="ao-th">{t(`avocatOnboarding.day.${d}`)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map((h) => (
                        <tr key={h}>
                          <td className="ao-td-time">{h}</td>
                          {DAYS_KEYS.map((d) => {
                            const on = !!slots[`${d}-${h}`];
                            return (
                              <td
                                key={d}
                                className={`ao-td${on ? " ao-td--on" : ""}`}
                                onClick={() => toggleSlot(d, h)}
                              />
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ao-avail-legend">
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div className="ao-legend-dot ao-legend-dot--on" />
                    {t("avocatOnboarding.avail.available")}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div className="ao-legend-dot ao-legend-dot--off" />
                    {t("avocatOnboarding.avail.unavailable")}
                  </div>
                </div>

                {/* Urgences */}
                <div className="ao-emergency-box">
                  <div className="ao-emergency-header">
                    <div>
                      <div className="ao-emergency-title">🚨 {t("avocatOnboarding.avail.emergency")}</div>
                      <div className="ao-emergency-sub">{t("avocatOnboarding.avail.emergencySub")}</div>
                    </div>
                    <div
                      className={`ao-toggle${emergency ? " ao-toggle--on" : " ao-toggle--off"}`}
                      onClick={() => setEmergency((p) => !p)}
                    >
                      <div className={`ao-toggle-dot${emergency ? " ao-toggle-dot--on" : ""}`} />
                    </div>
                  </div>
                </div>

                {/* Localisation */}
                <h3 className="ao-section-title">{t("avocatOnboarding.avail.locationTitle")}</h3>
                <div className="ao-grid2">
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.wilaya")}</label>
                    <select
                      className="ao-input"
                      value={location.wilaya}
                      onChange={(e) => setLocation((p) => ({ ...p, wilaya: e.target.value }))}
                    >
                      <option value="">{t("avocatOnboarding.ph.select")}</option>
                      {WILAYAS.map((w) => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                  <Field
                    label={t("avocatOnboarding.field.quartier")}
                    value={location.quartier}
                    onChange={(v) => setLocation((p) => ({ ...p, quartier: v }))}
                    placeholder={t("avocatOnboarding.ph.quartier")}
                  />
                </div>
                <Field
                  label={t("avocatOnboarding.field.address")}
                  value={location.address}
                  onChange={(v) => setLocation((p) => ({ ...p, address: v }))}
                  placeholder={t("avocatOnboarding.ph.address")}
                />
                <div className="ao-grid2">
                  <MapPicker
                    pin={mapPin}
                    onPin={(p) => {
                      setMapPin(p);
                      if (p) setLocation(prev => ({ ...prev, lat: p.lat.toString(), lng: p.lng.toString() }));
                      else setLocation(prev => ({ ...prev, lat: "", lng: "" }));
                    }}
                    onSearch={(address) => setLocation(prev => ({ ...prev, address }))}
                  />
                </div>

              </div>
            )}

            {/* ════ 7 — Aperçu profil ════ */}
            {step === 7 && (
              <div className="ao-form">
                <div className="ao-info-box">{t("avocatOnboarding.preview.info")}</div>
                <div className="ao-profile-card">
                  <div className="ao-profile-header">
                    <div className="ao-profile-avatar">
                      <span style={{ fontSize: 28, color: "#aaa" }}>👤</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="ao-profile-name">Me. {s1.firstName} {s1.lastName}</div>
                      <div className="ao-profile-barreau">
                        {s3.barRegion || t("avocatOnboarding.preview.barreau")}
                      </div>
                      <div className="ao-profile-badges">
                        <span className="ao-badge">✓ {t("avocatOnboarding.preview.onat")}</span>
                        <span className="ao-badge ao-badge--gold">⭐ {t("avocatOnboarding.preview.founder")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ao-profile-body">
                    <div className="ao-profile-row">
                      <span>⚖️</span>
                      <div>
                        <div className="ao-profile-row-label">{t("avocatOnboarding.preview.specialties")}</div>
                        <div className="ao-profile-row-val">
                          {s3.specialties.length
                            ? s3.specialties.join(", ")
                            : t("avocatOnboarding.preview.empty")}
                        </div>
                      </div>
                    </div>
                    <div className="ao-profile-row" style={{ alignItems: "center" }}>
                      <span>🌐</span>
                      <div className="ao-profile-row-val">
                        <strong>{t("avocatOnboarding.preview.languages")} </strong>
                        {s3.languages.length ? s3.languages.join(", ") : "—"}
                      </div>
                    </div>
                    <div className="ao-profile-row" style={{ alignItems: "center" }}>
                      <span>📍</span>
                      <div className="ao-profile-row-val">
                        {location.quartier && location.wilaya
                          ? `${location.quartier}, ${location.wilaya}`
                          : "—"}
                      </div>
                    </div>
                    {/* Afficher WhatsApp seulement si un numéro est défini */}
                    {(s1.whatsappSame || s1.whatsapp) && (
                      <div className="ao-profile-whatsapp">
                        📱 {t("avocatOnboarding.preview.whatsapp")}
                      </div>
                    )}
                    <div>
                      <div className="ao-profile-row-label" style={{ marginBottom: 8 }}>
                        {t("avocatOnboarding.preview.availability")}
                      </div>
                      <div className="ao-avail-days">
                        {DAYS_KEYS.map((d) => {
                          const has = Object.keys(slots).some(
                            (k) => k.startsWith(d + "-") && slots[k],
                          );
                          return (
                            <div key={d} className={has ? "ao-avail-day--on" : "ao-avail-day--off"}>
                              {t(`avocatOnboarding.day.${d}`)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════ 8 — Plans ════ */}
            {step === 8 && (
              <div className="ao-form">
                <p className="ao-plans-intro">{t("avocatOnboarding.plans.intro")}</p>
                <div className="ao-plans-grid">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={[
                        "ao-plan-card",
                        selectedPlan === plan.id ? "ao-plan-card--active" : "",
                        plan.highlight ? "ao-plan-card--highlight" : "",
                      ].join(" ")}
                    >
                      {plan.badge && <div className="ao-plan-badge">{plan.badge}</div>}
                      {plan.trial && <div className="ao-plan-trial">{plan.trial}</div>}
                      {selectedPlan === plan.id && <div className="ao-plan-check">✓</div>}
                      <div className="ao-plan-label">{plan.label}</div>
                      <div className="ao-plan-price">
                        {plan.price === 0 ? "0" : plan.price.toLocaleString()}
                        <span className="ao-plan-price-unit"> DT</span>
                      </div>
                      <div className="ao-plan-period">{plan.unit}</div>
                      {plan.features?.map((f) => <div key={f} className="ao-plan-feature">✓ {f}</div>)}
                      {plan.disabled?.map((f) => <div key={f} className="ao-plan-disabled">— {f}</div>)}
                    </div>
                  ))}
                </div>
                {selectedPlan !== "gratuit" && (
                  <div className="ao-info-box ao-info-box--green">
                    ✓ {t("avocatOnboarding.plans.trialNote", { plan: planInfo?.label })}
                  </div>
                )}
              </div>
            )}

            {/* ════ 9 — Paiement ════ */}
            {step === 9 && !submitted && (
              <div className="ao-form">
                <div className="ao-order-box">
                  <div className="ao-order-title">{t("avocatOnboarding.payment.summary")}</div>
                  <div className="ao-order-row">
                    <span>{t("avocatOnboarding.payment.plan", { plan: planInfo?.label })}</span>
                    <span>{planInfo?.price} DT</span>
                  </div>
                  <div className="ao-order-row">
                    <span>{t("avocatOnboarding.payment.period")}</span>
                    <span>{t("avocatOnboarding.payment.months12")}</span>
                  </div>
                  <div className="ao-order-row">
                    <span>{t("avocatOnboarding.payment.tva")}</span>
                    <span>0 DT</span>
                  </div>
                  <div className="ao-order-row ao-order-row--total">
                    <span>{t("avocatOnboarding.payment.total")}</span>
                    <span className="ao-order-total-amount">{planInfo?.price} DT</span>
                  </div>
                </div>

                <h3 className="ao-section-title">{t("avocatOnboarding.payment.modeTitle")}</h3>
                <div className="ao-grid2">
                  {[
                    { id: "online", labelKey: "avocatOnboarding.payment.online", subKey: "avocatOnboarding.payment.onlineSub" },
                    { id: "virement", labelKey: "avocatOnboarding.payment.virement", subKey: "avocatOnboarding.payment.virementSub" },
                  ].map((pm) => (
                    <div
                      key={pm.id}
                      onClick={() => setPayMode(pm.id)}
                      className={`ao-pay-card${payMode === pm.id ? " ao-pay-card--active" : ""}`}
                    >
                      {payMode === pm.id && <div className="ao-pay-check">✓</div>}
                      <span style={{ fontSize: 24 }}>{pm.id === "online" ? "💳" : "🏦"}</span>
                      <div>
                        <div className="ao-pay-label">{t(pm.labelKey)}</div>
                        <div className="ao-pay-sub">{t(pm.subKey)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {payMode === "online" && (
                  <>
                    <div className="ao-ssl-notice">
                      🔒 {t("avocatOnboarding.payment.ssl", "Connexion sécurisée SSL 256-bit")}
                    </div>
                    <div className="ao-credit-card">
                      <div className="ao-credit-card__glow" />
                      <div className="ao-credit-card__chip">
                        <div className="ao-credit-card__chip-inner" />
                      </div>
                      <div className="ao-credit-card__number">{displayCardNumber}</div>
                      <div className="ao-credit-card__bottom">
                        <div>
                          <div className="ao-credit-card__label">TITULAIRE</div>
                          <div className="ao-credit-card__value">
                            {cardHolder.trim().toUpperCase() || "VOTRE NOM"}
                          </div>
                        </div>
                        <div>
                          <div className="ao-credit-card__label">EXPIRE</div>
                          <div className="ao-credit-card__value">{cardExpiry || "MM/AA"}</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="ao-label">{t("avocatOnboarding.payment.cardNumber", "NUMÉRO DE CARTE")}</label>
                      <input
                        className="ao-input"
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        maxLength={19}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                          setCardNumber(raw.replace(/(.{4})/g, "$1 ").trim());
                        }}
                      />
                    </div>
                    <div>
                      <label className="ao-label">{t("avocatOnboarding.payment.cardHolder", "NOM DU TITULAIRE")}</label>
                      <input
                        className="ao-input"
                        placeholder="PRÉNOM NOM"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="ao-grid2">
                      <div>
                        <label className="ao-label">{t("avocatOnboarding.payment.cardExpiry", "DATE D'EXPIRATION")}</label>
                        <input
                          className="ao-input"
                          placeholder="MM/AA"
                          value={cardExpiry}
                          maxLength={5}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                            setCardExpiry(v);
                          }}
                        />
                      </div>
                      <div>
                        <label className="ao-label">{t("avocatOnboarding.payment.cardCvv", "CODE CVV")}</label>
                        <input
                          className="ao-input"
                          placeholder="•••"
                          value={cardCvv}
                          maxLength={3}
                          type="password"
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        />
                      </div>
                    </div>
                  </>
                )}

                {payMode === "virement" && (
                  <>
                    <div className="ao-info-box">{t("avocatOnboarding.payment.virementInfo")}</div>
                    {[
                      { labelKey: "avocatOnboarding.payment.bank", val: "Banque Zitouna — Sousse" },
                      { labelKey: "avocatOnboarding.payment.holder", val: "Juridika.tn SARL" },
                      { labelKey: "avocatOnboarding.payment.rib", val: "23 006 0100421789 47" },
                      { labelKey: "avocatOnboarding.payment.amount", val: `${planInfo?.price} DT` },
                      { labelKey: "avocatOnboarding.payment.reference", val: payRef },
                    ].map(({ labelKey, val }) => (
                      <div key={labelKey} className="ao-virement-row">
                        <span className="ao-virement-key">{t(labelKey)}</span>
                        <div className="ao-virement-val-wrap">
                          <span className="ao-virement-val">{val}</span>
                          <button
                            className="ao-copy-btn"
                            onClick={() => navigator.clipboard.writeText(val)}
                          >
                            {t("avocatOnboarding.action.copy")}
                          </button>
                        </div>
                      </div>
                    ))}
                    <label className="ao-doc-card">
                      <span style={{ fontSize: 22 }}>📎</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "#1e3a5f", fontSize: 14 }}>
                          {t("avocatOnboarding.payment.uploadJustif")}
                        </div>
                        <div style={{ fontSize: 12, color: "#888" }}>
                          {t("avocatOnboarding.payment.uploadFormats")}
                        </div>
                      </div>
                      {justif && <span className="ao-doc-done-name">✓ {justif.name}</span>}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: "none" }}
                        onChange={(e) => setJustif(e.target.files[0])}
                      />
                    </label>
                  </>
                )}
              </div>
            )}

            {/* ════ 9 — Confirmation ════ */}
            {step === 9 && submitted && (
              <div className="ao-form">
                <div className="ao-confirm-center">
                  <div className="ao-confirm-icon">⏳</div>
                  <h2 className="ao-confirm-title">{t("avocatOnboarding.confirm.title")}</h2>
                  <p className="ao-confirm-sub">{t("avocatOnboarding.confirm.sub")}</p>
                </div>
                {[
                  { key: "avocatOnboarding.confirm.step1", done: true },
                  { key: "avocatOnboarding.confirm.step2", done: payMode === "virement" && !!justif },
                  { key: "avocatOnboarding.confirm.step3", done: false },
                  { key: "avocatOnboarding.confirm.step4", done: false },
                ].map(({ key, done }) => (
                  <div key={key} className="ao-confirm-step">
                    <div className={`ao-confirm-dot${done ? " ao-confirm-dot--done" : " ao-confirm-dot--pending"}`}>
                      {done ? "✓" : "—"}
                    </div>
                    <span className={done ? "ao-confirm-step-label--done" : "ao-confirm-step-label--pending"}>
                      {t(key)}
                    </span>
                  </div>
                ))}
                <div className="ao-info-box ao-info-box--blue">
                  ⏱ {t("avocatOnboarding.confirm.timeline")}
                </div>
                <div className="ao-info-box">
                  📧 {t("avocatOnboarding.confirm.emailNote", { email: s1.email })}
                </div>
                <div className="ao-invoice">
                  <div className="ao-invoice-header">
                    <div className="ao-invoice-brand">Juridika.tn</div>
                    <div className="ao-invoice-ref">
                      <div className="ao-invoice-ref-num">INV-2026-03-3056</div>
                      <div className="ao-invoice-date">08 mars 2026</div>
                      <div className="ao-invoice-pending-badge">{t("avocatOnboarding.confirm.pending")}</div>
                    </div>
                  </div>
                  <div className="ao-invoice-address">
                    Pura Solutions SARL · Sousse Sahloul · contact@juridika.tn
                  </div>
                  <div className="ao-invoice-parties">
                    <div>
                      <div className="ao-invoice-party-label">{t("avocatOnboarding.invoice.emitter")}</div>
                      <div className="ao-invoice-party-name">Juridika.tn SARL</div>
                      <div className="ao-invoice-party-detail">Sousse Sahloul, Pôle Technologique</div>
                      <div className="ao-invoice-party-detail">MF : 1234567/A</div>
                    </div>
                    <div>
                      <div className="ao-invoice-party-label">{t("avocatOnboarding.invoice.client")}</div>
                      <div className="ao-invoice-party-name">Me. {s1.firstName} {s1.lastName}</div>
                      <div className="ao-invoice-party-detail">{s1.email}</div>
                    </div>
                  </div>
                  <div className="ao-invoice-lines">
                    <div className="ao-invoice-col-heads">
                      <span>{t("avocatOnboarding.invoice.desc")}</span>
                      <span>{t("avocatOnboarding.invoice.period")}</span>
                      <span>{t("avocatOnboarding.invoice.amount")}</span>
                    </div>
                    <div className="ao-invoice-line">
                      <span>{t("avocatOnboarding.invoice.line", { plan: planInfo?.label })}</span>
                      <span className="ao-invoice-line-period">08/03/2026 · 12 mois</span>
                      <span className="ao-invoice-line-amount">{planInfo?.price} DT</span>
                    </div>
                    <div className="ao-invoice-totals">
                      <div className="ao-invoice-subtotal">
                        {t("avocatOnboarding.invoice.subtotal")} : {planInfo?.price} DT
                      </div>
                      <div className="ao-invoice-subtotal">TVA 0% : 0 DT</div>
                      <div className="ao-invoice-total">
                        {t("avocatOnboarding.invoice.totalttc")} : {planInfo?.price} DT
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className="ao-restart-btn"
                  onClick={() => {
                    setStep(1);
                    setSubmitted(false);
                    setOtp(["", "", "", "", "", ""]);
                  }}
                >
                  ↺ {t("avocatOnboarding.action.restartDemo")}
                </button>
              </div>
            )}

          </div>{/* /cardBody */}

          {/* ── Footer ── */}
          <div className="ao-card-footer">
            {step > 1 && !(step === 9 && submitted)
              ? (
                <button className="ao-back-btn" onClick={back}>
                  ← {t("avocatOnboarding.action.back")}
                </button>
              )
              : (
                <div className="ao-footer-free">
                  {step === 1 ? t("avocatOnboarding.footer.free") : ""}
                </div>
              )
            }
            <div className="ao-footer-right">
              {step === 4 && (
                <span className="ao-footer-doc-count">
                  {Object.values(docs).filter(Boolean).length}/5 {t("avocatOnboarding.docs.label")}
                </span>
              )}
              {step === 7 && (
                <span className="ao-footer-saved">{t("avocatOnboarding.preview.saved")}</span>
              )}
              {!(step === 9 && submitted) && (
                <Btn
                  loading={loading}
                  onClick={resolveAction(step, {
                    handleStep1, handleVerifyOtp, handleStep3, handleStep4,
                    handlePhotoUpload, handleApprovePhoto, handleStep6,
                    next, handleStep8, handleSubmit, photo, photoPreview,
                  })}
                >
                  {step === 9
                    ? `Payer ${planInfo?.price ?? ""} DT →`
                    : resolveLabel(step, { t, selectedPlan, photo, photoPreview })
                  }
                </Btn>
              )}
              {step === 9 && submitted && (
                <Btn loading={false} onClick={() => {
                  alert(t("avocatOnboarding.action.alertcreateaccount"));
                  navigate("/login");
                }}>
                  ✅ {t("avocatOnboarding.action.confirm")}
                </Btn>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}