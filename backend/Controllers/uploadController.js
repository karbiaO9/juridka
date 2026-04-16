// cloudinary-backed upload controller
// Multer-storage-cloudinary places upload metadata on req.file
exports.uploadFile = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // multer-storage-cloudinary attaches the Cloudinary response to req.file
    // Different versions may put URL in req.file.path or req.file.secure_url
    const file = req.file;

    const url = file.path || file.secure_url || file.url;
    const publicId = file.filename || file.public_id || file.key || null;
    const format = file.format || file.mimetype || null;

    res.json({
      url,
      filename: file.originalname || file.name || null,
      contentType: file.mimetype || format || null,
      publicId,
      format,
      resource_type: file.resource_type || 'auto'
    });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
};
