const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../config/cloudinary');
const {
  getAnnuaire, updateDisponibilite,
  getDelegations, getMesDelegations, createDelegation, updateDelegation,
  repondreDelegation, sauvegarderDelegation,
  getSubstitutions, getMesSubstitutions, createSubstitution,
  accepterSubstitution, ignorerSubstitution, retirerSubstitution,
  getMesDocuments, uploadDocument, supprimerDocument, partagerDocument,
  getMesConventions, creerConvention, signerConvention,
} = require('../Controllers/reseauProController');

// Toutes les routes nécessitent un avocat authentifié
router.use(requireAuth);

// ── Annuaire ─────────────────────────────────────────────────────────────────
router.get('/annuaire',       getAnnuaire);
router.patch('/disponibilite', updateDisponibilite);

// ── Délégation ────────────────────────────────────────────────────────────────
router.get('/delegations',           getDelegations);
router.get('/delegations/mes',       getMesDelegations);
router.post('/delegations',          createDelegation);
router.patch('/delegations/:id',     updateDelegation);
router.post('/delegations/:id/repondre',    repondreDelegation);
router.post('/delegations/:id/sauvegarder', sauvegarderDelegation);

// ── Substitution ──────────────────────────────────────────────────────────────
router.get('/substitutions',         getSubstitutions);
router.get('/substitutions/mes',     getMesSubstitutions);
router.post('/substitutions',        upload.single('procuration'), createSubstitution);
router.patch('/substitutions/:id/accepter', accepterSubstitution);
router.patch('/substitutions/:id/ignorer',  ignorerSubstitution);
router.patch('/substitutions/:id/retirer',  retirerSubstitution);

// ── Documents ─────────────────────────────────────────────────────────────────
router.get('/documents',             getMesDocuments);
router.post('/documents',            upload.single('file'), uploadDocument);
router.delete('/documents/:id',      supprimerDocument);
router.post('/documents/:id/partager', partagerDocument);

// ── Conventions ───────────────────────────────────────────────────────────────
router.get('/conventions',           getMesConventions);
router.post('/conventions',          creerConvention);
router.patch('/conventions/:id/signer', signerConvention);

module.exports = router;
