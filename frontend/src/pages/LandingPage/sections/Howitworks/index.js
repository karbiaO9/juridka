import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Howitworks.css';

const STEPS = [
  { num: 1, titleKey: 'homepage.howItWorks.step1.title', descKey: 'homepage.howItWorks.step1.desc' },
  { num: 2, titleKey: 'homepage.howItWorks.step2.title', descKey: 'homepage.howItWorks.step2.desc' },
  { num: 3, titleKey: 'homepage.howItWorks.step3.title', descKey: 'homepage.howItWorks.step3.desc' },
];

const HowItWorks = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const targets = section.querySelectorAll(
      '.hiw-pre-title, .hiw-title, .hiw-card, .hiw-cta-wrap'
    );
    targets.forEach((el, i) => el.style.setProperty('--hiw-delay', `${i * 120}ms`));

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
    <section id="rejoindre" className="hiw-section" ref={sectionRef}>
      <div className="container">

        {/* Header */}
        <div className="hiw-header">
          <span className="hiw-pre-title">{t('homepage.howItWorks.preTitle')}</span>
          <h2 className="hiw-title">{t('homepage.howItWorks.title')}</h2>
        </div>

        {/* Steps */}
        <div className="hiw-grid">
          {STEPS.map((step) => (
            <div className="hiw-card" key={step.num}>
              <div className="hiw-num">{step.num}</div>
              <div className="hiw-step-title">{t(step.titleKey)}</div>
              <p className="hiw-step-desc">{t(step.descKey)}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="hiw-cta-wrap">
          <button className="hiw-cta" onClick={() => navigate('/signup')}>
            {t('homepage.howItWorks.cta')}
          </button>
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;