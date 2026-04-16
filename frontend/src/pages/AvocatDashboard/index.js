import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import CasesManager from '../../components/CasesManager';
import BookingModal from '../../components/BookingModal';
import FileViewer from '../../components/FileViewer';
import { rendezVousAPI, authAPI, userAPI, notificationAPI } from '../../services/api';
import { validatePassword, PASSWORD_POLICY_MESSAGE } from '../../utils/password';
import { useTranslation } from 'react-i18next';
import Logo from '../../components/Logo';
import LogoutModal from '../../components/LogoutModal';
import ReseauPro from '../../components/ReseauPro';
import MessageriePro from '../../components/MessageriePro';
import './AvocatDashboard.css';
import LawyerCalendar from '../../components/LawyerCalendar';

const NOTIF_ICONS = {
  appointment_created:       '📅',
  appointment_cancelled:     '🗓️',
  new_client:                '👤',
  new_avocat:                '⚖️',
  payment_confirmed:         '💳',
  payment_pending:           '⏳',
  document_submitted:        '📄',
};

function NotifDropdown({ notifications, unreadCount, onMarkAll, onMarkOne }) {
  return (
    <div className="av-notif-dropdown">
      <div className="av-notif-header">
        <span>Notifications</span>
        {unreadCount > 0 && (
          <button className="av-notif-mark-all" onClick={onMarkAll}>Tout marquer lu</button>
        )}
      </div>
      <div className="av-notif-list">
        {notifications.length === 0 ? (
          <div className="av-notif-empty">Aucune notification</div>
        ) : notifications.map(n => (
          <div
            key={n._id}
            className={`av-notif-item${n.read ? '' : ' unread'}`}
            onClick={() => !n.read && onMarkOne(n._id)}
          >
            <span className="av-notif-icon">{NOTIF_ICONS[n.type] || '🔔'}</span>
            <div className="av-notif-body">
              <div className="av-notif-title">{n.title}</div>
              <div className="av-notif-msg">{n.message}</div>
              <div className="av-notif-time">
                {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {!n.read && <span className="av-notif-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Maps the raw Avocat document (from backend) to the profileData shape used in the UI */
function buildProfileFromUser(u) {
  if (!u) return { fullName: '', email: '', phone: '', specialization: '', experience: '', ville: '', adresseCabinet: '', bio: '', languages: [], avatarUrl: '' };
  return {
    fullName:       [u.firstName, u.lastName].filter(Boolean).join(' ') || u.fullName || '',
    email:          u.email || '',
    phone:          u.phone || '',
    specialization: Array.isArray(u.specialties) ? (u.specialties[0] || '') : (u.specialties || u.specialites || u.specialization || ''),
    experience:     u.anneExperience != null ? String(u.anneExperience) : (u.experience != null ? String(u.experience) : ''),
    ville:          u.officeLocation?.gouvernorat || u.ville || '',
    adresseCabinet: u.officeLocation?.address     || u.adresseCabinet || '',
    bio:            u.bio || u.biographie || '',
    languages:      u.spokenLanguages || u.languages || u.langues || [],
    avatarUrl:      u.photo?.enhanced || u.photo?.original || u.avatarUrl || '',
  };
}

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };
const SLOT_DAY_MAP = { Monday: 'monday', Tuesday: 'tuesday', Wednesday: 'wednesday', Thursday: 'thursday', Friday: 'friday', Saturday: 'saturday', Sunday: 'sunday' };

const DEFAULT_WORKING_HOURS = {
  monday:    { start: '09:00', end: '17:00', isOpen: true },
  tuesday:   { start: '09:00', end: '17:00', isOpen: true },
  wednesday: { start: '09:00', end: '17:00', isOpen: true },
  thursday:  { start: '09:00', end: '17:00', isOpen: true },
  friday:    { start: '09:00', end: '17:00', isOpen: true },
  saturday:  { start: '09:00', end: '13:00', isOpen: false },
  sunday:    { start: '09:00', end: '17:00', isOpen: false },
};

/** Converts backend availability.slots array → {monday: {start,end,isOpen}, ...} */
function slotsToWorkingHours(slots) {
  const result = JSON.parse(JSON.stringify(DEFAULT_WORKING_HOURS));
  // start from all-closed, then open what's in slots
  DAY_KEYS.forEach(k => { result[k].isOpen = false; });
  if (!Array.isArray(slots)) return result;
  slots.forEach(slot => {
    const key = SLOT_DAY_MAP[slot.day] || slot.day?.toLowerCase();
    if (!key || !result[key]) return;
    result[key].isOpen = true;
    if (slot.start) result[key].start = slot.start;
    if (slot.end)   result[key].end   = slot.end;
    // handle "HH:mm-HH:mm" format in slot.time
    if (slot.time && slot.time.includes('-')) {
      const [s, e] = slot.time.split('-').map(x => x.trim());
      if (s) result[key].start = s;
      if (e) result[key].end   = e;
    }
  });
  return result;
}

function getCreatedTime(obj) {
  if (!obj) return 0;
  const possible = obj.createdAt || obj.createDate || obj.created || obj.dateCreated || obj.created_at || obj.createdOn || obj.createdAt;
  const t = possible ? new Date(possible).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function sortAppointmentsByCreated(arr) {
  try { return [...(arr || [])].sort((a, b) => getCreatedTime(b) - getCreatedTime(a)); }
  catch (e) { return arr || []; }
}

function shouldAutoCancelAppointment(appointment) {
  if (!appointment || appointment.statut !== 'en_attente') return false;
  try {
    const appointmentDate = new Date(appointment.date);
    if (!appointment.heure) { appointmentDate.setHours(23, 59, 59, 999); }
    else {
      const [hours, minutes] = appointment.heure.split(':').map(Number);
      appointmentDate.setHours(hours, minutes || 0, 0, 0);
    }
    return appointmentDate < new Date();
  } catch (error) { return false; }
}

function processAppointmentsWithAutoCancel(appointments, t) {
  return appointments.map(appointment => {
    if (shouldAutoCancelAppointment(appointment)) {
      return { ...appointment, statut: 'annulé', autoCanceled: true, cancelReason: t('avocatDashboard.autoCancelReason') };
    }
    return appointment;
  });
}

const AvocatDashboard = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  const [currentView, setCurrentView]         = useState('appointments');
  const [messagerieAvocatId,   setMessagerieAvocatId]   = useState(null);
  const [messagerieAvocatInfo, setMessagerieAvocatInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [statistics, setStatistics] = useState({
    totalAppointments: 0, pendingRequests: 0, paidAppointments: 0,
    confirmedAppointments: 0, rejectedAppointments: 0, canceledAppointments: 0, todayAppointments: 0
  });
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [appointmentDetailsModalOpen, setAppointmentDetailsModalOpen] = useState(false);
  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileData, setProfileData] = useState(() => buildProfileFromUser(null));
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [workingHours, setWorkingHours] = useState(DEFAULT_WORKING_HOURS);
  const [isEditingWorkingHours, setIsEditingWorkingHours] = useState(false);
  const [workingHoursLoading, setWorkingHoursLoading] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const isVerified =
    user?.status === 'approved' ||
    user?.status === 'active' ||
    user?.verified === true ||
    user?.isVerified === true ||
    user?.role === 'admin' ||
    false;
  // Sync profileData + workingHours whenever user changes (initial load + after API refresh)
  useEffect(() => {
    if (isEditingProfile) return;
    setProfileData(buildProfileFromUser(user));
    if (user?.availability?.slots) setWorkingHours(slotsToWorkingHours(user.availability.slots));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isEditingProfile]);

  useEffect(() => {
    if (!user) return;
    const refreshUserStatus = async () => {
      try {
        const updatedUser = await userAPI.refreshUserData();
        if (updatedUser) updateUser(updatedUser);
      } catch (error) { console.error('Error refreshing user status:', error); }
    };
    refreshUserStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    if (!user || !isVerified) return;

    const interval = setInterval(async () => {
      try {
        const updatedUser = await userAPI.refreshUserData();
        if (updatedUser && updatedUser.verified !== user?.verified) {
          updateUser(updatedUser);
          clearInterval(interval);
        }
      } catch (error) {
        // silencieux
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.verified, isVerified]);

  // ── Notifications ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isVerified) return;
    const load = () => {
      notificationAPI.getAll()
        .then(data => { setNotifications(data.notifications || []); setUnreadCount(data.unreadCount || 0); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [isVerified]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e) => { if (!e.target.closest('.av-notif-wrapper')) setNotifOpen(false); };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const handleMarkOneRead = async (id) => {
    try {
      await notificationAPI.markOneRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const handleLogout = () => setShowLogout(true);
  const handleProfileInputChange = (e) => { const { name, value } = e.target; setProfileData(prev => ({ ...prev, [name]: value })); };

  const startEditingProfile = async () => {
    setIsEditingProfile(true);
    try {
      const res = await authAPI.getAvocatProfile();
      const fresh = res.data?.user || res.data;
      if (fresh) {
        updateUser({ ...user, ...fresh, userType: user.userType });
        setProfileData(buildProfileFromUser(fresh));
        if (fresh.availability?.slots) setWorkingHours(slotsToWorkingHours(fresh.availability.slots));
      } else {
        setProfileData(buildProfileFromUser(user));
      }
    } catch {
      setProfileData(buildProfileFromUser(user));
    }
  };

  const cancelEditingProfile = () => {
    setProfileData(buildProfileFromUser(user));
    setIsEditingProfile(false);
  };

  const handlePasswordInputChange = (e) => { const { name, value } = e.target; setPasswordData(prev => ({ ...prev, [name]: value })); };

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setProfileLoading(true);
    try {
      let avatarUrl = profileData.avatarUrl || '';
      if (avatarFile) { const u = await uploadAvatar(); if (u) avatarUrl = u; }
      const mappedData = {
        ...(profileData.phone ? { phone: profileData.phone } : {}),
        specialties: profileData.specialization
          ? profileData.specialization.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        anneExperience: profileData.experience ? Number(profileData.experience) : null,
        bio: profileData.bio || '',
        spokenLanguages: Array.isArray(profileData.languages)
          ? profileData.languages
          : (profileData.languages ? [profileData.languages] : []),
        'officeLocation.gouvernorat': profileData.ville || '',
        'officeLocation.address': profileData.adresseCabinet || '',
        ...(avatarUrl ? { 'photo.enhanced': avatarUrl } : {}),
      };
      const response = await authAPI.updateAvocatProfile(mappedData);
      if (response && response.data) {
        updateUser({ ...response.data.user, userType: user.userType }); setIsEditingProfile(false);
        setAvatarFile(null); setAvatarPreview(null);
        alert(t('avocatDashboard.profileUpdated'));
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || t('avocatDashboard.errorUpdatingProfile');
      alert(`${t('common.errorPrefix')} ${errorMessage}`);
    } finally { setProfileLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) { alert(t('avocatDashboard.passwordMismatch')); return; }
    if (!validatePassword(passwordData.newPassword)) { alert(PASSWORD_POLICY_MESSAGE); return; }
    setPasswordLoading(true);
    try {
      const response = await authAPI.changePassword({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword });
      if (response.status === 200) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setIsChangingPassword(false); alert(t('avocatDashboard.passwordChanged'));
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || error.message || t('avocatDashboard.errorChangingPassword');
      alert(`${t('common.errorPrefix')} ${msg}`);
    } finally { setPasswordLoading(false); }
  };

  const handleWorkingHoursChange = (day, field, value) => {
    setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const handleSaveWorkingHours = async () => {
    setWorkingHoursLoading(true);
    try {
      const response = await authAPI.updateLawyerWorkingHours(user.id || user._id, workingHours);
      if (response.status === 200 || response.data) {
        setIsEditingWorkingHours(false); alert(t('avocatDashboard.workingHoursSaved'));
        try {
          const updatedResponse = await authAPI.getLawyerWorkingHours(user.id || user._id);
          if (updatedResponse.data && updatedResponse.data.workingHours) setWorkingHours(slotsToWorkingHours(updatedResponse.data.workingHours));
        } catch (reloadError) { console.warn('Could not reload working hours:', reloadError); }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || t('avocatDashboard.errorSavingWorkingHours');
      alert(`${t('common.errorPrefix')} ${errorMessage}`);
    } finally { setWorkingHoursLoading(false); }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { alert(t('avocatDashboard.avatarTooLarge')); return; }
      if (!file.type.startsWith('image/')) { alert(t('avocatDashboard.avatarInvalidType')); return; }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return null;
    setAvatarUploading(true);
    const formData = new FormData(); formData.append('avatar', avatarFile);
    try { const response = await authAPI.uploadAvatar(formData); return response.data.avatarUrl; }
    catch (error) { alert(t('avocatDashboard.avatarUploadError')); return null; }
    finally { setAvatarUploading(false); }
  };

  useEffect(() => {
    if (user && isVerified) {
      setLoading(true);
      const today = new Date().toDateString();
      rendezVousAPI.getLawyerRendezVous(user.id || user._id)
        .then(response => {
          const appointmentData = response.data || response || [];
          const processedAppointments = processAppointmentsWithAutoCancel(appointmentData, t);
          const sorted = sortAppointmentsByCreated(processedAppointments);
          setAppointments(sorted);
          const todayCount = sorted.filter(a => new Date(a.date).toDateString() === today && a.statut === 'confirmé').length;
          setStatistics({
            totalAppointments: processedAppointments.length,
            pendingRequests: processedAppointments.filter(a => a.statut === 'en_attente').length,
            paidAppointments: processedAppointments.filter(a => a.statut === 'payé').length,
            confirmedAppointments: processedAppointments.filter(a => a.statut === 'confirmé').length,
            rejectedAppointments: processedAppointments.filter(a => a.statut === 'refusé').length,
            canceledAppointments: processedAppointments.filter(a => a.statut === 'annulé').length,
            todayAppointments: todayCount
          });
        })
        .catch(err => console.error('Error loading appointments:', err))
        .finally(() => setLoading(false));
    }
  }, [user, isVerified, t]);


  useEffect(() => {
    const loadCities = () => {
      setLoadingCities(true);
      setTimeout(() => {
        const tunisianCities = ['Tunis', 'Sfax', 'Sousse', 'Gabes', 'Bizerte', 'Ariana', 'Gafsa', 'Monastir', 'Kairouan', 'Kasserine', 'Mahdia', 'Nabeul', 'Tataouine', 'Kebili', 'Siliana', 'Kef', 'Jendouba', 'Zaghouan', 'Beja', 'Manouba', 'Medenine', 'Tozeur', 'Sidi Bouzid', 'Ben Arous'];
        setCities(tunisianCities.sort()); setLoadingCities(false);
      }, 300);
    };
    loadCities();
  }, []);

  useEffect(() => {
    const loadWorkingHours = async () => {
      if (user && (user.id || user._id)) {
        try {
          const response = await authAPI.getLawyerWorkingHours(user.id || user._id);
          if (response.data && response.data.workingHours) setWorkingHours(slotsToWorkingHours(response.data.workingHours));
        } catch (error) { console.error('Error loading working hours:', error); }
      }
    };
    loadWorkingHours();
  }, [user]);

  const handleApproveAppointment = async (appointmentId) => {
    try {
      await rendezVousAPI.approveRendezVous(appointmentId);
      setAppointments(prev => sortAppointmentsByCreated(prev.map(apt => apt._id === appointmentId ? { ...apt, statut: 'confirmé' } : apt)));
      const currentAppointment = appointments.find(apt => apt._id === appointmentId);
      setStatistics(prev => {
        const newStats = { ...prev, confirmedAppointments: prev.confirmedAppointments + 1 };
        if (currentAppointment?.statut === 'en_attente') newStats.pendingRequests = prev.pendingRequests - 1;
        else if (currentAppointment?.statut === 'payé') newStats.paidAppointments = prev.paidAppointments - 1;
        return newStats;
      });
    } catch (error) { alert(t('avocatDashboard.errorApproving')); }
  };

  const computeStatisticsFrom = (arr) => {
    const appointmentData = arr || [];
    const today = new Date().toDateString();
    return {
      totalAppointments: appointmentData.length,
      pendingRequests: appointmentData.filter(a => a.statut === 'en_attente').length,
      paidAppointments: appointmentData.filter(a => a.statut === 'payé').length,
      confirmedAppointments: appointmentData.filter(a => a.statut === 'confirmé').length,
      rejectedAppointments: appointmentData.filter(a => a.statut === 'refusé').length,
      canceledAppointments: appointmentData.filter(a => a.statut === 'annulé').length,
      todayAppointments: appointmentData.filter(a => new Date(a.date).toDateString() === today && a.statut === 'confirmé').length
    };
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm(t('avocatDashboard.confirmCancel'))) return;
    let previous = null;
    setAppointments(prev => {
      previous = prev;
      const next = prev.map(a => a._id === appointmentId ? { ...a, statut: 'annulé' } : a);
      const sorted = sortAppointmentsByCreated(next);
      setStatistics(computeStatisticsFrom(sorted));
      return sorted;
    });
    try { await rendezVousAPI.updateRendezVous(appointmentId, { statut: 'annulé' }); }
    catch (err) {
      alert(t('avocatDashboard.cancelError'));
      if (previous) { setAppointments(sortAppointmentsByCreated(previous)); setStatistics(computeStatisticsFrom(previous)); }
    }
  };

  const handleRescheduleAppointment = (appointmentId) => {
    const apt = appointments.find(a => a._id === appointmentId);
    if (!apt) return alert(t('avocatDashboard.appointmentNotFound'));
    setAppointmentToReschedule(apt); setBookingModalOpen(true);
  };

  const handleRejectAppointment = async (appointmentId) => {
    try {
      await rendezVousAPI.rejectRendezVous(appointmentId);
      setAppointments(prev => sortAppointmentsByCreated(prev.map(apt => apt._id === appointmentId ? { ...apt, statut: 'refusé' } : apt)));
      const currentAppointment = appointments.find(apt => apt._id === appointmentId);
      setStatistics(prev => {
        const newStats = { ...prev };
        if (currentAppointment?.statut === 'en_attente') newStats.pendingRequests = prev.pendingRequests - 1;
        else if (currentAppointment?.statut === 'payé') newStats.paidAppointments = prev.paidAppointments - 1;
        return newStats;
      });
    } catch (error) { alert(t('avocatDashboard.errorRejecting')); }
  };

  const handleMarkAsPaid = async (appointmentId) => {
    try {
      await rendezVousAPI.markAsPaid(appointmentId, {
        paymentStatus: 'paid_in_person', paymentMethod: 'in_person',
        paymentConfirmedBy: user._id, paymentConfirmedAt: new Date()
      });
      setAppointments(prev => prev.map(apt => apt._id === appointmentId ? { ...apt, paymentStatus: 'paid_in_person', paymentMethod: 'in_person', paymentConfirmedAt: new Date() } : apt));
      alert(t('avocatDashboard.paymentConfirmed'));
    } catch (error) { alert(t('avocatDashboard.paymentError')); }
  };

  const handleOpenAppointmentDetails = (appointment) => { setSelectedAppointmentDetails(appointment); setAppointmentDetailsModalOpen(true); };

  /* ── STATUS CONFIG ── */
  const STATUS_CONFIG = {
    'confirmé': { label: t('avocatDashboard.statusConfirmed'), color: '#22c55e', bg: 'rgba(34,197,94,0.13)', dot: '●' },
    'en_attente': { label: t('avocatDashboard.statusWaiting'), color: '#f59e0b', bg: 'rgba(245,158,11,0.13)', dot: '○' },
    'payé': { label: t('avocatDashboard.statusPaid'), color: '#b8912a', bg: 'rgba(184,145,42,0.13)', dot: '●' },
    'refusé': { label: t('avocatDashboard.statusRejected'), color: '#ef4444', bg: 'rgba(239,68,68,0.13)', dot: '○' },
    'annulé': { label: t('avocatDashboard.statusCanceled') || 'Annulé', color: '#6b7280', bg: 'rgba(107,114,128,0.13)', dot: '○' },
  };

  /* ── APPOINTMENT CARD ── */
  const renderAppointmentCard = (appointment) => {
    const sc = STATUS_CONFIG[appointment.statut] || { label: appointment.statut, color: '#6b7280', bg: 'rgba(107,114,128,0.13)', dot: '○' };
    const date = new Date(appointment.date);
    const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });

    return (
      <div key={appointment._id} className="av-card" onClick={() => handleOpenAppointmentDetails(appointment)}>
        <div className="av-card-accent" style={{ background: sc.color }} />
        <div className="av-card-body">
          <div className="av-card-top">
            <div className="av-card-avatar">
              {(appointment.clientId?.avatarUrl)
                ? <img src={appointment.clientId.avatarUrl} alt="" />
                : <span>{(appointment.clientId?.fullName || appointment.clientId?.nom || 'C').charAt(0).toUpperCase()}</span>}
            </div>
            <div className="av-card-info">
              <div className="av-card-name">
                {appointment.clientId?.fullName || appointment.clientId?.nom || appointment.clientInfo?.nom || appointment.clientNom || t('avocatDashboard.client')}
              </div>
              <div className="av-card-email">
                {appointment.clientId?.email || appointment.clientInfo?.email || appointment.clientEmail || t('avocatDashboard.noEmail')}
              </div>
            </div>
            <div className="av-card-date">
              <span className="av-date-num">{dateStr}</span>
              <span className="av-date-day">{dayName}</span>
              <span className="av-date-time">{appointment.heure}</span>
            </div>
          </div>

          <div className="av-card-footer">
            <span className="av-status-badge" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.color}33` }}>
              {sc.dot} {sc.label}
            </span>
            <div className="av-card-actions" onClick={e => e.stopPropagation()}>
              {appointment.statut === 'en_attente' && <>
                <button className="av-btn av-btn-approve" onClick={() => handleApproveAppointment(appointment._id)}>✓ {t('avocatDashboard.approve')}</button>
                <button className="av-btn av-btn-reject" onClick={() => handleRejectAppointment(appointment._id)}>✕ {t('avocatDashboard.reject')}</button>
              </>}
              {appointment.statut === 'payé' && <>
                <button className="av-btn av-btn-approve" onClick={() => handleApproveAppointment(appointment._id)}>✓ {t('avocatDashboard.confirmAppointment')}</button>
                <button className="av-btn av-btn-reject" onClick={() => handleRejectAppointment(appointment._id)}>✕ {t('avocatDashboard.reject')}</button>
              </>}
              {appointment.statut === 'confirmé' && !['paid_in_person', 'paid_online'].includes(appointment.paymentStatus) &&
                <button className="av-btn av-btn-gold" onClick={() => handleMarkAsPaid(appointment._id)}>💳 {t('avocatDashboard.markAsPaid')}</button>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── APPOINTMENTS VIEW ── */
  const renderAppointmentsView = () => {
    if (loading) return (
      <div className="av-state"><div className="av-spinner" /><p style={{ color: 'var(--av-text2)' }}>{t('avocatDashboard.loadingData')}</p></div>
    );

    const now = new Date();
    const todayStr = now.toDateString();
    const pending   = appointments.filter(a => a.statut === 'en_attente');
    const paid      = appointments.filter(a => a.statut === 'payé');
    const confirmed = appointments.filter(a => a.statut === 'confirmé');
    const rejected  = appointments.filter(a => a.statut === 'refusé');
    const todayApts = appointments.filter(a => new Date(a.date).toDateString() === todayStr);
    const upcoming  = confirmed
      .filter(a => new Date(a.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);

    const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const firstName = (user?.fullName || user?.firstName || 'Maître').split(' ')[0];

    const kpis = [
      { label: 'TOTAL RDV',    value: statistics.totalAppointments,    color: '#b8912a', icon: '📋' },
      { label: 'EN ATTENTE',   value: statistics.pendingRequests,       color: '#f59e0b', icon: '⏳' },
      { label: 'CONFIRMÉS',    value: statistics.confirmedAppointments, color: '#22c55e', icon: '✅' },
      { label: "AUJOURD'HUI",  value: statistics.todayAppointments,     color: '#60a5fa', icon: '📅' },
    ];

    // Mini appointment row for sidebar
    const MiniRow = ({ apt }) => {
      const sc = STATUS_CONFIG[apt.statut] || { label: apt.statut, color: '#6b7280' };
      const d  = new Date(apt.date);
      const clientName = apt.clientId?.fullName || apt.clientId?.nom || 'Client';
      return (
        <div className="av-home-mini-row" onClick={() => handleOpenAppointmentDetails(apt)}>
          <div className="av-home-mini-avatar">
            {apt.clientId?.avatarUrl
              ? <img src={apt.clientId.avatarUrl} alt="" />
              : <span>{clientName.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="av-home-mini-info">
            <div className="av-home-mini-name">{clientName}</div>
            <div className="av-home-mini-date">
              {d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' })} · {apt.heure || '–'}
            </div>
          </div>
          <span className="av-home-mini-badge" style={{ color: sc.color, borderColor: sc.color + '44', background: sc.color + '12' }}>
            {sc.label}
          </span>
        </div>
      );
    };

    const filteredAppointments = filterStatus === 'all' ? appointments
      : filterStatus === 'today' ? appointments.filter(a => new Date(a.date).toDateString() === todayStr)
      : appointments.filter(a => a.statut === filterStatus);

    return (
      <div className="av-home-page">

        {/* ── Bannière de bienvenue ── */}
        <div className="av-home-banner">
          <div className="av-home-banner-left">
            <div className="av-home-greeting">Bonjour, Mᵉ {firstName} 👋</div>
            <div className="av-home-date">{dateLabel}</div>
            {pending.length > 0 && (
              <div className="av-home-alert">
                <span className="av-home-alert-dot" />
                {pending.length} demande{pending.length > 1 ? 's' : ''} en attente de traitement
              </div>
            )}
          </div>
          <div className="av-home-banner-right">
            <div className="av-home-today-count">{statistics.todayAppointments}</div>
            <div className="av-home-today-label">RDV aujourd'hui</div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="av-home-kpi-grid">
          {kpis.map((k, i) => (
            <div key={i} className="av-home-kpi-card" style={{ '--kpi-color': k.color }}
              onClick={() => setFilterStatus(k.label === "AUJOURD'HUI" ? 'today' : k.label === 'EN ATTENTE' ? 'en_attente' : k.label === 'CONFIRMÉS' ? 'confirmé' : 'all')}>
              <div className="av-home-kpi-icon">{k.icon}</div>
              <div className="av-home-kpi-value">{k.value}</div>
              <div className="av-home-kpi-label">{k.label}</div>
              <div className="av-home-kpi-bar"><div className="av-home-kpi-bar-fill" /></div>
            </div>
          ))}
        </div>

        {/* ── Layout principal ── */}
        <div className="av-home-main">

          {/* Gauche : liste principale */}
          <div className="av-home-feed">
            {/* Tabs filtre */}
            <div className="av-home-tabs">
              {[
                { key: 'all',       label: 'Tous',        count: appointments.length },
                { key: 'en_attente',label: 'En attente',  count: pending.length },
                { key: 'confirmé',  label: 'Confirmés',   count: confirmed.length },
                { key: 'payé',      label: 'Payés',       count: paid.length },
                { key: 'refusé',    label: 'Refusés',     count: rejected.length },
              ].map(tab => (
                <button key={tab.key}
                  className={`av-home-tab ${filterStatus === tab.key ? 'active' : ''}`}
                  onClick={() => setFilterStatus(tab.key)}>
                  {tab.label}
                  {tab.count > 0 && <span className="av-home-tab-count">{tab.count}</span>}
                </button>
              ))}
            </div>

            <div className="av-panel" style={{ marginTop: 0 }}>
              {filteredAppointments.length > 0
                ? <div className="av-cards-grid">{filteredAppointments.map(renderAppointmentCard)}</div>
                : <div className="av-state"><div className="av-empty-icon">📭</div><h3 style={{ color: 'var(--av-text2)' }}>{t('avocatDashboard.noAppointments')}</h3></div>
              }
            </div>
          </div>

          {/* Droite : sidebar */}
          <div className="av-home-sidebar">

            {/* Aujourd'hui */}
            <div className="av-home-side-card">
              <div className="av-home-side-title">📅 Aujourd'hui</div>
              {todayApts.length === 0
                ? <p className="av-home-side-empty">Aucun RDV aujourd'hui</p>
                : todayApts.map(apt => <MiniRow key={apt._id} apt={apt} />)
              }
            </div>

            {/* Prochains RDV */}
            <div className="av-home-side-card">
              <div className="av-home-side-title">🗓 Prochains RDV</div>
              {upcoming.length === 0
                ? <p className="av-home-side-empty">Aucun RDV à venir</p>
                : upcoming.map(apt => <MiniRow key={apt._id} apt={apt} />)
              }
            </div>

            {/* Demandes urgentes */}
            {pending.length > 0 && (
              <div className="av-home-side-card av-home-side-urgent">
                <div className="av-home-side-title">⚠️ À traiter</div>
                {pending.slice(0, 3).map(apt => <MiniRow key={apt._id} apt={apt} />)}
                {pending.length > 3 && (
                  <button className="av-home-see-more" onClick={() => setFilterStatus('en_attente')}>
                    Voir les {pending.length - 3} autres →
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  /* ── PROFILE VIEW ── */
  const renderProfileView = () => (
    <div>
      {/* Hero */}
      <div className="av-profile-hero">
        <div className="av-hero-avatar">
          {profileData.avatarUrl
            ? <img src={profileData.avatarUrl} alt="" />
            : <span>{profileData.fullName?.charAt(0)?.toUpperCase() || 'A'}</span>}
        </div>
        <div className="av-hero-info">
          <div className="av-hero-name">{profileData.fullName || 'Avocat'}</div>
          <div className="av-hero-spec">{profileData.specialization || t('avocatDashboard.notProvided')}</div>
          <div className="av-hero-meta">
            {profileData.experience && <span>🎓 {profileData.experience} {t('avocatDashboard.yearsOfExperience')}</span>}
            {profileData.ville && <span>📍 {profileData.ville}</span>}
            {user.barNumber && <span>⚖️ {user.barNumber}</span>}
          </div>
        </div>
        {!isEditingProfile && (
          <button className="av-edit-btn" onClick={startEditingProfile}>✏️ {t('avocatDashboard.edit')}</button>
        )}
      </div>

      {/* Personal Info Section */}
      <div className="av-form-section">
        <div className="av-form-section-header">
          <span className="av-form-section-icon">👤</span>
          <span className="av-form-section-title">{t('avocatDashboard.personalInformation')}</span>
        </div>
        <div className="av-form-section-body">
          {isEditingProfile ? (
            <form onSubmit={handleUpdateProfile}>
              {/* Avatar */}
              <div className="av-avatar-upload">
                <div className="av-avatar-preview">
                  {avatarPreview ? <img src={avatarPreview} alt="" />
                    : profileData.avatarUrl ? <img src={profileData.avatarUrl} alt="" />
                      : <span>{profileData.fullName?.charAt(0)?.toUpperCase() || 'A'}</span>}
                </div>
                <div>
                  <input type="file" accept="image/*" onChange={handleAvatarChange} id="av-avatar-input" style={{ display: 'none' }} />
                  <label htmlFor="av-avatar-input" className="av-btn av-btn-gold" style={{ cursor: 'pointer' }}>
                    📷 {avatarUploading ? t('avocatDashboard.saving') : t('avocatDashboard.changePhoto')}
                  </label>
                  <p style={{ fontSize: 12, color: 'var(--av-text2)', marginTop: 6 }}>{t('avocatDashboard.avatarHelpText')}</p>
                </div>
              </div>

              <div className="av-form-grid">
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.fullName')}</label>
                  <input className="av-input av-input-disabled" value={profileData.fullName} readOnly disabled />
                  <span className="av-hint">{t('avocatDashboard.nameCannotBeChanged')}</span>
                </div>
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.email')}</label>
                  <input className="av-input" type="email" name="email" value={profileData.email} onChange={handleProfileInputChange} />
                </div>
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.phone')}</label>
                  <input className="av-input" type="tel" name="phone" value={profileData.phone} onChange={handleProfileInputChange} />
                </div>
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.specialization')}</label>
                  <select className="av-input" name="specialization" value={profileData.specialization} onChange={handleProfileInputChange}>
                    <option value="">{t('avocatDashboard.selectSpeciality')}</option>
                    <option value="Droit civil">Droit civil</option>
                    <option value="Droit pénal">Droit pénal</option>
                    <option value="Droit des sociétés">Droit des sociétés</option>
                    <option value="Droit de la famille">Droit de la famille</option>
                    <option value="Propriété intellectuelle">Propriété intellectuelle</option>
                    <option value="Droit du travail">Droit du travail</option>
                    <option value="Droit fiscal">Droit fiscal</option>
                    <option value="Droit immobilier">Droit immobilier</option>
                    <option value="Droit administratif">Droit administratif</option>
                    <option value="Droit international">Droit international</option>
                  </select>
                </div>
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.yearsOfExperience')}</label>
                  <input className="av-input" type="number" name="experience" value={profileData.experience} onChange={handleProfileInputChange} min="0" max="50" />
                </div>
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.ville')}</label>
                  <select className="av-input" name="ville" value={profileData.ville} onChange={handleProfileInputChange} disabled={loadingCities}>
                    <option value="">{loadingCities ? t('avocatDashboard.loadingCities') : t('avocatDashboard.selectCity')}</option>
                    {cities.map(c => <option key={c} value={c}>{t(`avocatDashboard.cities.${c}`, c)}</option>)}
                  </select>
                </div>
                <div className="av-field av-field-full">
                  <label className="av-label">{t('avocatDashboard.adresseCabinet')}</label>
                  <input className="av-input" type="text" name="adresseCabinet" value={profileData.adresseCabinet} onChange={handleProfileInputChange} />
                </div>
                <div className="av-field av-field-full">
                  <label className="av-label">{t('avocatDashboard.biography')}</label>
                  <textarea className="av-input av-textarea" name="bio" rows={4} value={profileData.bio} onChange={handleProfileInputChange} />
                </div>
              </div>

              <div className="av-form-actions">
                <button type="button" className="av-btn av-btn-cancel" onClick={cancelEditingProfile}>✕ {t('avocatDashboard.cancel')}</button>
                <button type="submit" className="av-btn av-btn-gold" disabled={profileLoading}>
                  {profileLoading ? `⏳ ${t('avocatDashboard.saving')}` : `💾 ${t('avocatDashboard.save')}`}
                </button>
              </div>
            </form>
          ) : (
            <div className="av-info-grid">
              {[
                { label: t('avocatDashboard.fullName'),         value: profileData.fullName },
                { label: t('avocatDashboard.email'),            value: profileData.email },
                { label: t('avocatDashboard.phone'),            value: profileData.phone },
                { label: t('avocatDashboard.specialization'),   value: Array.isArray(user.specialties) ? user.specialties.join(', ') : profileData.specialization },
                { label: t('avocatDashboard.yearsOfExperience'), value: profileData.experience ? `${profileData.experience} ans` : null },
                { label: t('avocatDashboard.barNumber'),        value: user.barNumber },
                { label: t('avocatDashboard.ville'),            value: profileData.ville },
                { label: t('avocatDashboard.adresseCabinet'),   value: profileData.adresseCabinet },
                { label: t('avocatDashboard.biography'),        full: true, value: profileData.bio },
              ].map((f, i) => f.value ? (
                <div key={i} className={`av-info-card ${f.full ? 'av-info-full' : ''}`}>
                  <div className="av-info-label">{f.label}</div>
                  <div className="av-info-value">{f.value}</div>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="av-form-section">
        <div className="av-form-section-header">
          <span className="av-form-section-icon">🔒</span>
          <span className="av-form-section-title">{t('avocatDashboard.security')}</span>
          {!isChangingPassword && (
            <button className="av-btn av-btn-outline" style={{ marginLeft: 'auto' }} onClick={() => setIsChangingPassword(true)}>
              🔑 {t('avocatDashboard.changePassword')}
            </button>
          )}
        </div>
        {isChangingPassword && (
          <div className="av-form-section-body">
            <form onSubmit={handleChangePassword}>
              <div className="av-form-grid">
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.currentPassword')}</label>
                  <input className="av-input" type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordInputChange} required />
                </div>
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.newPassword')}</label>
                  <input className="av-input" type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordInputChange} required minLength="8" />
                </div>
                <div className="av-field">
                  <label className="av-label">{t('avocatDashboard.confirmNewPassword')}</label>
                  <input className="av-input" type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordInputChange} required minLength="8" />
                </div>
              </div>
              <div className="av-form-actions">
                <button type="button" className="av-btn av-btn-cancel" onClick={() => setIsChangingPassword(false)}>✕ {t('avocatDashboard.cancel')}</button>
                <button type="submit" className="av-btn av-btn-gold" disabled={passwordLoading}>
                  {passwordLoading ? `⏳ ${t('avocatDashboard.changing')}` : `🔒 ${t('avocatDashboard.changePasswordBtn')}`}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Working Hours Section */}
      <div className="av-form-section">
        <div className="av-form-section-header">
          <span className="av-form-section-icon">🕒</span>
          <span className="av-form-section-title">{t('avocatDashboard.workingHours')}</span>
          {!isEditingWorkingHours && (
            <button className="av-btn av-btn-outline" style={{ marginLeft: 'auto' }} onClick={() => setIsEditingWorkingHours(true)}>
              ✏️ {t('avocatDashboard.edit')}
            </button>
          )}
        </div>
        <div className="av-form-section-body">
          {isEditingWorkingHours ? (
            <div>
              {Object.entries(workingHours).map(([day, hours]) => (
                <div key={day} className="av-wh-row">
                  <label className="av-wh-day">
                    <input type="checkbox" checked={hours.isOpen} onChange={e => handleWorkingHoursChange(day, 'isOpen', e.target.checked)} style={{ marginRight: 8 }} />
                    {DAY_LABELS[day] || day}
                  </label>
                  {hours.isOpen && (
                    <div className="av-wh-times">
                      <input type="time" value={hours.start} onChange={e => handleWorkingHoursChange(day, 'start', e.target.value)} className="av-input av-time-input" />
                      <span style={{ color: 'var(--av-text2)' }}>→</span>
                      <input type="time" value={hours.end} onChange={e => handleWorkingHoursChange(day, 'end', e.target.value)} className="av-input av-time-input" />
                    </div>
                  )}
                </div>
              ))}
              <div className="av-form-actions">
                <button type="button" className="av-btn av-btn-cancel" onClick={() => setIsEditingWorkingHours(false)}>✕ {t('avocatDashboard.cancel')}</button>
                <button type="button" className="av-btn av-btn-gold" onClick={handleSaveWorkingHours} disabled={workingHoursLoading}>
                  {workingHoursLoading ? `⏳ ${t('avocatDashboard.saving')}` : `💾 ${t('avocatDashboard.save')}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="av-wh-display">
              {Object.entries(workingHours).filter(([, h]) => h.isOpen).length === 0 ? (
                <div style={{ color: 'var(--av-text2)', fontSize: 13, padding: '8px 0' }}>Aucune disponibilité renseignée</div>
              ) : (
                Object.entries(workingHours).map(([day, hours]) => (
                  <div key={day} className="av-wh-item">
                    <span className="av-wh-item-day">{DAY_LABELS[day] || day}</span>
                    {hours.isOpen
                      ? <span className="av-wh-item-time">{hours.start} – {hours.end}</span>
                      : <span className="av-wh-item-closed">{t('avocatDashboard.closed')}</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCalendarView = () => {
    const now = new Date();

    const STATUS_COLORS = {
      confirmé:   { color: '#22c55e', bg: 'rgba(34,197,94,0.13)'   },
      en_attente: { color: '#f59e0b', bg: 'rgba(245,158,11,0.13)'  },
      payé:       { color: '#b8912a', bg: 'rgba(184,145,42,0.14)'  },
      refusé:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)'   },
      annulé:     { color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' },
    };
    const MONTHS_FR3 = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const DAYS_FR3   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const aptName    = a => a?.clientId?.fullName || a?.clientId?.nom || a?.clientNom || 'Client';

    const todayApts = appointments.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth()    === now.getMonth()    &&
             d.getDate()     === now.getDate();
    }).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));

    const upcoming = [...appointments]
      .filter(a => {
        if (!a.date) return false;
        const d = new Date(a.date);
        const isToday =
          d.getFullYear() === now.getFullYear() &&
          d.getMonth()    === now.getMonth()    &&
          d.getDate()     === now.getDate();
        return d > now && !isToday && a.statut !== 'annulé' && a.statut !== 'refusé';
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 7);

    const totalPending  = appointments.filter(a => a.statut === 'en_attente').length;
    const totalConfirmed = appointments.filter(a => a.statut === 'confirmé').length;

    return (
      <div className="av-calendar-page">
        <div className="av-cal-layout">

          {/* ── Main calendar ── */}
          <div className="av-calendar-wrap">
            <LawyerCalendar
              appointments={appointments}
              workingHours={
                Array.isArray(workingHours)
                  ? workingHours
                  : Object.values(workingHours || {}).flat()
              }
              user={user}
            />
          </div>

          {/* ── Sidebar ── */}
          <aside className="av-cal-sidebar">

            {/* Today card */}
            <div className="av-cal-side-card">
              <div className="av-cal-side-head">
                <span className="av-cal-side-icon">☀</span>
                <span className="av-cal-side-title">Aujourd'hui</span>
                <span className="av-cal-side-count">{todayApts.length}</span>
              </div>
              <div className="av-cal-today-date">
                {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {todayApts.length === 0
                ? <p className="av-cal-empty">Aucun rendez-vous aujourd'hui</p>
                : <div className="av-cal-apt-list">
                    {todayApts.map((a, i) => {
                      const sc = STATUS_COLORS[a.statut] || STATUS_COLORS.annulé;
                      return (
                        <div key={i} className="av-cal-apt-row" style={{ borderLeftColor: sc.color }}>
                          <span className="av-cal-apt-time">{a.heure || '–'}</span>
                          <div className="av-cal-apt-info">
                            <span className="av-cal-apt-name">{aptName(a)}</span>
                            <span className="av-cal-apt-status" style={{ color: sc.color, background: sc.bg }}>
                              {a.statut}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

            {/* Quick stats */}
            <div className="av-cal-side-stats">
              <div className="av-cal-mini-stat">
                <span className="av-cal-mini-num" style={{ color: '#f59e0b' }}>{totalPending}</span>
                <span className="av-cal-mini-lbl">En attente</span>
              </div>
              <div className="av-cal-mini-sep" />
              <div className="av-cal-mini-stat">
                <span className="av-cal-mini-num" style={{ color: '#22c55e' }}>{totalConfirmed}</span>
                <span className="av-cal-mini-lbl">Confirmés</span>
              </div>
              <div className="av-cal-mini-sep" />
              <div className="av-cal-mini-stat">
                <span className="av-cal-mini-num" style={{ color: '#b8912a' }}>{appointments.length}</span>
                <span className="av-cal-mini-lbl">Total</span>
              </div>
            </div>

            {/* Upcoming card */}
            <div className="av-cal-side-card av-cal-upcoming-card">
              <div className="av-cal-side-head">
                <span className="av-cal-side-icon">📅</span>
                <span className="av-cal-side-title">À venir</span>
              </div>
              {upcoming.length === 0
                ? <p className="av-cal-empty">Aucun rendez-vous à venir</p>
                : <div className="av-cal-upcoming-list">
                    {upcoming.map((a, i) => {
                      const d  = new Date(a.date);
                      const sc = STATUS_COLORS[a.statut] || STATUS_COLORS.annulé;
                      return (
                        <div key={i} className="av-cal-upcoming-row">
                          <div className="av-cal-date-badge" style={{ background: sc.bg, borderColor: sc.color + '40' }}>
                            <span className="av-cal-date-day">{d.getDate()}</span>
                            <span className="av-cal-date-mon">{MONTHS_FR3[d.getMonth()]}</span>
                          </div>
                          <div className="av-cal-upcoming-info">
                            <span className="av-cal-upcoming-name">{aptName(a)}</span>
                            <span className="av-cal-upcoming-meta">
                              {a.heure || '–'} · {DAYS_FR3[d.getDay()]}
                            </span>
                          </div>
                          <div className="av-cal-dot" style={{ background: sc.color }} />
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

          </aside>
        </div>
      </div>
    );
  };

  const renderCasesView = () => <CasesManager appointments={appointments} user={user} />;

  const renderStatisticsView = () => {
    const now = new Date();

    // ── Données mensuelles (6 derniers mois) ──
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { label: d.toLocaleDateString('fr-FR', { month: 'short' }), month: d.getMonth(), year: d.getFullYear(), count: 0 };
    });
    appointments.forEach(apt => {
      const d = new Date(apt.date);
      const m = months.find(m => m.month === d.getMonth() && m.year === d.getFullYear());
      if (m) m.count++;
    });
    const maxMonth = Math.max(...months.map(m => m.count), 1);

    // ── Données journalières (30 derniers jours) ──
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - 29 + i);
      return { label: d.toLocaleDateString('fr-FR', { weekday: 'short' })[0].toUpperCase(), date: d.toDateString(), count: 0 };
    });
    appointments.forEach(apt => {
      const day = days.find(d => d.date === new Date(apt.date).toDateString());
      if (day) day.count++;
    });
    const maxDay = Math.max(...days.map(d => d.count), 1);

    // ── Mode de consultation ──
    const physique = appointments.filter(a => a.type === 'physique' || a.typeConsultation === 'physique').length;
    const visio    = appointments.filter(a => a.type === 'visio'    || a.typeConsultation === 'visio').length;
    const phone    = appointments.filter(a => a.type === 'phone'    || a.typeConsultation === 'phone').length;
    const modeTotal = Math.max(physique + visio + phone, 1);

    // ── Donut statuts ──
    const nbConfirmed = appointments.filter(a => a.statut === 'confirmé').length;
    const nbPending   = appointments.filter(a => a.statut === 'en_attente').length;
    const nbCanceled  = appointments.filter(a => ['annulé','refusé'].includes(a.statut)).length;
    const donutData   = [
      { label: 'Confirmés',        value: nbConfirmed, color: '#22c55e' },
      { label: 'En attente',       value: nbPending,   color: '#f59e0b' },
      { label: 'Annulés/Refusés',  value: nbCanceled,  color: '#ef4444' },
    ];
    const donutTotal = Math.max(donutData.reduce((s, d) => s + d.value, 0), 1);
    let cumul = 0;
    const donutSegments = donutData.map(seg => {
      const start = cumul / donutTotal;
      cumul += seg.value;
      const end = cumul / donutTotal;
      const a1 = start * 2 * Math.PI - Math.PI / 2;
      const a2 = end   * 2 * Math.PI - Math.PI / 2;
      const r = 60, ri = 38, cx = 80, cy = 80;
      const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
      const x2 = cx + r*Math.cos(a2), y2 = cy + r*Math.sin(a2);
      const xi1 = cx + ri*Math.cos(a1), yi1 = cy + ri*Math.sin(a1);
      const xi2 = cx + ri*Math.cos(a2), yi2 = cy + ri*Math.sin(a2);
      const lg = end - start > 0.5 ? 1 : 0;
      const path = `M${x1} ${y1} A${r} ${r} 0 ${lg} 1 ${x2} ${y2} L${xi2} ${yi2} A${ri} ${ri} 0 ${lg} 0 ${xi1} ${yi1}Z`;
      return { ...seg, path, pct: Math.round(seg.value / donutTotal * 100) };
    });

    const tauxAnnulation  = appointments.length ? Math.round((nbCanceled  / appointments.length) * 100) : 0;
    const tauxConfirmation = appointments.length ? Math.round((nbConfirmed / appointments.length) * 100) : 0;

    return (
      <div className="av-stats-page">

        {/* ── KPI Cards ── */}
        <div className="av-kpi-grid">
          {[
            { label: 'DEMANDES REÇUES',  value: statistics.totalAppointments,    sub: `↑ +${statistics.pendingRequests} en attente`, subColor: '#22c55e' },
            { label: 'RDV CONFIRMÉS',    value: statistics.confirmedAppointments, sub: `Taux : ${tauxConfirmation}%`,                subColor: '#6b6456' },
            { label: 'EN ATTENTE',       value: statistics.pendingRequests,       sub: 'À traiter',                                  subColor: '#f59e0b' },
            { label: 'TAUX ANNULATION',  value: `${tauxAnnulation}%`,            sub: tauxAnnulation < 20 ? '↓ amélioration' : '↑ à surveiller', subColor: tauxAnnulation < 20 ? '#22c55e' : '#ef4444' },
          ].map((k, i) => (
            <div key={i} className="av-kpi-card">
              <div className="av-kpi-label">{k.label}</div>
              <div className="av-kpi-value">{k.value}</div>
              <div className="av-kpi-sub" style={{ color: k.subColor }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Ligne 1 : barres journalières + donut ── */}
        <div className="av-charts-row">
          <div className="av-chart-card">
            <div className="av-chart-title">RDV — 30 DERNIERS JOURS</div>
            <div className="av-bar-chart">
              {days.map((d, i) => (
                <div key={i} className="av-bar-col">
                  <div className="av-bar-wrap">
                    <div className="av-bar-fill" style={{
                      height: `${Math.max((d.count / maxDay) * 100, d.count > 0 ? 18 : 6)}%`,
                      background: i === days.length - 1 ? '#b8912a' : 'rgba(184,145,42,0.35)',
                    }} />
                  </div>
                  {i % 5 === 0 && <div className="av-bar-label">{d.label}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="av-chart-card">
            <div className="av-chart-title">STATUTS DES RDV</div>
            <div className="av-donut-wrap">
              <svg width="160" height="160" viewBox="0 0 160 160">
                {appointments.length === 0
                  ? <circle cx="80" cy="80" r="49" fill="none" stroke="#e8e4db" strokeWidth="22" />
                  : donutSegments.map((seg, i) => seg.value > 0 && <path key={i} d={seg.path} fill={seg.color} />)
                }
                <text x="80" y="76" textAnchor="middle" fontSize="20" fontWeight="700" fill="#1a1814">{appointments.length}</text>
                <text x="80" y="92" textAnchor="middle" fontSize="10" fill="#a89e92">total</text>
              </svg>
              <div className="av-donut-legend">
                {donutSegments.map((seg, i) => (
                  <div key={i} className="av-donut-leg-item">
                    <span className="av-donut-dot" style={{ background: seg.color }} />
                    <span>{seg.label} <strong>{seg.pct}%</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Ligne 2 : barres mensuelles + modes ── */}
        <div className="av-charts-row">
          <div className="av-chart-card">
            <div className="av-chart-title">RDV PAR MOIS</div>
            <div className="av-bar-chart av-bar-chart-monthly">
              {months.map((m, i) => (
                <div key={i} className="av-bar-col av-bar-col-wide">
                  <div className="av-bar-wrap">
                    <div className="av-bar-fill" style={{
                      height: `${Math.max((m.count / maxMonth) * 100, m.count > 0 ? 15 : 5)}%`,
                      background: i === months.length - 1 ? '#b8912a' : '#16202e',
                    }} />
                  </div>
                  <div className="av-bar-label">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="av-chart-card">
            <div className="av-chart-title">MODE DE CONSULTATION</div>
            <div className="av-mode-bars">
              {[
                { label: 'PRÉSENTIEL', value: physique, color: '#16202e' },
                { label: 'TÉLÉPHONE',  value: phone,    color: '#22c55e' },
                { label: 'VIDÉO',      value: visio,    color: '#b8912a' },
              ].map((m, i) => {
                const pct = modeTotal > 0 ? Math.round((m.value / modeTotal) * 100) : 0;
                return (
                  <div key={i} className="av-mode-row">
                    <div className="av-mode-label">{m.label}</div>
                    <div className="av-mode-bar-wrap">
                      <div className="av-mode-bar-fill" style={{ width: `${pct || 0}%`, background: m.color }} />
                    </div>
                    <div className="av-mode-pct">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    );
  };
  const [rvFilter, setRvFilter]       = React.useState('all');
  const [rvSearch, setRvSearch]       = React.useState('');
  const [clientSearch, setClientSearch] = React.useState('');
  /* ── RENDEZ-VOUS VIEW ── */
  const renderRendezVousView = () => {


    const pending = appointments.filter(a => a.statut === 'en_attente');
    const paid = appointments.filter(a => a.statut === 'payé');
    const confirmed = appointments.filter(a => a.statut === 'confirmé');
    const rejected = appointments.filter(a => a.statut === 'refusé');
    const canceled = appointments.filter(a => a.statut === 'annulé');

    const tabs = [
      { key: 'all', label: 'Tous', count: appointments.length, color: '#6b7280' },
      { key: 'en_attente', label: 'En attente', count: pending.length, color: '#f59e0b' },
      { key: 'payé', label: 'Payés', count: paid.length, color: '#b8912a' },
      { key: 'confirmé', label: 'Confirmés', count: confirmed.length, color: '#22c55e' },
      { key: 'refusé', label: 'Refusés', count: rejected.length, color: '#ef4444' },
      { key: 'annulé', label: 'Annulés', count: canceled.length, color: '#9ca3af' },
    ];

    const filtered = (rvFilter === 'all' ? appointments : appointments.filter(a => a.statut === rvFilter))
      .filter(a => {
        if (!rvSearch.trim()) return true;
        const q = rvSearch.toLowerCase();
        const name = (a.clientId?.fullName || a.clientId?.nom || a.clientNom || '').toLowerCase();
        const email = (a.clientId?.email || a.clientEmail || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });

    /* request row — big horizontal card */
    const RvRow = ({ apt }) => {
      const sc = STATUS_CONFIG[apt.statut] || { label: apt.statut, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', dot: '○' };
      const date = new Date(apt.date);
      const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const clientName = apt.clientId?.fullName || apt.clientId?.nom || apt.clientNom || 'Client';
      const clientEmail = apt.clientId?.email || apt.clientEmail || '';
      const clientPhone = apt.clientId?.phone || apt.clientPhone || '';
      const initials = clientName.charAt(0).toUpperCase();

      return (
        <div className="rv-row" onClick={() => handleOpenAppointmentDetails(apt)}>
          {/* left accent */}
          <div className="rv-row-accent" style={{ background: sc.color }} />

          {/* avatar */}
          <div className="rv-avatar">
            {apt.clientId?.avatarUrl
              ? <img src={apt.clientId.avatarUrl} alt="" />
              : <span>{initials}</span>}
          </div>

          {/* client info */}
          <div className="rv-client">
            <div className="rv-client-name">{clientName}</div>
            {clientEmail && <div className="rv-client-email">{clientEmail}</div>}
            {clientPhone && <div className="rv-client-phone">📞 {clientPhone}</div>}
          </div>

          {/* date / time */}
          <div className="rv-datetime">
            <div className="rv-date">{dateStr}</div>
            <div className="rv-time">🕐 {apt.heure || '–'}</div>
          </div>

          {/* message preview */}
          {apt.message && (
            <div className="rv-message">
              <span className="rv-message-label">Message</span>
              <span className="rv-message-text">{apt.message}</span>
            </div>
          )}

          {/* status badge */}
          <div className="rv-status-wrap">
            <span className="rv-status-badge"
              style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.color}33` }}>
              {sc.dot} {sc.label}
            </span>
          </div>

          {/* ACTION BUTTONS — stop propagation so row click doesn't fire */}
          <div className="rv-actions" onClick={e => e.stopPropagation()}>
            {apt.statut === 'en_attente' && (
              <>
                <button className="rv-btn rv-btn-accept"
                  onClick={() => handleApproveAppointment(apt._id)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Accepter
                </button>
                <button className="rv-btn rv-btn-reject"
                  onClick={() => handleRejectAppointment(apt._id)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Refuser
                </button>
              </>
            )}
            {apt.statut === 'payé' && (
              <>
                <button className="rv-btn rv-btn-accept"
                  onClick={() => handleApproveAppointment(apt._id)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Confirmer
                </button>
                <button className="rv-btn rv-btn-reject"
                  onClick={() => handleRejectAppointment(apt._id)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Refuser
                </button>
              </>
            )}
            {apt.statut === 'confirmé' && (
              <button className="rv-btn rv-btn-reschedule"
                onClick={() => handleRescheduleAppointment(apt._id)}>
                🔁 Reprogrammer
              </button>
            )}
            {['confirmé', 'en_attente', 'payé'].includes(apt.statut) && (
              <button className="rv-btn rv-btn-cancel"
                onClick={() => handleCancelAppointment(apt._id)}>
                🚫 Annuler
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div>
        {/* Page header */}
        <div className="av-page-header">
          {/* pending badge */}
          {statistics.pendingRequests > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.3)',
              borderRadius: 12, padding: '10px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontFamily: 'var(--av-font-display)', fontWeight: 700, color: '#f59e0b', lineHeight: 1 }}>
                {statistics.pendingRequests}
              </div>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>
                En attente
              </div>
            </div>
          )}
        </div>

        {/* Tabs + search */}
        <div className="rv-toolbar">
          <div className="rv-tabs">
            {tabs.map(tab => (
              <button key={tab.key}
                className={`rv-tab${rvFilter === tab.key ? ' active' : ''}`}
                style={rvFilter === tab.key ? { borderColor: tab.color, color: tab.color, background: `${tab.color}14` } : {}}
                onClick={() => setRvFilter(tab.key)}>
                {tab.label}
                {tab.count > 0 && (
                  <span className="rv-tab-badge"
                    style={rvFilter === tab.key
                      ? { background: tab.color, color: '#fff' }
                      : { background: 'var(--av-border)', color: 'var(--av-text2)' }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="rv-search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Rechercher un client…"
              value={rvSearch}
              onChange={e => setRvSearch(e.target.value)}
            />
            {rvSearch && (
              <button className="rv-search-clear" onClick={() => setRvSearch('')}>✕</button>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="av-state"><div className="av-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="av-state">
            <div className="av-empty-icon">📭</div>
            <h3 style={{ color: 'var(--av-text2)' }}>
              {rvSearch ? 'Aucun résultat pour cette recherche' : 'Aucun rendez-vous dans cette catégorie'}
            </h3>
          </div>
        ) : (
          <div className="rv-list">
            {filtered.map(apt => <RvRow key={apt._id} apt={apt} />)}
          </div>
        )}
      </div>
    );
  };

  const renderClientsView = () => {
    const MONTHS_FR3 = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
    const STATUS_LABELS = {
      confirmé: { label: 'Confirmé', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
      en_attente: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
      annulé: { label: 'Annulé', color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' },
      refusé: { label: 'Refusé', color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
      terminé: { label: 'Terminé', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
    };

    // Build unique client map
    const clientMap = {};
    appointments.forEach(apt => {
      const cid = apt.clientId?._id || apt.clientId || apt.clientEmail || apt.clientNom;
      if (!cid) return;
      if (!clientMap[cid]) {
        clientMap[cid] = {
          id:     cid,
          name:   apt.clientId?.fullName || apt.clientId?.nom || apt.clientNom || 'Client',
          email:  apt.clientId?.email || apt.clientEmail || '',
          phone:  apt.clientId?.phone || apt.clientId?.telephone || '',
          avatar: apt.clientId?.avatarUrl || '',
          apts:   [],
        };
      }
      clientMap[cid].apts.push(apt);
    });

    const allClients = Object.values(clientMap).sort((a, b) => a.name.localeCompare(b.name));
    const clients = allClients.filter(c =>
      !clientSearch ||
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase())
    );

    const initials = name => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

    const fmtDate = iso => {
      if (!iso) return '–';
      const d = new Date(iso);
      return `${d.getDate()} ${MONTHS_FR3[d.getMonth()]} ${d.getFullYear()}`;
    };

    const lastApt = c => {
      const sorted = [...c.apts].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date));
      return sorted[0] || null;
    };

    const nextApt = c => {
      const now = new Date();
      const future = [...c.apts]
        .filter(a => a.date && new Date(a.date) >= now && a.statut !== 'annulé' && a.statut !== 'refusé')
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      return future[0] || null;
    };

    return (
      <div className="av-clients-page">

        {/* ── Topbar ── */}
        <div className="av-clients-topbar">
          <div className="av-clients-search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Rechercher un client…"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
            />
            {clientSearch && <button className="rv-search-clear" onClick={() => setClientSearch('')}>✕</button>}
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="av-state">
            <div className="av-empty-icon">👤</div>
            <h3 style={{ color: 'var(--av-text2)' }}>
              {clientSearch ? 'Aucun résultat pour cette recherche' : "Aucun client pour l'instant"}
            </h3>
          </div>
        ) : (
          <div className="av-clients-grid">
            {clients.map(c => {
              const last = lastApt(c);
              const next = nextApt(c);
              const confirmed = c.apts.filter(a => a.statut === 'confirmé').length;
              const pending   = c.apts.filter(a => a.statut === 'en_attente').length;
              const recentApts = [...c.apts]
                .filter(a => a.date)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 3);

              return (
                <div key={c.id} className="av-client-card">

                  {/* ── Card header ── */}
                  <div className="av-cc-header">
                    <div className="av-cc-avatar">
                      {c.avatar
                        ? <img src={c.avatar} alt={c.name} />
                        : <span>{initials(c.name)}</span>
                      }
                    </div>
                    <div className="av-cc-identity">
                      <div className="av-cc-name">{c.name}</div>
                      {c.email && (
                        <div className="av-cc-contact">
                          <span className="av-cc-contact-icon">✉</span> {c.email}
                        </div>
                      )}
                      {c.phone && (
                        <div className="av-cc-contact">
                          <span className="av-cc-contact-icon">📞</span> {c.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Stats row ── */}
                  <div className="av-cc-stats">
                    <div className="av-cc-stat">
                      <span className="av-cc-stat-num">{c.apts.length}</span>
                      <span className="av-cc-stat-lbl">Total RDV</span>
                    </div>
                    <div className="av-cc-stat-sep" />
                    <div className="av-cc-stat">
                      <span className="av-cc-stat-num" style={{ color: '#22c55e' }}>{confirmed}</span>
                      <span className="av-cc-stat-lbl">Confirmés</span>
                    </div>
                    <div className="av-cc-stat-sep" />
                    <div className="av-cc-stat">
                      <span className="av-cc-stat-num" style={{ color: '#f59e0b' }}>{pending}</span>
                      <span className="av-cc-stat-lbl">En attente</span>
                    </div>
                  </div>

                  {/* ── Prochain RDV ── */}
                  {next && (
                    <div className="av-cc-next">
                      <span className="av-cc-next-label">Prochain RDV</span>
                      <div className="av-cc-next-row">
                        <span className="av-cc-next-date">{fmtDate(next.date)}</span>
                        {next.heure && <span className="av-cc-next-time">{next.heure}</span>}
                        <span className="av-cc-next-status"
                          style={{ color: STATUS_LABELS[next.statut]?.color, background: STATUS_LABELS[next.statut]?.bg }}>
                          {STATUS_LABELS[next.statut]?.label || next.statut}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ── Historique récent ── */}
                  {recentApts.length > 0 && (
                    <div className="av-cc-history">
                      <div className="av-cc-history-title">Historique récent</div>
                      {recentApts.map((a, i) => {
                        const sc = STATUS_LABELS[a.statut] || { label: a.statut, color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' };
                        return (
                          <div key={i} className="av-cc-history-row">
                            <span className="av-cc-history-dot" style={{ background: sc.color }} />
                            <span className="av-cc-history-date">{fmtDate(a.date)}</span>
                            {a.heure && <span className="av-cc-history-time">{a.heure}</span>}
                            <span className="av-cc-history-status"
                              style={{ color: sc.color, background: sc.bg }}>
                              {sc.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'appointments': return renderAppointmentsView();
      case 'calendar': return renderCalendarView();
      case 'rendezVous': return renderRendezVousView();
      case 'cases': return renderCasesView();
      case 'clients': return renderClientsView();
      case 'profile': return renderProfileView();
      case 'statistics': return renderStatisticsView();
      case 'network': return (
        <ReseauPro
          onOpenMessage={(avocatId, avocatInfo) => {
            setMessagerieAvocatId(avocatId);
            setMessagerieAvocatInfo(avocatInfo || null);
            setCurrentView('messages');
          }}
        />
      );
      case 'messages': return (
        <MessageriePro
          openWithAvocatId={messagerieAvocatId}
          openWithAvocatInfo={messagerieAvocatInfo}
          onUnreadChange={() => {}}
        />
      );
      default: return renderAppointmentsView();
    }
  };

  /* ── NAV ITEMS ── */
  const navItems = [
    {
      section: 'PRINCIPAL',
      items: [
        {
          key: 'appointments', label: 'Accueil', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5z" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6 15V9h4v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
        {
          key: 'calendar', label: 'Agenda', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <rect x="5" y="9" width="2" height="2" rx="0.5" fill="currentColor" />
              <rect x="9" y="9" width="2" height="2" rx="0.5" fill="currentColor" />
            </svg>
          )
        },
        {
          key: 'rendezVous', label: 'Rendez-vous', badge: statistics.pendingRequests, icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 13c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
        {
          key: 'clients', label: 'Clients', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 13c0-2.21 2.239-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M13 13c0-1.657-1.567-3-3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="11" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )
        },
      ]
    },
    {
      section: 'PRO',
      items: [
        {
          key: 'statistics', label: 'Statistiques', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12l3-4 3 2 3-5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="1" y="13" width="14" height="1.5" rx="0.5" fill="currentColor" opacity="0.3" />
            </svg>
          )
        },
        {
          key: 'network', label: 'Réseau Pro', badge: 3, icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="2.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="13.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="8" cy="14" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 4.5L6.5 6.5M9.5 6.5L12 4.5M8 10v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )
        },
        {
          key: 'messages', label: 'Messagerie', badge: 2, icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3l3 3 3-3h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          )
        },
      ]
    },
    {
      section: 'COMPTE',
      items: [
        {
          key: 'profile', label: 'Mon profil', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 13c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
        {
          key: 'settings', label: 'Paramètres', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )
        },
      ]
    },
  ];

  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f4f0' }}>
      <div className="av-spinner" />
    </div>
  );

  if (!isVerified) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f4f0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.1)', maxWidth: 440, border: '1.5px solid #e8e4db' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
        <h2 style={{ color: '#1a1814', marginBottom: 12, fontFamily: "'Fraunces', serif" }}>{t('avocatDashboard.accountVerificationRequired')}</h2>
        <p style={{ color: '#6b6456', marginBottom: 20 }}>{t('avocatDashboard.verificationPendingText')}</p>
        <div style={{ background: '#f5edd8', color: '#7a5e18', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{t('avocatDashboard.verificationInProgress')}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="av-root">
        {/* Mobile toggle */}
        <div className="av-mobile-topbar">
          <button className="av-mobile-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Overlay */}
        <div className={`av-overlay ${isMobileMenuOpen ? 'show' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

        {/* Sidebar */}
        <aside className={`av-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="av-sidebar-brand">
            <Logo />
          </div>

          <nav className="av-sidebar-nav">
            {navItems.map((group, gi) => (
              <div key={gi} className="av-nav-group">
                <div className="av-nav-section">{group.section}</div>
                {group.items.map(item => (
                  <button
                    key={item.key}
                    className={`av-nav-item ${currentView === item.key ? 'active' : ''}`}
                    onClick={() => { setCurrentView(item.key); setIsMobileMenuOpen(false); }}
                  >
                    <span className="av-nav-icon">{item.icon}</span>
                    <span className="av-nav-label">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="av-sidebar-footer">
            <div className="av-sidebar-avatar">
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : <span>{(user.firstName || user.fullName || 'A').charAt(0).toUpperCase()}</span>}
              <div className="av-online-dot" />
            </div>
            <div className="av-sidebar-user-info">
              <div className="av-sidebar-user-name">{user.fullName || user.firstName || 'Avocat'}</div>
              <div className="av-sidebar-user-role">Avocat</div>
            </div>
            <button className="av-sidebar-logout" onClick={handleLogout}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </aside>

        <LogoutModal isOpen={showLogout} onClose={() => setShowLogout(false)} />

        {/* Main */}
        <main className="av-main">
          {/* ── TOPBAR ── */}
          <div className="av-topbar">
            <span className="av-topbar-spacer" />
            <div className="av-topbar-right">
              <div className="av-notif-wrapper">
                <button className="av-notif-btn" onClick={() => setNotifOpen(p => !p)} aria-label="Notifications">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {unreadCount > 0 && <span className="av-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
                {notifOpen && <NotifDropdown notifications={notifications} unreadCount={unreadCount} onMarkAll={handleMarkAllRead} onMarkOne={handleMarkOneRead} />}
              </div>
            </div>
          </div>

          <div className="av-content">
            {renderContent()}
          </div>
        </main>

        <BookingModal
          avocat={user}
          open={bookingModalOpen}
          onClose={() => { setBookingModalOpen(false); setAppointmentToReschedule(null); }}
          mode="reschedule"
          existingAppointment={appointmentToReschedule}
          onRescheduled={(updated) => {
            const updatedObj = updated._id ? updated : updated.rendezvous || updated;
            setAppointments(prev => {
              const next = prev.map(a => a._id === updatedObj._id ? updatedObj : a);
              const sorted = sortAppointmentsByCreated(next);
              setStatistics(computeStatisticsFrom(sorted));
              return sorted;
            });
          }}
        />
      </div>

      {/* Appointment Details Modal */}
      {appointmentDetailsModalOpen && selectedAppointmentDetails && createPortal(
        <div className="av-modal-overlay" onClick={() => setAppointmentDetailsModalOpen(false)}>
          <div className="av-modal" onClick={e => e.stopPropagation()}>
            <div className="av-modal-header">
              <span className="av-modal-title">📋 {t('avocatDashboard.appointmentDetails')}</span>
              <button className="av-modal-close" onClick={() => setAppointmentDetailsModalOpen(false)}>✕</button>
            </div>

            <div className="av-modal-body">
              {/* Client */}
              <div className="av-modal-section">
                <div className="av-modal-section-header">👤 {t('avocatDashboard.clientInformation')}</div>
                <div className="av-modal-section-body">
                  <div className="av-modal-field">
                    <span className="av-modal-field-label">{t('avocatDashboard.fullName')}</span>
                    <span className="av-modal-field-value">{selectedAppointmentDetails.clientId?.fullName || selectedAppointmentDetails.clientId?.nom || t('avocatDashboard.client')}</span>
                  </div>
                  <div className="av-modal-field">
                    <span className="av-modal-field-label">{t('avocatDashboard.email')}</span>
                    <span className="av-modal-field-value" style={{ fontFamily: 'monospace', color: '#c9a84c' }}>{selectedAppointmentDetails.clientId?.email || t('avocatDashboard.noEmail')}</span>
                  </div>
                  {selectedAppointmentDetails.clientId?.phone && (
                    <div className="av-modal-field">
                      <span className="av-modal-field-label">{t('avocatDashboard.phone')}</span>
                      <span className="av-modal-field-value">{selectedAppointmentDetails.clientId.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment info */}
              <div className="av-modal-section">
                <div className="av-modal-section-header">🗓 {t('avocatDashboard.appointmentInformation')}</div>
                <div className="av-modal-section-body">
                  {[
                    { label: t('avocatDashboard.date'), value: selectedAppointmentDetails.date ? new Date(selectedAppointmentDetails.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                    { label: t('avocatDashboard.time'), value: selectedAppointmentDetails.heure },
                    { label: t('avocatDashboard.status'), value: (STATUS_CONFIG[selectedAppointmentDetails.statut] || {}).label || selectedAppointmentDetails.statut, color: (STATUS_CONFIG[selectedAppointmentDetails.statut] || {}).color },
                  ].map((f, i) => (
                    <div key={i} className="av-modal-field">
                      <span className="av-modal-field-label">{f.label}</span>
                      <span className="av-modal-field-value" style={f.color ? { color: f.color, fontWeight: 700 } : {}}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message */}
              {selectedAppointmentDetails.message && (
                <div className="av-modal-section">
                  <div className="av-modal-section-header">💬 {t('avocatDashboard.clientMessage')}</div>
                  <div className="av-modal-section-body" style={{ color: '#c8d8e8', fontSize: 13, lineHeight: 1.6 }}>{selectedAppointmentDetails.message}</div>
                </div>
              )}

              {/* Files */}
              {selectedAppointmentDetails.caseFiles?.length > 0 && (
                <div className="av-modal-section">
                  <div className="av-modal-section-header">📁 {t('avocatDashboard.clientFiles')}</div>
                  <div className="av-modal-section-body">
                    {selectedAppointmentDetails.caseFiles.map((doc, i) => (
                      <FileViewer key={i} file={doc.url || doc} fileName={doc.filename || `Document ${i + 1}`} showPreview={true} />
                    ))}
                  </div>
                </div>
              )}

              {/* Payment */}
              {selectedAppointmentDetails.paymentStatus && (
                <div className="av-modal-section">
                  <div className="av-modal-section-header">💳 {t('avocatDashboard.paymentInfo')}</div>
                  <div className="av-modal-section-body">
                    <div className="av-modal-field">
                      <span className="av-modal-field-label">Statut</span>
                      <span className="av-modal-field-value">{t(`avocatDashboard.paymentStatus.${selectedAppointmentDetails.paymentStatus}`)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="av-modal-footer">
              {selectedAppointmentDetails.statut === 'en_attente' && <>
                <button className="av-btn av-btn-approve" onClick={() => { setAppointmentDetailsModalOpen(false); handleApproveAppointment(selectedAppointmentDetails._id); }}>✓ {t('avocatDashboard.approve')}</button>
                <button className="av-btn av-btn-reject" onClick={() => { setAppointmentDetailsModalOpen(false); handleRejectAppointment(selectedAppointmentDetails._id); }}>✕ {t('avocatDashboard.reject')}</button>
              </>}
              {selectedAppointmentDetails.statut === 'payé' && <>
                <button className="av-btn av-btn-approve" onClick={() => { setAppointmentDetailsModalOpen(false); handleApproveAppointment(selectedAppointmentDetails._id); }}>✓ {t('avocatDashboard.confirmAppointment')}</button>
                <button className="av-btn av-btn-reject" onClick={() => { setAppointmentDetailsModalOpen(false); handleRejectAppointment(selectedAppointmentDetails._id); }}>✕ {t('avocatDashboard.reject')}</button>
              </>}
              {selectedAppointmentDetails.statut === 'confirmé' && !['paid_in_person', 'paid_online'].includes(selectedAppointmentDetails.paymentStatus) && (
                <button className="av-btn av-btn-gold" onClick={() => { setAppointmentDetailsModalOpen(false); handleMarkAsPaid(selectedAppointmentDetails._id); }}>💳 {t('avocatDashboard.markAsPaid')}</button>
              )}
              {['confirmé', 'en_attente', 'payé'].includes(selectedAppointmentDetails.statut) && <>
                <button className="av-btn av-btn-outline" style={{ color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }} onClick={() => { setAppointmentDetailsModalOpen(false); handleRescheduleAppointment(selectedAppointmentDetails._id); }}>
                  🔁 {t('avocatDashboard.reschedule')}
                </button>
                <button className="av-btn av-btn-reject" onClick={() => { setAppointmentDetailsModalOpen(false); handleCancelAppointment(selectedAppointmentDetails._id); }}>
                  🚫 {t('avocatDashboard.cancel')}
                </button>
              </>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AvocatDashboard;