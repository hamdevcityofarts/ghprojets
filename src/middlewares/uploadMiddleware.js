const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ CORRECTION CRITIQUE : Remonter de 2 niveaux pour sortir de /src/middlewares
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'rooms');

console.log('📁 [uploadMiddleware] Chemin uploads:', uploadDir);

// ✅ NE PAS créer le dossier ici, c'est server.js qui s'en charge
// Mais vérifier qu'il existe avant d'uploader
if (!fs.existsSync(uploadDir)) {
  console.log('⚠️ [uploadMiddleware] Dossier uploads inexistant, création...');
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Vérifier que le dossier existe au moment de l'upload
    if (!fs.existsSync(uploadDir)) {
      console.log('⚠️ [multer] Création du dossier uploads au moment de l\'upload');
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `room-${uniqueSuffix}${extension}`;
    console.log('📁 [multer] Fichier uploadé:', filename);
    cb(null, filename);
  }
});

// Filtrage des fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls JPG, JPEG, PNG et WebP sont acceptés.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10 // Maximum 10 fichiers
  }
});

// Middleware pour gérer les erreurs d'upload
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

module.exports = {
  upload,
  handleUploadErrors
};