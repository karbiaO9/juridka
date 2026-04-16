import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { messagerieAPI } from '../../services/api';
import DeleteConvModal from '../DeleteConvModal';
import './MessageriePro.css';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const dedup = arr => [...new Map(arr.map(c => [String(c._id), c])).values()];

function initials(av) {
  if (!av) return '?';
  const f = av.firstName?.[0] || '';
  const l = av.lastName?.[0]  || '';
  return (f + l).toUpperCase() || '?';
}
function fullName(av) {
  if (!av) return '';
  return av.fullName || `${av.firstName || ''} ${av.lastName || ''}`.trim();
}
function fmtTime(d) {
  if (!d) return '';
  const date = new Date(d);
  const now  = new Date();
  const diff = now - date;
  if (diff < 60000)        return 'À l\'instant';
  if (diff < 3600000)      return `${Math.floor(diff/60000)} min`;
  if (diff < 86400000)     return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function MessageriePro({ openWithAvocatId = null, openWithAvocatInfo = null, onUnreadChange }) {
  const { user, token } = useAuth();
  const { t }           = useTranslation();
  const [socket,        setSocket]        = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConv,    setActiveConv]    = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState('');
  const [file,          setFile]          = useState(null);
  const [sending,       setSending]       = useState(false);
  const [typing,        setTyping]        = useState(false);   // l'autre écrit
  const [onlineIds,     setOnlineIds]     = useState(new Set());
  const [loadingConvs,  setLoadingConvs]  = useState(true);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [search,        setSearch]        = useState('');
  const [showNewModal,  setShowNewModal]  = useState(false);
  const [newSearch,     setNewSearch]     = useState('');
  const [newResults,    setNewResults]    = useState([]);
  const [newSearching,  setNewSearching]  = useState(false);
  const [deleteModal,   setDeleteModal]   = useState({ open: false, conv: null });

  const bottomRef   = useRef(null);
  const fileRef     = useRef(null);
  const typingTimer = useRef(null);
  const socketRef   = useRef(null);
  // Ref pour toujours avoir la conv active à jour dans les handlers socket
  // (le useEffect du socket ne dépend que de [token], donc activeConv y est stale)
  const activeConvRef = useRef(null);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  // ── Connexion Socket.io ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    // Ordre des transports : on commence par HTTP polling (qui passe partout)
    // puis on upgrade vers WebSocket si possible. C'est le comportement par
    // défaut de Socket.io et le plus fiable derrière les proxies d'opérateurs
    // mobiles, les CDN et Safari iOS.
    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      s.emit('join_conversations');
      // À la (re)connexion, on rejoint la conv active et on re-fetch ses
      // messages pour rattraper ceux éventuellement émis pendant qu'on était
      // déconnecté.
      const active = activeConvRef.current;
      if (active?._id) {
        s.emit('join_conversation', active._id);
        messagerieAPI.getMessages(active._id)
          .then(d => setMessages(d.messages || []))
          .catch(() => {});
      }
      // Rafraîchir aussi la liste des conversations pour les badges/last message
      messagerieAPI.getConversations()
        .then(d => setConversations(dedup(d.conversations || [])))
        .catch(() => {});
    });

    s.on('connect_error', (err) => {
      console.warn('[Messagerie] socket connect_error:', err.message);
    });

    s.on('reconnect', () => {
      console.info('[Messagerie] socket reconnected');
    });

    s.on('avocat_online',  id => setOnlineIds(prev => new Set([...prev, id])));
    s.on('avocat_offline', id => setOnlineIds(prev => { const n = new Set(prev); n.delete(id); return n; }));

    s.on('new_message', (msg) => {
      const currentActive = activeConvRef.current;
      const isForActiveConv = currentActive && String(currentActive._id) === String(msg.conversationId);

      if (isForActiveConv) {
        setMessages(prev => {
          // 1. Remplacer le message optimiste par le vrai si tempId correspond
          if (msg.tempId) {
            const hasOptimistic = prev.find(m => m._id === msg.tempId || m.tempId === msg.tempId);
            if (hasOptimistic) {
              // On strip le tempId du message confirmé pour que le polling ne le traite plus comme optimiste
              const { tempId: _t, ...cleanMsg } = msg;
              return prev.map(m => (m._id === msg.tempId || m.tempId === msg.tempId) ? cleanMsg : m);
            }
          }
          // 2. Éviter les vrais doublons par _id (message déjà dans l'état)
          if (prev.find(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        socketRef.current?.emit('mark_read', { conversationId: msg.conversationId });
      }

      // Mettre à jour lastMessage + badge non-lus dans la liste (toujours)
      setConversations(prev => prev.map(c => {
        if (c._id !== msg.conversationId) return c;
        const isMe = String(msg.sender?._id) === String(user?._id);
        return {
          ...c,
          lastMessage: {
            content:   msg.content,
            senderId:  msg.sender?._id,
            createdAt: msg.createdAt,
            hasFile:   !!msg.fileUrl,
          },
          unreadCount: isForActiveConv || isMe ? 0 : (c.unreadCount || 0) + 1,
        };
      }));
    });

    s.on('conversation_updated', ({ conversationId, lastMessage, unreadCount, conversation }) => {
      setConversations(prev => {
        const exists = prev.some(c => c._id === conversationId);
        if (exists) {
          return prev.map(c => c._id === conversationId ? { ...c, lastMessage, unreadCount } : c);
        }
        // Nouvelle conversation (premier message reçu) — on l'ajoute en tête de liste
        return conversation ? [conversation, ...prev] : prev;
      });
      onUnreadChange?.();
    });

    s.on('user_typing', ({ avocatId, isTyping }) => {
      if (avocatId !== String(user?._id)) setTyping(isTyping);
    });

    s.on('messages_read', ({ conversationId }) => {
      if (activeConvRef.current?._id === conversationId) {
        setMessages(prev => prev.map(m => ({ ...m, readBy: [...(m.readBy || []), 'other'] })));
      }
    });

    return () => { s.disconnect(); };
  }, [token]);

  // ── Charger conversations ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingConvs(true);
    messagerieAPI.getConversations()
      .then(d => { if (!cancelled) setConversations(dedup(d.conversations || [])); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingConvs(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Ouvrir automatiquement avec un avocat (venant du Réseau Pro) ─────────
  // Création paresseuse : on ne crée la conv en DB qu'au premier message envoyé.
  useEffect(() => {
    if (!openWithAvocatId) return;
    // 1. Chercher une conversation existante dans la liste déjà chargée
    setConversations(prev => {
      const existing = prev.find(c =>
        c.participants?.some(p => String(p._id || p) === String(openWithAvocatId))
      );
      if (existing) {
        openConversation(existing);
      } else {
        // 2. Pas de conv existante → montrer l'interface de composition sans créer en DB
        const pendingOther = openWithAvocatInfo || { _id: openWithAvocatId };
        setActiveConv({ _id: null, other: pendingOther, participants: [], unreadCount: 0 });
        setMessages([]);
      }
      return prev;
    });
  }, [openWithAvocatId, openWithAvocatInfo]);

  // ── Scroller en bas ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Filet de sécurité : polling des messages de la conv active ──────────
  // Même si le socket.io fonctionne, on re-synchronise toutes les 5 secondes
  // pour rattraper les événements éventuellement perdus (proxies, iOS qui
  // suspend la connexion en arrière-plan, réseau instable). C'est ce qui
  // garantit que les nouveaux messages apparaissent sans avoir à rafraîchir.
  useEffect(() => {
    if (!activeConv?._id) return;
    const convId = activeConv._id;
    let cancelled = false;

    const refreshMessages = async () => {
      try {
        const d = await messagerieAPI.getMessages(convId);
        if (cancelled) return;
        // Ne remplacer que si la conv active n'a pas changé entre-temps
        if (activeConvRef.current?._id !== convId) return;
        setMessages(prev => {
          const incoming = d.messages || [];
          // Préserver uniquement les messages optimistes pas encore confirmés par le serveur
          // (ni par tempId, ni par _id pour éviter les doublons après confirmation HTTP)
          const pendingOptimistic = prev.filter(m =>
            m.tempId &&
            !incoming.some(i => i._id === m.tempId || i.tempId === m.tempId) &&
            !incoming.some(i => i._id === m._id)
          );
          return [...incoming, ...pendingOptimistic];
        });
      } catch {}
    };

    const refreshConversations = async () => {
      try {
        const d = await messagerieAPI.getConversations();
        if (cancelled) return;
        setConversations(dedup(d.conversations || []));
      } catch {}
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshMessages();
        refreshConversations();
      }
    }, 5000);

    // Rafraîchir immédiatement quand l'onglet redevient visible
    // (changement d'app sur mobile, déverrouillage du téléphone, etc.)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshMessages();
        refreshConversations();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [activeConv?._id]);

  // ── Polling des conversations (même sans conv active) ──────────────────
  // Garantit que la liste et les badges non-lus se mettent à jour même si le
  // socket ne diffuse pas correctement.
  useEffect(() => {
    if (activeConv?._id) return; // le polling ci-dessus s'en charge déjà
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      messagerieAPI.getConversations()
        .then(d => setConversations(dedup(d.conversations || [])))
        .catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, [activeConv?._id]);

  // ── Ouvrir une conversation ──────────────────────────────────────────────
  const openConversation = useCallback(async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setTyping(false);
    setLoadingMsgs(true);

    socketRef.current?.emit('join_conversation', conv._id);
    socketRef.current?.emit('mark_read', { conversationId: conv._id });

    // Reset non-lus localement
    setConversations(prev => prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c));

    try {
      const d = await messagerieAPI.getMessages(conv._id);
      setMessages(d.messages || []);
    } catch {}
    finally { setLoadingMsgs(false); }
  }, []);

  // ── Supprimer une conversation ───────────────────────────────────────────
  const handleDelete = (conv, e) => {
    e.stopPropagation();
    setDeleteModal({ open: true, conv });
  };

  const handleConfirmDelete = async () => {
    const conv = deleteModal.conv;
    setDeleteModal({ open: false, conv: null });
    if (conv?._id) {
      try { await messagerieAPI.deleteConversation(conv._id); } catch {}
    }
    setConversations(prev => prev.filter(c => c._id !== conv._id));
    if (activeConv?._id === conv._id) setActiveConv(null);
  };

  // ── Recherche pour nouvelle discussion ───────────────────────────────────
  const handleNewSearch = async (q) => {
    setNewSearch(q);
    if (!q.trim()) { setNewResults([]); return; }
    setNewSearching(true);
    try {
      const d = await messagerieAPI.searchAvocats(q);
      setNewResults(d.avocats || []);
    } catch {}
    finally { setNewSearching(false); }
  };

  const handleStartNew = (av) => {
    setShowNewModal(false);
    setNewSearch(''); setNewResults([]);
    const pendingOther = av;
    setActiveConv({ _id: null, other: pendingOther, participants: [], unreadCount: 0 });
    setMessages([]);
  };

  // ── Envoi d'un message texte : TOUJOURS via HTTP ────────────────────────
  // On n'utilise plus socket.emit('send_message') pour l'envoi, car sur
  // mobile le socket peut rapporter connected:true alors que l'upgrade
  // WebSocket est cassé côté proxy opérateur, et les emits disparaissent
  // silencieusement. L'endpoint HTTP est fiable et diffuse lui-même le
  // nouveau message via io.to(conversationId).emit('new_message') côté
  // serveur, donc le destinataire reçoit toujours la mise à jour en temps
  // réel via son propre socket.
  const sendTextMessage = async (conversationId, content, tempId) => {
    try {
      const fd = new FormData();
      fd.append('content', content);
      fd.append('tempId', tempId); // transmis au backend pour l'inclure dans le broadcast socket
      const d = await messagerieAPI.sendMessage(conversationId, fd);
      // Remplacer le message optimiste par le vrai — sans garder tempId pour ne pas créer de doublon au polling
      setMessages(prev => prev.map(m =>
        (m._id === tempId || m.tempId === tempId) ? d.message : m
      ));
      // Mettre à jour lastMessage dans la liste des conversations
      setConversations(prev => prev.map(c =>
        c._id === conversationId
          ? { ...c, lastMessage: { content, senderId: user?._id, createdAt: new Date(), hasFile: false } }
          : c
      ));
    } catch (err) {
      console.error('[Messagerie] send message failed:', err);
      // Rollback : retirer le message optimiste pour ne pas tromper l'utilisateur
      setMessages(prev => prev.filter(m => m._id !== tempId && m.tempId !== tempId));
      alert('Impossible d\'envoyer le message. Vérifiez votre connexion.');
    }
  };

  // ── Envoyer un message ───────────────────────────────────────────────────
  const handleSend = async () => {
    if (!activeConv || (!input.trim() && !file)) return;
    setSending(true);

    // Création paresseuse : si c'est une nouvelle conv (pas encore en DB)
    if (activeConv._id === null) {
      try {
        const d = await messagerieAPI.getOrCreate({ otherAvocatId: activeConv.other?._id });
        const conv = d?.conversation;
        if (!conv) { setSending(false); return; }
        const other = conv.participants?.find(p => String(p._id) !== String(user?._id));
        const convWithOther = { ...conv, other, unreadCount: 0 };
        setConversations(prev => dedup([...prev, convWithOther]));
        setActiveConv(convWithOther);
        socketRef.current?.emit('join_conversation', conv._id);
        // Continuer l'envoi avec le vrai activeConv
        const content = input.trim();
        setInput('');
        const tempId = `temp_${Date.now()}`;
        const optimistic = {
          _id: tempId, tempId, conversationId: conv._id,
          sender: { _id: user?._id, firstName: user?.firstName, lastName: user?.lastName, fullName: user?.fullName },
          content, createdAt: new Date().toISOString(), readBy: [user?._id],
        };
        setMessages([optimistic]);
        await sendTextMessage(conv._id, content, tempId);
      } catch (e) { console.error('[Messagerie] lazy create failed:', e); }
      setSending(false);
      return;
    }

    if (file) {
      // Upload via HTTP pour les fichiers
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (input.trim()) fd.append('content', input.trim());
        const d = await messagerieAPI.sendMessage(activeConv._id, fd);
        setMessages(prev => [...prev, d.message]);
        setFile(null); setInput('');
        if (fileRef.current) fileRef.current.value = '';
      } catch (err) {
        console.error('[Messagerie] file upload failed:', err);
        alert('Impossible d\'envoyer le fichier. Vérifiez votre connexion.');
      }
    } else {
      // Message texte : socket si connecté, sinon HTTP
      const content = input.trim();
      const tempId = `temp_${Date.now()}`;
      const optimistic = {
        _id: tempId, tempId,
        conversationId: activeConv._id,
        sender: { _id: user?._id, firstName: user?.firstName, lastName: user?.lastName, fullName: user?.fullName },
        content,
        createdAt: new Date().toISOString(),
        readBy: [user?._id],
      };
      setMessages(prev => [...prev, optimistic]);
      setInput('');
      await sendTextMessage(activeConv._id, content, tempId);
    }
    setSending(false);
  };

  // ── Indicateur "en train d'écrire" ──────────────────────────────────────
  const handleTyping = (val) => {
    setInput(val);
    if (!activeConv) return;
    socketRef.current?.emit('typing', { conversationId: activeConv._id, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('typing', { conversationId: activeConv._id, isTyping: false });
    }, 1500);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Filtrer conversations ────────────────────────────────────────────────
  const filtered = conversations
    .filter(c => c.lastMessage?.content || c.lastMessage?.hasFile)  // masquer les conv vides
    .filter(c => {
      if (!search) return true;
      return fullName(c.other).toLowerCase().includes(search.toLowerCase());
    });

  const isOnline = (av) => av && onlineIds.has(String(av._id));
  const myId     = user?._id || user?.id;
  const isMe     = (msg) => {
    if (!myId) return false;
    const senderId = msg.sender?._id || msg.sender?.id || msg.sender;
    return String(senderId) === String(myId);
  };

  return (
    <div className={`mp-root${activeConv ? ' mp-mobile-chat-open' : ''}`}>

      <DeleteConvModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, conv: null })}
        onConfirm={handleConfirmDelete}
        lawyerName={fullName(deleteModal.conv?.other)}
      />

      {/* ── Sidebar gauche ── */}
      <div className="mp-sidebar">
        <div className="mp-sidebar-header">
          <div className="mp-sidebar-header-top">
            <h2 className="mp-title">Messagerie confraternelle</h2>
            <button className="mp-new-btn" onClick={() => setShowNewModal(true)} title="Nouvelle discussion">
              ✏️
            </button>
          </div>
          <p className="mp-subtitle">Correspondances entre avocats — Secret professionnel</p>
        </div>

        {conversations.filter(c => c.unreadCount > 0).length > 0 && (
          <div className="mp-unread-summary">
            {conversations.reduce((a, c) => a + (c.unreadCount || 0), 0)} non lu(s)
          </div>
        )}

        <div className="mp-search-wrap">
          <input
            className="mp-search"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="mp-conv-list">
          {loadingConvs && <div className="mp-loading">Chargement...</div>}
          {!loadingConvs && filtered.length === 0 && (
            <div className="mp-empty-list">Aucune conversation</div>
          )}
          {filtered.map(conv => {
            const other   = conv.other;
            const online  = isOnline(other);
            const isActive = activeConv?._id === conv._id;
            return (
              <div
                key={conv._id}
                className={`mp-conv-item ${isActive ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => openConversation(conv)}
              >
                <div className="mp-conv-avatar">
                  {other?.photo?.enhanced || other?.photo?.original
                    ? <img src={other.photo.enhanced || other.photo.original} alt={fullName(other)} />
                    : <span>{initials(other)}</span>
                  }
                  <span className={`mp-online-dot ${online ? 'online' : 'offline'}`} />
                </div>
                <div className="mp-conv-info">
                  <div className="mp-conv-name">Mᵉ {fullName(other)}</div>
                  <div className="mp-conv-last">
                    {conv.lastMessage?.hasFile ? '📎 Fichier joint' : (conv.lastMessage?.content || 'Nouvelle conversation')}
                  </div>
                </div>
                <div className="mp-conv-right">
                  <span className="mp-conv-time">{fmtTime(conv.lastMessage?.createdAt || conv.updatedAt)}</span>
                  {conv.unreadCount > 0 && (
                    <span className="mp-unread-badge">{conv.unreadCount}</span>
                  )}
                  <button className="mp-delete-btn" onClick={(e) => handleDelete(conv, e)} title="Supprimer">🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Zone chat ── */}
      <div className="mp-chat">
        {!activeConv ? (
          <div className="mp-empty-chat">
            <div className="mp-empty-icon">💬</div>
            <p>Sélectionnez une conversation</p>
            <small>ou ouvrez-en une depuis le Réseau Pro</small>
          </div>
        ) : (
          <>
            {/* Header chat */}
            <div className="mp-chat-header">
              <button className="mp-back-btn" onClick={() => setActiveConv(null)}>‹</button>
              <div className="mp-chat-av">
                <div className="mp-chat-avatar">
                  {activeConv.other?.photo?.enhanced || activeConv.other?.photo?.original
                    ? <img src={activeConv.other.photo.enhanced || activeConv.other.photo.original} alt="" />
                    : <span>{initials(activeConv.other)}</span>
                  }
                  <span className={`mp-online-dot ${isOnline(activeConv.other) ? 'online' : 'offline'}`} />
                </div>
                <div>
                  <div className="mp-chat-name">Mᵉ {fullName(activeConv.other)}</div>
                  <div className="mp-chat-meta">
                    {isOnline(activeConv.other) ? '● En ligne' : '○ Hors ligne'}
                    {activeConv.other?.specialties?.[0] && ` · ${activeConv.other.specialties[0]}`}
                    {activeConv.other?.officeLocation?.gouvernorat && ` · ${activeConv.other.officeLocation.gouvernorat}`}
                  </div>
                </div>
              </div>
              <div className="mp-chat-actions">
                <button className="mp-header-btn" onClick={() => {}}>🤝 Convention</button>
                <button className="mp-header-btn" onClick={() => fileRef.current?.click()}>📎 Document</button>
              </div>
            </div>

            {/* Bandeau déontologique */}
            <div className="mp-deonto">
              ⚠️ Cette messagerie est réservée aux communications confraternelles. Ne pas y inclure de données personnelles de clients sans leur consentement exprès. <em>(Art. 48 Loi 87-79)</em>
            </div>

            {/* Messages */}
            <div className="mp-messages">
              {loadingMsgs && <div className="mp-loading">Chargement des messages...</div>}

              {messages.length > 0 && (
                <div className="mp-date-sep">
                  Conversation démarrée le {new Date(messages[0]?.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              )}

              {messages.map((msg, i) => {
                const mine = isMe(msg);
                const showAvatar = !mine && (i === 0 || String(messages[i-1]?.sender?._id) !== String(msg.sender?._id));
                return (
                  <div key={msg._id} className={`mp-msg-row ${mine ? 'mine' : 'theirs'}`}>
                    {!mine && (
                      <div className={`mp-msg-avatar ${showAvatar ? '' : 'invisible'}`}>
                        {activeConv.other?.photo?.enhanced || activeConv.other?.photo?.original
                          ? <img src={activeConv.other.photo.enhanced || activeConv.other.photo.original} alt="" />
                          : <span>{initials(msg.sender)}</span>
                        }
                      </div>
                    )}
                    <div className="mp-msg-bubble-wrap">
                      <div className={`mp-msg-bubble ${mine ? 'mine' : ''}`}>
                        {msg.fileUrl && (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="mp-file-attach">
                            <span className="mp-file-icon">📎</span>
                            <div>
                              <div className="mp-file-name">{msg.fileName || 'Fichier'}</div>
                              {msg.fileSize && <small>{(msg.fileSize/1024).toFixed(0)} Ko · Anonymisé · Signé numériquement</small>}
                            </div>
                            <span className="mp-file-dl">↓</span>
                          </a>
                        )}
                        {msg.content && <p>{msg.content}</p>}
                      </div>
                      <span className="mp-msg-time">{fmtTime(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}

              {typing && (
                <div className="mp-msg-row theirs">
                  <div className="mp-msg-avatar"><span>{initials(activeConv.other)}</span></div>
                  <div className="mp-typing-indicator"><span/><span/><span/></div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Fichier sélectionné */}
            {file && (
              <div className="mp-file-preview">
                📎 <strong>{file.name}</strong>
                <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>✕</button>
              </div>
            )}

            {/* Zone saisie */}
            <div className="mp-input-wrap">
              <input ref={fileRef} type="file" style={{ display:'none' }}
                onChange={e => setFile(e.target.files[0] || null)} />
              <button className="mp-attach-btn" onClick={() => fileRef.current?.click()} title="Joindre un fichier">📎</button>
              <textarea
                className="mp-input"
                placeholder="Rédigez votre message confraternel..."
                value={input}
                onChange={e => handleTyping(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
              />
              <button
                className="mp-send-btn"
                onClick={handleSend}
                disabled={sending || (!input.trim() && !file)}
              >
                {sending ? '⏳' : '➤'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Modal nouvelle discussion ── */}
      {showNewModal && (
        <div className="mp-modal-overlay" onClick={() => { setShowNewModal(false); setNewSearch(''); setNewResults([]); }}>
          <div className="mp-modal-new" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-new-header">
              <h3>Nouvelle discussion</h3>
              <button className="mp-modal-close" onClick={() => { setShowNewModal(false); setNewSearch(''); setNewResults([]); }}>✕</button>
            </div>
            <input
              className="mp-modal-search"
              placeholder="Rechercher un confrère par nom..."
              value={newSearch}
              onChange={e => handleNewSearch(e.target.value)}
              autoFocus
            />
            <div className="mp-modal-results">
              {newSearching && <div className="mp-loading">Recherche...</div>}
              {!newSearching && newSearch && newResults.length === 0 && (
                <div className="mp-empty-list">Aucun résultat</div>
              )}
              {newResults.map(av => (
                <div key={av._id} className="mp-modal-av-item" onClick={() => handleStartNew(av)}>
                  <div className="mp-modal-av-avatar">
                    {av.photo?.enhanced || av.photo?.original
                      ? <img src={av.photo.enhanced || av.photo.original} alt={fullName(av)} />
                      : <span>{initials(av)}</span>
                    }
                  </div>
                  <div className="mp-modal-av-info">
                    <div className="mp-modal-av-name">Mᵉ {fullName(av)}</div>
                    <div className="mp-modal-av-sub">
                      {av.specialties?.[0] && <span>{av.specialties[0]}</span>}
                      {av.officeLocation?.gouvernorat && <span> · {av.officeLocation.gouvernorat}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {!newSearch && (
                <div className="mp-modal-hint">Tapez le nom d'un confrère pour le trouver</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
