import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './AnnouncementTicker.css';

/**
 * AnnouncementTicker
 *
 * Props:
 *  - items      : { key: string, fallback: string }[]
 *                  — fallback is used as-is when the i18n key is missing.
 *                    Pass an already-interpolated string (e.g. "49 places restantes")
 *                    for dynamic values.
 *  - ctaKey     : string    — i18n key for button label
 *  - ctaFallback: string    — fallback text for button
 *  - ctaPath    : string    — react-router path on button click
 *  - onCtaClick : () => void — custom click handler, overrides ctaPath
 *  - speed      : number    — animation duration in seconds (default: 28)
 */
const AnnouncementTicker = ({
  items,
  ctaKey = 'ticker.cta',
  ctaFallback = 'Réserver ma place →',
  ctaPath = '/foundingMembers/onboarding',
  onCtaClick,
  speed = 28,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const defaultItems = [
    { key: 'ticker.item_places',  fallback: 'Invitation exclusive · Offre de lancement' },
    { key: 'ticker.item_tarif',   fallback: 'Tarif fondateur gelé à vie' },
    { key: 'ticker.item_offre',   fallback: "Offre valable jusqu'au 30 avril 2026" },
    { key: 'ticker.item_badge',   fallback: 'Badge professionnel visible par tous' },
    { key: 'ticker.item_statut',  fallback: 'Statut permanent garanti' },
  ];

  const tickerItems = items ?? defaultItems;
  const loopedItems = [...tickerItems, ...tickerItems];

  const handleClick = () => {
    if (onCtaClick) {
      onCtaClick();
    } else {
      navigate(ctaPath);
    }
  };

  // Resolve label: if the i18n key returns the key itself (missing),
  // fall back to the pre-interpolated fallback string.
  const resolveLabel = (key, fallback) => {
    const translated = t(key, fallback);
    return (translated === key || translated.includes('{{')) ? fallback : translated;
  };

  return (
    <div className="ann-ticker">

      <div className="ann-ticker__zone">
        <div
          className="ann-ticker__track"
          style={{ animationDuration: `${speed}s` }}
        >
          {loopedItems.map((item, i) => (
            <span key={i} className="ann-ticker__item">
              <span className="ann-ticker__dot" />
              {resolveLabel(item.key, item.fallback)}
            </span>
          ))}
        </div>
      </div>

      <div className="ann-ticker__cta-zone">
        <button className="ann-ticker__cta" onClick={handleClick}>
          {resolveLabel(ctaKey, ctaFallback)}
        </button>
      </div>

    </div>
  );
};

export default AnnouncementTicker;