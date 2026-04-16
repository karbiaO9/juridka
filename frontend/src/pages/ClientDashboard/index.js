import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import CasesManager from '../../components/CasesManager';
import PaymentModal from '../../components/PaymentModal';
import BookingModal from '../../components/BookingModal';
import FileViewer from '../../components/FileViewer';
import { rendezVousAPI, authAPI, userAPI, notificationAPI, temoignageAPI } from '../../services/api';
import TestimonialModal from '../../components/TestimonialModal';
import { validatePassword, PASSWORD_POLICY_MESSAGE } from '../../utils/password';
import { useTranslation } from 'react-i18next';
import Chatbot from '../../components/chatbot';
import Logo from '../../components/Logo';
import LogoutModal from '../../components/LogoutModal';
import './ClientDashboard.css';

function getCreatedTime(obj) {
  if (!obj) return 0;
  const p = obj.createdAt || obj.createDate || obj.created || obj.dateCreated || obj.created_at;
  const t = p ? new Date(p).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}
function sortByCreated(arr) {
  try { return [...(arr || [])].sort((a, b) => getCreatedTime(b) - getCreatedTime(a)); }
  catch { return arr || []; }
}

/* ─── notification icons ─── */
const NOTIF_ICONS = {
  appointment_confirmed:   '✅',
  appointment_rejected:    '❌',
  appointment_rescheduled: '🔄',
  appointment_created:     '📅',
  appointment_cancelled:   '🗓️',
  payment_confirmed:       '💳',
  payment_pending:         '⏳',
  temoignage_approved:     '🌟',
  temoignage_rejected:     '🚫',
};

function NotifDropdown({ notifications, unreadCount, onMarkAll, onMarkOne }) {
  return (
    <div className="cd-notif-dropdown">
      <div className="cd-notif-header">
        <span>Notifications</span>
        {unreadCount > 0 && (
          <button className="cd-notif-mark-all" onClick={onMarkAll}>Tout marquer lu</button>
        )}
      </div>
      <div className="cd-notif-list">
        {notifications.length === 0 ? (
          <div className="cd-notif-empty">Aucune notification</div>
        ) : notifications.map(n => (
          <div
            key={n._id}
            className={`cd-notif-item${n.read ? '' : ' unread'}`}
            onClick={() => !n.read && onMarkOne(n._id)}
          >
            <span className="cd-notif-icon">{NOTIF_ICONS[n.type] || '🔔'}</span>
            <div className="cd-notif-body">
              <div className="cd-notif-title">{n.title}</div>
              <div className="cd-notif-msg">{n.message}</div>
              <div className="cd-notif-time">
                {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {!n.read && <span className="cd-notif-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── status helpers ─── */
const STATUS_CFG = {
  confirmé:   { label: 'Confirmé',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: '#22c55e40', gradient: 'linear-gradient(135deg,#10b981,#059669)' },
  en_attente: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b40', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  payé:       { label: 'Payé',       color: '#b8912a', bg: 'rgba(184,145,42,0.12)',  border: '#b8912a40', gradient: 'linear-gradient(135deg,#b8912a,#7a5e18)' },
  refusé:     { label: 'Refusé',     color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: '#ef444430', gradient: 'linear-gradient(135deg,#ef4444,#dc2626)' },
  annulé:     { label: 'Annulé',     color: '#9ca3af', bg: 'rgba(156,163,175,0.10)', border: '#9ca3af30', gradient: 'linear-gradient(135deg,#9ca3af,#6b7280)' },
};
const sc = (s) => STATUS_CFG[s] || STATUS_CFG.annulé;

/* ══════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════ */
const ClientDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const { t } = useTranslation();

  const [currentView,          setCurrentView]          = useState('overview');
  const [loading,              setLoading]              = useState(true);
  const [isMobileMenuOpen,     setIsMobileMenuOpen]     = useState(false);
  const [appointments,         setAppointments]         = useState([]);
  const [statistics,           setStatistics]           = useState({
    totalAppointments: 0, pendingRequests: 0, paidAppointments: 0,
    confirmedAppointments: 0, upcomingAppointments: 0,
  });

  const [profileData,          setProfileData]          = useState({ fullName:'', email:'', phone:'', idType:'', idNumber:'' });
  const [passwordData,         setPasswordData]         = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [isEditingProfile,     setIsEditingProfile]     = useState(false);
  const [isChangingPassword,   setIsChangingPassword]   = useState(false);
  const [profileLoading,       setProfileLoading]       = useState(false);
  const [passwordLoading,      setPasswordLoading]      = useState(false);
  const [filterStatus,         setFilterStatus]         = useState('all');

  const [notifications,        setNotifications]        = useState([]);
  const [unreadCount,          setUnreadCount]          = useState(0);
  const [notifOpen,            setNotifOpen]            = useState(false);

  const [paymentModalOpen,     setPaymentModalOpen]     = useState(false);
  const [selectedAppointment,  setSelectedAppointment]  = useState(null);
  const [bookingModalOpen,     setBookingModalOpen]     = useState(false);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState(null);

  const [detailsModalOpen,     setDetailsModalOpen]     = useState(false);
  const [selectedDetails,      setSelectedDetails]      = useState(null);
  const [showLogout,           setShowLogout]           = useState(false);

  const [testimonialApt,       setTestimonialApt]       = useState(null);
  const [submittedRdvs,        setSubmittedRdvs]        = useState([]); // [{rendezVousId, statut, reference}]

  /* ── load appointments ── */
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const today = new Date();
    rendezVousAPI.getClientRendezVous(user.id || user._id)
      .then(res => {
        const data   = res.data || res || [];
        const sorted = sortByCreated(data);
        setAppointments(sorted);
        setStatistics({
          totalAppointments:    sorted.length,
          pendingRequests:      sorted.filter(a => a.statut === 'en_attente').length,
          paidAppointments:     sorted.filter(a => a.statut === 'payé').length,
          confirmedAppointments:sorted.filter(a => a.statut === 'confirmé').length,
          upcomingAppointments: sorted.filter(a => new Date(a.date) >= today && a.statut === 'confirmé').length,
        });
      })
      .catch(e => console.error('Error loading appointments:', e))
      .finally(() => setLoading(false));
  }, [user]);

  /* ── init profile ── */
  useEffect(() => {
    if (user) setProfileData({
      fullName: user.fullName || '',
      email:    user.email    || '',
      phone:    user.phone    || '',
      idType:   user.idType   || '',
      idNumber: user.idNumber || '',
    });
  }, [user]);

  /* ── refresh full user data on mount ── */
  useEffect(() => {
    if (!user) return;
    userAPI.refreshUserData()
      .then(updated => { if (updated) updateUser(updated); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  /* ── notifications ── */
  useEffect(() => {
    if (!user) return;
    const load = () => {
      notificationAPI.getAll()
        .then(data => { setNotifications(data.notifications || []); setUnreadCount(data.unreadCount || 0); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e) => { if (!e.target.closest('.cd-notif-wrapper')) setNotifOpen(false); };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleMarkOneRead = async (id) => {
    try {
      await notificationAPI.markOneRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const computeStats = (arr) => {
    const today = new Date();
    return {
      totalAppointments:    arr.length,
      pendingRequests:      arr.filter(a => a.statut === 'en_attente').length,
      paidAppointments:     arr.filter(a => a.statut === 'payé').length,
      confirmedAppointments:arr.filter(a => a.statut === 'confirmé').length,
      upcomingAppointments: arr.filter(a => new Date(a.date) >= today && a.statut === 'confirmé').length,
    };
  };

  /* ── handlers ── */
  /* ── load submitted testimonials ── */
  useEffect(() => {
    if (!user) return;
    temoignageAPI.getSubmittedRdvs()
      .then(data => setSubmittedRdvs(data || []))
      .catch(() => {});
  }, [user]);

  /* ── testimonial eligibility ── */
  const getTestimonialStatus = (apt) => {
    const submitted = submittedRdvs.find(t => String(t.rendezVousId) === String(apt._id));
    if (submitted) return { type: 'submitted', statut: submitted.statut, reference: submitted.reference };

    const isCompleted = apt.statut === 'terminé' ||
      (apt.statut === 'confirmé' && new Date(apt.date) < new Date());
    if (!isCompleted) return null;

    const aptDate   = new Date(apt.date);
    const now       = new Date();
    const dayAfter  = new Date(aptDate.getTime() + 24 * 60 * 60 * 1000);
    const windowEnd = new Date(aptDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (now < dayAfter || now > windowEnd) return null;

    const daysLeft = Math.ceil((windowEnd - now) / (24 * 60 * 60 * 1000));
    return { type: 'eligible', daysLeft };
  };

  const handleProfileChange  = e => setProfileData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handlePasswordChange = e => setPasswordData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setProfileLoading(true);
    try {
      const res = await authAPI.updateProfile(profileData);
      if (res?.data) { updateUser(res.data.user); setIsEditingProfile(false); alert(t('clientDashboard.profileUpdated')); }
    } catch (err) { alert(`${t('common.errorPrefix')} ${err.response?.data?.error || err.message}`); }
    finally { setProfileLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) return alert(t('clientDashboard.passwordMismatch'));
    if (!validatePassword(passwordData.newPassword)) return alert(PASSWORD_POLICY_MESSAGE);
    setPasswordLoading(true);
    try {
      const res = await authAPI.changePassword({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword });
      if (res.status === 200) { setPasswordData({ currentPassword:'', newPassword:'', confirmPassword:'' }); setIsChangingPassword(false); alert(t('clientDashboard.passwordChanged')); }
    } catch (err) { alert(`${t('common.errorPrefix')} ${err.response?.data?.message || err.message}`); }
    finally { setPasswordLoading(false); }
  };

  const handlePayNow = (apt) => { setSelectedAppointment(apt); setPaymentModalOpen(true); };

  const handlePaymentConfirm = (aptId) => {
    setAppointments(prev => {
      const next = sortByCreated(prev.map(a => a._id === aptId ? { ...a, statut: 'payé' } : a));
      setStatistics(computeStats(next));
      return next;
    });
  };

  const handleCancel = async (aptId) => {
    if (!window.confirm(t('clientDashboard.confirmCancel'))) return;
    let previous = null;
    setAppointments(prev => {
      previous = prev;
      const next = sortByCreated(prev.map(a => a._id === aptId ? { ...a, statut: 'annulé' } : a));
      setStatistics(computeStats(next)); return next;
    });
    try { await rendezVousAPI.updateRendezVous(aptId, { statut: 'annulé' }); }
    catch { alert(t('clientDashboard.cancelError')); if (previous) { setAppointments(sortByCreated(previous)); setStatistics(computeStats(previous)); } }
  };

  const handleReschedule = (aptId) => {
    const apt = appointments.find(a => a._id === aptId);
    if (!apt) return alert(t('clientDashboard.appointmentNotFound'));
    setAppointmentToReschedule(apt); setBookingModalOpen(true);
  };

  const openDetails = (apt) => { setSelectedDetails(apt); setDetailsModalOpen(true); };

  const navTo = (view) => { setCurrentView(view); setIsMobileMenuOpen(false); };

  /* ══════════════════════════════════════════════
     APPOINTMENT CARD
  ══════════════════════════════════════════════ */
  const AppointmentCard = ({ apt }) => {
    const s    = sc(apt.statut);
    const date = new Date(apt.date);
    return (
      <div className={`appointment-card ${apt.statut}`}>
        {/* header */}
        <div className="appointment-card-header">
          <div className="lawyer-section">
            <div className="lawyer-avatar">
              {apt.avocatId?.avatarUrl
                ? <img src={apt.avocatId.avatarUrl} alt="" />
                : <span className="avatar-placeholder">{(apt.avocatId?.fullName || apt.avocatId?.nom || 'L').charAt(0).toUpperCase()}</span>}
            </div>
            <div className="lawyer-info">
              <div className="lawyer-name">{apt.avocatId?.fullName || apt.avocatId?.nom || apt.lawyerNom || 'Avocat'}</div>
              <div className="lawyer-specialty">{apt.avocatId?.specialization || apt.avocatId?.specialites || 'Consultant Juridique'}</div>
            </div>
          </div>
          <span className="status-badge" style={{ background: s.gradient }}>{s.label}</span>
        </div>

        {/* body */}
        <div className="appointment-card-body">
          <div className="appointment-date-time">
            <div className="date-block">
              <div className="date-number">{date.getDate()}</div>
              <div className="date-month">{date.toLocaleDateString('fr-FR', { month: 'short' })}</div>
              <div className="date-year">{date.getFullYear()}</div>
            </div>
            <div className="time-block">
              <div className="time-icon">🕐</div>
              <div className="time-text">{apt.heure || '–'}</div>
              <div className="day-name">{date.toLocaleDateString('fr-FR', { weekday: 'long' })}</div>
            </div>
          </div>
          {apt.message && (
            <div className="appointment-message">
              <div className="message-label">Votre message</div>
              <div className="message-text">{apt.message}</div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="appointment-card-footer">
          <button className="btn-action btn-primary" onClick={() => openDetails(apt)}>
            <span className="btn-icon">👁️</span> {t('clientDashboard.viewDetails')}
          </button>
          <div className="btn-group">
            {apt.statut === 'en_attente' && (
              <button className="btn-action btn-pay" onClick={e => { e.stopPropagation(); handlePayNow(apt); }}>
                <span className="btn-icon">💳</span> {t('clientDashboard.pay')}
              </button>
            )}
            {['confirmé','en_attente'].includes(apt.statut) && <>
              <button className="btn-action btn-secondary" onClick={e => { e.stopPropagation(); handleReschedule(apt._id); }}>
                <span className="btn-icon">📅</span> {t('clientDashboard.reschedule')}
              </button>
              <button className="btn-action btn-danger" onClick={e => { e.stopPropagation(); handleCancel(apt._id); }}>
                <span className="btn-icon">✖</span> {t('clientDashboard.cancel')}
              </button>
            </>}
            {(() => {
              const ts = getTestimonialStatus(apt);
              if (!ts) return null;
              if (ts.type === 'eligible') return (
                <button
                  className="btn-action btn-testimonial"
                  onClick={e => { e.stopPropagation(); setTestimonialApt(apt); }}
                >
                  <span className="btn-icon">🗨️</span> Partager mon expérience
                  <span className="btn-testimonial-days">{ts.daysLeft}j</span>
                </button>
              );
              if (ts.type === 'submitted') return (
                <span className="tm-submitted-info">
                  {ts.statut === 'approuvé' ? '✅' : '⏳'} Témoignage {ts.statut === 'approuvé' ? 'publié' : 'en cours de vérification'}
                </span>
              );
              return null;
            })()}
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     OVERVIEW VIEW
  ══════════════════════════════════════════════ */
  const OverviewView = () => (
    <div className="view-container">
      <div className="view-header-section">
        <div className="welcome-header">
          <div className="welcome-content">
            <div className="welcome-title">{t('clientDashboard.welcomeToLegalHub')}</div>
            <div className="welcome-subtitle">{t('clientDashboard.trackAppointments')}</div>
          </div>
          <div className="welcome-illustration">
            <div className="illustration-circle" />
            <div className="illustration-icon">⚖️</div>
          </div>
        </div>
      </div>

      <div className="stats-container">
        {[
          { label: t('clientDashboard.totalAppointments'),  value: statistics.totalAppointments,    color: '#b8912a', key: 'all' },
          { label: t('clientDashboard.confirmedMeetings'),  value: statistics.confirmedAppointments, color: '#22c55e', key: 'confirmed', cls: 'confirmed' },
          { label: t('clientDashboard.awaitingResponse'),   value: statistics.pendingRequests,       color: '#f59e0b', key: 'pending',   cls: 'pending' },
          { label: t('clientDashboard.upcomingMeetings'),   value: statistics.upcomingAppointments,  color: '#60a5fa', key: 'upcoming',  cls: 'upcoming' },
        ].map((s, i) => (
          <div key={i} className={`stat-card overview-stat${s.cls ? ' ' + s.cls : ''}`}>
            <div className="stat-icon">
              {['📊','✓','⏳','📅'][i]}
            </div>
            <div className="stat-content">
              <div className="stat-number" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><span className="title-icon">📋</span>{t('clientDashboard.recentAppointments')}</h2>
          <button className="btn-view-all" onClick={() => navTo('appointments')}>{t('clientDashboard.viewAll')} →</button>
        </div>
        <div className="card-content">
          {appointments.length === 0 ? (
            <div className="empty-state small">
              <div className="empty-icon">📭</div>
              <p className="empty-text">{t('clientDashboard.noAppointmentsYet')}</p>
              <button className="btn-action btn-primary btn-large" onClick={() => window.location.href = '/lawyers'}>
                <span className="btn-icon">🔍</span> {t('clientDashboard.browseLawyers')}
              </button>
            </div>
          ) : (
            <div className="appointments-list-compact">
              {appointments.slice(0, 3).map(apt => {
                const s = sc(apt.statut);
                return (
                  <div key={apt._id} className="appointment-compact" onClick={() => openDetails(apt)}>
                    <div className="compact-lawyer">
                      <div className="compact-avatar">
                        {apt.avocatId?.avatarUrl
                          ? <img src={apt.avocatId.avatarUrl} alt="" />
                          : <span>{(apt.avocatId?.fullName || 'L').charAt(0).toUpperCase()}</span>}
                      </div>
                      <div className="compact-info">
                        <div className="compact-name">{apt.avocatId?.fullName || apt.lawyerNom || 'Avocat'}</div>
                        <div className="compact-date">
                          {new Date(apt.date).toLocaleDateString('fr-FR', { month:'short', day:'numeric', year:'numeric' })} · {apt.heure}
                        </div>
                      </div>
                    </div>
                    <span className="compact-status" style={{ background: s.gradient }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════
     APPOINTMENTS VIEW
  ══════════════════════════════════════════════ */
  const AppointmentsView = () => {
    if (loading) return <div className="loading-state"><div className="loading-spinner" /><p className="loading-text">{t('clientDashboard.loadingAppointments')}</p></div>;

    const canceled   = ['refusé','annulé','rejeté'];
    const pending    = appointments.filter(a => a.statut === 'en_attente');
    const paid       = appointments.filter(a => a.statut === 'payé');
    const confirmed  = appointments.filter(a => a.statut === 'confirmé');
    const terminated = appointments.filter(a => a.statut === 'terminé');
    const rejected   = appointments.filter(a => canceled.includes(a.statut));

    const statCards = [
      { key:'all',        label: t('clientDashboard.totalAppointments'),  value: statistics.totalAppointments,    color:'#b8912a' },
      { key:'en_attente', label: t('clientDashboard.awaitingResponse'),   value: statistics.pendingRequests,      color:'#f59e0b', cls:'pending'  },
      { key:'confirmé',   label: t('clientDashboard.confirmedMeetings'),  value: statistics.confirmedAppointments, color:'#22c55e', cls:'confirmed' },
      { key:'today',      label: t('clientDashboard.upcomingMeetings'),   value: statistics.upcomingAppointments,  color:'#60a5fa', cls:'upcoming'  },
    ];

    const icons = ['📊','⏳','✓','📅'];

    const filteredApts = filterStatus === 'all'   ? appointments
      : filterStatus === 'today'
        ? appointments.filter(a => new Date(a.date).toDateString() === new Date().toDateString() && a.statut === 'confirmé')
        : appointments.filter(a => a.statut === filterStatus);

    return (
      <div className="view-container">
        <div className="view-header-section">
          <div className="view-title-group">
            <h1 className="view-title">{t('clientDashboard.myConsultations')}</h1>
            <p className="view-subtitle">{t('clientDashboard.trackAppointments')}</p>
          </div>
        </div>

        {/* stat filter cards */}
        <div className="stats-container">
          {statCards.map((s, i) => (
            <div key={s.key}
              className={`stat-card${s.cls ? ' ' + s.cls : ''}${filterStatus === s.key ? ' active' : ''}`}
              style={{ '--cl-stat-color': s.color }}
              onClick={() => setFilterStatus(s.key)}>
              <div className="stat-icon">{icons[i]}</div>
              <div className="stat-content">
                <div className="stat-number">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* listing */}
        {filterStatus === 'all' ? (
          <div className="appointments-sections">
            {pending.length > 0 && (
              <div className="appointments-section">
                <h2 className="section-title"><span className="section-icon">⏳</span>{t('clientDashboard.waitingResponse')} <span style={{color:'var(--cl-text3)',fontFamily:'var(--cl-font-body)',fontSize:13}}>({pending.length})</span></h2>
                <div className="section-description"><p>{t('clientDashboard.waitingResponseDesc')}</p></div>
                <div className="appointments-grid">{pending.map(a => <AppointmentCard key={a._id} apt={a} />)}</div>
              </div>
            )}
            {paid.length > 0 && (
              <div className="appointments-section">
                <h2 className="section-title"><span className="section-icon">💳</span>Payés <span style={{color:'var(--cl-text3)',fontFamily:'var(--cl-font-body)',fontSize:13}}>({paid.length})</span></h2>
                <div className="appointments-grid">{paid.map(a => <AppointmentCard key={a._id} apt={a} />)}</div>
              </div>
            )}
            {confirmed.length > 0 && (
              <div className="appointments-section">
                <h2 className="section-title"><span className="section-icon">✓</span>{t('clientDashboard.confirmedConsultations')} <span style={{color:'var(--cl-text3)',fontFamily:'var(--cl-font-body)',fontSize:13}}>({confirmed.length})</span></h2>
                <div className="section-description"><p>{t('clientDashboard.confirmedConsultationsDesc')}</p></div>
                <div className="appointments-grid">{confirmed.map(a => <AppointmentCard key={a._id} apt={a} />)}</div>
              </div>
            )}
            {terminated.length > 0 && (
              <div className="appointments-section">
                <h2 className="section-title"><span className="section-icon">✅</span>Consultations terminées <span style={{color:'var(--cl-text3)',fontFamily:'var(--cl-font-body)',fontSize:13}}>({terminated.length})</span></h2>
                <div className="appointments-grid">{terminated.map(a => <AppointmentCard key={a._id} apt={a} />)}</div>
              </div>
            )}
            {rejected.length > 0 && (
              <div className="appointments-section">
                <h2 className="section-title"><span className="section-icon">✖</span>{t('clientDashboard.canceledUnavailable')} <span style={{color:'var(--cl-text3)',fontFamily:'var(--cl-font-body)',fontSize:13}}>({rejected.length})</span></h2>
                <div className="appointments-grid">{rejected.map(a => <AppointmentCard key={a._id} apt={a} />)}</div>
              </div>
            )}
            {appointments.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3 className="empty-title">{t('clientDashboard.welcomeLegalHub')}</h3>
                <p className="empty-text">{t('clientDashboard.noConsultationsYet')}</p>
                <button className="btn-action btn-primary btn-large" onClick={() => window.location.href='/lawyers'}>
                  <span className="btn-icon">🔍</span> {t('clientDashboard.browseLawyers')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="appointments-section">
            <div className="appointments-grid">
              {filteredApts.length > 0
                ? filteredApts.map(a => <AppointmentCard key={a._id} apt={a} />)
                : <div className="no-appointments"><p>{t('clientDashboard.noFilteredAppointments')}</p></div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     PROFILE VIEW
  ══════════════════════════════════════════════ */
  const ProfileView = () => (
    <div className="view-container">
      <div className="view-header-section">
        <div className="view-title-group">
          <h1 className="view-title">{t('clientDashboard.personalInformation')}</h1>
          <p className="view-subtitle">{t('clientDashboard.keepContactUpdated')}</p>
        </div>
      </div>

      <div className="profile-sections">
        {/* personal info */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-icon">👤</span>
              <h2 className="section-title">{t('clientDashboard.contactInformation')}</h2>
            </div>
            {!isEditingProfile && (
              <button className="btn-edit" onClick={() => setIsEditingProfile(true)}>✏️ {t('clientDashboard.updateInfo')}</button>
            )}
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleUpdateProfile} className="profile-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('clientDashboard.fullName')} *</label>
                  <input className="form-input" type="text" name="fullName" value={profileData.fullName} onChange={handleProfileChange} required />
                </div>
                <div className="form-group">
                  <label>{t('clientDashboard.emailAddress')} *</label>
                  <input className="form-input" type="email" name="email" value={profileData.email} onChange={handleProfileChange} required />
                </div>
                <div className="form-group">
                  <label>{t('clientDashboard.phoneNumber')}</label>
                  <input className="form-input" type="tel" name="phone" value={profileData.phone} onChange={handleProfileChange} />
                </div>
                <div className="form-group">
                  <label>Type de pièce d'identité</label>
                  <select className="form-input" name="idType" value={profileData.idType || ''} onChange={handleProfileChange}>
                    <option value="">— Sélectionner —</option>
                    <option value="cin">Carte d'identité nationale (CIN)</option>
                    <option value="passport">Passeport</option>
                    <option value="residence_permit">Titre de séjour</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Numéro de pièce d'identité</label>
                  <input className="form-input" type="text" name="idNumber" value={profileData.idNumber} onChange={handleProfileChange} placeholder={profileData.idType === 'cin' ? '8 chiffres' : ''} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsEditingProfile(false)}>✕ {t('clientDashboard.cancel')}</button>
                <button type="submit"  className="btn-save" disabled={profileLoading}>
                  {profileLoading ? `⏳ ${t('clientDashboard.saving')}` : `💾 ${t('clientDashboard.saveChanges')}`}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-display">
              <div className="profile-info-grid">
                {[
                  { label: t('clientDashboard.fullName'),     value: user.fullName },
                  { label: t('clientDashboard.emailAddress'), value: user.email },
                  { label: t('clientDashboard.phoneNumber'),  value: user.phone },
                  { label: 'Type de pièce d\'identité',       value: user.idType === 'cin' ? 'CIN' : user.idType === 'passport' ? 'Passeport' : user.idType === 'residence_permit' ? 'Titre de séjour' : null },
                  { label: 'Numéro de pièce d\'identité',     value: user.idNumber },
                ].map((f, i) => (
                  <div key={i} className={`info-item${f.full ? ' full-width' : ''}`}>
                    <label>{f.label}</label>
                    <p>{f.value || <span style={{ color: 'var(--cl-text3)', fontStyle: 'italic' }}>Non renseigné</span>}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* security */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-icon">🔒</span>
              <h2 className="section-title">{t('clientDashboard.accountSecurity')}</h2>
            </div>
            {!isChangingPassword && (
              <button className="btn-edit" onClick={() => setIsChangingPassword(true)}>🔑 {t('clientDashboard.changePassword')}</button>
            )}
          </div>
          
          {isChangingPassword && (
            <form onSubmit={handleChangePassword} className="password-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('clientDashboard.currentPassword')}</label>
                  <input className="form-input" type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required />
                </div>
                <div className="form-group">
                  <label>{t('clientDashboard.newPassword')}</label>
                  <input className="form-input" type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required minLength="8" />
                </div>
                <div className="form-group">
                  <label>{t('clientDashboard.confirmNewPassword')}</label>
                  <input className="form-input" type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required minLength="8" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsChangingPassword(false)}>✕ {t('clientDashboard.cancel')}</button>
                <button type="submit"  className="btn-save" disabled={passwordLoading}>
                  {passwordLoading ? `⏳ ${t('clientDashboard.updating')}` : `🔒 ${t('clientDashboard.updatePassword')}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════
     APPOINTMENT DETAIL MODAL
  ══════════════════════════════════════════════ */
  const DetailModal = () => {
    if (!detailsModalOpen || !selectedDetails) return null;
    const apt = selectedDetails;
    const s   = sc(apt.statut);
    return (
      <div className="modal-overlay" onClick={() => setDetailsModalOpen(false)}>
        <div className="modal-content appointment-details-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title"><span className="title-icon">📋</span>{t('clientDashboard.appointmentDetails')}</h3>
            <button className="modal-close" onClick={() => setDetailsModalOpen(false)}>✕</button>
          </div>

          <div className="modal-body">
            {/* lawyer */}
            <div className="detail-section">
              <h4 className="detail-section-title"><span className="section-icon">👨‍⚖️</span>{t('clientDashboard.lawyerInformation')}</h4>
              <div className="lawyer-detail-card">
                <div className="lawyer-avatar-large">
                  {apt.avocatId?.avatarUrl
                    ? <img src={apt.avocatId.avatarUrl} alt="" />
                    : <span>{(apt.avocatId?.fullName || 'L').charAt(0).toUpperCase()}</span>}
                </div>
                <div className="lawyer-detail-info">
                  <h5>{apt.avocatId?.fullName || apt.lawyerNom || 'Avocat'}</h5>
                  <p className="specialty">{apt.avocatId?.specialization || apt.avocatId?.specialites || 'Consultant Juridique'}</p>
                  <p className="contact">{apt.avocatId?.email || '–'}</p>
                  {apt.avocatId?.phone && <p className="contact">{apt.avocatId.phone}</p>}
                </div>
              </div>
            </div>

            {/* date & time */}
            <div className="detail-section">
              <h4 className="detail-section-title"><span className="section-icon">📅</span>{t('clientDashboard.appointmentInformation')}</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">{t('clientDashboard.date')}</span>
                  <span className="info-value">{new Date(apt.date).toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">{t('clientDashboard.time')}</span>
                  <span className="info-value" style={{ color: 'var(--cl-gold)', fontFamily: 'monospace', fontWeight: 700 }}>{apt.heure}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">{t('clientDashboard.status')}</span>
                  <span className="status-badge-small" style={{ background: s.gradient }}>{s.label}</span>
                </div>
              </div>
            </div>

            {/* message */}
            {apt.message && (
              <div className="detail-section">
                <h4 className="detail-section-title"><span className="section-icon">💬</span>{t('clientDashboard.yourMessage')}</h4>
                <div className="message-box"><p>{apt.message}</p></div>
              </div>
            )}
            {apt.note && (
              <div className="detail-section">
                <h4 className="detail-section-title"><span className="section-icon">📝</span>{t('clientDashboard.lawyerNotes')}</h4>
                <div className="message-box note-box"><p>{apt.note}</p></div>
              </div>
            )}
            {apt.caseFiles?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section-title"><span className="section-icon">📎</span>{t('clientDashboard.clientFiles')}</h4>
                <div className="documents-list">
                  {apt.caseFiles.map((doc, i) => (
                    <FileViewer key={i} file={doc.url || doc} fileName={doc.filename || `Document ${i+1}`} showPreview />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {apt.statut === 'en_attente' && (
              <button className="btn-modal btn-pay" onClick={() => { setDetailsModalOpen(false); handlePayNow(apt); }}>
                <span className="btn-icon">💳</span> {t('clientDashboard.payNow')}
              </button>
            )}
            {['confirmé','en_attente'].includes(apt.statut) && <>
              <button className="btn-modal btn-secondary" onClick={() => { setDetailsModalOpen(false); handleReschedule(apt._id); }}>
                <span className="btn-icon">📅</span> {t('clientDashboard.reschedule')}
              </button>
              <button className="btn-modal btn-danger" onClick={() => { setDetailsModalOpen(false); handleCancel(apt._id); }}>
                <span className="btn-icon">✖</span> {t('clientDashboard.cancel')}
              </button>
            </>}
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     NAV ITEMS
  ══════════════════════════════════════════════ */
  const navItems = [
    { key: 'overview',      label: t('clientDashboard.overview'),       icon: '🏠' },
    { key: 'appointments',  label: t('clientDashboard.myAppointments'), icon: '📅', badge: statistics.pendingRequests },
    { key: 'cases',         label: t('clientDashboard.myCases'),        icon: '📁' },
    { key: 'profile',       label: t('clientDashboard.myInformation'),  icon: '👤' },
  ];

  /* ── guard ── */
  if (!user) return <div className="loading-state"><div className="loading-spinner" /><p className="loading-text">{t('clientDashboard.loading')}</p></div>;

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="dashboard-container">

      {/* Mobile toggle */}
      <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
        <div className={`hamburger ${isMobileMenuOpen ? 'open' : ''}`}>
          <span /><span /><span />
        </div>
      </button>

      <div className="dashboard-layout">
        {/* overlay */}
        {isMobileMenuOpen && (
          <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* ── Sidebar ── */}
        <aside className={`dashboard-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          {/* brand */}
          <div className="sidebar-brand">
            <Logo />
          </div>

          <div className="sidebar-content">
            <nav className="sidebar-nav">
              <div className="sidebar-nav-section">NAVIGATION</div>
              {navItems.map(item => (
                <button key={item.key}
                  className={`nav-item ${currentView === item.key ? 'active' : ''}`}
                  onClick={() => navTo(item.key)}>
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.label}</span>
                  {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                </button>
              ))}
            </nav>

            <div className="sidebar-footer">
              <div className="sidebar-user">
                <div className="sidebar-avatar">
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" />
                    : <span>{(user.fullName || user.firstName || 'C').charAt(0).toUpperCase()}</span>}
                  <div className="sidebar-online-dot" />
                </div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{user.fullName || user.firstName || 'Client'}</div>
                  <div className="sidebar-user-role">Client</div>
                </div>
              </div>
              <button className="logout-btn" onClick={() => setShowLogout(true)} title="Déconnexion">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="btn-text">{t('clientDashboard.signOut')}</span>
              </button>
            </div>
          </div>
        </aside>

        <LogoutModal isOpen={showLogout} onClose={() => setShowLogout(false)} />

        {/* ── Main ── */}
        <main className="dashboard-main">
          {/* ── Topbar ── */}
          <div className="cd-topbar">
            <span className="cd-topbar-spacer" />
            <div className="cd-topbar-right">
              <div className="cd-notif-wrapper">
                <button className="cd-notif-btn" onClick={() => setNotifOpen(p => !p)} aria-label="Notifications">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {unreadCount > 0 && <span className="cd-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
                {notifOpen && <NotifDropdown notifications={notifications} unreadCount={unreadCount} onMarkAll={handleMarkAllRead} onMarkOne={handleMarkOneRead} />}
              </div>
            </div>
          </div>

          {currentView === 'overview'     && <OverviewView />}
          {currentView === 'appointments' && <AppointmentsView />}
          {currentView === 'cases'        && <div className="view-container"><CasesManager appointments={appointments} user={user} /></div>}
          {currentView === 'profile'      && <ProfileView />}
        </main>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onPaymentConfirm={handlePaymentConfirm}
        appointment={selectedAppointment}
      />

      {/* Booking / Reschedule Modal */}
      <BookingModal
        avocat={appointmentToReschedule?.avocatId || { _id: appointmentToReschedule?.avocatId }}
        open={bookingModalOpen}
        onClose={() => { setBookingModalOpen(false); setAppointmentToReschedule(null); }}
        mode="reschedule"
        existingAppointment={appointmentToReschedule}
        onRescheduled={(updated) => {
          const obj = updated._id ? updated : updated.rendezvous || updated;
          setAppointments(prev => {
            const next = sortByCreated(prev.map(a => a._id === obj._id ? obj : a));
            setStatistics(computeStats(next));
            return next;
          });
        }}
      />

      {/* Detail Modal */}
      <DetailModal />

      {/* Testimonial Modal */}
      {testimonialApt && (
        <TestimonialModal
          appointment={testimonialApt}
          daysLeft={getTestimonialStatus(testimonialApt)?.daysLeft || 1}
          onClose={() => setTestimonialApt(null)}
          onSubmitted={(rdvId, temoignage) => {
            setSubmittedRdvs(prev => [...prev, { rendezVousId: rdvId, statut: 'en_attente', reference: temoignage?.reference }]);
            setTestimonialApt(null);
          }}
        />
      )}
    </div>
  );
};

export default ClientDashboard;