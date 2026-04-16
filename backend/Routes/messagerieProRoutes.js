const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../config/cloudinary');
const {
  getConversations,
  getMessages,
  getOrCreateConversation,
  sendMessage,
  getUnreadCount,
  deleteConversation,
  searchAvocats,
} = require('../Controllers/messagerieProController');

router.use(requireAuth);

router.get('/conversations',                   getConversations);
router.post('/conversations',                  getOrCreateConversation);
router.delete('/conversations/:id',            deleteConversation);
router.get('/conversations/:id/messages',      getMessages);
router.post('/conversations/:id/messages',     upload.single('file'), sendMessage);
router.get('/unread-count',                    getUnreadCount);
router.get('/avocats/search',                  searchAvocats);

module.exports = router;
