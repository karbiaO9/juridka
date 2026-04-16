const Case = require('../Model/Case');
const RendezVous = require('../Model/RendezVous');

// Helper to normalize file URLs from multer/cloudinary
const fileUrl = (f) => f.path || f.location || f.secure_url || f.url || f.public_id || f.filename || f.key || null;

// Create case - only lawyer
const createCase = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== 'avocat') return res.status(403).json({ error: 'Only lawyers can create cases' });

    const { title, description, appointment, client } = req.body;
    if (!title || !appointment) return res.status(400).json({ error: 'title and appointment are required' });

    const apt = await RendezVous.findById(appointment);
    if (!apt) return res.status(400).json({ error: 'Appointment not found' });
    if (String(apt.avocatId) !== String(user._id)) return res.status(403).json({ error: 'Appointment does not belong to this lawyer' });

    const clientId = client || apt.clientId;
    if (!clientId) return res.status(400).json({ error: 'Client not specified and not available from appointment' });

    const files = (req.files || []).map(fileUrl).filter(Boolean);

  const newCase = await Case.create({ title, description: description || '', files, lawyer: user._id, client: clientId, appointment });
  await newCase.populate('lawyer client appointment');
  res.status(201).json(newCase);
  } catch (err) {
    console.error('createCase error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// List cases for current user
const listCases = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const filter = user.userType === 'avocat' ? { lawyer: user._id } : { client: user._id };
    const cases = await Case.find(filter).populate('lawyer client appointment').sort({ createdAt: -1 });
    res.json(cases);
  } catch (err) {
    console.error('listCases error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get case details
const getCase = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const c = await Case.findById(id).populate('lawyer client appointment');
    if (!c) return res.status(404).json({ error: 'Case not found' });
    if (String(c.lawyer._id) !== String(user._id) && String(c.client._id) !== String(user._id)) return res.status(403).json({ error: 'Access denied' });
    res.json(c);
  } catch (err) {
    console.error('getCase error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update case (lawyer only)
const updateCase = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== 'avocat') return res.status(403).json({ error: 'Only lawyers can update cases' });
    const { id } = req.params;
    const c = await Case.findById(id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    if (String(c.lawyer) !== String(user._id)) return res.status(403).json({ error: 'Not your case' });

    if (req.body.description) c.description = req.body.description;
    if (req.body.state) c.state = req.body.state;
    const newFiles = (req.files || []).map(fileUrl).filter(Boolean);
    if (newFiles.length) c.files = (c.files || []).concat(newFiles);
  await c.save();
  await c.populate('lawyer client appointment');
  res.json(c);
  } catch (err) {
    console.error('updateCase error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete case (lawyer only)
const deleteCase = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== 'avocat') return res.status(403).json({ error: 'Only lawyers can delete cases' });
    const { id } = req.params;
    const c = await Case.findById(id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    if (String(c.lawyer) !== String(user._id)) return res.status(403).json({ error: 'Not your case' });
    await c.remove();
    res.json({ message: 'Case deleted' });
  } catch (err) {
    console.error('deleteCase error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete a single file from a case (lawyer only)
const deleteFileFromCase = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== 'avocat') return res.status(403).json({ error: 'Only lawyers can modify cases' });
    const { id } = req.params;
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'file field is required' });

    const c = await Case.findById(id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    if (String(c.lawyer) !== String(user._id)) return res.status(403).json({ error: 'Not your case' });

    const idx = (c.files || []).indexOf(file);
    if (idx === -1) return res.status(404).json({ error: 'File not found on case' });

  c.files.splice(idx, 1);
  await c.save();
  await c.populate('lawyer client appointment');
  res.json(c);
  } catch (err) {
    console.error('deleteFileFromCase error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Add files to a case (clients can only add files; lawyers can also add files)
const addFilesToCase = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const c = await Case.findById(id);
    if (!c) return res.status(404).json({ error: 'Case not found' });

    // Authorization: avocat must be case owner; client must be case owner
    if (user.userType === 'avocat') {
      if (String(c.lawyer) !== String(user._id)) return res.status(403).json({ error: 'Not your case' });
    } else if (user.userType === 'client') {
      if (String(c.client) !== String(user._id)) return res.status(403).json({ error: 'Not your case' });
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const newFiles = (req.files || []).map(fileUrl).filter(Boolean);
    if (!newFiles.length) return res.status(400).json({ error: 'No files attached' });

    c.files = (c.files || []).concat(newFiles);
    await c.save();
    await c.populate('lawyer client appointment');
    res.json(c);
  } catch (err) {
    console.error('addFilesToCase error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// export the new handler
module.exports = { createCase, listCases, getCase, updateCase, deleteCase, deleteFileFromCase, addFilesToCase };
