import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "./ClientOnboading.css";
import OtpInput from "../../components/OtpInput";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = `${process.env.REACT_APP_API_URL}/api/auth/client`;
const API_AVOCATS = `${process.env.REACT_APP_API_URL}/api/auth/avocats`;
const API_AVOCAT = `${process.env.REACT_APP_API_URL}/api/auth/avocat`;
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error(`Erreur serveur (${res.status}) — backend introuvable sur ${API_BASE}`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GOVERNORATE_KEYS = [
  "ariana", "beja", "ben_arous", "bizerte", "gabes", "gafsa", "jendouba", "kairouan",
  "kasserine", "kebili", "kef", "mahdia", "manouba", "medenine", "monastir", "nabeul",
  "sfax", "sidi_bouzid", "siliana", "sousse", "tataouine", "tozeur", "tunis", "zaghouan",
];
const LEGAL_TYPE_KEYS = ["family", "criminal", "labor", "real_estate", "commercial", "immigration", "corporate", "other"];
const LEGAL_TYPE_EMOJIS = ["👨‍👩‍👧", "⚖️", "💼", "🏠", "📊", "✈️", "🏢", "📌"];
const ID_TYPE_KEYS = ["cin", "passport", "residence_permit"];
const ID_TYPE_EMOJIS = ["🪪", "📘", "📄"];
const URGENCY_KEYS = ["flexible", "soon", "urgent"];
const URGENCY_EMOJIS = ["📅", "⏰", "🚨"];
const FILTER_KEYS = ["family", "criminal", "labor", "commercial", "immigration", "french", "arabic", "english", "in_person", "video", "phone"];
const SLOT_KEYS_URGENT = ["slot_30min", "slot_1h", "slot_2h"];

const DAY_NAME_TO_JS = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function getAvailableDaysFromSlots(year, month, slots = []) {
  const dayIndices = [...new Set(slots.map(s => DAY_NAME_TO_JS[s.day]).filter(d => d !== undefined))];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const available = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (dayIndices.includes(new Date(year, month, d).getDay())) available.push(d);
  }
  return available;
}

function getSlotsForDay(year, month, day, slots = []) {
  const jsDay = new Date(year, month, day).getDay();
  return slots.filter(s => DAY_NAME_TO_JS[s.day] === jsDay).map(s => s.time);
}

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1).getDay();
  const daysInM = new Date(year, month + 1, 0).getDate();
  const offset = (first + 6) % 7;
  const days = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let d = 1; d <= daysInM; d++) days.push(d);
  return days;
}

const TOTAL = 7;
const STEP_ICONS = ["👤", "🪪", "⚖️", "🔍", "🚨", "📋", "✅"];

const getInitials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");

const getAvailability = (a) =>
  a.status === "active" || a.isVerified === true || a.verified === true;

const getLangs = (a) => {
  if (a.spokenLanguages?.length) return a.spokenLanguages;
  if (a.langues?.length) return a.langues;
  const map = { fr: "Français", ar: "Arabe", en: "Anglais" };
  return a.languagePreference ? [map[a.languagePreference] || a.languagePreference] : [];
};

const is24_7 = (a) => a.availability?.emergency?.enabled === true;

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function ClientOnboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [f1, setF1] = useState({ prenom: "", nom: "", email: "", phone: "", langue: "Français", pwd: "", confirm: "" });
  const [e1, setE1] = useState({});

  // OTP
  const [pendingId, setPendingId] = useState(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpStep, setOtpStep] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false); // ← état séparé pour OTP
  const [resendCd, setResendCd] = useState(0);

  // Step 2
  const [idIdx, setIdIdx] = useState(0);
  const [idNum, setIdNum] = useState("");
  const [docFile, setDoc] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [cons, setCons] = useState({ data: false, cgu: false });
  const [e2, setE2] = useState({});

  // Step 3
  const [gov, setGov] = useState("");
  const [legal, setLegal] = useState("");
  const [sit, setSit] = useState("");
  const [urg, setUrg] = useState("");
  const [e3, setE3] = useState({});

  // Step 4
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [lawyers, setLawyers] = useState([]);
  const [lawyersLoad, setLawyersLoad] = useState(false);
  const [lawyersErr, setLawyersErr] = useState("");

  // Step 5
  const [lawyerSlots, setLawyerSlots] = useState([]);
  const [lawyerFormats, setLawyerFormats] = useState([]);
  const [lawyerEmergency, setLawyerEmergency] = useState({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDay, setSelDay] = useState(null);
  const [selTime, setSelTime] = useState(null);

  const [urgentNoAnswer, setUrgentNoAnswer] = useState(false);
  const [urgentSlot, setUrgentSlot] = useState(null);

  // Step 6
  const [consultMode, setConsultMode] = useState(null);
  const [consultNote, setConsultNote] = useState("");

  const next = () => { setError(""); setStep(s => Math.min(s + 1, TOTAL)); };
  const back = () => { setError(""); setStep(s => Math.max(s - 1, 1)); };

  // ── Fetch disponibilités ──────────────────────────────────────────────────
  const fetchLawyerAvailability = async (lawyerId) => {
    setSlotsLoading(true); setSlotsError("");
    setLawyerSlots([]); setSelDay(null); setSelTime(null);
    try {
      const res = await fetch(`${API_AVOCAT}/${lawyerId}/availability`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Réponse invalide du serveur");
      const data = await res.json();
      setLawyerSlots(data.slots || []);
      setLawyerFormats(data.formats || []);
      setLawyerEmergency(data.emergency || {});
    } catch (err) { setSlotsError(err.message); }
    finally { setSlotsLoading(false); }
  };

  useEffect(() => {
    if (chosen?._id && step === 5) fetchLawyerAvailability(chosen._id);
  }, [chosen, step]);

  // ── Validations ───────────────────────────────────────────────────────────
  const validate1 = () => {
    const e = {};
    if (!f1.prenom.trim()) e.prenom = t("error.first_name_required");
    if (!f1.nom.trim()) e.nom = t("error.last_name_required");
    if (!/\S+@\S+\.\S+/.test(f1.email)) e.email = t("error.email_invalid");
    if (!/^\d{8}$/.test(f1.phone)) e.phone = t("error.phone_invalid");
    if (f1.pwd.length < 8) e.pwd = t("error.password_min");
    if (f1.pwd !== f1.confirm) e.confirm = t("error.password_mismatch");
    setE1(e); return !Object.keys(e).length;
  };

  const validate2 = () => {
    const e = {};
    if (!idNum.trim()) e.idNum = t("error.id_number_required");
    else if (ID_TYPE_KEYS[idIdx] === "cin" && !/^\d{8}$/.test(idNum))
      e.idNum = t("error.cin_invalid") || "Le CIN doit contenir exactement 8 chiffres";
    if (!cons.data) e.data = t("error.consent_required");
    if (!cons.cgu) e.cgu = t("error.consent_required");
    setE2(e); return !Object.keys(e).length;
  };

  const validate3 = () => {
    const e = {};
    if (!gov) e.gov = t("error.governorate_required");
    if (!legal) e.legal = t("error.legal_type_required");
    if (!urg) e.urg = t("error.urgency_required");
    setE3(e); return !Object.keys(e).length;
  };

  // ── API calls ─────────────────────────────────────────────────────────────
  const handleSignup = async () => {
    if (!validate1()) return;
    setLoading(true); setError("");
    try {
      const data = await apiFetch("/signup", {
        method: "POST",
        body: JSON.stringify({
          fullName: `${f1.prenom} ${f1.nom}`,
          email: f1.email,
          phone: `+216${f1.phone}`,
          password: f1.pwd,
        }),
      });
      setPendingId(data.pendingId);
      setOtpStep(true);
      startResendCountdown();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ← OTP automatique : reçoit le code depuis onComplete
  const handleVerifyOtp = async (code) => {
    const otpCode = code ?? otp.join("");
    if (otpCode.length !== 6) {
      setOtpError(t("error.otp_required"));
      return;
    }
    setOtpLoading(true); setOtpError("");
    try {
      const data = await apiFetch("/verify-email", {
        method: "POST",
        body: JSON.stringify({ pendingId, otp: otpCode }),
      });
      if (data.token) localStorage.setItem("token", data.token);
      setOtpStep(false);
      next();
    } catch (err) {
      setOtpError(err.message);
      setOtp(Array(6).fill(""));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCd > 0) return;
    setOtpLoading(true);
    try {
      await apiFetch("/resend-otp", { method: "POST", body: JSON.stringify({ pendingId }) });
      setOtp(["", "", "", "", "", ""]); setOtpError(""); startResendCountdown();
    } catch (err) { setOtpError(err.message); }
    finally { setOtpLoading(false); }
  };

  const startResendCountdown = () => {
    setResendCd(60);
    const iv = setInterval(() => {
      setResendCd(c => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSaveIdentity = async () => {
    if (!validate2()) return;
    setLoading(true); setError("");
    try {
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          idType: ID_TYPE_KEYS[idIdx], idNumber: idNum,
          preferredLanguage: f1.langue, consentData: cons.data, consentCgu: cons.cgu,
        }),
      });
      next();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSaveLegalNeed = async () => {
    if (!validate3()) return;
    setLoading(true); setError("");
    try {
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify({ legalNeed: { governorate: gov, legalType: legal, situation: sit, urgency: urg } }),
      });
      next();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleNext = () => {
    setError("");
    if (step === 1) { handleSignup(); return; }
    if (step === 2) { handleSaveIdentity(); return; }
    if (step === 3) { handleSaveLegalNeed(); return; }
    if (step === 4) {
      if (!chosen) { setError(t("error.lawyer_required")); return; }
      next(); return;
    }
    if (step === 5 && urg !== "urgent") {
      if (!selDay || !selTime) { setError(t("error.select_slot")); return; }
      next(); return;
    }
    next();
  };

  const nextLabel = () => {
    if (loading) return t("btn.loading");
    if (step === 1) return t("btn.create_account");
    if (step === 3) return t("btn.search_lawyers");
    if (step === 4) return t("btn.see_availability");
    if (step === 5 && urg !== "urgent") return t("btn.confirm_slot");
    if (step === 6) return t("btn.confirm_appointment");
    if (step === 7) return null;
    return t("btn.continue");
  };

  // ── Fetch avocats ─────────────────────────────────────────────────────────
  const fetchLawyers = async () => {
    setLawyersLoad(true); setLawyersErr("");
    try {
      const res = await fetch(API_AVOCATS);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Réponse invalide du serveur");
      const data = await res.json();
      let list = Array.isArray(data) ? data : (data.avocats || data.data || []);
      if (urg === "urgent") list = list.filter(l => is24_7(l));
      setLawyers(list);
    } catch (err) { setLawyersErr(err.message); }
    finally { setLawyersLoad(false); }
  };

  useEffect(() => { if (step === 4) fetchLawyers(); }, [step]);

  // ── Filtres ───────────────────────────────────────────────────────────────
  const tog = f => setFilters(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);

  const FILTER_MAP = {
    family: l => (l.specialties || []).some(x => /famil|succession|divor/i.test(x)),
    criminal: l => (l.specialties || []).some(x => /pénal|penal|crimin|défense/i.test(x)),
    labor: l => (l.specialties || []).some(x => /travail|labor|licenci/i.test(x)),
    commercial: l => (l.specialties || []).some(x => /commer|sociét|contrat/i.test(x)),
    immigration: l => (l.specialties || []).some(x => /immigr|visa|séjour/i.test(x)),
    french: l => getLangs(l).some(lg => /fran/i.test(lg)),
    arabic: l => getLangs(l).some(lg => /arab/i.test(lg)),
    english: l => getLangs(l).some(lg => /angl|engl/i.test(lg)),
    in_person: l => (l.availability?.formats || []).includes("in_person"),
    video: l => (l.availability?.formats || []).includes("video"),
    phone: l => !!(l.phone),
  };

  const filteredLawyers = lawyers.filter(l => {
    const name = (l.fullName || "").toLowerCase();
    const spec = (l.specialties || []).join(" ").toLowerCase();
    const matchSearch = !q || name.includes(q.toLowerCase()) || spec.includes(q.toLowerCase());
    const matchFilters = filters.every(f => FILTER_MAP[f] ? FILTER_MAP[f](l) : true);
    return matchSearch && matchFilters;
  });

  // ── Calendrier ────────────────────────────────────────────────────────────
  const days = getDaysInMonth(calYear, calMonth);
  const availableDays = getAvailableDaysFromSlots(calYear, calMonth, lawyerSlots);
  const slotsForDay = selDay ? getSlotsForDay(calYear, calMonth, selDay, lawyerSlots) : [];

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelDay(null); setSelTime(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelDay(null); setSelTime(null);
  };

  const tMonth = (idx) => t(`month.${idx}`);
  const tDay = (dayName) => t(`day.${dayName}`);
  const tDaysShort = () => t("calendar.days_short", { returnObjects: true });
  const formatAvailableDays = (slots) => [...new Set(slots.map(s => s.day))].map(d => tDay(d)).join(", ");
  const formatFormats = (formats) => formats.map(f => t(`format.${f}`)).join(", ");

  // ── Renders ───────────────────────────────────────────────────────────────

  // ← OTP overlay sans bouton vérifier, vérification automatique via onComplete
  const renderOtpOverlay = () => (
    <div className="co-form">
      <div className="co-info-box co-info-box--green">
        📧 {t("otp.sent_to", { email: f1.email })}
      </div>

      <OtpInput
        value={otp}
        onChange={(next) => { setOtp(next); setOtpError(""); }}
        onComplete={(code) => handleVerifyOtp(code)}
        error={otpError}
        disabled={otpLoading}
        label={t("otp.label")}
        resendLabel={t("otp.resend")}
        onResend={handleResendOtp}
        resendCooldown={resendCd}
      />

      {otpLoading && (
        <div className="co-info-box" style={{ textAlign: "center", marginTop: 8 }}>
          ⏳ {t("btn.loading")}
        </div>
      )}

      <button className="co-back-btn" style={{ marginTop: 8 }}
        onClick={() => { setOtpStep(false); setOtp(["", "", "", "", "", ""]); setOtpError(""); }}>
        ← {t("otp.change_email")}
      </button>
    </div>
  );

  const renderStep1 = () => (
    <div className="co-form">
      <div className="co-info-box">ℹ️ {t("step1.info_box")}</div>
      <div className="co-grid2">
        <div>
          <label className="co-label">{t("field.first_name")}</label>
          <input className={`co-input ${e1.prenom ? "co-input--error" : ""}`}
            placeholder={t("placeholder.first_name")} value={f1.prenom}
            onChange={e => setF1({ ...f1, prenom: e.target.value })} />
          {e1.prenom && <div className="co-field-error">{e1.prenom}</div>}
        </div>
        <div>
          <label className="co-label">{t("field.last_name")}</label>
          <input className={`co-input ${e1.nom ? "co-input--error" : ""}`}
            placeholder={t("placeholder.last_name")} value={f1.nom}
            onChange={e => setF1({ ...f1, nom: e.target.value })} />
          {e1.nom && <div className="co-field-error">{e1.nom}</div>}
        </div>
      </div>
      <div>
        <label className="co-label">{t("field.email")}</label>
        <input className={`co-input ${e1.email ? "co-input--error" : ""}`} type="email"
          placeholder={t("placeholder.email")} value={f1.email}
          onChange={e => setF1({ ...f1, email: e.target.value })} />
        {e1.email && <div className="co-field-error">{e1.email}</div>}
      </div>
      <div>
        <label className="co-label">{t("field.phone")}</label>
        <div className="co-phone-row">
          <div className="co-phone-prefix">+216</div>
          <input className={`co-input co-input--phone ${e1.phone ? "co-input--error" : ""}`}
            placeholder={t("placeholder.phone")} value={f1.phone}
            onChange={e => setF1({ ...f1, phone: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
        </div>
        {e1.phone && <div className="co-field-error">{e1.phone}</div>}
      </div>
      <div>
        <label className="co-label">{t("field.preferred_language")}</label>
        <select className="co-input" value={f1.langue} onChange={e => setF1({ ...f1, langue: e.target.value })}>
          <option value="Français">{t("lang.french")}</option>
          <option value="Arabe">{t("lang.arabic")}</option>
          <option value="Anglais">{t("lang.english")}</option>
        </select>
        <div className="co-hint">{t("step1.language_hint")}</div>
      </div>
      <div className="co-section-divider" />
      <h3 className="co-section-title">{t("step1.security_title")}</h3>
      <div>
        <label className="co-label">{t("field.password")}</label>
        <input className={`co-input ${e1.pwd ? "co-input--error" : ""}`} type="password"
          placeholder={t("placeholder.password")} value={f1.pwd}
          onChange={e => setF1({ ...f1, pwd: e.target.value })} />
        {!e1.pwd && <div className="co-hint">{t("step1.password_hint")}</div>}
        {e1.pwd && <div className="co-field-error">{e1.pwd}</div>}
      </div>
      <div>
        <label className="co-label">{t("field.confirm_password")}</label>
        <input className={`co-input ${e1.confirm ? "co-input--error" : ""}`} type="password"
          placeholder={t("placeholder.confirm_password")} value={f1.confirm}
          onChange={e => setF1({ ...f1, confirm: e.target.value })} />
        {e1.confirm && <div className="co-field-error">{e1.confirm}</div>}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="co-form">
      <div className="co-info-box">
        <strong>{t("step2.why_verify_title")}</strong><br />{t("step2.why_verify_desc")}
      </div>
      <div>
        <label className="co-label">{t("field.id_type")}</label>
        <div className="co-tags">
          {ID_TYPE_KEYS.map((key, i) => (
            <button key={i} className={`co-tag ${idIdx === i ? "co-tag--on" : ""}`} onClick={() => setIdIdx(i)}>
              {ID_TYPE_EMOJIS[i]} {t(`id_type.${key}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="co-label">{t("field.id_number")} · {t(`id_type_label.${ID_TYPE_KEYS[idIdx]}`)}</label>
        <input
          className={`co-input ${e2.idNum ? "co-input--error" : ""}`}
          placeholder={t("placeholder.id_number")}
          value={idNum}
          maxLength={ID_TYPE_KEYS[idIdx] === "cin" ? 8 : undefined}
          onChange={e => {
            const val = ID_TYPE_KEYS[idIdx] === "cin"
              ? e.target.value.replace(/\D/g, "").slice(0, 8)
              : e.target.value;
            setIdNum(val);
          }}
        />
        {ID_TYPE_KEYS[idIdx] === "cin" && (
          <div className="co-hint">8 chiffres obligatoires ({idNum.length}/8)</div>
        )}
        {e2.idNum && <div className="co-field-error">{e2.idNum}</div>}
      </div>
      <div>
        <label className="co-label">
          {t("field.doc_copy")} <span className="co-optional">({t("label.optional")})</span>
        </label>
        <label className={`co-doc-card ${docFile ? "co-doc-card--done" : ""}`}>
          <span style={{ fontSize: 20 }}>📎</span>
          <div style={{ flex: 1 }}>
            <div className="co-doc-label">{t("step2.upload_doc")}</div>
            <div className="co-doc-sub">{t("step2.upload_doc_formats")}</div>
          </div>
          {docFile ? <span className="co-doc-done-name">✓ {docFile.name}</span>
            : <span className="co-doc-placeholder">{t("step2.click_to_upload")}</span>}
          <input type="file" hidden accept=".jpg,.png,.pdf" onChange={e => setDoc(e.target.files[0])} />
        </label>
        <div className="co-hint">{t("step2.doc_optional_hint")}</div>
      </div>
      <div>
        <label className="co-label">
          {t("field.profile_photo")} <span className="co-optional">({t("label.optional")})</span>
        </label>
        <label className={`co-doc-card ${photo ? "co-doc-card--done" : ""}`} style={{ background: "#fff8ee", borderColor: "#f4d090" }}>
          <span style={{ fontSize: 20 }}>🖼️</span>
          <div style={{ flex: 1 }}>
            <div className="co-doc-label">{t("step2.upload_photo")}</div>
            <div className="co-doc-sub">{t("step2.upload_photo_formats")}</div>
          </div>
          {photo ? <span className="co-doc-done-name">✓ {photo.name}</span>
            : <span className="co-doc-placeholder">{t("step2.click_to_upload")}</span>}
          <input type="file" hidden accept=".jpg,.png" onChange={e => setPhoto(e.target.files[0])} />
        </label>
      </div>
      <div className="co-section-divider" />
      <h3 className="co-section-title">{t("step2.consent_title")}</h3>
      {[
        { k: "data", titleKey: "consent.data_title", descKey: "consent.data_desc", err: e2.data },
        { k: "cgu", titleKey: "consent.cgu_title", descKey: "consent.cgu_desc", err: e2.cgu },
      ].map(({ k, titleKey, descKey, err }) => (
        <div key={k}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" className="co-cb" checked={cons[k]}
              onChange={e => setCons({ ...cons, [k]: e.target.checked })} />
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
              <strong style={{ color: "#333", display: "block" }}>{t(titleKey)}</strong>
              <span dangerouslySetInnerHTML={{ __html: t(descKey) }} />
            </div>
          </label>
          {err && <div className="co-field-error">{err}</div>}
        </div>
      ))}
      <div className="co-onat-banner">🔒 {t("step2.security_banner")}</div>
    </div>
  );

  const renderStep3 = () => (
    <div className="co-form">
      <div>
        <label className="co-label">{t("field.governorate")}</label>
        <select className={`co-input ${e3.gov ? "co-input--error" : ""}`} value={gov}
          onChange={e => setGov(e.target.value)}>
          <option value="">{t("placeholder.select_governorate")}</option>
          {GOVERNORATE_KEYS.map(k => <option key={k} value={k}>{t(`governorate.${k}`)}</option>)}
        </select>
        {!e3.gov && <div className="co-hint">{t("step3.governorate_hint")}</div>}
        {e3.gov && <div className="co-field-error">{e3.gov}</div>}
      </div>
      <div>
        <label className="co-label">{t("field.legal_type")}</label>
        <div className="co-tags">
          {LEGAL_TYPE_KEYS.map((key, i) => (
            <button key={key} className={`co-tag ${legal === key ? "co-tag--on" : ""}`} onClick={() => setLegal(key)}>
              {LEGAL_TYPE_EMOJIS[i]} {t(`legal_type.${key}`)}
            </button>
          ))}
        </div>
        {e3.legal && <div className="co-field-error">{e3.legal}</div>}
      </div>
      <div>
        <label className="co-label">
          {t("field.situation")} <span className="co-optional">({t("label.optional")})</span>
        </label>
        <textarea className="co-input co-textarea" rows={4} maxLength={500}
          placeholder={t("placeholder.situation")} value={sit}
          onChange={e => setSit(e.target.value)} />
        <div className="co-hint">{t("step3.situation_hint", { count: sit.length })}</div>
      </div>
      <div className="co-section-divider" />
      <h3 className="co-section-title">{t("step3.urgency_title")}</h3>
      <div className="co-urgency-grid">
        {URGENCY_KEYS.map((key, i) => (
          <div key={key} className={`co-urgency-card ${urg === key ? "co-urgency-card--on" : ""}`}
            onClick={() => setUrg(key)}>
            <span style={{ fontSize: 28 }}>{URGENCY_EMOJIS[i]}</span>
            <strong className="co-urgency-label">{t(`urgency.${key}.label`)}</strong>
            <span className="co-urgency-sub">{t(`urgency.${key}.sub`)}</span>
          </div>
        ))}
      </div>
      {urg === "urgent" && (
        <div className="co-info-box" style={{ borderLeft: "3px solid #e53e3e", background: "#fff5f5", color: "#c53030", marginTop: 8 }}>
          🚨 {t("step3.urgent_warning")}
        </div>
      )}
      {e3.urg && <div className="co-field-error">{e3.urg}</div>}
    </div>
  );

  const renderStep4 = () => (
    <div className="co-form">
      {urg === "urgent" && (
        <div className="co-info-box" style={{ borderLeft: "3px solid #e53e3e", background: "#fff5f5", color: "#c53030", marginBottom: 8 }}>
          🚨 <strong>{t("step4.urgent_banner")}</strong>
        </div>
      )}
      <div className="co-search-bar">
        <span>🔍</span>
        <input placeholder={t("placeholder.search_lawyer")} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="co-tags">
        {FILTER_KEYS.map(f => (
          <button key={f} className={`co-tag ${filters.includes(f) ? "co-tag--on" : ""}`} onClick={() => tog(f)}>
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>
      <div className="co-info-box">
        🎲 <strong>{t("step4.neutral_ranking_title")}</strong> — {t("step4.neutral_ranking_desc")}
      </div>
      <div className="co-lawyers-list">
        {lawyersLoad && <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}>⏳ {t("step4.loading")}</div>}
        {lawyersErr && <div className="co-alert-box">⚠️ {lawyersErr}</div>}
        {!lawyersLoad && !lawyersErr && filteredLawyers.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}>{t("step4.empty")}</div>
        )}
        {!lawyersLoad && filteredLawyers.map(l => {
          const initials = getInitials(l.fullName);
          const avail = getAvailability(l);
          const langs = getLangs(l);
          const specs = l.specialties || [];
          const isChosen = chosen?._id === l._id;
          return (
            <div key={l._id} className={`co-lawyer-card ${isChosen ? "co-lawyer-card--selected" : ""}`}
              onClick={() => setChosen(l)}>
              <div className="co-lawyer-top">
                <div className="co-lawyer-avatar">
                  {(l.photo?.enhanced || l.photo?.original)
                    ? <img src={l.photo?.enhanced || l.photo?.original} alt={l.fullName} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    : initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="co-lawyer-name">{l.fullName}</div>
                  <div className="co-lawyer-spec">{specs.length > 0 ? specs.join(" · ") : t("lawyer.default_spec")}</div>
                  <div className="co-tags" style={{ marginTop: 6 }}>
                    {l.verified && <span className="co-badge co-badge--gold">✓ {t("label.verified")}</span>}
                    {is24_7(l) && <span className="co-badge co-badge--red">{t("label.emergency_24_7")}</span>}
                    {langs.map(lg => <span key={lg} className="co-badge">{lg}</span>)}
                  </div>
                </div>
              </div>
              <div className="co-lawyer-meta">
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#666" }}>
                  {l.phone && <span>📞 {l.phone}</span>}
                  {specs.length > 0 && (
                    <div className="co-tags" style={{ marginTop: 4 }}>
                      {specs.map(s => <span key={s} className="co-tag co-tag--sm">{s}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: avail ? "#2a7c4f" : "#aaa" }}>
                    {avail ? t("lawyer.available") : t("lawyer.full")}
                  </span>
                  <button
                    className={`co-btn ${isChosen ? "co-btn--chosen" : ""} ${!avail ? "co-btn--disabled" : ""}`}
                    onClick={e => { e.stopPropagation(); if (avail) setChosen(l); }}>
                    {isChosen ? t("btn.selected") : t("btn.choose")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <p className="co-results-count">
          {t(filteredLawyers.length === 1 ? "step4.results_count_one" : "step4.results_count_other",
            { count: filteredLawyers.length })}
        </p>
      </div>
    </div>
  );

  const renderStep5Calendar = () => {
    const daysShort = tDaysShort();
    return (
      <div className="co-form">
        <div className="co-lawyer-card" style={{ marginBottom: 0, cursor: "default" }}>
          <div className="co-lawyer-top">
            <div className="co-lawyer-avatar">
              {(chosen?.photo?.enhanced || chosen?.photo?.original)
                ? <img
                  src={chosen.photo?.enhanced || chosen.photo?.original}
                  alt={chosen?.fullName}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
                : getInitials(chosen?.fullName)
              }
            </div>
            <div>
              <div className="co-lawyer-name">{chosen?.fullName}</div>
              <div className="co-tags" style={{ marginTop: 4 }}>
                {chosen?.verified && <span className="co-badge co-badge--gold">✓ {t("label.verified")}</span>}
                {lawyerFormats.includes("video") && <span className="co-badge">💻 {t("filter.video")}</span>}
                {lawyerFormats.includes("in_person") && <span className="co-badge">🏛️ {t("filter.in_person")}</span>}
                {lawyerFormats.includes("phone") && <span className="co-badge">📞 {t("filter.phone")}</span>}
              </div>
            </div>
          </div>
          {(chosen?.specialties || []).length > 0 && (
            <div style={{ padding: "8px 12px", fontSize: 13, color: "#666", borderTop: "1px solid #eee" }}>
              ⚖️ {chosen.specialties.join(" · ")}
            </div>
          )}
          {chosen?.phone && (
            <div style={{ padding: "4px 12px 8px", fontSize: 13, color: "#666" }}>📞 {chosen.phone}</div>
          )}
          {getLangs(chosen || {}).length > 0 && (
            <div style={{ padding: "4px 12px 8px", fontSize: 13, color: "#666" }}>
              🌐 {getLangs(chosen || {}).join(" · ")}
            </div>
          )}
          {lawyerSlots.length > 0 && (
            <div style={{ padding: "8px 12px", fontSize: 12, color: "#2a7c4f", borderTop: "1px solid #eee", background: "#f0faf4", borderRadius: "0 0 10px 10px" }}>
              📅 {t("step5_calendar.available_days", { days: formatAvailableDays(lawyerSlots) })}
            </div>
          )}
        </div>
        {slotsLoading && (
          <div className="co-info-box" style={{ marginTop: 12, textAlign: "center" }}>⏳ {t("step5_calendar.loading_slots")}</div>
        )}
        {slotsError && (
          <div className="co-alert-box" style={{ marginTop: 12 }}>⚠️ {slotsError}</div>
        )}
        {!slotsLoading && !slotsError && lawyerSlots.length === 0 && (
          <div className="co-info-box" style={{ marginTop: 12, borderLeft: "3px solid #f59e0b", background: "#fffbeb" }}>
            ⚠️ {t("step5_calendar.no_slots_warning")}
          </div>
        )}
        {!slotsLoading && lawyerSlots.length > 0 && (
          <>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 16, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button className="co-back-btn" style={{ padding: "4px 10px", minWidth: 0 }} onClick={prevMonth}>{t("calendar.prev")}</button>
                <strong style={{ fontSize: 15 }}>{tMonth(calMonth)} {calYear}</strong>
                <button className="co-back-btn" style={{ padding: "4px 10px", minWidth: 0 }} onClick={nextMonth}>{t("calendar.next")}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center", marginBottom: 4 }}>
                {(Array.isArray(daysShort) ? daysShort : ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"]).map(d => (
                  <div key={d} style={{ fontSize: 10, color: "#aaa", fontWeight: 600, padding: "2px 0" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {days.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const isAvail = availableDays.includes(d);
                  const isSel = selDay === d;
                  const isPast = calYear === today.getFullYear() && calMonth === today.getMonth() && d < today.getDate();
                  return (
                    <div key={i}
                      onClick={() => { if (isAvail && !isPast) { setSelDay(d); setSelTime(null); } }}
                      style={{
                        padding: "8px 4px", borderRadius: 8, textAlign: "center", fontSize: 13,
                        cursor: isAvail && !isPast ? "pointer" : "default",
                        background: isSel ? "#1a2e44" : isAvail && !isPast ? "#fff" : "transparent",
                        color: isSel ? "#fff" : isAvail && !isPast ? "#1a2e44" : "#ccc",
                        border: isSel ? "2px solid #1a2e44" : isAvail && !isPast ? "1px solid #ddd" : "1px solid transparent",
                        fontWeight: isAvail && !isPast ? 600 : 400,
                        position: "relative",
                      }}>
                      {d}
                      {isAvail && !isPast && !isSel && (
                        <div style={{
                          position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
                          width: 4, height: 4, borderRadius: "50%", background: "#c9a84c"
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "#888" }}>
                <span>□ {t("step5_calendar.legend_available")}</span>
                <span style={{ color: "#1a2e44", fontWeight: 600 }}>■ {t("step5_calendar.legend_selected")}</span>
                <span style={{ color: "#ccc" }}>— {t("step5_calendar.legend_unavailable")}</span>
              </div>
            </div>
            {selDay && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#888", marginBottom: 8, textTransform: "uppercase" }}>
                  {t("step5_calendar.slots_title", { day: selDay, month: tMonth(calMonth), year: calYear })}
                </div>
                {slotsForDay.length === 0
                  ? <div className="co-info-box">{t("step5_calendar.no_slots_day")}</div>
                  : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                      {slotsForDay.map(time => {
                        const isSel = selTime === time;
                        return (
                          <div key={time} onClick={() => setSelTime(time)}
                            style={{
                              padding: "10px 0", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 600,
                              cursor: "pointer",
                              background: isSel ? "#1a2e44" : "#fff",
                              color: isSel ? "#fff" : "#1a2e44",
                              border: isSel ? "2px solid #1a2e44" : "1px solid #ddd",
                            }}>
                            {time}
                          </div>
                        );
                      })}
                    </div>
                  )
                }
                {selTime && (
                  <div className="co-info-box co-info-box--green" style={{ marginTop: 12 }}>
                    ✓ {t("step5_calendar.slot_confirmed", { day: selDay, month: tMonth(calMonth), year: calYear, time: selTime })}<br />
                    <span style={{ fontSize: 12 }}>{t("step5_calendar.slot_confirmed_hint")}</span>
                  </div>
                )}
              </div>
            )}
            {!selDay && (
              <div className="co-info-box" style={{ marginTop: 8 }}>📅 {t("step5_calendar.select_date_hint")}</div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderStep5Urgent = () => {
    if (urgentNoAnswer) {
      return (
        <div className="co-form">
          <div className="co-lawyer-center">
            <div className="co-lawyer-avatar co-lawyer-avatar--lg co-lawyer-avatar--grey">{getInitials(chosen?.fullName)}</div>
            <div className="co-lawyer-name" style={{ marginTop: 12, textAlign: "center", color: "#1a2e44" }}>{chosen?.fullName}</div>
            <div className="co-lawyer-spec" style={{ textAlign: "center" }}>{(chosen?.specialties || []).join(" · ")}</div>
            <span className="co-no-answer-badge">● {t("step5_urgent.no_answer_badge")}</span>
          </div>
          <div className="co-onat-banner" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
            <div>
              <div style={{ fontWeight: 700, color: "#c2852a", marginBottom: 4 }}>{t("step5_urgent.reminder_title")}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{t("step5_urgent.reminder_desc", { name: chosen?.fullName })}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{t("step5_urgent.reminder_status")}</div>
            </div>
          </div>
          <h3 className="co-section-title">{t("step5_urgent.book_slot_title")}</h3>
          <p className="co-hint">{t("step5_urgent.book_slot_hint")}</p>
          <div className="co-urgency-grid">
            {SLOT_KEYS_URGENT.map(key => (
              <div key={key} className={`co-urgency-card ${urgentSlot === key ? "co-urgency-card--on" : ""}`}
                onClick={() => setUrgentSlot(key)}>
                <strong className="co-urgency-label">{t(`slot.${key}.label`)}</strong>
                <span className="co-urgency-sub">{t(`slot.${key}.sub`)}</span>
              </div>
            ))}
          </div>
          {lawyerEmergency?.window && (
            <div className="co-info-box" style={{ marginTop: 8 }}>🕐 {t("step5_urgent.emergency_window_info", { window: lawyerEmergency.window })}</div>
          )}
          {urgentSlot && (
            <div className="co-info-box co-info-box--green" style={{ marginTop: 8 }}>
              {t("step5_urgent.slot_confirmed", { slot: t(`slot.${urgentSlot}.label`) })}<br />
              <span style={{ fontSize: 12 }}>{t("step5_urgent.slot_confirmed_desc")}</span>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="co-form">
        <div className="co-info-box co-info-box--red">
          🚨 <strong>{t("step5_urgent.urgent_mode_title")}</strong> {t("step5_urgent.urgent_mode_desc")}
        </div>
        <div className="co-lawyer-center">
          <div className="co-lawyer-avatar co-lawyer-avatar--lg">{getInitials(chosen?.fullName)}</div>
          <div className="co-lawyer-name" style={{ marginTop: 12, textAlign: "center", color: "#1e3a5f" }}>{chosen?.fullName}</div>
          <div className="co-lawyer-spec" style={{ textAlign: "center" }}>{(chosen?.specialties || []).join(" · ")}</div>
        </div>
        <div className="co-onat-banner" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
          <div>
            <div style={{ fontWeight: 700, color: "#c2852a", marginBottom: 4 }}>{t("step5_urgent.notification_title")}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{t("step5_urgent.notification_desc", { name: chosen?.fullName })}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{t("step5_urgent.notification_status")}</div>
          </div>
        </div>
        {lawyerEmergency?.window && (
          <div className="co-info-box" style={{ marginTop: 0 }}>🕐 {t("step5_urgent.emergency_window", { window: lawyerEmergency.window })}</div>
        )}
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div className="co-label" style={{ marginBottom: 8, fontSize: 11, letterSpacing: 1 }}>{t("label.duty_number")}</div>
          <div className="co-phone-big">{lawyerEmergency?.phone || chosen?.phone || "+216 XX XXX XXX"}</div>
        </div>
        <a href={`tel:${lawyerEmergency?.phone || chosen?.phone}`} className="co-call-btn">{t("btn.call_now")}</a>
        <div className="co-divider"><div /><span>{t("label.or")}</span><div /></div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>{t("step5_urgent.no_answer_prompt")}</p>
          <button className="co-back-btn" onClick={() => setUrgentNoAnswer(true)}>{t("btn.book_priority_slot")}</button>
        </div>
      </div>
    );
  };

  const renderStep6 = () => (
    <div className="co-form">
      <div>
        <h3 className="co-section-title">{t("step6.consult_mode_title")}</h3>
        {lawyerFormats.length > 0 && (
          <div className="co-info-box" style={{ marginBottom: 8 }}>
            ℹ️ {t("step6.formats_info", { formats: formatFormats(lawyerFormats) })}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 8 }}>
          {[
            { key: "in_person", icon: "🏛️", labelKey: "step6.format_in_person", subKey: "step6.format_in_person_sub" },
            { key: "phone", icon: "📞", labelKey: "step6.format_phone", subKey: "step6.format_phone_sub" },
            { key: "video", icon: "💻", labelKey: "step6.format_video", subKey: "step6.format_video_sub" },
          ].map(({ key, icon, labelKey, subKey }) => {
            const supported = lawyerFormats.length === 0 || lawyerFormats.includes(key);
            return (
              <div key={key}
                className={`co-urgency-card ${consultMode === key ? "co-urgency-card--on" : ""}`}
                onClick={() => supported && setConsultMode(key)}
                style={{ padding: "16px 8px", opacity: supported ? 1 : 0.4, cursor: supported ? "pointer" : "not-allowed" }}>
                <span style={{ fontSize: 28 }}>{icon}</span>
                <strong className="co-urgency-label">{t(labelKey)}</strong>
                <span className="co-urgency-sub">{supported ? t(subKey) : t("step6.format_unavailable")}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <h3 className="co-section-title">
          {t("step6.note_title")} <span className="co-optional">({t("label.optional")})</span>
        </h3>
        <label className="co-label" style={{ fontSize: 10, letterSpacing: 1 }}>{t("field.consult_note")}</label>
        <textarea className="co-input co-textarea" rows={4} maxLength={400}
          placeholder={t("placeholder.consult_note")} value={consultNote}
          onChange={e => setConsultNote(e.target.value)} />
        <div className="co-hint">{t("step6.note_hint", { count: consultNote.length })}</div>
      </div>
      <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden", marginTop: 16 }}>
        {[
          { icon: "👤", text: chosen?.fullName || "—" },
          { icon: "📅", text: urg !== "urgent" && selDay ? `${selDay} ${tMonth(calMonth)} ${calYear} — ${selTime || "—"}` : t("step6.recap_date_urgent") },
          { icon: "⚖️", text: legal ? t(`legal_type.${legal}`) : "—" },
          { icon: "💳", text: t("step6.recap_payment") },
        ].map(({ icon, text }, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < 3 ? "1px solid #f0f0f0" : "none" }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 13, color: "#333" }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className="co-form">
      <div className="co-confirm-center">
        <div className="co-confirm-icon">🎉</div>
        <h2 className="co-confirm-title">{t("step7.title")}</h2>
        <p className="co-confirm-sub">{t("step7.subtitle")}</p>
      </div>
      <div className="co-info-box" style={{ marginBottom: 16, borderLeft: "4px solid #f59e0b", background: "#fffbeb" }}>
        ⏳ <strong>{t("step7.pending_validation")}</strong><br />
        <span style={{ fontSize: 13 }}>{t("step7.pending_desc")}</span>
      </div>
      {[
        { label: t("step7.chosen_lawyer"), value: chosen?.fullName || "—", done: true },
        { label: t("step7.legal_type"), value: legal ? t(`legal_type.${legal}`) : "—", done: true },
        { label: t("step7.urgency"), value: urg ? t(`urgency.${urg}.label`) : "—", done: true },
        { label: t("step7.sms_confirm"), value: t("step7.pending"), done: false },
      ].map(({ label, value, done }) => (
        <div key={label} className="co-confirm-step">
          <div className={`co-confirm-dot ${done ? "co-confirm-dot--done" : "co-confirm-dot--pending"}`}>{done ? "✓" : "—"}</div>
          <div>
            <div className={done ? "co-confirm-step-label--done" : "co-confirm-step-label--pending"}>{label}</div>
            <div style={{ fontSize: 12, color: "#aaa" }}>{value}</div>
          </div>
        </div>
      ))}
      <div className="co-info-box co-info-box--blue">⏱ {t("step7.delay_info")}</div>
      <div className="co-info-box">
        📧 <span dangerouslySetInnerHTML={{ __html: t("step7.email_sent", { email: f1.email }) }} />
      </div>
    </div>
  );

  const renderStep5 = () => urg === "urgent" ? renderStep5Urgent() : renderStep5Calendar();
  const RENDERS = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];

  const getStepTitle = () => {
    if (otpStep) return t("otp.title");
    if (step === 5) {
      if (urg === "urgent") return urgentNoAnswer ? t("step5_urgent.no_answer_title") : t("step5_urgent.title");
      return t("step5_calendar.title");
    }
    const keys = ["step1", "step2", "step3", "step4", "step5_calendar", "step6", "step7"];
    return t(`${keys[step - 1]}.title`);
  };

  const getStepSub = () => {
    if (otpStep) return t("otp.subtitle");
    if (step === 5) {
      if (urg === "urgent") return urgentNoAnswer ? t("step5_urgent.no_answer_subtitle") : t("step5_urgent.subtitle");
      return chosen?.fullName || "";
    }
    const keys = ["step1", "step2", "step3", "step4", "step5_calendar", "step6", "step7"];
    return t(`${keys[step - 1]}.subtitle`);
  };

  const getStepIcon = () => {
    if (otpStep) return "📧";
    if (step === 5 && urg === "urgent") return "🚨";
    return STEP_ICONS[step - 1];
  };

  const renderFooter = () => {
    if (otpStep) return null;
    if (step === 5 && urg === "urgent") {
      return (
        <div className="co-card-footer">
          <button className="co-back-btn" onClick={() => { if (urgentNoAnswer) setUrgentNoAnswer(false); else back(); }}>
            ← {t("btn.back")}
          </button>
          {urgentNoAnswer ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="co-back-btn" onClick={() => { setUrgentNoAnswer(false); setChosen(null); setStep(4); }}>
                {t("btn.try_another_lawyer")}
              </button>
              <button className={`co-btn ${!urgentSlot ? "co-btn--disabled" : ""}`}
                onClick={() => { if (urgentSlot) next(); }} disabled={!urgentSlot}>
                {t("btn.choose_slot")}
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#aaa" }}>{t("step5_urgent.footer_note")}</span>
          )}
        </div>
      );
    }
    return (
      <div className="co-card-footer">
        <div>
          {step > 1 && step !== 7
            ? <button className="co-back-btn" onClick={back}>← {t("btn.back")}</button>
            : step === 1
              ? <span className="co-footer-free">
                {t("footer.already_registered")} <a href="/login" className="co-link">{t("btn.login")}</a>
              </span>
              : <div />
          }
        </div>
        <div className="co-footer-right">
          {step === 7
            ? <button className="co-btn" onClick={() => navigate("/login")}>{t("btn.login_redirect")}</button>
            : <button className="co-btn" onClick={handleNext} disabled={loading}>{nextLabel()}</button>
          }
        </div>
      </div>
    );
  };

  return (
    <div className="co-page">
      <div className="co-nav-steps">
        {Array.from({ length: TOTAL }, (_, i) => (
          <div key={i} className={["co-bubble", step === i + 1 ? "co-bubble--active" : "", step > i + 1 ? "co-bubble--done" : ""].join(" ")}>
            {step > i + 1 ? "✓" : i + 1}
          </div>
        ))}
      </div>
      <div className="co-container">
        <div className="co-card">
          <div className="co-card-header">
            <div>
              <div className="co-step-tag">
                {t("step_indicator", { current: String(step).padStart(2, "0"), total: String(TOTAL).padStart(2, "0") })}
              </div>
              <h1 className="co-card-title">{getStepTitle()}</h1>
              <p className="co-card-sub">{getStepSub()}</p>
            </div>
            <div className="co-step-circle">{getStepIcon()}</div>
          </div>
          {error && <div className="co-alert-box">⚠️ {error}</div>}
          <div className="co-card-body">
            {otpStep ? renderOtpOverlay() : RENDERS[step - 1]()}
          </div>
          {renderFooter()}
        </div>
      </div>
    </div>
  );
}