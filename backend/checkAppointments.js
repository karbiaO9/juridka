require('dotenv').config();
const mongoose = require('mongoose');
const RendezVous = require('./Model/RendezVous');
const Avocat = require('./Model/Avocat');
const Client = require('./Model/Client');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Check appointments count
    const appointmentCount = await RendezVous.countDocuments();
    console.log('📊 Total appointments in database:', appointmentCount);
    
    // Get first few appointments
    const appointments = await RendezVous.find({}).limit(5);
    console.log('📋 Sample appointments:', appointments);
    
    // Check avocats count
    const avocatCount = await Avocat.countDocuments();
    console.log('⚖️ Total avocats in database:', avocatCount);
    
    // Get first avocat with their ID
    const avocat = await Avocat.findOne({});
    if (avocat) {
      console.log('👨‍⚖️ Sample avocat:', {
        id: avocat._id,
        email: avocat.email,
        fullName: avocat.fullName
      });
      
      // Check appointments for this avocat
      const avocatAppointments = await RendezVous.find({ avocatId: avocat._id });
      console.log('📅 Appointments for this avocat:', avocatAppointments);
    }
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Database error:', err);
  });
