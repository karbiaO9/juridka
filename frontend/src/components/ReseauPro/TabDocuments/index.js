import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { reseauProAPI } from '../../../services/api';
import { CATEGORIES_DOC, fmtDate, fullName, formatSize } from '../helpers';
import './TabDocuments.css';

export default function TabDocuments() {
  const { t } = useTranslation();
  const [data, setData]         = useState({ documents:[], recus:[], stats:{} });
  const [form, setForm]         = useState({ categorie:'travail_anonymise', declaration:false });
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef            = useRef(null);

  const load = async () => {
    const d = await reseauProAPI.getMesDocuments().catch(() => ({ documents:[], recus:[], stats:{} }));
    setData(d);
  };
  useEffect(() => { load(); }, []);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 10*1024*1024) return alert(t('reseauPro.documents.dragSub'));
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file)             return alert(t('reseauPro.documents.dragDrop'));
    if (!form.declaration) return alert(t('reseauPro.documents.declarationTitle'));
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('categorie', form.categorie);
      fd.append('declarationSignee', 'true');
      await reseauProAPI.uploadDocument(fd);
      setFile(null);
      setForm(f => ({...f, declaration:false}));
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('reseauPro.documents.delete') + ' ?')) return;
    await reseauProAPI.supprimerDocument(id);
    load();
  };

  const { documents, recus, stats } = data;
  const usedMo  = ((stats.totalSize || 0) / 1024 / 1024).toFixed(1);
  const maxMo   = 50;
  const usedPct = Math.min(100, Math.round(((stats.totalSize || 0) / (maxMo * 1024 * 1024)) * 100));
  const storageClass = usedPct > 85 ? 'danger' : usedPct > 65 ? 'warn' : '';

  const getDocIcon = (cat) => {
    if (cat === 'procuration')       return '📋';
    if (cat === 'convention')        return '🤝';
    if (cat === 'modele')            return '📐';
    if (cat === 'travail_anonymise') return '🔒';
    return '📄';
  };

  return (
    <div className="rp-two-col">
      {/* ── Zone principale ── */}
      <div className="rp-panel">
        <div className="rp-deonto-banner">
          <span className="rp-deonto-icon">🔒</span>
          <div>
            <strong>Secret professionnel (Art. 48 Loi 87-79)</strong>
            <p>Tout document partagé doit être anonymisé ou faire l'objet d'un consentement exprès du client. Ces documents sont visibles uniquement par vous et les confrères à qui vous les partagez explicitement.</p>
          </div>
        </div>

        <div className="rp-panel-title">{t('reseauPro.documents.addTitle')}</div>

        {/* Dropzone */}
        <div
          className={`rp-dropzone ${dragOver?'drag-over':''} ${file?'has-file':''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
            style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <>
              <div className="rp-dropzone-icon">📄</div>
              <p className="rp-dropzone-filename">{file.name}</p>
              <small>{formatSize(file.size)}</small>
            </>
          ) : (
            <>
              <div className="rp-dropzone-icon">📁</div>
              <p className="rp-dropzone-text">{t('reseauPro.documents.dragDrop')}</p>
              <small>{t('reseauPro.documents.dragSub')}</small>
            </>
          )}
        </div>

        <div className="rp-form-group" style={{marginTop:16}}>
          <label>{t('reseauPro.documents.category')}</label>
          <select value={form.categorie} onChange={e => setForm(f=>({...f,categorie:e.target.value}))}>
            {CATEGORIES_DOC.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="rp-declaration">
          <div className="rp-declaration-title">⚠️ {t('reseauPro.documents.declarationTitle')}</div>
          <label className="rp-declaration-label">
            <input type="checkbox" checked={form.declaration}
              onChange={e => setForm(f=>({...f,declaration:e.target.checked}))} />
            <span>{t('reseauPro.documents.declarationText')}</span>
          </label>
        </div>

        <button className="rp-btn-upload" onClick={handleUpload}
          disabled={loading || !form.declaration || !file}>
          {loading ? `⏳ ${t('reseauPro.documents.uploading')}` : `📎 ${t('reseauPro.documents.upload')}`}
        </button>

        {/* Mes documents */}
        <div className="rp-panel-title" style={{marginTop:28}}>
          {t('reseauPro.documents.myDocs')}
          {documents.length > 0 && <span className="rp-count-badge">{documents.length}</span>}
        </div>
        {documents.length === 0
          ? <p className="rp-empty">{t('reseauPro.documents.noDocs')}</p>
          : <div className="rp-docs-grid">
            {documents.map(d => (
              <div key={d._id} className="rp-doc-card">
                <div className="rp-doc-icon">{getDocIcon(d.categorie)}</div>
                <div className="rp-doc-name">{d.fileName}</div>
                <div className="rp-doc-meta">{formatSize(d.fileSize)} · {fmtDate(d.createdAt)}</div>
                <span className={`rp-doc-badge ${d.badge}`}>
                  {d.badge === 'anonymise' ? '🔒 ANONYMISÉ' : '🔐 CONFIDENTIEL'}
                </span>
                <div className="rp-doc-actions">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="rp-btn-sm rp-btn-ghost">{t('reseauPro.documents.open')}</a>
                  <button className="rp-btn-sm rp-btn-danger" onClick={() => handleDelete(d._id)}>{t('reseauPro.documents.delete')}</button>
                </div>
              </div>
            ))}
          </div>
        }

        {/* Documents reçus */}
        {recus.length > 0 && (
          <>
            <div className="rp-panel-title" style={{marginTop:28}}>
              {t('reseauPro.documents.received')}
              <span className="rp-count-badge">{recus.length}</span>
            </div>
            <div className="rp-docs-grid">
              {recus.map(d => (
                <div key={d._id} className="rp-doc-card rp-doc-recu">
                  <div className="rp-doc-icon">📨</div>
                  <div className="rp-doc-name">{d.fileName}</div>
                  <div className="rp-doc-meta">De Mᵉ {fullName(d.avocatId)} · {fmtDate(d.createdAt)}</div>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="rp-btn-sm rp-btn-ghost">
                    {t('reseauPro.documents.open')}
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="rp-side-panel">
        <div className="rp-panel-title">{t('reseauPro.documents.storage')}</div>

        <div className="rp-storage-block">
          <div className="rp-storage-header">
            <span>{t('reseauPro.documents.used')}</span>
            <strong>{usedMo} / {maxMo} Mo</strong>
          </div>
          <div className="rp-storage-bar-wrap">
            <div className={`rp-storage-fill ${storageClass}`} style={{width:`${usedPct}%`}} />
          </div>
          <div className="rp-storage-pct">{usedPct}%</div>
        </div>

        <div className="rp-stats-list">
          <div className="rp-stat-row">
            <span>{t('reseauPro.documents.docsCount')}</span>
            <strong>{stats.stockes || 0}</strong>
          </div>
          <div className="rp-stat-row">
            <span>{t('reseauPro.documents.receivedCount')}</span>
            <strong>{stats.recusCount || 0}</strong>
          </div>
          <div className="rp-stat-row">
            <span>{t('reseauPro.documents.quota')}</span>
            <strong>{(maxMo - parseFloat(usedMo)).toFixed(1)} Mo</strong>
          </div>
        </div>

        {usedPct > 65 && (
          <div className={`rp-storage-alert ${usedPct > 85 ? 'danger' : 'warn'}`}>
            {usedPct > 85 ? `⚠️ ${t('reseauPro.documents.quotaDanger')}` : `💡 ${t('reseauPro.documents.quotaWarn')}`}
          </div>
        )}
      </div>
    </div>
  );
}
