const express = require('express');
const router = express.Router();
const rendezVousController = require('../Controllers/rendezVousController');
const { requireAuth } = require('../middleware/auth');

// Get available slots for a lawyer on a given day
router.get('/slots', rendezVousController.getAvailableSlots);

// Book a rendezvous
router.post('/book', rendezVousController.bookRendezVous);

// Lawyer approves booking (requires auth)
router.post('/approve/:id', requireAuth, rendezVousController.approveRendezVous);

// Lawyer rejects booking (requires auth)
router.post('/reject/:id', requireAuth, rendezVousController.rejectRendezVous);

// Update an appointment (reschedule/change) - requires auth so controller can check owner
router.patch('/update/:id', requireAuth, rendezVousController.updateRendezVous);

// Mark appointment as paid (requires auth - only lawyer can mark as paid)
router.patch('/mark-paid/:id', requireAuth, rendezVousController.markAsPaid);

// Get all rendezvous (handles both lawyer and client queries)
router.get('/', (req, res) => {
  if (req.query.avocatId) {
    return rendezVousController.getLawyerRendezVous(req, res);
  } else if (req.query.clientId) {
    return rendezVousController.getClientRendezVous(req, res);
  } else {
    return res.status(400).json({ message: 'Either avocatId or clientId is required' });
  }
});
router.get('/admin/all', rendezVousController.getAllRendezVous);


module.exports = router;
