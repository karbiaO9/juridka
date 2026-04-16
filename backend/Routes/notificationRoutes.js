const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getNotifications, markRead, markOneRead } = require('../Controllers/notificationController');

router.get('/', requireAuth, getNotifications);
router.put('/mark-read', requireAuth, markRead);
router.patch('/:id/read', requireAuth, markOneRead);

module.exports = router;
