// ── Shared constants ─────────────────────────────────────────────────────────
export const SPECIALITES = [
  'Droit civil','Droit pénal','Droit des sociétés','Droit de la famille',
  'Propriété intellectuelle','Droit du travail','Droit fiscal',
  'Droit immobilier','Droit administratif','Droit international',
  'Droit commercial','Droit des étrangers','Contentieux fiscal',
  'Successions','Immigration',
];

export const GOUVERNORATS = [
  'Tunis','Ariana','Ben Arous','Manouba','Nabeul','Zaghouan','Bizerte',
  'Béja','Jendouba','Kef','Siliana','Sousse','Monastir','Mahdia',
  'Sfax','Kairouan','Kasserine','Sidi Bouzid','Gabès','Médenine',
  'Tataouine','Gafsa','Tozeur','Kébili',
];

export const DELAIS = [
  { value:'urgent',        label:'🚨 Urgent' },
  { value:'quelques_jours',label:'Quelques jours' },
  { value:'1_semaine',     label:'1 semaine' },
  { value:'2_semaines',    label:'2 semaines' },
  { value:'flexible',      label:'Flexible' },
];

export const LANGUES_OPTIONS = ['FR','AR','EN','IT','DE'];

export const NATURES = [
  { value:'audience_civile',       label:'Audience civile' },
  { value:'chambre_commerciale',   label:'Chambre commerciale' },
  { value:'chambre_penale',        label:'Chambre pénale' },
  { value:'chambre_administrative',label:'Chambre administrative' },
  { value:'mise_en_etat',          label:'Mise en état' },
  { value:'autre',                 label:'Autre' },
];

export const CATEGORIES_DOC = [
  { value:'travail_anonymise', label:'Document de travail (anonymisé)' },
  { value:'procuration',       label:'Procuration' },
  { value:'convention',        label:'Convention' },
  { value:'modele',            label:'Modèle type' },
  { value:'autre',             label:'Autre' },
];

export const DISPO_LABELS = {
  disponible:   { label:'DISPONIBLE',  cls:'dispo-green' },
  en_audience:  { label:'EN AUDIENCE', cls:'dispo-orange' },
  indisponible: { label:'INDISPONIBLE',cls:'dispo-red' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1)  return 'À l\'instant';
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${d}j`;
};

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });

export const fmtDateTime = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }) +
  ' · ' + new Date(d).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

export const initials = (av) => {
  if (!av) return '?';
  const fn = av.firstName || av.fullName?.split(' ')[0] || '';
  const ln = av.lastName  || av.fullName?.split(' ')[1] || '';
  return (fn[0] || '') + (ln[0] || '');
};

export const fullName = (av) =>
  av ? (av.fullName || `${av.firstName||''} ${av.lastName||''}`.trim() || 'Confrère') : 'Confrère';

export const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
