const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'juridika', // Folder name in Cloudinary
        allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
        resource_type: 'auto', // Automatically detect file type
        public_id: (req, file) => {
            // Generate unique filename
            return `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`;
        },
    },
});

// Create multer upload middleware
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow specific file types
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'), false);
        }
    }
});

module.exports = { cloudinary, upload };
