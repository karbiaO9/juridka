// ── Constants ────────────────────────────────────────────────────────────────

export const API = `${process.env.REACT_APP_API_URL}/api/auth/avocat`;

// Regex ONAT — ex: TN-2015-1234
export const ONAT_REGEX = /^[A-Z]{2}-\d{4}-\d{3,6}$/;

export const DAYS_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "14:00", "15:00", "16:00", "17:00", "18:00",
];
export const WILAYAS = [
  "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan", "Bizerte",
  "Béja", "Jendouba", "Le Kef", "Siliana", "Sousse", "Monastir", "Mahdia", "Sfax",
  "Kairouan", "Kasserine", "Sidi Bouzid", "Gabès", "Medenine", "Tataouine",
  "Gafsa", "Tozeur", "Kébili",
];

export const REQUIRED_DOCS = [
  "carteBarreauFront",
  "carteBarreauBack",
  "diplome",
  "patente",
  "casierJudiciaire",
];

// ── Icon helper ──────────────────────────────────────────────────────────────

export function getIcon(step) {
  return ["①", "②", "⚖️", "📄", "📷", "📅", "👁", "💎", "💳"][step - 1] || "●";
}

// ── CTA label resolver ───────────────────────────────────────────────────────

export function resolveLabel(step, { t, selectedPlan, photo, photoPreview }) {
  if (step === 1) return t("avocatOnboarding.cta.step1");
  if (step === 2) return t("avocatOnboarding.cta.step2");
  if (step === 5) {
    if (!photo)                  return t("avocatOnboarding.action.next");
    if (!photoPreview?.original) return t("avocatOnboarding.photo.analyze");
    return t("avocatOnboarding.photo.approve");
  }
  if (step === 7) return t("avocatOnboarding.cta.step7");
  if (step === 8) return selectedPlan === "gratuit"
    ? t("avocatOnboarding.cta.step8free")
    : t("avocatOnboarding.cta.step8paid");
  if (step === 9) return t("avocatOnboarding.cta.step9");
  return t("avocatOnboarding.action.next");
}

// ── Action resolver ──────────────────────────────────────────────────────────

export function resolveAction(step, handlers) {
  const {
    handleStep1, handleVerifyOtp, handleStep3, handleStep4,
    handlePhotoUpload, handleApprovePhoto, handleStep6,
    next, handleStep8, handleSubmit, photo, photoPreview,
  } = handlers;

  if (step === 1) return handleStep1;
  if (step === 2) return handleVerifyOtp;
  if (step === 3) return handleStep3;
  if (step === 4) return handleStep4;
  if (step === 5) {
    if (photo && photoPreview?.original) return handleApprovePhoto;
    if (photo)                           return handlePhotoUpload;
    return next;
  }
  if (step === 6) return handleStep6;
  if (step === 7) return next;
  if (step === 8) return handleStep8;
  if (step === 9) return handleSubmit;
  return next;
}

// ── Plans builder (needs t()) ────────────────────────────────────────────────

export function buildPlans(t) {
  return [
    {
      id: "gratuit",
      label: t("avocatOnboarding.plan.gratuit.label"),
      price: 0,
      unit: t("avocatOnboarding.plan.gratuit.unit"),
      features: [
        t("avocatOnboarding.plan.gratuit.f1"),
        t("avocatOnboarding.plan.gratuit.f2"),
        t("avocatOnboarding.plan.gratuit.f3"),
        t("avocatOnboarding.plan.gratuit.f4"),
      ],
      disabled: [
        t("avocatOnboarding.plan.gratuit.d1"),
        t("avocatOnboarding.plan.gratuit.d2"),
        t("avocatOnboarding.plan.gratuit.d3"),
      ],
    },
    {
      id: "essentiel",
      label: t("avocatOnboarding.plan.essentiel.label"),
      price: 720,
      unit: t("avocatOnboarding.plan.essentiel.unit"),
      trial: t("avocatOnboarding.plan.trial14"),
      features: [
        t("avocatOnboarding.plan.essentiel.f1"),
        t("avocatOnboarding.plan.essentiel.f2"),
        t("avocatOnboarding.plan.essentiel.f3"),
        t("avocatOnboarding.plan.essentiel.f4"),
        t("avocatOnboarding.plan.essentiel.f5"),
      ],
    },
    {
      id: "professionnel",
      label: t("avocatOnboarding.plan.pro.label"),
      price: 1080,
      unit: t("avocatOnboarding.plan.pro.unit"),
      highlight: true,
      badge: t("avocatOnboarding.plan.pro.badge"),
      features: [
        t("avocatOnboarding.plan.pro.f1"),
        t("avocatOnboarding.plan.pro.f2"),
        t("avocatOnboarding.plan.pro.f3"),
        t("avocatOnboarding.plan.pro.f4"),
        t("avocatOnboarding.plan.pro.f5"),
      ],
    },
    {
      id: "cabinet",
      label: t("avocatOnboarding.plan.cabinet.label"),
      price: 2160,
      unit: t("avocatOnboarding.plan.cabinet.unit"),
      trial: t("avocatOnboarding.plan.trial14"),
      features: [
        t("avocatOnboarding.plan.cabinet.f1"),
        t("avocatOnboarding.plan.cabinet.f2"),
        t("avocatOnboarding.plan.cabinet.f3"),
        t("avocatOnboarding.plan.cabinet.f4"),
        t("avocatOnboarding.plan.cabinet.f5"),
      ],
    },
  ];
}

// ── Specialties / languages builders ────────────────────────────────────────

export function buildSpecialties(t) {
  return [
    t("avocatOnboarding.spec.family"),
    t("avocatOnboarding.spec.penal"),
    t("avocatOnboarding.spec.commercial"),
    t("avocatOnboarding.spec.immo"),
    t("avocatOnboarding.spec.work"),
    t("avocatOnboarding.spec.affairs"),
    t("avocatOnboarding.spec.admin"),
    t("avocatOnboarding.spec.fiscal"),
    t("avocatOnboarding.spec.ip"),
    t("avocatOnboarding.spec.immigration"),
    t("avocatOnboarding.spec.succession"),
    t("avocatOnboarding.spec.bank"),
  ];
}

export function buildLanguages(t) {
  return [
    t("avocatOnboarding.lang.fr"),
    t("avocatOnboarding.lang.ar"),
    t("avocatOnboarding.lang.en"),
    t("avocatOnboarding.lang.it"),
    t("avocatOnboarding.lang.de"),
    t("avocatOnboarding.lang.es"),
    t("avocatOnboarding.lang.ber"),
  ];
}