import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { reseauProAPI } from '../../../services/api';
import { NATURES, DISPO_LABELS, fmtDateTime, timeAgo, initials, fullName } from '../helpers';
import './TabSubstitution.css';

export default function TabSubstitution({ user, onUrgentCount }) {
  const { t } = useTranslation();
  const [feed, setFeed]       = useState([]);
  const [mes, setMes]         = useState([]);
  const [form, setForm]       = useState({ tribunal:'', dateAudience:'', nature:'', contexte:'' });
  const [loading, setLoading] = useState(false);
  const fileRef               = useRef(null);

  const load = async () => {
    const [f, m] = await Promise.all([
      reseauProAPI.getSubstitutions().catch(() => ({ substitutions:[] })),
      reseauProAPI.getMesSubstitutions().catch(() => ({ substitutions:[] })),
    ]);
    const subs = f.substitutions || [];
    setFeed(subs);
    setMes(m.substitutions || []);
    onUrgentCount(subs.filter(s => s.urgente).length);
  };
  useEffect(() => { load(); }, []);

  const handleEnvoyer = async () => {
    if (!form.tribunal || !form.dateAudience || !form.nature)
      return alert(t('avocatDashboard.notProvided'));
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (fileRef.current?.files[0]) fd.append('procuration', fileRef.current.files[0]);
      await reseauProAPI.createSubstitution(fd);
      setForm({ tribunal:'', dateAudience:'', nature:'', contexte:'' });
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleAccepter = async (id) => { await reseauProAPI.accepterSub(id); load(); };
  const handleIgnorer  = async (id) => { await reseauProAPI.ignorerSub(id);  load(); };
  const handleRetirer  = async (id) => {
    if (!window.confirm(t('reseauPro.substitution.withdraw') + ' ?')) return;
    await reseauProAPI.retirerSub(id); load();
  };

  const urgentes = feed.filter(s => s.urgente  && !s.ignored);
  const normales  = feed.filter(s => !s.urgente && !s.ignored);

  return (
    <div className="rp-two-col">
      {/* ── Formulaire ── */}
      <div className="rp-panel">
        <div className="rp-deonto-banner">
          <span className="rp-deonto-icon">⚖️</span>
          <div>
            <strong>Rappel déontologique</strong>
            <p>La substitution d'audience doit faire l'objet d'une procuration écrite entre avocats. Les honoraires sont convenus directement entre confrères, hors plateforme. Juridika.tn ne perçoit aucune commission. <em>(Art. 37 Code de déontologie ONAT)</em></p>
          </div>
        </div>
        <div className="rp-panel-title">🚨 {t('reseauPro.substitution.postTitle')}</div>
        <div className="rp-form-grid">
          <div className="rp-form-group">
            <label>{t('reseauPro.substitution.tribunal')}</label>
            <input value={form.tribunal} onChange={e => setForm(f=>({...f,tribunal:e.target.value}))} />
          </div>
          <div className="rp-form-group">
            <label>{t('reseauPro.substitution.date')}</label>
            <input type="datetime-local" value={form.dateAudience} onChange={e => setForm(f=>({...f,dateAudience:e.target.value}))} />
          </div>
        </div>
        <div className="rp-form-group">
          <label>{t('reseauPro.substitution.nature')} <span className="rp-hint">— {t('reseauPro.substitution.natureHint')}</span></label>
          <select value={form.nature} onChange={e => setForm(f=>({...f,nature:e.target.value}))}>
            <option value="">— — —</option>
            {NATURES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </div>
        <div className="rp-form-group">
          <label>{t('reseauPro.substitution.context')}</label>
          <textarea
            value={form.contexte}
            onChange={e => setForm(f=>({...f,contexte:e.target.value}))}
            rows={3}
          />
        </div>
        <div className="rp-form-actions">
          <label className="rp-btn-ghost rp-btn-file" style={{cursor:'pointer'}}>
            📎 {t('reseauPro.substitution.procuration')}
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{display:'none'}} />
          </label>
          <button className="rp-btn-gold" onClick={handleEnvoyer} disabled={loading}>
            {loading ? '⏳' : `🚨 ${t('reseauPro.substitution.send')}`}
          </button>
        </div>
      </div>

      {/* ── Mes substitutions ── */}
      <div className="rp-side-panel">
        <div className="rp-panel-title">{t('reseauPro.substitution.mySubs')}</div>
        {mes.length === 0
          ? <p className="rp-empty">{t('reseauPro.substitution.noSubs')}</p>
          : mes.map(s => (
            <div key={s._id} className={`rp-mes-card ${s.statut}`}>
              <div className="rp-mes-header">
                <span className="rp-mes-title">
                  {s.statut === 'acceptee' ? `Remplacé par Mᵉ ${fullName(s.accepteePar)}` : s.tribunal}
                </span>
                <span className={`rp-statut-badge rp-statut-${s.statut}`}>
                  {s.statut === 'acceptee' ? 'ACCEPTÉE' : s.statut === 'en_attente' ? 'EN ATTENTE' : 'RETIRÉE'}
                </span>
              </div>
              <p className="rp-mes-desc">
                {s.tribunal} · {NATURES.find(n=>n.value===s.nature)?.label} · {fmtDateTime(s.dateAudience)}
              </p>
              {s.procurationUrl && <span className="rp-proc-badge">📎 Procuration jointe</span>}
              {s.statut === 'en_attente' && (
                <div className="rp-mes-footer">
                  <button className="rp-btn-sm rp-btn-danger" onClick={() => handleRetirer(s._id)}>{t('reseauPro.substitution.withdraw')}</button>
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* ── Feed ── */}
      <div className="rp-feed-section">
        <div className="rp-feed-title">
          {t('reseauPro.substitution.feedTitle')}
          {urgentes.length > 0 && (
            <span className="rp-urgent-badge">🚨 {urgentes.length} {t('reseauPro.substitution.urgent')}</span>
          )}
        </div>
        {[...urgentes, ...normales].map(s => {
          const av = s.avocatId;
          const dp = DISPO_LABELS[av?.disponibilite || 'disponible'];
          return (
            <div key={s._id} className={`rp-feed-card ${s.urgente ? 'rp-urgent' : ''}`}>
              {s.urgente && (
                <div className="rp-urgente-ribbon">🚨 {t('reseauPro.substitution.urgent')} — {fmtDateTime(s.dateAudience)}</div>
              )}
              <div className="rp-feed-card-header">
                <div className="rp-feed-av">
                  <div className="rp-av-avatar">{initials(av)}</div>
                  <div className="rp-feed-av-info">
                    <div className="rp-av-name">Mᵉ {fullName(av)}</div>
                    <p className="rp-feed-desc">{s.tribunal} · {NATURES.find(n=>n.value===s.nature)?.label}</p>
                  </div>
                </div>
                <div className="rp-feed-meta">
                  <span className={`rp-dispo-pill ${dp.cls}`}>● {dp.label}</span>
                  <span className="rp-feed-time">{timeAgo(s.createdAt)}</span>
                </div>
              </div>
              {s.contexte && <p className="rp-sub-contexte">"{s.contexte}"</p>}
              <div className="rp-tags">
                <span className="rp-tag">📅 {fmtDateTime(s.dateAudience)}</span>
                {av?.officeLocation?.gouvernorat && <span className="rp-tag">📍 {av.officeLocation.gouvernorat}</span>}
                {s.procurationUrl && <span className="rp-tag">📎 Procuration</span>}
              </div>
              <div className="rp-feed-actions">
                <button className="rp-btn-dark" onClick={() => handleAccepter(s._id)}>✓ {t('reseauPro.substitution.accept')}</button>
                <button className="rp-btn-ghost" onClick={() => handleIgnorer(s._id)}>{t('reseauPro.substitution.ignore')}</button>
              </div>
            </div>
          );
        })}
        {urgentes.length === 0 && normales.length === 0 && (
          <p className="rp-empty">{t('reseauPro.substitution.noFeed')}</p>
        )}
      </div>
    </div>
  );
}
