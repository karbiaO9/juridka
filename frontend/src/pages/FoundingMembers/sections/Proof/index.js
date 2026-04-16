import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Proof.css';

const TESTIMONIALS = [
  {
    id: 'KM',
    quoteKey: 'social.quote1',
    quoteFallback:
      '"J\'attendais une solution comme celle-là depuis des années. Le fait qu\'il n\'y ait aucune commission sur mes honoraires a été l\'argument décisif."',
    nameKey: 'social.name1',
    nameFallback: 'Mᵉ Karim M.',
    specKey: 'social.spec1',
    specFallback: 'Droit commercial · Tunis',
    badgeKey: 'social.badge1',
    badgeFallback: 'Fondateur #0003',
  },
  {
    id: 'NT',
    quoteKey: 'social.quote2',
    quoteFallback:
      '"La vérification ONAT intégrée dans le processus d\'inscription m\'a convaincu que la plateforme est sérieuse sur la conformité déontologique."',
    nameKey: 'social.name2',
    nameFallback: 'Mᵉ Nadia T.',
    specKey: 'social.spec2',
    specFallback: 'Immigration · Sousse',
    badgeKey: 'social.badge2',
    badgeFallback: 'Fondatrice #0008',
  },
  {
    id: 'HR',
    quoteKey: 'social.quote3',
    quoteFallback:
      '"Je gère un cabinet avec deux associés. L\'offre Cabinet à −30% couvre les trois profils — c\'était une décision évidente."',
    nameKey: 'social.name3',
    nameFallback: 'Mᵉ Hatem R.',
    specKey: 'social.spec3',
    specFallback: 'Pénal · Sfax',
    badgeKey: 'social.badge3',
    badgeFallback: 'Fondateur #0012',
  },
];

const TIMELINE = [
  {
    dateKey: 'social.tl_date1',
    dateFallback: 'Mars 2026',
    titleKey: 'social.tl_title1',
    titleFallback: 'Campagne fondateurs ouverture des 50 places',
    active: true,
  },
  {
    dateKey: 'social.tl_date2',
    dateFallback: '30 Avr 2026',
    titleKey: 'social.tl_title2',
    titleFallback: 'Clôture offre fondateurs ou 50 membres atteints',
    active: false,
  },
  {
    dateKey: 'social.tl_date3',
    dateFallback: 'Mai 2026',
    titleKey: 'social.tl_title3',
    titleFallback: 'Onboarding fondateurs vérification ONAT',
    active: false,
  },
  {
    dateKey: 'social.tl_date4',
    dateFallback: 'Juin 2026',
    titleKey: 'social.tl_title4',
    titleFallback: 'Lancement bêta accès exclusif fondateurs',
    active: false,
  },
  {
    dateKey: 'social.tl_date5',
    dateFallback: 'Sept 2026',
    titleKey: 'social.tl_title5',
    titleFallback: 'Lancement officiel tarifs publics',
    active: false,
  },
];

export default function Proof() {
  const { t } = useTranslation();
  const testimonialsRef = useRef(null);
  const timelineRef = useRef(null);
  const [testiVisible, setTestiVisible] = useState(false);
  const [tlVisible, setTlVisible] = useState(false);

  useEffect(() => {
    const obs1 = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setTestiVisible(true); },
      { threshold: 0.15 }
    );
    const obs2 = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setTlVisible(true); },
      { threshold: 0.15 }
    );
    if (testimonialsRef.current) obs1.observe(testimonialsRef.current);
    if (timelineRef.current) obs2.observe(timelineRef.current);
    return () => { obs1.disconnect(); obs2.disconnect(); };
  }, []);

  return (
    <>
      {/* ── Testimonials Section ── */}
      <section
        className={`sp-section sp-testimonials ${testiVisible ? 'sp-section--visible' : ''}`}
        ref={testimonialsRef}
      >
        <div className="sp-bg-orb sp-bg-orb--left" />
        <div className="sp-bg-orb sp-bg-orb--right" />

        <div className="sp-container">
          {/* Header */}
          <div className="sp-header">
            <div className="sp-label">
              <span className="sp-label__line" />
              <span className="sp-label__text">
                {t('social.label', 'ILS ONT DÉJÀ REJOINT')}
              </span>
            </div>
            <h2 className="sp-headline">
              <em className="sp-headline__accent">
                {t('social.headline_accent', '16 avocats fondateurs')}
              </em>{' '}
              {t('social.headline_suffix', 'nous ont fait confiance')}
            </h2>
            <p className="sp-description">
              {t(
                'social.description',
                'Des professionnels de Tunis, Sousse et Sfax qui ont choisi de construire la plateforme avec nous.'
              )}
            </p>
          </div>

          {/* Cards */}
          <div className="sp-cards">
            {TESTIMONIALS.map((item, i) => (
              <div
                key={item.id}
                className="sp-card"
                style={{ transitionDelay: `${0.1 + i * 0.13}s` }}
              >
                <div className="sp-card__quote-mark">"</div>
                <p className="sp-card__quote">{t(item.quoteKey, item.quoteFallback)}</p>
                <div className="sp-card__author">
                  <div className="sp-avatar">{item.id}</div>
                  <div className="sp-card__author-info">
                    <span className="sp-card__name">{t(item.nameKey, item.nameFallback)}</span>
                    <span className="sp-card__spec">{t(item.specKey, item.specFallback)}</span>
                    <span className="sp-card__badge">
                      ★ {t(item.badgeKey, item.badgeFallback)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline Section ── */}
      <section
        className={`sp-section sp-timeline-section ${tlVisible ? 'sp-section--visible' : ''}`}
        ref={timelineRef}
      >
        <div className="sp-container sp-container--center">
          <div className="sp-label sp-label--center">
            <span className="sp-label__line" />
            <span className="sp-label__text">
              {t('social.tl_label', 'CALENDRIER DE LANCEMENT')}
            </span>
            <span className="sp-label__line" />
          </div>

          <div className="sp-timeline">
            {/* Connecting line */}
            <div className="sp-timeline__track">
              <div className="sp-timeline__progress" />
            </div>

            {TIMELINE.map((step, i) => (
              <div
                key={i}
                className={`sp-step ${step.active ? 'sp-step--active' : ''}`}
                style={{ transitionDelay: `${0.1 + i * 0.12}s` }}
              >
                <div className="sp-step__dot">
                  {step.active && <span className="sp-step__dot-inner" />}
                </div>
                <div className="sp-step__content">
                  <span className="sp-step__date">{t(step.dateKey, step.dateFallback)}</span>
                  <span className="sp-step__title">{t(step.titleKey, step.titleFallback)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}