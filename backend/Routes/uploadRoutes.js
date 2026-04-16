const express = require('express');
const router = express.Router();
const uploadController = require('../Controllers/uploadController');
// Use Cloudinary multer storage configured in ../config/cloudinary.js
const { upload } = require('../config/cloudinary');

// The `upload` middleware here is multer configured to use CloudinaryStorage.
router.post('/', upload.single('file'), uploadController.uploadFile);

module.exports = router;
