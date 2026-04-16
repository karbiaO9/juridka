const Avocat                = require('../Model/Avocat');
const DemandeDelegation     = require('../Model/DemandeDelegation');
const DemandeSubstitution   = require('../Model/DemandeSubstitution');
const DocumentPro           = require('../Model/DocumentPro');
const ConventionCollaboration = require('../Model/ConventionCollaboration');
const { cloudinary }        = require('../config/cloudinary');

// ─────────────────────────────────────────────────────────────────────────────
// ANNUAIRE
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/reseau-pro/annuaire */
const getAnnuaire = async (req, res) => {
  try {
    const { q, disponibilite, ville, langue } = req.query;
    const myId = req.user._id;

    const filter = {
      _id: { $ne: myId },
      status: 'approved',
      isVerified: true,
    };
    if (disponibilite) filter.disponibilite = disponibilite;
    if (ville)         filter['officeLocation.gouvernorat'] = new RegExp(ville, 'i');
    if (langue)        filter.spokenLanguages = langue;
    if (q) {
      filter.$or = [
        { firstName: new RegExp(q, 'i') },
        { lastName:  new RegExp(q, 'i') },
        { specialties: new RegExp(q, 'i') },
        { 'officeLocation.gouvernorat': new RegExp(q, 'i') },
      ];
    }

    const avocats = await Avocat.find(filter)
      .select('firstName lastName fullName specialties officeLocation spokenLanguages disponibilite photo')
      .lean();

    return res.json({ avocats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** PATCH /api/reseau-pro/disponibilite */
const updateDisponibilite = async (req, res) => {
  try {
    const { disponibilite } = req.body;
    const allowed = ['disponible', 'en_audience', 'indisponible'];
    if (!allowed.includes(disponibilite))
      return res.status(400).json({ error: 'Statut invalide' });

    await Avocat.findByIdAndUpdate(req.user._id, { disponibilite });
    return res.json({ message: 'Statut mis à jour', disponibilite });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DÉLÉGATION
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/reseau-pro/delegations — feed public (pas les miennes) */
const getDelegations = async (req, res) => {
  try {
    const delegations = await DemandeDelegation.find({
      avocatId: { $ne: req.user._id },
      statut:   'en_attente',
    })
      .sort({ createdAt: -1 })
      .populate('avocatId', 'firstName lastName fullName specialties officeLocation disponibilite photo')
      .lean();

    // Marquer celles que l'avocat a sauvegardées
    const withSaved = delegations.map(d => ({
      ...d,
      saved: d.savedBy.some(id => String(id) === String(req.user._id)),
      hasResponded: d.reponses.some(r => String(r.avocatId) === String(req.user._id)),
    }));

    return res.json({ delegations: withSaved });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/reseau-pro/delegations/mes — mes propres demandes */
const getMesDelegations = async (req, res) => {
  try {
    const delegations = await DemandeDelegation.find({ avocatId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('reponses.avocatId', 'firstName lastName fullName specialties officeLocation photo')
      .populate('conventionId')
      .lean();

    return res.json({ delegations });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/reseau-pro/delegations */
const createDelegation = async (req, res) => {
  try {
    const { specialite, gouvernorat, description, delai, langues, statut } = req.body;
    if (!specialite || !gouvernorat || !description)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });

    const delegation = await DemandeDelegation.create({
      avocatId: req.user._id,
      specialite, gouvernorat, description,
      delai:   delai   || 'flexible',
      langues: langues || [],
      statut:  statut === 'brouillon' ? 'brouillon' : 'en_attente',
    });

    return res.status(201).json({ delegation });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** PATCH /api/reseau-pro/delegations/:id — modifier / retirer */
const updateDelegation = async (req, res) => {
  try {
    const delegation = await DemandeDelegation.findOne({
      _id: req.params.id, avocatId: req.user._id,
    });
    if (!delegation) return res.status(404).json({ error: 'Demande introuvable' });

    const { statut, specialite, gouvernorat, description, delai, langues } = req.body;
    if (specialite)   delegation.specialite  = specialite;
    if (gouvernorat)  delegation.gouvernorat = gouvernorat;
    if (description)  delegation.description = description;
    if (delai)        delegation.delai       = delai;
    if (langues)      delegation.langues     = langues;
    if (statut)       delegation.statut      = statut;

    await delegation.save();
    return res.json({ delegation });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/reseau-pro/delegations/:id/repondre */
const repondreDelegation = async (req, res) => {
  try {
    const delegation = await DemandeDelegation.findById(req.params.id);
    if (!delegation) return res.status(404).json({ error: 'Demande introuvable' });
    if (String(delegation.avocatId) === String(req.user._id))
      return res.status(400).json({ error: 'Vous ne pouvez pas répondre à votre propre demande' });

    const alreadyResponded = delegation.reponses.some(
      r => String(r.avocatId) === String(req.user._id)
    );
    if (alreadyResponded)
      return res.status(400).json({ error: 'Vous avez déjà répondu' });

    delegation.reponses.push({
      avocatId: req.user._id,
      message:  req.body.message || '',
    });
    await delegation.save();

    return res.json({ message: 'Réponse enregistrée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/reseau-pro/delegations/:id/sauvegarder */
const sauvegarderDelegation = async (req, res) => {
  try {
    const delegation = await DemandeDelegation.findById(req.params.id);
    if (!delegation) return res.status(404).json({ error: 'Demande introuvable' });

    const idx = delegation.savedBy.findIndex(id => String(id) === String(req.user._id));
    if (idx === -1) delegation.savedBy.push(req.user._id);
    else            delegation.savedBy.splice(idx, 1); // toggle

    await delegation.save();
    return res.json({ saved: idx === -1 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSTITUTION
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/reseau-pro/substitutions — feed public */
const getSubstitutions = async (req, res) => {
  try {
    const substitutions = await DemandeSubstitution.find({
      avocatId: { $ne: req.user._id },
      statut:   'en_attente',
      dateAudience: { $gt: new Date() },
    })
      .sort({ dateAudience: 1 })
      .populate('avocatId', 'firstName lastName fullName specialties officeLocation disponibilite photo')
      .lean();

    const myId = String(req.user._id);
    const withIgnored = substitutions.map(s => ({
      ...s,
      ignored: s.ignoredBy.some(id => String(id) === myId),
      urgente: (new Date(s.dateAudience) - new Date()) < 24 * 60 * 60 * 1000,
    }));

    return res.json({ substitutions: withIgnored });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/reseau-pro/substitutions/mes */
const getMesSubstitutions = async (req, res) => {
  try {
    const substitutions = await DemandeSubstitution.find({ avocatId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('accepteePar', 'firstName lastName fullName photo')
      .lean();

    return res.json({ substitutions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/reseau-pro/substitutions */
const createSubstitution = async (req, res) => {
  try {
    const { tribunal, dateAudience, nature, contexte } = req.body;
    if (!tribunal || !dateAudience || !nature)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });

    const diff     = new Date(dateAudience) - new Date();
    const urgente  = diff > 0 && diff < 24 * 60 * 60 * 1000;

    const substitution = await DemandeSubstitution.create({
      avocatId: req.user._id,
      tribunal, dateAudience, nature,
      contexte: contexte || '',
      procurationUrl: req.file?.path || null,
      urgente,
    });

    return res.status(201).json({ substitution });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** PATCH /api/reseau-pro/substitutions/:id/accepter */
const accepterSubstitution = async (req, res) => {
  try {
    const sub = await DemandeSubstitution.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Demande introuvable' });
    if (String(sub.avocatId) === String(req.user._id))
      return res.status(400).json({ error: 'Action non autorisée' });

    sub.statut      = 'acceptee';
    sub.accepteePar = req.user._id;
    await sub.save();

    return res.json({ message: 'Substitution acceptée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** PATCH /api/reseau-pro/substitutions/:id/ignorer */
const ignorerSubstitution = async (req, res) => {
  try {
    const sub = await DemandeSubstitution.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Demande introuvable' });

    if (!sub.ignoredBy.includes(req.user._id))
      sub.ignoredBy.push(req.user._id);
    await sub.save();

    return res.json({ message: 'Demande ignorée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** PATCH /api/reseau-pro/substitutions/:id/retirer */
const retirerSubstitution = async (req, res) => {
  try {
    const sub = await DemandeSubstitution.findOne({
      _id: req.params.id, avocatId: req.user._id,
    });
    if (!sub) return res.status(404).json({ error: 'Demande introuvable' });

    sub.statut = 'retiree';
    await sub.save();
    return res.json({ message: 'Demande retirée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS PRO
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STORAGE_BYTES = 50 * 1024 * 1024; // 50 Mo

/** GET /api/reseau-pro/documents */
const getMesDocuments = async (req, res) => {
  try {
    const docs = await DocumentPro.find({ avocatId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const reçus = await DocumentPro.find({ partageAvec: req.user._id })
      .populate('avocatId', 'firstName lastName fullName')
      .sort({ createdAt: -1 })
      .lean();

    const totalSize = docs.reduce((acc, d) => acc + (d.fileSize || 0), 0);

    return res.json({
      documents: docs,
      recus: reçus,
      stats: {
        stockes: docs.length,
        totalSize,
        maxSize: MAX_STORAGE_BYTES,
        recusCount: reçus.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/reseau-pro/documents */
const uploadDocument = async (req, res) => {
  try {
    const { categorie, declarationSignee } = req.body;

    if (!declarationSignee || declarationSignee === 'false')
      return res.status(400).json({ error: 'Déclaration obligatoire non signée' });

    if (!req.file)
      return res.status(400).json({ error: 'Fichier manquant' });

    // Vérifier quota
    const existing = await DocumentPro.find({ avocatId: req.user._id });
    const usedBytes = existing.reduce((acc, d) => acc + (d.fileSize || 0), 0);
    const fileSize  = req.file.size || 0;
    if (usedBytes + fileSize > MAX_STORAGE_BYTES)
      return res.status(400).json({ error: 'Quota de stockage dépassé (50 Mo)' });

    const badge = categorie === 'procuration' || categorie === 'convention'
      ? 'confidentiel'
      : 'anonymise';

    const doc = await DocumentPro.create({
      avocatId:         req.user._id,
      fileUrl:          req.file.path,
      fileName:         req.file.originalname,
      fileSize,
      categorie:        categorie || 'travail_anonymise',
      badge,
      declarationSignee: true,
    });

    return res.status(201).json({ document: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** DELETE /api/reseau-pro/documents/:id */
const supprimerDocument = async (req, res) => {
  try {
    const doc = await DocumentPro.findOne({
      _id: req.params.id, avocatId: req.user._id,
    });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    // Supprimer de Cloudinary
    if (doc.fileUrl) {
      const parts    = doc.fileUrl.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder   = parts[parts.length - 2];
      try { await cloudinary.uploader.destroy(`${folder}/${filename}`); } catch (_) {}
    }

    await DocumentPro.deleteOne({ _id: doc._id });
    return res.json({ message: 'Document supprimé' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/reseau-pro/documents/:id/partager */
const partagerDocument = async (req, res) => {
  try {
    const { avocatId } = req.body;
    if (!avocatId) return res.status(400).json({ error: 'avocatId requis' });

    const doc = await DocumentPro.findOne({
      _id: req.params.id, avocatId: req.user._id,
    });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    if (!doc.partageAvec.includes(avocatId))
      doc.partageAvec.push(avocatId);
    await doc.save();

    return res.json({ message: 'Document partagé' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVENTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/reseau-pro/conventions */
const getMesConventions = async (req, res) => {
  try {
    const conventions = await ConventionCollaboration.find({
      $or: [{ avocat1Id: req.user._id }, { avocat2Id: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .populate('avocat1Id', 'firstName lastName fullName photo')
      .populate('avocat2Id', 'firstName lastName fullName photo')
      .lean();

    return res.json({ conventions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/reseau-pro/conventions */
const creerConvention = async (req, res) => {
  try {
    const { avocat2Id, objet, type, demandeLieeId, demandeLieeType } = req.body;
    if (!avocat2Id) return res.status(400).json({ error: 'Destinataire requis' });

    const convention = await ConventionCollaboration.create({
      avocat1Id: req.user._id,
      avocat2Id,
      objet:           objet           || '',
      type:            type            || 'collaboration',
      demandeLieeId:   demandeLieeId   || null,
      demandeLieeType: demandeLieeType || null,
    });

    return res.status(201).json({ convention });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** PATCH /api/reseau-pro/conventions/:id/signer */
const signerConvention = async (req, res) => {
  try {
    const convention = await ConventionCollaboration.findOne({
      _id: req.params.id,
      $or: [{ avocat1Id: req.user._id }, { avocat2Id: req.user._id }],
    });
    if (!convention) return res.status(404).json({ error: 'Convention introuvable' });

    convention.statut        = 'signee';
    convention.dateSignature = new Date();
    await convention.save();

    // Si liée à une délégation, la passer en active
    if (convention.demandeLieeType === 'delegation' && convention.demandeLieeId) {
      await DemandeDelegation.findByIdAndUpdate(convention.demandeLieeId, {
        statut: 'active', conventionId: convention._id,
      });
    }

    return res.json({ convention });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAnnuaire, updateDisponibilite,
  getDelegations, getMesDelegations, createDelegation, updateDelegation,
  repondreDelegation, sauvegarderDelegation,
  getSubstitutions, getMesSubstitutions, createSubstitution,
  accepterSubstitution, ignorerSubstitution, retirerSubstitution,
  getMesDocuments, uploadDocument, supprimerDocument, partagerDocument,
  getMesConventions, creerConvention, signerConvention,
};
