// ── Constants ─────────────────────────────────────────────────────────────────

export const API = `${process.env.REACT_APP_API_URL}/api/founding-members`;

// Regex ONAT — ex: TN-2015-1234
export const ONAT_REGEX = /^[A-Z]{2}-\d{4}-\d{3,6}$/;

export const DAYS_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "14:00", "15:00", "16:00", "17:00", "18:00",
];
export const GOUVERNORATS = [
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

// ── Icon helper ───────────────────────────────────────────────────────────────

export function getIcon(step) {
  return ["①", "②", "⚖️", "📄", "📷", "📅", "💎", "✅"][step - 1] || "●";
}

// ── CTA label resolver ────────────────────────────────────────────────────────

export function resolveLabel(step, { t, photo, photoPreview }) {
  if (step === 1) return t("fo.cta.step1", "Créer mon compte →");
  if (step === 2) return t("fo.cta.step2", "Vérifier le code");
  if (step === 5) {
    if (!photo)                   return t("avocatOnboarding.action.next", "Suivant");
    if (!photoPreview?.original)  return t("fo.photo.analyze", "Analyser la photo");
    return t("fo.photo.approve", "Valider la photo");
  }
  if (step === 7) return t("fo.cta.step7", "Choisir ce plan →");
  if (step === 8) return t("fo.cta.step8", "Soumettre mon dossier →");
  return t("avocatOnboarding.action.next", "Suivant");
}

// ── Action resolver ───────────────────────────────────────────────────────────

export function resolveAction(step, handlers) {
  const {
    handleStep1, handleVerifyOtp, handleStep3, handleStep4,
    handlePhotoUpload, handleApprovePhoto, handleStep6,
    handleStep7, handleSubmit, next, photo, photoPreview,
  } = handlers;

  if (step === 1) return handleStep1;
  if (step === 2) return () => handleVerifyOtp();
  if (step === 3) return handleStep3;
  if (step === 4) return handleStep4;
  if (step === 5) {
    if (photo && photoPreview?.original) return handleApprovePhoto;
    if (photo)                           return handlePhotoUpload;
    return next;
  }
  if (step === 6) return handleStep6;
  if (step === 7) return handleStep7;
  if (step === 8) return handleSubmit;
  return next;
}

// ── Plans builder ─────────────────────────────────────────────────────────────

export function buildFoundingPlans(t) {
  return [
    {
      id: "essentiel",
      label: t("pricing.plan_essentiel", "ESSENTIEL"),
      price: 504,
      monthly: t("pricing.essentiel_monthly", "soit 42 DT/mois · au lieu de 60 DT"),
      features: [
        t("pricing.essentiel_f1", "Profil vérifié ONAT · badge visible"),
        t("pricing.essentiel_f2", "Prise de rendez-vous en ligne"),
        t("pricing.essentiel_f3", "Calendrier de disponibilité"),
        t("pricing.essentiel_f4", "Confirmations automatiques J−1 et H−3"),
        t("pricing.essentiel_f5", "Notifications clients email/SMS"),
        t("pricing.essentiel_f6", "Badge Membre Fondateur permanent"),
      ],
    },
    {
      id: "professionnel",
      label: t("pricing.plan_professionnel", "PROFESSIONNEL"),
      price: 756,
      monthly: t("pricing.pro_monthly", "soit 63 DT/mois · au lieu de 90 DT"),
      highlight: true,
      badge: t("pricing.recommended", "Recommandé"),
      features: [
        t("pricing.pro_f1", "Tout Essentiel inclus"),
        t("pricing.pro_f2", "Statistiques détaillées du profil"),
        t("pricing.pro_f3", "Tableau de bord analytique"),
        t("pricing.pro_f4", "Urgences 24/7 opt-in"),
        t("pricing.pro_f5", "Réseau Pro — délégation & substitution"),
        t("pricing.pro_f6", "Export agenda iCal / Google Calendar"),
        t("pricing.pro_f7", "Badge Membre Fondateur · accès bêta"),
      ],
    },
    {
      id: "cabinet",
      label: t("pricing.plan_cabinet", "CABINET"),
      price: 1512,
      monthly: t("pricing.cabinet_monthly", "soit 126 DT/mois · au lieu de 180 DT"),
      features: [
        t("pricing.cabinet_f1", "Tout Professionnel · 3 profils"),
        t("pricing.cabinet_f2", "Page cabinet dédiée"),
        t("pricing.cabinet_f3", "Compte assistant accès restreint"),
        t("pricing.cabinet_f4", "Agenda centralisé — 3 avocats"),
        t("pricing.cabinet_f5", "Tableau de bord cabinet consolidé"),
        t("pricing.cabinet_f6", "3 badges Fondateurs · facturation groupée"),
      ],
    },
  ];
}

// ── Specialties ───────────────────────────────────────────────────────────────

export function buildSpecialties(t) {
  return [
    t("avocatOnboarding.spec.family", "Droit de la famille"),
    t("avocatOnboarding.spec.penal", "Droit pénal"),
    t("avocatOnboarding.spec.commercial", "Droit commercial"),
    t("avocatOnboarding.spec.immo", "Droit immobilier"),
    t("avocatOnboarding.spec.work", "Droit du travail"),
    t("avocatOnboarding.spec.affairs", "Affaires & sociétés"),
    t("avocatOnboarding.spec.admin", "Droit administratif"),
    t("avocatOnboarding.spec.fiscal", "Fiscalité"),
    t("avocatOnboarding.spec.ip", "Propriété intellectuelle"),
    t("avocatOnboarding.spec.immigration", "Immigration"),
    t("avocatOnboarding.spec.succession", "Successions"),
    t("avocatOnboarding.spec.bank", "Droit bancaire"),
  ];
}

export function buildLanguages(t) {
  return [
    t("avocatOnboarding.lang.fr", "Français"),
    t("avocatOnboarding.lang.ar", "Arabe"),
    t("avocatOnboarding.lang.en", "Anglais"),
    t("avocatOnboarding.lang.it", "Italien"),
    t("avocatOnboarding.lang.de", "Allemand"),
    t("avocatOnboarding.lang.es", "Espagnol"),
    t("avocatOnboarding.lang.ber", "Berbère"),
  ];
}
