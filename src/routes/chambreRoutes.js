const express = require('express');
const router = express.Router();
const { upload, handleUploadErrors } = require('../middlewares/uploadMiddleware');
const { 
  createChambre, 
  getChambres, 
  getChambreById, 
  updateChambre, 
  deleteChambre,
  uploadImage,
  uploadMultipleImages,
  deleteImage
} = require('../controllers/chambreControllers');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// ✅ ROUTES PUBLIQUES (sans authentification)
router.get('/', getChambres);
router.get('/:id', getChambreById);

// ✅ ROUTES PROTÉGÉES (admin seulement) - PLUS D'UPLOAD MULTER
router.post(
  '/', 
  protect, 
  restrictTo('admin'), 
  createChambre // ✅ Directement le controller (sans Multer)
);

router.put(
  '/:id', 
  protect, 
  restrictTo('admin'), 
  updateChambre // ✅ Directement le controller (sans Multer)
);

router.delete(
  '/:id', 
  protect, 
  restrictTo('admin'), 
  deleteChambre
);

// ✅ ROUTES D'UPLOAD SUPPLÉMENTAIRES (POUR AUTRES USAGES)
// Ces routes utilisent Multer pour des uploads spécifiques
router.post(
  '/upload/image', 
  protect, 
  restrictTo('admin'), 
  upload.single('image'), // ✅ Multer pour upload unique
  handleUploadErrors, 
  uploadImage
);

router.post(
  '/upload/images', 
  protect, 
  restrictTo('admin'), 
  upload.array('images', 10), // ✅ Multer pour upload multiple
  handleUploadErrors, 
  uploadMultipleImages
);

router.delete(
  '/images/:filename', 
  protect, 
  restrictTo('admin'), 
  deleteImage
);

module.exports = router;