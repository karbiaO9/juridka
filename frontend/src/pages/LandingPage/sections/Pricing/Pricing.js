import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Pricing.css';

const Pricing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sectionRef = useRef(null);

  const plans = [
    {
      plan: 'gratuit',
      price: '0',
      period: t('homepage.pricing.plans.gratuit.period', 'Présence permanente'),
      badge: null,
      highlight: false,
      features: [
        t('homepage.pricing.plans.gratuit.feature1', 'Profil vérifié ONAT (badge visible)'),
        t('homepage.pricing.plans.gratuit.feature2', 'Géolocalisation du cabinet'),
        t('homepage.pricing.plans.gratuit.feature3', 'Numéro de téléphone affiché'),
        t('homepage.pricing.plans.gratuit.feature4', 'Spécialité(s) et langues'),
      ],
      disabled: [
        t('homepage.pricing.plans.gratuit.disabled1', 'Prise de rendez-vous en ligne'),
        t('homepage.pricing.plans.gratuit.disabled2', 'Calendrier & disponibilités'),
        t('homepage.pricing.plans.gratuit.disabled3', 'Tableau de bord & statistiques'),
        t('homepage.pricing.plans.gratuit.disabled4', 'Réseau Pro'),
      ],
      cta: t('homepage.pricing.plans.gratuit.cta', 'Créer mon profil gratuit →'),
      ctaHighlight: false,
    },
    {
      plan: 'essentiel',
      price: '720',
      period: t('homepage.pricing.plans.essentiel.period', '/ an — soit 60 DT/mois'),
      periodAlt: t('homepage.pricing.plans.essentiel.periodAlt', 'ou 60 DT / mois sans engagement'),
      badge: t('homepage.pricing.plans.essentiel.badge', '14 JOURS GRATUITS'),
      highlight: false,
      features: [
        t('homepage.pricing.plans.essentiel.feature1', 'Tout Gratuit inclus'),
        t('homepage.pricing.plans.essentiel.feature2', 'Prise de rendez-vous en ligne'),
        t('homepage.pricing.plans.essentiel.feature3', 'Calendrier de disponibilité'),
        t('homepage.pricing.plans.essentiel.feature4', 'Confirmations automatiques J-1 et H-3'),
        t('homepage.pricing.plans.essentiel.feature5', 'Gestion des annulations & reports'),
        t('homepage.pricing.plans.essentiel.feature6', 'Fiche spécialité + langues parlées'),
        t('homepage.pricing.plans.essentiel.feature7', 'Notifications clients par email/SMS'),
      ],
      cta: t('homepage.pricing.plans.essentiel.cta', 'Essayer 14 jours gratuits →'),
      ctaHighlight: false,
    },
    {
      plan: 'professionnel',
      price: '1 080',
      period: t('homepage.pricing.plans.professionnel.period', '/ an — soit 90 DT/mois'),
      periodAlt: t('homepage.pricing.plans.professionnel.periodAlt', 'ou 90 DT / mois sans engagement'),
      badge: t('homepage.pricing.plans.professionnel.badge', 'LE PLUS POPULAIRE'),
      highlight: true,
      features: [
        t('homepage.pricing.plans.professionnel.feature1', 'Tout Essentiel inclus'),
        t('homepage.pricing.plans.professionnel.feature2', 'Statistiques détaillées du profil'),
        t('homepage.pricing.plans.professionnel.feature3', 'Tableau de bord analytique'),
        t('homepage.pricing.plans.professionnel.feature4', 'Urgences 24/7 opt-in'),
        t('homepage.pricing.plans.professionnel.feature5', 'Réseau Pro — délégation & substitution'),
        t('homepage.pricing.plans.professionnel.feature6', 'Gestion de plusieurs spécialités'),
        t('homepage.pricing.plans.professionnel.feature7', 'Export agenda (iCal / Google Calendar)'),
        t('homepage.pricing.plans.professionnel.feature8', 'Rappels automatiques clients post-RDV'),
      ],
      cta: t('homepage.pricing.plans.professionnel.cta', 'Essayer 14 jours gratuits →'),
      ctaHighlight: true,
    },
    {
      plan: 'cabinet',
      price: '2 160',
      period: t('homepage.pricing.plans.cabinet.period', '/ an · jusqu\'à 3 avocats'),
      periodAlt: t('homepage.pricing.plans.cabinet.periodAlt', 'ou 180 DT / mois · 3 profils'),
      badge: t('homepage.pricing.plans.cabinet.badge', '14 JOURS GRATUITS'),
      highlight: false,
      features: [
        t('homepage.pricing.plans.cabinet.feature1', 'Tout Professionnel inclus · 3 profils'),
        t('homepage.pricing.plans.cabinet.feature2', 'Page cabinet dédiée'),
        t('homepage.pricing.plans.cabinet.feature3', 'Compte assistant accès restreint'),
        t('homepage.pricing.plans.cabinet.feature4', 'Gestion centralisée des agendas'),
        t('homepage.pricing.plans.cabinet.feature5', 'Tableau de bord cabinet (stats consolidées)'),
        t('homepage.pricing.plans.cabinet.feature6', 'Réseau Pro pour tous les profils'),
        t('homepage.pricing.plans.cabinet.feature7', 'Facturation groupée — une facture mensuelle'),
      ],
      cta: t('homepage.pricing.plans.cabinet.cta', 'Essayer 14 jours gratuits →'),
      ctaHighlight: false,
    },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const cards = section.querySelectorAll('.pr-card');
    cards.forEach((card, i) => {
      card.style.setProperty('--card-delay', `${i * 120}ms`);
      const features = card.querySelectorAll('.pr-features li');
      features.forEach((li, j) => {
        li.style.setProperty('--feature-delay', `${i * 120 + 220 + j * 55}ms`);
      });
    });

    const targets = section.querySelectorAll(
      '.pr-pre-title, .pr-title, .pr-subtitle, .pr-card, .pr-payment-box'
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="pour-les-avocats" className="pr-section" ref={sectionRef}>
      <div className="container">

        {/* Header */}
        <div className="pr-header">
          <span className="pr-pre-title">
            {t('homepage.pricing.preTitle', 'Abonnements')}
          </span>
          <h2 className="pr-title">
            {t('homepage.pricing.title', 'Choisissez votre formule')}
          </h2>
          <p className="pr-subtitle">
            {t('homepage.pricing.subtitle', 'Aucune commission sur vos honoraires. Un abonnement fixe. Un profil professionnel vérifié et un réseau de collaboration entre confrères.')}
          </p>
        </div>

        {/* Plans grid — 4 columns */}
        <div className="pr-grid">
          {plans.map((item) => (
            <div
              key={item.plan}
              className={`pr-card${item.highlight ? ' pr-card--highlight' : ''}`}
            >
              {/* Badge */}
              {item.badge && (
                <div className={`pr-badge${item.highlight ? ' pr-badge--popular' : ''}`}>
                  {item.badge}
                </div>
              )}

              {/* Plan name */}
              <div className="pr-plan-name">
                {t(`homepage.pricing.plans.${item.plan}.name`, item.plan.toUpperCase())}
              </div>

              {/* Price */}
              <div className="pr-price-row">
                <span className="pr-amount">{item.price}</span>
                <span className="pr-currency">DT</span>
              </div>
              <div className="pr-period">{item.period}</div>
              {item.periodAlt && (
                <div className="pr-period-alt">{item.periodAlt}</div>
              )}

              {/* Divider */}
              <div className="pr-divider" />

              {/* Features */}
              <ul className="pr-features">
                {item.features.map((f, j) => (
                  <li key={j}>
                    <span className="pr-check">✓</span>
                    {f}
                  </li>
                ))}
                {item.disabled?.map((f, j) => (
                  <li key={`d${j}`} className="pr-feature--disabled">
                    <span className="pr-dash">—</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`pr-cta${item.ctaHighlight ? ' pr-cta--highlight' : ''}`}
                onClick={() => navigate('/signup')}
              >
                {item.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Payment info box */}
        <div className="pr-payment-box">
          <div className="pr-payment-col">
            <div className="pr-payment-heading">
              <span className="pr-payment-icon">💳</span>
              {t('homepage.pricing.payment.onlineTitle', 'PAIEMENT EN LIGNE (KONNECT / FLOUCI)')}
            </div>
            <ol className="pr-payment-steps">
              <li>
                <span className="pr-step-num">1</span>
                {t('homepage.pricing.payment.online1', 'Choisissez votre formule et procédez au paiement sécurisé.')}
              </li>
              <li>
                <span className="pr-step-num">2</span>
                {t('homepage.pricing.payment.online2', 'Votre compte est activé automatiquement dès confirmation.')}
              </li>
              <li>
                <span className="pr-step-num">3</span>
                {t('homepage.pricing.payment.online3', 'Une facture officielle est envoyée immédiatement par email.')}
              </li>
            </ol>
          </div>

          <div className="pr-payment-divider" />

          <div className="pr-payment-col">
            <div className="pr-payment-heading">
              <span className="pr-payment-icon">🏦</span>
              {t('homepage.pricing.payment.virementTitle', 'VIREMENT BANCAIRE')}
            </div>
            <ol className="pr-payment-steps">
              <li>
                <span className="pr-step-num">1</span>
                {t('homepage.pricing.payment.virement1', 'Effectuez votre virement et téléchargez le justificatif de paiement.')}
              </li>
              <li>
                <span className="pr-step-num">2</span>
                {t('homepage.pricing.payment.virement2', 'Notre équipe valide votre dossier sous 24h ouvrées.')}
              </li>
              <li>
                <span className="pr-step-num">3</span>
                {t('homepage.pricing.payment.virement3', 'Compte activé + facture officielle envoyée par email à la validation.')}
              </li>
            </ol>
          </div>
        </div>

        {/* Footer note */}
        <p className="pr-footer-note">
          <strong>{t('homepage.pricing.trialNote', 'Essai gratuit 14 jours')}</strong>
          {' — '}
          {t('homepage.pricing.trialSub', 'aucune carte bancaire requise. À l\'issue de l\'essai, le compte passe automatiquement en formule Gratuite si aucun abonnement n\'est souscrit.')}
        </p>

      </div>
    </section>
  );
};

export default Pricing;