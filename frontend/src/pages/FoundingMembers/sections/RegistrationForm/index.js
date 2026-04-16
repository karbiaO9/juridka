import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { foundingMemberAPI } from '../../../../services/api';
import './RegistrationForm.css';

const BARREAUX = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
  'Bizerte', 'Béja', 'Jendouba', 'Kef', 'Siliana', 'Sousse',
  'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid',
  'Gabès', 'Medenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili',
];

const PLANS = [
  { id: 'essentiel',     labelKey: 'form.plan_essentiel',     labelFallback: 'Essentiel',     priceKey: 'form.price_essentiel',     priceFallback: '504 DT/an' },
  { id: 'professionnel', labelKey: 'form.plan_professionnel', labelFallback: 'Professionnel', priceKey: 'form.price_professionnel', priceFallback: '756 DT/an' },
  { id: 'cabinet',       labelKey: 'form.plan_cabinet',       labelFallback: 'Cabinet',       priceKey: 'form.price_cabinet',       priceFallback: '1 512 DT/an' },
];

export default function RegistrationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [spotsStats, setSpotsStats] = useState({ remaining: null, total: 50 });

  const [fields, setFields] = useState({
    prenom: '', nom: '', email: '', telephone: '', barreau: '', plan: 'essentiel',
    checkOnat: false, checkContact: false,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    foundingMemberAPI.getStats()
      .then((data) => setSpotsStats({ remaining: data.remaining ?? 50, total: data.total ?? 50 }))
      .catch(() => setSpotsStats({ remaining: 50, total: 50 }));
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const set = (key, val) => {
    setFields(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!fields.prenom.trim())    e.prenom    = t('form.err_required', 'Champ requis');
    if (!fields.nom.trim())       e.nom       = t('form.err_required', 'Champ requis');
    if (!fields.email.trim() || !/\S+@\S+\.\S+/.test(fields.email))
      e.email = t('form.err_email', 'Email invalide');
    if (!fields.telephone.trim()) e.telephone = t('form.err_required', 'Champ requis');
    if (!fields.barreau)          e.barreau   = t('form.err_select', 'Veuillez sélectionner');
    if (!fields.checkOnat)        e.checkOnat   = t('form.err_required', 'Requis');
    if (!fields.checkContact)     e.checkContact = t('form.err_required', 'Requis');
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    navigate('/foundingMembers/onboarding', {
      state: {
        firstName: fields.prenom,
        lastName:  fields.nom,
        email:     fields.email,
        phone:     fields.telephone,
        plan:      fields.plan,
      },
    });
  };

  return (
    <section
      id="registration"
      className={`rf-section ${visible ? 'rf-section--visible' : ''}`}
      ref={sectionRef}
    >
      <div className="rf-bg-orb rf-bg-orb--1" />
      <div className="rf-bg-orb rf-bg-orb--2" />

      <div className="rf-container">
        {/* Header */}
        <div className="rf-header">
          <div className="rf-label">
            <span className="rf-label__line" />
            <span className="rf-label__text">{t('form.label', 'RÉSERVER VOTRE PLACE')}</span>
          </div>
          <h2 className="rf-headline">
            {t('form.headline_prefix', 'Je rejoins les')}{' '}
            <em className="rf-headline__accent">
              {t('form.headline_accent', 'Membres Fondateurs')}
            </em>
          </h2>
        </div>

        {/* Form card */}
        <div className="rf-card">
          {/* Spots banner */}
          <div className="rf-spots-banner">
            {t('form.spots_prefix', 'Il reste')}{' '}
            <strong className="rf-spots-banner__number">
              {spotsStats.remaining === null ? '…' : spotsStats.remaining}
            </strong>{' '}
            {t('form.spots_suffix', `places fondateurs sur ${spotsStats.total}`)}
          </div>

          {/* Row 1 */}
          <div className="rf-row">
            <div className={`rf-field ${errors.prenom ? 'rf-field--error' : ''}`}>
              <label className="rf-label-field">
                {t('form.prenom', 'Prénom')} <span className="rf-required">*</span>
              </label>
              <input
                className="rf-input"
                type="text"
                placeholder={t('form.prenom_placeholder', 'Sarra')}
                value={fields.prenom}
                onChange={e => set('prenom', e.target.value)}
              />
              {errors.prenom && <span className="rf-error">{errors.prenom}</span>}
            </div>
            <div className={`rf-field ${errors.nom ? 'rf-field--error' : ''}`}>
              <label className="rf-label-field">
                {t('form.nom', 'Nom')} <span className="rf-required">*</span>
              </label>
              <input
                className="rf-input"
                type="text"
                placeholder={t('form.nom_placeholder', 'Ben Salah')}
                value={fields.nom}
                onChange={e => set('nom', e.target.value)}
              />
              {errors.nom && <span className="rf-error">{errors.nom}</span>}
            </div>
          </div>

          {/* Row 2 */}
          <div className="rf-row">
            <div className={`rf-field ${errors.email ? 'rf-field--error' : ''}`}>
              <label className="rf-label-field">
                {t('form.email', 'Email professionnel')} <span className="rf-required">*</span>
              </label>
              <input
                className="rf-input"
                type="email"
                placeholder={t('form.email_placeholder', 'sarra.bensalah@cabinet.tn')}
                value={fields.email}
                onChange={e => set('email', e.target.value)}
              />
              {errors.email && <span className="rf-error">{errors.email}</span>}
            </div>
            <div className={`rf-field ${errors.telephone ? 'rf-field--error' : ''}`}>
              <label className="rf-label-field">
                {t('form.telephone', 'Téléphone')} <span className="rf-required">*</span>
              </label>
              <input
                className="rf-input"
                type="tel"
                placeholder={t('form.tel_placeholder', '+216 XX XXX XXX')}
                value={fields.telephone}
                onChange={e => set('telephone', e.target.value)}
              />
              {errors.telephone && <span className="rf-error">{errors.telephone}</span>}
            </div>
          </div>

          {/* Barreau */}
          <div className={`rf-field ${errors.barreau ? 'rf-field--error' : ''}`}>
            <label className="rf-label-field">
              {t("form.barreau", "Barreau d'inscription")} <span className="rf-required">*</span>
            </label>
            <div className="rf-select-wrap">
              <select
                className="rf-select"
                value={fields.barreau}
                onChange={e => set('barreau', e.target.value)}
              >
                <option value="">{t('form.barreau_placeholder', '— Sélectionner —')}</option>
                {BARREAUX.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <span className="rf-select-arrow">▾</span>
            </div>
            {errors.barreau && <span className="rf-error">{errors.barreau}</span>}
          </div>

          {/* Plan selector */}
          <div className="rf-field">
            <label className="rf-label-field">
              {t('form.offre', 'Offre choisie')} <span className="rf-required">*</span>
            </label>
            <div className="rf-plans">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  type="button"
                  className={`rf-plan-btn ${fields.plan === plan.id ? 'rf-plan-btn--active' : ''}`}
                  onClick={() => set('plan', plan.id)}
                >
                  <span className="rf-plan-btn__name">{t(plan.labelKey, plan.labelFallback)}</span>
                  <span className="rf-plan-btn__price">{t(plan.priceKey, plan.priceFallback)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Checkboxes */}
          <div className="rf-checks">
            <label className={`rf-check ${errors.checkOnat ? 'rf-check--error' : ''}`}>
              <input
                type="checkbox"
                className="rf-check__input"
                checked={fields.checkOnat}
                onChange={e => set('checkOnat', e.target.checked)}
              />
              <span className="rf-check__box" />
              <span className="rf-check__text">
                {t('form.check_onat', "Je confirme être avocat inscrit à l'ONAT et je m'engage à fournir mes justificatifs (patente, diplôme) lors de la vérification de mon profil.")}{' '}
                <a className="rf-link" href="#faq">{t('form.learn_more', 'En savoir plus')}</a>
              </span>
            </label>

            <label className={`rf-check ${errors.checkContact ? 'rf-check--error' : ''}`}>
              <input
                type="checkbox"
                className="rf-check__input"
                checked={fields.checkContact}
                onChange={e => set('checkContact', e.target.checked)}
              />
              <span className="rf-check__box" />
              <span className="rf-check__text">
                {t('form.check_contact', "J'accepte que Juridika.tn me contacte pour confirmer mon inscription et activer mon compte fondateur.")}
              </span>
            </label>
          </div>

          {/* Submit */}
          <button className="rf-submit" type="button" onClick={handleSubmit}>
            {t('form.submit', 'Réserver ma place fondateur')} →
          </button>
          {errors.submit && (
            <p style={{ color: '#ef4444', fontSize: '0.82rem', textAlign: 'center', marginTop: '8px' }}>
              {errors.submit}
            </p>
          )}

          {/* Trust line */}
          <p className="rf-trust">
            🔒 {t('form.trust', 'Aucun paiement maintenant · Activation à la mise en ligne · Tarif garanti par contrat')}
          </p>
        </div>
      </div>
    </section>
  );
}