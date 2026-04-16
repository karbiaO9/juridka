import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IoLocationSharp, IoMail, IoCall } from 'react-icons/io5';
import { GiGraduateCap } from 'react-icons/gi';
import { FaWhatsapp, FaCalendarAlt, FaMapMarkerAlt, FaArrowLeft, FaCheckCircle, FaClock, FaGlobe, FaStar, FaBolt, FaShieldAlt } from 'react-icons/fa';
import { mapToKey } from '../../utils/i18nMapping';
import { temoignageAPI } from '../../services/api';
import './LawyerProfile.css';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import BookingModal from '../../components/BookingModal';

const LawyerProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [lawyer, setLawyer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [bookingOpen, setBookingOpen] = useState(false);
    const [temoignages, setTemoignages] = useState([]);
    const [activeTab, setActiveTab] = useState('apropos');
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const fetchLawyerProfile = async () => {
            try {
                setLoading(true); setError(null);
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/avocats/${id}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setLawyer(data);
            } catch (error) {
                setError(`${t('lawyerListing.unableToLoadLawyers')}: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchLawyerProfile();
    }, [id, t]);

    useEffect(() => {
        if (!id) return;
        temoignageAPI.getByAvocat(id)
            .then(data => setTemoignages(data || []))
            .catch(() => {});
    }, [id]);

    const DAY_MAP = {
        Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
        Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
        Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 0,
    };

    const getAvailabilityDays = () => {
        const slots = lawyer?.availability?.slots;
        if (!slots || slots.length === 0) return [];
        const locale = (i18n && i18n.language) || 'fr-FR';
        const grouped = {};
        slots.forEach(({ day, time, duration }) => {
            if (!grouped[day]) grouped[day] = { day, time, duration };
        });
        return Object.values(grouped).map(({ day, time, duration }) => {
            let displayDay = day;
            try {
                const dayIndex = DAY_MAP[day];
                if (typeof dayIndex === 'number') {
                    const now = new Date();
                    const diff = (dayIndex - now.getDay() + 7) % 7;
                    const target = new Date(now);
                    target.setDate(now.getDate() + diff);
                    displayDay = target.toLocaleDateString(locale, { weekday: 'long' });
                    displayDay = displayDay.charAt(0).toUpperCase() + displayDay.slice(1);
                }
            } catch (e) {}
            let endTime = '';
            try {
                if (time && duration) {
                    const [h, m] = time.split(':').map(Number);
                    const end = new Date();
                    end.setHours(h, m + duration, 0);
                    endTime = end.toTimeString().slice(0, 5);
                }
            } catch (e) {}
            return { day: displayDay, startTime: time, endTime };
        });
    };

    // ── Disponibilité aujourd'hui ──
    const isAvailableToday = (() => {
        const slots = lawyer?.availability?.slots;
        if (!slots || slots.length === 0) return false;
        const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, …
        return slots.some(({ day }) => {
            const idx = DAY_MAP[day];
            return typeof idx === 'number' && idx === todayIndex;
        });
    })();

    const officeLocation = lawyer?.officeLocation;
    const mapAddress = officeLocation?.address
        ? `${officeLocation.address}${officeLocation.gouvernorat ? ', ' + officeLocation.gouvernorat : ''}, Tunisia`
        : lawyer?.adresseCabinet?.trim()
            ? `${lawyer.adresseCabinet}${lawyer.ville ? ', ' + lawyer.ville : ''}, Tunisia`
            : lawyer?.ville?.trim() ? `${lawyer.ville}, Tunisia` : null;

    const officeCoords = officeLocation?.coordinates;
    const mapsEmbedUrl = officeCoords?.lat && officeCoords?.lng
        ? `https://www.google.com/maps?q=${officeCoords.lat},${officeCoords.lng}&z=15&output=embed`
        : mapAddress
            ? `https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&z=15&output=embed`
            : null;
    const mapsOpenUrl = officeCoords?.lat && officeCoords?.lng
        ? `https://www.google.com/maps?q=${officeCoords.lat},${officeCoords.lng}`
        : mapAddress
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`
            : null;

    const formatWhatsAppPhone = (raw) => {
        if (!raw) return null;
        let n = String(raw).trim().replace(/[^0-9]/g, '');
        if (!n) return null;
        if (n.startsWith('00')) n = n.slice(2);
        if (n.length === 8) n = '216' + n;
        return n;
    };

    const whatsappPhone = formatWhatsAppPhone(lawyer?.phone);
    const whatsappText = `Bonjour ${lawyer?.fullName || ''}, je souhaite prendre rendez-vous pour une consultation.`;
    const whatsappUrl = whatsappPhone
        ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappText)}`
        : null;

    const initial = lawyer?.fullName?.charAt(0)?.toUpperCase() || '?';

    /* ── Loading ── */
    if (loading) return (
        <div className="lp-root">
            <Navbar />
            <div className="lp-state">
                <div className="lp-spinner" />
                <p>{t('lawyerProfile.loadingLawyerProfile')}</p>
            </div>
            <Footer />
        </div>
    );

    /* ── Error ── */
    if (error || !lawyer) return (
        <div className="lp-root">
            <Navbar />
            <div className="lp-state">
                <p style={{ fontSize: 44 }}>⚠️</p>
                <h2>{t('lawyerProfile.lawyerProfileNotAvailable')}</h2>
                <p>{error || t('lawyerProfile.requestedProfileNotFound')}</p>
                <div className="lp-error-actions">
                    <button className="lp-btn-gold" onClick={() => navigate('/lawyers')}>
                        {t('lawyerProfile.backToLawyers')}
                    </button>
                    <button className="lp-btn-ghost" onClick={() => window.location.reload()}>
                        {t('lawyerListing.tryAgain')}
                    </button>
                </div>
            </div>
            <Footer />
        </div>
    );

    const availDays = getAvailabilityDays();

    /* Global rating */
    const allRatings = temoignages.flatMap(tm =>
        Object.values(tm.ratings || {}).filter(v => v !== null && v > 0)
    );
    const globalAvg = allRatings.length
        ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
        : null;

    /* Pro items */
    const proItems = [
        {
            label: t('lawyerProfile.specialization', { defaultValue: 'Spécialisation' }),
            value: lawyer.specialties?.length ? lawyer.specialties.join(', ') : t('lawyerProfile.notSpecified'),
        },
        { label: t('lawyerProfile.education'), value: lawyer.diplome },
        ...(lawyer.adresseCabinet ? [{ label: t('lawyerProfile.cabinetAddress'), value: lawyer.adresseCabinet }] : []),
        ...(lawyer.anneExperience ? [{ label: t('lawyerProfile.yearsOfExperience'), value: `${lawyer.anneExperience} ${t('lawyerProfile.years')}` }] : []),
    ].filter(d => d.value);

    /* Contact items - adresse uniquement */
    const contactItems = [
        {
            icon: <IoLocationSharp />,
            label: t('lawyerProfile.addressLabel'),
            value: officeLocation?.address
                ? `${officeLocation.address}${officeLocation.gouvernorat ? ', ' + officeLocation.gouvernorat : ''}`
                : lawyer.adresseCabinet
                    ? `${lawyer.adresseCabinet}, ${lawyer.ville}`
                    : (lawyer.ville || t('lawyerProfile.notSpecified'))
        },
    ].filter(r => r.value);

    /* Tabs definition */
    const tabs = [
        { key: 'apropos', label: t('lawyerProfile.about', { defaultValue: 'À propos' }) },
        { key: 'disponibilites', label: `Disponibilités` },
        ...(temoignages.length > 0 ? [{ key: 'avis', label: `Avis (${temoignages.length})` }] : []),
        { key: 'cabinet', label: 'Cabinet & Accès' },
    ];

    /* Split first name / last name for styled name */
    const nameParts = (lawyer.fullName || '').split(' ');
    const firstName = nameParts[0] || '';
    const restName  = nameParts.slice(1).join(' ');

    return (
        <div className="lp-root">
            <Navbar />

            <div className="lp-page">

                {/* Back */}
                <button className="lp-back" onClick={() => navigate('/lawyers')}>
                    <FaArrowLeft /> {t('lawyerProfile.backToSearch')}
                </button>

                {/* ════ HERO CARD ════ */}
                <div className="lp-hero-card">

                    {/* TOP */}
                    <div className="lp-hero-top">

                        {/* Avatar */}
                        <div className="lp-avatar">
                            {lawyer.photo?.enhanced || lawyer.photo?.original
                                ? <img
                                    src={lawyer.photo.enhanced || lawyer.photo.original}
                                    alt={lawyer.fullName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                />
                                : <span>{initial}</span>
                            }
                            <div className="lp-avatar-badge"><FaCheckCircle /></div>
                        </div>

                        {/* Identity */}
                        <div className="lp-identity">
                            <div className="lp-identity-kicker">
                                {t('lawyerProfile.verified', { defaultValue: 'Avocat inscrit' })}
                                {lawyer.ville ? ` · Barreau de ${lawyer.ville}` : ''}
                            </div>

                            <h1 className="lp-name">
                                {firstName} <em>{restName}</em>
                            </h1>

                            <p className="lp-specialites">
                                {lawyer.specialties?.length
                                    ? lawyer.specialties.map(sp =>
                                        t(`lawyerListing.specialties.${sp}`, { defaultValue: sp })
                                    ).join(' · ')
                                    : lawyer.specialites || ''}
                            </p>

                            <div className="lp-tags">
                                <span className="lp-tag lp-tag-green">
                                    <FaCheckCircle /> {t('lawyerProfile.verified', { defaultValue: 'Vérifié ONAT' })}
                                </span>
                                {lawyer.langues?.map((l, i) => (
                                    <span key={i} className="lp-tag">
                                        <FaGlobe style={{ fontSize: 9 }} /> {l}
                                    </span>
                                ))}
                                {lawyer.specialties?.map((sp, i) => (
                                    <span key={i} className="lp-tag">
                                        {t(`lawyerListing.specialties.${sp}`, { defaultValue: sp })}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Booking panel */}
                        <div className="lp-book-panel">
                            <div className={isAvailableToday ? 'lp-available' : 'lp-unavailable'}>
                                {isAvailableToday
                                    ? t('lawyerProfile.availableToday', { defaultValue: 'Disponible auj.' })
                                    : t('lawyerProfile.unavailableToday', { defaultValue: 'Non disponible auj.' })
                                }
                            </div>
                            <div>
                                <div className="lp-panel-label">Consultation</div>
                                <div className="lp-panel-value">Tarif direct</div>
                                <div className="lp-panel-sub">Paiement au cabinet</div>
                            </div>
                            <button className="lp-btn-gold lp-btn-full" onClick={() => setBookingOpen(true)}>
                                <FaCalendarAlt /> {t('lawyerProfile.bookAppointment')}
                            </button>

                        </div>
                    </div>

                    {/* STATS */}
                    <div className="lp-stats">
                        {lawyer.anneExperience && (
                            <div className="lp-stat">
                                <span className="lp-stat-label">Expérience</span>
                                <span className="lp-stat-val">{lawyer.anneExperience} ans</span>
                            </div>
                        )}
                        {lawyer.ville && (
                            <div className="lp-stat">
                                <span className="lp-stat-label">Localisation</span>
                                <span className="lp-stat-val">
                                    <IoLocationSharp style={{ fontSize: 11 }} />
                                    {t(`lawyerListing.cities.${mapToKey(lawyer.ville, 'city')}`, { defaultValue: lawyer.ville })}
                                </span>
                            </div>
                        )}
                        {globalAvg && (
                            <div className="lp-stat">
                                <span className="lp-stat-label">Note</span>
                                <span className="lp-stat-val">
                                    <FaStar style={{ fontSize: 11, color: '#C9A84C' }} />
                                    {globalAvg.toFixed(1)} / 5
                                </span>
                            </div>
                        )}
                        {temoignages.length > 0 && (
                            <div className="lp-stat">
                                <span className="lp-stat-label">Consultations</span>
                                <span className="lp-stat-val">{temoignages.length} via Juridika</span>
                            </div>
                        )}
                    </div>

                    {/* RIBBON */}
                    <div className="lp-ribbon">
                        {(officeLocation?.address || lawyer.adresseCabinet || lawyer.ville) && (
                            <div className="lp-ribbon-item">
                                <IoLocationSharp />
                                Cabinet situé à <strong>
                                    {officeLocation?.address || lawyer.adresseCabinet || lawyer.ville}
                                </strong>
                            </div>
                        )}
                        {availDays.length > 0 && (
                            <div className="lp-ribbon-item">
                                <FaCalendarAlt />
                                Prochains créneaux : <strong>{availDays[0]?.day} {availDays[0]?.startTime}</strong>
                            </div>
                        )}
                        <div className="lp-ribbon-item">
                            <FaShieldAlt />
                            Confidentialité <strong>garantie ONAT</strong>
                        </div>
                    </div>
                </div>

                {/* ════ TABS ════ */}
                <div className="lp-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            className={`lp-tab${activeTab === tab.key ? ' active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ════ À PROPOS ════ */}
                {activeTab === 'apropos' && (
                    <div className="lp-panel">
                        {lawyer.bio && (
                            <div className="lp-card">
                                <h2 className="lp-card-title">
                                    <span className="lp-card-icon">✦</span>
                                    {t('lawyerProfile.about')}
                                </h2>
                                <p className="lp-bio">{lawyer.bio}</p>
                            </div>
                        )}
                        {proItems.length > 0 && (
                            <div className="lp-card">
                                <h2 className="lp-card-title">
                                    <span className="lp-card-icon"><GiGraduateCap /></span>
                                    {t('lawyerProfile.professionalInformation')}
                                </h2>
                                <div className="lp-info-grid">
                                    {proItems.map((item, i) => (
                                        <div key={i} className="lp-info-item">
                                            <div className="lp-info-label">{item.label}</div>
                                            <div className="lp-info-value">{item.value}</div>
                                        </div>
                                    ))}
                                    {lawyer.langues?.length > 0 && (
                                        <div className="lp-info-item" style={{ gridColumn: '1 / -1' }}>
                                            <div className="lp-info-label">{t('lawyerProfile.languages')}</div>
                                            <div className="lp-langs">
                                                {lawyer.langues.map((l, i) => <span key={i}>{l}</span>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="lp-card">
                            <h2 className="lp-card-title">
                                <span className="lp-card-icon"><IoCall /></span>
                                {t('lawyerProfile.contactInformation')}
                            </h2>
                            <div className="lp-contact-list">
                                {contactItems.map((r, i) => (
                                    <div key={i} className="lp-contact-row">
                                        <div className="lp-contact-icon">{r.icon}</div>
                                        <div>
                                            <div className="lp-contact-lbl">{r.label}</div>
                                            <div className="lp-contact-val">{r.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Mobile booking (hidden panel on desktop) */}
                        <div className="lp-card" style={{ display: 'none' }} id="mobile-book">
                            <button className="lp-btn-gold lp-btn-full" onClick={() => setBookingOpen(true)}>
                                <FaCalendarAlt /> {t('lawyerProfile.bookAppointment')}
                            </button>

                        </div>
                    </div>
                )}

                {/* ════ DISPONIBILITÉS ════ */}
                {activeTab === 'disponibilites' && (
                    <div className="lp-panel">
                        <div className="lp-card">
                            <h2 className="lp-card-title">
                                <span className="lp-card-icon"><FaClock /></span>
                                {t('lawyerProfile.availabilitySchedule')}
                            </h2>
                            {availDays.length > 0 ? (
                                <div className="lp-schedule-grid">
                                    {availDays.map((d, i) => (
                                        <div key={i} className="lp-slot">
                                            <div className="lp-slot-day">{d.day}</div>
                                            <div className="lp-slot-time">
                                                <FaClock style={{ fontSize: 10 }} />
                                                {d.startTime}{d.endTime ? ` — ${d.endTime}` : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="lp-muted">{t('lawyerProfile.noAvailability', { defaultValue: 'Aucun créneau renseigné.' })}</p>
                            )}
                        </div>
                        <div className="lp-card" style={{ textAlign: 'center', padding: '28px' }}>
                            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 16 }}>
                                {t('lawyerProfile.readyForLegalAdvice', { defaultValue: 'Réservez un créneau avec cet avocat agréé.' })}
                            </p>
                            <button className="lp-btn-gold" onClick={() => setBookingOpen(true)}>
                                <FaCalendarAlt /> {t('lawyerProfile.bookAppointment')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ════ AVIS ════ */}
                {activeTab === 'avis' && temoignages.length > 0 && (
                    <div className="lp-panel">
                        <div className="lp-card">
                            <h2 className="lp-card-title">
                                <span className="lp-card-icon">🌟</span>
                                Avis clients
                                <span className="lp-avis-count">{temoignages.length} avis</span>
                            </h2>

                            {globalAvg && (
                                <div className="lp-rating-summary">
                                    <div className="lp-rating-big">{globalAvg.toFixed(1)}</div>
                                    <div>
                                        <div className="lp-rating-stars">
                                            {[1,2,3,4,5].map(n => (
                                                <span key={n} className={`lp-star${n <= Math.round(globalAvg) ? ' filled' : ''}`}>★</span>
                                            ))}
                                        </div>
                                        <div className="lp-rating-sub">
                                            sur 5 · {temoignages.length} consultation{temoignages.length > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="lp-temoignage-list">
                                {temoignages.map(tm => {
                                    const rdvDate = tm.rendezVousId?.date
                                        ? new Date(tm.rendezVousId.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                                        : null;
                                    const ratings = Object.values(tm.ratings || {}).filter(v => v !== null && v > 0);
                                    const avg = ratings.length
                                        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
                                        : null;
                                    return (
                                        <div key={tm._id} className="lp-temoignage">
                                            <div className="lp-temoignage-head">
                                                <div className="lp-temoignage-author">
                                                    <div className="lp-temoignage-av">
                                                        {tm.nomAnonyme.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="lp-temoignage-name">{tm.nomAnonyme}</div>
                                                        {rdvDate && <div className="lp-temoignage-date">{rdvDate}</div>}
                                                    </div>
                                                </div>
                                                {avg && (
                                                    <div className="lp-temoignage-score">
                                                        <span className="lp-star filled">★</span>
                                                        <span>{avg}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {tm.texte && (
                                                <p className="lp-temoignage-text">"{tm.texte}"</p>
                                            )}
                                            {Object.keys(tm.ratings || {}).some(k => tm.ratings[k] !== null && tm.ratings[k] > 0) && (
                                                <div className="lp-temoignage-dims">
                                                    {[
                                                        { key: 'ecoute',      label: 'Écoute'      },
                                                        { key: 'clarte',      label: 'Clarté'      },
                                                        { key: 'pertinence',  label: 'Pertinence'  },
                                                        { key: 'ponctualite', label: 'Ponctualité' },
                                                        { key: 'accueil',     label: 'Accueil'     },
                                                    ].filter(d => tm.ratings[d.key] > 0).map(d => (
                                                        <div key={d.key} className="lp-dim-row">
                                                            <span className="lp-dim-label">{d.label}</span>
                                                            <div className="lp-dim-track">
                                                                <div className="lp-dim-fill" style={{ width: `${(tm.ratings[d.key] / 5) * 100}%` }} />
                                                            </div>
                                                            <span className="lp-dim-val">{tm.ratings[d.key]}/5</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ════ CABINET & ACCÈS ════ */}
                {activeTab === 'cabinet' && (
                    <div className="lp-panel">
                        <div className="lp-card">
                            <h2 className="lp-card-title">
                                <span className="lp-card-icon"><FaMapMarkerAlt /></span>
                                {t('lawyerProfile.officeLocation')}
                            </h2>
                            {mapsEmbedUrl ? (
                                <>
                                    <div className="lp-map-wrap">
                                        <iframe
                                            title={t('lawyerProfile.mapTitle')}
                                            src={mapsEmbedUrl}
                                            loading="lazy"
                                        />
                                    </div>
                                    <a href={mapsOpenUrl} target="_blank" rel="noreferrer" className="lp-map-link">
                                        <FaMapMarkerAlt /> {t('lawyerProfile.openInGoogleMaps')}
                                    </a>
                                </>
                            ) : (
                                <p className="lp-muted">{t('lawyerProfile.noAddressAvailable')}</p>
                            )}
                        </div>
                        <div className="lp-card">
                            <h2 className="lp-card-title">
                                <span className="lp-card-icon"><IoCall /></span>
                                {t('lawyerProfile.contactInformation')}
                            </h2>
                            <div className="lp-contact-list">
                                {contactItems.map((r, i) => (
                                    <div key={i} className="lp-contact-row">
                                        <div className="lp-contact-icon">{r.icon}</div>
                                        <div>
                                            <div className="lp-contact-lbl">{r.label}</div>
                                            <div className="lp-contact-val">{r.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <Footer />
            <BookingModal avocat={lawyer} open={bookingOpen} onClose={() => setBookingOpen(false)} />
        </div>
    );
};

export default LawyerProfile;