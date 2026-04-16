import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Badge.css';

const BENEFITS = [
  {
    key: '01',
    titleKey: 'badge.benefit1_title',
    titleFallback: 'Tarif préférentiel garanti à vie',
    descKey: 'badge.benefit1_desc',
    descFallback:
      "Votre tarif d'abonnement est gelé au tarif fondateur, même si les prix augmentent lors du lancement officiel. Garantie contractuelle.",
  },
  {
    key: '02',
    titleKey: 'badge.benefit2_title',
    titleFallback: 'Badge permanent sur votre profil',
    descKey: 'badge.benefit2_desc',
    descFallback:
      'Le badge "Membre Fondateur #XXXX" est affiché à vie sur votre profil public. Il distingue les pionniers de la plateforme auprès des justiciables.',
  },
  {
    key: '03',
    titleKey: 'badge.benefit3_title',
    titleFallback: 'Accès prioritaire aux nouvelles fonctionnalités',
    descKey: 'badge.benefit3_desc',
    descFallback:
      'Les membres fondateurs testent et valident chaque nouvelle fonctionnalité avant le déploiement général. Votre avis façonne le produit.',
  },
  {
    key: '04',
    titleKey: 'badge.benefit4_title',
    titleFallback: 'Numéro de série unique — non transférable',
    descKey: 'badge.benefit4_desc',
    descFallback:
      'Chaque membre reçoit un numéro fondateur (#0001 à #0050). Ce numéro est permanent, lié à votre compte, et non cessible.',
  },
  {
    key: '05',
    titleKey: 'badge.benefit5_title',
    titleFallback: "Réseau fondateurs — canal direct avec l'équipe",
    descKey: 'badge.benefit5_desc',
    descFallback:
      "Canal WhatsApp/Signal privé avec Jawaher Chatbri (CEO) et l'équipe produit. Remontée de bugs, demandes de fonctionnalités, support prioritaire.",
  },
];

export default function FoundingBadge() {
  const { t } = useTranslation();
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={`fb-section ${visible ? 'fb-section--visible' : ''}`} ref={sectionRef}>
      <div className="fb-bg-orb fb-bg-orb--1" />
      <div className="fb-bg-orb fb-bg-orb--2" />

      <div className="fb-container">
        {/* ── Left Column ── */}
        <div className="fb-left">
          {/* Section label */}
          <div className="fb-label">
            <span className="fb-label__line" />
            <span className="fb-label__text">{t('badge.label', 'LE BADGE FONDATEUR')}</span>
          </div>

          {/* Headline */}
          <h2 className="fb-headline">
            {t('badge.headline_prefix', 'Un statut permanent,')}{' '}
            <em className="fb-headline__accent">
              {t('badge.headline_accent', 'affiché à vie')}
            </em>
          </h2>

          {/* Description */}
          <p className="fb-description">
            {t(
              'badge.description',
              "Le badge Membre Fondateur apparaît sur votre profil public, visible par tous les justiciables qui vous recherchent. Il signale votre rôle dans la construction de l'accès au droit en Tunisie."
            )}
          </p>

          {/* Badge medallion */}
          <div className="fb-medallion-wrap">
            <div className="fb-medallion">
              {/* Outer ring ticks */}
              <svg className="fb-medallion__ring" viewBox="0 0 220 220" fill="none">
                <circle cx="110" cy="110" r="106" stroke="rgba(201,151,44,0.3)" strokeWidth="1" strokeDasharray="3 6" />
                <circle cx="110" cy="110" r="94" stroke="rgba(201,151,44,0.15)" strokeWidth="1" />
              </svg>

              <div className="fb-medallion__inner">
                <div className="fb-medallion__stars">★ ★ ★</div>
                <div className="fb-medallion__site">JURIDIKA.TN</div>
                <div className="fb-medallion__title-block">
                  <span className="fb-medallion__title">Membre</span>
                  <span className="fb-medallion__title fb-medallion__title--accent">Fondateur</span>
                </div>
                <div className="fb-medallion__meta">
                  {t('badge.medallion_role', 'Avocat · Promotion 2026')}
                </div>
                <div className="fb-medallion__number">#0016 / 0050</div>
                <div className="fb-medallion__onat">✦ O N A T ✦</div>
              </div>
            </div>

            {/* Profile card preview */}
            
          </div>
        </div>

        {/* ── Right Column — Benefits ── */}
        <ul className="fb-benefits">
          {BENEFITS.map((b, i) => (
            <li
              className="fb-benefit"
              key={b.key}
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}
            >
              <div className="fb-benefit__number">{b.key}</div>
              <div className="fb-benefit__body">
                <h3 className="fb-benefit__title">{t(b.titleKey, b.titleFallback)}</h3>
                <p className="fb-benefit__desc">{t(b.descKey, b.descFallback)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}