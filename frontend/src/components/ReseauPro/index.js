import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { reseauProAPI } from '../../services/api';
import { DISPO_LABELS } from './helpers';
import TabDelegation   from './TabDelegation';
import TabSubstitution from './TabSubstitution';
import TabDocuments    from './TabDocuments';
import TabAnnuaire     from './TabAnnuaire';
import './ReseauPro.css';

export default function ReseauPro({ onOpenMessage }) {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [tab, setTab]           = useState('delegation');
  const [nbSubUrgente, setNbSubUrgente] = useState(0);

  const TABS = [
    { key:'delegation',   label: t('reseauPro.tabs.delegation'),   icon:'📋' },
    { key:'substitution', label: t('reseauPro.tabs.substitution'), icon:'⚖️', badge: nbSubUrgente },
    { key:'documents',    label: t('reseauPro.tabs.documents'),    icon:'📎' },
    { key:'annuaire',     label: t('reseauPro.tabs.annuaire'),     icon:'🔍' },
  ];

  const myDispo = user?.disponibilite || 'disponible';

  const handleChangeDispo = async (val) => {
    try {
      await reseauProAPI.updateDispo(val);
      updateUser({ ...user, disponibilite: val });
    } catch {}
  };

  return (
    <div className="rp-root">

      {/* ── Statut dispo ── */}
      <div className="rp-dispo-bar">
        <span className="rp-dispo-label">{t('reseauPro.myStatus')}</span>
        <div className="rp-dispo-btns">
          {Object.entries(DISPO_LABELS).map(([val, { label, cls }]) => (
            <button
              key={val}
              type="button"
              className={`rp-dispo-btn ${cls} ${myDispo === val ? 'active' : ''}`}
              onClick={() => handleChangeDispo(val)}
            >
              <span className="rp-dispo-dot" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Navigation onglets ── */}
      <div className="rp-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`rp-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="rp-tab-icon">{t.icon}</span>
            {t.label}
            {t.badge > 0 && <span className="rp-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Contenu ── */}
      <div className="rp-content">
        {tab === 'delegation'   && <TabDelegation   user={user} onOpenMessage={onOpenMessage} />}
        {tab === 'substitution' && <TabSubstitution user={user} onUrgentCount={setNbSubUrgente} />}
        {tab === 'documents'    && <TabDocuments />}
        {tab === 'annuaire'     && <TabAnnuaire     user={user} onOpenMessage={onOpenMessage} />}
      </div>
    </div>
  );
}
