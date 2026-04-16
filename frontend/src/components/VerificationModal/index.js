import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './VerificationModal.css';

const DAYS_MAP_KEYS = {
  monday: 'day.mon', tuesday: 'day.tue', wednesday: 'day.wed',
  thursday: 'day.thu', friday: 'day.fri', saturday: 'day.sat', sunday: 'day.sun',
};
const DAY_NORMALIZE = {
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
  fri: 'friday', sat: 'saturday', sun: 'sunday',
  monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday',
  thursday: 'thursday', friday: 'friday', saturday: 'saturday', sunday: 'sunday',
};
const DOC_KEYS = {
  carteBarreauFront: 'verif.doc.carteBarreauFront',
  carteBarreauBack:  'verif.doc.carteBarreauBack',
  diplome:           'verif.doc.diplome',
  patente:           'verif.doc.patente',
  casierJudiciaire:  'verif.doc.casierJudiciaire',
};
const normalizeDay = (d) => DAY_NORMALIZE[d?.toLowerCase()] || d?.toLowerCase();

/* ── Sub-components ── */

function Section({ icon, title, children }) {
  return (
    <div className="vm-section">
      <div className="vm-section-header">
        <span className="vm-section-icon">{icon}</span>
        <span className="vm-section-title">{title}</span>
      </div>
      <div className="vm-section-body">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="vm-field">
      <div className="vm-field-label">{label}</div>
      <div className={`vm-field-value${mono ? ' mono' : ''}`}>{value}</div>
    </div>
  );
}

function Badge({ children, color = '#C9A84C' }) {
  return (
    <span className="vm-badge" style={{ background: color + '22', color, borderColor: color + '55' }}>
      {children}
    </span>
  );
}

function DocCard({ label, url, filename, t }) {
  const [expanded, setExpanded] = useState(false);
  const urlStr = typeof url === 'string' ? url
    : url && typeof url === 'object'
      ? (url.url || url.path || url.secure_url || url.location || '')
      : '';
  const nameStr = filename || (url && typeof url === 'object' ? url.originalName : '') || '';
  const isPdf = nameStr.toLowerCase().endsWith('.pdf') || urlStr.toLowerCase().includes('.pdf');

  return (
    <div className="vm-doc-card">
      <div className="vm-doc-card-header">
        <div className="vm-doc-card-left">
          <span className="vm-doc-icon">{isPdf ? '📄' : '🖼️'}</span>
          <div>
            <div className="vm-doc-label">{label}</div>
            {nameStr && <div className="vm-doc-filename">{nameStr}</div>}
          </div>
        </div>
        <div className="vm-doc-actions">
          {urlStr
            ? <button className="vm-doc-btn" onClick={() => setExpanded(p => !p)}>
                {expanded ? t('verif.doc.reduce') : (isPdf ? t('verif.doc.viewPdf') : t('verif.doc.view'))}
              </button>
            : <span className="vm-doc-missing">{t('verif.doc.missing')}</span>
          }
        </div>
      </div>
      {expanded && urlStr && !isPdf && <img src={urlStr} alt={label} className="vm-doc-preview" />}
      {expanded && urlStr && isPdf  && <iframe src={urlStr} title={label} className="vm-doc-iframe" />}
    </div>
  );
}

function SlotGrid({ slots, t }) {
  const days  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const hours = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

  const slotArray = Array.isArray(slots)
    ? slots.map(sl => ({ ...sl, day: normalizeDay(sl.day) }))
    : slots && typeof slots === 'object'
      ? Object.entries(slots).flatMap(([day, times]) =>
          Array.isArray(times) ? times.map(time => ({ day: normalizeDay(day), time })) : [])
      : [];

  const slotSet = new Set(slotArray.map(sl => `${sl.day}-${sl.time}`));

  if (slotArray.length === 0) {
    return <div className="vm-empty-slots">{t('verif.avail.noSlots')}</div>;
  }

  return (
    <div className="vm-slot-wrap">
      <table className="vm-slot-table">
        <thead>
          <tr>
            <th className="vm-slot-th"></th>
            {days.map(d => <th key={d} className="vm-slot-th">{t(DAYS_MAP_KEYS[d])}</th>)}
          </tr>
        </thead>
        <tbody>
          {hours.map(h => (
            <tr key={h}>
              <td className="vm-slot-time-td">{h}</td>
              {days.map(d => (
                <td key={d} className={`vm-slot-td${slotSet.has(`${d}-${h}`) ? ' on' : ''}`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function VerificationModal({ isOpen, onClose, lawyer, onApprove, onReject, isLoading }) {
  const { t } = useTranslation();
  const [activeTab,     setActiveTab]     = useState('identity');
  const [rejectReason,  setRejectReason]  = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [photoZoomed,   setPhotoZoomed]   = useState(false);

  if (!isOpen || !lawyer) return null;

  const fullName    = [lawyer.firstName, lawyer.lastName].filter(Boolean).join(' ') || lawyer.fullName || lawyer.email || '—';
  const photoSrc    = lawyer.photo?.enhanced || lawyer.photo?.original || lawyer.avatarUrl || lawyer.photoUrl || null;
  const loc         = lawyer.officeLocation || lawyer;
  const lat         = loc.coordinates?.lat || loc.lat;
  const lng         = loc.coordinates?.lng || loc.lng;
  const mapsLink    = loc.googleMapsLink || loc.coordinates?.googleMapsLink || (lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null);
  const availSlots  = lawyer.availability?.slots || lawyer.slots;
  const slotCount   = Array.isArray(availSlots) ? availSlots.length : 0;
  const emergencyOn = lawyer.availability?.emergency?.enabled ?? lawyer.emergencyEnabled ?? false;

  const tabs = [
    { key: 'identity',     label: t('verif.tab.identity'),      icon: '🪪' },
    { key: 'professional', label: t('verif.tab.professional'),  icon: '⚖️' },
    { key: 'documents',    label: t('verif.tab.documents'),     icon: '📁' },
    { key: 'availability', label: t('verif.tab.availability'),  icon: '🗓' },
    { key: 'location',     label: t('verif.tab.location'),      icon: '📍' },
  ];

  const practiceStatusLabel = {
    independant: t('verif.status.independant'),
    associated:  t('verif.status.associated'),
    member:      t('verif.status.member'),
  };

  return (
    <>
      {/* Photo zoom overlay */}
      {photoZoomed && photoSrc && (
        <div className="vm-photo-overlay" onClick={() => setPhotoZoomed(false)}>
          <div className="vm-photo-zoom-circle">
            <img src={photoSrc} alt="profil" />
          </div>
          <div className="vm-photo-zoom-name">{fullName}</div>
        </div>
      )}

      <div className="vm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="vm-modal">

          {/* Header */}
          <div className="vm-header">
            <div className="vm-header-left">
              <div
                className="vm-avatar"
                style={{ cursor: photoSrc ? 'pointer' : 'default' }}
                onClick={() => photoSrc && setPhotoZoomed(true)}
              >
                {photoSrc
                  ? <img src={photoSrc} alt="" />
                  : <span className="vm-avatar-letter">{(lawyer.firstName || '?').charAt(0).toUpperCase()}</span>
                }
              </div>
              <div>
                <div className="vm-header-name">Me. {fullName}</div>
                <div className="vm-header-meta">
                  {lawyer.email}
                  {lawyer.barNumber && <> · <span>{lawyer.barNumber}</span></>}
                </div>
                <div className="vm-header-badges">
                  {(lawyer.status === 'confirmed' || lawyer.status === 'approved') && <Badge color="#22c55e">✓ {lawyer.status === 'confirmed' ? `Confirmé${lawyer.founderNumber ? ` · #${String(lawyer.founderNumber).padStart(4,'0')}` : ''}` : 'Vérifié'}</Badge>}
                  {lawyer.status === 'rejected'  && <Badge color="#ef4444">✕ Rejeté</Badge>}
                  {(!lawyer.status || lawyer.status === 'pending' || lawyer.status === 'draft') && <Badge color="#f59e0b">{t('verif.badge.pending')}</Badge>}
                  {emergencyOn && <Badge color="#ef4444">{t('verif.badge.emergency')}</Badge>}
                  {lawyer.languagePreference && (
                    <Badge color="#60a5fa">🌐 {lawyer.languagePreference.toUpperCase()}</Badge>
                  )}
                </div>
              </div>
            </div>
            <button className="vm-close-btn" onClick={onClose}>✕</button>
          </div>

          {/* Tabs */}
          <div className="vm-tabs">
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`vm-tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="vm-body">

            {/* ══ IDENTITÉ ══ */}
            {activeTab === 'identity' && (
              <Section icon="👤" title={t('verif.section.personalInfo')}>
                <div className="vm-grid2">
                  <Field label={t('verif.field.firstName')}   value={lawyer.firstName} />
                  <Field label={t('verif.field.lastName')}    value={lawyer.lastName} />
                  <Field label={t('verif.field.email')}       value={lawyer.email} />
                  <Field label={t('verif.field.phone')}       value={lawyer.phone} />
                  <Field label={t('verif.field.whatsapp')}    value={lawyer.whatsappPhone || (lawyer.sameWhatsapp ? lawyer.phone : null)} />
                  <Field label={t('verif.field.language')}    value={lawyer.languagePreference?.toUpperCase()} />
                  <Field label={t('verif.field.createdAt')}   value={lawyer.createdAt ? new Date(lawyer.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
                </div>
              </Section>
            )}

            {/* ══ PROFIL PRO ══ */}
            {activeTab === 'professional' && (
              <div>
                <Section icon="🏛️" title={t('verif.section.barInfo')}>
                  <div className="vm-grid2">
                    <Field label={t('verif.field.barNumber')}      value={lawyer.barNumber} mono />
                    <Field label={t('verif.field.barRegion')}      value={lawyer.barRegion || lawyer.university} />
                    <Field label={t('verif.field.graduationYear')} value={lawyer.graduationYear} />
                    <Field label={t('verif.field.practiceStatus')} value={practiceStatusLabel[lawyer.practiceStatus] || lawyer.practiceStatus} />
                    {lawyer.firmName && <Field label={t('verif.field.firmName')} value={lawyer.firmName} />}
                  </div>
                </Section>

                <Section icon="⚖️" title={t('verif.section.specialties')}>
                  {lawyer.specialties?.length > 0
                    ? <div className="vm-tag-wrap">{lawyer.specialties.map(sp => <span key={sp} className="vm-tag">{sp}</span>)}</div>
                    : <div className="vm-empty">{t('verif.empty.specialties')}</div>}
                </Section>

                <Section icon="🌐" title={t('verif.section.languages')}>
                  {(lawyer.spokenLanguages || lawyer.languages)?.length > 0
                    ? <div className="vm-tag-wrap">{(lawyer.spokenLanguages || lawyer.languages).map(l => <span key={l} className="vm-tag lang">{l}</span>)}</div>
                    : <div className="vm-empty">{t('verif.empty.languages')}</div>}
                </Section>

                <Section icon="📋" title={t('verif.section.plan')}>
                  <div className="vm-plan-box">
                    <div className="vm-plan-name">{lawyer.plan?.toUpperCase() || 'ESSENTIEL'}</div>
                    <div className="vm-plan-meta">{t('verif.plan.meta', { price: lawyer.planPrice ?? '—' })}</div>
                  </div>
                </Section>
              </div>
            )}

            {/* ══ DOCUMENTS ══ */}
            {activeTab === 'documents' && (
              <Section icon="📁" title={t('verif.section.documents')}>
                <div className="vm-doc-info">{t('verif.doc.info')}</div>
                {Object.entries(DOC_KEYS).map(([key, labelKey]) => (
                  <DocCard
                    key={key}
                    label={t(labelKey)}
                    url={lawyer.documents?.[key] || lawyer[key]}
                    filename={lawyer.documents?.[`${key}Name`] || lawyer[`${key}Name`]}
                    t={t}
                  />
                ))}
                {(lawyer.paymentProof || lawyer.justif) && (
                  <DocCard
                    label={t('verif.doc.paymentProof')}
                    url={lawyer.paymentProof || lawyer.justif}
                    t={t}
                  />
                )}
              </Section>
            )}

            {/* ══ DISPONIBILITÉS ══ */}
            {activeTab === 'availability' && (
              <div>
                <Section icon="🗓" title={t('verif.section.slots')}>
                  <SlotGrid slots={availSlots} t={t} />
                  <div className="vm-slot-legend">
                    <span className="vm-legend-on">{t('verif.avail.available')}</span>
                    <span className="vm-legend-off">{t('verif.avail.unavailable')}</span>
                    <span className="vm-legend-count">{t('verif.avail.slotCount', { count: slotCount })}</span>
                  </div>
                </Section>

                <Section icon="🚨" title={t('verif.section.emergency')}>
                  <div className={`vm-emergency-badge${emergencyOn ? ' on' : ' off'}`}>
                    {emergencyOn ? t('verif.avail.emergencyOn') : t('verif.avail.emergencyOff')}
                  </div>
                </Section>
              </div>
            )}

            {/* ══ CABINET ══ */}
            {activeTab === 'location' && (
              <div>
                <Section icon="📍" title={t('verif.section.address')}>
                  <div className="vm-grid2">
                    <Field label={t('verif.field.gouvernorat')} value={loc.gouvernorat || loc.wilaya} />
                    <Field label={t('verif.field.quartier')}    value={loc.quartier} />
                    <Field label={t('verif.field.address')}     value={loc.address} />
                    {lat && <Field label={t('verif.field.lat')} value={String(lat)} mono />}
                    {lng && <Field label={t('verif.field.lng')} value={String(lng)} mono />}
                  </div>
                </Section>

                {lat && lng && (
                  <Section icon="🗺️" title={t('verif.section.map')}>
                    <iframe
                      title="map"
                      className="vm-map-iframe"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng)-0.01},${parseFloat(lat)-0.01},${parseFloat(lng)+0.01},${parseFloat(lat)+0.01}&layer=mapnik&marker=${lat},${lng}`}
                    />
                    {mapsLink && (
                      <a href={mapsLink} target="_blank" rel="noreferrer" className="vm-map-link">
                        {t('verif.location.openMaps')}
                      </a>
                    )}
                  </Section>
                )}
              </div>
            )}

          </div>{/* /body */}

          {/* Reject reason */}
          {showRejectBox && (
            <div className="vm-reject-box">
              <label className="vm-reject-label">{t('verif.reject.reasonLabel')}</label>
              <textarea
                className="vm-reject-textarea"
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder={t('verif.reject.placeholder')}
              />
            </div>
          )}

          {/* Footer */}
          <div className="vm-footer">
            {(lawyer.status === 'confirmed' || lawyer.status === 'approved') ? (
              <div className="vm-footer-status vm-footer-status--confirmed">
                {lawyer.status === 'confirmed'
                  ? `✓ Dossier approuvé${lawyer.founderNumber ? ` — Fondateur #${String(lawyer.founderNumber).padStart(4,'0')}` : ''}`
                  : '✓ Avocat vérifié'}
              </div>
            ) : lawyer.status === 'rejected' ? (
              <div className="vm-footer-status vm-footer-status--rejected">
                ✕ Dossier rejeté{lawyer.reviewNote ? ` — ${lawyer.reviewNote}` : ''}
              </div>
            ) : (
              <>
                <button
                  className="vm-btn-reject"
                  disabled={isLoading}
                  onClick={() => showRejectBox ? onReject(lawyer._id, rejectReason) : setShowRejectBox(true)}
                >
                  {showRejectBox ? t('verif.action.confirmReject') : t('verif.action.reject')}
                </button>
                {showRejectBox && (
                  <button className="vm-btn-cancel" onClick={() => setShowRejectBox(false)}>
                    {t('verif.action.cancel')}
                  </button>
                )}
                <div className="vm-footer-spacer" />
                <button className="vm-btn-approve" onClick={() => onApprove(lawyer._id)} disabled={isLoading}>
                  {isLoading ? '…' : t('verif.action.approve')}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}