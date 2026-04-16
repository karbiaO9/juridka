import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './CompleteProfile.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const DOCUMENTS = [
  {
    field: 'carteBarreauFront',
    labelKey: 'complete.doc_carte_front',
    labelFallback: 'Carte du barreau — Recto',
    descKey: 'complete.doc_carte_front_desc',
    descFallback: 'PDF ou image JPG/PNG — Max 10 Mo',
    icon: '🪪',
  },
  {
    field: 'carteBarreauBack',
    labelKey: 'complete.doc_carte_back',
    labelFallback: 'Carte du barreau — Verso',
    descKey: 'complete.doc_carte_back_desc',
    descFallback: 'PDF ou image JPG/PNG — Max 10 Mo',
    icon: '🪪',
  },
  {
    field: 'patente',
    labelKey: 'complete.doc_patente',
    labelFallback: 'Patente ONAT',
    descKey: 'complete.doc_patente_desc',
    descFallback: 'En cours de validité — PDF ou image',
    icon: '📋',
  },
  {
    field: 'diplome',
    labelKey: 'complete.doc_diplome',
    labelFallback: "Diplôme d'avocat",
    descKey: 'complete.doc_diplome_desc',
    descFallback: 'PDF ou image JPG/PNG',
    icon: '🎓',
  },
  {
    field: 'casierJudiciaire',
    labelKey: 'complete.doc_casier',
    labelFallback: 'Casier judiciaire',
    descKey: 'complete.doc_casier_desc',
    descFallback: 'Bulletin n°3 — PDF ou image',
    icon: '📄',
  },
  {
    field: 'photo',
    labelKey: 'complete.doc_photo',
    labelFallback: "Photo d'identité professionnelle",
    descKey: 'complete.doc_photo_desc',
    descFallback: 'Fond neutre, tenue professionnelle — JPG/PNG',
    icon: '📸',
  },
];

export default function CompleteProfile() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const { t }     = useTranslation();

  const [member,    setMember]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [files,     setFiles]     = useState({});
  const [previews,  setPreviews]  = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Vérifier le token ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/founding-members/complete/${token}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error); setLoading(false); return; }
        setMember(data);
      } catch {
        setError('Impossible de contacter le serveur');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Gérer les fichiers ─────────────────────────────────────────
  const handleFile = (field, file) => {
    if (!file) return;
    setFiles(f => ({ ...f, [field]: file }));
    setFieldErrors(e => ({ ...e, [field]: undefined }));

    // Prévisualisation image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPreviews(p => ({ ...p, [field]: e.target.result }));
      reader.readAsDataURL(file);
    } else {
      setPreviews(p => ({ ...p, [field]: 'pdf' }));
    }
  };

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    DOCUMENTS.forEach(({ field }) => {
      if (!files[field]) errs[field] = t('complete.err_required', 'Document requis');
    });
    return errs;
  };

  // ── Soumettre ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      DOCUMENTS.forEach(({ field }) => formData.append(field, files[field]));

      const res = await fetch(`${API}/api/founding-members/complete/${token}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSubmitted(true);
    } catch {
      setError('Erreur lors de l\'envoi. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── États ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="cp-page">
        <div className="cp-loading">
          <div className="cp-spinner" />
          <p>{t('complete.loading', 'Vérification du lien...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-page">
        <div className="cp-error-card">
          <div className="cp-error-icon">✕</div>
          <h2>{t('complete.invalid_title', 'Lien invalide')}</h2>
          <p>{error}</p>
          <button className="cp-btn-back" onClick={() => navigate('/foundingMembers')}>
            {t('complete.back', '← Retour')}
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="cp-page">
        <div className="cp-success-card">
          <div className="cp-success-icon">✓</div>
          <h2 className="cp-success-title">
            {t('complete.success_title', 'Dossier envoyé !')}
          </h2>
          <p className="cp-success-desc">
            {t(
              'complete.success_desc',
              'Vos documents ont bien été reçus. Notre équipe va vérifier votre dossier sous 48h ouvrables. Vous recevrez un email de confirmation.'
            )}
          </p>
          <div className="cp-success-steps">
            <div className="cp-step cp-step--done">
              <span className="cp-step__dot">✓</span>
              <span>{t('complete.step1', 'Place réservée')}</span>
            </div>
            <div className="cp-step cp-step--done">
              <span className="cp-step__dot">✓</span>
              <span>{t('complete.step2', 'Documents soumis')}</span>
            </div>
            <div className="cp-step">
              <span className="cp-step__dot">3</span>
              <span>{t('complete.step3', 'Vérification admin (48h)')}</span>
            </div>
            <div className="cp-step">
              <span className="cp-step__dot">4</span>
              <span>{t('complete.step4', 'Confirmation & numéro fondateur')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulaire principal ───────────────────────────────────────
  return (
    <div className="cp-page">
      <div className="cp-bg-orb cp-bg-orb--1" />
      <div className="cp-bg-orb cp-bg-orb--2" />

      <div className="cp-container">
        {/* Header */}
        <div className="cp-header">
          <div className="cp-label">
            <span className="cp-label__line" />
            <span className="cp-label__text">
              {t('complete.label', 'COMPLÉTER VOTRE DOSSIER')}
            </span>
            <span className="cp-label__line" />
          </div>
          <h1 className="cp-headline">
            {t('complete.headline_prefix', 'Bonjour')}{' '}
            <em className="cp-headline__accent">{member.prenom}</em>
          </h1>
          <p className="cp-subheadline">
            {t(
              'complete.subheadline',
              'Pour finaliser votre inscription en tant que Membre Fondateur, veuillez uploader les documents ci-dessous. Tous les documents sont requis pour la vérification ONAT.'
            )}
          </p>

          {/* Récap plan */}
          <div className="cp-recap">
            <span className="cp-recap__item">
              📧 {member.email}
            </span>
            <span className="cp-recap__sep">·</span>
            <span className="cp-recap__item cp-recap__item--plan">
              {member.plan === 'essentiel' ? 'Essentiel'
               : member.plan === 'professionnel' ? 'Professionnel'
               : 'Cabinet'} — −30%
            </span>
            <span className="cp-recap__sep">·</span>
            <span className="cp-recap__item">
              🏛 {member.barreau}
            </span>
          </div>
        </div>

        {/* Grille documents */}
        <div className="cp-docs-grid">
          {DOCUMENTS.map(({ field, labelFallback, descFallback, labelKey, descKey, icon }) => {
            const hasFile   = !!files[field];
            const preview   = previews[field];
            const hasError  = !!fieldErrors[field];

            return (
              <div
                key={field}
                className={`cp-doc-card ${hasFile ? 'cp-doc-card--filled' : ''} ${hasError ? 'cp-doc-card--error' : ''}`}
              >
                {/* Preview ou icône */}
                <div className="cp-doc-card__preview">
                  {preview && preview !== 'pdf' ? (
                    <img src={preview} alt={t(labelKey, labelFallback)} className="cp-doc-card__img" />
                  ) : preview === 'pdf' ? (
                    <div className="cp-doc-card__pdf">PDF</div>
                  ) : (
                    <div className="cp-doc-card__icon">{icon}</div>
                  )}
                  {hasFile && <div className="cp-doc-card__check">✓</div>}
                </div>

                {/* Infos */}
                <div className="cp-doc-card__info">
                  <h3 className="cp-doc-card__label">{t(labelKey, labelFallback)}</h3>
                  <p className="cp-doc-card__desc">{t(descKey, descFallback)}</p>
                  {hasFile && (
                    <p className="cp-doc-card__filename">{files[field].name}</p>
                  )}
                  {hasError && (
                    <p className="cp-doc-card__error">{fieldErrors[field]}</p>
                  )}
                </div>

                {/* Input file */}
                <label className="cp-doc-card__btn">
                  {hasFile
                    ? t('complete.replace', 'Remplacer')
                    : t('complete.upload', 'Choisir le fichier')}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    onChange={e => handleFile(field, e.target.files[0])}
                  />
                </label>
              </div>
            );
          })}
        </div>

        {/* Barre de progression */}
        <div className="cp-progress">
          <div className="cp-progress__track">
            <div
              className="cp-progress__fill"
              style={{ width: `${(Object.keys(files).length / DOCUMENTS.length) * 100}%` }}
            />
          </div>
          <span className="cp-progress__label">
            {Object.keys(files).length} / {DOCUMENTS.length}{' '}
            {t('complete.docs_uploaded', 'documents ajoutés')}
          </span>
        </div>

        {/* Submit */}
        <button
          className={`cp-submit ${submitting ? 'cp-submit--loading' : ''}`}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? t('complete.submitting', 'Envoi en cours...')
            : t('complete.submit', 'Soumettre mon dossier →')}
        </button>

        <p className="cp-trust">
          🔒 {t('complete.trust', 'Vos documents sont sécurisés et utilisés uniquement pour la vérification ONAT')}
        </p>
      </div>
    </div>
  );
}
