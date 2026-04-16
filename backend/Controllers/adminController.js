const Avocat = require('../Model/Avocat');
const Client = require('../Model/Client');



// Get all pending lawyer applications
const getAdminStats = async (req, res) => {
  try {
    const totalLawyers    = await Avocat.countDocuments();
    const verifiedLawyers = await Avocat.countDocuments({ status: 'approved' });
    const pendingLawyers  = await Avocat.countDocuments({ status: 'pending' });  // ✅
    const totalClients    = await Client.countDocuments();

    res.status(200).json({ success: true, stats: { totalLawyers, verifiedLawyers, pendingLawyers, totalClients } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin statistics' });
  }
};

const getPendingLawyers = async (req, res) => {
  try {
    const pendingLawyers = await Avocat.find({ status: 'pending' })  
      .select('-password -otp -otpRequestedAt -resetPasswordToken -resetPasswordExpires');

    res.status(200).json({ success: true, lawyers: pendingLawyers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending lawyers' });
  }
};

const verifyLawyer = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { action } = req.body;

    if (action === 'approve') {
      await Avocat.findByIdAndUpdate(lawyerId, { status: 'approved' });  // ✅
      res.status(200).json({ success: true, message: 'Lawyer approved successfully' });

    } else if (action === 'reject') {
      await Avocat.findByIdAndUpdate(lawyerId, { status: 'rejected' });  // ✅ mieux que delete
      res.status(200).json({ success: true, message: 'Lawyer application rejected' });

    } else {
      res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify lawyer' });
  }
};

module.exports = {
    getAdminStats,
    getPendingLawyers,
    verifyLawyer
};
