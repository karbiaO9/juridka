import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Pricing.css';

const PLANS = [
  {
    id: 'essentiel',
    labelKey: 'pricing.plan_essentiel',
    labelFallback: 'ESSENTIEL',
    oldPrice: '720 DT',
    newPrice: '504',
    period: '/an',
    monthlyKey: 'pricing.essentiel_monthly',
    monthlyFallback: 'soit 42 DT/mois · au lieu de 60 DT',
    discount: '-30% fondateur',
    recommended: false,
    features: [
      { key: 'pricing.essentiel_f1', fallback: 'Profil vérifié ONAT · badge visible', highlight: false },
      { key: 'pricing.essentiel_f2', fallback: 'Prise de rendez-vous en ligne', highlight: false },
      { key: 'pricing.essentiel_f3', fallback: 'Calendrier de disponibilité', highlight: false },
      { key: 'pricing.essentiel_f4', fallback: 'Confirmations automatiques J−1 et H−3', highlight: false },
      { key: 'pricing.essentiel_f5', fallback: 'Notifications clients email/SMS', highlight: false },
      { key: 'pricing.essentiel_f6', fallback: 'Badge Membre Fondateur permanent', highlight: true },
    ],
    ctaKey: 'pricing.cta_essentiel',
    ctaFallback: 'Choisir Essentiel →',
  },
  {
    id: 'professionnel',
    labelKey: 'pricing.plan_professionnel',
    labelFallback: 'PROFESSIONNEL',
    oldPrice: '1 080 DT',
    newPrice: '756',
    period: '/an',
    monthlyKey: 'pricing.pro_monthly',
    monthlyFallback: 'soit 63 DT/mois · au lieu de 90 DT',
    discount: '-30% fondateur',
    recommended: true,
    recommendedKey: 'pricing.recommended',
    recommendedFallback: 'Recommandé',
    features: [
      { key: 'pricing.pro_f1', fallback: 'Tout Essentiel inclus', highlight: false },
      { key: 'pricing.pro_f2', fallback: 'Statistiques détaillées du profil', highlight: false },
      { key: 'pricing.pro_f3', fallback: 'Tableau de bord analytique', highlight: false },
      { key: 'pricing.pro_f4', fallback: 'Urgences 24/7 opt-in', highlight: false },
      { key: 'pricing.pro_f5', fallback: 'Réseau Pro — délégation & substitution', highlight: false },
      { key: 'pricing.pro_f6', fallback: 'Export agenda iCal / Google Calendar', highlight: false },
      { key: 'pricing.pro_f7', fallback: 'Badge Membre Fondateur · accès bêta', highlight: true },
    ],
    ctaKey: 'pricing.cta_pro',
    ctaFallback: 'Choisir Professionnel →',
  },
  {
    id: 'cabinet',
    labelKey: 'pricing.plan_cabinet',
    labelFallback: 'CABINET',
    oldPrice: '2 160 DT',
    newPrice: '1 512',
    period: '/an',
    monthlyKey: 'pricing.cabinet_monthly',
    monthlyFallback: 'soit 126 DT/mois · au lieu de 180 DT',
    discount: '-30% fondateur',
    recommended: false,
    features: [
      { key: 'pricing.cabinet_f1', fallback: 'Tout Professionnel · 3 profils', highlight: false },
      { key: 'pricing.cabinet_f2', fallback: 'Page cabinet dédiée', highlight: false },
      { key: 'pricing.cabinet_f3', fallback: 'Compte assistant accès restreint', highlight: false },
      { key: 'pricing.cabinet_f4', fallback: 'Agenda centralisé — 3 avocats', highlight: false },
      { key: 'pricing.cabinet_f5', fallback: 'Tableau de bord cabinet consolidé', highlight: false },
      { key: 'pricing.cabinet_f6', fallback: '3 badges Fondateurs · facturation groupée', highlight: true },
    ],
    ctaKey: 'pricing.cta_cabinet',
    ctaFallback: 'Choisir Cabinet →',
  },
];

export default function PricingPlans() {
  const { t } = useTranslation();
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="pricing"
      className={`pp-section ${visible ? 'pp-section--visible' : ''}`}
      ref={sectionRef}
    >
      <div className="pp-bg-orb pp-bg-orb--1" />
      <div className="pp-bg-orb pp-bg-orb--2" />

      <div className="pp-container">
        {/* Header */}
        <div className="pp-header">
          <div className="pp-label">
            <span className="pp-label__line" />
            <span className="pp-label__text">{t('pricing.label', 'TARIFS FONDATEURS')}</span>
          </div>
          <h2 className="pp-headline">
            {t('pricing.headline_prefix', 'Tarif gelé au lancement,')}{' '}
            <em className="pp-headline__accent">
              {t('pricing.headline_accent', 'pour toujours')}
            </em>
          </h2>
          <p className="pp-description">
            {t(
              'pricing.description',
              "Les tarifs publics augmenteront au lancement officiel. En tant que membre fondateur, votre tarif est garanti contractuellement, quelle que soit l'évolution des prix."
            )}
          </p>
        </div>

        {/* Cards */}
        <div className="pp-cards">
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={`pp-card ${plan.recommended ? 'pp-card--featured' : ''}`}
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              {plan.recommended && (
                <span className="pp-badge-recommended">
                  {t(plan.recommendedKey, plan.recommendedFallback)}
                </span>
              )}

              <div className="pp-card__top">
                <span className="pp-card__label">{t(plan.labelKey, plan.labelFallback)}</span>

                <div className="pp-card__pricing">
                  <span className="pp-card__old-price">{plan.oldPrice}</span>
                  <span className="pp-card__new-price">
                    {plan.newPrice}
                    <span className="pp-card__currency"> DT</span>
                    <span className="pp-card__period">{plan.period}</span>
                  </span>
                </div>

                <div className="pp-card__monthly">{t(plan.monthlyKey, plan.monthlyFallback)}</div>

                <div className="pp-card__discount">
                  <span className="pp-discount-dot" />
                  {t('pricing.discount', plan.discount)}
                </div>
              </div>

              <ul className="pp-card__features">
                {plan.features.map((f, j) => (
                  <li
                    key={j}
                    className={`pp-feature ${f.highlight ? 'pp-feature--highlight' : ''}`}
                  >
                    <span className="pp-feature__dash">{f.highlight ? '+' : '—'}</span>
                    {t(f.key, f.fallback)}
                  </li>
                ))}
              </ul>

              <button
                className={`pp-cta ${plan.recommended ? 'pp-cta--primary' : 'pp-cta--secondary'}`}
                onClick={() => {
                  const el = document.getElementById('registration');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {t(plan.ctaKey, plan.ctaFallback)}
              </button>
            </div>
          ))}
        </div>

        {/* Guarantee banner */}
        <div className="pp-guarantee">
          <span className="pp-guarantee__icon">🔒</span>
          <div className="pp-guarantee__text">
            <strong className="pp-guarantee__title">
              {t('pricing.guarantee_title', 'Garantie de tarif écrite')}
            </strong>
            <p className="pp-guarantee__desc">
              {t(
                'pricing.guarantee_desc',
                "Votre tarif fondateur est mentionné dans votre convention d'abonnement. Juridika.tn s'engage contractuellement à ne jamais augmenter votre tarif annuel tant que vous maintenez votre abonnement actif."
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}