const RendezVous = require('../Model/RendezVous');
const Avocat = require('../Model/Avocat');
const Client = require('../Model/Client');
const Notification = require('../Model/Notification');
const mongoose = require('mongoose');

// Helper to convert time string to minutes
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Helper to convert minutes to time string
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Add one hour to a "HH:MM" string
function addOneHour(time) {
  if (!time) return time;
  return minutesToTime(timeToMinutes(time) + 60);
}

// Generate slots for a given day
async function generateSlots(avocatId, day) {
  const avocat = await Avocat.findById(avocatId);
  if (!avocat) return [];

  // ✅ Utiliser availability.slots au lieu de workingHours
  const slots = avocat.availability?.slots || [];
  
  if (slots.length === 0) return [];

  // Filtrer les slots qui correspondent au jour demandé
  const daySlots = slots.filter(
    s => s.day?.toLowerCase() === day?.toLowerCase()
  );

  if (daySlots.length === 0) {
    console.log(`❌ No slots found for ${day}`);
    return [];
  }

  // Retourner les slots avec startTime et endTime (+1h)
  return daySlots.map(s => ({
    startTime: s.time,
    endTime: addOneHour(s.time),
  }));
}

// Get available slots for booking
exports.getAvailableSlots = async (req, res) => {
  try {
    const { avocatId, day, date } = req.query;
    
    if (!avocatId || !day || !date) {
      return res.status(400).json({ message: 'Missing required parameters: avocatId, day, date' });
    }

    // Validate and parse date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Create date range for the entire day (from start to end of day)
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Generate all possible slots for this day
    const slots = await generateSlots(avocatId, day);
    
    if (slots.length === 0) {
      return res.json([]);
    }
    
    // Get booked or pending slots for this specific date
    const rendezvous = await RendezVous.find({ 
      avocatId, 
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      statut: { $in: ['en_attente', 'confirmé'] } 
    });
    
    console.log('🔍 Checking availability for:', {
      avocatId,
      date: appointmentDate.toISOString(),
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      foundAppointments: rendezvous.length,
      bookedTimes: rendezvous.map(r => ({ time: r.heure, status: r.statut, date: r.date }))
    });
    
    // Also check with exact date match as fallback
    const exactDateRendezvous = await RendezVous.find({
      avocatId,
      date: appointmentDate,
      statut: { $in: ['en_attente', 'confirmé'] }
    });
    
    console.log('🔍 Exact date match found:', exactDateRendezvous.length, 'appointments');
    
    // Combine both results to be safe
    const allBookedAppointments = [...rendezvous, ...exactDateRendezvous];
    const uniqueBookedTimes = [...new Set(allBookedAppointments.map(r => r.heure))];
    
    console.log('🔍 All booked times:', uniqueBookedTimes);
    
    // Extract the booked time slots
    const bookedTimes = uniqueBookedTimes;
    
    // Filter out booked slots, only return available ones
    const availableSlots = slots.filter(slot => !bookedTimes.includes(slot.startTime));
    
    console.log('✅ Available slots after filtering:', availableSlots.length, 'out of', slots.length);
    console.log('✅ Available slot times:', availableSlots.map(s => s.startTime));
    
    res.json(availableSlots);
  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({ message: 'Failed to get available slots', error: error.message });
  }
};

// Book a slot
exports.bookRendezVous = async (req, res) => {
  try {
    const { clientId, avocatId, date, heure, type, services, caseFiles } = req.body;
    
    // Validate required fields
    if (!clientId || !avocatId || !date || !heure || !type) {
      return res.status(400).json({ 
        message: 'All fields are required: clientId, avocatId, date, heure, type' 
      });
    }

    // Validate and parse date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Create date range for the entire day (from start to end of day)
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if slot is available
    const existing = await RendezVous.findOne({ 
      avocatId, 
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      heure, 
      statut: { $in: ['en_attente', 'confirmé'] } 
    });
    
    console.log('🔍 Booking validation:', {
      avocatId,
      date: appointmentDate.toISOString(),
      heure,
      existingAppointment: existing ? { time: existing.heure, status: existing.statut } : null
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Slot already booked or pending.' });
    }
    
    // Prevent double booking by client
    const clientDouble = await RendezVous.findOne({ 
      clientId, 
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      heure, 
      statut: { $in: ['en_attente', 'confirmé'] } 
    });
    
    if (clientDouble) {
      return res.status(400).json({ message: 'You have already booked this slot.' });
    }
    
    // Basic validation for services if provided
    let validatedServices = [];
    if (services && Array.isArray(services)) {
      validatedServices = services.map(s => ({
        name: s.name || 'Service',
        description: s.description || '',
        price: typeof s.price === 'number' ? s.price : parseFloat(s.price) || 0,
        currency: s.currency || 'USD'
      }));
    }

    // Basic validation for caseFiles if provided (expect array of { url, filename, contentType })
    let validatedCaseFiles = [];
    if (caseFiles && Array.isArray(caseFiles)) {
      validatedCaseFiles = caseFiles.map(f => ({
        url: f.url,
        filename: f.filename || '',
        contentType: f.contentType || '',
        uploadedBy: f.uploadedBy || clientId,
        uploadedAt: f.uploadedAt ? new Date(f.uploadedAt) : new Date()
      })).filter(f => f.url);
    }

    // Create new appointment
    const rendezvous = new RendezVous({ 
      clientId, 
      avocatId, 
      date: appointmentDate, 
      heure, 
      type, 
      services: validatedServices,
      caseFiles: validatedCaseFiles,
      statut: 'en_attente' 
    });
    
    await rendezvous.save();

    // Notify the avocat of the new booking
    try {
      const client = await Client.findById(clientId).select('fullName email');
      const clientName = client?.fullName || 'Un client';
      const dateStr = appointmentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

      await Notification.create({
        type: 'appointment_created',
        title: 'Nouveau rendez-vous',
        message: `${clientName} a réservé un rendez-vous le ${dateStr} à ${heure}`,
        recipientRole: 'avocat',
        recipientId: avocatId,
        entity: { model: 'RendezVous', id: rendezvous._id },
        meta: { clientName, date: dateStr, heure, type },
      });
    } catch (notifErr) {
      console.error('Failed to create appointment notification:', notifErr);
    }

    res.json({ message: 'Booking request submitted.', rendezvous });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ message: 'Failed to book appointment', error: error.message });
  }
};

// Lawyer approves booking
exports.approveRendezVous = async (req, res) => {
  const { id } = req.params;
  const rendezvous = await RendezVous.findById(id);
  if (!rendezvous || rendezvous.statut !== 'en_attente') return res.status(404).json({ message: 'Booking not found or not pending.' });
  rendezvous.statut = 'confirmé';
  await rendezvous.save();

  try {
    const avocat = await Avocat.findById(rendezvous.avocatId).select('firstName lastName fullName');
    const avocatName = avocat ? ([avocat.firstName, avocat.lastName].filter(Boolean).join(' ') || avocat.fullName || 'Votre avocat') : 'Votre avocat';
    const dateStr = new Date(rendezvous.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    await Notification.create({
      type: 'appointment_confirmed',
      title: 'Rendez-vous confirmé',
      message: `${avocatName} a confirmé votre rendez-vous du ${dateStr} à ${rendezvous.heure}.`,
      recipientRole: 'client',
      recipientId: rendezvous.clientId,
      entity: { model: 'RendezVous', id: rendezvous._id },
      meta: { avocatName, date: dateStr, heure: rendezvous.heure },
    });
  } catch (notifErr) {
    console.error('Failed to create approval notification:', notifErr);
  }

  res.json({ message: 'Booking approved.', rendezvous });
};

// Lawyer rejects booking
exports.rejectRendezVous = async (req, res) => {
  const { id } = req.params;
  const rendezvous = await RendezVous.findById(id);
  if (!rendezvous || rendezvous.statut !== 'en_attente') return res.status(404).json({ message: 'Booking not found or not pending.' });
  rendezvous.statut = 'annulé';
  await rendezvous.save();

  try {
    const avocat = await Avocat.findById(rendezvous.avocatId).select('firstName lastName fullName');
    const avocatName = avocat ? ([avocat.firstName, avocat.lastName].filter(Boolean).join(' ') || avocat.fullName || 'Votre avocat') : 'Votre avocat';
    const dateStr = new Date(rendezvous.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    await Notification.create({
      type: 'appointment_rejected',
      title: 'Rendez-vous refusé',
      message: `${avocatName} a refusé votre rendez-vous du ${dateStr} à ${rendezvous.heure}.`,
      recipientRole: 'client',
      recipientId: rendezvous.clientId,
      entity: { model: 'RendezVous', id: rendezvous._id },
      meta: { avocatName, date: dateStr, heure: rendezvous.heure },
    });
  } catch (notifErr) {
    console.error('Failed to create rejection notification:', notifErr);
  }

  res.json({ message: 'Booking rejected.', rendezvous });
};

// Get all rendezvous for a lawyer
exports.getLawyerRendezVous = async (req, res) => {
  try {
    const { avocatId } = req.query;
    
    console.log('🔍 Getting lawyer appointments for avocatId:', avocatId);
    
    if (!avocatId) {
      return res.status(400).json({ message: 'avocatId is required' });
    }
    
    const rendezvous = await RendezVous.find({ avocatId }).populate('clientId', 'fullName email phone').lean();
    
    console.log('✅ Found appointments:', rendezvous.length);
    console.log('📋 Appointments data:', rendezvous);
    
    res.json(rendezvous);
  } catch (error) {
    console.error('❌ Error fetching lawyer appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments', error: error.message });
  }
};

// Get all rendezvous for a client
exports.getClientRendezVous = async (req, res) => {
  try {
    const { clientId } = req.query;
    const rendezvous = await RendezVous.find({ clientId }).populate('avocatId', 'fullName email phone').lean();
    res.json(rendezvous);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch appointments', error: error.message });
  }
};

// Update an appointment (reschedule or change type). Ensures no double-booking for the avocat.
exports.updateRendezVous = async (req, res) => {
  try {
    const { id } = req.params;
  const { date, heure, type, statut, services, caseFiles, notes } = req.body;

    if (!id) return res.status(400).json({ message: 'Appointment id is required' });

    const rendezvous = await RendezVous.findById(id);
    if (!rendezvous) return res.status(404).json({ message: 'Appointment not found' });

    // Authorization: client, assigned avocat, or admin can update
    let requesterRole = null; // 'client' | 'avocat' | 'admin'
    try {
      const requestingUserId = req.user?._id || req.user?.id || (req.user && req.user._id);
      if (requestingUserId) {
        const reqIdStr = String(requestingUserId);
        const clientIdStr = String(rendezvous.clientId);
        const avocatIdStr = String(rendezvous.avocatId);
        if (req.user.role === 'admin') {
          requesterRole = 'admin';
        } else if (reqIdStr === avocatIdStr) {
          requesterRole = 'avocat';
        } else if (reqIdStr === clientIdStr) {
          requesterRole = 'client';
        } else {
          return res.status(403).json({ message: 'Not authorized to update this appointment' });
        }
      } else {
        return res.status(401).json({ message: 'Authentication required' });
      }
    } catch (authErr) {
      console.error('Auth check error in updateRendezVous:', authErr);
      return res.status(401).json({ message: 'Authentication required' });
    }

    // If date provided, validate
    let appointmentDate = rendezvous.date;
    if (date) {
      appointmentDate = new Date(date);
      if (isNaN(appointmentDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }

    // Build day range for the appointment date
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check for conflicts: another appointment for same avocat at same date/time (exclude current id)
    const conflict = await RendezVous.findOne({
      _id: { $ne: new mongoose.Types.ObjectId(id) },
      avocatId: rendezvous.avocatId,
      date: { $gte: startOfDay, $lte: endOfDay },
      heure: heure || rendezvous.heure,
      statut: { $in: ['en_attente', 'confirmé'] }
    });

    if (conflict) {
      return res.status(400).json({ message: 'Requested slot is already booked or pending' });
    }

    // Track if date/heure changed (to notify client)
    const oldDate = rendezvous.date;
    const oldHeure = rendezvous.heure;

    // Apply updates
    if (date) rendezvous.date = appointmentDate;
    if (heure) rendezvous.heure = heure;
    if (type) rendezvous.type = type;
    if (statut) rendezvous.statut = statut;
    if (notes !== undefined) rendezvous.notes = notes;
    // Update services and caseFiles when provided
    if (services && Array.isArray(services)) {
      rendezvous.services = services.map(s => ({
        name: s.name || 'Service',
        description: s.description || '',
        price: typeof s.price === 'number' ? s.price : parseFloat(s.price) || 0,
        currency: s.currency || 'USD'
      }));
    }
    if (caseFiles && Array.isArray(caseFiles)) {
      rendezvous.caseFiles = caseFiles.map(f => ({
        url: f.url,
        filename: f.filename || '',
        contentType: f.contentType || '',
        uploadedBy: f.uploadedBy || rendezvous.clientId,
        uploadedAt: f.uploadedAt ? new Date(f.uploadedAt) : new Date()
      })).filter(f => f.url);
    }

    await rendezvous.save();

    // Notify client if avocat or admin rescheduled (date or heure changed)
    const dateChanged = date && new Date(oldDate).toDateString() !== new Date(appointmentDate).toDateString();
    const heureChanged = heure && heure !== oldHeure;
    if ((dateChanged || heureChanged) && requesterRole !== 'client') {
      try {
        let senderName = 'Votre avocat';
        if (requesterRole === 'admin') {
          senderName = "L'administration";
        } else {
          const avocat = await Avocat.findById(rendezvous.avocatId).select('firstName lastName fullName');
          senderName = avocat ? ([avocat.firstName, avocat.lastName].filter(Boolean).join(' ') || avocat.fullName || 'Votre avocat') : 'Votre avocat';
        }
        const newDateStr = new Date(rendezvous.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

        await Notification.create({
          type: 'appointment_rescheduled',
          title: 'Rendez-vous reprogrammé',
          message: `${senderName} a reprogrammé votre rendez-vous au ${newDateStr} à ${rendezvous.heure}.`,
          recipientRole: 'client',
          recipientId: rendezvous.clientId,
          entity: { model: 'RendezVous', id: rendezvous._id },
          meta: { senderName, date: newDateStr, heure: rendezvous.heure, rescheduledBy: requesterRole },
        });
      } catch (notifErr) {
        console.error('Failed to create reschedule notification:', notifErr);
      }
    }

    res.json({ message: 'Appointment updated', rendezvous });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Failed to update appointment', error: error.message });
  }
};

// Mark appointment as paid (only lawyer can do this)
exports.markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod, paymentConfirmedBy, paymentConfirmedAt } = req.body;
    
    // Find the appointment
    const rendezvous = await RendezVous.findById(id);
    if (!rendezvous) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Verify the user is the assigned lawyer for this appointment
    if (rendezvous.avocatId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the assigned lawyer can mark payment' });
    }
    
    // Update payment information and status
    rendezvous.paymentStatus = paymentStatus || 'paid_in_person';
    rendezvous.paymentMethod = paymentMethod || 'in_person';
    rendezvous.paymentConfirmedBy = paymentConfirmedBy || req.user._id;
    rendezvous.paymentConfirmedAt = paymentConfirmedAt || new Date();

    await rendezvous.save();
    
    res.json({ 
      message: 'Payment status updated successfully', 
      rendezvous 
    });
  } catch (error) {
    console.error('Error marking appointment as paid:', error);
    res.status(500).json({ message: 'Failed to update payment status', error: error.message });
  }
},

// Admin — Get all appointments with filters
exports.getAllRendezVous = async (req, res) => {
  try {
    const { filter } = req.query;
    let query = {};

    if (filter === 'today') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end   = new Date(); end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };

    } else if (filter === '7days') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end   = new Date(); end.setDate(end.getDate() + 7);
      query.date = { $gte: start, $lte: end };

    } else if (filter === 'urgences') {
      query.type = 'urgence';

    } else if (filter === 'annules') {
      query.statut = 'annulé'; // ← ton enum exact dans la DB
    }

    const appointments = await RendezVous.find(query)
      .populate('clientId', 'firstName lastName fullName email profileType')
      .populate('avocatId', 'firstName lastName specialties barRegion gouvernorat photo')
      .sort({ date: -1, heure: -1 })
      .lean();

    // Stats pour le header
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [total7days, urgences] = await Promise.all([
      RendezVous.countDocuments({ date: { $gte: sevenDaysAgo } }),
      RendezVous.countDocuments({ type: 'urgence' }),
    ]);

    res.json({
      success: true,
      appointments,
      meta: { total7days, urgences }
    });

  } catch (err) {
    console.error('Error fetching all appointments (admin):', err);
    res.status(500).json({ success: false, message: err.message });
  }
};