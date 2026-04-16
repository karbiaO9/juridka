import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import OtpInput from "../../../components/OtpInput";
import MapPicker from "../../../components/MapPicker";
import {
  API, ONAT_REGEX, DAYS_KEYS, HOURS, GOUVERNORATS, REQUIRED_DOCS,
  getIcon, resolveLabel, resolveAction,
  buildFoundingPlans, buildSpecialties, buildLanguages,
} from "./helpers";
import "./FoundingOnboarding.css";

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;

export default function FoundingOnboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state: prefill } = useLocation();

  const SPECIALTIES = buildSpecialties(t);
  const LANGUAGES   = buildLanguages(t);
  const PLANS       = buildFoundingPlans(t);

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep]       = useState(1);
  const [token, setToken]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Step 1 — account (pre-filled from RegistrationForm if available)
  const prefillPhone = (prefill?.phone || "").replace(/\D/g, "").slice(-8);
  const [s1, setS1] = useState({
    firstName: prefill?.firstName || "",
    lastName:  prefill?.lastName  || "",
    email:     prefill?.email     || "",
    phone:     prefillPhone,
    whatsappSame: true,
    whatsapp: "",
    password: "",
    lang: "fr",
  });

  // Step 4 — doc Cloudinary URLs (returned by backend after upload)
  const [docUrls, setDocUrls] = useState(null);

  // Step 5 — photo Cloudinary URLs (returned by backend after upload)
  const [photoUrls, setPhotoUrls] = useState({ original: "", enhanced: "" });

  // Step 2 — OTP
  const [otp, setOtp]         = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [resendCd, setResendCd] = useState(0);

  // Step 3 — identity
  const [s3, setS3] = useState({
    barNumber: "", barRegion: "", graduationYear: "",
    practiceStatus: "", firmName: "", specialties: [], languages: [],
  });

  // Step 4 — docs
  const [docs, setDocs] = useState({
    carteBarreauFront: null, carteBarreauBack: null,
    diplome: null, patente: null, casierJudiciaire: null,
  });

  // Step 5 — photo
  const [photo, setPhoto]             = useState(null);
  const [photoPreview, setPhotoPreview] = useState({ original: "", enhanced: "" });

  // Step 6 — availability + location
  const [slots, setSlots]       = useState({});
  const [emergency, setEmergency] = useState(false);
  const [mapPin, setMapPin]     = useState(null);
  const [location, setLocation] = useState({
    gouvernorat: "", quartier: "", address: "", lat: "", lng: "",
  });

  // Step 7 — plan (pre-filled from RegistrationForm if available)
  const [selectedPlan, setSelectedPlan] = useState(prefill?.plan || "professionnel");

  // Step 8 — submission
  const [submitted, setSubmitted] = useState(false);

  // ── API helpers ────────────────────────────────────────────────────────────

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
      if (!res.ok) throw new Error(data.error || t("avocatOnboarding.error.server", "Erreur serveur"));
      return data;
    } catch (e) {
      if (e.name === "TypeError" || e.message === "Failed to fetch") {
        console.warn("[hardApi] API unreachable:", e.message);
      }
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

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

  const handleStep1 = async () => {
    if (!s1.firstName.trim())   { fail(t("avocatOnboarding.validation.firstName", "Prénom requis")); return; }
    if (!s1.lastName.trim())    { fail(t("avocatOnboarding.validation.lastName", "Nom requis")); return; }
    if (!s1.email.includes("@")) { fail(t("avocatOnboarding.validation.email", "Email invalide")); return; }
    if (!/^\d{8}$/.test(s1.phone)) { fail(t("avocatOnboarding.validation.phone", "Numéro à 8 chiffres requis")); return; }
    if (s1.password.length < 8) { fail(t("avocatOnboarding.validation.password", "Mot de passe trop court")); return; }
    if (!/\d/.test(s1.password)) { fail(t("avocatOnboarding.validation.passwordNum", "Le mot de passe doit contenir un chiffre")); return; }

    let whatsappPhone = null;
    if (s1.whatsappSame) {
      whatsappPhone = `+216${s1.phone}`;
    } else if (s1.whatsapp.trim()) {
      whatsappPhone = `+216${s1.whatsapp.trim()}`;
    }

    try {
      await hardApi("/register/step1", "POST", {
        firstName: s1.firstName.trim(),
        lastName:  s1.lastName.trim(),
        email:     s1.email.trim(),
        phone:     `+216${s1.phone}`,
        sameWhatsapp: s1.whatsappSame,
        whatsappPhone,
        password:  s1.password,
        languagePreference: s1.lang,
      });
      next();
    } catch (_) {}
  };

  const handleVerifyOtp = async (code) => {
    const otpCode = typeof code === "string" ? code : otp.join("");
    if (otpCode.length !== 6) {
      setOtpError(t("avocatOnboarding.validation.otp", "Code OTP à 6 chiffres"));
      return;
    }
    const emailToSend = s1.email.trim().toLowerCase();
    if (!emailToSend) {
      setOtpError("Email manquant — veuillez recommencer depuis l'étape 1");
      setStep(1);
      return;
    }
    try {
      const data = await hardApi("/verify-email", "POST", { email: emailToSend, otp: otpCode.trim() });
      setToken(data.token || "DEMO-TOKEN");
      next();
    } catch (err) {
      setOtpError(err?.message || t("avocatOnboarding.validation.otp", "Code incorrect"));
      setOtp(Array(6).fill(""));
    }
  };

  const handleResendOtp = async () => {
    try {
      await hardApi("/resend-otp", "POST", { email: s1.email.trim().toLowerCase() });
      setOtpError("");
      setResendCd(60);
      const interval = setInterval(() => {
        setResendCd((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setOtpError(err.message || "Erreur lors du renvoi");
    }
  };

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

  const handleStep3 = () => {
    if (!s3.barNumber.trim())   { fail(t("avocatOnboarding.validation.barNumber", "Numéro de barreau requis")); return; }
    if (!ONAT_REGEX.test(s3.barNumber.trim())) { fail(t("avocatOnboarding.validation.barNumberFormat", "Format invalide (ex: TN-2015-1234)")); return; }
    if (!s3.barRegion)          { fail(t("avocatOnboarding.validation.university", "Barreau requis")); return; }
    if (!s3.graduationYear)     { fail(t("avocatOnboarding.validation.graduationYear", "Année de diplôme requise")); return; }
    if (!s3.practiceStatus)     { fail(t("avocatOnboarding.validation.practiceStatus", "Statut d'exercice requis")); return; }
    if (s3.specialties.length === 0) { fail(t("avocatOnboarding.validation.specialties", "Au moins une spécialité requise")); return; }
    next();
  };

  const handleStep4 = async () => {
    const missing = REQUIRED_DOCS.filter((k) => !docs[k]);
    if (missing.length > 0) {
      fail(t("avocatOnboarding.validation.docs", { count: missing.length, defaultValue: `${missing.length} document(s) manquant(s)` }));
      return;
    }
    setLoading(true);
    const fd = new FormData();
    REQUIRED_DOCS.forEach((k) => { if (docs[k]) fd.append(k, docs[k]); });
    const data = await softApi("/register/docs", "POST", fd, true);
    setLoading(false);
    if (data.urls) setDocUrls(data.urls);
    next();
  };

  const handlePhotoUpload = async () => {
    if (!photo) { fail(t("avocatOnboarding.validation.photo", "Veuillez sélectionner une photo")); return; }
    setLoading(true);
    const fd = new FormData();
    fd.append("photo", photo);
    const data = await softApi("/register/photo", "POST", fd, true);
    setLoading(false);
    const orig = data.original || URL.createObjectURL(photo);
    const enh  = data.enhanced || orig;
    setPhotoPreview({ original: orig, enhanced: enh });
    setPhotoUrls({ original: data.original || "", enhanced: data.enhanced || "" });
  };

  const handleApprovePhoto = async () => {
    // Approval is local — photo URLs already stored from upload step
    next();
  };

  const toggleSlot = (day, hour) => {
    const key = `${day}-${hour}`;
    setSlots((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleStep6 = () => {
    if (!location.gouvernorat) { fail(t("avocatOnboarding.validation.wilaya", "Gouvernorat requis")); return; }
    if (!location.address)     { fail(t("avocatOnboarding.validation.address", "Adresse requise")); return; }
    if (!mapPin)               { fail("Veuillez épingler votre cabinet sur la carte"); return; }
    next();
  };

  const handleStep7 = () => next();

  const handleSubmit = async () => {
    setLoading(true);
    const slotList = Object.entries(slots)
      .filter(([, active]) => active)
      .map(([key]) => { const [day, time] = key.split("-"); return { day, time }; });

    const data = await softApi("/register/submit", "POST", {
      // Step 3
      barNumber:       s3.barNumber.trim(),
      barRegion:       s3.barRegion,
      graduationYear:  Number(s3.graduationYear),
      practiceStatus:  s3.practiceStatus,
      firmName:        s3.firmName || "",
      specialties:     s3.specialties,
      spokenLanguages: s3.languages,
      // Step 4 — Cloudinary URLs
      docUrls,
      // Step 5 — Cloudinary URLs
      photoOriginal: photoUrls.original,
      photoEnhanced: photoUrls.enhanced,
      // Step 6
      slots:            slotList,
      emergencyEnabled: emergency,
      gouvernorat:      location.gouvernorat,
      quartier:         location.quartier || "",
      address:          location.address,
      lat:              mapPin?.lat?.toString() || "",
      lng:              mapPin?.lng?.toString() || "",
      // Step 7
      plan: selectedPlan,
    });
    setLoading(false);
    if (data.reference || data.message) setSubmitted(true);
    else fail(data.error || "Erreur lors de la soumission");
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const planInfo = PLANS.find((p) => p.id === selectedPlan);

  // ── Step title/sub (fr fallbacks) ──────────────────────────────────────────
  const STEP_META = [
    { title: t("fo.step1.title", "Créez votre compte"),        sub: t("fo.step1.sub", "Informations de base et mot de passe") },
    { title: t("fo.step2.title", "Vérification email"),        sub: t("fo.step2.sub", "Entrez le code à 6 chiffres reçu par email") },
    { title: t("fo.step3.title", "Identité professionnelle"),  sub: t("fo.step3.sub", "Numéro ONAT, spécialités et statut d'exercice") },
    { title: t("fo.step4.title", "Documents professionnels"),  sub: t("fo.step4.sub", "Carte de barreau, diplôme, patente, casier judiciaire") },
    { title: t("fo.step5.title", "Photo professionnelle"),     sub: t("fo.step5.sub", "Votre photo visible sur votre profil public") },
    { title: t("fo.step6.title", "Disponibilités & Cabinet"),  sub: t("fo.step6.sub", "Horaires de consultation et localisation de votre cabinet") },
    { title: t("fo.step7.title", "Offre Fondateur"),           sub: t("fo.step7.sub", "Choisissez votre plan — tarif gelé à vie, −30%") },
    { title: t("fo.step8.title", "Soumettre mon dossier"),     sub: t("fo.step8.sub", "Récapitulatif avant envoi — aucun paiement maintenant") },
  ];

  const meta = STEP_META[step - 1] || {};

  const handlers = {
    handleStep1, handleVerifyOtp, handleStep3, handleStep4,
    handlePhotoUpload, handleApprovePhoto, handleStep6,
    handleStep7, handleSubmit, next, photo, photoPreview,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fo-page">

      {/* Progress bubbles */}
      <div className="ao-nav-steps">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={[
              "ao-bubble",
              step === n ? "ao-bubble--active" : "",
              step > n  ? "ao-bubble--done"   : "",
            ].join(" ")}
          >
            {step > n ? "✓" : n}
          </div>
        ))}
      </div>

      <div className="ao-container">
        <div className="ao-card">

          {/* Card header */}
          {!(step === 8 && submitted) && (
            <div className="ao-card-header">
              <div>
                <div className="fo-founder-badge">
                  ⭐ {t("fo.badge", "Membre Fondateur")}
                </div>
                <div className="ao-step-tag">
                  {t("avocatOnboarding.step.label", { current: step, total: TOTAL_STEPS, defaultValue: `Étape ${step} / ${TOTAL_STEPS}` })}
                </div>
                <h1 className="ao-card-title">{meta.title}</h1>
                <p className="ao-card-sub">{meta.sub}</p>
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
                    label={t("avocatOnboarding.field.firstName", "Prénom")}
                    value={s1.firstName}
                    onChange={(v) => setS1((p) => ({ ...p, firstName: v }))}
                    placeholder={t("avocatOnboarding.ph.firstName", "Sarra")}
                  />
                  <Field
                    label={t("avocatOnboarding.field.lastName", "Nom")}
                    value={s1.lastName}
                    onChange={(v) => setS1((p) => ({ ...p, lastName: v }))}
                    placeholder={t("avocatOnboarding.ph.lastName", "Ben Salah")}
                  />
                </div>
                <Field
                  label={t("avocatOnboarding.field.email", "Email professionnel")}
                  value={s1.email}
                  type="email"
                  onChange={(v) => setS1((p) => ({ ...p, email: v }))}
                  placeholder={t("avocatOnboarding.ph.email", "sarra@cabinet.tn")}
                />

                {/* Phone */}
                <div>
                  <label className="ao-label">{t("avocatOnboarding.field.phone", "Téléphone")}</label>
                  <div className="ao-phone-wrap">
                    <span className="ao-phone-prefix">+216</span>
                    <input
                      className="ao-input ao-input--phone"
                      type="tel"
                      value={s1.phone}
                      maxLength={8}
                      onChange={(e) => setS1((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                      placeholder="XX XXX XXX"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="ao-label">{t("avocatOnboarding.field.whatsapp", "WhatsApp")}</label>
                  <label className="ao-checkbox-row">
                    <input
                      type="checkbox"
                      checked={s1.whatsappSame}
                      onChange={(e) => setS1((p) => ({ ...p, whatsappSame: e.target.checked }))}
                    />
                    <span>{t("avocatOnboarding.ph.whatsappSame", "Même numéro que téléphone")}</span>
                  </label>
                  {!s1.whatsappSame && (
                    <div className="ao-phone-wrap" style={{ marginTop: 8 }}>
                      <span className="ao-phone-prefix">+216</span>
                      <input
                        className="ao-input ao-input--phone"
                        type="tel"
                        value={s1.whatsapp}
                        maxLength={8}
                        onChange={(e) => setS1((p) => ({ ...p, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                        placeholder="XX XXX XXX"
                      />
                    </div>
                  )}
                </div>

                {/* Password */}
                <Field
                  label={t("avocatOnboarding.field.password", "Mot de passe")}
                  value={s1.password}
                  type="password"
                  onChange={(v) => setS1((p) => ({ ...p, password: v }))}
                  placeholder={t("avocatOnboarding.ph.password", "8+ caractères, 1 chiffre")}
                />

                {/* Language */}
                <div>
                  <label className="ao-label">{t("avocatOnboarding.field.lang", "Langue préférée")}</label>
                  <select
                    className="ao-input"
                    value={s1.lang}
                    onChange={(e) => setS1((p) => ({ ...p, lang: e.target.value }))}
                  >
                    <option value="fr">Français</option>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            )}

            {/* ════ 2 — OTP ════ */}
            {step === 2 && (
              <div className="ao-form">
                <div className="ao-otp-desc">
                  {t("avocatOnboarding.otp.desc", { email: s1.email, defaultValue: `Un code a été envoyé à ${s1.email}` })}
                </div>
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleVerifyOtp}
                />
                {otpError && <div className="ao-otp-error">{otpError}</div>}
                <div className="ao-otp-resend">
                  {resendCd > 0 ? (
                    <span className="ao-otp-resend-cd">
                      {t("avocatOnboarding.otp.resendIn", { sec: resendCd, defaultValue: `Renvoyer dans ${resendCd}s` })}
                    </span>
                  ) : (
                    <button className="ao-link-btn" onClick={handleResendOtp}>
                      {t("avocatOnboarding.otp.resend", "Renvoyer le code")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ════ 3 — Identité professionnelle ════ */}
            {step === 3 && (
              <div className="ao-form">
                <div className="ao-grid2">
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.barNumber", "Numéro ONAT")}</label>
                    <input
                      className="ao-input"
                      value={s3.barNumber}
                      onChange={(e) => setS3((p) => ({ ...p, barNumber: e.target.value.toUpperCase() }))}
                      placeholder="TN-2015-1234"
                    />
                  </div>
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.barRegion", "Barreau")}</label>
                    <select
                      className="ao-input"
                      value={s3.barRegion}
                      onChange={(e) => setS3((p) => ({ ...p, barRegion: e.target.value }))}
                    >
                      <option value="">{t("avocatOnboarding.ph.select", "— Sélectionner —")}</option>
                      {GOUVERNORATS.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ao-grid2">
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.graduationYear", "Année d'obtention")}</label>
                    <input
                      className="ao-input"
                      type="number"
                      min="1970"
                      max={new Date().getFullYear()}
                      value={s3.graduationYear}
                      onChange={(e) => setS3((p) => ({ ...p, graduationYear: e.target.value }))}
                      placeholder="2015"
                    />
                  </div>
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.practiceStatus", "Statut d'exercice")}</label>
                    <select
                      className="ao-input"
                      value={s3.practiceStatus}
                      onChange={(e) => setS3((p) => ({ ...p, practiceStatus: e.target.value }))}
                    >
                      <option value="">{t("avocatOnboarding.ph.select", "— Sélectionner —")}</option>
                      <option value="independant">{t("avocatOnboarding.status.independant", "Indépendant")}</option>
                      <option value="associated">{t("avocatOnboarding.status.associated", "Associé")}</option>
                      <option value="member">{t("avocatOnboarding.status.member", "Membre de cabinet")}</option>
                    </select>
                  </div>
                </div>

                <Field
                  label={t("avocatOnboarding.field.firmName", "Nom du cabinet (optionnel)")}
                  value={s3.firmName}
                  onChange={(v) => setS3((p) => ({ ...p, firmName: v }))}
                  placeholder={t("avocatOnboarding.ph.firmName", "Cabinet Ben Salah & Associés")}
                />

                {/* Specialties */}
                <div>
                  <label className="ao-label">
                    {t("avocatOnboarding.field.specialties", "Spécialités")}
                    <span className="ao-label-hint"> (max 3)</span>
                  </label>
                  <div className="ao-tags">
                    {SPECIALTIES.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => toggleSpecialty(sp)}
                        className={`ao-tag${s3.specialties.includes(sp) ? " ao-tag--on" : ""}`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Languages */}
                <div>
                  <label className="ao-label">{t("avocatOnboarding.field.languages", "Langues parlées")}</label>
                  <div className="ao-tags">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        type="button"
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
                <div className="ao-info-box">
                  📋 {t("avocatOnboarding.docs.info", "Formats acceptés : PDF, JPG, PNG · Max 10 Mo par fichier")}
                </div>
                {REQUIRED_DOCS.map((key) => {
                  const labels = {
                    carteBarreauFront: t("avocatOnboarding.docs.carteFront", "Carte de barreau (recto)"),
                    carteBarreauBack:  t("avocatOnboarding.docs.carteBack",  "Carte de barreau (verso)"),
                    diplome:           t("avocatOnboarding.docs.diplome",     "Diplôme d'avocat"),
                    patente:           t("avocatOnboarding.docs.patente",     "Patente ONAT"),
                    casierJudiciaire:  t("avocatOnboarding.docs.casier",      "Casier judiciaire"),
                  };
                  const file = docs[key];
                  return (
                    <label key={key} className="ao-doc-card">
                      <span style={{ fontSize: 22 }}>
                        {key.startsWith("carte") ? "🪪" : key === "diplome" ? "🎓" : key === "patente" ? "📋" : "📑"}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "#1e3a5f", fontSize: 14 }}>{labels[key]}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>PDF · JPG · PNG</div>
                      </div>
                      {file
                        ? <span className="ao-doc-done-name">✓ {file.name}</span>
                        : <span className="ao-doc-placeholder">{t("avocatOnboarding.docs.choose", "Choisir")}</span>
                      }
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: "none" }}
                        onChange={(e) => setDocs((p) => ({ ...p, [key]: e.target.files[0] || null }))}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {/* ════ 5 — Photo ════ */}
            {step === 5 && (
              <div className="ao-form">
                <div className="ao-info-box">
                  📷 {t("avocatOnboarding.photo.info", "Photo professionnelle : fond neutre, visage dégagé")}
                </div>
                <label className="ao-photo-drop">
                  {photo
                    ? <span style={{ fontSize: 14, color: "#1e3a5f", fontWeight: 600 }}>✓ {photo.name}</span>
                    : <>
                        <span style={{ fontSize: 32 }}>📷</span>
                        <span style={{ fontSize: 14, color: "#888" }}>{t("avocatOnboarding.photo.choose", "Cliquez pour choisir une photo")}</span>
                      </>
                  }
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      setPhoto(e.target.files[0] || null);
                      setPhotoPreview({ original: "", enhanced: "" });
                    }}
                  />
                </label>

                {photoPreview.original && (
                  <div className="ao-photo-compare">
                    <div className="ao-photo-col">
                      <div className="ao-photo-col-label">{t("avocatOnboarding.photo.original", "Original")}</div>
                      <img className="ao-photo-img" src={photoPreview.original} alt="original" />
                    </div>
                    <div className="ao-photo-col">
                      <div className="ao-photo-col-label">{t("avocatOnboarding.photo.enhanced", "Améliorée")}</div>
                      <img className="ao-photo-img" src={photoPreview.enhanced || photoPreview.original} alt="enhanced" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ 6 — Disponibilités & Cabinet ════ */}
            {step === 6 && (
              <div className="ao-form">
                <h3 className="ao-section-title">{t("avocatOnboarding.avail.title", "Horaires de consultation")}</h3>

                {/* Availability grid */}
                <div className="ao-avail-grid">
                  <div className="ao-avail-header-row">
                    <div className="ao-avail-corner" />
                    {HOURS.map((h) => (
                      <div key={h} className="ao-avail-hour">{h}</div>
                    ))}
                  </div>
                  {DAYS_KEYS.map((d) => (
                    <div key={d} className="ao-avail-row">
                      <div className="ao-avail-day-label">{t(`avocatOnboarding.day.${d}`, d)}</div>
                      {HOURS.map((h) => {
                        const key = `${d}-${h}`;
                        return (
                          <div
                            key={key}
                            className={`ao-avail-cell${slots[key] ? " ao-avail-cell--on" : ""}`}
                            onClick={() => toggleSlot(d, h)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Emergency toggle */}
                <div className="ao-emergency-box">
                  <div className="ao-emergency-header">
                    <div>
                      <div className="ao-emergency-title">🚨 {t("avocatOnboarding.avail.emergency", "Urgences 24/7")}</div>
                      <div className="ao-emergency-sub">{t("avocatOnboarding.avail.emergencySub", "Disponible pour les urgences hors horaires")}</div>
                    </div>
                    <div
                      className={`ao-toggle${emergency ? " ao-toggle--on" : " ao-toggle--off"}`}
                      onClick={() => setEmergency((p) => !p)}
                    >
                      <div className={`ao-toggle-dot${emergency ? " ao-toggle-dot--on" : ""}`} />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <h3 className="ao-section-title">{t("avocatOnboarding.avail.locationTitle", "Localisation du cabinet")}</h3>
                <div className="ao-grid2">
                  <div>
                    <label className="ao-label">{t("avocatOnboarding.field.wilaya", "Gouvernorat")}</label>
                    <select
                      className="ao-input"
                      value={location.gouvernorat}
                      onChange={(e) => setLocation((p) => ({ ...p, gouvernorat: e.target.value }))}
                    >
                      <option value="">{t("avocatOnboarding.ph.select", "— Sélectionner —")}</option>
                      {GOUVERNORATS.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <Field
                    label={t("avocatOnboarding.field.quartier", "Quartier")}
                    value={location.quartier}
                    onChange={(v) => setLocation((p) => ({ ...p, quartier: v }))}
                    placeholder={t("avocatOnboarding.ph.quartier", "Quartier Lafayette")}
                  />
                </div>
                <Field
                  label={t("avocatOnboarding.field.address", "Adresse complète")}
                  value={location.address}
                  onChange={(v) => setLocation((p) => ({ ...p, address: v }))}
                  placeholder={t("avocatOnboarding.ph.address", "12 Rue de la République")}
                />
                <div className="ao-grid2">
                  <MapPicker
                    pin={mapPin}
                    onPin={(p) => {
                      setMapPin(p);
                      if (p) setLocation((prev) => ({ ...prev, lat: p.lat.toString(), lng: p.lng.toString() }));
                      else   setLocation((prev) => ({ ...prev, lat: "", lng: "" }));
                    }}
                    onSearch={(address) => setLocation((prev) => ({ ...prev, address }))}
                  />
                </div>
              </div>
            )}

            {/* ════ 7 — Plan Fondateur ════ */}
            {step === 7 && (
              <div className="ao-form">
                <p className="ao-plans-intro">
                  {t("fo.plans.intro", "Votre tarif est gelé à vie — −30% garanti par contrat. Aucun paiement maintenant.")}
                </p>
                <div className="fo-plans-grid">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={[
                        "fo-plan-card",
                        selectedPlan === plan.id ? "fo-plan-card--active" : "",
                        plan.highlight ? "fo-plan-card--highlight" : "",
                      ].join(" ")}
                    >
                      {plan.badge && <div className="fo-plan-badge">{plan.badge}</div>}
                      {selectedPlan === plan.id && <div className="fo-plan-check">✓</div>}
                      <div className="fo-plan-label">{plan.label}</div>
                      <div className="fo-plan-price">
                        {plan.price.toLocaleString()}
                        <span className="fo-plan-price-unit"> DT/an</span>
                      </div>
                      <div className="fo-plan-monthly">{plan.monthly}</div>
                      <div className="fo-plan-discount">
                        {t("pricing.discount", "−30% fondateur")}
                      </div>
                      {plan.features?.map((f) => (
                        <div key={f} className="fo-plan-feature">{f}</div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="ao-info-box ao-info-box--green" style={{ marginTop: 16 }}>
                  🔒 {t("fo.plans.guarantee", "Tarif garanti contractuellement — aucune augmentation tant que votre abonnement est actif")}
                </div>
              </div>
            )}

            {/* ════ 8 — Submit ════ */}
            {step === 8 && !submitted && (
              <div className="ao-form">
                {/* No payment notice */}
                <div className="fo-no-payment">
                  ✅ {t("fo.submit.noPayment", "Aucun paiement maintenant — votre tarif fondateur sera activé uniquement au lancement de la plateforme.")}
                </div>

                {/* Summary */}
                <div className="fo-submit-box">
                  <div className="fo-submit-box-title">{t("fo.submit.summary", "Récapitulatif de votre dossier")}</div>
                  {[
                    { label: t("fo.submit.name", "Nom complet"),    val: `Me. ${s1.firstName} ${s1.lastName}` },
                    { label: t("fo.submit.email", "Email"),          val: s1.email },
                    { label: t("fo.submit.barreau", "Barreau"),      val: s3.barRegion || "—" },
                    { label: t("fo.submit.specialties", "Spécialités"), val: s3.specialties.join(", ") || "—" },
                    { label: t("fo.submit.plan", "Plan choisi"),     val: planInfo?.label || "—" },
                    { label: t("fo.submit.price", "Tarif fondateur"), val: planInfo ? `${planInfo.price.toLocaleString()} DT/an` : "—" },
                  ].map(({ label, val }) => (
                    <div key={label} className="fo-submit-row">
                      <span className="fo-submit-row-label">{label}</span>
                      <span className="fo-submit-row-val">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Checklist */}
                <div className="ao-info-box">
                  📄 {t("fo.submit.docsNote", "Vos documents seront vérifiés par notre équipe dans les 48h ouvrables.")}
                </div>
                <div className="ao-info-box ao-info-box--blue">
                  📧 {t("fo.submit.emailNote", "Un email de confirmation vous sera envoyé dès validation de votre dossier.")}
                </div>
              </div>
            )}

            {/* ════ 8 — Confirmation ════ */}
            {step === 8 && submitted && (
              <div className="ao-form">
                <div className="fo-success-center">
                  <div className="fo-success-icon">🎉</div>
                  <h2 className="fo-success-title">{t("fo.confirm.title", "Dossier soumis avec succès !")}</h2>
                  <p className="fo-success-sub">
                    {t("fo.confirm.sub", "Votre dossier est en cours de vérification. Vous recevrez votre confirmation par email sous 48h.")}
                  </p>
                </div>

                <div className="fo-number-badge">
                  <div className="fo-number-badge__label">{t("fo.confirm.numberLabel", "VOTRE NUMÉRO FONDATEUR")}</div>
                  <div className="fo-number-badge__num">#{t("fo.confirm.numberPending", "????")}</div>
                  <div className="fo-number-badge__desc">{t("fo.confirm.numberDesc", "Attribué après validation du dossier")}</div>
                </div>

                <div className="fo-success-steps">
                  {[
                    { label: t("fo.confirm.step1", "Dossier reçu et enregistré"), done: true },
                    { label: t("fo.confirm.step2", "Vérification documents ONAT — 48h ouvrables"), done: false },
                    { label: t("fo.confirm.step3", "Attribution du numéro fondateur"), done: false },
                    { label: t("fo.confirm.step4", "Activation du compte au lancement"), done: false },
                  ].map(({ label, done }) => (
                    <div key={label} className="fo-success-step">
                      <div className={`fo-success-dot ${done ? "fo-success-dot--done" : "fo-success-dot--pending"}`}>
                        {done ? "✓" : "—"}
                      </div>
                      <span style={{ color: done ? "#166534" : "#92400e" }}>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="fo-no-payment" style={{ marginTop: 16 }}>
                  🔒 {t("fo.confirm.noPaymentNote", "Aucun paiement n'est requis maintenant. Votre tarif fondateur sera activé uniquement au lancement officiel de Juridika.tn.")}
                </div>

                <button
                  className="ao-restart-btn"
                  style={{ marginTop: 16 }}
                  onClick={() => navigate("/foundingMembers")}
                >
                  ← {t("fo.confirm.backHome", "Retour à la page fondateurs")}
                </button>
              </div>
            )}

          </div>{/* /cardBody */}

          {/* ── Footer ── */}
          <div className="ao-card-footer">
            {step > 1 && !(step === 8 && submitted) ? (
              <button className="ao-back-btn" onClick={back}>
                ← {t("avocatOnboarding.action.back", "Retour")}
              </button>
            ) : (
              <div className="ao-footer-free">
                {step === 1 ? t("fo.footer.free", "Inscription gratuite · Aucun paiement") : ""}
              </div>
            )}

            <div className="ao-footer-right">
              {step === 4 && (
                <span className="ao-footer-doc-count">
                  {Object.values(docs).filter(Boolean).length}/5 {t("avocatOnboarding.docs.label", "documents")}
                </span>
              )}
              {!(step === 8 && submitted) && (
                <Btn onClick={resolveAction(step, handlers)} loading={loading}>
                  {resolveLabel(step, { t, photo, photoPreview })}
                </Btn>
              )}
            </div>
          </div>

        </div>{/* /card */}
      </div>{/* /container */}
    </div>
  );
}
