import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Hero from './sections/Hero';
import Badge from './sections/Badge';
import Pricing from './sections/Pricing';
import Proof from './sections/Proof';
import RegistrationForm from './sections/RegistrationForm';
import Footer from '../../components/Footer';
import { foundingMemberAPI } from '../../services/api';
import AnnouncementTicker from '../../components/AnnouncementTicker';

const FoundingMembersPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    foundingMemberAPI.getStats()
      .then((data) => setRemaining(data.remaining ?? 50))
      .catch(() => setRemaining(50));
  }, []);

  const placesText = remaining === null
    ? t('ticker.item_loading', '… places restantes')
    : t('ticker.item_places', { count: remaining, defaultValue: `${remaining} places restantes` });

  const tickerItems = [
    { key: 'ticker.item_places', fallback: placesText },
    { key: 'ticker.item_tarif', fallback: 'Tarif fondateur gelé à vie' },
    { key: 'ticker.item_offre', fallback: "Offre valable jusqu'au 30 avril 2026" },
    { key: 'ticker.item_badge', fallback: 'Badge professionnel visible par tous' },
    { key: 'ticker.item_statut', fallback: 'Statut permanent garanti' },
  ];

  return (
    <div className="FoundingMembersPage">
      <style>{`.navbar-root { top: 42px !important; }`}</style>

      <AnnouncementTicker
        items={tickerItems}
        ctaKey="ticker.cta"
        ctaFallback="Réserver ma place →"
        ctaPath="/foundingMembers/onboarding"
      />

      <Navbar />
      <div style={{ marginTop: '122px' }}>
        <Hero />
        <Badge />
        <Pricing />   
        <RegistrationForm />
        <Footer />
      </div>
    </div>
  );
};

export default FoundingMembersPage;