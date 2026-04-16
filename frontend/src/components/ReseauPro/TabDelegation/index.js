import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reseauProAPI } from '../../../services/api';
import { SPECIALITES, GOUVERNORATS, DELAIS, LANGUES_OPTIONS, DISPO_LABELS, timeAgo, initials, fullName } from '../helpers';
import './TabDelegation.css';

export default function TabDelegation({ user, onOpenMessage }) {
  const { t } = useTranslation();
  const [feed, setFeed]             = useState([]);
  const [mes, setMes]               = useState([]);
  const [form, setForm]             = useState({ specialite:'', gouvernorat:'', description:'', delai:'flexible', langues:[] });
  const [loading, setLoading]       = useState(false);
  const [repondreId, setRepondreId] = useState(null);
  const [reponseMsg, setReponseMsg] = useState('');
  const [voirRepId, setVoirRepId]   = useState(null);
  const [showForm, setShowForm]     = useState(false);

  const load = async () => {
    const [f, m] = await Promise.all([
      reseauProAPI.getDelegations().catch(() => ({ delegations:[] })),
      reseauProAPI.getMesDelegations().catch(() => ({ delegations:[] })),
    ]);
    setFeed(f.delegations || []);
    setMes(m.delegations  || []);
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (statut) => {
    if (!form.specialite || !form.gouvernorat || !form.description)
      return alert(t('avocatDashboard.notProvided'));
    setLoading(true);
    try {
      await reseauProAPI.createDelegation({ ...form, statut });
      setForm({ specialite:'', gouvernorat:'', description:'', delai:'flexible', langues:[] });
      setShowForm(false);
      load();
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleRetirer = async (id) => {
    if (!window.confirm(t('reseauPro.delegation.withdraw') + ' ?')) return;
    await reseauProAPI.updateDelegation(id, { statut:'retiree' });
    load();
  };

  const handleRepondre = async (id) => {
    if (!reponseMsg.trim()) return alert(t('reseauPro.delegation.send'));
    await reseauProAPI.repondreDelegation(id, reponseMsg);
    setRepondreId(null); setReponseMsg('');
    load();
  };

  const handleSauvegarder = async (id) => {
    await reseauProAPI.sauvegarder(id);
    load();
  };

  const toggleLangue = (l) => setForm(f => ({
    ...f,
    langues: f.langues.includes(l) ? f.langues.filter(x => x !== l) : [...f.langues, l],
  }));

  const mesActives = mes.filter(d => d.statut !== 'retiree');

  return (
    <div className="rp-deleg-layout">

      {/* ── Barre de tête ── */}
      <div className="rp-deleg-topbar">
        <div className="rp-deleg-stats">
          <div className="rp-deleg-stat">
            <span className="rp-deleg-stat-num">{feed.length}</span>
            <span className="rp-deleg-stat-label">demande{feed.length !== 1 ? 's' : ''} réseau</span>
          </div>
          <div className="rp-deleg-stat-sep" />
          <div className="rp-deleg-stat">
            <span className="rp-deleg-stat-num">{mesActives.length}</span>
            <span className="rp-deleg-stat-label">mes demande{mesActives.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button className="rp-btn-gold rp-deleg-publish-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Fermer' : '＋ ' + t('reseauPro.delegation.publish')}
        </button>
      </div>

      {/* ── Formulaire (inline, collapsible) ── */}
      {showForm && (
        <div className="rp-deleg-form-wrap rp-panel">
          <div className="rp-panel-title">{t('reseauPro.delegation.postTitle')}</div>
          <div className="rp-form-grid">
            <div className="rp-form-group">
              <label>{t('reseauPro.delegation.specialite')}</label>
              <select value={form.specialite} onChange={e => setForm(f=>({...f, specialite:e.target.value}))}>
                <option value="">— — —</option>
                {SPECIALITES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="rp-form-group">
              <label>{t('reseauPro.delegation.gouvernorat')}</label>
              <select value={form.gouvernorat} onChange={e => setForm(f=>({...f, gouvernorat:e.target.value}))}>
                <option value="">— — —</option>
                {GOUVERNORATS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="rp-deleg-form-bottom">
            <div className="rp-form-group rp-deleg-desc-group">
              <label>{t('reseauPro.delegation.description')} <span className="rp-hint">— {t('reseauPro.delegation.descHint')}</span></label>
              <textarea value={form.description} onChange={e => setForm(f=>({...f, description:e.target.value}))} rows={3} />
            </div>
            <div className="rp-deleg-form-right">
              <div className="rp-form-group">
                <label>{t('reseauPro.delegation.delai')}</label>
                <select value={form.delai} onChange={e => setForm(f=>({...f, delai:e.target.value}))}>
                  {DELAIS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="rp-form-group">
                <label>{t('reseauPro.delegation.langues')}</label>
                <div className="rp-langues">
                  {LANGUES_OPTIONS.map(l => (
                    <button key={l} type="button" className={`rp-lang-btn ${form.langues.includes(l)?'active':''}`} onClick={() => toggleLangue(l)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="rp-form-actions">
            <button className="rp-btn-ghost" onClick={() => handleSubmit('brouillon')} disabled={loading}>{t('reseauPro.delegation.draft')}</button>
            <button className="rp-btn-gold"  onClick={() => handleSubmit('en_attente')} disabled={loading}>
              {loading ? '⏳' : t('reseauPro.delegation.publish')}
            </button>
          </div>
        </div>
      )}

      {/* ── Mes demandes (strip horizontal) ── */}
      {mesActives.length > 0 && (
        <div className="rp-deleg-mes-strip">
          <div className="rp-deleg-mes-strip-title">{t('reseauPro.delegation.myDemands')}</div>
          <div className="rp-deleg-mes-scroll">
            {mesActives.map(d => (
              <div key={d._id} className={`rp-deleg-mes-chip ${d.statut}`}>
                <div className="rp-deleg-mes-chip-top">
                  <span className="rp-deleg-mes-chip-title">{d.specialite}</span>
                  <span className={`rp-statut-badge rp-statut-${d.statut}`}>
                    {d.statut === 'en_attente' ? 'EN ATTENTE' : d.statut === 'active' ? '✓ ACTIVE' : d.statut.toUpperCase()}
                  </span>
                </div>
                <p className="rp-deleg-mes-chip-loc">📍 {d.gouvernorat}</p>
                <p className="rp-deleg-mes-chip-desc">{d.description}</p>
                <div className="rp-deleg-mes-chip-footer">
                  {d.reponses?.length > 0 && (
                    <button className="rp-btn-sm" onClick={() => setVoirRepId(voirRepId===d._id?null:d._id)}>
                      💬 {d.reponses.length} {voirRepId===d._id ? '▲' : '▼'}
                    </button>
                  )}
                  <button className="rp-btn-sm rp-btn-danger" onClick={() => handleRetirer(d._id)}>{t('reseauPro.delegation.withdraw')}</button>
                </div>
                {d.conventionId && (
                  <div className="rp-convention-badge" style={{ marginTop: 8 }}>
                    Convention · Mᵉ {fullName(d.conventionId?.avocat2Id)}
                    <span className="rp-active-badge">✓</span>
                  </div>
                )}
                {voirRepId === d._id && (
                  <ul className="rp-chip-replies">
                    {d.reponses.map((r, i) => (
                      <li key={i} className="rp-chip-reply-row">
                        <div className="rp-chip-reply-left">
                          <span className="rp-chip-reply-name">Mᵉ {fullName(r.avocatId)}</span>
                          {r.message && <span className="rp-chip-reply-msg">"{r.message}"</span>}
                          <span className="rp-chip-reply-time">{timeAgo(r.createdAt)}</span>
                        </div>
                        <button className="rp-chip-reply-btn" title="Contacter"
                          onClick={() => onOpenMessage?.(r.avocatId?._id || r.avocatId, r.avocatId)}>
                          Contacter
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Feed réseau (grille 2 colonnes) ── */}
      <div className="rp-deleg-feed-title">
        {t('reseauPro.delegation.feedTitle')}
        <span className="rp-count-badge">{feed.length} demande{feed.length !== 1 ? 's' : ''}</span>
      </div>

      {feed.length === 0
        ? <p className="rp-empty">{t('reseauPro.delegation.noFeed')}</p>
        : (
          <div className="rp-deleg-grid">
            {feed.map(d => {
              const av = d.avocatId;
              const dp = DISPO_LABELS[av?.disponibilite || 'disponible'];
              return (
                <div key={d._id} className="rp-feed-card">
                  <div className="rp-feed-card-header">
                    <div className="rp-feed-av">
                      <div className="rp-av-avatar">{initials(av)}</div>
                      <div className="rp-feed-av-info">
                        <div className="rp-av-name">Mᵉ {fullName(av)}</div>
                        <p className="rp-feed-desc">{d.description}</p>
                      </div>
                    </div>
                    <div className="rp-feed-meta">
                      <span className={`rp-dispo-pill ${dp.cls}`}>● {dp.label}</span>
                      <span className="rp-feed-time">{timeAgo(d.createdAt)} · {av?.officeLocation?.gouvernorat || ''}</span>
                    </div>
                  </div>
                  <div className="rp-tags">
                    <span className="rp-tag">{d.specialite}</span>
                    {d.gouvernorat && <span className="rp-tag">📍 {d.gouvernorat}</span>}
                    {d.langues?.map(l => <span key={l} className="rp-tag-lang">{l}</span>)}
                    <span className="rp-tag">{DELAIS.find(x=>x.value===d.delai)?.label || d.delai}</span>
                  </div>
                  <div className="rp-feed-actions">
                    {!d.hasResponded ? (
                      repondreId === d._id ? (
                        <div className="rp-reponse-form">
                          <input placeholder="Votre message (optionnel)..." value={reponseMsg} onChange={e => setReponseMsg(e.target.value)} />
                          <button className="rp-btn-gold rp-btn-sm" onClick={() => handleRepondre(d._id)}>{t('reseauPro.delegation.send')}</button>
                          <button className="rp-btn-ghost rp-btn-sm" onClick={() => setRepondreId(null)}>{t('reseauPro.delegation.cancel')}</button>
                        </div>
                      ) : (
                        <button className="rp-btn-dark" onClick={() => onOpenMessage?.(d.avocatId?._id || d.avocatId, d.avocatId)}>✍️ {t('reseauPro.delegation.reply')}</button>
                      )
                    ) : (
                      <span className="rp-responded-badge">✓ {t('reseauPro.delegation.replySent')}</span>
                    )}
                    <button className={`rp-btn-ghost ${d.saved?'rp-saved':''}`} onClick={() => handleSauvegarder(d._id)}>
                      {d.saved ? `📌 ${t('reseauPro.delegation.saved')}` : `🔖 ${t('reseauPro.delegation.save')}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
