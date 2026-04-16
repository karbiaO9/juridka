const express = require('express');
const router  = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../Controllers/temoignageController');

// Public
router.get('/avocat/:id', ctrl.getAvocatTemoignages);

// Client
router.post('/',               requireAuth, ctrl.submitTemoignage);
router.get('/mes',             requireAuth, ctrl.getMyTemoignages);
router.get('/submitted-rdvs',  requireAuth, ctrl.getSubmittedRdvIds);

// Admin
router.get('/admin/all',            requireAuth, requireAdmin, ctrl.adminGetAll);
router.patch('/admin/:id/approve',  requireAuth, requireAdmin, ctrl.adminApprove);
router.patch('/admin/:id/reject',   requireAuth, requireAdmin, ctrl.adminReject);

module.exports = router;
