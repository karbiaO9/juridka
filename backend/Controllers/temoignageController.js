const Temoignage   = require('../Model/Temoignage');
const RendezVous   = require('../Model/RendezVous');
const Client       = require('../Model/Client');
const Notification = require('../Model/Notification');

/* ─── helpers ─── */
function anonymizeName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Client A.';
  if (parts.length === 1) return parts[0] + ' A.';
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
}

function checkEligibility(rdv) {
  const isCompleted =
    rdv.statut === 'terminé' ||
    (rdv.statut === 'confirmé' && new Date(rdv.date) < new Date());

  if (!isCompleted) return { eligible: false, reason: 'not_completed' };

  const aptDate   = new Date(rdv.date);
  const now       = new Date();
  const dayAfter  = new Date(aptDate.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(aptDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (now < dayAfter)  return { eligible: false, reason: 'too_early' };
  if (now > windowEnd) return { eligible: false, reason: 'expired' };

  return { eligible: true, windowExpireAt: windowEnd };
}

/* ─── POST /api/temoignages ─── */
exports.submitTemoignage = async (req, res) => {
  try {
    const clientId = req.user._id;
    const { rendezVousId, ratings, texte, consentPublier, consentStats } = req.body;

    if (!consentPublier) {
      return res.status(400).json({ message: 'Le consentement de publication est requis.' });
    }

    const rdv = await RendezVous.findById(rendezVousId);
    if (!rdv)                                         return res.status(404).json({ message: 'Rendez-vous introuvable.' });
    if (String(rdv.clientId) !== String(clientId))    return res.status(403).json({ message: 'Non autorisé.' });

    const eligibility = checkEligibility(rdv);
    if (!eligibility.eligible) {
      return res.status(400).json({ message: "Ce rendez-vous n'est pas éligible pour un témoignage.", reason: eligibility.reason });
    }

    const existing = await Temoignage.findOne({ rendezVousId });
    if (existing) {
      return res.status(400).json({ message: 'Un témoignage a déjà été soumis pour ce rendez-vous.' });
    }

    const client     = await Client.findById(clientId).select('fullName');
    const nomAnonyme = anonymizeName(client?.fullName || '');

    const temoignage = await Temoignage.create({
      clientId,
      avocatId:       rdv.avocatId,
      rendezVousId,
      ratings:        ratings || {},
      texte:          texte   || '',
      consentPublier,
      consentStats:   consentStats || false,
      nomAnonyme,
      windowExpireAt: eligibility.windowExpireAt,
    });

    // Notifier l'admin
    try {
      const dateStr = new Date(rdv.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      await Notification.create({
        type:          'temoignage_submitted',
        title:         'Nouveau témoignage à modérer',
        message:       `${nomAnonyme} a soumis un témoignage pour sa consultation du ${dateStr}. Référence : ${temoignage.reference}.`,
        recipientRole: 'admin',
        recipientId:   null, // broadcast à tous les admins
        entity:        { model: 'Temoignage', id: temoignage._id },
        meta:          { nomAnonyme, reference: temoignage.reference, date: dateStr },
      });
    } catch (notifErr) {
      console.error('Failed to notify admin of new testimonial:', notifErr);
    }

    res.status(201).json({ message: 'Témoignage soumis avec succès.', temoignage });
  } catch (error) {
    console.error('Error submitting testimonial:', error);
    res.status(500).json({ message: 'Erreur lors de la soumission.', error: error.message });
  }
};

/* ─── GET /api/temoignages/submitted-rdvs ─── */
exports.getSubmittedRdvIds = async (req, res) => {
  try {
    const clientId    = req.user._id;
    const temoignages = await Temoignage.find({ clientId }).select('rendezVousId statut reference createdAt');
    res.json(temoignages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error: error.message });
  }
};

/* ─── GET /api/temoignages/mes ─── */
exports.getMyTemoignages = async (req, res) => {
  try {
    const clientId    = req.user._id;
    const temoignages = await Temoignage.find({ clientId })
      .populate('avocatId',     'firstName lastName fullName')
      .populate('rendezVousId', 'date heure type')
      .sort({ createdAt: -1 });
    res.json(temoignages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error: error.message });
  }
};

/* ─── GET /api/temoignages/avocat/:id (public) ─── */
exports.getAvocatTemoignages = async (req, res) => {
  try {
    const temoignages = await Temoignage.find({ avocatId: req.params.id, statut: 'approuvé' })
      .select('nomAnonyme ratings texte publishedAt rendezVousId')
      .populate('rendezVousId', 'date')
      .sort({ publishedAt: -1 })
      .limit(50);
    res.json(temoignages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error: error.message });
  }
};

/* ─── GET /api/temoignages/admin/all ─── */
exports.adminGetAll = async (req, res) => {
  try {
    const { statut } = req.query;
    const filter      = statut ? { statut } : {};
    const temoignages = await Temoignage.find(filter)
      .populate('clientId',     'fullName email')
      .populate('avocatId',     'firstName lastName fullName')
      .populate('rendezVousId', 'date heure type')
      .sort({ createdAt: -1 });
    res.json(temoignages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error: error.message });
  }
};

/* ─── PATCH /api/temoignages/admin/:id/approve ─── */
exports.adminApprove = async (req, res) => {
  try {
    const t = await Temoignage.findByIdAndUpdate(
      req.params.id,
      { statut: 'approuvé', publishedAt: new Date() },
      { new: true }
    );
    if (!t) return res.status(404).json({ message: 'Témoignage introuvable.' });

    // Notifier le client
    try {
      await Notification.create({
        type:          'temoignage_approved',
        title:         'Témoignage publié',
        message:       `Votre témoignage (${t.reference}) a été examiné et publié sur le profil de l'avocat. Merci pour votre contribution !`,
        recipientRole: 'client',
        recipientId:   t.clientId,
        entity:        { model: 'Temoignage', id: t._id },
        meta:          { reference: t.reference },
      });
    } catch (notifErr) {
      console.error('Failed to notify client of approval:', notifErr);
    }

    res.json({ message: 'Témoignage approuvé.', temoignage: t });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error: error.message });
  }
};

/* ─── PATCH /api/temoignages/admin/:id/reject ─── */
exports.adminReject = async (req, res) => {
  try {
    const t = await Temoignage.findByIdAndUpdate(
      req.params.id,
      { statut: 'rejeté' },
      { new: true }
    );
    if (!t) return res.status(404).json({ message: 'Témoignage introuvable.' });

    // Notifier le client
    try {
      await Notification.create({
        type:          'temoignage_rejected',
        title:         'Témoignage non publié',
        message:       `Votre témoignage (${t.reference}) n'a pas pu être publié car il ne respecte pas nos conditions de publication.`,
        recipientRole: 'client',
        recipientId:   t.clientId,
        entity:        { model: 'Temoignage', id: t._id },
        meta:          { reference: t.reference },
      });
    } catch (notifErr) {
      console.error('Failed to notify client of rejection:', notifErr);
    }

    res.json({ message: 'Témoignage rejeté.', temoignage: t });
  } catch (error) {
    res.status(500).json({ message: 'Erreur.', error: error.message });
  }
};
