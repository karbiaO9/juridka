import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Chatbot from '../../components/chatbot';
import { foundingMemberAPI } from '../../services/api';

import Hero from './sections/Hero/Hero';
import Processus from './sections/Processus/Processus';
import Clients from './sections/Clients/Clients';
import Trust from './sections/Trust/Trust';
import Pricing from './sections/Pricing/Pricing';
import Urgence from './sections/Urgence/Urgence';
import Diaspora from './sections/Diaspora/Diaspora';
import ReseauPro from './sections/ReseauPro';
import HowItWorks from './sections/Howitworks';
import FAQ from './sections/FAQ';
import './LandingPage.css';
import AnnouncementTicker from '../../components/AnnouncementTicker';

const LandingPage = () => {
  const { t } = useTranslation();
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
    { key: 'ticker.item_places',  fallback: placesText },
    { key: 'ticker.item_tarif',   fallback: 'Tarif fondateur gelé à vie' },
    { key: 'ticker.item_offre',   fallback: "Offre valable jusqu'au 30 avril 2026" },
    { key: 'ticker.item_badge',   fallback: 'Badge professionnel visible par tous' },
    { key: 'ticker.item_statut',  fallback: 'Statut permanent garanti' },
  ];

  return (
    <div className="homepage">
      <AnnouncementTicker
        items={tickerItems}
        ctaKey="ticker.cta"
        ctaFallback="Réserver ma place →"
        ctaPath="/foundingMembers"
      />

      <style>{`.navbar-root { top: 42px !important; }`}</style>

      <Navbar />
      <div style={{ marginTop: '122px' }}>
        <Hero />
        <Processus />
        <Clients />
        <Urgence />
        <Diaspora />
        <Trust />
        <Pricing />
        <ReseauPro />
        <HowItWorks />
        <FAQ />
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;