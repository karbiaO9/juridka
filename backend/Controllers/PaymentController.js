const axios = require('axios');
const Avocat = require('../Model/Avocat');

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/avocat/register/payment-init
// Initialise un paiement Flouci et retourne le payment_url
// Auth requise
// Body: { plan, amount }
// ─────────────────────────────────────────────────────────────────────────────
const initFlouciPayment = async (req, res) => {
  const { plan, amount } = req.body;

  if (!plan || !amount) {
    return res.status(400).json({ error: 'plan et amount sont requis' });
  }

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    // Appel API Flouci pour créer le paiement
    const flouciRes = await axios.post(
      'https://developers.flouci.com/api/generate_payment',
      {
        app_token:    process.env.FLOUCI_APP_TOKEN,
        app_secret:   process.env.FLOUCI_APP_SECRET,
        amount:       amount * 1000,  // Flouci attend des millimes (1 DT = 1000)
        accept_card:  true,
        session_id:   avocat._id.toString(),
        success_link: `${process.env.FRONTEND_URL}/avocat/onboarding/payment-success`,
        fail_link:    `${process.env.FRONTEND_URL}/avocat/onboarding/payment-fail`,
        developer_tracking_id: `avocat-${avocat._id}-${Date.now()}`,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { payment_id, link } = flouciRes.data.result;

    // Sauvegarder l'intention de paiement en base
    avocat.payment = {
      plan,
      mode:      'online',
      status:    'pending',
      amount,
      paymentId: payment_id,
    };
    await avocat.save();

    return res.status(200).json({
      payment_url: link,
      payment_id,
    });
  } catch (err) {
    console.error('[Flouci] init error:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'Impossible d\'initialiser le paiement Flouci',
      details: err.response?.data || err.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/avocat/register/payment-verify?payment_id=xxx
// Appelé par le frontend après redirection depuis Flouci (success_link)
// Auth requise
// ─────────────────────────────────────────────────────────────────────────────
const verifyFlouciPayment = async (req, res) => {
  const { payment_id } = req.query;

  if (!payment_id) {
    return res.status(400).json({ error: 'payment_id requis' });
  }

  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    // Vérifier le paiement auprès de Flouci
    const flouciRes = await axios.get(
      `https://developers.flouci.com/api/verify_payment/${payment_id}`,
      {
        headers: {
          'apppublic': process.env.FLOUCI_APP_TOKEN,
          'appsecret': process.env.FLOUCI_APP_SECRET,
        },
      },
    );

    const { result } = flouciRes.data;

    if (result?.status === 'SUCCESS') {
      // Paiement confirmé → activer le compte
      avocat.payment.status = 'paid';
      avocat.payment.paidAt = new Date();
      avocat.status         = 'pending'; // en attente validation admin docs
      avocat.submittedAt    = new Date();
      await avocat.save();

      // Notifier les admins
      const Notification = require('../Model/Notification');
      await Notification.create({
        type: 'payment_confirmed',
        title: 'Paiement Flouci confirmé',
        message: `Paiement confirmé — avocat : ${avocat.firstName} ${avocat.lastName} (${avocat.email}) — Plan : ${avocat.payment.plan}`,
        recipientRole: 'admin',
        entity: { model: 'Avocat', id: avocat._id },
        meta: { plan: avocat.payment.plan, mode: 'flouci' },
      }).catch((e) => console.error('Notification error:', e));

      return res.status(200).json({
        message: 'Paiement confirmé',
        status:  'paid',
      });
    }

    // Paiement échoué ou en attente
    avocat.payment.status = 'failed';
    await avocat.save();

    return res.status(400).json({
      error:  'Paiement non confirmé',
      status: result?.status || 'unknown',
    });
  } catch (err) {
    console.error('[Flouci] verify error:', err.response?.data || err.message);
    return res.status(500).json({
      error:   'Erreur vérification paiement',
      details: err.response?.data || err.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/avocat/register/payment-proof
// Upload justificatif de virement bancaire
// Auth requise — Multipart, champ : justif
// ─────────────────────────────────────────────────────────────────────────────
const savePaymentProof = async (req, res) => {
  try {
    const avocat = await Avocat.findById(req.user._id);
    if (!avocat) return res.status(404).json({ error: 'Avocat introuvable' });

    if (!req.file) {
      return res.status(400).json({ error: 'Justificatif requis' });
    }

    avocat.payment = {
      plan:      req.body.plan || '',
      mode:      'virement',
      status:    'pending',       // en attente vérification manuelle admin
      amount:    req.body.amount || 0,
      proofUrl:  req.file.path,   // URL Cloudinary
      paidAt:    null,
    };
    avocat.status      = 'pending';
    avocat.submittedAt = new Date();
    await avocat.save();

    // Notifier les admins
    const Notification = require('../Model/Notification');
    await Notification.create({
      type: 'payment_pending',
      title: 'Virement bancaire en attente',
      message: `Virement en attente — avocat : ${avocat.firstName} ${avocat.lastName} (${avocat.email}) — Plan : ${avocat.payment.plan}`,
      recipientRole: 'admin',
      entity: { model: 'Avocat', id: avocat._id },
      meta: { plan: avocat.payment.plan, mode: 'virement' },
    }).catch((e) => console.error('Notification error:', e));

    return res.status(200).json({ message: 'Justificatif enregistré, en attente de validation' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  initFlouciPayment,
  verifyFlouciPayment,
  savePaymentProof,
};