import React, { useState } from 'react';
import { temoignageAPI } from '../services/api';
import './TestimonialModal.css';

const DIMENSIONS = [
  { key: 'ecoute',      label: "Qualité d'écoute",           desc: "L'avocat a pris le temps de comprendre votre situation" },
  { key: 'clarte',      label: 'Clarté des explications',     desc: 'Les termes juridiques ont été expliqués accessiblement' },
  { key: 'pertinence',  label: 'Pertinence des conseils',     desc: 'Les orientations données correspondaient à votre besoin' },
  { key: 'ponctualite', label: 'Ponctualité & organisation',  desc: 'Le rendez-vous a démarré dans les temps, cadre structuré' },
  { key: 'accueil',     label: 'Accueil & environnement',     desc: 'Conditions de la consultation (accueil, locaux, ambiance)' },
];

const RATING_LABELS = { 1: 'Insuffisant', 2: 'Passable', 3: 'Correct', 4: 'Bien', 5: 'Excellent' };
const RATING_CLASSES = { 1: 'l1', 2: 'l2', 3: 'l3', 4: 'l4', 5: 'l5' };

const STEP_LABELS = ['Rappel', 'Dimensions', 'Témoignage', 'Consentement', 'Envoyé'];

function StepIndicator({ step }) {
  return (
    <div className="tm-steps">
      {STEP_LABELS.map((label, i) => {
        const num   = i + 1;
        const state = num < step ? 'done' : num === step ? 'active' : 'pending';
        return (
          <React.Fragment key={num}>
            <div className="tm-step-item">
              <div className="tm-step-inner">
                <div className={`tm-step-dot ${state}`}>
                  {state === 'done' ? '✓' : num}
                </div>
                <div className={`tm-step-label ${state}`}>{label}</div>
              </div>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`tm-step-line ${num < step ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function TestimonialModal({ appointment, daysLeft, onClose, onSubmitted }) {
  const [step,       setStep]       = useState(1);
  const [ratings,    setRatings]    = useState({ ecoute: null, clarte: null, pertinence: null, ponctualite: null, accueil: null });
  const [texte,      setTexte]      = useState('');
  const [consent1,   setConsent1]   = useState(false);
  const [consent2,   setConsent2]   = useState(false);
  const [consent3,   setConsent3]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference,  setReference]  = useState('');
  const [error,      setError]      = useState('');

  const apt        = appointment;
  const avocatName = apt.avocatId?.fullName || apt.avocatId?.nom || 'Votre avocat';
  const specialty  = apt.avocatId?.specialization || apt.avocatId?.specialites || '';
  const aptDate    = new Date(apt.date);
  const dateStr    = aptDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate  = aptDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const typeLabel  = apt.type === 'visio' ? 'Visioconférence' : 'Présentiel';

  const setRating = (key, val) =>
    setRatings(prev => ({ ...prev, [key]: prev[key] === val ? null : val }));
  const setNA = (key) =>
    setRatings(prev => ({ ...prev, [key]: prev[key] === 0 ? null : 0 }));

  const canNext = () => {
    if (step === 4) return consent1 && consent2;
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step < 4) { setStep(s => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const cleanRatings = {};
      Object.entries(ratings).forEach(([k, v]) => {
        cleanRatings[k] = (v === 0 || v === null) ? null : v;
      });
      const res = await temoignageAPI.submit({
        rendezVousId:   apt._id,
        ratings:        cleanRatings,
        texte:          texte.trim(),
        consentPublier: consent1,
        consentStats:   consent3,
      });
      setReference(res.temoignage?.reference || '');
      setStep(5);
      if (onSubmitted) onSubmitted(apt._id, res.temoignage);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal">

        {/* ── header ── */}
        <div className="tm-header">
          <span className="tm-header-title">Partager votre expérience</span>
          <button className="tm-close-btn" onClick={onClose}>✕ Fermer</button>
        </div>

        {/* ── step indicator ── */}
        <StepIndicator step={step} />

        {/* ── body ── */}
        <div className="tm-body">

          {/* ══ STEP 1 — Rappel ══ */}
          {step === 1 && (
            <>
              <div className="tm-hero">
                <div className="tm-hero-eyebrow">Votre consultation du {shortDate.toUpperCase()}</div>
                <h2 className="tm-hero-title">
                  Souhaitez-vous partager<br />votre expérience&nbsp;?
                </h2>
                <p className="tm-hero-subtitle">
                  Votre témoignage aide d'autres justiciables à trouver l'accompagnement adapté à leur situation.
                  Il sera anonymisé avant publication et soumis à une vérification.
                </p>
                <div className="tm-hero-chips">
                  <span className="tm-hero-chip">🏛️ {avocatName}</span>
                  {specialty && <span className="tm-hero-chip">⚖️ {specialty}</span>}
                  <span className="tm-hero-chip">📅 {dateStr} · {apt.heure}</span>
                </div>
                <div className="tm-hero-actions">
                  <button className="tm-btn-share" onClick={() => setStep(2)}>
                    Partager mon expérience →
                  </button>
                  <span className="tm-window-hint">Fenêtre ouverte encore {daysLeft} jour{daysLeft > 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="tm-info-card">
                <div className="tm-info-card-label">Consultation vérifiée</div>
                <div className="tm-info-row">
                  <div className="tm-info-icon">🏛️</div>
                  <div className="tm-info-content">
                    <div className="tm-info-sub">Avocat</div>
                    <div className="tm-info-main">{avocatName}{specialty ? ` · ${specialty}` : ''}</div>
                  </div>
                </div>
                <div className="tm-info-row">
                  <div className="tm-info-icon">📅</div>
                  <div className="tm-info-content">
                    <div className="tm-info-sub">Date</div>
                    <div className="tm-info-main">{dateStr} · {apt.heure} · {typeLabel}</div>
                  </div>
                </div>
              </div>

              <div className="tm-disclaimer">
                <span>📋</span>
                <p>
                  Ce témoignage concerne <strong>uniquement cette consultation</strong>, pas la relation avocat-client en général.
                  Si vous avez confié un dossier à cet avocat, seule l'expérience de cette première consultation d'orientation est concernée.
                </p>
              </div>
            </>
          )}

          {/* ══ STEP 2 — Dimensions ══ */}
          {step === 2 && (
            <div className="tm-step-content">
              <p className="tm-step-intro">
                Évaluez chaque aspect de votre consultation en cliquant sur un point.{' '}
                <strong>Tous les champs sont optionnels.</strong>{' '}
                Si un aspect ne s'applique pas, cliquez sur "N/A".
              </p>
              {DIMENSIONS.map(dim => {
                const val = ratings[dim.key];
                const hasVal = val !== null && val !== undefined;
                return (
                  <div key={dim.key} className={`tm-dimension ${hasVal ? 'has-value' : ''}`}>
                    <div className="tm-dim-header">
                      <div>
                        <div className="tm-dim-title">{dim.label}</div>
                        <div className="tm-dim-desc">{dim.desc}</div>
                      </div>
                      {val !== null && val !== undefined && val !== 0 && (
                        <span className={`tm-dim-label ${RATING_CLASSES[val]}`}>
                          {RATING_LABELS[val]}
                        </span>
                      )}
                      {val === 0 && <span className="tm-dim-label" style={{ color: '#888' }}>N/A</span>}
                    </div>
                    <div className="tm-dim-controls">
                      <div className="tm-circles">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            className={`tm-circle ${val === n ? 'active' : ''}`}
                            onClick={() => setRating(dim.key, n)}
                            title={RATING_LABELS[n]}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <button
                        className={`tm-na-btn ${val === 0 ? 'active' : ''}`}
                        onClick={() => setNA(dim.key)}
                      >
                        N/A
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ STEP 3 — Témoignage ══ */}
          {step === 3 && (
            <div className="tm-step-content">
              <p className="tm-step-intro">
                Décrivez librement votre expérience. Ce texte sera affiché publiquement sous votre prénom anonymisé.{' '}
                <strong>Champ optionnel.</strong>
              </p>
              <div className="tm-textarea-wrap">
                <textarea
                  className="tm-textarea"
                  placeholder={`"Votre consultation d'orientation avec ${avocatName} était… Décrivez ce qui vous a aidé, ce que vous avez apprécié ou ce qui pourrait être amélioré."`}
                  value={texte}
                  onChange={e => setTexte(e.target.value.slice(0, 1000))}
                  maxLength={1000}
                />
                <div className={`tm-char-count ${texte.length > 850 ? 'near' : ''}`}>
                  {texte.length} / 1000
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 4 — Consentement ══ */}
          {step === 4 && (
            <div className="tm-step-content">
              <div className="tm-preview-box">
                <div className="tm-preview-hint">👁 Voici comment votre témoignage sera affiché publiquement :</div>
                <div className="tm-preview-author">
                  <span className="tm-preview-badge">Prénom A.</span>
                  <span className="tm-preview-meta">
                    {specialty || 'Droit'} · {aptDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className={`tm-preview-text ${!texte.trim() ? 'empty' : ''}`}>
                  "{texte.trim() || 'Votre témoignage apparaîtra ici.'}"
                </div>
              </div>

              <div className="tm-consents">
                <label className={`tm-consent-item ${consent1 ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={consent1}
                    onChange={e => setConsent1(e.target.checked)}
                  />
                  <span className="tm-consent-label">
                    Je confirme que ce témoignage décrit uniquement mon expérience lors de la consultation
                    du {shortDate} et ne contient aucune information confidentielle liée à mon dossier. *
                  </span>
                </label>

                <label className={`tm-consent-item ${consent2 ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={consent2}
                    onChange={e => setConsent2(e.target.checked)}
                  />
                  <span className="tm-consent-label">
                    J'accepte que mon témoignage anonymisé soit publié sur le profil public de {avocatName},
                    conformément à la politique des témoignages et à la loi INPDP 2004-63. *
                  </span>
                </label>

                <label className={`tm-consent-item ${consent3 ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={consent3}
                    onChange={e => setConsent3(e.target.checked)}
                  />
                  <span className="tm-consent-label">
                    J'autorise l'utilisation de mon témoignage anonymisé à des fins statistiques agrégées.
                    <span className="tm-consent-optional">(facultatif)</span>
                  </span>
                </label>
              </div>

              <div className="tm-warning-box">
                <span>⚠️</span>
                <p>
                  Une fois soumis, votre témoignage ne peut pas être modifié. Il sera examiné sous 48h.
                  Si vous souhaitez le retirer après publication, contactez le support.
                </p>
              </div>

              {error && (
                <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12, fontFamily: 'DM Sans, sans-serif' }}>
                  {error}
                </p>
              )}
            </div>
          )}

          {/* ══ STEP 5 — Envoyé ══ */}
          {step === 5 && (
            <div className="tm-success">
              <div className="tm-success-badge">
                <div className="tm-success-badge-label">Avis déposé</div>
                <div className="tm-success-badge-ref">{reference}</div>
              </div>
              <h2 className="tm-success-title">Témoignage enregistré</h2>
              <p className="tm-success-subtitle">
                Votre témoignage a été reçu et sera examiné par notre équipe sous 48 heures.
              </p>
              <div className="tm-success-steps">
                <div className="tm-success-step">
                  <div className="tm-success-step-icon done">✅</div>
                  <div className="tm-success-step-label">Soumis</div>
                </div>
                <div className="tm-success-line" />
                <div className="tm-success-step">
                  <div className="tm-success-step-icon next">🔍</div>
                  <div className="tm-success-step-label">Vérification</div>
                </div>
                <div className="tm-success-line" />
                <div className="tm-success-step">
                  <div className="tm-success-step-icon next">🌐</div>
                  <div className="tm-success-step-label">Publication</div>
                </div>
              </div>
              <button className="tm-btn-close-final" onClick={onClose}>Fermer</button>
            </div>
          )}
        </div>

        {/* ── footer ── */}
        {step < 5 && (
          <div className="tm-footer">
            <span className="tm-footer-hint">
              {step === 4 ? '🔒 Lecture requise avant envoi' : `Étape ${step} sur 4`}
            </span>
            <div className="tm-footer-btns">
              {step > 1 && (
                <button className="tm-btn-prev" onClick={() => setStep(s => s - 1)}>
                  ← Précédent
                </button>
              )}
              <button
                className="tm-btn-next"
                onClick={handleNext}
                disabled={!canNext() || submitting}
              >
                {submitting ? 'Envoi…' : step === 4 ? 'Soumettre →' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
