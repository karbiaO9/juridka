import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './LawyerCalendar.css';

/* ─────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────── */
const STATUS = {
  confirmé:   { label: 'Confirmé',   color: '#22c55e', bg: 'rgba(34,197,94,0.13)',   border: '#22c55e40' },
  en_attente: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  border: '#f59e0b40' },
  payé:       { label: 'Payé',       color: '#b8912a', bg: 'rgba(184,145,42,0.14)',  border: '#b8912a40' },
  refusé:     { label: 'Refusé',     color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: '#ef444430' },
  annulé:     { label: 'Annulé',     color: '#9ca3af', bg: 'rgba(156,163,175,0.10)', border: '#9ca3af30' },
};

const DAYS_FR   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const HOURS   = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 → 20:00
const EN_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; // API uses English abbr

/* ─── helpers ─── */
function dayIdx(date)     { return (date.getDay() + 6) % 7; }
function toKey(d)         { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function isSameDay(a, b)  {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
function getMonthGrid(year, month) {
  const first  = new Date(year, month, 1);
  const offset = dayIdx(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return { date: d, inMonth: d.getMonth() === month };
  });
}
function getWeekDays(ref) {
  const mon = new Date(ref);
  mon.setDate(ref.getDate() - dayIdx(ref));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
  });
}

/* ─────────────────────────────────────────────────────
   COMPONENT
   Props:
     appointments  – array from rendezVousAPI
     workingHours  – array [{day:"Mon", time:"09:00", _id, id}, ...]
     user          – current user
───────────────────────────────────────────────────── */
export default function LawyerCalendar({ appointments = [], workingHours = [], user }) {
  const today = new Date();

  const [view,    setView]    = useState('month');
  const [current, setCurrent] = useState(new Date(today));
  const [modal,   setModal]   = useState(null);

  /* ── index appointments by day-key ── */
  const byDay = useMemo(() => {
    const map = {};
    (appointments || []).forEach(apt => {
      if (!apt.date) return;
      const k = toKey(new Date(apt.date));
      (map[k] = map[k] || []).push(apt);
    });
    return map;
  }, [appointments]);

  /* ── working hours indexed by English day abbreviation ── */
  const whByDay = useMemo(() => {
    const map = {};
    (Array.isArray(workingHours) ? workingHours : []).forEach(wh => {
      (map[wh.day] = map[wh.day] || []).push(wh.time);
    });
    return map;
  }, [workingHours]);

  /* ── navigation ── */
  const nav = dir => {
    const d = new Date(current);
    if (view === 'month')     d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else                      d.setDate(d.getDate() + dir);
    setCurrent(d);
  };

  /* ── header label ── */
  const headerLabel = () => {
    if (view === 'month')
      return `${MONTHS_FR[current.getMonth()]} ${current.getFullYear()}`;
    if (view === 'week') {
      const [a, b] = [getWeekDays(current)[0], getWeekDays(current)[6]];
      return a.getMonth() === b.getMonth()
        ? `${a.getDate()} – ${b.getDate()} ${MONTHS_FR[a.getMonth()]} ${a.getFullYear()}`
        : `${a.getDate()} ${MONTHS_FR[a.getMonth()]} – ${b.getDate()} ${MONTHS_FR[b.getMonth()]} ${a.getFullYear()}`;
    }
    return `${DAYS_FR[dayIdx(current)]} ${current.getDate()} ${MONTHS_FR[current.getMonth()]} ${current.getFullYear()}`;
  };

  /* ── helpers ── */
  const sc      = apt => STATUS[apt?.statut] || STATUS.annulé;
  const aptName = apt => apt?.clientId?.fullName || apt?.clientId?.nom || apt?.clientNom || 'Client';
  const aptTime = apt => apt?.heure || '–';
  const isWH    = (date, hour) =>
    (whByDay[EN_DAYS[date.getDay()]] || []).some(t => parseInt(t.split(':')[0]) === hour);

  /* ── mini stats ── */
  const todayCount   = (byDay[toKey(today)] || []).length;
  const pendingCount = appointments.filter(a => a.statut === 'en_attente').length;
  const monthCount   = useMemo(() => {
    const y = current.getFullYear(), m = current.getMonth();
    return Object.keys(byDay).reduce((acc, k) => {
      const [ky, km] = k.split('-').map(Number);
      return ky === y && km === m ? acc + byDay[k].length : acc;
    }, 0);
  }, [byDay, current]);

  /* ════════════════════════════════════════════════
     EVENT CHIP
  ════════════════════════════════════════════════ */
  const Chip = ({ apt, small }) => {
    const s = sc(apt);
    return (
      <button
        className={`lc-chip${small ? ' lc-chip--sm' : ''}`}
        style={{ background: s.bg, borderColor: s.border, color: s.color }}
        onClick={e => { e.stopPropagation(); setModal(apt); }}
      >
        <span className="lc-chip-dot"  style={{ background: s.color }} />
        <span className="lc-chip-time">{aptTime(apt)}</span>
        {!small && <span className="lc-chip-name">{aptName(apt)}</span>}
      </button>
    );
  };

  /* ════════════════════════════════════════════════
     MONTH VIEW
  ════════════════════════════════════════════════ */
  const MonthView = () => {
    const cells = getMonthGrid(current.getFullYear(), current.getMonth());
    return (
      <div className="lc-month">
        <div className="lc-month-hdr">
          {DAYS_FR.map(d => (
            <div key={d} className="lc-month-hdr-cell">{d}</div>
          ))}
        </div>
        <div className="lc-month-grid">
          {cells.map(({ date, inMonth }, idx) => {
            const isToday = isSameDay(date, today);
            const apts    = byDay[toKey(date)] || [];
            return (
              <div key={idx} className={[
                'lc-cell',
                !inMonth ? 'lc-cell--out'  : '',
                isToday  ? 'lc-cell--today' : '',
              ].join(' ')}>
                <span className={`lc-cell-num${isToday ? ' lc-cell-num--today' : ''}`}>
                  {date.getDate()}
                </span>
                <div className="lc-cell-events">
                  {apts.slice(0, 3).map((a, i) => <Chip key={i} apt={a} small />)}
                  {apts.length > 3 && (
                    <span className="lc-cell-more">+{apts.length - 3} autres</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════
     WEEK VIEW
  ════════════════════════════════════════════════ */
  const WeekView = () => {
    const days = getWeekDays(current);
    return (
      <div className="lc-week">
        {/* column headers */}
        <div className="lc-week-hdr">
          <div className="lc-gutter" />
          {days.map((d, i) => {
            const isToday = isSameDay(d, today);
            return (
              <div key={i} className={`lc-week-hdr-col${isToday ? ' active' : ''}`}>
                <span className="lc-week-hdr-day">{DAYS_FR[i]}</span>
                <span className={`lc-week-hdr-num${isToday ? ' today' : ''}`}>{d.getDate()}</span>
              </div>
            );
          })}
        </div>
        {/* time rows */}
        <div className="lc-week-body">
          {HOURS.map(h => (
            <div key={h} className="lc-week-row">
              <div className="lc-gutter lc-hour-label">{String(h).padStart(2, '0')}:00</div>
              {days.map((d, di) => {
                const apts = (byDay[toKey(d)] || [])
                  .filter(a => parseInt((a.heure || '00').split(':')[0]) === h);
                return (
                  <div key={di} className={`lc-week-cell${isWH(d, h) ? ' lc-week-cell--wh' : ''}`}>
                    {apts.map((a, ai) => <Chip key={ai} apt={a} />)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════
     DAY VIEW
  ════════════════════════════════════════════════ */
  const DayView = () => {
    const isToday = isSameDay(current, today);
    const apts    = byDay[toKey(current)] || [];
    return (
      <div className="lc-day">
        <div className="lc-day-banner">
          <div className={`lc-day-big${isToday ? ' today' : ''}`}>{current.getDate()}</div>
          <div className="lc-day-meta">
            <span className="lc-day-wday">{DAYS_FR[dayIdx(current)]}</span>
            <span className="lc-day-mth">{MONTHS_FR[current.getMonth()]} {current.getFullYear()}</span>
          </div>
          <div className="lc-day-count">{apts.length} rendez-vous</div>
        </div>
        <div className="lc-day-body">
          {HOURS.map(h => {
            const hApts = apts.filter(a => parseInt((a.heure || '00').split(':')[0]) === h);
            return (
              <div key={h} className={`lc-day-row${isWH(current, h) ? ' lc-day-row--wh' : ''}`}>
                <div className="lc-gutter lc-hour-label">{String(h).padStart(2, '0')}:00</div>
                <div className="lc-day-slot">
                  {hApts.map((a, i) => {
                    const s = sc(a);
                    return (
                      <button key={i} className="lc-day-event"
                        style={{ background: s.bg, borderColor: s.border, color: s.color }}
                        onClick={() => setModal(a)}>
                        <span className="lc-chip-dot" style={{ background: s.color }} />
                        <strong>{aptTime(a)}</strong>
                        <span style={{ opacity: 0.45, margin: '0 4px' }}>·</span>
                        <span>{aptName(a)}</span>
                        <span className="lc-day-status-badge"
                          style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════
     DETAIL MODAL
  ════════════════════════════════════════════════ */
  const DetailModal = () => {
    if (!modal) return null;
    const s = sc(modal);
    const dateStr = modal.date
      ? new Date(modal.date).toLocaleDateString('fr-FR',
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '–';

    return createPortal(
      <div className="lc-overlay" onClick={() => setModal(null)}>
        <div className="lc-modal" onClick={e => e.stopPropagation()}>

          <div className="lc-modal-bar" style={{ background: s.color }} />

          <div className="lc-modal-head">
            <div>
              <span className="lc-modal-status-pill"
                style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                <span style={{
                  background: s.color, width: 7, height: 7,
                  borderRadius: '50%', display: 'inline-block', marginRight: 5,
                }} />
                {s.label}
              </span>
              <h3 className="lc-modal-title">Rendez-vous</h3>
            </div>
            <button className="lc-modal-close" onClick={() => setModal(null)}>✕</button>
          </div>

          <div className="lc-modal-body">
            {/* Client */}
            <div className="lc-modal-section">
              <p className="lc-modal-section-lbl">👤 Client</p>
              <div className="lc-modal-client-row">
                <div className="lc-modal-avatar">
                  {modal.clientId?.avatarUrl
                    ? <img src={modal.clientId.avatarUrl} alt="" />
                    : <span>{aptName(modal).charAt(0).toUpperCase()}</span>}
                </div>
                <div>
                  <div className="lc-modal-client-name">{aptName(modal)}</div>
                  <div className="lc-modal-client-email">
                    {modal.clientId?.email || modal.clientEmail || '–'}
                  </div>
                </div>
              </div>
            </div>

            {/* Date & heure */}
            <div className="lc-modal-section">
              <p className="lc-modal-section-lbl">🗓 Date & Heure</p>
              <div className="lc-modal-grid2">
                <div className="lc-modal-field">
                  <span className="lc-modal-field-lbl">Date</span>
                  <span className="lc-modal-field-val">{dateStr}</span>
                </div>
                <div className="lc-modal-field">
                  <span className="lc-modal-field-lbl">Heure</span>
                  <span className="lc-modal-field-val" style={{ color: '#b8912a', fontFamily: 'monospace' }}>
                    {aptTime(modal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Message */}
            {modal.message && (
              <div className="lc-modal-section">
                <p className="lc-modal-section-lbl">💬 Message</p>
                <div className="lc-modal-msg">{modal.message}</div>
              </div>
            )}
          </div>

          <div className="lc-modal-foot">
            <button className="lc-modal-btn" onClick={() => setModal(null)}>Fermer</button>
          </div>

        </div>
      </div>,
      document.body
    );
  };

  /* ════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════ */
  return (
    <>
      <div className="lc-root">

        {/* Top bar */}
        <div className="lc-topbar">
          <button className="lc-nav-btn" onClick={() => nav(-1)}>‹</button>
          <button className="lc-nav-btn" onClick={() => nav(1)}>›</button>
          <button className="lc-today-btn" onClick={() => setCurrent(new Date(today))}>
            Aujourd'hui
          </button>
          <h2 className="lc-cal-title">{headerLabel()}</h2>
          <div className="lc-view-grp">
            {[['month','Mois'], ['week','Semaine'], ['day','Jour']].map(([v, l]) => (
              <button key={v}
                className={`lc-vbtn${view === v ? ' active' : ''}`}
                onClick={() => setView(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="lc-stats">
          {[
            { lbl: "Aujourd'hui", val: todayCount,          color: '#b8912a' },
            { lbl: 'Ce mois',     val: monthCount,          color: '#22c55e' },
            { lbl: 'En attente',  val: pendingCount,        color: '#f59e0b' },
            { lbl: 'Total',       val: appointments.length, color: '#60a5fa' },
          ].map((s, i) => (
            <div key={i} className="lc-stat">
              <span className="lc-stat-lbl">{s.lbl}</span>
              <span className="lc-stat-val" style={{ color: s.color }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Calendar body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {view === 'month' && <MonthView />}
          {view === 'week'  && <WeekView  />}
          {view === 'day'   && <DayView   />}
        </div>

      </div>

      <DetailModal />
    </>
  );
}