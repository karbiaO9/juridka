import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reseauProAPI } from '../../../services/api';
import { DISPO_LABELS, initials, fullName } from '../helpers';
import './TabAnnuaire.css';

export default function TabAnnuaire({ user, onOpenMessage }) {
  const { t } = useTranslation();

  const FILTRES = [
    { key:'tous',        label: t('reseauPro.annuaire.all') },
    { key:'disponibles', label: `🟢 ${t('reseauPro.annuaire.available')}` },
    { key:'Tunis',       label: '📍 Tunis' },
    { key:'Sousse',      label: '📍 Sousse' },
    { key:'Sfax',        label: '📍 Sfax' },
    { key:'FR/EN',       label: '🌐 FR/EN' },
  ];

  const [avocats, setAvocats]     = useState([]);
  const [q, setQ]                 = useState('');
  const [filtre, setFiltre]       = useState('tous');
  const [convModal, setConvModal] = useState(null);
  const [convObjet, setConvObjet] = useState('');
  const [convLoading, setConvLoading] = useState(false);

  const load = async () => {
    const params = {};
    if (filtre === 'disponibles') params.disponibilite = 'disponible';
    if (['Tunis','Sousse','Sfax'].includes(filtre)) params.ville = filtre;
    if (filtre === 'FR/EN') params.langue = 'EN';
    const d = await reseauProAPI.getAnnuaire(params).catch(() => ({ avocats:[] }));
    setAvocats(d.avocats || []);
  };
  useEffect(() => { load(); }, [filtre]);

  const handleConvention = async () => {
    if (!convObjet.trim()) return alert(t('reseauPro.annuaire.conventionObject'));
    setConvLoading(true);
    try {
      await reseauProAPI.creerConvention({ avocat2Id: convModal.avocat2Id, objet: convObjet });
      alert(`${t('reseauPro.annuaire.conventionTitle')} Mᵉ ${convModal.nom}`);
      setConvModal(null); setConvObjet('');
    } catch (e) { alert(e.message); }
    finally { setConvLoading(false); }
  };

  const filtered = avocats.filter(av => {
    if (!q) return true;
    const n = fullName(av).toLowerCase();
    const s = (av.specialties || []).join(' ').toLowerCase();
    const v = (av.officeLocation?.gouvernorat || '').toLowerCase();
    return n.includes(q.toLowerCase()) || s.includes(q.toLowerCase()) || v.includes(q.toLowerCase());
  });

  const getDispoColor = (dispo) => {
    if (dispo === 'disponible')  return 'green';
    if (dispo === 'en_audience') return 'orange';
    return 'red';
  };

  return (
    <div className="rp-annuaire-wrap">
      {/* ── Barre recherche + filtres ── */}
      <div className="rp-annuaire-topbar">
        <div className="rp-annuaire-search-wrap">
          <span className="rp-search-icon">🔍</span>
          <input
            className="rp-search"
            placeholder={t('reseauPro.annuaire.search')}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && <button className="rp-search-clear" onClick={() => setQ('')}>✕</button>}
        </div>
        <div className="rp-filtres">
          {FILTRES.map(f => (
            <button
              key={f.key}
              className={`rp-filtre ${filtre === f.key ? 'active' : ''}`}
              onClick={() => setFiltre(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rp-annuaire-count">
        {filtered.length} {t('reseauPro.annuaire.results')}
        {q && <span> pour « {q} »</span>}
      </div>

      {/* ── Grille ── */}
      {filtered.length === 0
        ? (
          <div className="rp-empty-state">
            <div className="rp-empty-icon">🔍</div>
            <p>{t('reseauPro.annuaire.noResults')}</p>
            {q && <button className="rp-btn-ghost rp-btn-sm" onClick={() => setQ('')}>{t('reseauPro.annuaire.clearSearch')}</button>}
          </div>
        )
        : (
          <div className="rp-annuaire-grid">
            {filtered.map(av => {
              const dp = DISPO_LABELS[av.disponibilite || 'disponible'];
              const color = getDispoColor(av.disponibilite);
              return (
                <div key={av._id} className="rp-av-card">
                  <div className="rp-av-card-top">
                    <div className="rp-av-card-avatar">
                      {av.photo?.enhanced || av.photo?.original
                        ? <img src={av.photo.enhanced || av.photo.original} alt={fullName(av)} />
                        : initials(av)
                      }
                    </div>
                    <div className="rp-av-card-identity">
                      <div className="rp-av-card-name">Mᵉ {fullName(av)}</div>
                      {av.officeLocation?.gouvernorat && (
                        <div className="rp-av-card-city">📍 {av.officeLocation.gouvernorat}</div>
                      )}
                    </div>
                    <span className={`rp-av-dispo-dot ${color}`} title={dp.label} />
                  </div>

                  {(av.specialties || []).length > 0 && (
                    <div className="rp-av-card-specs">
                      {(av.specialties || []).slice(0,2).map(s => (
                        <span key={s} className="rp-spec-tag">{s}</span>
                      ))}
                      {(av.specialties || []).length > 2 && (
                        <span className="rp-spec-more">+{(av.specialties).length - 2}</span>
                      )}
                    </div>
                  )}

                  <div className="rp-av-card-footer">
                    <div className="rp-av-card-langs">
                      {(av.spokenLanguages || []).map(l => (
                        <span key={l} className="rp-lang-tag">{l}</span>
                      ))}
                    </div>
                    <span className={`rp-dispo-pill ${dp.cls}`}>● {dp.label}</span>
                  </div>

                  <div className="rp-av-card-actions">
                    <button
                      className="rp-btn-ghost rp-btn-sm"
                      onClick={() => onOpenMessage?.(av._id, av)}
                    >
                      💬 {t('reseauPro.annuaire.message')}
                    </button>
                    {av.disponibilite !== 'indisponible' && (
                      <button
                        className="rp-btn-gold rp-btn-sm"
                        onClick={() => setConvModal({ avocat2Id: av._id, nom: fullName(av) })}
                      >
                        🤝 {t('reseauPro.annuaire.convention')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {/* ── Modal convention ── */}
      {convModal && (
        <div className="rp-modal-overlay" onClick={() => setConvModal(null)}>
          <div className="rp-modal" onClick={e => e.stopPropagation()}>
            <div className="rp-modal-icon">🤝</div>
            <h3>{t('reseauPro.annuaire.conventionTitle')} Mᵉ {convModal.nom}</h3>
            <p className="rp-modal-sub">{t('reseauPro.annuaire.conventionSub')}</p>
            <div className="rp-form-group">
              <label>{t('reseauPro.annuaire.conventionObject')}</label>
              <input
                className="rp-modal-input"
                placeholder="Ex : Délégation dossier fiscal PME, co-traitement affaire commerciale..."
                value={convObjet}
                onChange={e => setConvObjet(e.target.value)}
              />
            </div>
            <div className="rp-modal-actions">
              <button className="rp-btn-ghost" onClick={() => { setConvModal(null); setConvObjet(''); }}>
                {t('reseauPro.delegation.cancel')}
              </button>
              <button className="rp-btn-gold" onClick={handleConvention} disabled={convLoading}>
                {convLoading ? '⏳' : `✉️ ${t('reseauPro.annuaire.conventionProposeBtn')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
