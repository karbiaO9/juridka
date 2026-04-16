import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { foundingMemberAPI } from '../../../../services/api';
import './Hero.css';

const DEFAULT_TOTAL = 50;

export default function FoundingMember() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ total: DEFAULT_TOTAL, taken: 0, remaining: DEFAULT_TOTAL });
  const [animatedRemaining, setAnimatedRemaining] = useState(0);
  const [animatedTaken, setAnimatedTaken] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const sectionRef = useRef(null);
  const hasAnimated = useRef(false);
  const statsRef = useRef(stats);

  // Fetch real stats from backend
  useEffect(() => {
    foundingMemberAPI.getStats()
      .then((data) => {
        setStats(data);
        statsRef.current = data;
        // If section already visible, re-trigger animation with real values
        if (hasAnimated.current) {
          animateCounters(data);
        }
      })
      .catch(() => {/* keep defaults on error */});
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animateCounters(statsRef.current);
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const animateCounters = (s) => {
    const total     = s?.total     ?? DEFAULT_TOTAL;
    const taken     = s?.taken     ?? 0;
    const remaining = s?.remaining ?? total;

    const duration = 1200;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedRemaining(Math.round(eased * remaining));
      setAnimatedTaken(Math.round(eased * taken));
      setProgressWidth(eased * (taken / total) * 100);
      if (step >= steps) clearInterval(timer);
    }, interval);
  };

  return (
    <section className="fm-section" ref={sectionRef}>
      {/* Ambient background orbs */}
      <div className="fm-bg-orb fm-bg-orb--1" />
      <div className="fm-bg-orb fm-bg-orb--2" />
      <div className="fm-bg-orb fm-bg-orb--3" />

      <div className="fm-content">
        {/* Badge */}
        <div className="fm-badge">
          <span className="fm-badge__line" />
          <span className="fm-badge__text">
            {t('founding.badge', 'INVITATION EXCLUSIVE · OFFRE DE LANCEMENT')}
          </span>
          <span className="fm-badge__line" />
        </div>

        {/* Headline */}
        <h1 className="fm-headline">
          {t('founding.headline_prefix', 'Devenez')}{' '}
          <em className="fm-headline__accent">
            {t('founding.headline_accent', 'Membre Fondateur')}
          </em>
          <br />
          {t('founding.headline_suffix', 'de Juridika.tn')}
        </h1>

        {/* Description */}
        <p className="fm-description">
          {t(
            'founding.description',
            "Les 50 premiers avocats qui rejoignent Juridika.tn bénéficient d'un statut permanent, d'un tarif garanti à vie, et d'un badge professionnel visible par tous les justiciables sur leur profil."
          )}
        </p>

        {/* Stats card */}
        <div className="fm-stats">
          <div className="fm-stats__remaining">
            <span className="fm-stats__number">{animatedRemaining}</span>
            <span className="fm-stats__label">
              {t('founding.places_restantes', 'PLACES RESTANTES')}
            </span>
          </div>

          <div className="fm-stats__divider" />

          <div className="fm-stats__members">
            <span className="fm-stats__members-title">
              {t('founding.membres_fondateurs', 'Membres Fondateurs')}
            </span>
            <span className="fm-stats__members-sub">
              {animatedTaken}{' '}
              {t('founding.avocats_rejoints', 'avocats ont déjà rejoint')}
            </span>
            <div className="fm-progress-track">
              <div
                className="fm-progress-fill"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="fm-actions">
          <button
            className="fm-btn fm-btn--primary"
            onClick={() => navigate('/foundingMembers/onboarding')}
          >
            {t('founding.cta_primary', 'Réserver ma place fondateur')}
            <span className="fm-btn__arrow">→</span>
          </button>
          <button
            className="fm-btn fm-btn--secondary"
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('founding.cta_secondary', 'Voir les avantages')}
          </button>
        </div>

        {/* Deadline notice */}
        <div className="fm-deadline">
          <span className="fm-deadline__dot" />
          <span className="fm-deadline__text">
            {t(
              'founding.deadline',
              "Offre ouverte jusqu'au 30 avril 2026 ou jusqu'aux 50 membres"
            )}
          </span>
        </div>
      </div>
    </section>
  );
}