import React, { useState, useEffect } from 'react';
import VerificationModal from '../../components/VerificationModal';
import LogoutModal from '../../components/LogoutModal';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/adminApi';
import { useAuth } from '../../contexts/AuthContext';
import './AdminDashboard.css';
import Logo from '../../components/Logo';

const getFullName = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(' ') || person?.fullName || person?.email || '—';

const TYPE_CONFIG = {
  visio: { label: 'Visioconférence', color: '#a855f7', bg: 'rgba(168,85,247,0.13)', icon: '📹' },
  tel: { label: 'Téléphone', color: '#3b82f6', bg: 'rgba(59,130,246,0.13)', icon: '📞' },
  telephone: { label: 'Téléphone', color: '#3b82f6', bg: 'rgba(59,130,246,0.13)', icon: '📞' },
  urgence: { label: 'Urgence 24/7', color: '#ef4444', bg: 'rgba(239,68,68,0.13)', icon: '⚡' },
  presentiel: { label: 'Présentiel', color: '#6b7280', bg: 'rgba(107,114,128,0.13)', icon: '🏛️' },
};

const STATUT_CONFIG = {
  'confirmé': { label: 'Confirmé', color: '#22c55e', dot: '●' },
  'en_attente': { label: 'En attente', color: '#f59e0b', dot: '○' },
  'annulé': { label: 'Annulé', color: '#ef4444', dot: '○' },
};

/** Maps notification type → emoji icon shown in the dropdown */
const NOTIF_ICONS = {
  new_client: '👤',
  new_avocat: '⚖️',
  new_founding_member: '⭐',
  avocat_verified: '✅',
  avocat_rejected: '❌',
  founding_member_confirmed: '✅',
  founding_member_rejected: '❌',
  payment_confirmed: '💳',
  payment_pending: '⏳',
  payment_failed: '🚫',
  document_submitted: '📄',
  appointment_created:   '📅',
  appointment_cancelled: '🗓️',
  temoignage_submitted:  '🗨️',
};

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [stats, setStats] = useState({
    totalLawyers: 0, verifiedLawyers: 0,
    pendingLawyers: 0, totalClients: 0
  });
  const [pendingLawyers, setPendingLawyers] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [foundingMembers, setFoundingMembers] = useState([]);
  const [pendingFoundingCount, setPendingFoundingCount] = useState(0);
  const [selectedFoundingMember, setSelectedFoundingMember] = useState(null);
  const [isFoundingModalOpen, setIsFoundingModalOpen] = useState(false);
  const [isFoundingVerifying, setIsFoundingVerifying] = useState(false);
  const [appointmentFilter, setAppointmentFilter] = useState('');
  const [appointmentMeta, setAppointmentMeta] = useState({ total7days: 0, urgences: 0 });
  const [temoignages, setTemoignages] = useState([]);
  const [temoignageFilter, setTemoignageFilter] = useState('');
  const [pendingTemoignagesCount, setPendingTemoignagesCount] = useState(0);
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [showLogout, setShowLogout] = useState(false);
  const [sidebarNav, setSidebarNav] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  /* ── NOTIFICATIONS ── */
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  /* ── DATA FETCHING ── */
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminApi.getStats();
        if (response.success) setStats(response.stats);
      } catch {
        alert(t('adminDashboard.failedToFetchStats'));
      }
    };
    fetchStats();
  }, [t]);

  useEffect(() => {
    const fetchPendingLawyers = async () => {
      try {
        setIsLoading(true);
        const response = await adminApi.getPendingLawyers();
        if (response.success) setPendingLawyers(response.lawyers);
      } catch {
        alert(t('adminDashboard.failedToFetchLawyers'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchPendingLawyers();
  }, [t]);

  useEffect(() => {
    adminApi.getFoundingMembers()
      .then(data => {
        setFoundingMembers(data);
        setPendingFoundingCount(data.filter(m => m.status === 'pending').length);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    adminApi.getTemoignages('en_attente')
      .then(data => setPendingTemoignagesCount((data || []).length))
      .catch(() => {});
  }, []);

  /* ── Notification fetching (initial + polling every 60s) ── */
  useEffect(() => {
    const loadNotifications = () => {
      adminApi.getNotifications()
        .then(data => {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        })
        .catch(() => { });
    };
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  /* Close notification dropdown on outside click */
  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e) => {
      if (!e.target.closest('.ad-notif-wrapper')) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  /* Ferme la sidebar si on redimensionne vers desktop */
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ── HANDLERS ── */
  const handleViewDetails = (lawyer) => { setSelectedLawyer(lawyer); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setSelectedLawyer(null); };

  const handleApprove = async (lawyerId) => {
    try {
      setIsVerifying(true);
      const response = await adminApi.verifyLawyer(lawyerId, 'approve');
      if (response.success) {
        setPendingLawyers(prev => prev.filter(l => l._id !== lawyerId));
        setStats(prev => ({ ...prev, verifiedLawyers: prev.verifiedLawyers + 1, pendingLawyers: prev.pendingLawyers - 1 }));
        handleCloseModal();
      }
    } catch { alert(t('adminDashboard.failedToApprove')); }
    finally { setIsVerifying(false); }
  };

  const handleReject = async (lawyerId) => {
    try {
      setIsVerifying(true);
      const response = await adminApi.verifyLawyer(lawyerId, 'reject');
      if (response.success) {
        setPendingLawyers(prev => prev.filter(l => l._id !== lawyerId));
        setStats(prev => ({ ...prev, totalLawyers: prev.totalLawyers - 1, pendingLawyers: prev.pendingLawyers - 1 }));
        handleCloseModal();
      }
    } catch { alert(t('adminDashboard.failedToReject')); }
    finally { setIsVerifying(false); }
  };

  const handleViewFoundingMember = (member) => { setSelectedFoundingMember(member); setIsFoundingModalOpen(true); };
  const handleCloseFoundingModal = () => { setIsFoundingModalOpen(false); setSelectedFoundingMember(null); };

  const handleConfirmFounder = async (id) => {
    try {
      setIsFoundingVerifying(true);
      const data = await adminApi.confirmFoundingMember(id);
      setFoundingMembers(prev => prev.map(m => m._id === id ? { ...m, status: 'confirmed', founderNumber: data.member?.founderNumber } : m));
      setPendingFoundingCount(prev => Math.max(0, prev - 1));
      handleCloseFoundingModal();
    } catch { alert('Erreur lors de la confirmation'); }
    finally { setIsFoundingVerifying(false); }
  };

  const handleRejectFounder = async (id, note = '') => {
    try {
      setIsFoundingVerifying(true);
      await adminApi.rejectFoundingMember(id, note);
      setFoundingMembers(prev => prev.map(m => m._id === id ? { ...m, status: 'rejected', reviewNote: note } : m));
      setPendingFoundingCount(prev => Math.max(0, prev - 1));
      handleCloseFoundingModal();
    } catch { alert('Erreur lors du rejet'); }
    finally { setIsFoundingVerifying(false); }
  };

  /* ── NOTIFICATION HANDLERS ── */
  const handleToggleNotif = () => setNotifOpen(prev => !prev);

  const handleMarkAllRead = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const handleMarkOneRead = async (id) => {
    try {
      await adminApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const NOTIF_NAV = {
    new_client:                  'clients',
    new_avocat:                  'pending',
    document_submitted:          'pending',
    avocat_verified:             'lawyers',
    avocat_rejected:             'pending',
    new_founding_member:         'founding',
    founding_member_confirmed:   'founding',
    founding_member_rejected:    'founding',
    payment_confirmed:           'founding',
    payment_pending:             'founding',
    payment_failed:              'founding',
    appointment_created:         'appointments',
    appointment_cancelled:       'appointments',
    temoignage_submitted:        'temoignages',
  };

  const handleNotifClick = async (n) => {
    if (!n.read) {
      try {
        await adminApi.markNotificationRead(n._id);
        setNotifications(prev => prev.map(notif => notif._id === n._id ? { ...notif, read: true } : notif));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { /* silent */ }
    }
    const target = NOTIF_NAV[n.type];
    if (target) {
      setSidebarNav(target);
      handleCardClick(target);
    }
    setNotifOpen(false);
  };

  const handleCardClick = async (type, apptFilter = '') => {
    setActiveTab(type);
    setPanelError(null);
    setPanelLoading(true);
    setSearchQuery('');
    try {
      if (type === 'lawyers') { const data = await adminApi.getAllLawyers(); setLawyers(data); }
      else if (type === 'clients') { const data = await adminApi.getAllClients(); setClients(data); }
      else if (type === 'verified') { const data = await adminApi.getVerifiedLawyers(); setLawyers(data); }
      else if (type === 'founding') {
        const data = await adminApi.getFoundingMembers();
        setFoundingMembers(data);
        setPendingFoundingCount(data.filter(m => m.status === 'pending').length);
      }
      else if (type === 'appointments') {
        const data = await adminApi.getAppointments(apptFilter);
        setAppointments(data.appointments || []);
        setAppointmentMeta(data.meta || { total7days: 0, urgences: 0 });
        setAppointmentFilter(apptFilter);
      }
      else if (type === 'temoignages') {
        const data = await adminApi.getTemoignages(apptFilter);
        setTemoignages(data || []);
        setTemoignageFilter(apptFilter);
      }
    } catch (err) {
      setPanelError(err.message || 'Failed to load data');
    } finally {
      setPanelLoading(false);
    }
  };

  /* ── FILTERED DATA ── */
  const match = (item) =>
    getFullName(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.email?.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredPending = pendingLawyers.filter(match);
  const filteredLawyersList = lawyers.filter(match);
  const filteredClients = clients.filter(match);
  const filteredFoundingMembers = foundingMembers.filter(match);
  const filteredAppointments = appointments.filter(appt =>
    getFullName(appt.clientId).toLowerCase().includes(searchQuery.toLowerCase()) ||
    getFullName(appt.avocatId).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTemoignages = temoignages.filter(t =>
    (t.nomAnonyme || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    getFullName(t.avocatId).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.texte || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ── APPOINTMENTS TABLE (grouped by lawyer, collapsible) ── */
  const toggleGroup = (key) =>
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const renderAppointmentsTable = () => {
    if (filteredAppointments.length === 0) return (
      <div className="ad-state">
        <div className="ad-empty-icon">📭</div>
        <h3>Aucun rendez-vous</h3>
        <p style={{ color: '#4a5568', fontSize: 13 }}>Aucun résultat pour ce filtre</p>
      </div>
    );

    // Group by avocat
    const groups = {};
    filteredAppointments.forEach(appt => {
      const key = appt.avocatId?._id || 'unknown';
      if (!groups[key]) groups[key] = { avocat: appt.avocatId, items: [] };
      groups[key].items.push(appt);
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.values(groups).map(({ avocat, items }) => {
          const key = avocat?._id || 'unknown';
          const isOpen = !!expandedGroups[key];
          return (
            <div key={key} className="ad-lawyer-group">
              {/* Lawyer header — clickable */}
              <button
                className={`ad-lawyer-group-header${isOpen ? ' ad-lawyer-group-header--open' : ''}`}
                onClick={() => toggleGroup(key)}
              >
                <div className="ad-lawyer-group-avatar">
                  {(avocat?.photo?.enhanced || avocat?.photo?.original)
                    ? <img src={avocat.photo.enhanced || avocat.photo.original} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 18 }}>⚖️</span>}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>
                    Me. {getFullName(avocat)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {[avocat?.specialties?.[0], avocat?.barRegion || avocat?.gouvernorat].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="ad-lawyer-group-badge">{items.length} RDV</span>
                <span className={`ad-lawyer-group-chevron${isOpen ? ' ad-lawyer-group-chevron--open' : ''}`}>▼</span>
              </button>

              {/* Appointments table — shown only when open */}
              {isOpen && (
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>CLIENT</th>
                        <th>TYPE</th>
                        <th>DATE / HEURE</th>
                        <th>STATUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(appt => {
                        const typeConf = TYPE_CONFIG[appt.type] || { label: appt.type, color: '#6b7280', bg: 'rgba(107,114,128,0.13)', icon: '📅' };
                        const statutConf = STATUT_CONFIG[appt.statut] || { label: appt.statut, color: '#6b7280', dot: '○' };
                        const date = new Date(appt.date);
                        const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

                        return (
                          <tr key={appt._id}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 14 }}>
                                {getFullName(appt.clientId)}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                                {appt.clientId?.profileType || 'Client inscrit'}
                              </div>
                            </td>
                            <td>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '4px 10px', borderRadius: 20,
                                background: typeConf.bg, color: typeConf.color,
                                fontSize: 12, fontWeight: 700,
                                border: `1px solid ${typeConf.color}44`
                              }}>
                                {typeConf.icon} {typeConf.label}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: 'var(--text1)' }}>{dateStr}</span>
                              <span style={{ color: 'var(--text3)', margin: '0 6px' }}>·</span>
                              <span style={{ color: 'var(--text2)', fontFamily: 'monospace' }}>{appt.heure}</span>
                            </td>
                            <td>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '4px 10px', borderRadius: 20,
                                background: `${statutConf.color}18`, color: statutConf.color,
                                fontSize: 12, fontWeight: 700,
                                border: `1px solid ${statutConf.color}44`
                              }}>
                                {statutConf.dot} {statutConf.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── TEMOIGNAGES TABLE ── */
  const handleApproveTemoignage = async (id) => {
    try {
      await adminApi.approveTemoignage(id);
      setTemoignages(prev => prev.map(t => t._id === id ? { ...t, statut: 'approuvé' } : t));
      setPendingTemoignagesCount(prev => Math.max(0, prev - 1));
    } catch (err) { alert('Erreur : ' + err.message); }
  };

  const handleRejectTemoignage = async (id) => {
    if (!window.confirm('Rejeter ce témoignage ?')) return;
    try {
      await adminApi.rejectTemoignage(id);
      setTemoignages(prev => prev.map(t => t._id === id ? { ...t, statut: 'rejeté' } : t));
      setPendingTemoignagesCount(prev => Math.max(0, prev - 1));
    } catch (err) { alert('Erreur : ' + err.message); }
  };

  const TEMOIGNAGE_STATUT = {
    en_attente: { label: 'En attente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    approuvé:   { label: 'Approuvé',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
    rejeté:     { label: 'Rejeté',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  };

  const renderTemoignagesTable = () => {
    if (filteredTemoignages.length === 0) return (
      <div className="ad-state">
        <div className="ad-empty-icon">📭</div>
        <h3>Aucun témoignage</h3>
        <p style={{ color: '#4a5568', fontSize: 13 }}>Aucun résultat pour ce filtre</p>
      </div>
    );

    return (
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>CLIENT</th>
              <th>AVOCAT</th>
              <th>NOTE / TEXTE</th>
              <th>DATE</th>
              <th>STATUT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemoignages.map(t => {
              const sc = TEMOIGNAGE_STATUT[t.statut] || TEMOIGNAGE_STATUT.en_attente;
              const rdvDate = t.rendezVousId?.date ? new Date(t.rendezVousId.date) : null;
              const ratings = t.ratings || {};
              const ratingValues = Object.values(ratings).filter(v => v !== null && v > 0);
              const avg = ratingValues.length
                ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
                : null;

              return (
                <tr key={t._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 14 }}>{t.nomAnonyme}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t.reference}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 14 }}>
                      Me. {getFullName(t.avocatId)}
                    </div>
                    {rdvDate && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        RDV : {rdvDate.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                        {t.rendezVousId?.heure ? ` · ${t.rendezVousId.heure}` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    {avg && (
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                        <span style={{ color:'#f59e0b', fontSize:13 }}>{'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text2)' }}>{avg}/5</span>
                      </div>
                    )}
                    {t.texte ? (
                      <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle:'italic', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                        "{t.texte}"
                      </div>
                    ) : (
                      <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize:13, color:'var(--text2)' }}>
                      {new Date(t.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 10px', borderRadius:20,
                      background: sc.bg, color: sc.color,
                      fontSize:12, fontWeight:700,
                      border:`1px solid ${sc.color}44`
                    }}>
                      {sc.label}
                    </span>
                  </td>
                  <td>
                    {t.statut === 'en_attente' && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button
                          onClick={() => handleApproveTemoignage(t._id)}
                          style={{
                            padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer',
                            background:'rgba(34,197,94,0.12)', color:'#16a34a',
                            fontSize:12, fontWeight:700
                          }}
                        >
                          ✓ Publier
                        </button>
                        <button
                          onClick={() => handleRejectTemoignage(t._id)}
                          style={{
                            padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer',
                            background:'rgba(239,68,68,0.12)', color:'#dc2626',
                            fontSize:12, fontWeight:700
                          }}
                        >
                          ✕ Rejeter
                        </button>
                      </div>
                    )}
                    {t.statut === 'approuvé' && (
                      <span style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>✓ Publié</span>
                    )}
                    {t.statut === 'rejeté' && (
                      <span style={{ fontSize:12, color:'#9ca3af', fontWeight:600 }}>Rejeté</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /* ── FOUNDING MEMBERS TABLE ── */
  const renderFoundingTable = () => {
    const STATUS = {
      pending: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
      confirmed: { label: 'Confirmé', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
      rejected: { label: 'Rejeté', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
      waitlist: { label: "Liste d'attente", color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
    };
    const PLAN = {
      essentiel: { label: 'Essentiel', color: '#6b7280' },
      professionnel: { label: 'Professionnel', color: '#C9A84C' },
      cabinet: { label: 'Cabinet', color: '#a855f7' },
    };

    if (filteredFoundingMembers.length === 0) return (
      <div className="ad-state">
        <div className="ad-empty-icon">⭐</div>
        <h3>Aucun membre fondateur</h3>
        <p style={{ color: '#4a5568', fontSize: 13 }}>Aucun dossier soumis pour le moment</p>
      </div>
    );

    return (
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>CANDIDAT</th>
              <th className="ad-col-email">EMAIL</th>
              <th className="ad-col-fo-plan">PLAN</th>
              <th>STATUT</th>
              <th className="ad-col-date">DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredFoundingMembers.map(m => {
              const sc = STATUS[m.status] || { label: m.status, color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
              const pc = PLAN[m.plan] || { label: m.plan, color: '#6b7280' };
              return (
                <tr key={m._id}>
                  <td>
                    <div className="ad-name-cell">
                      <div className="ad-avatar">
                        {(m.photo?.enhanced || m.photo?.original)
                          ? <img src={m.photo.enhanced || m.photo.original} alt=""
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                          : null}
                        <span style={{ display: (m.photo?.enhanced || m.photo?.original) ? 'none' : 'flex' }}>
                          {(m.firstName || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="ad-name">{getFullName(m)}</span>
                        {m.founderNumber && (
                          <span style={{ display: 'block', fontSize: 11, color: '#C9A84C', fontWeight: 700, marginTop: 2 }}>
                            #{String(m.founderNumber).padStart(4, '0')}
                          </span>
                        )}
                        <span className="ad-fo-plan-mobile" style={{ color: pc.color }}>{pc.label}</span>
                      </div>
                    </div>
                  </td>
                  <td className="ad-col-email"><span className="ad-email">{m.email}</span></td>
                  <td className="ad-col-fo-plan">
                    <span style={{ fontWeight: 700, color: pc.color, fontSize: 13 }}>{pc.label}</span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                      background: sc.bg, color: sc.color,
                      fontSize: 12, fontWeight: 700, border: `1px solid ${sc.color}44`
                    }}>{sc.label}</span>
                  </td>
                  <td className="ad-col-date">
                    <span className="ad-date">{new Date(m.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td>
                    <div className="ad-fo-actions">
                      <button className="ad-btn-view" onClick={() => handleViewFoundingMember(m)}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.4" />
                          <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                        <span className="ad-btn-label">Voir</span>
                      </button>
                      {m.status === 'pending' && (
                        <>
                          <button className="ad-btn-confirm" onClick={() => handleConfirmFounder(m._id)}>✓</button>
                          <button className="ad-btn-reject-fo" onClick={() => handleRejectFounder(m._id, '')}>✕</button>
                        </>
                      )}
                      {m.status === 'confirmed' && (
                        <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>
                          #{String(m.founderNumber || 0).padStart(4, '0')}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /* ── TABLE RENDERER ── */
  const renderTable = () => {
    if (activeTab === 'appointments') return renderAppointmentsTable();
    if (activeTab === 'founding') return renderFoundingTable();
    if (activeTab === 'temoignages') return renderTemoignagesTable();

    let rows = [];
    if (activeTab === 'pending') rows = filteredPending;
    else if (activeTab === 'lawyers' || activeTab === 'verified') rows = filteredLawyersList;
    else if (activeTab === 'clients') rows = filteredClients;

    if (rows.length === 0) return (
      <div className="ad-state">
        <div className="ad-empty-icon">📭</div>
        <h3>{t('adminDashboard.noData')}</h3>
        <p style={{ color: '#4a5568', fontSize: 13 }}>Try adjusting your search</p>
      </div>
    );

    return (
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th className="ad-col-email">{t('email')}</th>
              <th className="ad-col-date">{t('date')}</th>
              {activeTab === 'pending' && <th>{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row._id}>
                <td>
                  <div className="ad-name-cell">
                    <div className="ad-avatar">
                      {(row.photo?.enhanced || row.photo?.original || row.avatarUrl || row.photoUrl)
                        ? <img
                          src={row.photo?.enhanced || row.photo?.original || row.avatarUrl || row.photoUrl}
                          alt=""
                          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                        : null}
                      <span style={{
                        display: (row.photo?.enhanced || row.photo?.original || row.avatarUrl || row.photoUrl) ? 'none' : 'flex'
                      }}>
                        {(row.firstName || row.fullName || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="ad-name">{getFullName(row)}</span>
                      <span className="ad-email-mobile">{row.email}</span>
                    </div>
                  </div>
                </td>
                <td className="ad-col-email"><span className="ad-email">{row.email}</span></td>
                <td className="ad-col-date"><span className="ad-date">{new Date(row.createdAt).toLocaleDateString()}</span></td>
                {activeTab === 'pending' && (
                  <td>
                    <button className="ad-btn-view" onClick={() => handleViewDetails(row)}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                      </svg>
                      {t('view')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* ── OVERVIEW RENDER ── */
  const renderOverview = () => {
    // MRR estimation
    const PRICES = { essentiel: 90, professionnel: 170, cabinet: 290 };
    const confirmedMembers = foundingMembers.filter(m => m.status === 'confirmed');
    const mrr = confirmedMembers.reduce((sum, m) => sum + (PRICES[m.plan] || 0), 0);
    const arr = mrr * 12;

    // Tier distribution
    const tierCounts = { professionnel: 0, essentiel: 0, cabinet: 0 };
    confirmedMembers.forEach(m => { if (tierCounts[m.plan] !== undefined) tierCounts[m.plan]++; });
    const totalTiers = confirmedMembers.length;

    // Geographic distribution
    const geoMap = {};
    foundingMembers.forEach(m => {
      const gov = m.barRegion || m.gouvernorat || m.city || 'Autre';
      geoMap[gov] = (geoMap[gov] || 0) + 1;
    });
    const geoEntries = Object.entries(geoMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const geoTotal = Math.max(foundingMembers.length, 1);

    // Cumulative growth chart (last 6 months)
    const today = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][d.getMonth()] };
    });
    const chartData = months.map(m => ({
      ...m,
      count: foundingMembers.filter(fm => {
        const d = new Date(fm.createdAt);
        return d.getFullYear() < m.year || (d.getFullYear() === m.year && d.getMonth() <= m.month);
      }).length,
    }));
    const chartW = 560, chartH = 160;
    const maxVal = Math.max(...chartData.map(d => d.count), 1);
    const pts = chartData.map((d, i) => ({
      x: 20 + (i / (chartData.length - 1)) * (chartW - 40),
      y: chartH - 10 - (d.count / maxVal) * (chartH - 20),
    }));
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${pts[pts.length-1].x.toFixed(1)} ${(chartH+5)} L ${pts[0].x.toFixed(1)} ${(chartH+5)} Z`;

    // Donut SVG
    const R = 48, CX = 60, CY = 60;
    const circ = 2 * Math.PI * R;
    const tiers = [
      { label: 'Professionnel', count: tierCounts.professionnel, color: '#C9A84C' },
      { label: 'Essentiel',     count: tierCounts.essentiel,     color: '#6b7280' },
      { label: 'Cabinet',       count: tierCounts.cabinet,       color: '#22c55e' },
    ];
    let dashOffset = circ * 0.25;
    const donutSegs = tiers.map(t => {
      const pct = totalTiers > 0 ? t.count / totalTiers : 0;
      const dash = pct * circ;
      const seg = { ...t, dash, offset: circ - dashOffset };
      dashOffset -= dash;
      return seg;
    });

    return (
      <div className="ad-ov-dark">
        {/* Header */}
        <div className="ad-ov-dark-header">
          <div>
            <div className="ad-ov-dark-title">Tableau de bord</div>
            <div className="ad-ov-dark-sub">Données en temps réel · Mis à jour maintenant</div>
          </div>
          <div className="ad-ov-dark-filters">
            {["Aujourd'hui", '7 jours', '30 jours', 'Tout'].map((f, i) => (
              <button key={i} className={`ad-ov-dark-filter${i === 0 ? ' active' : ''}`}>{f}</button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="ad-ov-dark-kpis">
          {[
            {
              label: 'ABONNÉS ACTIFS', icon: '⚖️', bar: '#C9A84C',
              value: stats.verifiedLawyers, unit: `/ ${stats.totalLawyers} total`,
              trend: stats.pendingLawyers > 0 ? `▲ ${stats.pendingLawyers} en attente` : '✓ À jour',
              trendUp: true,
              sub: `${confirmedMembers.length} Founding Members · ${Math.max(0, stats.verifiedLawyers - confirmedMembers.length)} standard`,
              prog: stats.totalLawyers > 0 ? (stats.verifiedLawyers / stats.totalLawyers) * 100 : 0,
            },
            {
              label: 'MRR ESTIMÉ', icon: '💰', bar: '#22c55e',
              value: mrr.toLocaleString('fr-FR'), unit: 'DT',
              trend: '▲ Fondateurs confirmés', trendUp: true,
              sub: `ARR projeté : ${arr.toLocaleString('fr-FR')} DT`,
              prog: Math.min((mrr / 2000) * 100, 100),
            },
            {
              label: 'FILE DE VÉRIFICATION', icon: '🚩', bar: '#ef4444',
              value: stats.pendingLawyers, unit: 'dossiers',
              trend: stats.pendingLawyers > 0 ? `${pendingFoundingCount} fondateurs · ${Math.max(0, stats.pendingLawyers - pendingFoundingCount)} avocats` : '✓ File vide',
              trendUp: false,
              sub: `Témoignages en attente : ${pendingTemoignagesCount}`,
              prog: null,
            },
            {
              label: 'CLIENTS INSCRITS', icon: '👥', bar: '#60a5fa',
              value: stats.totalClients, unit: 'clients',
              trend: '▲ Total plateforme', trendUp: true,
              sub: `Avocats vérifiés : ${stats.verifiedLawyers}`,
              prog: Math.min((stats.totalClients / 100) * 100, 100),
            },
          ].map((kpi, i) => (
            <div key={i} className="ad-ov-dark-kpi">
              <div className="ad-ov-dark-kpi-bar" style={{ background: kpi.bar }} />
              <div className="ad-ov-dark-kpi-top">
                <span className="ad-ov-dark-kpi-label">{kpi.label}</span>
                <span className="ad-ov-dark-kpi-icon">{kpi.icon}</span>
              </div>
              <div className="ad-ov-dark-kpi-value">
                {kpi.value} <span className="ad-ov-dark-kpi-unit">{kpi.unit}</span>
              </div>
              <div className={`ad-ov-dark-kpi-trend${kpi.trendUp ? ' up' : ''}`}>{kpi.trend}</div>
              <div className="ad-ov-dark-kpi-sub">{kpi.sub}</div>
              {kpi.prog !== null && (
                <div className="ad-ov-dark-kpi-progress">
                  <div className="ad-ov-dark-kpi-prog-fill" style={{ width: `${kpi.prog}%`, background: kpi.bar }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="ad-ov-dark-charts">

          {/* Line chart */}
          <div className="ad-ov-dark-chart-card ad-ov-dark-chart-main">
            <div className="ad-ov-dark-chart-head">
              <div>
                <div className="ad-ov-dark-chart-title">Croissance membres fondateurs</div>
                <div className="ad-ov-dark-chart-sub">Évolution cumulée · 6 derniers mois</div>
              </div>
            </div>
            <svg viewBox={`0 0 ${chartW} ${chartH + 28}`} style={{ width: '100%', height: 200, overflow: 'visible' }}>
              <defs>
                <linearGradient id="areaGradOv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((r, i) => (
                <line key={i} x1="20" y1={(chartH - 10) * r} x2={chartW - 20} y2={(chartH - 10) * r}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              ))}
              <path d={areaPath} fill="url(#areaGradOv)" />
              <path d={linePath} fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#C9A84C" stroke="#1a2535" strokeWidth="2" />
              ))}
              {chartData.map((d, i) => (
                <text key={i} x={pts[i].x} y={chartH + 22} textAnchor="middle"
                  fontSize="10.5" fill="rgba(255,255,255,0.28)" fontFamily="Plus Jakarta Sans, sans-serif">{d.label}</text>
              ))}
            </svg>
            <div className="ad-ov-dark-legend">
              <span className="ad-ov-dark-legend-item">
                <span className="ad-ov-dark-legend-dot" style={{ background: '#C9A84C' }} /> Membres fondateurs
              </span>
            </div>
          </div>

          {/* Donut + Geo */}
          <div className="ad-ov-dark-chart-card ad-ov-dark-chart-side">
            <div className="ad-ov-dark-chart-title">Répartition par tier</div>
            <div className="ad-ov-dark-chart-sub">{totalTiers} membres confirmés</div>

            <div className="ad-ov-donut-row">
              <svg width="120" height="120" viewBox="0 0 120 120">
                {totalTiers === 0
                  ? <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" />
                  : donutSegs.map((s, i) => (
                    <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                      stroke={s.color} strokeWidth="14"
                      strokeDasharray={`${s.dash} ${circ - s.dash}`}
                      strokeDashoffset={s.offset}
                    />
                  ))
                }
                <text x={CX} y={CY - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff" fontFamily="Fraunces,serif">{totalTiers}</text>
                <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.32)" fontFamily="Plus Jakarta Sans,sans-serif">membres</text>
              </svg>
              <div className="ad-ov-donut-legend">
                {tiers.map((t, i) => (
                  <div key={i} className="ad-ov-donut-leg-row">
                    <span className="ad-ov-donut-leg-dot" style={{ background: t.color }} />
                    <span className="ad-ov-donut-leg-label">{t.label}</span>
                    <span className="ad-ov-donut-leg-num">{t.count}</span>
                    <span className="ad-ov-donut-leg-pct">{totalTiers > 0 ? Math.round(t.count / totalTiers * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>

            {geoEntries.length > 0 && (
              <>
                <div className="ad-ov-geo-title">RÉPARTITION GÉOGRAPHIQUE</div>
                <div className="ad-ov-geo-list">
                  {geoEntries.map(([gov, count], i) => (
                    <div key={i} className="ad-ov-geo-row">
                      <span className="ad-ov-geo-label">{gov}</span>
                      <div className="ad-ov-geo-bar-wrap">
                        <div className="ad-ov-geo-bar-fill" style={{ width: `${(count / geoTotal) * 100}%`, background: ['#C9A84C','#22c55e','#60a5fa','#a855f7'][i] }} />
                      </div>
                      <span className="ad-ov-geo-num">{count}</span>
                      <span className="ad-ov-geo-pct">{Math.round(count / geoTotal * 100)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    );
  };

  /* ── SIDEBAR CONFIG ── */
  const sidebarItems = [
    {
      section: "VUE D'ENSEMBLE",
      items: [
        {
          key: 'overview', label: 'Vue Globale', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )
        },
      ],
    },
    {
      section: 'AVOCATS',
      items: [
        {
          key: 'pending', label: 'File de Vérification', badge: stats.pendingLawyers, icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 13c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
        {
          key: 'lawyers', label: 'Abonnés', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 13c0-2.21 2.239-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M13 13c0-1.657-1.567-3-3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="11" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )
        },
        {
          key: 'clients', label: 'Clients', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 13c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
        {
          key: 'appointments', label: 'Rendez-vous', badge: appointmentMeta.total7days || 0, icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
      ],
    },
    {
      section: 'MEMBRES FONDATEURS',
      items: [
        {
          key: 'founding',
          label: 'Dossiers Fondateurs',
          badge: pendingFoundingCount,
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.854 3.756L14 5.528l-3 2.924.708 4.13L8 10.5l-3.708 2.082L5 10.452 2 7.528l4.146-.772L8 1z"
                stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          )
        },
      ],
    },
    {
      section: 'TÉMOIGNAGES',
      items: [
        {
          key: 'temoignages',
          label: 'Modération',
          badge: pendingTemoignagesCount,
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )
        },
      ],
    },
    {
      section: 'ANALYTICS',
      items: [
        {
          key: 'analytics', label: 'Analytics SaaS', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12l3-4 3 2 3-5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        },
        {
          key: 'revenue', label: 'Revenus & MRR', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 5v6M6 6.5c0-.828.895-1.5 2-1.5s2 .672 2 1.5S9.105 8 8 8s-2 .672-2 1.5S6.895 11 8 11s2-.672 2-1.5"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
      ],
    },
    {
      section: 'SYSTÈME',
      items: [
        {
          key: 'settings', label: 'Paramètres', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
      ],
    },
  ];

  /* ── STAT CARDS CONFIG ── */
  const statCards = [
    { icon: '⚖️', value: stats.totalLawyers, label: t('adminDashboard.totalLawyers'), color: '#C9A84C', type: 'lawyers' },
    { icon: '✅', value: stats.verifiedLawyers, label: t('adminDashboard.verifiedLawyers'), color: '#4ade80', type: 'verified' },
    { icon: '⏳', value: stats.pendingLawyers, label: t('adminDashboard.pendingVerifications'), color: '#f59e0b', type: 'pending' },
    { icon: '👥', value: stats.totalClients, label: t('adminDashboard.totalClients'), color: '#60a5fa', type: 'clients' },
    { icon: '⭐', value: pendingFoundingCount, label: 'Fondateurs en attente', color: '#b8912a', type: 'founding' },
  ];

  /* ── PANEL TABS ── */
  const panelTabs = [
    { key: 'pending', label: t('adminDashboard.pendingVerifications'), count: stats.pendingLawyers },
    { key: 'lawyers', label: t('adminDashboard.totalLawyers') },
    { key: 'clients', label: t('adminDashboard.totalClients') },
    { key: 'appointments', label: 'Rendez-vous' },
    { key: 'temoignages', label: 'Témoignages', count: pendingTemoignagesCount },
  ];

  /* ── APPOINTMENT FILTERS ── */
  const apptFilters = [
    { key: '', label: 'Tous' },
    { key: 'today', label: "Aujourd'hui" },
    { key: '7days', label: '7 jours' },
    { key: 'urgences', label: 'Urgences' },
    { key: 'annules', label: 'Annulés' },
  ];

  /* ── TEMOIGNAGE FILTERS ── */
  const temoignageFilters = [
    { key: '',           label: 'Tous'        },
    { key: 'en_attente', label: 'En attente'  },
    { key: 'approuvé',   label: 'Approuvés'   },
    { key: 'rejeté',     label: 'Rejetés'     },
  ];

  /* ── RENDER ── */
  return (
    <div className="ad-root">

      {/* ── SIDEBAR OVERLAY (mobile) ── */}
      <div
        className={`ad-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`ad-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="ad-sidebar-brand">
          <Logo />
        </div>

        <nav className="ad-sidebar-nav">
          {sidebarItems.map((group, gi) => (
            <div key={gi} className="ad-nav-group">
              <div className="ad-nav-section">{group.section}</div>
              {group.items.map(item => (
                <button
                  key={item.key}
                  className={`ad-nav-item ${(sidebarNav === item.key || activeTab === item.key) ? 'active' : ''}`}
                  onClick={() => {
                    setSidebarNav(item.key);
                    setSidebarOpen(false);
                    if (item.key === 'overview') {
                      setActiveTab('');
                    } else if (['pending', 'lawyers', 'clients', 'verified', 'appointments', 'founding', 'temoignages'].includes(item.key)) {
                      handleCardClick(item.key);
                    }
                  }}
                >
                  <span className="ad-nav-icon">{item.icon}</span>
                  <span className="ad-nav-label">{item.label}</span>
                  {item.badge > 0 && <span className="ad-nav-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="ad-sidebar-footer">
          <div className="ad-sidebar-user">
            <div className="ad-sidebar-avatar">
              <span>{(user?.firstName || user?.fullName || user?.email || 'A').charAt(0).toUpperCase()}</span>
              <div className="ad-online-dot" />
            </div>
            <div className="ad-sidebar-user-info">
              <div className="ad-sidebar-user-name">
                {getFullName(user) !== '—' ? getFullName(user) : 'Admin'}
              </div>
              <div className="ad-sidebar-user-role">Administrateur</div>
            </div>
          </div>
          <button className="ad-sidebar-logout" onClick={() => setShowLogout(true)}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── LOGOUT MODAL ── */}
      <LogoutModal isOpen={showLogout} onClose={() => setShowLogout(false)} />

      {/* ── MAIN ── */}
      <main className="ad-main">

        {/* ── TOPBAR ── */}
        <div className="ad-topbar">
          {/* Bouton hamburger — visible uniquement sous 900px */}
          <button
            className="ad-hamburger-btn"
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-label="Ouvrir le menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h12M2 8h12M2 12h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>


          <div className="ad-topbar-right" style={{ marginLeft: 'auto' }}>

            {/* ── NOTIFICATION BELL ── */}
            <div className="ad-notif-wrapper">
              <button
                className="ad-notif-btn"
                onClick={handleToggleNotif}
                aria-label="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <path
                    d="M13.73 21a2 2 0 0 1-3.46 0"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="ad-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="ad-notif-dropdown">
                  <div className="ad-notif-header">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <button className="ad-notif-mark-all" onClick={handleMarkAllRead}>
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  <div className="ad-notif-list">
                    {notifications.length === 0 ? (
                      <div className="ad-notif-empty">Aucune notification</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n._id}
                          className={`ad-notif-item${n.read ? '' : ' unread'}`}
                          onClick={() => handleNotifClick(n)}
                        >
                          <span className="ad-notif-icon">{NOTIF_ICONS[n.type] || '🔔'}</span>
                          <div className="ad-notif-body">
                            <div className="ad-notif-title">{n.title}</div>
                            <div className="ad-notif-msg">{n.message}</div>
                            <div className="ad-notif-time">
                              {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                          </div>
                          {!n.read && <span className="ad-notif-dot" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ad-content">

          {/* ══════════════════════════════════════
              VUE GLOBALE (overview)
          ══════════════════════════════════════ */}
          {sidebarNav === 'overview' && !activeTab && renderOverview()}


          {/* ── PANEL ── */}
          {activeTab && (
            <div className="ad-panel">
              <div className="ad-panel-header">

                {/* Tabs principaux */}
                <div className="ad-tabs">
                  {panelTabs.map(tab => (
                    <button
                      key={tab.key}
                      className={`ad-tab ${activeTab === tab.key ? 'active' : ''}`}
                      onClick={() => handleCardClick(tab.key)}
                    >
                      {tab.label}
                      {tab.count > 0 && <span className="ad-tab-badge">{tab.count}</span>}
                    </button>
                  ))}
                </div>

                {/* Filtres appointments */}
                {activeTab === 'appointments' && (
                  <div className="ad-tabs" style={{ marginTop: 8 }}>
                    {apptFilters.map(f => (
                      <button
                        key={f.key}
                        className={`ad-tab ${appointmentFilter === f.key ? 'active' : ''}`}
                        onClick={() => handleCardClick('appointments', f.key)}
                      >
                        {f.label}
                        {f.key === 'urgences' && appointmentMeta.urgences > 0 && (
                          <span className="ad-tab-badge">{appointmentMeta.urgences}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Filtres témoignages */}
                {activeTab === 'temoignages' && (
                  <div className="ad-tabs" style={{ marginTop: 8 }}>
                    {temoignageFilters.map(f => (
                      <button
                        key={f.key}
                        className={`ad-tab ${temoignageFilter === f.key ? 'active' : ''}`}
                        onClick={() => handleCardClick('temoignages', f.key)}
                      >
                        {f.label}
                        {f.key === 'en_attente' && pendingTemoignagesCount > 0 && (
                          <span className="ad-tab-badge">{pendingTemoignagesCount}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="ad-panel-search">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('search')}
                  />
                  {searchQuery && (
                    <button className="ad-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                  )}
                </div>
              </div>

              <div className="ad-panel-body">
                {panelLoading ? (
                  <div className="ad-state">
                    <div className="ad-spinner" />
                    <h3>{t('loading')}</h3>
                  </div>
                ) : panelError ? (
                  <div className="ad-state">
                    <div style={{ fontSize: 40 }}>⚠️</div>
                    <h3>{panelError}</h3>
                  </div>
                ) : renderTable()}
              </div>
            </div>
          )}

        </div>
      </main>

      <VerificationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        lawyer={selectedLawyer}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isVerifying}
      />

      <VerificationModal
        isOpen={isFoundingModalOpen}
        onClose={handleCloseFoundingModal}
        lawyer={selectedFoundingMember}
        onApprove={handleConfirmFounder}
        onReject={handleRejectFounder}
        isLoading={isFoundingVerifying}
      />

    </div>
  );
};

export default AdminDashboard;