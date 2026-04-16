import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './ReseauPro.css';

const FEATURES = [
  { icon: '📁', iconBg: '#c9a84c', titleKey: 'homepage.reseauPro.feature1.title', descKey: 'homepage.reseauPro.feature1.desc' },
  { icon: '⚖️', iconBg: '#2a3f62', titleKey: 'homepage.reseauPro.feature2.title', descKey: 'homepage.reseauPro.feature2.desc' },
  { icon: '🔍', iconBg: '#3d2f62', titleKey: 'homepage.reseauPro.feature3.title', descKey: 'homepage.reseauPro.feature3.desc' },
];

const ReseauPro = () => {
  const { t } = useTranslation();
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const targets = section.querySelectorAll(
      '.rp-pre-title, .rp-title, .rp-subtitle, .rp-feature, .rp-access-card'
    );
    targets.forEach((el, i) => el.style.setProperty('--rp-delay', `${i * 100}ms`));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="reseau-pro" className="rp-section" ref={sectionRef}>
      <div className="container">
        <div className="rp-layout">

          {/* ── Left column ─────────────────────────────────── */}
          <div className="rp-left">

            <span className="rp-pre-title">{t('homepage.reseauPro.preTitle')}</span>

            <h2 className="rp-title">{t('homepage.reseauPro.title')}</h2>

            <p className="rp-subtitle">{t('homepage.reseauPro.subtitle')}</p>

            <div className="rp-features">
              {FEATURES.map((f, i) => (
                <div className="rp-feature" key={i}>
                  <div className="rp-feature-icon" style={{ background: f.iconBg }}>
                    {f.icon}
                  </div>
                  <div className="rp-feature-body">
                    <div className="rp-feature-title">{t(f.titleKey)}</div>
                    <p className="rp-feature-desc">{t(f.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* ── Right column — access card ───────────────────── */}
          <div className="rp-right">
            <div className="rp-access-card">

              <h3 className="rp-access-title">{t('homepage.reseauPro.card.title')}</h3>

              <p className="rp-access-desc">{t('homepage.reseauPro.card.desc')}</p>

              <div className="rp-access-badges">
                <span className="rp-plan-badge">{t('homepage.reseauPro.card.plan1')}</span>
                <span className="rp-plan-badge">{t('homepage.reseauPro.card.plan2')}</span>
              </div>

              <div className="rp-access-divider" />

              <p className="rp-access-note">{t('homepage.reseauPro.card.note')}</p>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ReseauPro;