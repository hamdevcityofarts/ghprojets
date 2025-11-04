const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// ✅ CONFIGURATION CLOUDINARY
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('☁️ [Cloudinary] Configuration:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  configured: !!process.env.CLOUDINARY_API_KEY
});

// ✅ STOCKAGE CLOUDINARY POUR LES CHAMBRES
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'grand-hotel/rooms', // Dossier dans Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1920, height: 1080, crop: 'limit' }, // Image principale
      { quality: 'auto:good' }, // Compression automatique
      { fetch_format: 'auto' } // Format optimal (WebP si supporté)
    ],
    public_id: (req, file) => {
      // Générer un nom unique
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `room-${uniqueSuffix}`;
    }
  }
});

// ✅ FILTRAGE DES FICHIERS (même logique qu'avant)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls JPG, JPEG, PNG et WebP sont acceptés.'), false);
  }
};

// ✅ CONFIGURATION MULTER AVEC CLOUDINARY
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10 // Maximum 10 fichiers
  }
});

// ✅ GESTION DES ERREURS (inchangée)
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Fichier trop volumineux. Maximum 10MB autorisé.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Trop de fichiers. Maximum 10 images autorisées.'
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// ✅ NOUVELLE FONCTION : Supprimer une image de Cloudinary
const deleteFromCloudinary = async (imageUrl) => {
  try {
    // Extraire le public_id de l'URL Cloudinary
    // Exemple: https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg
    // Public ID: sample
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const publicId = `grand-hotel/rooms/${filename.split('.')[0]}`;
    
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('🗑️ [Cloudinary] Image supprimée:', publicId, result);
    return result;
  } catch (error) {
    console.error('❌ [Cloudinary] Erreur suppression:', error);
    throw error;
  }
};

module.exports = {
  upload,
  handleUploadErrors,
  cloudinary,
  deleteFromCloudinary
};