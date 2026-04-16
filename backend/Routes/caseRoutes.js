const express = require('express');
const router = express.Router();
const caseController = require('../Controllers/caseController');
const { requireAuth } = require('../middleware/auth');
const { requireAvocat } = require('../middleware/role');
const { upload } = require('../config/cloudinary');

// Create case (lawyer only) - supports multiple file upload
router.post('/', requireAuth, requireAvocat, upload.array('files', 6), caseController.createCase);

// List cases (lawyer sees their cases, client sees theirs)
router.get('/', requireAuth, caseController.listCases);

// Get case details
router.get('/:id', requireAuth, caseController.getCase);

// Update case (lawyer only) - can add files
router.put('/:id', requireAuth, requireAvocat, upload.array('files', 6), caseController.updateCase);

// Add files to a case (client or lawyer owner can append files)
router.post('/:id/add-files', requireAuth, upload.array('files', 6), caseController.addFilesToCase);

// Delete case (lawyer only)
router.delete('/:id', requireAuth, requireAvocat, caseController.deleteCase);

// Delete a file from a case (lawyer only)
router.post('/:id/delete-file', requireAuth, requireAvocat, caseController.deleteFileFromCase);

module.exports = router;
