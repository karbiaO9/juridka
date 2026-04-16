require('dotenv').config()
const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const mongoose   = require('mongoose')
const cors       = require('cors')
const path       = require('path')
const jwt        = require('jsonwebtoken')
const Avocat     = require('./Model/Avocat')

const authRoutes           = require('./Routes/authRoutes')
const adminRoutes          = require('./Routes/adminRoutes')
const clientRoutes         = require('./Routes/clientRoutes')
const avocatRoutes         = require('./Routes/avocatRoutes')
const rendezVousRoutes     = require('./Routes/rendezVousRoutes')
const caseRoutes           = require('./Routes/caseRoutes')
const uploadRoutes         = require('./Routes/uploadRoutes')
const notificationRoutes   = require('./Routes/notificationRoutes');
const foundingMemberRoutes = require('./Routes/foundingMemberRoutes');
const temoignageRoutes     = require('./Routes/temoignageRoutes');
const reseauProRoutes      = require('./Routes/reseauProRoutes');
const messagerieProRoutes  = require('./Routes/messagerieProRoutes');

const ConversationPro      = require('./Model/ConversationPro');
const MessagePro           = require('./Model/MessagePro');
const { encrypt, decrypt } = require('./utils/crypto');

const app    = express()
const server = http.createServer(app)

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
});

// Authentification Socket via JWT
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token manquant'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const avocat  = await Avocat.findById(decoded._id).select('_id firstName lastName fullName photo');
    if (!avocat) return next(new Error('Avocat introuvable'));

    socket.avocatId = String(avocat._id);
    socket.avocat   = avocat;
    next();
  } catch {
    next(new Error('Token invalide'));
  }
});

// Map : avocatId → socketId (pour savoir qui est en ligne)
const onlineAvocats = new Map();

io.on('connection', (socket) => {
  const avocatId = socket.avocatId;
  onlineAvocats.set(avocatId, socket.id);
  io.emit('avocat_online', avocatId);

  // Rejoindre la room de ses conversations
  socket.on('join_conversations', async () => {
    const convs = await ConversationPro.find({ participants: avocatId }).select('_id');
    convs.forEach(c => socket.join(String(c._id)));
  });

  // Rejoindre une conversation spécifique
  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
  });

  // Envoyer un message
  socket.on('send_message', async ({ conversationId, content, tempId }) => {
    try {
      const conv = await ConversationPro.findOne({
        _id: conversationId, participants: avocatId,
      });
      if (!conv) return;

      const msg = await MessagePro.create({
        conversationId,
        sender:  avocatId,
        content: encrypt(content || ''),
        readBy:  [avocatId],
      });

      const populated = await MessagePro.findById(msg._id)
        .populate('sender', 'firstName lastName fullName photo')
        .lean();

      // Déchiffrer avant d'envoyer au client
      populated.content = decrypt(populated.content);

      // Mettre à jour lastMessage + non-lus
      const other = conv.participants.find(p => String(p) !== avocatId);
      if (other) {
        const cur = conv.unreadCounts.get(String(other)) || 0;
        conv.unreadCounts.set(String(other), cur + 1);
      }
      conv.lastMessage = { content, senderId: avocatId, createdAt: new Date(), hasFile: false };
      // Réouvrir la conv uniquement pour l'expéditeur (pas pour l'autre s'il a supprimé de son côté)
      conv.deletedBy = conv.deletedBy.filter(id => String(id) !== avocatId);
      await conv.save();

      // Forcer l'autre participant à rejoindre la room s'il est connecté —
      // indispensable pour les conversations créées après sa connexion
      // (sinon le broadcast `io.to(conversationId)` ne l'atteint pas).
      if (other) {
        const otherSocketId = onlineAvocats.get(String(other));
        if (otherSocketId) {
          const otherSocket = io.sockets.sockets.get(otherSocketId);
          if (otherSocket) otherSocket.join(String(conversationId));
        }
      }

      // Broadcast à tous dans la room
      io.to(String(conversationId)).emit('new_message', { ...populated, tempId });

      // Notifier l'autre si hors de la room (badge + conversation complète si nouvelle)
      if (other) {
        const otherSocketId = onlineAvocats.get(String(other));
        if (otherSocketId) {
          const fullConv = await ConversationPro.findById(conversationId)
            .populate('participants', 'firstName lastName fullName photo disponibilite specialties officeLocation')
            .lean();
          const unreadCount = fullConv.unreadCounts?.[String(other)] || 0;
          io.to(otherSocketId).emit('conversation_updated', {
            conversation: { ...fullConv, unreadCount, other: fullConv.participants.find(p => String(p._id) !== String(other)) },
            conversationId,
            lastMessage: conv.lastMessage,
            unreadCount,
          });
        }
      }
    } catch (err) {
      socket.emit('message_error', { error: err.message });
    }
  });

  // "En train d'écrire..."
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(conversationId).emit('user_typing', { avocatId, isTyping });
  });

  // Marquer messages comme lus
  socket.on('mark_read', async ({ conversationId }) => {
    try {
      await MessagePro.updateMany(
        { conversationId, readBy: { $ne: avocatId } },
        { $addToSet: { readBy: avocatId } }
      );
      const conv = await ConversationPro.findById(conversationId);
      if (conv) {
        conv.unreadCounts.set(avocatId, 0);
        await conv.save();
      }
      socket.to(conversationId).emit('messages_read', { conversationId, avocatId });
    } catch {}
  });

  socket.on('disconnect', () => {
    onlineAvocats.delete(avocatId);
    io.emit('avocat_offline', avocatId);
  });
});

// Rendre io accessible dans les controllers si besoin
app.set('io', io);
app.set('onlineAvocats', onlineAvocats);

// ── Middleware Express ────────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/uploads', express.static('uploads'))

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',             authRoutes)
app.use('/api/admin',            adminRoutes)
app.use('/api/auth/client',      clientRoutes)
app.use('/api/auth/avocat',      avocatRoutes)
app.use('/api/rendezvous',       rendezVousRoutes)
app.use('/api/cases',            caseRoutes)
app.use('/api/uploads',          uploadRoutes)
app.use('/api/founding-members', foundingMemberRoutes)
app.use('/api/notifications',    notificationRoutes)
app.use('/api/temoignages',      temoignageRoutes)
app.use('/api/reseau-pro',       reseauProRoutes)
app.use('/api/messagerie-pro',   messagerieProRoutes)

app.get('/', (req, res) => res.send('Juridika API is running'));

// ── Démarrage ────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => server.listen(process.env.PORT, () => {
    console.log(`Server + Socket.io running on port ${process.env.PORT}`)
  }))
  .catch(err => console.log(err))