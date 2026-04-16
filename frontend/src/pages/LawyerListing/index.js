import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import BookingModal from '../../components/BookingModal';
import { IoLocationSharp } from 'react-icons/io5';
import { GiGraduateCap } from 'react-icons/gi';
import { FaCalendarAlt, FaUser, FaSearch, FaTimes, FaChevronDown } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import AnimatedErrorBanner from '../../components/AnimatedErrorBanner';
import './LawyerListing.css';

const LawyerListing = () => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedAvocat, setSelectedAvocat] = useState(null);
  const [avocats, setAvocats] = useState([]);
  const [filteredAvocats, setFilteredAvocats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const searchParams = new URLSearchParams(location.search);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('name') || searchParams.get('search') || '');
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
  const [selectedSpecialty, setSelectedSpecialty] = useState(searchParams.get('speciality') || searchParams.get('specialty') || '');

  const specialties = useMemo(() => [
  { key: 'all',         value: '',                          label: t('lawyerListing.specialties.allSpecialties') },
  { key: 'family',      value: 'Droit de la famille',       label: 'Droit de la famille' },
  { key: 'penal',       value: 'Droit pénal',               label: 'Droit pénal' },
  { key: 'commercial',  value: 'Droit commercial',          label: 'Droit commercial' },
  { key: 'immo',        value: 'Droit immobilier',          label: 'Droit immobilier' },
  { key: 'work',        value: 'Droit du travail',          label: 'Droit du travail' },
  { key: 'affairs',     value: 'Affaires civiles',          label: 'Affaires civiles' },
  { key: 'admin',       value: 'Droit administratif',       label: 'Droit administratif' },
  { key: 'fiscal',      value: 'Droit fiscal',              label: 'Droit fiscal' },
  { key: 'ip',          value: 'Propriété intellectuelle',  label: 'Propriété intellectuelle' },
  { key: 'immigration', value: "Droit de l'immigration",    label: "Droit de l'immigration" },
  { key: 'succession',  value: 'Successions & notariat',    label: 'Successions & notariat' },
  { key: 'bank',        value: 'Droit bancaire',            label: 'Droit bancaire' },
], [t]);

  const cities = useMemo(() => [
    { key: 'allCities', value: '', label: t('lawyerListing.cities.allCities') },
    { key: 'ariana', value: 'ariana', label: t('lawyerListing.cities.ariana') },
    { key: 'beja', value: 'beja', label: t('lawyerListing.cities.beja') },
    { key: 'benArous', value: 'benArous', label: t('lawyerListing.cities.benArous') },
    { key: 'bizerte', value: 'bizerte', label: t('lawyerListing.cities.bizerte') },
    { key: 'gabes', value: 'gabes', label: t('lawyerListing.cities.gabes') },
    { key: 'gafsa', value: 'gafsa', label: t('lawyerListing.cities.gafsa') },
    { key: 'jendouba', value: 'jendouba', label: t('lawyerListing.cities.jendouba') },
    { key: 'kairouan', value: 'kairouan', label: t('lawyerListing.cities.kairouan') },
    { key: 'kasserine', value: 'kasserine', label: t('lawyerListing.cities.kasserine') },
    { key: 'kebili', value: 'kebili', label: t('lawyerListing.cities.kebili') },
    { key: 'kef', value: 'kef', label: t('lawyerListing.cities.kef') },
    { key: 'mahdia', value: 'mahdia', label: t('lawyerListing.cities.mahdia') },
    { key: 'manouba', value: 'manouba', label: t('lawyerListing.cities.manouba') },
    { key: 'medenine', value: 'medenine', label: t('lawyerListing.cities.medenine') },
    { key: 'monastir', value: 'monastir', label: t('lawyerListing.cities.monastir') },
    { key: 'nabeul', value: 'nabeul', label: t('lawyerListing.cities.nabeul') },
    { key: 'sfax', value: 'sfax', label: t('lawyerListing.cities.sfax') },
    { key: 'sidiBouzid', value: 'sidiBouzid', label: t('lawyerListing.cities.sidiBouzid') },
    { key: 'siliana', value: 'siliana', label: t('lawyerListing.cities.siliana') },
    { key: 'sousse', value: 'sousse', label: t('lawyerListing.cities.sousse') },
    { key: 'tataouine', value: 'tataouine', label: t('lawyerListing.cities.tataouine') },
    { key: 'tozeur', value: 'tozeur', label: t('lawyerListing.cities.tozeur') },
    { key: 'tunis', value: 'tunis', label: t('lawyerListing.cities.tunis') },
    { key: 'zaghouan', value: 'zaghouan', label: t('lawyerListing.cities.zaghouan') },
  ], [t]);

  // ── Fetch avocats ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAvocats = async () => {
      try {
        setLoading(true); 
        setError(null);
        
        const res = await authAPI.getAvocats();
        const data = res.data;
        
        setAvocats(data);
        setFilteredAvocats(data);
      } catch (err) {
        console.error('Error loading lawyers:', err);
        setError(`${t('lawyerListing.unableToLoadLawyers')}: ${err.message}`);
        setAvocats([]);
        setFilteredAvocats([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAvocats();
  }, [t]);

  // ── Filtres côté client ────────────────────────────────────────────────────
  useEffect(() => {
    let f = avocats;

    // Filtre par nom
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      f = f.filter(a => {
        const full = `${a.firstName || ''} ${a.lastName || ''} ${a.fullName || ''}`.toLowerCase();
        return full.includes(q);
      });
    }
    if (selectedCity) {
      f = f.filter(a =>
        a.officeLocation?.gouvernorat?.toLowerCase() === selectedCity.toLowerCase()
      );
    }

    //  Filtre spécialité — comparaison insensible à la casse
    if (selectedSpecialty) {
      f = f.filter(a =>
        Array.isArray(a.specialties) &&
        a.specialties.some(s => s.toLowerCase() === selectedSpecialty.toLowerCase())
      );
    }

    setFilteredAvocats(f);
  }, [searchQuery, selectedCity, selectedSpecialty, avocats]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedSpecialty('');
    navigate('/lawyers');
  };

  const hasFilters = searchQuery || selectedCity || selectedSpecialty;

  // ── Helper : années d'expérience depuis graduationYear ────────────────────
  const getExperience = (graduationYear) => {
    if (!graduationYear) return null;
    return new Date().getFullYear() - parseInt(graduationYear);
  };

  return (
    <div className="ll-root">
      <Navbar />

      {/* ── HERO ── */}
      <div className="ll-hero">
        <div className="ll-container">
          <div className="ll-hero-pill">
            <FaUser className="ll-pill-icon" />
            <span>{filteredAvocats.length} {t('lawyerListing.lawyersFound')}</span>
          </div>

          <h1 className="ll-hero-title">{t('lawyerListing.pageTitle')}</h1>
          <p className="ll-hero-sub">Trouvez un avocat agréé partout en Tunisie</p>

          {/* Barre de recherche */}
          <div className="ll-searchbar">
            <div className="ll-search-wrap">
              <input
                type="text"
                className="ll-search-input"
                placeholder={t('homepage.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery
                ? <button className="ll-search-btn" onClick={() => setSearchQuery('')}><FaTimes /></button>
                : <button className="ll-search-btn"><FaSearch /></button>
              }
            </div>
          </div>

          {/* Selects spécialité + ville */}
          <div className="ll-filter-row">
            <div className="ll-select-wrap">
              <select value={selectedSpecialty} onChange={e => setSelectedSpecialty(e.target.value)}>
                {specialties.map(s => <option key={s.key} value={s.value}>{s.label}</option>)}
              </select>
              <FaChevronDown className="ll-chevron" />
            </div>
            <div className="ll-select-wrap">
              <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
                {cities.map(c => <option key={c.key} value={c.value}>{c.label}</option>)}
              </select>
              <FaChevronDown className="ll-chevron" />
            </div>
            {hasFilters && (
              <button className="ll-clear-btn" onClick={clearFilters}>
                <FaTimes /> {t('lawyerListing.clearAll', { defaultValue: 'Effacer' })}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="ll-body">
        <div className="ll-container">

          <div className="ll-results-bar">
            <strong>{filteredAvocats.length}</strong> avocats trouvés
          </div>

          {loading && (
            <div className="ll-state">
              <div className="ll-spinner" />
              <p>{t('lawyerListing.loadingLawyers', { defaultValue: 'Chargement…' })}</p>
            </div>
          )}

          {!loading && error && (
            <div className="ll-state">
              <AnimatedErrorBanner message={error} visible={true} />
              <button className="ll-btn-primary" onClick={() => window.location.reload()}>
                {t('lawyerListing.tryAgain', { defaultValue: 'Réessayer' })}
              </button>
            </div>
          )}

          {!loading && !error && filteredAvocats.length === 0 && (
            <div className="ll-state">
              <p style={{ fontSize: 44 }}>⚖️</p>
              <h3 className="ll-empty-title">{t('lawyerListing.noLawyersFound', { defaultValue: 'Aucun résultat' })}</h3>
              <p className="ll-empty-sub">{t('lawyerListing.tryAdjustingSearch', { defaultValue: 'Modifiez vos critères.' })}</p>
              {hasFilters && <button className="ll-btn-primary" onClick={clearFilters}>{t('lawyerListing.clearAll')}</button>}
            </div>
          )}

          {!loading && !error && filteredAvocats.length > 0 && (
            <div className="ll-grid">
              {filteredAvocats.map((avocat, i) => {
                const firstName     = avocat.firstName || '';
                const lastName      = avocat.lastName  || '';
                const fullName      = avocat.fullName  || `${firstName} ${lastName}`.trim() || 'Avocat';
                const initial       = firstName.charAt(0).toUpperCase() || fullName.charAt(0).toUpperCase() || '?';
                const specialties   = avocat.specialties || [];           
                const gouvernorat   = avocat.officeLocation?.gouvernorat; 
                const spokenLangs   = avocat.spokenLanguages || [];       
                const experience    = getExperience(avocat.graduationYear); 
                const photoUrl      = avocat.photo?.enhanced || avocat.photo?.original || null;

                return (
                  <div
                    key={avocat._id}
                    className="ll-card"
                    style={{ animationDelay: `${(i % 12) * 0.05}s` }}
                    onClick={() => navigate(`/lawyer/${avocat._id}`)}
                  >
                    <div className="ll-card-band">
                      <div className="ll-avatar">
                        {photoUrl
                          ? <img src={photoUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          : <span>{initial}</span>
                        }
                      </div>
                    </div>

                    <div className="ll-card-body">
                      <h3 className="ll-card-name">{fullName}</h3>

                      {/*  Spécialités — tableau, affiche la première */}
                      {specialties.length > 0 && (
                        <span className="ll-card-spec">
                          {t(`lawyerListing.specialties.${specialties[0]}`, { defaultValue: specialties[0] })}
                        </span>
                      )}

                      <div className="ll-card-meta">
                        {/*  Ville depuis officeLocation.gouvernorat */}
                        {gouvernorat && (
                          <div className="ll-meta-item">
                            <IoLocationSharp />
                            <span>
                              {t(`lawyerListing.cities.${gouvernorat.toLowerCase()}`, { defaultValue: gouvernorat })}
                            </span>
                          </div>
                        )}

                        {/*  Expérience calculée depuis graduationYear */}
                        {experience !== null && experience > 0 && (
                          <div className="ll-meta-item">
                            <GiGraduateCap />
                            <span>{experience} {t('lawyerListing.yearsExp', { defaultValue: "ans d'exp." })}</span>
                          </div>
                        )}
                      </div>

                      {/*  Langues depuis spokenLanguages */}
                      {spokenLangs.length > 0 && (
                        <div className="ll-langs">
                          {spokenLangs.map((l, idx) => (
                            <span key={idx} className="ll-lang">{l}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="ll-card-actions">
                      <button
                        className="ll-btn-ghost"
                        onClick={e => { e.stopPropagation(); navigate(`/lawyer/${avocat._id}`); }}
                      >
                        {t('lawyerListing.viewProfile', { defaultValue: 'Voir le profil' })} →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
      <BookingModal
        avocat={selectedAvocat}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
      />
    </div>
  );
};

export default LawyerListing;