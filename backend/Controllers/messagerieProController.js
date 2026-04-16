const ConversationPro    = require('../Model/ConversationPro');
const MessagePro         = require('../Model/MessagePro');
const Avocat             = require('../Model/Avocat');
const { cloudinary }     = require('../config/cloudinary');
const { encrypt, decrypt } = require('../utils/crypto');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messagerie-pro/conversations
// Liste toutes les conversations de l'avocat connecté
// ─────────────────────────────────────────────────────────────────────────────
const getConversations = async (req, res) => {
  try {
    const myId = req.user._id;

    const conversations = await ConversationPro.find({ participants: myId, deletedBy: { $ne: myId } })
      .sort({ updatedAt: -1 })
      .populate('participants', 'firstName lastName fullName photo disponibilite specialties officeLocation')
      .lean();

    // Dédupliquer par paire de participants (garder la plus récente)
    const seen = new Map();
    for (const c of conversations) {
      const key = c.participants.map(p => String(p._id)).sort().join('|');
      if (!seen.has(key)) seen.set(key, c);
    }
    const deduped = [...seen.values()];

    const result = deduped.map(c => ({
      ...c,
      unreadCount: c.unreadCounts?.[String(myId)] || 0,
      other: c.participants.find(p => String(p._id) !== String(myId)),
    }));

    return res.json({ conversations: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messagerie-pro/conversations/:id/messages
// ─────────────────────────────────────────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: conversationId } = req.params;

    // Vérifier que l'avocat est bien participant
    const conv = await ConversationPro.findOne({
      _id: conversationId,
      participants: myId,
    });
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    const messages = await MessagePro.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate('sender', 'firstName lastName fullName photo')
      .lean();

    // Déchiffrer le contenu de chaque message
    messages.forEach(m => { m.content = decrypt(m.content); });

    // Marquer tous les messages non lus comme lus
    await MessagePro.updateMany(
      { conversationId, readBy: { $ne: myId } },
      { $addToSet: { readBy: myId } }
    );

    // Remettre le compteur à 0
    conv.unreadCounts.set(String(myId), 0);
    await conv.save();

    return res.json({ messages });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messagerie-pro/conversations
// Créer ou récupérer une conversation entre deux avocats
// ─────────────────────────────────────────────────────────────────────────────
const getOrCreateConversation = async (req, res) => {
  try {
    const myId     = req.user._id;
    const { otherAvocatId, contexteType, contexteRefId } = req.body;

    if (!otherAvocatId) return res.status(400).json({ error: 'otherAvocatId requis' });
    if (String(otherAvocatId) === String(myId))
      return res.status(400).json({ error: 'Vous ne pouvez pas vous écrire à vous-même' });

    // Chercher la conversation existante (la plus récente si doublons)
    let conv = await ConversationPro.findOne({
      participants: { $all: [myId, otherAvocatId], $size: 2 },
    }).sort({ updatedAt: -1 });

    if (!conv) {
      conv = await ConversationPro.create({
        participants: [myId, otherAvocatId],
        contexte: { type: contexteType || null, refId: contexteRefId || null },
      });
    } else {
      // Si l'utilisateur avait supprimé cette conv, la réouvrir uniquement pour lui
      const wasDeleted = conv.deletedBy.map(String).includes(String(myId));
      if (wasDeleted) {
        conv.deletedBy = conv.deletedBy.filter(id => String(id) !== String(myId));
        // Supprimer les anciens messages côté DB pour repartir proprement
        await require('../Model/MessagePro').deleteMany({ conversationId: conv._id });
        conv.lastMessage = null;
        conv.unreadCounts = new Map();
        await conv.save();
      }
    }

    conv = await ConversationPro.findById(conv._id)
      .populate('participants', 'firstName lastName fullName photo disponibilite specialties officeLocation');

    return res.json({ conversation: conv });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messagerie-pro/conversations/:id/messages
// Envoyer un message HTTP (fichiers joints ou fallback si socket indisponible)
// Diffuse en temps réel via Socket.io aux deux participants.
// ─────────────────────────────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const myId           = req.user._id;
    const conversationId = req.params.id;
    const { content, tempId } = req.body;

    const conv = await ConversationPro.findOne({
      _id: conversationId, participants: myId,
    });
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    if (!content && !req.file)
      return res.status(400).json({ error: 'Message vide' });

    const msg = await MessagePro.create({
      conversationId,
      sender:  myId,
      content: encrypt(content || ''),
      fileUrl:  req.file?.path     || null,
      fileName: req.file?.originalname || null,
      fileSize: req.file?.size     || null,
      readBy:  [myId],
    });

    // Mettre à jour lastMessage + incrémenter non-lus pour l'autre participant
    const other = conv.participants.find(p => String(p) !== String(myId));
    if (other) {
      const current = conv.unreadCounts.get(String(other)) || 0;
      conv.unreadCounts.set(String(other), current + 1);
    }
    conv.lastMessage = {
      content:   content || (req.file ? req.file.originalname : ''),
      senderId:  myId,
      createdAt: new Date(),
      hasFile:   !!req.file,
    };
    // Réouvrir la conv uniquement pour l'expéditeur (pas pour l'autre s'il a supprimé de son côté)
    conv.deletedBy = conv.deletedBy.filter(id => String(id) !== String(myId));
    await conv.save();

    const populated = await MessagePro.findById(msg._id)
      .populate('sender', 'firstName lastName fullName photo')
      .lean();
    populated.content = decrypt(populated.content);

    // ── Diffusion temps réel via Socket.io ──────────────────────────────────
    // L'endpoint HTTP est utilisé pour les fichiers joints et comme fallback
    // sur mobile quand le WebSocket est bloqué. Il faut donc reproduire ici
    // le même broadcast que le handler socket `send_message`, sinon l'autre
    // participant ne voit rien en temps réel et doit rafraîchir.
    const io            = req.app.get('io');
    const onlineAvocats = req.app.get('onlineAvocats');

    if (io) {
      // Forcer l'autre participant (s'il est connecté) à rejoindre la room
      // de cette conversation — nécessaire pour les conversations créées
      // après sa connexion, où il n'a pas encore été join_conversations.
      if (other && onlineAvocats) {
        const otherSocketId = onlineAvocats.get(String(other));
        if (otherSocketId) {
          const otherSocket = io.sockets.sockets.get(otherSocketId);
          if (otherSocket) otherSocket.join(String(conversationId));
        }
      }

      // Broadcast du nouveau message à tous les membres de la room
      io.to(String(conversationId)).emit('new_message', { ...populated, ...(tempId ? { tempId } : {}) });

      // Notifier l'autre participant pour mettre à jour la liste des
      // conversations (lastMessage, badge non-lus, nouvelle conv éventuelle)
      if (other) {
        const otherSocketId = onlineAvocats?.get(String(other));
        if (otherSocketId) {
          const fullConv = await ConversationPro.findById(conversationId)
            .populate('participants', 'firstName lastName fullName photo disponibilite specialties officeLocation')
            .lean();
          const unreadCount = fullConv.unreadCounts?.[String(other)] || 0;
          io.to(otherSocketId).emit('conversation_updated', {
            conversation: {
              ...fullConv,
              unreadCount,
              other: fullConv.participants.find(p => String(p._id) !== String(other)),
            },
            conversationId,
            lastMessage: conv.lastMessage,
            unreadCount,
          });
        }
      }
    }

    return res.status(201).json({ message: populated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messagerie-pro/unread-count
// Nombre total de messages non lus (pour le badge sidebar)
// ─────────────────────────────────────────────────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const myId = String(req.user._id);

    const conversations = await ConversationPro.find({ participants: req.user._id }).lean();
    let total = 0;
    conversations.forEach(c => {
      total += c.unreadCounts?.[myId] || 0;
    });

    return res.json({ unreadCount: total });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/messagerie-pro/conversations/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteConversation = async (req, res) => {
  try {
    const myId = req.user._id;
    const conv = await ConversationPro.findOne({ _id: req.params.id, participants: myId });
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    // Ajouter l'avocat dans deletedBy s'il n'y est pas déjà
    if (!conv.deletedBy.map(String).includes(String(myId))) {
      conv.deletedBy.push(myId);
      await conv.save();
    }

    // Supprimer définitivement seulement si les deux participants ont supprimé
    const allDeleted = conv.participants.every(p =>
      conv.deletedBy.map(String).includes(String(p))
    );
    if (allDeleted) {
      await MessagePro.deleteMany({ conversationId: conv._id });
      await ConversationPro.deleteOne({ _id: conv._id });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messagerie-pro/avocats/search?q=
// Rechercher des avocats pour démarrer une nouvelle discussion
// ─────────────────────────────────────────────────────────────────────────────
const searchAvocats = async (req, res) => {
  try {
    const myId = String(req.user._id);
    const q    = (req.query.q || '').trim();
    if (!q) return res.json({ avocats: [] });

    const avocats = await Avocat.find({
      _id: { $ne: myId },
      isVerified: true,
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName:  { $regex: q, $options: 'i' } },
        { fullName:  { $regex: q, $options: 'i' } },
      ],
    })
      .select('firstName lastName fullName photo disponibilite specialties officeLocation')
      .limit(10)
      .lean();

    return res.json({ avocats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getConversations,
  getMessages,
  getOrCreateConversation,
  sendMessage,
  getUnreadCount,
  deleteConversation,
  searchAvocats,
};
